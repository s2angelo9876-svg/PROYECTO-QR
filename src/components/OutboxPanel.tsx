'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { exportLocalRecords, getPendingScans, OUTBOX_EVENT, syncOfflineQueue, type SyncResult } from '@/lib/offlineQueue';

export default function OutboxPanel({ onSynchronized }: { onSynchronized: (result: SyncResult) => void }) {
  const [review, setReview] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => getPendingScans().then((scans) => {
    setReview(scans.filter((scan) => scan.state === 'REVIEW' || scan.state === 'REJECTED').length);
    setBlocked(scans.some((scan) => scan.state === 'BLOCKED_AUTH'));
  }).catch(() => setError('No se pudo leer la cola local. No borres los datos del navegador.')), []);
  useEffect(() => {
    const listener = () => { void refresh(); };
    void refresh();
    window.addEventListener(OUTBOX_EVENT, listener);
    let channel: BroadcastChannel | null = null;
    try { if ('BroadcastChannel' in window) channel = new BroadcastChannel('sca-outbox'); }
    catch { /* The same-tab event and periodic refresh still work without cross-tab notifications. */ }
    if (channel) channel.onmessage = listener;
    return () => { window.removeEventListener(OUTBOX_EVENT, listener); channel?.close(); };
  }, [refresh]);
  async function retry() {
    setBusy(true); setError(null);
    try { onSynchronized(await syncOfflineQueue({ force: true, resumeAuth: true })); await refresh(); }
    catch { setError('No se pudo sincronizar. La copia local se conserva.'); }
    finally { setBusy(false); }
  }
  async function download() {
    try {
      const data = await exportLocalRecords();
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `sca-qr-copia-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('No se pudo exportar. Conserva este perfil y contacta al responsable.'); }
  }
  return <section aria-label="Recuperación de marcaciones" className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-200">
    <button onClick={() => void retry()} disabled={busy} className="rounded-lg border border-slate-600 px-3 py-2 disabled:opacity-50">
      {busy ? 'Sincronizando…' : 'Reintentar pendientes'}
    </button>
    <button onClick={() => void download()} className="rounded-lg border border-slate-600 px-3 py-2">Exportar copia local</button>
    {review > 0 && <span role="status">{review} marcaciones requieren revisión; se conservan y no se reenvían automáticamente.</span>}
    {blocked && <Link href="/admin/login?redirect=/ingreso" className="underline text-amber-200">Iniciar sesión para reanudar</Link>}
    {error && <span role="alert" className="text-rose-200">{error}</span>}
  </section>;
}
