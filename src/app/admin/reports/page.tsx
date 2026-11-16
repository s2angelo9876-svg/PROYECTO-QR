'use client';

import { useState } from 'react';

export default function AdminReportsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-black text-white">Reportes de demostración</h1>
      <p className="text-sm text-slate-300">El servidor demo usa memoria temporal. Conserva también la copia local de las marcaciones.</p>
      <section className="glass-card rounded-3xl p-6 border border-white/10 space-y-4">
        <h2 className="font-bold text-white">Reporte diario PDF</h2>
        <label htmlFor="report-date" className="block text-sm text-slate-200">Fecha de la jornada</label>
        <input id="report-date" type="date" value={date} onChange={(event) => setDate(event.target.value)}
          className="rounded-xl border border-slate-600 bg-slate-950 px-4 py-2 text-white" />
        <a href={`/api/reports/daily?date=${encodeURIComponent(date)}`} target="_blank" rel="noopener"
          className="inline-block rounded-xl bg-sky-500 px-4 py-2 text-slate-950 font-bold">Descargar PDF demo</a>
        <p className="text-xs text-amber-200">El reporte actual limita el detalle a 80 marcaciones. La exportación institucional completa está pendiente.</p>
      </section>
      <section className="glass-card rounded-3xl p-6 border border-white/10">
        <h2 className="font-bold text-white">Correo deshabilitado</h2>
        <p className="mt-2 text-sm text-slate-300">Descarga el reporte para compartirlo manualmente. El envío externo se habilitará después de validar destinatarios, privacidad y cuotas gratuitas.</p>
      </section>
    </div>
  );
}
