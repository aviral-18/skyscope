'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlightStore } from '@/store/flight-store';
import { SearchResult } from '@/types/aviation';
import { Aircraft } from '@/types/aviation';
import { debounce } from '@/lib/utils';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { selectAircraft, setSearchQuery, setFlyToTarget } = useFlightStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) { setResults([]); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(-1);
      } catch { setResults([]); }
      setLoading(false);
    }, 300),
    []
  );

  useEffect(() => {
    search(query);
    setSearchQuery(query);
  }, [query, search, setSearchQuery]);

  const handleSelect = useCallback((result: SearchResult) => {
    if (result.type === 'flight') {
      const ac = result.data as Aircraft;
      selectAircraft(ac);
      // Fly to the aircraft on the map
      setFlyToTarget({
        lat: ac.latitude,
        lng: ac.longitude,
        zoom: 10,
      });
    }
    setQuery('');
    setOpen(false);
  }, [selectAircraft, setFlyToTarget]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setOpen(false);
        setQuery('');
        setResults([]);
        inputRef.current?.blur();
        break;
    }
  }, [open, results, selectedIndex, handleSelect]);

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const items = resultsRef.current.querySelectorAll('button');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <div className="relative z-[1100]">
      <div className="glass-panel rounded-xl flex items-center gap-2 px-3 py-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7faa" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search flights, callsigns, ICAO..."
          className="bg-transparent text-sm text-white/90 placeholder:text-white/30 outline-none w-56 font-mono"
        />
        {loading && (
          <div className="w-4 h-4 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
        )}
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false); }} className="text-white/30 hover:text-white/60">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            ref={resultsRef}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-full mt-2 left-0 right-0 glass-panel rounded-xl overflow-hidden max-h-80 overflow-y-auto custom-scrollbar"
          >
            {results.map((r, index) => {
              const ac = r.data as Aircraft;
              return (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  className={`w-full px-4 py-3 flex items-center gap-3 transition-colors text-left border-b border-white/5 last:border-0 ${
                    index === selectedIndex ? 'bg-sky-500/15' : 'hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b9dff" strokeWidth="1.5" style={{ transform: `rotate(${ac.heading || 0}deg)` }}>
                      <path d="M12 2L8 10H3L5 13H8L10 22H14L16 13H19L21 10H16L12 2Z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-mono truncate font-medium">{r.label}</div>
                    <div className="text-xs text-white/40 truncate">{r.sublabel}</div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[10px] text-sky-400/50 uppercase tracking-wider bg-sky-400/5 px-2 py-0.5 rounded-full">{r.type}</span>
                    {!ac.onGround && (
                      <span className="text-[9px] text-white/25 font-mono">{ac.icao24?.toUpperCase()}</span>
                    )}
                  </div>
                </button>
              );
            })}
            <div className="px-4 py-2 text-[10px] text-white/20 border-t border-white/5">
              ↑↓ Navigate · Enter Select · Esc Close
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
