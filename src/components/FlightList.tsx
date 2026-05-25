'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFlightStore } from '@/store/flight-store';
import { getAirlineName, getAircraftTypeName } from '@/lib/utils';
import { Aircraft } from '@/types/aviation';

type SortKey = 'callsign' | 'altitude' | 'speed' | 'country';

function FlightRow({ aircraft, isSelected, onClick }: { aircraft: Aircraft; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-all duration-150 ${
        isSelected ? 'bg-sky-500/10 border border-sky-500/20' : 'hover:bg-white/[0.03] border border-transparent'
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isSelected ? '#3b9dff' : '#4a5580'} strokeWidth="1.5" style={{ transform: `rotate(${aircraft.heading}deg)` }}>
          <path d="M12 2L8 10H3L5 13H8L10 22H14L16 13H19L21 10H16L12 2Z"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white font-mono">{aircraft.flightNumber || aircraft.callsign || aircraft.icao24.toUpperCase()}</span>
          {aircraft.onGround && <span className="text-[9px] text-amber-400/60 bg-amber-400/10 px-1.5 py-0.5 rounded-full">GND</span>}
        </div>
        <div className="text-[11px] text-white/30 truncate">
          {aircraft.airline ? getAirlineName(aircraft.airline) : aircraft.aircraftType ? getAircraftTypeName(aircraft.aircraftType) : aircraft.originCountry}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-white/60 font-mono">{Math.round(aircraft.altitude).toLocaleString()}<span className="text-white/20">ft</span></div>
        <div className="text-[10px] text-white/30 font-mono">{Math.round(aircraft.velocity)}<span className="text-white/20">kts</span></div>
      </div>
    </button>
  );
}

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

export default function FlightList() {
  const { aircraft, selectedAircraft, selectAircraft, searchQuery, favorites } = useFlightStore();
  const [sortBy, setSortBy] = useState<SortKey>('callsign');
  const [displayCount, setDisplayCount] = useState(200);
  const scrollRef = useRef<HTMLDivElement>(null);

  let filtered = aircraft;
  if (searchQuery) {
    const queries = getSearchQueries(searchQuery);
    const matchQuery = (val: string | undefined | null) => {
      if (!val) return false;
      const lowerVal = val.toLowerCase();
      return queries.some(qry => lowerVal.includes(qry));
    };

    filtered = aircraft.filter(a =>
      matchQuery(a.callsign) ||
      matchQuery(a.icao24) ||
      matchQuery(a.registration) ||
      matchQuery(a.airline) ||
      matchQuery(a.originCountry) ||
      matchQuery(a.flightNumber)
    );
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'altitude': return b.altitude - a.altitude;
      case 'speed': return b.velocity - a.velocity;
      case 'country': return (a.originCountry || '').localeCompare(b.originCountry || '');
      case 'callsign':
      default: return (a.flightNumber || a.callsign || a.icao24).localeCompare(b.flightNumber || b.callsign || b.icao24);
    }
  });

  const favList = sorted.filter(a => favorites.includes(a.icao24));
  const rest = sorted.filter(a => !favorites.includes(a.icao24));
  const displayed = rest.slice(0, displayCount);
  const hasMore = rest.length > displayCount;

  // Load more on scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200 && hasMore) {
      setDisplayCount(prev => Math.min(prev + 100, rest.length));
    }
  }, [hasMore, rest.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Reset display count when filter changes
  useEffect(() => {
    setDisplayCount(200);
  }, [searchQuery]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/40">{filtered.length.toLocaleString()} flights</span>
          <span className="text-[10px] text-sky-400/40 font-mono">{favorites.length} ★</span>
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03]">
          {([
            { key: 'callsign' as SortKey, label: 'Name' },
            { key: 'altitude' as SortKey, label: 'Alt' },
            { key: 'speed' as SortKey, label: 'Spd' },
            { key: 'country' as SortKey, label: 'Country' },
          ]).map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={`flex-1 py-1 rounded-md text-[9px] font-medium uppercase tracking-wider transition-all ${
                sortBy === s.key ? 'bg-white/5 text-white/60' : 'text-white/25 hover:text-white/40'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {favList.length > 0 && (
          <div className="mb-3">
            <h4 className="text-[10px] uppercase tracking-widest text-amber-400/40 mb-1.5 px-2">Favorites</h4>
            {favList.map(a => (
              <FlightRow key={a.icao24} aircraft={a} isSelected={selectedAircraft?.icao24 === a.icao24} onClick={() => selectAircraft(a)} />
            ))}
          </div>
        )}
        <div>
          {displayed.map(a => (
            <FlightRow key={a.icao24} aircraft={a} isSelected={selectedAircraft?.icao24 === a.icao24} onClick={() => selectAircraft(a)} />
          ))}
        </div>
        {hasMore && (
          <div className="text-center py-3">
            <span className="text-[10px] text-white/20">
              Showing {displayCount} of {rest.length} · Scroll for more
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
