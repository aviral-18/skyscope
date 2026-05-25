import { Aircraft, ATCStream } from '@/types/aviation';
import { generateMockAircraft, updateMockPositions, mockATCStreams } from './mock-data';

const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
const OPENSKY_URL = process.env.NEXT_PUBLIC_OPENSKY_API_URL || 'https://opensky-network.org/api';
const OPENSKY_USER = process.env.OPENSKY_USERNAME || '';
const OPENSKY_PASS = process.env.OPENSKY_PASSWORD || '';

// --- Server-side cache ---
interface FlightCache {
  aircraft: Aircraft[];
  timestamp: number;
  source: 'live' | 'cached' | 'mock';
}

let flightCache: FlightCache | null = null;
const CACHE_TTL = 12000; // 12 seconds

// Trail history accumulator — persists across requests
const trailHistory: Map<string, [number, number][]> = new Map();
const MAX_TRAIL_POINTS = 40;

// --- Callsign → Airline detection ---
const AIRLINE_PREFIXES: Record<string, string> = {
  UAL: 'UAL', DAL: 'DAL', AAL: 'AAL', SWA: 'SWA', BAW: 'BAW',
  DLH: 'DLH', AFR: 'AFR', KLM: 'KLM', QFA: 'QFA', SIA: 'SIA',
  UAE: 'UAE', THY: 'THY', ANA: 'ANA', JAL: 'JAL', CPA: 'CPA',
  ETH: 'ETH', RYR: 'RYR', EZY: 'EZY', VIR: 'VIR', ACA: 'ACA',
  SWR: 'SWR', AZA: 'AZA', IBE: 'IBE', TAP: 'TAP', FIN: 'FIN',
  SAS: 'SAS', LOT: 'LOT', CSN: 'CSN', CES: 'CES', CCA: 'CCA',
  AIC: 'AIC', IGO: 'IGO', SEJ: 'SEJ', AXM: 'AXM', CEB: 'CEB',
  LNI: 'LNI', GIA: 'GIA', MAS: 'MAS', THA: 'THA', EVA: 'EVA',
  CAL: 'CAL', KAL: 'KAL', AAR: 'AAR', JBU: 'JBU', NKS: 'NKS',
  FFT: 'FFT', ASA: 'ASA', HAL: 'HAL', WJA: 'WJA', VOZ: 'VOZ',
  QTR: 'QTR', ETD: 'ETD', SVA: 'SVA', MEA: 'MEA', RJA: 'RJA',
  ELY: 'ELY', SAA: 'SAA', KQA: 'KQA', RAM: 'RAM', MSR: 'MSR',
  AVA: 'AVA', LAN: 'LAN', GLO: 'GLO', TAM: 'TAM', AMX: 'AMX',
  SKW: 'SKW', RPA: 'RPA', ENY: 'ENY', ASH: 'ASH', PDT: 'PDT',
  EDV: 'EDV', GJS: 'GJS', JIA: 'JIA', CPZ: 'CPZ', FDX: 'FDX',
  UPS: 'UPS', GTI: 'GTI', CLX: 'CLX', ABW: 'ABW', MPH: 'MPH',
};

function detectAirline(callsign: string): string | undefined {
  if (!callsign || callsign.length < 3) return undefined;
  const prefix = callsign.slice(0, 3).toUpperCase();
  return AIRLINE_PREFIXES[prefix];
}




// --- OpenSky response parser ---
function parseOpenSkyResponse(data: { states: (string | number | boolean | null)[][] }): Aircraft[] {
  if (!data?.states) return [];
  return data.states
    .filter((s: (string | number | boolean | null)[]) => {
      // Filter out entries with no position
      const lat = s[6];
      const lng = s[5];
      return lat !== null && lng !== null && lat !== undefined && lng !== undefined;
    })
    .map((s: (string | number | boolean | null)[]) => {
      const icao24 = String(s[0] || '').trim();
      const callsign = String(s[1] || '').trim();
      const lat = Number(s[6]) || 0;
      const lng = Number(s[5]) || 0;

      // Accumulate trail history
      if (icao24 && lat !== 0 && lng !== 0) {
        const existing = trailHistory.get(icao24) || [];
        const lastPoint = existing[existing.length - 1];
        // Only add if position actually changed
        if (!lastPoint || Math.abs(lastPoint[0] - lat) > 0.001 || Math.abs(lastPoint[1] - lng) > 0.001) {
          existing.push([lat, lng]);
          if (existing.length > MAX_TRAIL_POINTS) {
            existing.splice(0, existing.length - MAX_TRAIL_POINTS);
          }
          trailHistory.set(icao24, existing);
        }
      }

      return {
        icao24,
        callsign,
        originCountry: String(s[2] || ''),
        longitude: lng,
        latitude: lat,
        altitude: Math.round((Number(s[7]) || Number(s[13]) || 0) * 3.28084),
        velocity: Math.round((Number(s[9]) || 0) * 1.94384),
        heading: Number(s[10]) || 0,
        verticalRate: (Number(s[11]) || 0) * 3.28084,
        onGround: Boolean(s[8]),
        squawk: String(s[14] || ''),
        lastUpdate: Number(s[4]) ? Number(s[4]) * 1000 : Date.now(),
        airline: detectAirline(callsign),
        trail: trailHistory.get(icao24) ? [...trailHistory.get(icao24)!] : undefined,
      };
    });
}

