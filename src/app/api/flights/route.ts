import { NextResponse } from 'next/server';
import { fetchAircraft } from '@/lib/api-service';

export async function GET() {
  try {
    const { aircraft, source } = await fetchAircraft();
    return NextResponse.json({
      aircraft,
      timestamp: Date.now(),
      count: aircraft.length,
      source,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch flights', source: 'error' }, { status: 500 });
  }
}
