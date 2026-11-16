import { getLocalDB as getDB } from './localDb';
import { StudentSchema } from './scanContract';
import { z } from 'zod';
import type { Student } from '@/types/attendance';

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
  const db = await getDB();
  return db.getFromIndex('students', 'by_dni', dni);
}

export async function getAllStudentsFromCache(): Promise<Student[]> {
  const db = await getDB();
  return db.getAll('students');
}

export async function getCacheInfo(): Promise<StudentsCacheInfo> {
  const db = await getDB();
  const count = await db.count('students');
  const meta = await db.get('metadata', 'students_fetched_at');
  if (!meta) {
    return { count, ageMs: null, isStale: true, lastFetchedAt: null };
  }
  const ageMs = Date.now() - Number(meta.value);
  return {
    count,
    ageMs,
    isStale: !Number.isFinite(ageMs) || ageMs < 0 || ageMs > CACHE_TTL_MS,
    lastFetchedAt: Number.isFinite(Number(meta.value)) ? new Date(Number(meta.value)).toISOString() : null,
  };

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
    const students = z.array(StudentSchema).max(10_000).parse(data.students);
    await saveStudentsToCache(students);
    return { ok: true, count: data.students.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
