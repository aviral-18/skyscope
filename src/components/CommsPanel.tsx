'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlightStore } from '@/store/flight-store';
import { CommMessage } from '@/lib/pilot-messages';

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Variable-speed typewriter: shorter words faster, numbers/callsigns slower
function getWordDelay(word: string): number {
  if (!word) return 100;
  // Numbers, callsigns, flight levels — controller slows down for these
  if (/\d/.test(word) || /^(FL|ILS|RNAV|VOR)/.test(word)) return 200;
  // Short filler words
  if (word.length <= 3) return 100;
  // Normal words
  return 150;
}

function TypewriterText({ text, isNew }: { text: string; isNew: boolean }) {
  const [displayed, setDisplayed] = useState(isNew ? '' : text);
  useEffect(() => {
    if (!isNew) {
      setDisplayed(text);
      return;
    }
    const words = text.split(' ');
    let i = 0;
    setDisplayed('');
    let timeout: ReturnType<typeof setTimeout>;
    const step = () => {
      setDisplayed(words.slice(0, i).join(' ') + (i <= words.length ? ' ▌' : ''));
      i++;
      if (i > words.length + 1) return;
      timeout = setTimeout(step, getWordDelay(words[i - 1]));
    };
    timeout = setTimeout(step, getWordDelay(words[0]));
    return () => clearTimeout(timeout);
  }, [text, isNew]);
  return <span>{displayed}</span>;
}