// --- Auth headers ---
function getAuthHeaders(): HeadersInit {
  if (OPENSKY_USER && OPENSKY_PASS) {
    const credentials = Buffer.from(`${OPENSKY_USER}:${OPENSKY_PASS}`).toString('base64');
    return { 'Authorization': `Basic ${credentials}` };
  }
  return {};
}

// --- Mock data cache ---
let cachedMockAircraft: Aircraft[] | null = null;

// --- Main fetch function ---
export async function fetchAircraft(): Promise<{ aircraft: Aircraft[]; source: 'live' | 'cached' | 'mock' }> {
  // Return cached data if fresh
  if (flightCache && (Date.now() - flightCache.timestamp) < CACHE_TTL) {
    return { aircraft: flightCache.aircraft, source: 'cached' };
  }

  if (useMock) {
    if (!cachedMockAircraft) cachedMockAircraft = generateMockAircraft(800);
    cachedMockAircraft = updateMockPositions(cachedMockAircraft);
    flightCache = { aircraft: cachedMockAircraft, timestamp: Date.now(), source: 'mock' };
    return { aircraft: cachedMockAircraft, source: 'mock' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${OPENSKY_URL}/states/all`, {
      headers: getAuthHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`OpenSky API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const aircraft = parseOpenSkyResponse(data);

    flightCache = { aircraft, timestamp: Date.now(), source: 'live' };
    return { aircraft, source: 'live' };
  } catch (err) {
    console.warn('OpenSky API failed:', err);

    // Return stale cache if available
    if (flightCache) {
      return { aircraft: flightCache.aircraft, source: 'cached' };
    }

    // Last resort: mock data
    if (!cachedMockAircraft) cachedMockAircraft = generateMockAircraft(800);
    cachedMockAircraft = updateMockPositions(cachedMockAircraft);
    flightCache = { aircraft: cachedMockAircraft, timestamp: Date.now(), source: 'mock' };
    return { aircraft: cachedMockAircraft, source: 'mock' };
  }
}

// --- Fetch flight track for a specific aircraft ---
export async function fetchFlightTrack(icao24: string): Promise<[number, number][]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const url = `${OPENSKY_URL}/tracks/all?icao24=${icao24}&time=0`;

    const res = await fetch(url, {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      // Fall back to accumulated trail
      return trailHistory.get(icao24) || [];
    }

    const data = await res.json();
    if (data?.path && Array.isArray(data.path)) {
      // OpenSky track format: [time, lat, lng, baro_altitude, true_track, on_ground]
      return data.path
        .filter((p: number[]) => p[1] !== null && p[2] !== null)
        .map((p: number[]) => [p[1], p[2]] as [number, number]);
    }

    return trailHistory.get(icao24) || [];
  } catch {
    // Fall back to accumulated trail
    return trailHistory.get(icao24) || [];
  }
}

// --- Bounded query ---
export async function fetchAircraftInBounds(
  lamin: number, lomin: number, lamax: number, lomax: number
): Promise<{ aircraft: Aircraft[]; source: 'live' | 'cached' | 'mock' }> {
  if (useMock) {
    const { aircraft } = await fetchAircraft();
    return {
      aircraft: aircraft.filter(a =>
        a.latitude >= lamin && a.latitude <= lamax &&
        a.longitude >= lomin && a.longitude <= lomax
      ),
      source: 'mock',
    };
  }

  // Use cached global data and filter client-side — more efficient than bounded API calls
  const { aircraft, source } = await fetchAircraft();
  return {
    aircraft: aircraft.filter(a =>
      a.latitude >= lamin && a.latitude <= lamax &&
      a.longitude >= lomin && a.longitude <= lomax
    ),
    source,
  };
}

export function getATCStreams(): ATCStream[] {
  return mockATCStreams.map(s => ({ ...s, listeners: Math.floor(Math.random() * 500) + 50 }));
}
