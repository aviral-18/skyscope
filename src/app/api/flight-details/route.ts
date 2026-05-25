import { NextResponse } from 'next/server';
import { fetchFR24FlightDetails } from '@/lib/fr24-service';

// ---------------------------------------------------------------------------
// Airport database (loaded once from GitHub, cached in-process)
// ---------------------------------------------------------------------------
let airportCache: Record<string, any> | null = null;

async function getAirports() {
  if (!airportCache) {
    try {
      const res = await fetch(
        'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json',
        { next: { revalidate: 86400 } }, // re-fetch at most once per day
      );
      if (res.ok) airportCache = await res.json();
    } catch (e) {
      console.error('Failed to load airport DB', e);
    }
  }
  return airportCache || {};
}

// ---------------------------------------------------------------------------
// Helper: enrich an ICAO code with coordinates from the airport DB
// ---------------------------------------------------------------------------
function enrichAirport(
  icao: string,
  name: string,
  iata: string,
  lat: number | null,
  lng: number | null,
  airports: Record<string, any>,
) {
  let apt = airports[icao];
  if (!apt && icao) {
    const searchVal = icao.toUpperCase();
    apt = Object.values(airports).find(
      (a: any) =>
        (a.iata && a.iata.toUpperCase() === searchVal) ||
        (a.icao && a.icao.toUpperCase() === searchVal),
    );
  }

  // If we already have coordinates, use them
  if (lat && lng && lat !== 0 && lng !== 0) {
    // Try to enrich name from DB if we only have IATA/ICAO
    const enrichedName =
      name && name.length > 4
        ? name
        : apt
          ? `${apt.city || apt.name} (${iata || icao})`
          : name || icao;
    return { name: enrichedName, icao: apt?.icao || icao, iata: apt?.iata || iata || icao, lat, lng };
  }
  // Look up in DB
  if (apt) {
    return {
      name: `${apt.city || apt.name} (${apt.iata || apt.icao})`,
      icao: apt.icao || icao,
      iata: apt.iata || iata || '',
      lat: Number(apt.lat),
      lng: Number(apt.lon),
    };
  }
  return { name: name || icao, icao, iata, lat: null, lng: null };
}

// ---------------------------------------------------------------------------
// Tier 2 fallbacks: OpenSky /routes + HexDB
// ---------------------------------------------------------------------------
async function fetchOpenSkyRoute(callsign: string) {
  if (!callsign) return null;
  try {
    const res = await fetch(
      `https://opensky-network.org/api/routes?callsign=${encodeURIComponent(callsign)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.route && data.route.length >= 2) {
      return { originIcao: data.route[0], destIcao: data.route[1] };
    }
  } catch {}
  return null;
}

async function fetchHexDB(icao24: string) {
  if (!icao24) return null;
  try {
    const res = await fetch(`https://hexdb.io/api/v1/aircraft/${icao24}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && !data.error) {
      return {
        manufacturer: data.Manufacturer || null,
        type: data.Type || null,
        registration: data.Registration || null,
        operator: data.RegisteredOwners || null,
      };
    }
  } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// GET handler — multi-tier resolver
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const icao24 = searchParams.get('icao24') || '';
  const callsign = searchParams.get('callsign') || '';
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');

  if (!icao24 && !callsign) {
    return NextResponse.json({ error: 'Missing icao24 or callsign' }, { status: 400 });
  }

  const airports = await getAirports();

  // ── Tier 1: Flightradar24 ─────────────────────────────────────────────
  const fr24 = await fetchFR24FlightDetails(
    icao24,
    callsign.trim(),
    lat,
    lng,
  );

  if (fr24) {
    const origin = fr24.origin
      ? enrichAirport(
          fr24.origin.icao,
          fr24.origin.name,
          fr24.origin.iata,
          fr24.origin.lat,
          fr24.origin.lng,
          airports,
        )
      : null;

    const destination = fr24.destination
      ? enrichAirport(
          fr24.destination.icao,
          fr24.destination.name,
          fr24.destination.iata,
          fr24.destination.lat,
          fr24.destination.lng,
          airports,
        )
      : null;

    return NextResponse.json(
      {
        aircraft: fr24.aircraftType || fr24.registration
          ? {
              manufacturer: null,
              type: fr24.aircraftType,
              registration: fr24.registration,
              operator: fr24.airline,
            }
          : null,
        route: origin && destination ? { origin, destination } : null,
        flightNumber: fr24.flightNumber,
        source: 'fr24',
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      }
    );
  }

  // ── Tier 2: OpenSky /routes + HexDB ──────────────────────────────────
  const [openSkyRoute, hexdb] = await Promise.all([
    fetchOpenSkyRoute(callsign.trim()),
    fetchHexDB(icao24),
  ]);

  let origin = null;
  let destination = null;

  if (openSkyRoute) {
    origin = enrichAirport(openSkyRoute.originIcao, '', '', null, null, airports);
    destination = enrichAirport(openSkyRoute.destIcao, '', '', null, null, airports);
  }

  return NextResponse.json(
    {
      aircraft: hexdb || null,
      route: origin && destination ? { origin, destination } : null,
      source: openSkyRoute ? 'opensky' : hexdb ? 'hexdb' : 'none',
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    }
  );
}
