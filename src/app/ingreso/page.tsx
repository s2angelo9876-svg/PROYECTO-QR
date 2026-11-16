'use client';

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MultiScannerInput from '@/components/MultiScannerInput';
import StudentDisplay from '@/components/StudentDisplay';
import ConnectivityBadge from '@/components/ConnectivityBadge';
import RecentScans from '@/components/RecentScans';
import ManualSearch from '@/components/ManualSearch';
import ScannerStatusGrid from '@/components/ScannerStatusGrid';
import ScannerHub from '@/components/ScannerHub';
import { soundManager } from '@/lib/audio';
import {
  saveScanOffline,
  syncOfflineQueue,
  getPendingCount,
  saveRecentScan,
} from '@/lib/offlineQueue';
import { parseQR, verifyQRSignature, generateDemoQR } from '@/lib/qrValidator';
import { UI_CONFIG } from '@/lib/constants';
import { MOCK_STUDENTS } from '@/lib/mockData';
import {
  getStudentFromCache,
  refreshStudentsCache,
  getCacheInfo,
  type StudentsCacheInfo,
} from '@/lib/studentsCache';
import type {
  ScanResult,
  ApiScanResponse,
  MultiScanEvent,
  ScannerConfig,
  ScannerStatus,
  EntranceConfig,
} from '@/types/attendance';

const DEFAULT_ENTRANCE_CONFIG: EntranceConfig = {
  id: 'NORTE',
  label: 'Entrada Norte',
  scanners: [
    { id: 'N1', label: 'Puerta Principal', position: 'left', prefix: 'N1|' },
    { id: 'N2', label: 'Puerta Lateral', position: 'center', prefix: 'N2|' },
    { id: 'N3', label: 'Puerta Trasera', position: 'right', prefix: 'N3|' },
    { id: 'N4', label: 'Acceso Preferencial', position: 'special', prefix: 'N4|' },
  ],
};

