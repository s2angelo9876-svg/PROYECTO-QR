'use client';

interface Props {
  isOnline: boolean;
  pendingCount: number;
}

export default function ConnectivityBadge({ isOnline, pendingCount }: Props) {
  return (
    <div className="flex items-center gap-2 select-none">
      {pendingCount > 0 && (
        <div
          title={`${pendingCount} marcaciones guardadas localmente esperando sincronización`}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 shadow-sm animate-pulse"
        >
          <span>📦</span>
          <span className="tabular-nums">
            {pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}
          </span>
        </div>
      )}

      <div
        data-testid="connectivity-badge"
        className={`flex items-center gap-2 text-xs font-bold px-3.5 py-1.5 rounded-full border glass-pill transition-colors duration-200 ${
          isOnline
            ? 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40'
            : 'border-rose-500/40 text-rose-300 bg-rose-950/40'
        }`}
      >
        <div className="relative flex items-center justify-center">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-emerald-400' : 'bg-rose-400'
            }`}
          />
          {isOnline && (
            <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-dot-ping" />
          )}
        </div>
        <span className="tracking-wide">
          {isOnline ? 'EN LÍNEA' : 'OFFLINE'}
        </span>
      </div>
    </div>
  );
}
