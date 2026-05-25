'use client';
import { motion } from 'framer-motion';
import { useFlightStore } from '@/store/flight-store';

export default function MapControls() {
  const { showWeather, toggleWeather, showHeatmap, toggleHeatmap, darkMode, toggleDarkMode } = useFlightStore();
  const controls = [
    { icon: '☁', label: 'Weather', active: showWeather, onClick: toggleWeather },
    { icon: '🔥', label: 'Heatmap', active: showHeatmap, onClick: toggleHeatmap },
    { icon: darkMode ? '🌙' : '☀', label: darkMode ? 'Night' : 'Day', active: darkMode, onClick: toggleDarkMode },
  ];
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="absolute top-4 right-4 md:top-auto md:bottom-24 md:right-3 z-[1000] flex flex-col gap-1.5">
      {controls.map(c => (
        <button key={c.label} onClick={c.onClick} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 text-sm ${c.active ? 'glass-panel border-sky-500/30 shadow-lg shadow-sky-500/10' : 'glass-panel opacity-70 hover:opacity-100'}`} title={c.label}>{c.icon}</button>
      ))}
    </motion.div>
  );
}
