import { NextResponse } from 'next/server';

export function demoGuard(): NextResponse | null {
  if (process.env.SCA_DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') return null;
  return NextResponse.json({ ok: false, code: 'DEMO_DISABLED',
    message: 'El backend institucional todavía no está configurado. El demo requiere activación explícita.' },
  { status: 503, headers: { 'Cache-Control': 'no-store' } });
}

export function originGuard(request: Request): NextResponse | null {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: 'Origen no autorizado' }, { status: 403 });
  }
  return null;
}
