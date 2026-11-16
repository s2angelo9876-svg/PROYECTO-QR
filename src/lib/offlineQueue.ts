import { getLocalDB, LOCAL_DB_VERSION } from './localDb';
import { SYNC_CONFIG, UI_CONFIG } from './constants';
import { hashScanCommand, ScanAckSchema, ScanCommandSchema } from './scanContract';
import type { ApiScanRequest, ApiScanSuccess, PendingScan, RecentScan } from '@/types/attendance';

export const OUTBOX_EVENT = 'sca-outbox-change';
const UNRESOLVED = ['PENDING', 'SENDING', 'RETRY', 'BLOCKED_AUTH', 'REVIEW', 'REJECTED'] as const;

function notifyChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OUTBOX_EVENT));
  if ('BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel('sca-outbox');
      channel.postMessage('changed');
      channel.close();
    } catch { /* Storage state is authoritative even when cross-tab notifications are unavailable. */ }
  }
}

function toCommand(scan: PendingScan): ApiScanRequest {
  return {
    qr_code: scan.qrCode, qr_signature: scan.qrSignature, is_burst: scan.isBurst,
    client_scan_id: scan.scanId, terminal_id: scan.terminalId,
    scanner_id: scan.scannerId, entrance_id: scan.entranceId, offline_timestamp: scan.timestamp,
  };
}

export async function enqueueScan(input: {
  scanId: string; qrCode: string; qrSignature: string; isBurst: boolean;
  timestamp: string; scannerId: string; entranceId: string;
}): Promise<PendingScan> {
  const db = await getLocalDB();
  const meta = db.transaction('metadata', 'readwrite');
  const current = await meta.store.get('terminal_id');
  const terminalId = typeof current?.value === 'string' ? current.value : crypto.randomUUID();
  if (typeof current?.value !== 'string') await meta.store.put({ key: 'terminal_id', value: terminalId });
  await meta.done;
  const scan: PendingScan = { ...input, terminalId, retryCount: 0, state: 'PENDING', nextAttemptAt: 0 };
  const command = ScanCommandSchema.parse(toCommand(scan));
  scan.payloadHash = await hashScanCommand(command);
  const tx = db.transaction('pending_scans', 'readwrite');
  const existing = await tx.store.index('by_scanId').get(scan.scanId);
  if (existing) {
    if (existing.payloadHash !== scan.payloadHash) throw new Error('El identificador ya pertenece a otra marcación.');
    await tx.done;
    return existing;
  }
  let unresolved = 0;
  for (const state of UNRESOLVED) unresolved += await tx.store.index('by_state').count(state);
  if (unresolved >= SYNC_CONFIG.MAX_QUEUE_SIZE) {
    throw new Error('No se guardó la marcación: la cola está llena. Exporta una copia y contacta al responsable.');
  }
  scan.id = await tx.store.add(scan);
  await tx.done;
  notifyChange();
  return scan;
}

export async function getPendingCount(): Promise<number> {
  const db = await getLocalDB();
  const tx = db.transaction('pending_scans');
  let total = 0;
  for (const state of UNRESOLVED) total += await tx.store.index('by_state').count(state);
  await tx.done;
  return total;
}

export async function getPendingScans(): Promise<PendingScan[]> {
  const db = await getLocalDB();
  const tx = db.transaction('pending_scans');
  const scans: PendingScan[] = [];
  for (const state of UNRESOLVED) scans.push(...await tx.store.index('by_state').getAll(state));
  await tx.done;
  return scans.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.scanId.localeCompare(b.scanId));
}

export interface SyncEvent {
  scanId: string;
  state: NonNullable<PendingScan['state']>;
  acknowledgement?: ApiScanSuccess;
  reason?: string;
}
export interface SyncResult {
  synced: number; failed: number; remaining: number; errors: string[]; events: SyncEvent[];
}

async function lease(owner: string, release = false): Promise<boolean> {
  const db = await getLocalDB();
  const tx = db.transaction('locks', 'readwrite');
  const held = await tx.store.get('outbox-sync');
  if (release) {
    if (held?.owner === owner) await tx.store.delete('outbox-sync');
  } else {
    if (held && held.owner !== owner && held.expiresAt > Date.now()) { await tx.done; return false; }
    await tx.store.put({ key: 'outbox-sync', owner, expiresAt: Date.now() + SYNC_CONFIG.LEASE_MS });
  }
  await tx.done;
  return true;
}

async function updateScan(scan: PendingScan, patch: Partial<PendingScan>) {
  const db = await getLocalDB();
  const tx = db.transaction('pending_scans', 'readwrite');
  const current = await tx.store.index('by_scanId').get(scan.scanId);
  if (!current) throw new Error('No se encontró la copia local de la marcación.');
  await tx.store.put({ ...current, ...patch });
  await tx.done;
  notifyChange();
}

function retryDelay(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(delay) && delay > 0) return delay;
  }
  return Math.min(SYNC_CONFIG.RETRY_MAX_MS, SYNC_CONFIG.RETRY_BASE_MS * 2 ** Math.min(attempt, 10))
    * (0.75 + Math.random() * 0.5);
}

