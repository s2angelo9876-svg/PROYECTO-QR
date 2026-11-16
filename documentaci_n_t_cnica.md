# PLAN DE IMPLEMENTACIÓN TÉCNICA - MÓDULO PWA
## Sistema de Control de Asistencia Escolar con QR (SCA-QR)

---

### 1. ESTRUCTURA COMPLETA DEL PROYECTO

La Progressive Web App (PWA) se desarrolla sobre **Next.js (App Router)**, **TypeScript** y **Tailwind CSS**. La arquitectura desacopla la intercepción del hardware, la resiliencia offline en IndexedDB y el renderizado visual adaptativo.

```text
/src
  ├── /app
  │     ├── /ingreso
  │     │     └── page.tsx           <-- Pantalla principal de portería (PWA)
  │     ├── layout.tsx
  │     └── page.tsx
  ├── /components
  │     ├── ScannerInput.tsx         <-- Capturador invisible del lector USB
  │     └── StudentDisplay.tsx       <-- Tarjeta con foto, datos y alertas
  ├── /lib
  │     ├── offlineQueue.ts          <-- Gestor de colas en IndexedDB (sin red)
  │     └── audio.ts                 <-- Reproductor de efectos de sonido
  └── /public
        ├── manifest.json            <-- Configuración instalable PWA
        └── /sounds
              ├── success.mp3
              ├── warning.mp3
              └── error.mp3
```

---

### 2. CÓDIGO FUENTE E IMPLEMENTACIÓN PASO A PASO

#### Paso 1: Configuración de PWA (`public/manifest.json`)
Permite instalar el aplicativo como software nativo en pantalla completa dentro de la laptop de portería.

```json
{
  "name": "SCA-QR Control de Ingreso",
  "short_name": "SCA-QR",
  "description": "Sistema de Control de Asistencia Escolar en Puerta",
  "start_url": "/ingreso",
  "display": "fullscreen",
  "background_color": "#0f172a",
  "theme_color": "#0288d1",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

#### Paso 2: Gestor de Sonidos (`src/lib/audio.ts`)
Gestión precargada en memoria para la reproducción instantánea de respuestas audibles.

```typescript
type SoundType = 'success' | 'warning' | 'error';

class SoundManager {
  private sounds: Record<SoundType, HTMLAudioElement | null> = {
    success: null,
    warning: null,
    error: null,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.sounds.success = new Audio('/sounds/success.mp3');
      this.sounds.warning = new Audio('/sounds/warning.mp3');
      this.sounds.error = new Audio('/sounds/error.mp3');
    }
  }

  play(type: SoundType) {
    const audio = this.sounds[type];
    if (audio) {
      audio.currentTime = 0; // Reinicia el audio para lecturas continuas
      audio.play().catch(() => {
        console.warn('El navegador bloqueó la reproducción automática de audio.');
      });
    }
  }
}

export const soundManager = new SoundManager();
```

---

#### Paso 3: Cola de Contingencia Offline (`src/lib/offlineQueue.ts`)
Persistencia local en `IndexedDB` para capturar marcaciones sin interrupciones si el Wi-Fi escolar se desconecta.

```typescript
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'SCA_OFFLINE_DB';
const STORE_NAME = 'pending_scans';

export interface PendingScan {
  id?: number;
  qrCode: string;
  isBurst: boolean;
  timestamp: string;
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

// Guardar marcación localmente cuando no hay servidor/red disponible
export async function saveScanOffline(qrCode: string, isBurst: boolean): Promise<void> {
  const db = await getDB();
  await db.add(STORE_NAME, {
    qrCode,
    isBurst,
    timestamp: new Date().toISOString(),
  });
}

// Sincronizar registros locales hacia la API centralizada al detectar red
export async function syncOfflineQueue(): Promise<number> {
  const db = await getDB();
  const pendingScans: PendingScan[] = await db.getAll(STORE_NAME);

  if (pendingScans.length === 0) return 0;

  let syncedCount = 0;

  for (const scan of pendingScans) {
    try {
      const res = await fetch('/api/attendances/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code: scan.qrCode,
          is_burst: scan.isBurst,
          offline_timestamp: scan.timestamp,
        }),
      });

