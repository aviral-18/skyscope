import { NextResponse } from 'next/server';
import { fetchAircraft } from '@/lib/api-service';

export async function GET() {
  try {
    const { aircraft, source } = await fetchAircraft();
    return NextResponse.json(
      {
        aircraft,
        timestamp: Date.now(),
        count: aircraft.length,
        source,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=12, stale-while-revalidate=5',
        },
      }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to fetch flights', source: 'error' }, { status: 500 });
  }
}
