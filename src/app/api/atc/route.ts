import { NextResponse } from 'next/server';
import { getATCStreams } from '@/lib/api-service';

export async function GET() {
  return NextResponse.json(
    { streams: getATCStreams() },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    }
  );
}
