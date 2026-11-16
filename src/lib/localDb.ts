import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { STORAGE_KEYS } from './constants';
import type { PendingScan, RecentScan, Student } from '@/types/attendance';

export const LOCAL_DB_VERSION = 4;

export interface LocalSchema extends DBSchema {
  pending_scans: {
    key: number;
    value: PendingScan;
    indexes: { by_scanId: string; by_timestamp: string; by_state: string };
  };
  recent_scans: { key: string; value: RecentScan };
  students: {
    key: string;
    value: Student;
    indexes: { by_dni: string; by_fullName: string };
  };
  metadata: { key: string; value: { key: string; value: number | string } };
  locks: { key: string; value: { key: string; owner: string; expiresAt: number } };
}

let connection: Promise<IDBPDatabase<LocalSchema>> | undefined;

function notifyStorageError() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('sca-storage-error'));
}

export function getLocalDB(): Promise<IDBPDatabase<LocalSchema>> {
  if (connection) return connection;
  let abandoned = false;
  let timer: ReturnType<typeof setTimeout>;
  const opening = openDB<LocalSchema>(STORAGE_KEYS.DB_NAME, LOCAL_DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, tx) {
      // Earlier versions created disjoint subsets. Check every store, never erase the database.
      if (!db.objectStoreNames.contains('pending_scans')) {
        const store = db.createObjectStore('pending_scans', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_scanId', 'scanId', { unique: true });
        store.createIndex('by_timestamp', 'timestamp');
      }
      if (!db.objectStoreNames.contains('recent_scans')) db.createObjectStore('recent_scans', { keyPath: 'scanId' });
      if (!db.objectStoreNames.contains('students')) {
        const store = db.createObjectStore('students', { keyPath: 'id' });
        store.createIndex('by_dni', 'dni', { unique: true });
        store.createIndex('by_fullName', 'fullName');
      }
      if (!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('locks')) db.createObjectStore('locks', { keyPath: 'key' });
      const pending = tx.objectStore('pending_scans');
      if (!pending.indexNames.contains('by_state')) pending.createIndex('by_state', 'state');
      // Preserve legacy IDs and payloads. Their missing origin requires review, not invented metadata.
      void (async () => {
        let cursor = await tx.objectStore('pending_scans').openCursor();
        while (cursor) {
          if (!cursor.value.state) {
            await cursor.update({ ...cursor.value, state: 'REVIEW', nextAttemptAt: 0,
              lastError: 'LEGACY_CONTEXT_MISSING' });
          }
          cursor = await cursor.continue();
        }
      })().catch(() => tx.abort());
    },
    blocked: notifyStorageError,
    blocking() {
      void opening.then((db) => db.close());
      connection = undefined;
      notifyStorageError();
    },
    terminated() { connection = undefined; notifyStorageError(); },
  });
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abandoned = true;
      reject(new Error('Almacenamiento bloqueado. Cierra las otras pestañas de SCA-QR e inténtalo de nuevo.'));
    }, 5_000);
  });
  void opening.then((db) => { if (abandoned) db.close(); }).catch(() => {});
  connection = Promise.race([opening, timeout]).catch((error: unknown) => {
    connection = undefined;
    notifyStorageError();
    throw error;
  }).finally(() => clearTimeout(timer));
  return connection;
}

export async function closeLocalDB(): Promise<void> {
  if (connection) (await connection).close();
  connection = undefined;
}