function MessageBubble({ msg, isNew }: { msg: CommMessage; isNew: boolean }) {
  const isAtc = msg.type === 'atc';
  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 12, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className={`flex gap-2 ${isAtc ? '' : 'flex-row-reverse'}`}
    >
      <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
        isAtc ? 'bg-amber-500/15 text-amber-400' : 'bg-sky-500/15 text-sky-400'
      }`}>
        {isAtc ? 'ATC' : '✈'}
      </div>
      <div className={`flex-1 min-w-0 ${isAtc ? '' : 'text-right'}`}>
        <div className="flex items-center gap-2 mb-0.5 flex-wrap" style={{ justifyContent: isAtc ? 'flex-start' : 'flex-end' }}>
          <span className={`text-[10px] font-bold tracking-wide ${isAtc ? 'text-amber-400/80' : 'text-sky-400/80'}`}>
            {isAtc ? 'TOWER' : msg.callsign}
          </span>
          <span className="text-[9px] text-white/20 font-mono">{formatTime(msg.timestamp)}</span>
          {msg.urgency === 'emergency' && (
            <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold animate-pulse">EMERGENCY</span>
          )}
          {msg.urgency === 'priority' && (
            <span className="text-[8px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-bold">PRIORITY</span>
          )}
        </div>
        <div className={`text-xs leading-relaxed rounded-xl px-3 py-2 inline-block max-w-full ${
          isAtc
            ? 'bg-amber-500/[0.06] border border-amber-500/10 text-white/80 text-left'
            : 'bg-sky-500/[0.06] border border-sky-500/10 text-white/80 text-left'
        }`}>
          <span className="font-mono text-[11px]"><TypewriterText text={msg.message} isNew={isNew} /></span>
        </div>
        <div className="mt-0.5">
          <span className="text-[9px] text-white/15 font-mono">{msg.frequency} MHz</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function CommsPanel() {
  const { commsMessages, setCommsMessages, addCommsMessage, activeStream, isPlaying, commsAutoScroll, toggleCommsAutoScroll, selectedAircraft } = useFlightStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'all' | 'atc' | 'pilot'>('all');
  const prevCountRef = useRef(0);
  const msgIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const prevFlightRef = useRef<string | null>(null);

  // Get callsign for flight-specific comms
  const flightCallsign = selectedAircraft?.callsign || null;
  const flightIcao = selectedAircraft?.icao24 || null;

  // Build comms API URL with callsign if a flight is selected
  const buildCommsUrl = useCallback((single: boolean) => {
    const airport = activeStream?.icao || 'KJFK';
    const freq = activeStream?.frequency || '119.100';
    let url = `/api/comms?airport=${airport}&frequency=${freq}`;
    if (single) url += '&single=true';
    if (flightCallsign) {
      url += `&callsign=${encodeURIComponent(flightCallsign)}`;
      if (selectedAircraft) {
        url += `&alt=${Math.round(selectedAircraft.altitude)}&spd=${Math.round(selectedAircraft.velocity)}&hdg=${Math.round(selectedAircraft.heading)}&onGround=${selectedAircraft.onGround}&vRate=${selectedAircraft.verticalRate || 0}`;
      }
    }
    return url;
  }, [activeStream, flightCallsign, selectedAircraft]);

  // Load initial messages — reload when selected flight changes
  useEffect(() => {
    const currentFlight = flightIcao || 'none';
    if (prevFlightRef.current === currentFlight) return;
    prevFlightRef.current = currentFlight;

    const sepId = flightCallsign ? `sep-${Date.now()}` : '';

    fetch(buildCommsUrl(false))
      .then(r => r.json())
      .then(d => {
        if (d.messages) {
          if (flightCallsign && sepId) {
            // Prepend separator before flight history
            const separator: CommMessage = {
              id: sepId,
              timestamp: d.messages.length > 0 ? d.messages[0].timestamp - 1000 : Date.now(),
              type: 'atc',
              callsign: 'SYSTEM',
              frequency: '',
              message: `— Tuned to ${flightCallsign} —`,
              airport: '',
              urgency: 'normal',
            };
            setCommsMessages([separator, ...d.messages]);
          } else {
            setCommsMessages(d.messages);
          }
        }
      })
      .catch(() => {});
  }, [flightIcao, flightCallsign, buildCommsUrl, setCommsMessages]);

  // Stream new messages periodically
  useEffect(() => {
    // Generate messages regardless of ATC stream playing state when a flight is selected
    const shouldGenerate = flightCallsign || (isPlaying && activeStream);
    if (!shouldGenerate) return;

    const interval = flightCallsign ? 5000 + Math.random() * 3000 : 3000 + Math.random() * 5000;

    msgIntervalRef.current = setInterval(() => {
      fetch(buildCommsUrl(true))
        .then(r => r.json())
        .then(d => { if (d.message) addCommsMessage(d.message); })
        .catch(() => {});
    }, interval);

    return () => { if (msgIntervalRef.current) clearInterval(msgIntervalRef.current); };
  }, [isPlaying, activeStream, flightCallsign, addCommsMessage, buildCommsUrl]);

  // Auto-scroll
  useEffect(() => {
    if (commsAutoScroll && scrollRef.current && commsMessages.length > prevCountRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = commsMessages.length;
  }, [commsMessages, commsAutoScroll]);

  const filtered = filter === 'all' ? commsMessages : commsMessages.filter(m => m.type === filter);
  const isFlightMode = !!flightCallsign;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isFlightMode ? 'bg-sky-500/10' : 'bg-emerald-500/10'}`}>
              {isFlightMode ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b9dff" strokeWidth="2"><path d="M12 2L8 10H3L5 13H8L10 22H14L16 13H19L21 10H16L12 2Z"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00ff88" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              )}
            </div>
            <div>
              <span className="text-xs font-bold text-white/70">
                {isFlightMode ? 'Flight Comms' : 'Live Communications'}
              </span>
              {isFlightMode && (
                <div className="text-[10px] text-sky-400/60 font-mono">{flightCallsign}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isFlightMode && (
              <span className="text-[9px] bg-sky-500/15 text-sky-400 px-2 py-0.5 rounded-full font-medium">FLIGHT</span>
            )}
            {(isPlaying || isFlightMode) && (
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] text-red-400 uppercase tracking-wider font-medium">Live</span>
              </div>
            )}
          </div>
        </div>

        {/* Flight context banner */}
        {isFlightMode && (
          <div className="glass-panel rounded-lg px-3 py-2 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b9dff" strokeWidth="1.5" style={{ transform: `rotate(${selectedAircraft?.heading || 0}deg)` }}>
                <path d="M12 2L8 10H3L5 13H8L10 22H14L16 13H19L21 10H16L12 2Z"/>
              </svg>
              <span className="text-xs font-bold text-white font-mono">{flightCallsign}</span>
              <span className="text-[10px] text-white/30">{selectedAircraft?.originCountry}</span>
            </div>
            <span className="text-[10px] text-white/25 font-mono">{selectedAircraft?.icao24.toUpperCase()}</span>
          </div>
        )}

        {/* ATC stream info (when no flight selected) */}
        {!isFlightMode && activeStream && (
          <div className="glass-panel rounded-lg px-3 py-2 mb-2 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white font-mono">{activeStream.iata}</span>
              <span className="text-[10px] text-white/30 ml-2">{activeStream.name}</span>
            </div>
            <span className="text-[10px] text-sky-400/50 font-mono">{activeStream.frequency} MHz</span>
          </div>
        )}

        <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.03]">
          {(['all', 'atc', 'pilot'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-wider transition-all ${
                filter === f
                  ? f === 'atc' ? 'bg-amber-500/15 text-amber-400' : f === 'pilot' ? 'bg-sky-500/15 text-sky-400' : 'bg-white/5 text-white/60'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {f === 'all' ? 'All' : f === 'atc' ? '🗼 ATC' : '✈ Pilot'}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <div className="text-center">
              <p className="text-xs">
                {isFlightMode ? 'Listening for flight comms...' : 'No communications yet'}
              </p>
              <p className="text-[10px] text-white/10 mt-1">
                {isFlightMode ? `Monitoring ${flightCallsign}` : 'Select a flight or ATC frequency'}
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((msg, i) => (
              <MessageBubble key={msg.id} msg={msg} isNew={i >= filtered.length - 3} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-white/5 flex items-center justify-between">
        <button
          onClick={toggleCommsAutoScroll}
          className={`text-[10px] px-2 py-1 rounded-md transition-colors ${commsAutoScroll ? 'bg-emerald-500/10 text-emerald-400' : 'text-white/30 hover:text-white/50'}`}
        >
          {commsAutoScroll ? '⇩ Auto-scroll ON' : '⇩ Auto-scroll OFF'}
        </button>
        <span className="text-[10px] text-white/20 font-mono">{commsMessages.length} messages</span>
      </div>
    </div>
  );
}
