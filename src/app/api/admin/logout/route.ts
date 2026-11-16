import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';
import { originGuard } from '@/lib/demoMode';

export async function POST(request: Request) {
  const denied = originGuard(request);
  if (denied) return denied;
  const response = NextResponse.redirect(new URL('/admin/login', request.url), 303);
  clearAuthCookie(response);
  return response;
}
