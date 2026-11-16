'use client';

import { useEffect, useRef, useCallback } from 'react';
import { SCANNER_CONFIG } from '@/lib/constants';

interface ScannerInputProps {
  onScan: (qrCode: string, isBurst: boolean) => void;
  enabled?: boolean;
}

export default function ScannerInput({ onScan, enabled = true }: ScannerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef<string>('');
  const lastScanTime = useRef<number>(0);

  const keepFocus = useCallback(() => {
    if (!enabled) return;
    const active = document.activeElement;
    // No robar foco si el usuario está en otro input (búsqueda manual)
    if (active && active.tagName === 'INPUT' && active !== inputRef.current) return;
    if (active === inputRef.current) return;
    inputRef.current?.focus();
  }, [enabled]);

  useEffect(() => {
    keepFocus();
    const events: (keyof WindowEventMap)[] = ['click', 'keydown', 'focusout'];
    events.forEach((e) => window.addEventListener(e, keepFocus));
    return () => {
      events.forEach((e) => window.removeEventListener(e, keepFocus));
    };
  }, [keepFocus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!enabled) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        const code = bufferRef.current.trim();
        bufferRef.current = '';
        if (e.currentTarget) e.currentTarget.value = '';

        if (!code) return;

        const now = Date.now();
        const diff = now - lastScanTime.current;
        lastScanTime.current = now;

        const isBurst = diff > 0 && diff < SCANNER_CONFIG.BURST_THRESHOLD_MS;
        onScan(code, isBurst);
        return;
      }

      // Acumular caracteres imprimibles
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    },
    [enabled, onScan],
  );

  return (
    <input
      ref={inputRef}
      type="text"
      onKeyDown={handleKeyDown}
      className="sr-only"
      autoFocus
      autoComplete="off"
      spellCheck={false}
      tabIndex={-1}
      aria-label="Capturador de código QR"
    />
  );
}
