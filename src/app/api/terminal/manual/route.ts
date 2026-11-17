import { NextRequest, NextResponse } from "next/server";
import {
  institutionApi,
  jsonInput,
  ALL_ROLES,
  ApiProblem,
} from "@/lib/institutionApi";
import { ManualCommand, processManualScan } from "@/lib/manualScan";
import { readManagement } from "@/lib/management";
import { verifyTokenArtifact } from "@/lib/artifacts";
export async function GET(req: NextRequest) {
  return institutionApi(req, ALL_ROLES, async (u, c) => ({
    schoolId: u.schoolId,
    terminals: (await readManagement(c, u, "terminals", req.nextUrl)).rows,
    keys: (await c.query("SELECT kid,purpose,public_jwk FROM signing_keys"))
      .rows,
  }));
}
export async function POST(req: NextRequest) {
  return institutionApi(req, ALL_ROLES, async (u, c) => {
    const command = await jsonInput(req, ManualCommand);
    const permit = await verifyTokenArtifact(
      c,
      u.schoolId!,
      "PERMIT",
      command.terminalPermit || "",
      new Date(command.occurredAt),
    );
    if (
      permit.sub !== u.id ||
      permit.terminal_id !== command.terminalId ||
      permit.direction !== command.direction ||
      typeof permit.sid !== "string"
    )
      throw new ApiProblem(
        403,
        "INVALID_PERMIT",
        "El permiso no corresponde a este operador, terminal o movimiento.",
      );
    const session = (
      await c.query(
        "SELECT id FROM terminal_sessions WHERE id=$1 AND operator_id=$2 AND terminal_id=$3 AND revoked_at IS NULL AND expires_at>=$4::timestamptz FOR SHARE",
        [permit.sid, u.id, command.terminalId, command.occurredAt],
      )
    ).rows[0];
    const assigned =
      u.role === "admin" ||
      (
        await c.query(
          "SELECT 1 FROM terminal_operators WHERE terminal_id=$1 AND user_id=$2",
          [command.terminalId, u.id],
        )
      ).rowCount;
    if (!session || !assigned)
      throw new ApiProblem(
        403,
        "TERMINAL_FORBIDDEN",
        "La sesión o la asignación de terminal ya no está disponible. Conserva el borrador para revisión.",
      );
    const result = await processManualScan(c, u, command);
    return NextResponse.json(result.result, { status: result.status });
  });
}
