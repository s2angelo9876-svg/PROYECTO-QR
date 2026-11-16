// src/proxy.ts
// Protege las rutas /admin/* verificando el JWT
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/authToken';

const COOKIE_NAME = 'sca_admin_token';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo proteger /admin/* (excepto /admin/login)
  if (!pathname.startsWith('/admin') || pathname === '/admin/login') {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    if (!await verifyToken(token)) throw new Error('UNAUTHORIZED');
    return NextResponse.next();
  } catch {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return response;
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};
