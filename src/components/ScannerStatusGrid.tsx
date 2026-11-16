'use client';

import { useEffect, useState } from 'react';
import type { ScannerConfig, ScannerStatus } from '@/types/attendance';

interface Props {
  scanners: ScannerConfig[];
  entranceLabel: string;
  getStatus: (scannerId: string) => ScannerStatus | undefined;
  onTestScanner?: (scannerId: string) => void;
}

const POSITION_ICONS: Record<ScannerConfig['position'], string> = {
  left: '◀',
  center: '●',
  right: '▶',
  special: '♿',
};

const POSITION_LABELS: Record<ScannerConfig['position'], string> = {
  left: 'Izquierda',
  center: 'Centro',
  right: 'Derecha',
  special: 'Especial',
};

export default function ScannerStatusGrid({
  scanners,
  entranceLabel,
  getStatus,
  onTestScanner,
}: Props) {
  const [, setTick] = useState(0);

  // Re-render cada segundo para mantener el tiempo relativo
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-widest">
            Disposición de Puertas · {entranceLabel}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="tabular-nums font-bold text-sky-400">{scanners.length}</span>
          <span>escáneres en línea</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {scanners.map((scanner) => {
          const status = getStatus(scanner.id);
          const isRecent =
            Boolean(status?.lastScanAt) &&
            Date.now() - (status?.lastScanAt || 0) < 3000;

          const isSuccess = status?.lastStatus === 'SUCCESS';
          const isWarning = status?.lastStatus === 'WARNING';
          const isError = status?.lastStatus === 'ERROR';

          // Micro-estilos de Emil Kowalski: transición de transform y opacidad controlada
          let borderBg = 'border-white/[0.08] bg-slate-900/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';
          if (isRecent) {
            if (isSuccess) {
              borderBg = 'border-emerald-500/80 bg-emerald-950/50 shadow-[0_0_24px_rgba(16,185,129,0.25)]';
            } else if (isWarning) {
              borderBg = 'border-amber-500/80 bg-amber-950/50 shadow-[0_0_24px_rgba(245,158,11,0.25)]';
            } else if (isError) {
              borderBg = 'border-rose-500/80 bg-rose-950/50 shadow-[0_0_24px_rgba(244,63,94,0.25)]';
            }
          }

          return (
            <div
              key={scanner.id}
              data-testid={`scanner-${scanner.id}`}
              className={`relative border rounded-2xl p-4 backdrop-blur-md transition-all duration-200 select-none ${borderBg} ${
                isRecent ? 'scale-[1.02]' : 'hover:border-white/20'
              }`}
            >
              {/* Header de la tarjeta */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sky-400 font-bold text-sm">
                    {POSITION_ICONS[scanner.position]}
                  </span>
                  <div>
                    <p className="font-black text-sm text-white tracking-tight flex items-center gap-1.5">
                      <span>{scanner.id}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({scanner.prefix})
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      {POSITION_LABELS[scanner.position]}
                    </p>
                  </div>
                </div>

                {/* LED de actividad */}
                <div className="flex items-center gap-1">
                  <div
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      isRecent
                        ? isSuccess
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : isWarning
                          ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                          : 'bg-rose-400 shadow-[0_0_8px_#f87171]'
                        : 'bg-emerald-500/60'
                    }`}
                  />
                </div>
              </div>

              {/* Nombre descriptivo del lector */}
              <p className="text-xs text-slate-300 font-semibold truncate mb-2">
                {scanner.label}
              </p>

              {/* Detalle y última lectura */}
              <div className="text-[11px] space-y-1 pt-2 border-t border-white/5">
                {status?.lastStudentName ? (
                  <>
                    <p className="text-slate-300 truncate">
                      Último:{' '}
                      <span className="font-bold text-white">
                        {status.lastStudentName.split(' ')[0]}
                      </span>
                    </p>
                    <p className="text-slate-400 tabular-nums text-[10px] flex items-center justify-between">
                      <span>Hora:</span>
                      <span>
                        {status.lastScanAt
                          ? new Date(status.lastScanAt).toLocaleTimeString('es-PE', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false,
                            })
                          : '--:--:--'}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500 italic text-[11px] py-0.5">
                    Esperando lectura...
                  </p>
                )}

                <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Total hoy:</span>
                  <span className="font-extrabold text-sky-400 tabular-nums">
                    {status?.totalScans ?? 0}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
