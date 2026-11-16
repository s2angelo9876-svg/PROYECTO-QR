'use client';

import Image from 'next/image';

import { useMemo } from 'react';
import type { ScanResult as ScanResultType, AttendanceStatus } from '@/types/attendance';

interface Props {
  result: ScanResultType;
}

const STATUS_THEMES = {
  SUCCESS: {
    badgeBg: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
    cardBorder: 'border-emerald-500/40 shadow-[0_0_50px_rgba(16,185,129,0.18)]',
    photoRing: 'ring-4 ring-emerald-400/80 shadow-lg shadow-emerald-500/25',
    titleColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: '✓',
  },
  WARNING: {
    badgeBg: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
    cardBorder: 'border-amber-500/40 shadow-[0_0_50px_rgba(245,158,11,0.18)]',
    photoRing: 'ring-4 ring-amber-400/80 shadow-lg shadow-amber-500/25',
    titleColor: 'text-amber-400',
    iconBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: '⚠',
  },
  ERROR: {
    badgeBg: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
    cardBorder: 'border-rose-500/40 shadow-[0_0_50px_rgba(244,63,94,0.18)]',
    photoRing: 'ring-4 ring-rose-400/80 shadow-lg shadow-rose-500/25',
    titleColor: 'text-rose-400',
    iconBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: '✕',
  },
} as const;

const ATTENDANCE_BADGES: Record<AttendanceStatus, { label: string; style: string }> = {
  ON_TIME: {
    label: 'PUNTUAL',
    style: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  },
  LATE: {
    label: 'TARDANZA',
    style: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  },
  EARLY_LEAVE: {
    label: 'SALIDA TEMPRANO',
    style: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
  },
  EXIT: {
    label: 'SALIDA',
    style: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
  },
};

export default function StudentDisplay({ result }: Props) {
  const theme = STATUS_THEMES[result.status];

  const attendanceInfo = useMemo(() => {
    if (!result.attendanceStatus) return null;
    return ATTENDANCE_BADGES[result.attendanceStatus] ?? null;
  }, [result.attendanceStatus]);

  return (
    <div
      data-testid={`status-${result.status.toLowerCase()}`}
      className={`w-full max-w-2xl rounded-3xl p-6 md:p-8 text-center backdrop-blur-2xl bg-slate-900/90 border transition-all duration-300 animate-scale-in select-none ${theme.cardBorder}`}
      style={{
        boxShadow:
          'inset 0 1px 0 0 rgba(255, 255, 255, 0.1), 0 20px 50px -10px rgba(0, 0, 0, 0.7)',
      }}
    >
      {/* Offline sync indicator if applicable */}
      {result.isOffline && (
        <div className="inline-flex items-center gap-2 bg-amber-950/80 text-amber-300 text-xs font-bold px-3.5 py-1.5 rounded-full mb-4 border border-amber-600/40 shadow-sm animate-pulse">
          <span className="w-2 h-2 bg-amber-400 rounded-full" />
          <span>MODO LOCAL · Se sincronizará automáticamente al reconectar</span>
        </div>
      )}

      {/* Status banner with icon */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <span
          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl font-black border ${theme.iconBg}`}
        >
          {theme.icon}
        </span>
        <h2
          className={`text-2xl md:text-3xl font-black uppercase tracking-tight ${theme.titleColor}`}
        >
          {result.message}
        </h2>
      </div>

      {result.student ? (
        <div className="flex flex-col items-center gap-5 mt-2">
          {/* Student photo with glowing ring */}
          <div className="relative">
            <Image
                    width={208} height={208} unoptimized
              src={result.student.photoUrl}
              alt={`Foto de ${result.student.fullName}`}
              className={`w-40 h-40 md:w-52 md:h-52 rounded-full object-cover bg-slate-800 ${theme.photoRing}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231e293b" width="100" height="100"/><text x="50" y="58" text-anchor="middle" fill="%2394a3b8" font-size="44" font-weight="bold">👤</text></svg>';
              }}
            />
            {result.student.status !== 'ACTIVE' && (
              <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-lg border border-white/20">
                {result.student.status}
              </span>
            )}
          </div>

          {/* Student Full Name */}
          <div className="space-y-1">
            <h1
              data-testid="student-name"
              className="text-3xl md:text-4xl font-black tracking-tight text-white"
            >
              {result.student.firstName} {result.student.lastName}
            </h1>
            <p className="text-lg md:text-xl font-medium text-slate-300">
              {result.student.grade} · Sección &ldquo;{result.student.section}&rdquo;
            </p>
          </div>

          {/* Badges row: Shift, Time, Attendance */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
            <span className="px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-slate-300">
              Turno:{' '}
              {result.student.shift === 'MORNING'
                ? 'Mañana'
                : result.student.shift === 'AFTERNOON'
                ? 'Tarde'
                : 'Noche'}
            </span>

            <span className="px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono tabular-nums text-slate-200">
              🕐 {result.timestamp}
            </span>

            {attendanceInfo && (
              <span
                className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${attendanceInfo.style}`}
              >
                {attendanceInfo.label}
              </span>
            )}
          </div>

          {/* Guardian details if available */}
          {result.student.guardianName && (
            <div className="mt-2 pt-4 border-t border-white/10 w-full max-w-md text-left flex items-center justify-between text-xs bg-white/[0.02] p-3 rounded-2xl">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  Apoderado
                </p>
                <p className="font-semibold text-slate-200 text-sm">
                  {result.student.guardianName}
                </p>
              </div>

              {result.student.guardianPhone && (
                <a
                  href={`tel:${result.student.guardianPhone}`}
                  className="pressable px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5 text-xs font-semibold"
                >
                  <span>📞</span>
                  <span>{result.student.guardianPhone}</span>
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="py-6 text-slate-400 text-sm max-w-sm mx-auto">
          <p>Verifique que el código QR esté bien orientado hacia el lector óptico.</p>
        </div>
      )}
    </div>
  );
}
