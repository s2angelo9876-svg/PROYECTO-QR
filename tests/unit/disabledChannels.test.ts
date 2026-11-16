import { afterEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/notifications/email/route';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('does not contact email services or claim delivery when the channel is disabled', async () => {
  vi.stubEnv('SCA_EMAIL_ENABLED', 'false'); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const response = await POST(new NextRequest('http://localhost/api/notifications/email', { method: 'POST' }));
  expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ ok: false, code: 'CHANNEL_DISABLED' });
  expect(fetcher).not.toHaveBeenCalled();
});
