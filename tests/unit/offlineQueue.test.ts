import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeLocalDB, getLocalDB } from '@/lib/localDb';
import { enqueueScan, getPendingCount, getPendingScans, syncOfflineQueue, exportLocalRecords } from '@/lib/offlineQueue';
import { hashScanCommand } from '@/lib/scanContract';
import { MOCK_STUDENTS } from '@/lib/mockData';
import type { ApiScanRequest } from '@/types/attendance';

const input = () => ({ scanId: crypto.randomUUID(), qrCode: '72345678', qrSignature: 'signature123',
  timestamp: new Date().toISOString(), scannerId: 'N1', entranceId: 'NORTE', isBurst: false });
async function accepted(_url: unknown, init?: RequestInit) {
  const body = JSON.parse(init?.body as string) as ApiScanRequest;
  return Response.json({ ok: true, scan_id: crypto.randomUUID(), client_scan_id: body.client_scan_id,
    payload_hash: await hashScanCommand(body), persistence: 'memory-demo', attendance_status: 'ON_TIME',
    is_burst: body.is_burst, student: MOCK_STUDENTS[0], message: 'demo', server_timestamp: new Date().toISOString() });
}
beforeEach(async () => { await closeLocalDB(); vi.stubGlobal('indexedDB', new IDBFactory()); });
afterEach(async () => { await closeLocalDB(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('durable local outbox', () => {
  it('persists one capture ID, origin and hash before any network request', async () => {
    const send = vi.fn(accepted); vi.stubGlobal('fetch', send);
    const capture = input(); await enqueueScan(capture);
    expect(send).not.toHaveBeenCalled();
    expect((await getPendingScans())[0]).toMatchObject({ ...capture, state: 'PENDING' });
    expect((await getPendingScans())[0].payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await enqueueScan(capture)).toMatchObject({ scanId: capture.scanId });
    expect(await getPendingCount()).toBe(1);
    await expect(enqueueScan({ ...capture, qrCode: '71234567' })).rejects.toThrow();
  });

  it('retains the record after more than three server failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    const capture = input(); await enqueueScan(capture);
    for (let n = 0; n < 4; n++) await syncOfflineQueue({ force: true });
    expect(await getPendingCount()).toBe(1);
    expect((await getPendingScans())[0]).toMatchObject({ scanId: capture.scanId, retryCount: 4, state: 'RETRY' });
  });

  it.each([403, 409, 422])('keeps HTTP %i in review/rejection without treating it as synchronized', async (status) => {
    const send = vi.fn(async () => Response.json({ ok: false }, { status })); vi.stubGlobal('fetch', send);
    await enqueueScan(input()); const result = await syncOfflineQueue();
    expect(result.synced).toBe(0); expect(result.remaining).toBe(1);
    expect((await getPendingScans())[0].state).toBe(status === 422 ? 'REJECTED' : 'REVIEW');
    await syncOfflineQueue({ force: true }); expect(send).toHaveBeenCalledTimes(1);
  });

  it('only accepts an ACK matching the original ID and command hash and retains a recoverable local copy', async () => {
    vi.stubGlobal('fetch', vi.fn(accepted)); const capture = input(); await enqueueScan(capture);
    expect((await syncOfflineQueue()).synced).toBe(1); expect(await getPendingCount()).toBe(0);
    const db = await getLocalDB(); const record = await db.getFromIndex('pending_scans', 'by_scanId', capture.scanId);
    expect(record).toMatchObject({ ...capture, state: 'ACKED', acknowledgement: { persistence: 'memory-demo' } });
    expect((await db.get('recent_scans', capture.scanId))?.status).toBe('WARNING');
  });

  it.each(['wrong-id', 'wrong-hash', 'wrong-student', 'missing-ack'])('does not confirm a %s response', async (mode) => {
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      const data = await (await accepted(url, init)).json();
      if (mode === 'wrong-id') data.client_scan_id = crypto.randomUUID();
      if (mode === 'wrong-hash') data.payload_hash = '0'.repeat(64);
      if (mode === 'wrong-student') data.student.dni = '71234567';
      if (mode === 'missing-ack') delete data.payload_hash;
      return Response.json(data);
    }));
    await enqueueScan(input()); const result = await syncOfflineQueue();
    expect(result.synced).toBe(0); expect((await getPendingScans())[0].state).toBe('REVIEW');
  });

  it('pauses the whole queue on 401 until explicitly resumed', async () => {
    const send = vi.fn(async () => new Response('', { status: 401 })); vi.stubGlobal('fetch', send);
    await enqueueScan(input()); await syncOfflineQueue(); await syncOfflineQueue();
    expect(send).toHaveBeenCalledTimes(1); expect((await getPendingScans())[0].state).toBe('BLOCKED_AUTH');
    vi.stubGlobal('fetch', vi.fn(accepted)); expect((await syncOfflineQueue({ resumeAuth: true })).synced).toBe(1);
  });

  it('obeys Retry-After rather than repeatedly using a limited service', async () => {
    const send = vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    vi.stubGlobal('fetch', send); await enqueueScan(input()); await syncOfflineQueue();
    expect((await getPendingScans())[0].nextAttemptAt).toBeGreaterThan(Date.now() + 110_000);
    await syncOfflineQueue({ force: true }); expect(send).toHaveBeenCalledTimes(1);
  });

  it('coalesces simultaneous sync calls', async () => {
    const send = vi.fn(accepted); vi.stubGlobal('fetch', send); await enqueueScan(input());
    const first = syncOfflineQueue(); const second = syncOfflineQueue(); expect(first).toBe(second);
    await Promise.all([first, second]); expect(send).toHaveBeenCalledTimes(1);
  });

  it('honors a different tab lease and recovers an expired one', async () => {
    const send = vi.fn(accepted); vi.stubGlobal('fetch', send); await enqueueScan(input());
    const db = await getLocalDB(); await db.put('locks', { key: 'outbox-sync', owner: 'other-tab', expiresAt: Date.now() + 30_000 });
    expect((await syncOfflineQueue()).remaining).toBe(1); expect(send).not.toHaveBeenCalled();
    await db.put('locks', { key: 'outbox-sync', owner: 'crashed-tab', expiresAt: Date.now() - 1 });
    expect((await syncOfflineQueue()).synced).toBe(1);
  });

  it('retains records and IDs through connection close/reopen and export', async () => {
    const capture = input(); await enqueueScan(capture); await closeLocalDB();
    expect((await getPendingScans())[0].scanId).toBe(capture.scanId);
    const copy = JSON.parse(await exportLocalRecords());
    expect(copy).toMatchObject({ format: 'sca-qr-local-export', version: 1 });
    expect(copy.records[0]).toMatchObject({ ...capture, state: 'PENDING' });
    expect(await getPendingCount()).toBe(1);
  });

  it('does not overwrite existing captures when the unresolved queue reaches capacity', async () => {
    const db = await getLocalDB();
    const tx = db.transaction('pending_scans', 'readwrite');
    for (let n = 0; n < 5_000; n++) await tx.store.add({ ...input(), retryCount: 0, state: 'PENDING' });
    await tx.done;
    await expect(enqueueScan(input())).rejects.toThrow('cola está llena');
    expect(await getPendingCount()).toBe(5_000);
  });

  it('limits presentation history while retaining all original captures and receipts', async () => {
    vi.stubGlobal('fetch', vi.fn(accepted));
    for (let n = 0; n < 12; n++) await enqueueScan(input());
    expect((await syncOfflineQueue()).synced).toBe(12);
    const db = await getLocalDB();
    expect(await db.count('recent_scans')).toBe(10);
    expect(await db.count('pending_scans')).toBe(12);
  });
});
