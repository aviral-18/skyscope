'use client';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import AircraftDetails from '@/components/AircraftDetails';
import MapControls from '@/components/MapControls';
import StatusBar from '@/components/StatusBar';
import { useFlightData } from '@/hooks/useFlightData';

const FlightMap = dynamic(() => import('@/components/FlightMap'), { ssr: false, loading: () => <div className="w-full h-full bg-[#0a0a1a] flex items-center justify-center"><div className="flex flex-col items-center gap-4"><div className="w-12 h-12 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" /><span className="text-sky-400/50 text-sm font-mono">Loading radar...</span></div></div> });

export default function AppShell() {
  useFlightData();
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050510]">
      <Sidebar />
      <main className="flex-1 relative overflow-hidden">
        <FlightMap />
        <AircraftDetails />
        <MapControls />
        <StatusBar />
      </main>
    </div>
  );
}
