import { NextResponse } from 'next/server';
import { generateCommsMessages, generateNewMessage } from '@/lib/pilot-messages';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const airport = searchParams.get('airport') || 'KJFK';
  const frequency = searchParams.get('frequency') || '119.100';
  const single = searchParams.get('single') === 'true';
  const callsign = searchParams.get('callsign') || undefined;

  const alt = searchParams.has('alt') ? Number(searchParams.get('alt')) : undefined;
  const spd = searchParams.has('spd') ? Number(searchParams.get('spd')) : undefined;
  const hdg = searchParams.has('hdg') ? Number(searchParams.get('hdg')) : undefined;
  const vRate = searchParams.has('vRate') ? Number(searchParams.get('vRate')) : undefined;
  const onGround = searchParams.has('onGround') ? searchParams.get('onGround') === 'true' : undefined;

  const ctx = { alt, spd, hdg, vRate, onGround };

  if (single) {
    return NextResponse.json({ message: generateNewMessage(airport, frequency, callsign, ctx) });
  }
  return NextResponse.json({ messages: generateCommsMessages(airport, frequency, 12, callsign, ctx) });
}
