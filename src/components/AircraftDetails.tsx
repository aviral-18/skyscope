'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useFlightStore } from '@/store/flight-store';
import { formatAltitude, formatSpeed, formatHeading, formatVerticalRate, formatCoord, getAirlineName, getAircraftTypeName } from '@/lib/utils';
import { useState, useEffect } from 'react';

export default function AircraftDetails() {
  const { selectedAircraft, selectAircraft, favorites, toggleFavorite, selectedTrack } = useFlightStore();
  const [timeSinceUpdate, setTimeSinceUpdate] = useState('');

  // Update time since last update
  useEffect(() => {
    if (!selectedAircraft) return;
    const update = () => {
      const diff = Math.floor((Date.now() - selectedAircraft.lastUpdate) / 1000);
      if (diff < 60) setTimeSinceUpdate(`${diff}s ago`);
      else if (diff < 3600) setTimeSinceUpdate(`${Math.floor(diff / 60)}m ago`);
      else setTimeSinceUpdate(`${Math.floor(diff / 3600)}h ago`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [selectedAircraft]);

  if (!selectedAircraft) return null;
  const ac = selectedAircraft;
  const isFav = favorites.includes(ac.icao24);
  const hasTrack = (selectedTrack && selectedTrack.length > 1) || (ac.trail && ac.trail.length > 1);

  const rows = [
    ['Flight', ac.flightNumber || '—'],
    ['Callsign', ac.callsign || '—'],
    ['Airline', ac.airline ? getAirlineName(ac.airline) : '—'],
    ['Aircraft', ac.aircraftType ? getAircraftTypeName(ac.aircraftType) : '—'],
    ['Registration', ac.registration || '—'],
    ['Altitude', `${Math.round(ac.altitude).toLocaleString()} ft (${formatAltitude(ac.altitude)})`],
    ['Speed', formatSpeed(ac.velocity)],
    ['Heading', formatHeading(ac.heading)],
    ['Vertical Rate', formatVerticalRate(ac.verticalRate)],
    ['Squawk', ac.squawk || '—'],
    ['Origin', ac.origin || '—'],
    ['Destination', ac.destination || '—'],
    ['Latitude', formatCoord(ac.latitude, true)],
    ['Longitude', formatCoord(ac.longitude, false)],
    ['ICAO24', ac.icao24.toUpperCase()],
    ['Country', ac.originCountry || '—'],
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute top-4 right-4 w-[340px] z-[1000]"
      >
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide font-mono">{ac.flightNumber || ac.callsign || ac.icao24.toUpperCase()}</h3>
              <p className="text-xs text-sky-400/70 mt-0.5">{ac.airline ? getAirlineName(ac.airline) : ac.originCountry}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggleFavorite(ac.icao24)} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Favorite">
                <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? '#fbbf24' : 'none'} stroke={isFav ? '#fbbf24' : '#8899cc'} strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </button>
              <button onClick={() => selectAircraft(null)} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8899cc" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>

          {ac.origin && ac.destination && (
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="text-center">
                <div className="text-xl font-bold text-white font-mono">{ac.origin}</div>
                <div className="text-[10px] text-sky-400/50 mt-0.5">ORIGIN</div>
              </div>
              <div className="flex-1 flex items-center justify-center px-4">
                <div className="flex items-center gap-1 w-full">
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-sky-500/50 to-transparent" />
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b9dff" strokeWidth="1.5" style={{ transform: `rotate(${ac.heading}deg)` }}>
                    <path d="M12 2L8 10H3L5 13H8L10 22H14L16 13H19L21 10H16L12 2Z"/>
                  </svg>
                  <div className="h-[1px] flex-1 bg-gradient-to-l from-emerald-500/50 to-transparent" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white font-mono">{ac.destination}</div>
                <div className="text-[10px] text-emerald-400/50 mt-0.5">DEST</div>
              </div>
            </div>
          )}

          <div className="p-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                <span className="text-xs text-sky-300/50 uppercase tracking-wider">{label}</span>
                <span className="text-sm text-white/90 font-mono">{value}</span>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-white/5 space-y-2">
            <div className="flex gap-2">
              <div className={`flex-1 text-center py-1.5 rounded-lg text-xs font-medium ${ac.onGround ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {ac.onGround ? '● ON GROUND' : '● AIRBORNE'}
              </div>
              <div className={`flex-1 text-center py-1.5 rounded-lg text-xs font-medium ${ac.verticalRate > 1 ? 'bg-sky-500/20 text-sky-400' : ac.verticalRate < -1 ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-white/50'}`}>
                {ac.verticalRate > 1 ? '↑ CLIMBING' : ac.verticalRate < -1 ? '↓ DESCENDING' : '— LEVEL'}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-white/25">
              <span className="flex items-center gap-1">
                {hasTrack && (
                  <span className="text-emerald-400/60 flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>
                    Track visible
                  </span>
                )}
              </span>
              <span>Updated {timeSinceUpdate}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
