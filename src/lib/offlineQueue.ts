import { openDB, type IDBPDatabase } from 'idb';
import { STORAGE_KEYS, SYNC_CONFIG } from './constants';
import type { PendingScan, ApiScanRequest, ApiScanResponse } from '@/types/attendance';

async function getDB(): Promise<IDBPDatabase> {
  return openDB(STORAGE_KEYS.DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore(STORAGE_KEYS.STORE_PENDING, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by_scanId', 'scanId', { unique: true });
        store.createIndex('by_timestamp', 'timestamp');
      }
      if (oldVersion < 2) {
        db.createObjectStore(STORAGE_KEYS.STORE_RECENT, { keyPath: 'scanId' });
      }
    },
  });
}

export async function saveScanOffline(
  qrCode: string,
  qrSignature: string,
  isBurst: boolean,
): Promise<string> {
  const db = await getDB();
  const scanId = crypto.randomUUID();

  const count = await db.count(STORAGE_KEYS.STORE_PENDING);
  if (count >= SYNC_CONFIG.MAX_QUEUE_SIZE) {
    throw new Error('Cola offline llena. Conéctate a la red para sincronizar.');
  }

  await db.add(STORAGE_KEYS.STORE_PENDING, {
    scanId,
    qrCode,
    qrSignature,
    isBurst,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });

  return scanId;
}

export async function getPendingCount(): Promise<number> {
  try {
    const db = await getDB();
    return db.count(STORAGE_KEYS.STORE_PENDING);
  } catch {
    return 0;
  }
}

export async function getPendingScans(): Promise<PendingScan[]> {
  const db = await getDB();
  return db.getAll(STORAGE_KEYS.STORE_PENDING);
}

export interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
  errors: string[];
}

export async function syncOfflineQueue(): Promise<SyncResult> {
  const db = await getDB();
  const pending = await db.getAll(STORAGE_KEYS.STORE_PENDING);

  if (pending.length === 0) {
    return { synced: 0, failed: 0, remaining: 0, errors: [] };
  }

  // Procesar en batches para evitar saturar el servidor
  // cuando se recuperan muchos scans offline a la vez
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 500; // pausa entre batches

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((scan) => syncSingleScan(db, scan)),
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const scan = batch[j];
      if (r.status === 'fulfilled' && r.value.success) {
        if (scan.id) await db.delete(STORAGE_KEYS.STORE_PENDING, scan.id);
        synced++;
      } else {
        failed++;
        if (r.status === 'rejected') {
          errors.push(r.reason instanceof Error ? r.reason.message : 'Error');
        } else if (r.value.error) {
          errors.push(r.value.error);
        }
      }
    }

    // Pausa entre batches para no saturar
    if (i + BATCH_SIZE < pending.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  const remaining = await db.count(STORAGE_KEYS.STORE_PENDING);
  return { synced, failed, remaining, errors };
}

async function syncSingleScan(
  db: IDBPDatabase,
  scan: PendingScan,
): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SYNC_CONFIG.SYNC_TIMEOUT_MS,
    );

    const payload: ApiScanRequest = {
      qr_code: scan.qrCode,
      qr_signature: scan.qrSignature,
      is_burst: scan.isBurst,
      client_scan_id: scan.scanId,
      offline_timestamp: scan.timestamp,
    };

    const res = await fetch('/api/attendances/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as ApiScanResponse;
      if (data.ok) return { success: true };
    } else if (res.status === 409) {
      // Duplicado: ya está en servidor
      return { success: true };
    } else {
      await markRetry(db, scan, `HTTP ${res.status}`);
      return { success: false, error: `HTTP ${res.status}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    await markRetry(db, scan, msg);
    return { success: false, error: msg };
  }
  return { success: false };
}

async function markRetry(db: IDBPDatabase, scan: PendingScan, errorMsg: string) {
  if (!scan.id) return;
  const newRetryCount = scan.retryCount + 1;
  if (newRetryCount >= SYNC_CONFIG.MAX_RETRY_ATTEMPTS) {
    await db.delete(STORAGE_KEYS.STORE_PENDING, scan.id);
    console.warn(`[OfflineQueue] Scan descartado tras ${SYNC_CONFIG.MAX_RETRY_ATTEMPTS} reintentos:`, scan.scanId);
  } else {
    await db.put(STORAGE_KEYS.STORE_PENDING, {
      ...scan,
      retryCount: newRetryCount,
      lastError: errorMsg,
    });
  }
}

export async function saveRecentScan(scan: {
  scanId: string;
  studentName?: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  timestamp: string;
  isOffline: boolean;
}) {
  const db = await getDB();
  await db.put(STORAGE_KEYS.STORE_RECENT, scan);
  // Mantener solo los últimos N
  const tx = db.transaction(STORAGE_KEYS.STORE_RECENT, 'readwrite');
  const store = tx.objectStore(STORAGE_KEYS.STORE_RECENT);
  const all = await store.getAll();
  if (all.length > 10) {
    const sorted = all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const toDelete = sorted.slice(10);
    for (const item of toDelete) {
      await store.delete(item.scanId);
    }
  }
  await tx.done;
}

export async function getRecentScans() {
  try {
    const db = await getDB();
    const all = await db.getAll(STORAGE_KEYS.STORE_RECENT);
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch {
    return [];
  }
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await db.clear(STORAGE_KEYS.STORE_PENDING);
  await db.clear(STORAGE_KEYS.STORE_RECENT);
}
