'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ScanItem {
  id: string;
  timestamp: string;
  student: {
    id: string;
    name: string;
    dni: string;
    grade: string;
    section: string;
  };
  status: string;
  isBurst: boolean;
  scannerId?: string;
  entranceId?: string;
  isOfflineSync: boolean;
}

export default function AdminScansPage() {
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchScans = async () => {
      try {
        const res = await fetch('/api/admin/scans?limit=100', { cache: 'no-store' });
        const json = await res.json();
        if (json.ok) setScans(json.scans);
      } finally {
        setLoading(false);
      }
    };
    fetchScans();
    const interval = setInterval(fetchScans, 15_000);
    return () => clearInterval(interval);
  }, []);

  const filtered = scans.filter(
    (s) =>
      !filter ||
      s.student.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.student.dni.includes(filter) ||
      s.student.grade.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-scale-in">
      {/* Header y Buscador */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-white tracking-tight">
              Bitácora de Marcaciones
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-bold border border-sky-500/30 tabular-nums">
              {scans.length} registros
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Registro cronológico detallado de ingresos por lector y puerta
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por alumno, DNI o grado..."
            className="glass-card rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 border border-white/10 focus:border-sky-400 focus:outline-none w-72 transition-colors"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabla con Estilo Glassmorphism */}
      <div className="glass-card rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <span className="w-3 h-3 rounded-full bg-sky-400 animate-ping inline-block mr-2" />
            Cargando marcaciones...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-slate-500 text-center text-xs">
            <p className="text-3xl mb-2">📋</p>
            <p>
              {scans.length === 0
                ? 'No hay marcaciones registradas todavía. Realiza un escaneo en la terminal de portería.'
                : 'No se encontraron marcaciones que coincidan con el filtro.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.02] border-b border-white/10 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="text-left px-5 py-3.5">Hora</th>
                  <th className="text-left px-5 py-3.5">Alumno</th>
                  <th className="text-left px-5 py-3.5">Grado / Sec</th>
                  <th className="text-left px-5 py-3.5">Estado</th>
                  <th className="text-left px-5 py-3.5">Lector / Puerta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((scan) => {
                  const time = new Date(scan.timestamp).toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  });

                  const statusMeta = {
                    ON_TIME: {
                      label: 'PUNTUAL',
                      style: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                    },
                    LATE: {
                      label: 'TARDE',
                      style: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                    },
                    EARLY_LEAVE: {
                      label: 'SALIDA TEMP.',
                      style: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                    },
                    EXIT: {
                      label: 'SALIDA',
                      style: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
                    },
                  }[scan.status] || {
                    label: scan.status,
                    style: 'bg-white/10 text-slate-300 border-white/10',
                  };

                  return (
                    <tr
                      key={scan.id}
                      className="hover:bg-white/[0.04] transition-colors"
                    >
                      <td className="px-5 py-3 font-mono text-slate-300 tabular-nums font-semibold">
                        {time}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-bold text-white text-sm">
                          {scan.student.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                          DNI {scan.student.dni}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-slate-300 font-medium">
                        {scan.student.grade} · &ldquo;{scan.student.section}&rdquo;
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border tracking-wider ${statusMeta.style}`}
                          >
                            {statusMeta.label}
                          </span>
                          {scan.isBurst && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              ⚠ Ráfaga
                            </span>
                          )}
                          {scan.isOfflineSync && (
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-300 border border-white/10"
                              title="Sincronizado desde cola offline"
                            >
                              📦 Offline
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                          {scan.scannerId || 'L1'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
