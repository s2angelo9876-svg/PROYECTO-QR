'use client';

import { useEffect, useState } from 'react';
import { getRecentScans } from '@/lib/offlineQueue';
import type { RecentScan } from '@/types/attendance';

const STATUS_CHIPS = {
  SUCCESS: { label: 'OK', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  WARNING: { label: 'ALERTA', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  ERROR: { label: 'ERROR', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
} as const;

export default function RecentScans() {
  const [scans, setScans] = useState<RecentScan[]>([]);

  useEffect(() => {
    const load = () => {
      getRecentScans().then(setScans);
    };
    load();
    const interval = setInterval(load, 2500);
    return () => clearInterval(interval);
  }, []);

  if (scans.length === 0) return null;

  return (
    <div className="w-full max-w-xl mx-auto glass-card rounded-2xl p-3 border border-white/10 shadow-xl select-none animate-slide-down">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs">📋</span>
          <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-widest">
            Últimas Marcaciones
          </h3>
        </div>
        <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 tabular-nums">
          {scans.length} registradas
        </span>
      </div>

      <ul className="space-y-1 max-h-32 overflow-y-auto pr-1">
        {scans.slice(0, 5).map((scan, i) => {
          const chip = STATUS_CHIPS[scan.status];
          return (
            <li
              key={scan.scanId}
              className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all duration-150"
              style={{
                animationDelay: `${i * 30}ms`,
              }}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded border tracking-wider ${chip.bg}`}
                >
                  {chip.label}
                </span>
                <span className="text-slate-200 font-semibold truncate text-xs">
                  {scan.studentName || 'Lectura registrada'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-slate-400 shrink-0">
                {scan.isOffline && (
                  <span
                    title="Guardado offline (esperando sync)"
                    className="text-[11px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold"
                  >
                    LOCAL
                  </span>
                )}
                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                  {new Date(scan.timestamp).toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
