import { afterEach, describe, it, expect, vi } from 'vitest';
import { safeLoginRedirect } from '@/lib/safeRedirect';
import { signToken, verifyToken } from '@/lib/authToken';
import { SignJWT } from 'jose';

afterEach(() => vi.unstubAllEnvs());
describe('login boundary', () => {
  it.each(['javascript:alert(1)', 'data:text/html,test', '//example.com', 'https://example.com',
    '/admin/dashboard?next=javascript:alert(1)', '/\\example.com', '/admin/login', null])('rejects unsafe destination %s', (value) => {
    expect(safeLoginRedirect(value)).toBe('/admin/dashboard');
  });
  it.each(['/admin/dashboard', '/admin/scans', '/admin/reports', '/ingreso'])('accepts known destination %s', (path) => {
    expect(safeLoginRedirect(path)).toBe(path);
  });
  it('does not create sessions without an independently configured secret', async () => {
    vi.stubEnv('JWT_SECRET', '');
    await expect(signToken({ id: '1', username: 'admin', fullName: 'Demo', role: 'admin' })).rejects.toThrow();
    expect(await verifyToken('bad')).toBeNull();
  });
  it('verifies audience, issuer, expiration and user role', async () => {
    const user = { id: '1', username: 'admin', fullName: 'Demo', role: 'admin' as const };
    expect((await verifyToken(await signToken(user)))?.user).toEqual(user);
    const token = await new SignJWT({ user }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
      .setIssuer('other-system').setAudience('sca-qr-admin').sign(new TextEncoder().encode(process.env.JWT_SECRET));
    expect(await verifyToken(token)).toBeNull();
  });
});
