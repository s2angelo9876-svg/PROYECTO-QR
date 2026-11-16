'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ScannerConfig, ScannerStatus } from '@/types/attendance';
import { soundManager } from '@/lib/audio';

interface Props {
  entranceId: string;
  entranceLabel: string;
  scanners: ScannerConfig[];
  scannerStatuses: Record<string, ScannerStatus>;
  onSimulateTestScan?: (scannerId: string) => void;
}

const POSITION_LABELS: Record<ScannerConfig['position'], string> = {
  left: 'Puerta Izquierda',
  center: 'Puerta Central',
  right: 'Puerta Derecha',
  special: 'Acceso Preferencial',
};

const POSITION_ICONS: Record<ScannerConfig['position'], string> = {
  left: '◀',
  center: '●',
  right: '▶',
  special: '♿',
};

export default function ScannerHub({
  entranceId,
  entranceLabel,
  scanners,
  scannerStatuses,
  onSimulateTestScan,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [webHidSupported, setWebHidSupported] = useState(false);
  const [usbDevicesCount, setUsbDevicesCount] = useState<number | null>(null);
  const [testingScannerId, setTestingScannerId] = useState<string | null>(null);
  const [, setClockTick] = useState(0);

  // Tick cada segundo para actualizar tiempos de inactividad
  useEffect(() => {
    const timer = setInterval(() => setClockTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Verificar soporte de WebHID API para detección física
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('hid' in navigator && (navigator as any).hid) {
      setWebHidSupported(true);
      const hid = (navigator as any).hid;

      // Obtener dispositivos ya emparejados
      hid.getDevices?.().then((devices: any[]) => {
        setUsbDevicesCount(devices.length);
      }).catch(() => {});

      const handleConnect = (e: any) => {
        soundManager.play('success');
        hid.getDevices?.().then((devices: any[]) => setUsbDevicesCount(devices.length));
      };

      const handleDisconnect = (e: any) => {
        soundManager.play('warning');
        hid.getDevices?.().then((devices: any[]) => setUsbDevicesCount(devices.length));
      };

      hid.addEventListener('connect', handleConnect);
      hid.addEventListener('disconnect', handleDisconnect);

      return () => {
        hid.removeEventListener('connect', handleConnect);
        hid.removeEventListener('disconnect', handleDisconnect);
      };
    }
  }, []);

  // Solicitar permiso WebHID si el usuario desea inspeccionar el hardware
  const handleRequestWebHid = async () => {
    if (!('hid' in navigator)) return;
    try {
      const hid = (navigator as any).hid;
      await hid.requestDevice({ filters: [] });
      const devices = await hid.getDevices();
      setUsbDevicesCount(devices.length);
      soundManager.play('success');
    } catch {
      // Usuario canceló el prompt
    }
  };

  // Calcular la salud de cada scanner
  const scannerHealthList = useMemo(() => {
    const now = Date.now();
    return scanners.map((scanner) => {
      const status = scannerStatuses[scanner.id];
      const lastScan = status?.lastScanAt;
      const diffMs = lastScan ? now - lastScan : null;

      // Estado de conexión:
      // - Recent (< 10s): Muy activo
      // - Online (< 5 min): Conectado y listo
      // - Standby (5 min - 30 min): En espera
      // - Idle / Ready (sin scans aún o > 30 min): Esperando carnet
      let connectionState: 'ACTIVE' | 'ONLINE' | 'STANDBY' | 'READY' = 'READY';
      if (diffMs !== null) {
        if (diffMs < 8000) connectionState = 'ACTIVE';
        else if (diffMs < 300_000) connectionState = 'ONLINE';
        else connectionState = 'STANDBY';
      }

      return {
        ...scanner,
        status,
        connectionState,
        lastScanMs: diffMs,
      };
    });
  }, [scanners, scannerStatuses]);

  const activeCount = scannerHealthList.filter(
    (s) => s.connectionState === 'ACTIVE' || s.connectionState === 'ONLINE' || s.connectionState === 'READY'
  ).length;

  const handleTestPing = (scannerId: string) => {
    setTestingScannerId(scannerId);
    soundManager.play('success');
    if (onSimulateTestScan) {
      onSimulateTestScan(scannerId);
    }
    setTimeout(() => {
      setTestingScannerId(null);
    }, 1200);
  };

  return (
    <>
      {/* Botón / Pill Compacto Superior */}
      <button
        onClick={() => setIsOpen(true)}
        className="pressable group flex items-center gap-2.5 px-3 py-1.5 rounded-full glass-pill border border-white/10 hover:border-sky-500/40 hover:bg-slate-900/90 text-left cursor-pointer transition-all duration-200"
        title="Ver estado de conexión de los escáneres USB"
        aria-label="Abrir panel de escáneres"
      >
        <div className="relative flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 animate-dot-ping" />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-bold text-slate-200 tracking-tight">
            Escáneres USB:
          </span>
          <span className="font-extrabold text-emerald-400 tabular-nums">
            {activeCount}/{scanners.length}
          </span>
          <span className="text-slate-400 font-medium hidden sm:inline">
            listos
          </span>
        </div>

        {/* Mini LEDs por lector */}
        <div className="flex items-center gap-1 pl-1 border-l border-white/10">
          {scanners.map((s) => {
            const st = scannerStatuses[s.id];
            const isFresh = st?.lastScanAt && Date.now() - st.lastScanAt < 5000;
            return (
              <span
                key={s.id}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  isFresh
                    ? 'bg-sky-400 scale-125'
                    : 'bg-emerald-500/70'
                }`}
                title={`Lector ${s.id}: ${s.label}`}
              />
            );
          })}
        </div>

        <span className="text-[10px] text-sky-400/80 group-hover:text-sky-300 font-semibold uppercase tracking-wider pl-1">
          Info ▾
        </span>
      </button>

      {/* Modal / Drawer de Telemetría de Escáneres */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-scale-in"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-2xl glass-card rounded-3xl p-6 border border-white/10 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
            style={{ transformOrigin: 'top center' }}
          >
            {/* Header del modal */}
            <div className="flex items-start justify-between pb-4 border-b border-white/10 mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="text-lg font-black tracking-tight text-white">
                    Panel de Conexión de Escáneres
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold uppercase tracking-wider">
                    {entranceLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Monitoreo en tiempo real de los lectores USB HID conectados a esta terminal
                </p>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="pressable w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {/* Hardware Status Banner */}
            <div className="mb-5 p-3 rounded-2xl bg-slate-900/60 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 text-base">
                  🔌
                </div>
                <div>
                  <p className="font-semibold text-slate-200">
                    Modo USB: <span className="text-emerald-400">Emulación Teclado HID + Prefijos</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {webHidSupported
                      ? usbDevicesCount !== null && usbDevicesCount > 0
                        ? `WebHID vinculó ${usbDevicesCount} dispositivo(s) USB.`
                        : 'WebHID activo · Soporte directo de hardware en este navegador.'
                      : 'Navegador en modo HID Standard (captura por evento de buffer).'}
                  </p>
                </div>
              </div>

              {webHidSupported && (
                <button
                  onClick={handleRequestWebHid}
                  className="pressable px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold text-xs transition-colors"
                >
                  Detectar USB
                </button>
              )}
            </div>

            {/* Grid de Escáneres */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
              {scannerHealthList.map((scanner) => {
                const isTesting = testingScannerId === scanner.id;
                const isRecent =
                  scanner.status?.lastScanAt &&
                  Date.now() - scanner.status.lastScanAt < 5000;

                return (
                  <div
                    key={scanner.id}
                    className={`relative rounded-2xl p-4 border transition-all duration-300 ${
                      isTesting
                        ? 'bg-sky-950/80 border-sky-400 shadow-lg shadow-sky-500/20 scale-[1.02]'
                        : isRecent
                        ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-900/70 border-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sky-400 font-bold text-xs">
                          {POSITION_ICONS[scanner.position]}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-white">
                              {scanner.id}
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/5">
                              {POSITION_LABELS[scanner.position]}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 font-medium">
                            {scanner.label}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          LISTO
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Prefijo USB</span>
                        <code className="text-sky-300 font-mono font-bold bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/40">
                          {scanner.prefix}
                        </code>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px] uppercase">Lecturas hoy</span>
                        <span className="font-extrabold text-white tabular-nums text-xs">
                          {scanner.status?.totalScans ?? 0}
                        </span>
                      </div>
                    </div>

                    {/* Última lectura */}
                    <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                      <span className="truncate max-w-[140px] text-slate-300">
                        {scanner.status?.lastStudentName ? (
                          <>Último: <strong className="text-white">{scanner.status.lastStudentName.split(' ')[0]}</strong></>
                        ) : (
                          <span className="italic text-slate-500">Sin lecturas aún</span>
                        )}
                      </span>

                      <button
                        onClick={() => handleTestPing(scanner.id)}
                        className="pressable text-[10px] font-bold px-2 py-1 rounded-lg bg-white/5 hover:bg-sky-500/20 text-sky-300 border border-white/10 hover:border-sky-500/30 transition-colors"
                        title="Probar sonido y respuesta visual de este lector"
                      >
                        ⚡ Probar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer con info de uso */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="text-amber-400">💡</span>
                <span>Los lectores USB HID no requieren drivers adicionales.</span>
              </span>

              <button
                onClick={() => setIsOpen(false)}
                className="pressable px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
