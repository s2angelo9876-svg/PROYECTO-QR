import { NextRequest } from "next/server";
import { ALL_ROLES, institutionApi } from "@/lib/institutionApi";
export async function GET(req: NextRequest) {
  return institutionApi(req, ALL_ROLES, async (u, c) => ({
    schoolId: u.schoolId,
    keys: (await c.query("SELECT kid,purpose,public_jwk FROM signing_keys"))
      .rows,
  }));
}
