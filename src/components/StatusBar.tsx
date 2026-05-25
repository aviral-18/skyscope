'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlightStore } from '@/store/flight-store';

export default function StatusBar() {
  const { aircraft, isPlaying, activeStream, stats, dataFreshness, apiStatus } = useFlightStore();
  const [freshLabel, setFreshLabel] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - dataFreshness) / 1000);
      if (diff < 5) setFreshLabel('Just now');
      else if (diff < 60) setFreshLabel(`${diff}s ago`);
      else setFreshLabel(`${Math.floor(diff / 60)}m ago`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [dataFreshness]);

  const statusColor = apiStatus === 'live' ? 'bg-emerald-400' : apiStatus === 'cached' ? 'bg-amber-400' : 'bg-red-400';
  const statusLabel = apiStatus === 'live' ? 'LIVE' : apiStatus === 'cached' ? 'CACHED' : 'OFFLINE';

  return (
    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
      <div className="glass-panel rounded-2xl px-5 py-2.5 flex items-center gap-5 text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor} ${apiStatus === 'live' ? 'animate-pulse' : ''}`} />
          <span className="text-white/60 font-mono">{aircraft.length.toLocaleString()}</span>
          <span className="text-white/30">flights</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-white/30">↑</span>
          <span className="text-white/60 font-mono">{stats.airborne.toLocaleString()}</span>
          <span className="text-white/30">airborne</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold tracking-wider ${
            apiStatus === 'live' ? 'text-emerald-400/80' : apiStatus === 'cached' ? 'text-amber-400/80' : 'text-red-400/80'
          }`}>
            {statusLabel}
          </span>
          <span className="text-white/25 text-[10px] font-mono">· {freshLabel}</span>
        </div>
        <AnimatePresence>
          {isPlaying && activeStream && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="flex items-center gap-2 overflow-hidden">
              <div className="w-px h-4 bg-white/10" />
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white/60 font-mono whitespace-nowrap">{activeStream.iata} ATC</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
