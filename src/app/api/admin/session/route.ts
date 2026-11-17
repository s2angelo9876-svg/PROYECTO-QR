import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(
    {
      ok: true,
      user: auth.user,
      mode: databaseConfigured() ? "institution" : "demo",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
