import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { databaseConfigured, inSchool, pool } from "@/lib/db";
import { originGuard } from "@/lib/demoMode";
import { jsonInput, problemResponse, ApiProblem } from "@/lib/institutionApi";
import { ScanCommandSchema } from "@/lib/scanContract";
import { processInstitutionScan } from "@/lib/institutionScan";
import { rateLimit } from "@/lib/rateLimit";
export async function POST(req: NextRequest) {
  try {
    if (!databaseConfigured())
      throw new ApiProblem(
        503,
        "DATABASE_CONFIGURATION_REQUIRED",
        "Configura la base institucional.",
      );
    const denied = originGuard(req);
    if (denied) return denied;
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.user.mustChangePassword)
      throw new ApiProblem(
        403,
        "PASSWORD_CHANGE_REQUIRED",
        "Cambia tu contraseña inicial.",
      );
    const { events } = await jsonInput(
        req,
        z.object({ events: z.array(ScanCommandSchema).min(1).max(20) }),
        100000,
      ),
      results = [];
    // Bounded, chronological and per-event transactions. Sequential execution preserves order for each student.
    for (const command of [...events].sort((a, b) =>
      (a.offline_timestamp || "").localeCompare(b.offline_timestamp || ""),
    )) {
      try {
        await rateLimit(
          pool(),
          `${auth.user.schoolId}:${auth.user.id}:scan`,
          300,
        );
        const r = await inSchool(auth.user.schoolId!, (c) =>
          processInstitutionScan(c, auth.user, command),
        );
        results.push({ eventId: command.client_scan_id, ...r });
      } catch (error) {
        const response = problemResponse(error);
        results.push({
          eventId: command.client_scan_id,
          status: response.status,
          body: await response.json(),
        });
      }
    }
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return problemResponse(error);
  }
}