function IngresoPageInner() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'manual';

  const [result, setResult] = useState<ScanResult | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [showManual, setShowManual] = useState(initialMode);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const [scannerStatuses, setScannerStatuses] = useState<
    Record<string, ScannerStatus>
  >({});
  const [entranceConfig, setEntranceConfig] = useState<EntranceConfig>(
    DEFAULT_ENTRANCE_CONFIG
  );
  const [cacheInfo, setCacheInfo] = useState<StudentsCacheInfo>({
    count: 0,
    ageMs: null,
    isStale: true,
    lastFetchedAt: null,
  });

  // Reloj en tiempo real
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Inicializar estados de scanners + cache de estudiantes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    getPendingCount().then(setPendingCount);

    const saved = localStorage.getItem('sca-qr-entrance-config');
    if (saved) {
      try {
        setEntranceConfig(JSON.parse(saved));
      } catch {
        // ignore
      }
    }

    const savedStatuses = localStorage.getItem('sca-qr-scanner-statuses');
    if (savedStatuses) {
      try {
        setScannerStatuses(JSON.parse(savedStatuses));
      } catch {
        // ignore
      }
    }

    const initCache = async () => {
      const current = await getCacheInfo();
      setCacheInfo(current);

      if (current.count === 0 || current.isStale) {
        if (navigator.onLine) {
          const res = await refreshStudentsCache();
          if (res.ok && res.count) {
            const updated = await getCacheInfo();
            setCacheInfo(updated);
          }
        }
      }
    };
    initCache();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      'sca-qr-entrance-config',
      JSON.stringify(entranceConfig)
    );
  }, [entranceConfig]);

  // Sincronización online/offline
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = async () => {
      setIsOnline(true);
      const res = await syncOfflineQueue();
      const count = await getPendingCount();
      setPendingCount(count);
      if (res.synced > 0) {
        if (soundEnabled) soundManager.play('success');
        setResult({
          status: 'SUCCESS',
          message: `✓ Sincronizados ${res.synced} registros`,
          timestamp: new Date().toLocaleTimeString('es-PE', { hour12: false }),
          scanId: crypto.randomUUID(),
        });
        setTimeout(() => setResult(null), UI_CONFIG.RESULT_DISPLAY_MS);
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(async () => {
      const count = await getPendingCount();
      setPendingCount(count);
      if (navigator.onLine) {
        const res = await syncOfflineQueue();
        if (res.synced > 0) {
          const newCount = await getPendingCount();
          setPendingCount(newCount);
        }
      }
    }, UI_CONFIG.OFFLINE_RETRY_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [soundEnabled]);

  // Auto-clear del resultado (después de 4.5 segundos)
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), UI_CONFIG.RESULT_DISPLAY_MS);
    return () => clearTimeout(t);
  }, [result]);

  const updateScannerStatus = useCallback(
    (scannerId: string, update: Partial<ScannerStatus>) => {
      setScannerStatuses((prev) => {
        const current = prev[scannerId] || {
          id: scannerId,
          label: '',
          position: 'center' as const,
          lastScanAt: null,
          lastStudentName: null,
          lastStatus: null,
          totalScans: 0,
          isActive: false,
        };
        const next = { ...current, ...update };
        const newState = { ...prev, [scannerId]: next };
        if (typeof window !== 'undefined') {
          localStorage.setItem('sca-qr-scanner-statuses', JSON.stringify(newState));
        }
        return newState;
      });
    },
    []
  );

  // Handler principal de escaneo
  const handleMultiScan = useCallback(
    async (event: MultiScanEvent) => {
      const time = new Date().toLocaleTimeString('es-PE', { hour12: false });
      const newScanId = crypto.randomUUID();
      const scanner = entranceConfig.scanners.find(
        (s) => s.id === event.scannerId
      );

      updateScannerStatus(event.scannerId, {
        label: scanner?.label || event.scannerId,
        position: scanner?.position || 'center',
        isActive: true,
      });

      const parsed = parseQR(event.qrCode);
      if (!parsed.valid) {
        if (soundEnabled) soundManager.play('error');
        setResult({
          status: 'ERROR',
          message: parsed.error || 'QR inválido',
          timestamp: time,
          scanId: newScanId,
        });
        updateScannerStatus(event.scannerId, {
          lastScanAt: Date.now(),
          lastStudentName: undefined,
          lastStatus: 'ERROR',
          totalScans:
            (scannerStatuses[event.scannerId]?.totalScans || 0) + 1,
          isActive: false,
        });
        saveRecentScan({
          scanId: newScanId,
          status: 'ERROR',
          timestamp: new Date().toISOString(),
          isOffline: false,
        });
        return;
      }

      if (!verifyQRSignature(parsed.code, parsed.signature)) {
        if (soundEnabled) soundManager.play('error');
        setResult({
          status: 'ERROR',
          message: '🛡️ QR NO AUTÉNTICO',
          timestamp: time,
          scanId: newScanId,
        });
        updateScannerStatus(event.scannerId, {
          lastScanAt: Date.now(),
          lastStatus: 'ERROR',
          totalScans:
            (scannerStatuses[event.scannerId]?.totalScans || 0) + 1,
          isActive: false,
        });
        return;
      }

      const localStudent = await getStudentFromCache(parsed.code);
      const hasInternet = navigator.onLine;
      const shouldGoOffline = !hasInternet || !localStudent;

      if (shouldGoOffline) {
        try {
          await saveScanOffline(parsed.code, parsed.signature, event.isBurst);
          setPendingCount((c) => c + 1);

          if (localStudent) {
            const scanResult: ScanResult = {
              status: event.isBurst ? 'WARNING' : 'SUCCESS',
              message: event.isBurst
                ? '⚠️ Verificar manualmente'
                : 'Registro local (sin conexión)',
              student: localStudent,
              timestamp: time,
              isOffline: true,
              scanId: newScanId,
            };
            setResult(scanResult);
            if (soundEnabled) soundManager.play(event.isBurst ? 'warning' : 'success');
            updateScannerStatus(event.scannerId, {
              lastScanAt: Date.now(),
              lastStudentName: localStudent.fullName,
              lastStatus: scanResult.status,
              totalScans:
                (scannerStatuses[event.scannerId]?.totalScans || 0) + 1,
              isActive: false,
            });
          } else {
            if (soundEnabled) soundManager.play('warning');
            setResult({
              status: 'WARNING',
              message: 'Sin conexión + sin cache local',
              timestamp: time,
              isOffline: true,
              scanId: newScanId,
            });
            updateScannerStatus(event.scannerId, {
              lastScanAt: Date.now(),
              lastStatus: 'WARNING',
              totalScans:
                (scannerStatuses[event.scannerId]?.totalScans || 0) + 1,
              isActive: false,
            });
          }
          saveRecentScan({
            scanId: newScanId,
            studentName: localStudent?.fullName,
            status: event.isBurst ? 'WARNING' : 'SUCCESS',
            timestamp: new Date().toISOString(),
            isOffline: true,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Error';
          if (soundEnabled) soundManager.play('error');
          setResult({
            status: 'ERROR',
            message: msg,
            timestamp: time,
            scanId: newScanId,
          });
        }
        return;
      }

      if (localStudent) {
        const scanResult: ScanResult = {
          status: event.isBurst ? 'WARNING' : 'SUCCESS',
          message: event.isBurst
            ? '⚠️ Ráfaga detectada'
            : 'Entrada registrada',
          student: localStudent,
          timestamp: time,
          attendanceStatus: 'ON_TIME',
          scanId: newScanId,
        };
        setResult(scanResult);
        if (soundEnabled) soundManager.play(event.isBurst ? 'warning' : 'success');
        updateScannerStatus(event.scannerId, {
          lastScanAt: Date.now(),
          lastStudentName: localStudent.fullName,
          lastStatus: scanResult.status,
          totalScans:
            (scannerStatuses[event.scannerId]?.totalScans || 0) + 1,
          isActive: false,
        });
        saveRecentScan({
          scanId: newScanId,
          studentName: localStudent.fullName,
          status: scanResult.status,
          timestamp: new Date().toISOString(),
          isOffline: false,
        });
      }

      fetch('/api/attendances/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code: parsed.code,
          qr_signature: parsed.signature,
          is_burst: event.isBurst,
          client_scan_id: newScanId,
          scanner_id: event.scannerId,
          entrance_id: event.entranceId,
        }),
      })
        .then(async (res) => {
          const data: ApiScanResponse = await res.json();
          if (res.ok && data.ok && data.is_burst !== event.isBurst && data.is_burst) {
            if (soundEnabled) soundManager.play('warning');
          }
        })
        .catch(() => {});
    },
    [entranceConfig, scannerStatuses, updateScannerStatus, soundEnabled]
  );

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
        enabled={!showManual}
      />

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
            onSimulateTestScan={(scannerId) => {
              // Simular escaneo de prueba
              handleMultiScan({
                qrCode: generateDemoQR('72345678'),
                scannerId,
                entranceId: entranceConfig.id,
                isBurst: false,
                timestamp: Date.now(),
              });
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
              : `${entranceConfig.scanners.length} escáneres ópticos sincronizados · Acerque el carnet`}
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
