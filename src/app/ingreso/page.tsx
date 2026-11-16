'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MultiScannerInput from '@/components/MultiScannerInput';
import StudentDisplay from '@/components/StudentDisplay';
import ConnectivityBadge from '@/components/ConnectivityBadge';
import RecentScans from '@/components/RecentScans';
import ManualSearch from '@/components/ManualSearch';
import ScannerStatusGrid from '@/components/ScannerStatusGrid';
import ScannerHub from '@/components/ScannerHub';
import OutboxPanel from '@/components/OutboxPanel';
import { soundManager } from '@/lib/audio';
import { enqueueScan, syncOfflineQueue, getPendingCount, OUTBOX_EVENT, type SyncResult } from '@/lib/offlineQueue';
import { parseQR, verifyQRSignature, generateDemoQR } from '@/lib/qrValidator';
import { UI_CONFIG } from '@/lib/constants';
import { MOCK_STUDENTS } from '@/lib/mockData';
import { getStudentFromCache, refreshStudentsCache, getCacheInfo } from '@/lib/studentsCache';
import type { ScanResult, MultiScanEvent, ScannerStatus, EntranceConfig } from '@/types/attendance';
import { z } from 'zod';

const EntranceSchema = z.object({
  id: z.string().min(1).max(40), label: z.string().max(100),
  scanners: z.array(z.object({ id: z.string().min(1).max(40), label: z.string().max(100),
    position: z.enum(['left', 'center', 'right', 'special']), prefix: z.string().min(1).max(50) })).min(1).max(8),
});
const DEFAULT_ENTRANCE_CONFIG: EntranceConfig = {
  id: 'NORTE', label: 'Entrada Norte',
  scanners: [{ id: 'N1', label: 'Lector piloto', position: 'center', prefix: 'N1|' }],
};

