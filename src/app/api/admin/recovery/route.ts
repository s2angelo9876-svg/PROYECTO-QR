import { NextRequest } from "next/server";
import { z } from "zod";
import { institutionApi, jsonInput, ApiProblem } from "@/lib/institutionApi";
import { ScanCommandSchema, hashScanCommand } from "@/lib/scanContract";
import { verifyReceipt } from "@/lib/artifacts";
import { canonicalJson } from "@/lib/canonicalJson";
import { processInstitutionScan } from "@/lib/institutionScan";
import { audit } from "@/lib/db";
export async function POST(req: NextRequest) {
  return institutionApi(req, ["admin"], async (u, c) => {
    const { command, signedResult } = await jsonInput(
      req,
      z.object({
        command: ScanCommandSchema,
        signedResult: z.record(z.string(), z.unknown()),
      }),
      16384,
    );
    const hash = await hashScanCommand(command);
    const { receipt, ...expected } = signedResult;
    let valid = false;
    try {
      valid =
        typeof receipt === "string" &&
        canonicalJson(await verifyReceipt(c, u.schoolId!, receipt)) ===
          canonicalJson(expected);
    } catch {
      /* Untrusted receipt cannot reconstruct attendance. */
    }
    if (
      !valid ||
      expected.client_scan_id !== command.client_scan_id ||
      expected.terminal_id !== command.terminal_id ||
      expected.payload_hash !== hash
    )
      throw new ApiProblem(
        422,
        "INVALID_RECEIPT",
        "El recibo no es verificable con las claves institucionales restauradas. Conserva la copia y recupera el respaldo de claves correspondiente.",
      );
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${command.terminal_id}:${command.client_scan_id}`,
    ]);
    const existing = (
      await c.query(
        "SELECT payload_hash,result FROM scan_receipts WHERE terminal_id=$1 AND event_id=$2",
        [command.terminal_id, command.client_scan_id],
      )
    ).rows[0];
    if (existing) {
      if (existing.payload_hash !== hash)
        throw new ApiProblem(
          409,
          "RECOVERY_CONFLICT",
          "El servidor contiene otro contenido con el mismo identificador. No se sobrescribió.",
        );
      return { status: "MATCHED", result: existing.result };
    }
    // A savepoint prevents a changed business outcome from replacing the original signed confirmation.
    await c.query("SAVEPOINT recovery_replay");
    let recovered;
    try {
      const result = await processInstitutionScan(c, u, command, {
        signedResult,
      });
      const comparable = (value: Record<string, unknown>) => ({
        ok: value.ok,
        code: value.code,
        disposition: value.disposition,
        attendance_status: value.attendance_status,
        student_id: (value.student as { id?: string })?.id,
        credential_id: value.credential_id,
      });
      if (
        canonicalJson(comparable(result.body)) !==
        canonicalJson(comparable(expected))
      )
        throw new Error("BUSINESS_CONTEXT_CHANGED");
      recovered = result;
    } catch {
      await c.query("ROLLBACK TO SAVEPOINT recovery_replay");
    }
    await c.query("RELEASE SAVEPOINT recovery_replay");
    if (recovered) {
      await audit(
        c,
        u.schoolId!,
        u.id,
        "RECEIPT_RECOVERED",
        command.client_scan_id,
        { originalScanId: expected.scan_id },
      );
      return { status: "RESTORED", result: recovered.body };
    }
    const id = crypto.randomUUID();
    await c.query(
      "INSERT INTO recovery_cases(id,school_id,terminal_id,event_id,actor_id,payload_hash,command,signed_result,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(terminal_id,event_id) DO NOTHING",
      [
        id,
        u.schoolId,
        command.terminal_id,
        command.client_scan_id,
        u.id,
        hash,
        command,
        signedResult,
        "ORIGINAL_CONTEXT_UNAVAILABLE",
      ],
    );
    await audit(
      c,
      u.schoolId!,
      u.id,
      "RECOVERY_REQUIRES_REVIEW",
      command.client_scan_id,
    );
    return { status: "REVIEW", caseId: id };
  });
}
