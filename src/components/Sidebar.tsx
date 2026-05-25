'use client';
import { motion } from 'framer-motion';
import { useFlightStore } from '@/store/flight-store';
import SearchBar from './SearchBar';
import FlightList from './FlightList';
import ATCPanel from './ATCPanel';
import StatsPanel from './StatsPanel';
import CommsPanel from './CommsPanel';

const tabs = [
  { id: 'flights' as const, label: 'Flights', icon: '✈' },
  { id: 'atc' as const, label: 'ATC', icon: '📡' },
  { id: 'comms' as const, label: 'Comms', icon: '💬' },
  { id: 'stats' as const, label: 'Stats', icon: '📊' },
];

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, sidebarTab, setSidebarTab, aircraft, atcStreams, commsMessages, isPlaying } = useFlightStore();
  return (
    <>
      <button onClick={toggleSidebar} className="fixed top-4 left-4 z-[1100] glass-panel w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors md:hidden">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8899cc" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
      <motion.aside initial={false} animate={{ width: sidebarOpen ? (typeof window !== 'undefined' && window.innerWidth < 768 ? window.innerWidth : 380) : 0, opacity: sidebarOpen ? 1 : 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="h-full overflow-hidden flex-shrink-0 border-r border-white/5 bg-[#0a0a18]/95 backdrop-blur-xl flex flex-col z-[1050]">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2L8 10H3L5 13H8L10 22H14L16 13H19L21 10H16L12 2Z"/></svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">SkyScope</h1>
              <p className="text-[10px] text-sky-400/50 uppercase tracking-widest">Live Flight Radar</p>
            </div>
            <button onClick={toggleSidebar} className="ml-auto p-2 rounded-lg hover:bg-white/5 transition-colors flex" aria-label="Close Sidebar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7faa" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg></button>
          </div>
          <SearchBar />
          <div className="flex gap-0.5 mt-3 p-1 rounded-xl bg-white/[0.03]">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setSidebarTab(t.id)} className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-all duration-200 flex items-center justify-center gap-1 relative ${sidebarTab === t.id ? 'bg-sky-500/15 text-sky-400 shadow-sm' : 'text-white/40 hover:text-white/60'}`}>
                <span className="text-xs">{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
                {t.id === 'comms' && isPlaying && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {sidebarTab === 'flights' && <FlightList />}
          {sidebarTab === 'atc' && <ATCPanel />}
          {sidebarTab === 'comms' && <CommsPanel />}
          {sidebarTab === 'stats' && <StatsPanel />}
        </div>
        <div className="p-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/20">
          <span>{aircraft.length} tracked</span>
          <span>{commsMessages.length} msgs</span>
          <span>{atcStreams.length} streams</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Live</span>
        </div>
      </motion.aside>
      {!sidebarOpen && (
        <button onClick={toggleSidebar} className="fixed top-4 left-4 z-[1100] glass-panel w-10 h-10 rounded-xl items-center justify-center hover:bg-white/10 transition-colors hidden md:flex">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8899cc" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      )}
    </>
  );
}
