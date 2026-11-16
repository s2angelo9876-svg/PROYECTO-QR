import { readJsonBody } from '@/lib/httpBody';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { demoGuard, originGuard } from '@/lib/demoMode';
import { sessionConfigured } from '@/lib/authToken';
import {
  signToken,
  setAuthCookie,
  verifyPassword,
  hashPassword,
} from '@/lib/auth';

const LoginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const denied = demoGuard() || originGuard(req);
  if (denied) return denied;
  if (!sessionConfigured()) return NextResponse.json({ ok: false, code: 'SESSION_CONFIGURATION_REQUIRED',
    message: 'Configura JWT_SECRET con al menos 32 caracteres aleatorios para habilitar el acceso.' }, { status: 503 });
  try {
    const body = await readJsonBody(req);
    if (!body.ok) return NextResponse.json({ ok: false, code: 'INVALID_INPUT', message: 'JSON inválido o solicitud demasiado grande' }, { status: body.status });
    const parsed = LoginSchema.safeParse(body.value);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, code: 'INVALID_INPUT', message: 'Datos inválidos' },
        { status: 400 },
      );
    }

    const { username, password } = parsed.data;

    // En producción, esto sería una consulta a la base de datos
    const demoUsers = [
      {
        user: {
          id: 'u-001',
          username: 'admin',
          role: 'admin' as const,
          fullName: 'Administrador del Sistema',
          email: 'admin@colegio.com',
        },
        passwordHash: await hashPassword('admin123'),
      },
      {
        user: {
          id: 'u-002',
          username: 'director',
          role: 'director' as const,
          fullName: 'Director del Colegio',
          email: 'director@colegio.com',
        },
        passwordHash: await hashPassword('director123'),
      },
    ];

    const found = demoUsers.find((u) => u.user.username === username);
    if (!found) {
      return NextResponse.json(
        { ok: false, code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos' },
        { status: 401 },
      );
    }

    const validPassword = await verifyPassword(password, found.passwordHash);
    if (!validPassword) {
      return NextResponse.json(
        { ok: false, code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos' },
        { status: 401 },
      );
    }

    const token = await signToken(found.user);
    const response = NextResponse.json({
      ok: true,
      user: found.user,
      message: 'Login exitoso',
    });
    setAuthCookie(response, token);
    return response;
  } catch (err) {
    console.error('[API /admin/login] REQUEST_FAILED');
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: 'Error interno' },
      { status: 500 },
    );
  }
}
