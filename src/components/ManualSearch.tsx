'use client';

import Image from 'next/image';

import { useState, useMemo } from 'react';
import type { Student } from '@/types/attendance';
import { generateDemoQR } from '@/lib/qrValidator';

interface Props {
  students: Student[];
  onSelect: (qrCode: string) => void;
  onCancel?: () => void;
}

export default function ManualSearch({ students, onSelect, onCancel }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 10);
    return students
      .filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.dni.includes(q) ||
          s.grade.toLowerCase().includes(q) ||
          s.section.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [query, students]);

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 animate-scale-in">
      {/* Caja de Búsqueda */}
      <div className="glass-card rounded-3xl p-5 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⌨️</span>
            <label className="text-xs text-sky-400 uppercase tracking-widest font-black">
              Búsqueda Manual de Alumno
            </label>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="pressable text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-white/5"
            >
              Cerrar (Esc)
            </button>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, apellido, DNI o grado..."
            className="w-full bg-slate-950/80 border border-white/15 focus:border-sky-400 rounded-2xl px-4 py-3.5 text-white text-base placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 text-slate-300 hover:text-white flex items-center justify-center text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1.5">
          <span>💡</span>
          <span>
            Use este modo cuando el alumno no porte su carnet físico o el lector USB presente fallas.
          </span>
        </p>
      </div>

      {/* Lista de Alumnos */}
      <div className="glass-card rounded-3xl p-3 border border-white/10 max-h-96 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 mb-1 flex items-center justify-between">
          <span>Resultados ({filtered.length})</span>
          <span className="text-[10px] text-slate-500 font-normal">Haga clic para registrar entrada</span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            <p className="text-2xl mb-2">🔍</p>
            <p>No se encontraron alumnos con &quot;{query}&quot;</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => onSelect(generateDemoQR(s.dni))}
                  className="pressable w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-white/[0.06] border border-transparent hover:border-white/10 text-left transition-all group cursor-pointer"
                >
                  <Image
                    width={48} height={48} unoptimized
                    src={s.photoUrl}
                    alt={s.fullName}
                    className="w-12 h-12 rounded-full object-cover bg-slate-800 border-2 border-white/10 group-hover:border-sky-400/50 transition-colors shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231e293b" width="100" height="100"/><text x="50" y="58" text-anchor="middle" fill="%2394a3b8" font-size="44" font-weight="bold">👤</text></svg>';
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-white group-hover:text-sky-300 transition-colors truncate">
                      {s.fullName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-[11px] font-semibold text-slate-300">
                        {s.grade} · &ldquo;{s.section}&rdquo;
                      </span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        DNI {s.dni}
                      </span>
                    </div>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-sky-500/20 text-slate-400 group-hover:text-sky-300 flex items-center justify-center text-sm font-bold transition-all shrink-0">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
