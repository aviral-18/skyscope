import { NextResponse } from 'next/server';
import { fetchFlightTrack } from '@/lib/api-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const icao24 = searchParams.get('icao24');

  if (!icao24) {
    return NextResponse.json({ error: 'icao24 parameter required' }, { status: 400 });
  }

  try {
    const track = await fetchFlightTrack(icao24.toLowerCase());
    return NextResponse.json({ track, icao24 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch track' }, { status: 500 });
  }
}
