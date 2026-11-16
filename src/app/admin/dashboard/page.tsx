'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
  totalScansToday: number;
}

interface TopLate {
  studentId: string;
  studentName: string;
  grade: string;
  count: number;
}

interface ScanByHour {
  hour: string;
  count: number;
}

interface DashboardData {
  date: string;
  stats: Stats;
  scansByHour: ScanByHour[];
  topLate: TopLate[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/stats', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message || 'Error al cargar datos');
        return;
      }
      setData(json);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400 text-sm font-semibold">
          <span className="w-3 h-3 rounded-full bg-sky-400 animate-ping" />
          <span>Cargando estadísticas en tiempo real...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card bg-rose-950/40 border border-rose-500/40 text-rose-200 rounded-3xl p-6 text-center max-w-lg mx-auto">
        <p className="text-2xl mb-2">⚠️</p>
        <p className="font-bold">{error || 'Sin datos disponibles'}</p>
        <button
          onClick={fetchData}
          className="pressable mt-4 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold border border-rose-500/30"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const maxCount = Math.max(...data.scansByHour.map((h) => h.count), 1);

  return (
    <div className="space-y-6 animate-scale-in">
      {/* Header con Fecha y Botón PDF */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Dashboard de Asistencia
          </h1>
          <p className="text-slate-400 text-xs mt-1 capitalize">
            {new Date(data.date).toLocaleDateString('es-PE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/ingreso"
            className="pressable px-4 py-2 rounded-xl glass-card text-sky-300 hover:text-white border border-sky-500/30 text-xs font-bold flex items-center gap-2"
          >
            <span>📷</span>
            <span>Terminal Portería</span>
          </Link>

          <a
            href={`/api/reports/daily?date=${data.date}`}
            target="_blank"
            rel="noopener"
            className="pressable bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20 transition-all"
          >
            <span>📄</span>
            <span>Generar Reporte PDF</span>
          </a>
        </div>
      </div>

      {/* Stats Cards (4 columnas) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Alumnos"
          value={data.stats.totalStudents}
          color="sky"
          icon="👥"
        />
        <StatCard
          label="Presentes Hoy"
          value={data.stats.present}
          color="emerald"
          icon="✓"
        />
        <StatCard
          label="Tardanzas"
          value={data.stats.late}
          color="amber"
          icon="⏰"
        />
        <StatCard
          label="Ausentes"
          value={data.stats.absent}
          color="rose"
          icon="✕"
        />
      </div>

      {/* Tasa de Asistencia con Barra de Progreso */}
      <div className="glass-card rounded-3xl p-6 border border-white/10 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-extrabold text-base text-white">Tasa General de Asistencia</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Porcentaje de asistencia del alumnado registrado en el colegio hoy
            </p>
          </div>
          <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400 tabular-nums">
            {data.stats.attendanceRate}%
          </span>
        </div>

        <div className="h-3.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(56,189,248,0.4)]"
            style={{ width: `${Math.min(data.stats.attendanceRate, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-3 border-t border-white/5">
          <span>
            <strong className="text-white">{data.stats.present}</strong> de{' '}
            <strong className="text-white">{data.stats.totalStudents}</strong> alumnos en el plantel
          </span>
          <span className="font-mono text-sky-400 font-bold tabular-nums">
            {data.stats.totalScansToday} lecturas procesadas hoy
          </span>
        </div>
      </div>

      {/* Dos Columnas: Histograma de Horas y Top Tardanzas */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Marcaciones por Hora */}
        <div className="glass-card rounded-3xl p-6 border border-white/10 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-white text-base">Marcaciones por Hora</h2>
              <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full uppercase">
                Distribución
              </span>
            </div>

            <div className="flex items-end gap-1.5 h-44 pt-4 pb-2 border-b border-white/5">
              {data.scansByHour.map((h) => {
                const heightPct = Math.max((h.count / maxCount) * 100, 3);
                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="text-[10px] text-sky-300 font-mono tabular-nums opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                      {h.count > 0 ? h.count : ''}
                    </div>
                    <div
                      className="w-full bg-sky-500/70 hover:bg-sky-400 rounded-t-lg transition-all duration-200"
                      style={{
                        height: `${heightPct}%`,
                        opacity: h.count > 0 ? 1 : 0.2,
                      }}
                      title={`${h.hour}: ${h.count} marcaciones`}
                    />
                    <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-1">
                      {h.hour.split(':')[0]}h
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Picos de entrada registrados entre las 07:00 y las 08:00 AM
          </p>
        </div>

        {/* Top Tardanzas */}
        <div className="glass-card rounded-3xl p-6 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-extrabold text-white text-base">Alumnos con Tardanza Hoy</h2>
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase">
              {data.topLate.length} registrados
            </span>
          </div>

          {data.topLate.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <p className="text-2xl mb-1">🎉</p>
              <p>No hay tardanzas registradas en la jornada de hoy</p>
            </div>
          ) : (
            <ol className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {data.topLate.map((item, i) => (
                <li
                  key={item.studentId}
                  className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all"
                >
                  <span className="w-6 h-6 rounded-full bg-white/5 font-mono text-slate-400 text-xs font-bold flex items-center justify-center">
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white truncate">
                      {item.studentName}
                    </p>
                    <p className="text-xs text-slate-400">{item.grade}</p>
                  </div>
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black px-2.5 py-1 rounded-xl tabular-nums">
                    {item.count} {item.count === 1 ? 'tardanza' : 'tardanzas'}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-4 pt-3 border-t border-white/5 text-center">
            <Link
              href="/admin/scans"
              className="pressable text-sky-400 hover:text-sky-300 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <span>Ver bitácora completa de marcaciones</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: 'sky' | 'emerald' | 'amber' | 'rose';
  icon: string;
}) {
  const styles = {
    sky: {
      border: 'border-sky-500/30',
      text: 'text-sky-400',
      iconBg: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
      glow: 'shadow-[0_0_24px_rgba(56,189,248,0.12)]',
    },
    emerald: {
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      iconBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
      glow: 'shadow-[0_0_24px_rgba(16,185,129,0.12)]',
    },
    amber: {
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      iconBg: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
      glow: 'shadow-[0_0_24px_rgba(245,158,11,0.12)]',
    },
    rose: {
      border: 'border-rose-500/30',
      text: 'text-rose-400',
      iconBg: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
      glow: 'shadow-[0_0_24px_rgba(244,63,94,0.12)]',
    },
  };

  const st = styles[color];

  return (
    <div
      className={`glass-card rounded-3xl p-5 border transition-all duration-200 select-none ${st.border} ${st.glow}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-slate-400 uppercase tracking-widest font-black">
          {label}
        </p>
        <span
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm border ${st.iconBg}`}
        >
          {icon}
        </span>
      </div>
      <p className={`text-4xl font-black tabular-nums tracking-tight ${st.text}`}>
        {value}
      </p>
    </div>
  );
}