      if (res.ok && scan.id) {
        await db.delete(STORE_NAME, scan.id);
        syncedCount++;
      }
    } catch {
      // Si la conexión falla nuevamente, interrumpe hasta la próxima reconexión
      break;
    }
  }

  return syncedCount;
}
```

---

#### Paso 4: Capturador Invisible del Lector USB (`src/components/ScannerInput.tsx`)
Intercepta las lecturas del escáner en modo teclado USB HID, retiene el foco activo y ejecuta la regla anti-suplantación.

```tsx
'use client';

import { useEffect, useRef } from 'react';

interface ScannerInputProps {
  onScan: (qrCode: string, isBurst: boolean) => void;
}

export default function ScannerInput({ onScan }: ScannerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanTime = useRef<number>(0);

  useEffect(() => {
    // Foco persistente sobre el input invisible
    const keepFocus = () => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    };

    keepFocus();
    window.addEventListener('click', keepFocus);
    window.addEventListener('keydown', keepFocus);

    return () => {
      window.removeEventListener('click', keepFocus);
      window.removeEventListener('keydown', keepFocus);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const code = e.currentTarget.value.trim();
      if (!code) return;

      e.currentTarget.value = ''; // Limpiar buffer de entrada inmediatamente

      const now = Date.now();
      const timeDiff = (now - lastScanTime.current) / 1000; // segundos
      lastScanTime.current = now;

      // REGLA ANTI-SUPLANTACIÓN: Detección de ráfaga en < 2.5 segundos
      const isBurst = timeDiff > 0 && timeDiff < 2.5;

      onScan(code, isBurst);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      onKeyDown={handleKeyDown}
      className="opacity-0 absolute pointer-events-none -top-40 -left-40"
      autoFocus
      autoComplete="off"
      aria-hidden="true"
    />
  );
}
```

---

#### Paso 5: Componente de Renderizado Visual (`src/components/StudentDisplay.tsx`)
Renderiza las credenciales del estudiante e indicadores de estado.

```tsx
'use client';

export interface ScanResult {
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
  student?: {
    firstName: string;
    lastName: string;
    grade: string;
    section: string;
    shift: string;
    photoUrl: string;
  };
  timestamp?: string;
  isOffline?: boolean;
}

export default function StudentDisplay({ result }: { result: ScanResult }) {
  const styles = {
    SUCCESS: 'bg-emerald-950/90 border-emerald-500 text-emerald-100',
    WARNING: 'bg-amber-950/90 border-amber-500 text-amber-100 animate-bounce',
    ERROR: 'bg-rose-950/90 border-rose-500 text-rose-100',
  };

  return (
    <div className={`w-full max-w-2xl border-4 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-md transition-all ${styles[result.status]}`}>
      {result.isOffline && (
        <span className="inline-block bg-slate-800 text-amber-400 text-xs font-bold px-3 py-1 rounded-full mb-4">
          Modo Local (Sin Red - Se sincronizará al volver la conexión)
        </span>
      )}

      <h2 className="text-3xl font-black uppercase tracking-wider mb-6">
        {result.message}
      </h2>

      {result.student && (
        <div className="flex flex-col items-center gap-4">
          <img
            src={result.student.photoUrl || '/placeholder-student.png'}
            alt="Foto del estudiante"
            className="w-56 h-56 rounded-full border-4 border-white object-cover shadow-2xl"
          />
          <h1 className="text-4xl font-extrabold tracking-tight">
            {result.student.firstName} {result.student.lastName}
          </h1>
          <p className="text-2xl text-slate-300">
            {result.student.grade} • Secc. "{result.student.section}"
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="bg-white/10 px-4 py-1.5 rounded-full text-sm font-semibold">
              Turno: {result.student.shift}
            </span>
            <span className="bg-white/10 px-4 py-1.5 rounded-full text-sm font-semibold">
              Hora: {result.timestamp}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

#### Paso 6: Pantalla Principal de Entrada (`src/app/ingreso/page.tsx`)
Consolida el escaneo, temporizadores de vaciado automático, soporte de red y alertas audibles.

```tsx
'use client';

import { useState, useEffect } from 'react';
import ScannerInput from '@/components/ScannerInput';
import StudentDisplay, { ScanResult } from '@/components/StudentDisplay';
import { soundManager } from '@/lib/audio';
import { saveScanOffline, syncOfflineQueue } from '@/lib/offlineQueue';

export default function IngresoPage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Monitor de conectividad y sincronización background
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = async () => {
      setIsOnline(true);
      const synced = await syncOfflineQueue();
      if (synced > 0) {
        console.log(`Sincronizados ${synced} registros retenidos en local.`);
      }
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Temporizador para restaurar el estado de espera tras 4 segundos
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(timer);
  }, [result]);

  const handleScan = async (qrCode: string, isBurst: boolean) => {
    const nowTime = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Procesamiento offline en IndexedDB si no hay conexión de red
    if (!navigator.onLine) {
      await saveScanOffline(qrCode, isBurst);
      soundManager.play(isBurst ? 'warning' : 'success');
      setResult({
        status: isBurst ? 'WARNING' : 'SUCCESS',
        message: isBurst ? '⚠️ ALERTA: Verificación Manual (Modo Offline)' : 'REGISTRO LOCAL ALMACENADO',
        timestamp: nowTime,
        isOffline: true,
      });
      return;
    }

    // Petición estándar hacia el API Backend
    try {
      const res = await fetch('/api/attendances/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code: qrCode, is_burst: isBurst }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.is_burst) {
          soundManager.play('warning');
          setResult({
            status: 'WARNING',
            message: '⚠️ ALERTA: Posible Suplantación (Lectura Ráfaga)',
            student: data.student,
            timestamp: nowTime,
          });
        } else {
          soundManager.play('success');
          setResult({
            status: 'SUCCESS',
            message: `ENTRADA REGISTRADA (${data.attendance_status})`,
            student: data.student,
            timestamp: nowTime,
          });
        }
      } else {
        soundManager.play('error');
        setResult({
          status: 'ERROR',
          message: data.message || 'Código QR no reconocido',
        });
      }
    } catch {
      // Captura de caída abrupta de red durante la transmisión
      await saveScanOffline(qrCode, isBurst);
      soundManager.play('warning');
      setResult({
        status: 'WARNING',
        message: 'Conexión interrumpida: Marcación guardada en local',
        timestamp: nowTime,
        isOffline: true,
      });
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <ScannerInput onScan={handleScan} />

      {/* Indicador de Estado de Conectividad */}
      <div className="absolute top-6 right-6 flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full bg-slate-900 border border-slate-800">
        <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
        {isOnline ? 'CONECTADO AL SERVIDOR' : 'MODO OFFLINE ACTIVO'}
      </div>

      <header className="mb-12 text-center">
        <h1 className="text-4xl font-black tracking-tight text-sky-400 mb-2">
          SCA-QR • CONTROL DE INGRESO
        </h1>
        <p className="text-slate-400 text-sm">
          Pase el carnet del alumno frente al lector de código QR
        </p>
      </header>

      {!result ? (
        <div className="border-2 border-dashed border-slate-800 rounded-3xl p-16 text-center max-w-lg w-full flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 text-2xl animate-pulse">
            📷
          </div>
          <p className="text-slate-500 font-medium">Esperando lectura del carnet...</p>
        </div>
      ) : (
        <StudentDisplay result={result} />
      )}
    </main>
  );
}
```

---

### 3. PASOS DE VERIFICACIÓN Y PRUEBAS

1. **Instalación de Dependencias:**
   ```bash
   npm install idb
   ```
2. **Ubicación de Assets:**
   * Guardar los efectos de sonido `success.mp3`, `warning.mp3` y `error.mp3` en la carpeta `public/sounds/`.
3. **Prueba de Flujo Continuo:**
   * Escanear 5 carnets seguidos. Verificar el cambio de estado visual a **Verde**, el disparo del tono agudo y la limpieza automática en 4 segundos.
4. **Prueba Anti-Suplantación (Ráfaga):**
   * Escanear 2 carnets en un rango menor a 2.5 segundos. La segunda lectura debe activar el marco **Amarillo** de advertencia y sonar `warning.mp3`.
5. **Prueba de Resiliencia Offline:**
   * Desconectar la interfaz de red y escanear. La aplicación guardará la lectura en IndexedDB con la etiqueta `Modo Local`. Al restaurar la conexión, se sincronizarán las marcaciones automáticamente.