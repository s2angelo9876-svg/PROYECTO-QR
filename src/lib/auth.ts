// src/lib/auth.ts
// Autenticación con JWT para el panel de administración
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { verifyToken } from "./authToken";
export { signToken, verifyToken } from "./authToken";
export type { AdminUser, AdminTokenPayload } from "./authToken";
import type { AdminUser } from "./authToken";
import { databaseConfigured } from "./db";
import { resolveSession } from "./institutionAuth";

const COOKIE_NAME = "sca_admin_token";
const TOKEN_EXPIRY_HOURS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Obtener usuario actual desde las cookies (server components)
export async function getCurrentUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.user
    ? databaseConfigured()
      ? resolveSession(payload.user)
      : payload.user
    : null;
}

// Setear cookie con el token
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_EXPIRY_HOURS * 60 * 60,
    path: "/",
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
}

// Verificar autenticación desde middleware o API route
export async function requireAuth(
  request: NextRequest,
): Promise<{ user: AdminUser } | NextResponse> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "No autenticado" },
      { status: 401 },
    );
  }
  const payload = await verifyToken(token);
  if (!payload?.user) {
    return NextResponse.json(
      { ok: false, code: "INVALID_TOKEN", message: "Sesión expirada" },
      { status: 401 },
    );
  }
  const user = databaseConfigured()
    ? await resolveSession(payload.user)
    : payload.user;
  if (!user)
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        message: "La sesión fue revocada o expiró. Inicia sesión de nuevo.",
      },
      { status: 401 },
    );
  return { user };
}

// Helper para inicializar hashes en runtime si es necesario
// Útil para sembrar la base de datos en el primer arranque
export async function seedDemoUsers() {
  return [
    {
      user: {
        id: "u-001",
        username: "admin",
        role: "admin" as const,
        fullName: "Administrador del Sistema",
        email: "admin@colegio.com",
      },
      passwordHash: await hashPassword("admin123"),
    },
    {
      user: {
        id: "u-002",
        username: "director",
        role: "director" as const,
        fullName: "Director del Colegio",
        email: "director@colegio.com",
      },
      passwordHash: await hashPassword("director123"),
    },
  ];
}
