import { NextResponse } from "next/server";
import { pool, databaseConfigured } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (!databaseConfigured())
      return NextResponse.json(
        { ok: false, mode: "demo", code: "DATABASE_NOT_CONFIGURED" },
        { status: 503 },
      );
    await pool().query("SELECT 1");
    return NextResponse.json(
      { ok: true, database: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, code: "DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
