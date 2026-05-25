import { NextResponse } from 'next/server';
import { fetchAircraft } from '@/lib/api-service';

const IATA_TO_ICAO: Record<string, string> = {
  ai: 'aic', '6e': 'igo', sg: 'sej', ua: 'ual', dl: 'dal', aa: 'aal', wn: 'swa', ba: 'baw',
  lh: 'dlh', af: 'afr', kl: 'klm', qf: 'qfa', sq: 'sia', ek: 'uae', tk: 'thy', nh: 'ana',
  jl: 'jal', cx: 'cpa', et: 'eth', fr: 'ryr', u2: 'ezy', vs: 'vir', ac: 'aca', lx: 'swr',
  az: 'aza', ib: 'ibe', tp: 'tap', ay: 'fin', sk: 'sas', lo: 'lot', cz: 'csn', mu: 'ces',
  ca: 'cca', ak: 'axm', '5j': 'ceb', jt: 'lni', ga: 'gia', mh: 'mas', tg: 'tha', br: 'eva',
  ci: 'cal', ke: 'kal', oz: 'aar', b6: 'jbu', nk: 'nks', f9: 'fft', as: 'asa', ha: 'hal',
  ws: 'wja', va: 'voz', qr: 'qtr', ey: 'etd', sv: 'sva', me: 'mea', rj: 'rja', ly: 'ely',
  sa: 'saa', kq: 'kqa', at: 'ram', ms: 'msr', av: 'ava', la: 'lan', g3: 'glo', ad: 'azu',
  am: 'amx', oo: 'skw', yx: 'rpa', mq: 'eny', yv: 'ash', pt: 'pdt', '9e': 'edv', oh: 'jia',
  fx: 'fdx', '5x': 'ups', '5y': 'gti', cv: 'clx', ru: 'abw', mp: 'mph'
};

function getSearchQueries(query: string): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const cleanQ = q.replace(/[^a-z0-9]/g, '');
  const queries = [q];
  if (cleanQ && cleanQ !== q) queries.push(cleanQ);

  const match = cleanQ.match(/^([a-z0-9]{2})(\d+)$/);
  if (match) {
    const iata = match[1];
    const num = match[2];
    const icao = IATA_TO_ICAO[iata];
    if (icao) {
      queries.push(icao + num);
    }
  }
  return Array.from(new Set(queries));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const queries = getSearchQueries(q);
  if (queries.length === 0) return NextResponse.json({ results: [] });

  const matchQuery = (val: string | undefined | null) => {
    if (!val) return false;
    const lowerVal = val.toLowerCase();
    return queries.some(qry => lowerVal.includes(qry));
  };

  const { aircraft } = await fetchAircraft();
  const results = aircraft
    .filter(a =>
      matchQuery(a.callsign) ||
      matchQuery(a.icao24) ||
      matchQuery(a.registration) ||
      matchQuery(a.airline) ||
      matchQuery(a.originCountry) ||
      matchQuery(a.origin) ||
      matchQuery(a.destination) ||
      matchQuery(a.flightNumber)
    )
    .slice(0, 30)
    .map(a => ({
      type: 'flight' as const,
      id: a.icao24,
      label: a.flightNumber || a.callsign || a.icao24.toUpperCase(),
      sublabel: `${a.originCountry} · ${a.onGround ? 'On Ground' : `FL${Math.round(a.altitude / 100)} · ${Math.round(a.velocity)} kts`}`,
      data: a,
    }));

  return NextResponse.json({ results });
}
