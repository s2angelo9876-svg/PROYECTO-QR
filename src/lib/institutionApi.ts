import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { z } from "zod";
import { requireAuth } from "./auth";
import type { AdminUser } from "./authToken";
import { databaseConfigured, inSchool, pool } from "./db";
import { originGuard } from "./demoMode";
import { readJsonBody } from "./httpBody";
import { rateLimit } from "./rateLimit";

import { ApiProblem } from "./apiProblem";
export { ApiProblem } from "./apiProblem";
export const READ_ROLES: AdminUser["role"][] = [
  "admin",
  "director",
  "secretary",
];
export const EDIT_ROLES: AdminUser["role"][] = ["admin", "secretary"];
export const REVIEW_ROLES: AdminUser["role"][] = ["admin", "director"];
export const ALL_ROLES: AdminUser["role"][] = [
  "admin",
  "director",
  "secretary",
  "porter",
];
export async function jsonInput<T>(
  request: Request,
  schema: z.ZodType<T>,
  max = 8192,
): Promise<T> {
  const body = await readJsonBody(request, max);
  if (!body.ok)
    throw new ApiProblem(
      body.status,
      "INVALID_INPUT",
      "No se pudo leer la solicitud. Revisa el archivo o los campos.",
    );
  const parsed = schema.safeParse(body.value);
  if (!parsed.success)
    throw new ApiProblem(
      400,
      "INVALID_INPUT",
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 5)
        .join("; "),
    );
  return parsed.data;
}
export async function institutionApi(
  request: NextRequest,
  roles: AdminUser["role"][],
  fn: (user: AdminUser, client: PoolClient) => Promise<unknown>,
  isolation?: string,
) {
  try {
    if (!databaseConfigured())
      throw new ApiProblem(
        503,
        "DATABASE_CONFIGURATION_REQUIRED",
        "Configura PostgreSQL local para utilizar esta función.",
      );
    if (!["GET", "HEAD"].includes(request.method)) {
      const denied = originGuard(request);
      if (denied) return denied;
    }
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!roles.includes(auth.user.role))
      throw new ApiProblem(
        403,
        "FORBIDDEN",
        "Tu rol no permite realizar esta acción.",
      );
    if (
      auth.user.mustChangePassword &&
      !request.nextUrl.pathname.startsWith("/api/admin/account")
    )
      throw new ApiProblem(
        403,
        "PASSWORD_CHANGE_REQUIRED",
        "Cambia la contraseña inicial desde Configuración → Cuenta.",
      );
    const scan = request.nextUrl.pathname === "/api/attendances/scan";
    await rateLimit(
      pool(),
      `${auth.user.schoolId}:${auth.user.id}:${scan ? "scan" : request.method === "GET" ? "read" : "write"}`,
      scan ? 300 : request.method === "GET" ? 180 : 60,
    );
    const value = await inSchool(
      auth.user.schoolId!,
      (c) => fn(auth.user, c),
      isolation,
    );
    if (value instanceof Response) return value;
    return NextResponse.json(
      { ok: true, ...(value as object) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return problemResponse(error);
  }
}
export function problemResponse(error: unknown) {
  if (error instanceof ApiProblem)
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      {
        status: error.status,
        headers: error.status === 429 ? { "Retry-After": "60" } : undefined,
      },
    );
  const code = (error as { code?: string })?.code;
  if (code === "23505")
    return NextResponse.json(
      {
        ok: false,
        code: "CONFLICT",
        message:
          "El registro ya existe. Actualiza los datos y vuelve a intentarlo.",
      },
      { status: 409 },
    );
  if (code === "23503" || code === "22P02" || code === "23514")
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_REFERENCE",
        message: "Hay un valor o una referencia inválida para este colegio.",
      },
      { status: 400 },
    );
  console.error(
    "[institution] REQUEST_FAILED",
    code || (error instanceof Error ? error.name : "UNKNOWN"),
  );
  return NextResponse.json(
    {
      ok: false,
      code: "INTERNAL",
      message:
        "No se completó la operación. Conserva la captura y vuelve a intentarlo.",
    },
    { status: 503 },
  );
}
