/**
 * Flightradar24 data service — primary source for flight details.
 *
 * Uses the `flightradar24-client` npm package which queries the public
 * data-live.flightradar24.com endpoints (no authentication required).
 *
 * Includes:
 *  - LRU cache with 5-minute TTL (avoids hammering FR24 on repeated clicks)
 *  - Request throttle queue (max 1 request/sec)
 */

// flightradar24-client is a CommonJS module — dynamic import handles this cleanly
let fr24Module: any = null;

async function getFR24() {
  if (!fr24Module) {
    try {
      fr24Module = await import('flightradar24-client');
    } catch (e) {
      console.warn('flightradar24-client not available:', e);
      return null;
    }
  }
  return fr24Module;
}

// ---------------------------------------------------------------------------
// LRU Cache
// ---------------------------------------------------------------------------
interface CacheEntry {
  data: FR24FlightDetails | null;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE = 500;
const cache = new Map<string, CacheEntry>();

function getCached(key: string): FR24FlightDetails | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined; // miss
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return undefined; // expired
  }
  // LRU: move to end
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

function setCache(key: string, data: FR24FlightDetails | null) {
  // Evict oldest if over limit
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Throttle queue — max 1 request per second
// ---------------------------------------------------------------------------
let lastRequestTime = 0;
const MIN_INTERVAL = 1100; // ms

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------
export interface FR24FlightDetails {
  origin: { name: string; icao: string; iata: string; lat: number; lng: number } | null;
  destination: { name: string; icao: string; iata: string; lat: number; lng: number } | null;
  aircraftType: string | null;
  registration: string | null;
  airline: string | null;
  flightNumber: string | null;
  fr24Id: string;
}

/**
 * Attempt to fetch full flight details from FR24.
 *
 * Strategy:
 *  1. Search a bounding box around the aircraft's current position
 *  2. Match by callsign (primary) or icao24 hex (secondary)
 *  3. Fetch the full flight page data via fetchFlight()
 */
export async function fetchFR24FlightDetails(
  icao24: string,
  callsign: string,
  lat: number,
  lng: number,
): Promise<FR24FlightDetails | null> {
  const cacheKey = icao24.toLowerCase();

  // Check cache first
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  const fr24 = await getFR24();
  if (!fr24) {
    setCache(cacheKey, null);
    return null;
  }

  try {
    await throttle();

    // Search a ±3° box around the aircraft
    const boxSize = 3;
    const north = Math.min(90, lat + boxSize);
    const south = Math.max(-90, lat - boxSize);
    const east = Math.min(180, lng + boxSize);
    const west = Math.max(-180, lng - boxSize);

    const flights = await fr24.fetchFromRadar(north, south, west, east);

    if (!flights || flights.length === 0) {
      setCache(cacheKey, null);
      return null;
    }

    // Match by callsign first, then by icao24 hex
    const cleanCallsign = callsign.trim().toUpperCase();
    const cleanIcao = icao24.trim().toLowerCase();

    let match = flights.find(
      (f: any) => f.callsign && f.callsign.trim().toUpperCase() === cleanCallsign,
    );
    if (!match) {
      match = flights.find(
        (f: any) => f.icao24 && f.icao24.trim().toLowerCase() === cleanIcao,
      );
    }
    if (!match) {
      // Fuzzy match: callsign starts with the same prefix
      match = flights.find(
        (f: any) => f.callsign && cleanCallsign && f.callsign.trim().toUpperCase().startsWith(cleanCallsign.slice(0, 5)),
      );
    }

    if (!match || !match.id) {
      setCache(cacheKey, null);
      return null;
    }

    // Fetch full flight details
    let detail: any = null;
    try {
      await throttle();
      detail = await fr24.fetchFlight(match.id);
    } catch (err) {
      console.warn(`FR24 fetchFlight failed for ID ${match.id}, using radar match fallback:`, err);
    }

    const result: FR24FlightDetails = {
      origin: detail?.origin
        ? {
            name: detail.origin.name || detail.origin.id || '',
            icao: detail.origin.icao || detail.origin.id || '',
            iata: detail.origin.id || '',
            lat: detail.origin.coordinates?.latitude ?? detail.origin.lat ?? 0,
            lng: detail.origin.coordinates?.longitude ?? detail.origin.lng ?? 0,
          }
        : (match.origin ? {
            name: '',
            icao: match.origin, // Pass IATA as icao so enrichAirport can search it
            iata: match.origin,
            lat: 0,
            lng: 0,
          } : null),
      destination: detail?.destination
        ? {
            name: detail.destination.name || detail.destination.id || '',
            icao: detail.destination.icao || detail.destination.id || '',
            iata: detail.destination.id || '',
            lat: detail.destination.coordinates?.latitude ?? detail.destination.lat ?? 0,
            lng: detail.destination.coordinates?.longitude ?? detail.destination.lng ?? 0,
          }
        : (match.destination ? {
            name: '',
            icao: match.destination,
            iata: match.destination,
            lat: 0,
            lng: 0,
          } : null),
      aircraftType: detail?.model || match.model || null,
      registration: detail?.registration || (match.registration !== '' ? match.registration : null),
      airline: detail?.airline || (match.flight ? match.flight.slice(0, 3) : null),
      flightNumber: match.flight || detail?.callsign || null,
      fr24Id: String(match.id),
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('FR24 fetch failed for', icao24, err);
    setCache(cacheKey, null);
    return null;
  }
}