async function sendScan(scan: PendingScan): Promise<SyncEvent> {
  const command = toCommand(scan);
  if (!ScanCommandSchema.safeParse(command).success || !scan.payloadHash ||
    await hashScanCommand(command) !== scan.payloadHash) {
    await updateScan(scan, { state: 'REVIEW', lastError: 'LOCAL_PAYLOAD_MISMATCH' });
    return { scanId: scan.scanId, state: 'REVIEW', reason: 'LOCAL_PAYLOAD_MISMATCH' };
  }
  await updateScan(scan, { state: 'SENDING' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYNC_CONFIG.SYNC_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch('/api/attendances/scan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command), signal: controller.signal, cache: 'no-store',
    });
    if (response.ok) {
      const ack = ScanAckSchema.safeParse(await response.json());
      if (!ack.success || ack.data.client_scan_id !== scan.scanId || ack.data.payload_hash !== scan.payloadHash ||
        ack.data.student.dni !== scan.qrCode) {
        await updateScan(scan, { state: 'REVIEW', lastError: 'ACK_MISMATCH' });
        return { scanId: scan.scanId, state: 'REVIEW', reason: 'ACK_MISMATCH' };
      }
      const db = await getLocalDB();
      const tx = db.transaction(['pending_scans', 'recent_scans'], 'readwrite');
      const current = await tx.objectStore('pending_scans').index('by_scanId').get(scan.scanId);
      if (!current) throw new Error('LOCAL_RECORD_MISSING');
      // Retain the original command and ACK. The demo server is volatile; no automatic deletion.
      await tx.objectStore('pending_scans').put({ ...current, state: 'ACKED', acknowledgement: ack.data, lastError: undefined });
      await tx.objectStore('recent_scans').put({ scanId: scan.scanId, studentName: ack.data.student.fullName,
        status: ack.data.persistence === 'durable' && !ack.data.is_burst ? 'SUCCESS' : 'WARNING',
        timestamp: scan.timestamp, isOffline: false });
      const recent = (await tx.objectStore('recent_scans').getAll())
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      for (const item of recent.slice(UI_CONFIG.RECENT_SCANS_LIMIT)) {
        await tx.objectStore('recent_scans').delete(item.scanId);
      }
      await tx.done;
      notifyChange();
      return { scanId: scan.scanId, state: 'ACKED', acknowledgement: ack.data };
    }
  } catch {
    const attempt = scan.retryCount + 1;
    await updateScan(scan, { state: 'RETRY', retryCount: attempt, lastError: 'NETWORK_OR_RESPONSE_ERROR',
      nextAttemptAt: Date.now() + retryDelay(attempt, null) });
    return { scanId: scan.scanId, state: 'RETRY', reason: 'NETWORK_OR_RESPONSE_ERROR' };
  } finally {
    clearTimeout(timeout);
  }
  const state = response.status === 401 ? 'BLOCKED_AUTH'
    : response.status === 403 || response.status === 409 ? 'REVIEW'
    : [400, 404, 422].includes(response.status) ? 'REJECTED' : 'RETRY';
  const attempt = scan.retryCount + 1;
  const reason = `HTTP_${response.status}`;
  if (state === 'BLOCKED_AUTH') {
    const db = await getLocalDB();
    await db.put('metadata', { key: 'sync_auth_blocked', value: 1 });
  }
  await updateScan(scan, { state, retryCount: attempt, lastError: reason,
    nextAttemptAt: state === 'RETRY' ? Date.now() + retryDelay(attempt, response.headers.get('Retry-After')) : 0 });
  return { scanId: scan.scanId, state, reason };
}

let running: Promise<SyncResult> | undefined;
export function syncOfflineQueue(options: { force?: boolean; resumeAuth?: boolean } = {}): Promise<SyncResult> {
  if (running) return running;
  running = syncWithLease(options).finally(() => { running = undefined; });
  return running;
}

async function syncWithLease(options: { force?: boolean; resumeAuth?: boolean }): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, remaining: 0, errors: [], events: [] };
  const owner = crypto.randomUUID();
  if (!await lease(owner)) return { ...result, remaining: await getPendingCount() };
  try {
    const db = await getLocalDB();
    if (options.resumeAuth) await db.delete('metadata', 'sync_auth_blocked');
    else if (await db.get('metadata', 'sync_auth_blocked')) {
      return { ...result, remaining: await getPendingCount() };
    }
    const eligible = (await getPendingScans()).filter((scan) =>
      (['PENDING', 'SENDING', 'RETRY'].includes(scan.state || '') ||
        options.resumeAuth && scan.state === 'BLOCKED_AUTH') &&
      (options.force && scan.lastError !== 'HTTP_429' || (scan.nextAttemptAt || 0) <= Date.now()));
    // One bounded pass; subsequent passes continue in chronological order.
    for (const scan of eligible.slice(0, 20)) {
      if (!await lease(owner)) break;
      const event = await sendScan(scan);
      result.events.push(event);
      if (event.state === 'ACKED') result.synced++;
      else { result.failed++; if (event.reason) result.errors.push(event.reason); }
      if (event.state === 'BLOCKED_AUTH') break;
    }
    result.remaining = await getPendingCount();
    return result;
  } finally {
    await lease(owner, true);
  }
}

export async function saveRecentScan(scan: RecentScan): Promise<void> {
  const db = await getLocalDB();
  const tx = db.transaction('recent_scans', 'readwrite');
  await tx.store.put(scan);
  const all = (await tx.store.getAll()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  for (const item of all.slice(UI_CONFIG.RECENT_SCANS_LIMIT)) await tx.store.delete(item.scanId);
  await tx.done;
  notifyChange();
}

export async function getRecentScans(): Promise<RecentScan[]> {
  const db = await getLocalDB();
  return (await db.getAll('recent_scans')).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function exportLocalRecords(): Promise<string> {
  const db = await getLocalDB();
  return JSON.stringify({ format: 'sca-qr-local-export', version: 1, databaseVersion: LOCAL_DB_VERSION,
    exportedAt: new Date().toISOString(), records: await db.getAll('pending_scans') }, null, 2);
}
