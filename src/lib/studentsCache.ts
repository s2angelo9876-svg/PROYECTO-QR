import { openDB, type IDBPDatabase } from 'idb';
import type { Student } from '@/types/attendance';
import { STORAGE_KEYS } from './constants';

async function getDB(): Promise<IDBPDatabase> {
  return openDB(STORAGE_KEYS.DB_NAME, 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('students')) {
          const store = db.createObjectStore('students', { keyPath: 'id' });
          store.createIndex('by_dni', 'dni', { unique: true });
          store.createIndex('by_fullName', 'fullName');
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      }
    },
  });
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export interface StudentsCacheInfo {
  count: number;
  ageMs: number | null;
  isStale: boolean;
  lastFetchedAt: string | null;
}

export async function saveStudentsToCache(students: Student[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['students', 'metadata'], 'readwrite');
  const store = tx.objectStore('students');
  await store.clear();
  for (const s of students) {
    await store.put(s);
  }
  await tx.objectStore('metadata').put({
    key: 'students_fetched_at',
    value: Date.now(),
  });
  await tx.done;
}

export async function getStudentFromCache(dni: string): Promise<Student | undefined> {
  try {
    const db = await getDB();
    return db.getFromIndex('students', 'by_dni', dni);
  } catch {
    return undefined;
  }
}

export async function getAllStudentsFromCache(): Promise<Student[]> {
  try {
    const db = await getDB();
    return db.getAll('students');
  } catch {
    return [];
  }
}

export async function getCacheInfo(): Promise<StudentsCacheInfo> {
  try {
    const db = await getDB();
    const count = await db.count('students');
    const meta = await db.get('metadata', 'students_fetched_at');
    if (!meta) {
      return { count, ageMs: null, isStale: true, lastFetchedAt: null };
    }
    const ageMs = Date.now() - (meta as { value: number }).value;
    return {
      count,
      ageMs,
      isStale: ageMs > CACHE_TTL_MS,
      lastFetchedAt: new Date((meta as { value: number }).value).toISOString(),
    };
  } catch {
    return { count: 0, ageMs: null, isStale: true, lastFetchedAt: null };
  }
}

export async function isStudentCacheValid(): Promise<boolean> {
  const info = await getCacheInfo();
  return info.count > 0 && !info.isStale;
}

export async function refreshStudentsCache(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const res = await fetch('/api/students');
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.students)) {
      return { ok: false, error: 'Invalid response' };
    }
    await saveStudentsToCache(data.students);
    return { ok: true, count: data.students.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
