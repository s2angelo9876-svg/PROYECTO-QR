import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
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
    console.error('[API /admin/login] Error:', err);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: 'Error interno' },
      { status: 500 },
    );
  }
}
