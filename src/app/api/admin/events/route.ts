import { NextRequest } from "next/server";
import { z } from "zod";
import { institutionApi, READ_ROLES, ApiProblem } from "@/lib/institutionApi";
import { schoolDate } from "@/lib/schoolClock";
export async function GET(req: NextRequest) {
  return institutionApi(req, READ_ROLES, async (u, c) => {
    const date = req.nextUrl.searchParams.get("date") || schoolDate(),
      q = (req.nextUrl.searchParams.get("q") || "").slice(0, 100),
      page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
    if (!z.iso.date().safeParse(date).success)
      throw new ApiProblem(400, "INVALID_DATE", "Selecciona una fecha válida.");
    const filter = `FROM attendance_events a JOIN students s ON s.id=a.student_id JOIN enrollments e ON e.id=a.enrollment_id JOIN terminals t ON t.id=a.terminal_id LEFT JOIN attendance_adjustments j ON j.event_id=a.id
  WHERE a.local_date=$1 AND ($2='' OR s.first_name||' '||s.last_name ILIKE '%'||$2||'%' OR s.code ILIKE '%'||$2||'%')`;
    const rows = (
      await c.query(
        `SELECT a.*,s.first_name||' '||s.last_name AS student_name,s.code,e.grade,e.section,t.name AS terminal_name,j.decision AS adjudication ${filter} ORDER BY a.received_at DESC,a.id LIMIT 25 OFFSET $3`,
        [date, q, (page - 1) * 25],
      )
    ).rows;
    return {
      rows,
      total: Number(
        (await c.query(`SELECT count(*) ${filter}`, [date, q])).rows[0].count,
      ),
      page,
      date,
    };
  });
}
