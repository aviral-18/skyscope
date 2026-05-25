'use client';
import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlightStore } from '@/store/flight-store';
import { ATCStream } from '@/types/aviation';
import { ATCAudioEngine } from '@/lib/atc-audio';

function StreamCard({ stream, isActive, onClick }: { stream: ATCStream; isActive: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left p-3 rounded-xl transition-all duration-200 border ${isActive ? 'bg-sky-500/10 border-sky-500/30 shadow-lg shadow-sky-500/5' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold text-white font-mono">{stream.iata}</span>
        <span className="text-[10px] text-sky-400/60 font-mono">{stream.frequency} MHz</span>
      </div>
      <p className="text-xs text-white/50 truncate">{stream.name}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-white/30">{stream.country}</span>
        <div className="flex items-center gap-1.5">
          {stream.isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          <span className="text-[10px] text-white/40">{stream.listeners}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        </div>
      </div>
    </button>
  );
}

export default function ATCPanel() {
  const { atcStreams, activeStream, setActiveStream, isPlaying, setIsPlaying, volume, setVolume } = useFlightStore();
  const audioEngineRef = useRef<ATCAudioEngine | null>(null);
  const regions = [...new Set(atcStreams.map(s => s.region))];

  useEffect(() => {
    return () => {
      if (audioEngineRef.current) { audioEngineRef.current.destroy(); audioEngineRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (activeStream && isPlaying) {
      if (!audioEngineRef.current) audioEngineRef.current = new ATCAudioEngine();
      audioEngineRef.current.start(volume);
    } else {
      if (audioEngineRef.current) audioEngineRef.current.stop();
    }
  }, [activeStream, isPlaying, volume]);

  useEffect(() => {
    if (audioEngineRef.current) audioEngineRef.current.setVolume(volume);
  }, [volume]);

  const handleStreamClick = (stream: ATCStream) => {
    if (activeStream?.id === stream.id) {
      setIsPlaying(!isPlaying);
    } else {
      if (audioEngineRef.current) audioEngineRef.current.stop();
      setActiveStream(stream);
      setIsPlaying(true);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <AnimatePresence>
        {activeStream && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <div className="glass-panel rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b9dff" strokeWidth="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{activeStream.name}</div>
                    <div className="text-xs text-sky-400/60 font-mono">{activeStream.frequency} MHz</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-red-400 font-medium uppercase tracking-wider">Live</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 flex items-center justify-center transition-colors">
                    {isPlaying ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b9dff"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b9dff"><path d="M5 3l14 9-14 9V3z"/></svg>
                    )}
                  </button>
                  <div className="flex-1 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7faa" strokeWidth="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} className="flex-1 h-1 appearance-none bg-white/10 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-400 [&::-webkit-slider-thumb]:cursor-pointer" />
                  </div>
                  <button onClick={() => { setActiveStream(null); setIsPlaying(false); if (audioEngineRef.current) audioEngineRef.current.stop(); }} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7faa" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>

                {isPlaying && (
                  <div className="mt-3 flex items-center gap-0.5 h-6">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <motion.div key={i} className="flex-1 bg-gradient-to-t from-sky-500/60 to-emerald-400/40 rounded-full" animate={{ height: [3, Math.random() * 22 + 3, 3] }} transition={{ duration: 0.3 + Math.random() * 0.4, repeat: Infinity, repeatType: 'reverse', delay: i * 0.03 }} />
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-4 text-[10px] text-white/30">
                  <span className="flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    {activeStream.listeners} listening
                  </span>
                  <span>{activeStream.airport}</span>
                  {isPlaying && <span className="text-emerald-400/50">● Audio active</span>}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
        {regions.map(region => (
          <div key={region}>
            <h4 className="text-[10px] uppercase tracking-widest text-sky-400/40 mb-2 px-1">{region}</h4>
            <div className="space-y-1.5 mb-4">
              {atcStreams.filter(s => s.region === region).map(stream => (
                <StreamCard key={stream.id} stream={stream} isActive={activeStream?.id === stream.id} onClick={() => handleStreamClick(stream)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
