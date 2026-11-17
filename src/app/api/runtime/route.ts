import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/db";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(
    { ok: true, mode: databaseConfigured() ? "institution" : "demo" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
