'use client';

import { useState } from 'react';

export default function AdminReportsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const handleSendSummary = async () => {
    setMessage(null);
    setSending(true);
    try {
      const statsRes = await fetch('/api/admin/stats', { cache: 'no-store' });
      const statsData = await statsRes.json();
      if (!statsData.ok) throw new Error('No se pudieron obtener las estadísticas');

      const res = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'summary',
          director: {
            email: 'director@colegio.com',
            name: 'Director',
          },
          date,
          stats: statsData.stats,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'Error al enviar');
      }
      setMessage({ type: 'ok', text: `✓ Email enviado con éxito (ID: ${data.messageId})` });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error desconocido',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl animate-scale-in">
      <div className="pb-4 border-b border-white/10">
        <h1 className="text-3xl font-black text-white tracking-tight">
          Reportes y Notificaciones
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Exportación oficial de asistencias en formato PDF y envío de reportes ejecutivos
        </p>
      </div>

      {/* Card PDF */}
      <div className="glass-card rounded-3xl p-6 border border-white/10 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center text-lg">
            📄
          </div>
          <div>
            <h2 className="font-extrabold text-base text-white">Reporte Diario en PDF</h2>
            <p className="text-xs text-slate-400">
              Genera la hoja oficial de control con firmas, listado de puntualidad y tardanzas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end pt-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] text-slate-300 uppercase tracking-widest font-black mb-1.5">
              Fecha de la jornada
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-950/80 border border-white/10 focus:border-sky-400 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors"
            />
          </div>
          <a
            href={`/api/reports/daily?date=${date}`}
            target="_blank"
            rel="noopener"
            className="pressable bg-sky-500 hover:bg-sky-400 text-slate-950 font-black px-6 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-sky-500/25 transition-all"
          >
            <span>Descargar PDF</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      {/* Card Email Notifications */}
      <div className="glass-card rounded-3xl p-6 border border-white/10 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-lg">
            ✉️
          </div>
          <div>
            <h2 className="font-extrabold text-base text-white">Resumen Ejecutivo por Correo</h2>
            <p className="text-xs text-slate-400">
              Envía la consolidación del día directamente al correo del Director o Coordinador.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end pt-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] text-slate-300 uppercase tracking-widest font-black mb-1.5">
              Correo del destinatario
            </label>
            <input
              type="email"
              defaultValue="director@colegio.com"
              className="w-full bg-slate-950/80 border border-white/10 focus:border-emerald-400 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={handleSendSummary}
            disabled={sending}
            className="pressable bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-2.5 rounded-2xl text-xs transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
          >
            {sending ? 'Enviando...' : 'Enviar Resumen'}
          </button>
        </div>

        {message && (
          <div
            className={`mt-4 px-4 py-3 rounded-2xl text-xs font-semibold ${
              message.type === 'ok'
                ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
            }`}
          >
            {message.text}
          </div>
        )}

        <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1.5">
          <span>💡</span>
          <span>
            En entorno de demo (sin <code>RESEND_API_KEY</code> configurada), los envíos se simulan y quedan en la consola.
          </span>
        </p>
      </div>
    </div>
  );
}
