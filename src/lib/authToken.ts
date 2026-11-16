import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface AdminUser {
  id: string;
  username: string;
  role: 'admin' | 'director' | 'secretary';
  fullName: string;
  email?: string;
}
export interface AdminTokenPayload extends JWTPayload { user: AdminUser }

export function sessionConfigured(): boolean {
  return (process.env.JWT_SECRET?.length || 0) >= 32;
}

function secret(): Uint8Array {
  if (!sessionConfigured()) throw new Error('SESSION_CONFIGURATION_REQUIRED');
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function signToken(user: AdminUser): Promise<string> {
  return new SignJWT({ user }).setProtectedHeader({ alg: 'HS256' })
    .setIssuer('sca-qr').setAudience('sca-qr-admin').setIssuedAt()
    .setExpirationTime('12h').sign(secret());
}

export async function verifyToken(token: string): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ['HS256'], issuer: 'sca-qr', audience: 'sca-qr-admin', requiredClaims: ['exp', 'iat'],
    });
    const user = payload.user as Partial<AdminUser> | undefined;
    if (!user || typeof user.id !== 'string' || typeof user.username !== 'string' ||
      typeof user.fullName !== 'string' || !['admin', 'director', 'secretary'].includes(user.role || '')) return null;
    return payload as AdminTokenPayload;
  } catch (error) {
    if (process.env.SCA_AUTH_DIAGNOSTICS === 'true') {
      // Diagnostic classification only: never log the token, claims, secret or exception message.
      console.warn('[auth] TOKEN_REJECTED', error instanceof Error ? error.name : 'UNKNOWN');
    }
    return null;
  }
}
