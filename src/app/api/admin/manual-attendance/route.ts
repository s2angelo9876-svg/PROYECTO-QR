import { NextRequest, NextResponse } from "next/server";
import { institutionApi, jsonInput, EDIT_ROLES } from "@/lib/institutionApi";
import { ManualCommand, processManualScan } from "@/lib/manualScan";
export async function POST(req: NextRequest) {
  return institutionApi(req, EDIT_ROLES, async (u, c) => {
    const result = await processManualScan(
      c,
      u,
      await jsonInput(req, ManualCommand),
    );
    return NextResponse.json(result.result, { status: result.status });
  });
}
export async function GET(req: NextRequest) {
  return institutionApi(req, EDIT_ROLES, async (u, c) => ({
    schoolId: u.schoolId,
    terminals: (
      await c.query(
        "SELECT id,name,direction FROM terminals WHERE enabled ORDER BY name",
      )
    ).rows,
    keys: (await c.query("SELECT kid,purpose,public_jwk FROM signing_keys"))
      .rows,
  }));
}
