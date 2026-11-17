import { NextRequest } from "next/server";
import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  institutionApi,
  jsonInput,
  EDIT_ROLES,
  ApiProblem,
} from "@/lib/institutionApi";
import { StudentInput, saveStudent } from "@/lib/management";
import { audit } from "@/lib/db";
const Input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("preview"),
    csv: z.string().min(1).max(2000000),
  }),
  z.object({
    action: z.literal("commit"),
    batchId: z.uuid(),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
]);
export async function POST(req: NextRequest) {
  return institutionApi(req, EDIT_ROLES, async (u, c) => {
    const v = await jsonInput(req, Input, 2100000);
    if (v.action === "commit") {
      const batch = (
        await c.query(
          "SELECT * FROM import_batches WHERE id=$1 AND actor_id=$2 FOR UPDATE",
          [v.batchId, u.id],
        )
      ).rows[0];
      if (!batch || batch.payload_hash !== v.hash)
        throw new ApiProblem(
          409,
          "INVALID_PREVIEW",
          "Vuelve a previsualizar el CSV antes de confirmar.",
        );
      if (batch.committed_at)
        return {
          batchId: batch.id,
          imported: batch.rows.length,
          idempotent: true,
        };
      if (Date.now() - new Date(batch.created_at).getTime() > 3600000)
        throw new ApiProblem(
          409,
          "PREVIEW_EXPIRED",
          "La vista previa venció. Carga el CSV de nuevo.",
        );
      for (const row of batch.rows)
        await saveStudent(c, u, StudentInput.parse(row));
      await c.query(
        "UPDATE import_batches SET committed_at=now() WHERE id=$1",
        [batch.id],
      );
      await audit(c, u.schoolId!, u.id, "CSV_IMPORT_COMMITTED", batch.id, {
        count: batch.rows.length,
        hash: v.hash,
      });
      return { batchId: batch.id, imported: batch.rows.length };
    }
    let records: Record<string, string>[];
    try {
      records = parse(v.csv, {
        columns: true,
        bom: true,
        skip_empty_lines: true,
        trim: true,
        max_record_size: 2000,
        relax_column_count: false,
      });
    } catch {
      throw new ApiProblem(
        400,
        "INVALID_CSV",
        "CSV inválido. Usa la plantilla UTF-8 y conserva sus columnas.",
      );
    }
    if (!records.length || records.length > 5000)
      throw new ApiProblem(
        400,
        "IMPORT_LIMIT",
        "Importa entre 1 y 5.000 alumnos por archivo.",
      );
    const expected = [
      "code",
      "firstName",
      "lastName",
      "year",
      "grade",
      "section",
      "scheduleId",
    ];
    if (
      expected.some((k) => !(k in records[0])) ||
      Object.keys(records[0]).some((k) => !expected.includes(k))
    )
      throw new ApiProblem(
        400,
        "CSV_HEADERS",
        `Columnas requeridas: ${expected.join(",")}`,
      );
    const schedules = new Set(
      (await c.query("SELECT id FROM schedules")).rows.map((r) => r.id),
    );
    const existing = new Set(
      (await c.query("SELECT code FROM students")).rows.map((r) => r.code),
    );
    const seen = new Set<string>(),
      rows = [],
      errors: { line: number; message: string }[] = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i],
        parsed = StudentInput.safeParse({ ...r, year: Number(r.year) });
      let message = "";
      if (!parsed.success)
        message = parsed.error.issues
          .map((e) => `${e.path}: ${e.message}`)
          .join("; ");
      else if (!schedules.has(parsed.data.scheduleId))
        message = "Horario no encontrado en este colegio.";
      else if (existing.has(parsed.data.code) || seen.has(parsed.data.code))
        message = "Código duplicado en el archivo o en el padrón.";
      if (message) {
        errors.push({ line: i + 2, message });
        continue;
      }
      seen.add(parsed.data!.code);
      rows.push(parsed.data!);
    }
    if (errors.length)
      return {
        valid: false,
        total: records.length,
        errors: errors.slice(0, 100),
        errorCount: errors.length,
      };
    const id = crypto.randomUUID(),
      hash = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    await c.query(
      "INSERT INTO import_batches(id,school_id,actor_id,payload_hash,rows) VALUES($1,$2,$3,$4,$5)",
      [id, u.schoolId, u.id, hash, JSON.stringify(rows)],
    );
    return {
      valid: true,
      batchId: id,
      hash,
      total: rows.length,
      preview: rows.slice(0, 20),
    };
  });
}
