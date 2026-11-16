'use client';

import { useEffect, useRef } from 'react';
import { SCANNER_CONFIG } from '@/lib/constants';
import type { MultiScanEvent, ScannerConfig } from '@/types/attendance';

interface Props {
  entranceId: string; scanners: ScannerConfig[];
  onScan: (event: MultiScanEvent) => void;
  onInvalidInput?: (message: string) => void;
  enabled?: boolean;
}

// A single keyboard stream has a single parser. Prefixes do not isolate simultaneous devices.
export default function MultiScannerInput({ entranceId, scanners, onScan, onInvalidInput, enabled = true }: Props) {
  const lastScan = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!enabled) return;
    let buffer = '';
    let lastKeyAt = 0;
    const handle = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input:not(.scanner-input),textarea,select,[contenteditable="true"],[role="dialog"]')) return;
      if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
      const now = Date.now();
      if (buffer && now - lastKeyAt > 1_000) {
        buffer = '';
        onInvalidInput?.('Lectura incompleta. Vuelve a pasar el carnet.');
      }
      lastKeyAt = now;
      if (event.key === 'Enter') {
        const raw = buffer.trim(); buffer = '';
        if (!raw) return;
        event.preventDefault();
        const prefixed = scanners.find((scanner) => raw.startsWith(scanner.prefix));
        const scanner = prefixed || (scanners.length === 1 ? scanners[0] : undefined);
        if (!scanner) { onInvalidInput?.('No se identificó el lector. Usa un prefijo configurado o la búsqueda manual.'); return; }
        const qrCode = prefixed ? raw.slice(prefixed.prefix.length) : raw;
        const previous = lastScan.current[scanner.id];
        lastScan.current[scanner.id] = now;
        onScan({ qrCode, scannerId: scanner.id, entranceId, timestamp: now,
          isBurst: previous !== undefined && now - previous < SCANNER_CONFIG.BURST_THRESHOLD_MS });
      } else if (event.key.length === 1) {
        buffer += event.key;
        if (buffer.length > SCANNER_CONFIG.MAX_QR_LENGTH + 50) {
          buffer = ''; onInvalidInput?.('Lectura demasiado larga. Revisa el formato del carnet.');
        }
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [enabled, entranceId, scanners, onScan, onInvalidInput]);
  return null;
}
