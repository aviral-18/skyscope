'use client';

import { motion } from 'framer-motion';
import { useFlightStore } from '@/store/flight-store';
import { getAirlineName, getAircraftTypeName } from '@/lib/utils';

export default function StatsPanel() {
  const { stats, aircraft } = useFlightStore();

  const statCards = [
    { label: 'Total Flights', value: stats.totalFlights.toLocaleString(), icon: '✈', color: 'sky' },
    { label: 'Airborne', value: stats.airborne.toLocaleString(), icon: '↑', color: 'emerald' },
    { label: 'On Ground', value: stats.onGround.toLocaleString(), icon: '●', color: 'amber' },
    { label: 'Avg Altitude', value: `${Math.round(stats.avgAltitude).toLocaleString()} ft`, icon: '⬆', color: 'violet' },
    { label: 'Avg Speed', value: `${Math.round(stats.avgSpeed)} kts`, icon: '→', color: 'rose' },
  ];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-3 rounded-xl bg-${s.color}-500/5 border border-${s.color}-500/10`}
          >
            <div className="text-lg font-bold text-white font-mono">{s.value}</div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div>
        <h4 className="text-[10px] uppercase tracking-widest text-sky-400/40 mb-2">Top Airlines</h4>
        <div className="space-y-1.5">
          {stats.topAirlines.map((a, i) => (
            <div key={a.name} className="flex items-center gap-3">
              <span className="text-xs text-white/30 w-4 text-right font-mono">{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/70">{getAirlineName(a.name)}</span>
                  <span className="text-xs text-white/40 font-mono">{a.count}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(a.count / (stats.topAirlines[0]?.count || 1)) * 100}%` }}
                    className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-[10px] uppercase tracking-widest text-sky-400/40 mb-2">Top Aircraft Types</h4>
        <div className="space-y-1.5">
          {stats.topAircraft.map((a, i) => (
            <div key={a.type} className="flex items-center gap-3">
              <span className="text-xs text-white/30 w-4 text-right font-mono">{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/70">{getAircraftTypeName(a.type)}</span>
                  <span className="text-xs text-white/40 font-mono">{a.count}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(a.count / (stats.topAircraft[0]?.count || 1)) * 100}%` }}
                    className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
        <h4 className="text-[10px] uppercase tracking-widest text-sky-400/40 mb-2">Altitude Distribution</h4>
        <div className="flex items-end gap-0.5 h-16">
          {(() => {
            const buckets = Array(10).fill(0);
            aircraft.filter(a => !a.onGround).forEach(a => {
              const idx = Math.min(9, Math.floor(a.altitude / 5000));
              buckets[idx]++;
            });
            const max = Math.max(...buckets, 1);
            return buckets.map((count, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${(count / max) * 100}%` }}
                className="flex-1 bg-gradient-to-t from-sky-500/40 to-sky-400/20 rounded-t"
                title={`${i * 5000}-${(i + 1) * 5000}ft: ${count} flights`}
              />
            ));
          })()}
        </div>
        <div className="flex justify-between mt-1 text-[8px] text-white/20 font-mono">
          <span>0</span><span>25K</span><span>50K ft</span>
        </div>
      </div>
    </div>
  );
}
