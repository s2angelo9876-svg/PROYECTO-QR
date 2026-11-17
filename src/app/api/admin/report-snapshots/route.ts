import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  institutionApi,
  jsonInput,
  READ_ROLES,
  ApiProblem,
} from "@/lib/institutionApi";
import {
  buildReportSnapshot,
  snapshotCsv,
  type ReportSnapshot,
} from "@/lib/reportSnapshot";
import { snapshotPdf } from "@/lib/snapshotPdf";
import { audit } from "@/lib/db";
export async function POST(req: NextRequest) {
  return institutionApi(
    req,
    READ_ROLES,
    async (u, c) => {
      const { date } = await jsonInput(req, z.object({ date: z.iso.date() })),
        snapshot = await buildReportSnapshot(c, date);
      await c.query(
        "INSERT INTO report_snapshots(id,school_id,actor_id,local_date,payload) VALUES($1,$2,$3,$4,$5)",
        [snapshot.id, u.schoolId, u.id, date, snapshot],
      );
      await audit(
        c,
        u.schoolId!,
        u.id,
        "REPORT_SNAPSHOT_CREATED",
        snapshot.id,
        { date, rows: snapshot.rows.length, hash: snapshot.hash },
      );
      return { snapshot };
    },
    "REPEATABLE READ",
  );
}
export async function GET(req: NextRequest) {
  return institutionApi(req, READ_ROLES, async (u, c) => {
    const id = z.uuid().safeParse(req.nextUrl.searchParams.get("id"));
    if (!id.success)
      throw new ApiProblem(400, "INVALID_INPUT", "Selecciona una instantánea.");
    const row = (
      await c.query("SELECT payload FROM report_snapshots WHERE id=$1", [
        id.data,
      ])
    ).rows[0];
    if (!row) throw new ApiProblem(404, "NOT_FOUND", "Reporte no encontrado.");
    const s = row.payload as ReportSnapshot,
      format = req.nextUrl.searchParams.get("format");
    await audit(c, u.schoolId!, u.id, "REPORT_EXPORTED", s.id, {
      format: format || "json",
    });
    const headers = {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="asistencia-${s.date}-${s.id.slice(0, 8)}.${format === "pdf" ? "pdf" : "csv"}"`,
    };
    if (format === "csv")
      return new NextResponse(snapshotCsv(s), {
        headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
      });
    if (format === "pdf")
      return new NextResponse(new Uint8Array(await snapshotPdf(s)), {
        headers: { ...headers, "Content-Type": "application/pdf" },
      });
    return { snapshot: s };
  });
}