function IngresoPageInner() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [showManual, setShowManual] = useState(searchParams.get('mode') === 'manual');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [workerError, setWorkerError] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [scannerStatuses, setScannerStatuses] = useState<Record<string, ScannerStatus>>({});
  const [entranceConfig, setEntranceConfig] = useState<EntranceConfig>(DEFAULT_ENTRANCE_CONFIG);
  const latestScanId = useRef<string | null>(null);
  const invalidInput = useCallback((message: string) => {
    latestScanId.current = null;
    setResult({ status: 'ERROR', message, timestamp: new Date().toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima', hour12: false,
    }), scanId: crypto.randomUUID() });
  }, []);

  const applySyncResult = useCallback((sync: SyncResult) => {
    setPendingCount(sync.remaining);
    const event = sync.events.find((item) => item.scanId === latestScanId.current);
    if (!event) return;
    setResult((current) => {
      if (!current || current.scanId !== event.scanId) return current;
      if (event.acknowledgement) {
        const ack = event.acknowledgement;
        return { ...current, student: ack.student, isOffline: false,
          status: ack.persistence === 'durable' && !ack.is_burst ? 'SUCCESS' : 'WARNING',
          message: ack.persistence === 'durable' ? ack.message : 'Recibido en demo · Copia local conservada',
          attendanceStatus: ack.persistence === 'durable' ? ack.attendance_status : undefined };
      }
      return { ...current, status: event.state === 'REJECTED' ? 'ERROR' : 'WARNING', isOffline: true,
        message: event.state === 'REVIEW' ? 'Requiere revisión · Copia local conservada'
          : event.state === 'REJECTED' ? 'Marcación rechazada · Copia local conservada'
          : event.state === 'BLOCKED_AUTH' ? 'Inicia sesión para sincronizar · Copia local conservada'
          : 'Pendiente de envío · Copia local conservada' };
    });
  }, []);

  useEffect(() => {
    let active = true;
    const fail = () => { if (active) setStorageError('No se puede verificar el almacenamiento local. Cierra otras pestañas e inténtalo de nuevo.'); };
    const workerFailed = () => { if (active) setWorkerError(true); };
    const updateClock = () => setCurrentTime(new Date().toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima', hour12: false,
    }));
    const refreshCount = () => { void getPendingCount().then((count) => { if (active) setPendingCount(count); }).catch(fail); };
    const synchronize = async () => {
      if (!navigator.onLine) return;
      try { const sync = await syncOfflineQueue(); if (active) applySyncResult(sync); } catch { fail(); }
    };
    const online = () => { setIsOnline(true); void synchronize(); };
    const offline = () => setIsOnline(false);
    const initialize = async () => {
      try {
        setIsOnline(navigator.onLine);
        const saved = localStorage.getItem('sca-qr-entrance-config');
        if (saved) {
          let config: unknown;
          try { config = JSON.parse(saved); } catch { config = null; }
          const parsed = EntranceSchema.safeParse(config);
          if (parsed.success && active) setEntranceConfig(parsed.data);
        }
        await getPendingCount();
        if (!active) return;
        setStorageReady(true);
        const info = await getCacheInfo();
        if (navigator.onLine && info.isStale) await refreshStudentsCache();
        refreshCount();
        await synchronize();
      } catch { fail(); }
    };
    updateClock();
    void initialize();
    const clock = setInterval(updateClock, 1000);
    const retry = setInterval(() => { refreshCount(); void synchronize(); }, UI_CONFIG.OFFLINE_RETRY_INTERVAL_MS);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('sca-storage-error', fail);
    window.addEventListener('sca-worker-error', workerFailed);
    window.addEventListener(OUTBOX_EVENT, refreshCount);
    return () => {
      active = false; clearInterval(clock); clearInterval(retry);
      window.removeEventListener('online', online); window.removeEventListener('offline', offline);
      window.removeEventListener('sca-storage-error', fail); window.removeEventListener(OUTBOX_EVENT, refreshCount);
      window.removeEventListener('sca-worker-error', workerFailed);
    };
  }, [applySyncResult]);

  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem('sca-qr-entrance-config', JSON.stringify(entranceConfig)); }
    catch { /* Configuration is optional; the outbox uses IndexedDB and reports its own failures. */ }
  }, [entranceConfig, storageReady]);

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), UI_CONFIG.RESULT_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [result]);

  const updateScannerStatus = useCallback((scannerId: string, update: Partial<ScannerStatus>, increment = false) => {
    setScannerStatuses((prev) => {
      const current = prev[scannerId] || { id: scannerId, label: '', position: 'center' as const,
        lastScanAt: null, lastStudentName: null, lastStatus: null, totalScans: 0, isActive: false };
      return { ...prev, [scannerId]: { ...current, ...update,
        totalScans: current.totalScans + (increment ? 1 : 0) } };
    });
  }, []);

  const handleMultiScan = useCallback(async (event: MultiScanEvent) => {
    const scanId = crypto.randomUUID();
    latestScanId.current = scanId;
    const time = new Date(event.timestamp).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour12: false });
    const parsed = parseQR(event.qrCode);
    if (!parsed.valid || !verifyQRSignature(parsed.code, parsed.signature)) {
      setResult({ status: 'ERROR', message: parsed.error || 'QR no válido para el demo', timestamp: time, scanId });
      if (soundEnabled) soundManager.play('error');
      return;
    }
    let stored = false;
    try {
      if (!storageReady || storageError) throw new Error('LOCAL_STORAGE_UNAVAILABLE');
      await enqueueScan({ scanId, qrCode: parsed.code, qrSignature: parsed.signature,
        isBurst: event.isBurst, timestamp: new Date(event.timestamp).toISOString(),
        scannerId: event.scannerId, entranceId: event.entranceId });
      stored = true;
      setPendingCount(await getPendingCount());
      const student = await getStudentFromCache(parsed.code);
      setResult({ status: 'WARNING', message: 'Guardado localmente · Pendiente de confirmación',
        timestamp: time, scanId, isOffline: true, student });
      updateScannerStatus(event.scannerId, { label: entranceConfig.scanners.find((s) => s.id === event.scannerId)?.label || event.scannerId,
        lastScanAt: Date.now(), lastStudentName: student?.fullName || null, lastStatus: 'WARNING', isActive: false }, true);
      if (soundEnabled) soundManager.play('warning');
      if (navigator.onLine) applySyncResult(await syncOfflineQueue());
    } catch {
      setResult({ status: stored ? 'WARNING' : 'ERROR',
        message: stored ? 'Copia local conservada · Sincronización pendiente'
          : 'No se guardó la marcación · Revisa el almacenamiento local', timestamp: time, scanId, isOffline: stored });
      if (!stored) setStorageError('No se pudo guardar. Exporta una copia si está disponible y contacta al responsable.');
    }
  }, [storageReady, storageError, soundEnabled, entranceConfig.scanners, updateScannerStatus, applySyncResult]);

  const switchEntrance = useCallback((entranceId: string) => {
    setEntranceConfig((prev) => {
      const newScanners = prev.scanners.map((s) => ({
        ...s,
        id: s.id.replace(/^[NS]\d/, `${entranceId.charAt(0)}${s.id.charAt(1)}`),
        prefix: s.prefix.replace(
          /^[NS]\d/,
          `${entranceId.charAt(0)}${s.id.charAt(1)}`
        ),
      }));
      return {
        id: entranceId,
        label: entranceId === 'NORTE' ? 'Entrada Norte' : 'Entrada Sur',
        scanners: newScanners,
      };
    });
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const getScannerStatus = useCallback(
    (scannerId: string) => scannerStatuses[scannerId],
    [scannerStatuses]
  );

  return (
    <main className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col p-4 md:p-6 relative overflow-x-hidden select-none">
      <MultiScannerInput
        entranceId={entranceConfig.id}
        scanners={entranceConfig.scanners}
        onScan={handleMultiScan}
        enabled={!showManual && storageReady && !storageError}
        onInvalidInput={invalidInput}
      />

      <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-sm text-amber-100">
        Demostración con datos ficticios. El servidor no conserva registros al reiniciarse; mantén la copia local.
      </div>
      {storageError && <div role="alert" className="mb-3 rounded-xl border border-rose-500 p-3 text-rose-200">{storageError}</div>}
      {workerError && <p role="status" className="mb-3 text-amber-200">No se habilitó el arranque offline. Mantén abierta esta página y exporta una copia antes de cerrarla.</p>}
      <OutboxPanel onSynchronized={applySyncResult} />
      {/* Barra de Navegación Superior / Telemetría */}
      <nav className="w-full flex flex-wrap items-center justify-between gap-3 mb-6 relative z-20">
        {/* Lado Izquierdo: Switchers y Controles */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="pressable px-3 py-1.5 rounded-full glass-pill border border-white/10 hover:border-white/25 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5"
            title="Volver al menú principal"
          >
            <span>←</span>
            <span className="hidden sm:inline">Inicio</span>
          </Link>

          {/* Selector de Entrada */}
          <div className="flex items-center glass-pill rounded-full p-0.5 border border-white/10">
            <button
              onClick={() => switchEntrance('NORTE')}
              className={`pressable px-3 py-1 rounded-full text-xs font-black transition-all ${
                entranceConfig.id === 'NORTE'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              NORTE
            </button>
            <button
              onClick={() => switchEntrance('SUR')}
              className={`pressable px-3 py-1 rounded-full text-xs font-black transition-all ${
                entranceConfig.id === 'SUR'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              SUR
            </button>
          </div>

          {/* Toggle Modo Manual */}
          <button
            onClick={() => setShowManual(!showManual)}
            className={`pressable flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full border transition-all ${
              showManual
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-lg shadow-amber-500/20'
                : 'glass-pill text-slate-300 hover:text-white border-white/10 hover:border-white/20'
            }`}
          >
            <span>{showManual ? '📷' : '⌨️'}</span>
            <span>{showManual ? 'Volver al Lector' : 'Manual'}</span>
          </button>
        </div>

        {/* Lado Derecho: Hub de Escáneres + Badge de Conectividad + Audio */}
        <div className="flex items-center gap-2.5">
          {/* Panel de Conexión de Escáneres (Requerimiento Clave) */}
          <ScannerHub
            entranceId={entranceConfig.id}
            entranceLabel={entranceConfig.label}
            scanners={entranceConfig.scanners}
            scannerStatuses={scannerStatuses}
            onSimulateTestScan={() => {
              setResult({ status: 'WARNING', message: 'Prueba de sonido y pantalla · No registra asistencia',
                timestamp: currentTime, scanId: crypto.randomUUID() });
            }}
          />

          <ConnectivityBadge isOnline={isOnline} pendingCount={pendingCount} />

          {/* Control de Audio y Pantalla Completa */}
          <div className="flex items-center gap-1 glass-pill rounded-full p-1 border border-white/10">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="pressable w-7 h-7 rounded-full flex items-center justify-center text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title={soundEnabled ? 'Silenciar alertas' : 'Activar sonido'}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
            <button
              onClick={toggleFullscreen}
              className="pressable w-7 h-7 rounded-full flex items-center justify-center text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Alternar pantalla completa (Modo Quiosco)"
            >
              {isFullscreen ? '⤢' : '⤡'}
            </button>
          </div>
        </div>
      </nav>

      {/* Cabecera Principal con Reloj */}
      <header className="text-center my-3 md:my-5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold mb-2 uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          Terminal de Control de Ingreso
        </div>

        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
          SCA-QR · <span className="text-sky-400">{entranceConfig.label.toUpperCase()}</span>
        </h1>

        <div className="flex items-center justify-center gap-3 mt-1.5 text-xs text-slate-400">
          <span className="font-mono text-slate-300 font-bold tabular-nums">
            🕒 {currentTime}
          </span>
          <span>·</span>
          <span>
            {showManual
              ? 'Modo manual activo · Seleccione un alumno de la lista'
              : `${entranceConfig.scanners.length} lectores configurados · Acerque el carnet`}
          </span>
        </div>
      </header>

      {/* Disposición Física de Lectores (Grid Superior) */}
      {!showManual && (
        <div className="flex justify-center mb-6">
          <ScannerStatusGrid
            scanners={entranceConfig.scanners}
            entranceLabel={entranceConfig.label}
            getStatus={getScannerStatus}
          />
        </div>
      )}

      {/* Contenido Central: Espera / Búsqueda Manual / Tarjeta de Alumno */}
      <div className="flex-1 flex items-center justify-center my-2">
        {showManual ? (
          <ManualSearch
            students={MOCK_STUDENTS}
            onSelect={(qr) => {
              setShowManual(false);
              handleMultiScan({
                qrCode: qr,
                scannerId: entranceConfig.scanners[0].id,
                entranceId: entranceConfig.id,
                isBurst: false,
                timestamp: Date.now(),
              });
            }}
            onCancel={() => setShowManual(false)}
          />
        ) : !result ? (
          /* Estado de Espera: Radar óptico refinado (Emil Kowalski) */
          <div className="w-full max-w-md rounded-3xl p-8 md:p-10 text-center glass-card border border-white/10 flex flex-col items-center gap-4 relative overflow-hidden select-none animate-scale-in">
            {/* Anillos de radar con pulsación sutil */}
            <div className="relative my-2">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-500/20 to-indigo-500/20 flex items-center justify-center border border-sky-400/40 text-4xl shadow-inner">
                📷
              </div>
              <div className="absolute inset-0 rounded-full border border-sky-400/50 animate-ping opacity-25" />
              <div className="absolute -inset-3 rounded-full border border-indigo-400/20 animate-pulse" />
            </div>

            <div className="space-y-1">
              <p className="text-xl font-black text-white tracking-tight">
                Esperando lectura del carnet...
              </p>
              <p className="text-xs text-slate-400">
                Pase el código QR frente a cualquiera de los {entranceConfig.scanners.length} escáneres
              </p>
            </div>

            {/* Micro-pills de ayuda para pruebas rápidas */}
            <div className="pt-3 border-t border-white/10 w-full">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">
                Prueba rápida sin lector físico:
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {MOCK_STUDENTS.slice(0, 3).map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      handleMultiScan({
                        qrCode: generateDemoQR(st.dni),
                        scannerId: entranceConfig.scanners[0].id,
                        entranceId: entranceConfig.id,
                        isBurst: false,
                        timestamp: Date.now(),
                      });
                    }}
                    className="pressable text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-white/5 hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-white/5 hover:border-sky-500/30 transition-all"
                  >
                    Simular {st.firstName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <StudentDisplay result={result} />
        )}
      </div>

      {/* Historial Inferior Flotante */}
      <div className="mt-4 pb-2">
        <RecentScans />
      </div>

      {/* Pie de Página */}
      <footer className="text-center text-[11px] text-slate-500 pt-3">
        <span>SCA-QR v2.0 · Colegio Bandera · Sistema Multi-Lector USB HID</span>
      </footer>
    </main>
  );
}

export default function IngresoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#07090e] flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-400 text-sm font-semibold">
            <span className="w-3 h-3 rounded-full bg-sky-400 animate-ping" />
            <span>Iniciando Terminal de Portería...</span>
          </div>
        </main>
      }
    >
      <IngresoPageInner />
    </Suspense>
  );
}
