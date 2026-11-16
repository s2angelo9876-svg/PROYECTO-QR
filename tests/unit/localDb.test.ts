import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { closeLocalDB, getLocalDB } from '@/lib/localDb';
import { getPendingScans, getPendingCount } from '@/lib/offlineQueue';
import { getCacheInfo, saveStudentsToCache } from '@/lib/studentsCache';
import { MOCK_STUDENTS } from '@/lib/mockData';

beforeEach(async () => { await closeLocalDB(); vi.stubGlobal('indexedDB', new IDBFactory()); });
afterEach(async () => { await closeLocalDB(); vi.unstubAllGlobals(); });

describe('non-destructive local migrations', () => {
  it.each([1, 2, 3])('opens legacy version %i without losing IDs or records', async (version) => {
    const scanId = crypto.randomUUID();
    const old = await openDB('SCA_OFFLINE_DB', version, { upgrade(db) {
      if (version < 3) {
        const s = db.createObjectStore('pending_scans', { keyPath: 'id', autoIncrement: true });
        s.createIndex('by_scanId', 'scanId', { unique: true }); s.createIndex('by_timestamp', 'timestamp');
        if (version === 2) db.createObjectStore('recent_scans', { keyPath: 'scanId' });
      } else {
        const s = db.createObjectStore('students', { keyPath: 'id' });
        s.createIndex('by_dni', 'dni', { unique: true }); s.createIndex('by_fullName', 'fullName');
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    } });
    if (version < 3) await old.add('pending_scans', { scanId, qrCode: '72345678', qrSignature: 'signature123',
      timestamp: new Date().toISOString(), retryCount: 2, isBurst: false });
    else await old.put('students', MOCK_STUDENTS[0]);
    old.close();
    const db = await getLocalDB();
    expect([...db.objectStoreNames]).toEqual(['locks', 'metadata', 'pending_scans', 'recent_scans', 'students']);
    if (version < 3) {
      const [record] = await getPendingScans();
      expect(record).toMatchObject({ scanId, retryCount: 2, state: 'REVIEW', lastError: 'LEGACY_CONTEXT_MISSING' });
      expect(await getPendingCount()).toBe(1);
    } else expect(await db.get('students', MOCK_STUDENTS[0].id)).toEqual(MOCK_STUDENTS[0]);
  });

  it('allows student cache and outbox to open concurrently in either order', async () => {
    await Promise.all([saveStudentsToCache(MOCK_STUDENTS), getPendingCount()]);
    expect((await getCacheInfo()).count).toBe(8);
    expect(await getPendingCount()).toBe(0);
  });

  it('reports unavailable storage instead of claiming zero pending records', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('storage unavailable'); } });
    await expect(getPendingCount()).rejects.toThrow();
  });

  it('bounds a blocked upgrade and allows recovery after the legacy tab closes', async () => {
    const old = await openDB('SCA_OFFLINE_DB', 1);
    try {
      await expect(getLocalDB()).rejects.toThrow('otras pestañas');
    } finally { old.close(); }
    const current = await getLocalDB();
    expect(current.version).toBe(4);
  }, 10_000);
});
