'use client';

import { useEffect, useRef, useCallback } from 'react';
import { SCANNER_CONFIG } from '@/lib/constants';
import type { MultiScanEvent, ScannerConfig } from '@/types/attendance';

interface MultiScannerInputProps {
  entranceId: string;
  scanners: ScannerConfig[];
  onScan: (event: MultiScanEvent) => void;
  enabled?: boolean;
}

const BUFFER_RESET_DELAY = 80; // ms para limpiar buffer después de Enter
const MIN_INTERVAL_BETWEEN_SCANS_MS = 300; // rate limit por lector

export default function MultiScannerInput({
  entranceId,
  scanners,
  onScan,
  enabled = true,
}: MultiScannerInputProps) {
  // Refs para cada lector (uno por input)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const buffersRef = useRef<string[]>(scanners.map(() => ''));
  const lastScanTimesRef = useRef<number[]>(scanners.map(() => 0));
  const currentFocusIndex = useRef<number>(0);
  const isFocusedRef = useRef<boolean>(true);

  // Refs para el método alternativo (single document-level handler con prefijos)
  const globalBufferRef = useRef<string>('');
  const scannerPrefixesRef = useRef<Record<string, string>>(
    Object.fromEntries(scanners.map((s) => [s.id, s.prefix]))
  );

  // Re-inicializar cuando cambien los scanners
  useEffect(() => {
    buffersRef.current = scanners.map(() => '');
    lastScanTimesRef.current = scanners.map(() => 0);
    scannerPrefixesRef.current = Object.fromEntries(
      scanners.map((s) => [s.id, s.prefix])
    );
  }, [scanners]);

  // ========================================================
  // MÉTODO 1: Rotación de foco entre múltiples inputs
  // Funciona con cualquier lector USB HID sin configuración
  // ========================================================

  const handleKeyDownForInput = useCallback(
    (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!enabled) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        const code = buffersRef.current[index].trim();
        buffersRef.current[index] = '';
        if (e.currentTarget) e.currentTarget.value = '';

        if (!code) return;

        const now = Date.now();
        const lastTime = lastScanTimesRef.current[index];
        const diff = now - lastTime;

        // Rate limit: si el último scan de este input fue hace menos de 300ms,
        // ignorar (probable doble lectura por carnet pegado al lector)
        if (diff > 0 && diff < MIN_INTERVAL_BETWEEN_SCANS_MS) {
          return;
        }

        lastScanTimesRef.current[index] = now;

        const isBurst = diff > 0 && diff < SCANNER_CONFIG.BURST_THRESHOLD_MS;

        onScan({
          qrCode: code,
          scannerId: scanners[index].id,
          entranceId,
          isBurst,
          timestamp: now,
        });
        return;
      }

      if (e.key.length === 1) {
        buffersRef.current[index] += e.key;
      }
    },
    [enabled, entranceId, scanners, onScan]
  );

  // Foco automático
  useEffect(() => {
    if (!enabled) return;

    const focusActive = () => {
      const active = document.activeElement;
      // No robar foco si el usuario está en otro input (búsqueda manual)
      if (
        active &&
        active.tagName === 'INPUT' &&
        !(active as HTMLInputElement).classList.contains('scanner-input')
      ) {
        return;
      }
      const idx = currentFocusIndex.current;
      const target = inputsRef.current[idx];
      if (target && document.activeElement !== target) {
        target.focus();
      }
    };

    focusActive();

    // Re-focus en cualquier click o tecla
    const events: (keyof WindowEventMap)[] = ['click', 'keydown', 'focusout'];
    events.forEach((e) => window.addEventListener(e, focusActive));

    // Rotar foco cada 250ms entre los inputs
    const rotationInterval = setInterval(() => {
      currentFocusIndex.current =
        (currentFocusIndex.current + 1) % scanners.length;
      focusActive();
    }, 250);

    return () => {
      events.forEach((e) => window.removeEventListener(e, focusActive));
      clearInterval(rotationInterval);
    };
  }, [enabled, scanners.length]);

  // ========================================================
  // MÉTODO 2: Handler global con prefijo (más confiable)
  // Para activar, los lectores deben estar configurados
  // con un prefijo único (ej: A1|qrcode)
  // ========================================================

  useEffect(() => {
    if (!enabled) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Solo capturar si NO estamos en un input visible (búsqueda manual)
      if (
        target &&
        target.tagName === 'INPUT' &&
        !(target as HTMLInputElement).classList.contains('scanner-input')
      ) {
        return;
      }

      if (e.key === 'Enter') {
        const code = globalBufferRef.current.trim();
        globalBufferRef.current = '';
        if (!code) return;

        // Detectar scanner por prefijo
        let scannerId: string | null = null;
        let qrCode = code;

        for (const [id, prefix] of Object.entries(scannerPrefixesRef.current)) {
          if (code.startsWith(prefix)) {
            scannerId = id;
            // Quitar el prefijo y separador
            qrCode = code.substring(prefix.length).replace(/^[:\s|]+/, '');
            break;
          }
        }

        // Si no se detectó prefijo, asignar al último usado
        if (!scannerId) {
          scannerId =
            currentFocusIndex.current < scanners.length
              ? scanners[currentFocusIndex.current].id
              : scanners[0].id;
        }

        const now = Date.now();
        const scannerIndex = scanners.findIndex((s) => s.id === scannerId);
        const lastTime =
          scannerIndex >= 0
            ? lastScanTimesRef.current[scannerIndex]
            : 0;
        const diff = now - lastTime;

        // Rate limit por lector (evita doble lectura por carnet pegado)
        if (diff > 0 && diff < MIN_INTERVAL_BETWEEN_SCANS_MS) {
          return;
        }

        if (scannerIndex >= 0) {
          lastScanTimesRef.current[scannerIndex] = now;
        }

        const isBurst = diff > 0 && diff < SCANNER_CONFIG.BURST_THRESHOLD_MS;

        onScan({
          qrCode,
          scannerId,
          entranceId,
          isBurst,
          timestamp: now,
        });
        return;
      }

      if (e.key.length === 1) {
        globalBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [enabled, entranceId, scanners, onScan]);

  return (
    <div className="scanner-input-container">
      {scanners.map((scanner, i) => (
        <input
          key={scanner.id}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          onKeyDown={handleKeyDownForInput(i)}
          className="sr-only scanner-input"
          autoFocus={i === 0}
          autoComplete="off"
          spellCheck={false}
          tabIndex={i === 0 ? -1 : -2}
          aria-label={`Lector ${scanner.label} de entrada ${entranceId}`}
        />
      ))}
    </div>
  );
}
