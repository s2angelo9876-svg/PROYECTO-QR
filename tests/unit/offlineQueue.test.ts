import { describe, it, expect } from 'vitest';
import { saveScanOffline, getPendingCount, getPendingScans } from '@/lib/offlineQueue';

describe('offlineQueue', { timeout: 15_000 }, () => {
  it('guarda un scan con UUID único', async () => {
    const scanId = await saveScanOffline('72345678', 'signature123', false);
    expect(scanId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await getPendingCount()).toBeGreaterThanOrEqual(1);
  });

  it('lista scans pendientes', async () => {
    await saveScanOffline('A1', 's1', false);
    await saveScanOffline('B2', 's2', true);
    const pending = await getPendingScans();
    expect(pending.length).toBeGreaterThanOrEqual(2);
  });

  it('maneja ráfagas correctamente', async () => {
    await saveScanOffline('X1', 'sx', true);
    const pending = await getPendingScans();
    const burst = pending.find((p) => p.qrCode === 'X1');
    expect(burst?.isBurst).toBe(true);
  });
});
