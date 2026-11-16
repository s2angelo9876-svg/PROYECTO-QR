import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/attendances/scan/route';
import { clearAttendanceLog, getAttendanceLog } from '@/lib/mockData-exports';

const command = () => ({ client_scan_id: crypto.randomUUID(), terminal_id: crypto.randomUUID(),
  qr_code: '72345678', qr_signature: 'signature123', is_burst: false, scanner_id: 'N1', entrance_id: 'NORTE' });
const send = (body: unknown) => POST(new Request('http://localhost/api/attendances/scan', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));
beforeEach(() => clearAttendanceLog());
afterEach(() => vi.unstubAllEnvs());
describe('version-one demo ACK contract', () => {
  it('fails closed when the demo has not been explicitly enabled in production', async () => {
    vi.stubEnv('SCA_DEMO_MODE', 'false'); vi.stubEnv('NODE_ENV', 'production');
    expect((await send(command())).status).toBe(503); expect(getAttendanceLog()).toHaveLength(0);
  });
  it('rejects a foreign Origin before mutating state', async () => {
    const response = await POST(new Request('http://localhost/api/attendances/scan', { method: 'POST',
      headers: { Origin: 'https://foreign.example' }, body: JSON.stringify(command()) }));
    expect(response.status).toBe(403); expect(getAttendanceLog()).toHaveLength(0);
  });
  it('uses 400 for malformed JSON and bounds the body before schema validation', async () => {
    expect((await POST(new Request('http://localhost/api/attendances/scan', { method: 'POST', body: '{bad' }))).status).toBe(400);
    expect((await POST(new Request('http://localhost/api/attendances/scan', { method: 'POST', body: 'x'.repeat(8_193) }))).status).toBe(413);
  });
  it('returns a matching ACK for replays and rejects reuse with another payload', async () => {
    const data = command(); const first = await (await send(data)).json(); const second = await (await send(data)).json();
    expect(first).toMatchObject({ client_scan_id: data.client_scan_id, persistence: 'memory-demo' });
    expect(first.payload_hash).toMatch(/^[a-f0-9]{64}$/); expect(second).toMatchObject({ scan_id: first.scan_id, idempotent: true });
    expect((await send({ ...data, qr_code: '71234567' })).status).toBe(409); expect(getAttendanceLog()).toHaveLength(1);
  });
  it('cannot use burst=true to bypass duplicate detection', async () => {
    const data = command(); expect((await send(data)).status).toBe(200);
    expect((await send({ ...data, client_scan_id: crypto.randomUUID(), is_burst: true })).status).toBe(409);
  });
  it('serializes identical concurrent requests in the demo process', async () => {
    const data = command(); const responses = await Promise.all(Array.from({ length: 5 }, () => send(data)));
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]); expect(getAttendanceLog()).toHaveLength(1);
  });
  it('rejects suspended pupils and obviously future timestamps', async () => {
    expect((await send({ ...command(), qr_code: '74567890' })).status).toBe(403);
    expect((await send({ ...command(), offline_timestamp: '2099-01-01T00:00:00.000Z' })).status).toBe(422);
    expect(getAttendanceLog()).toHaveLength(0);
  });
});
