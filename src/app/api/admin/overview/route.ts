import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { demoGuard } from "@/lib/demoMode";
import { MOCK_STUDENTS, getAttendanceLog } from "@/lib/mockData-exports";
import { NextRequest } from "next/server";
import { institutionApi, READ_ROLES } from "@/lib/institutionApi";
import { buildReportSnapshot } from "@/lib/reportSnapshot";
import { schoolDate } from "@/lib/schoolClock";
export async function GET(req: NextRequest) {
  if (!databaseConfigured()) {
    const denied = demoGuard();
    if (denied) return denied;
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const date = schoolDate(),
      events = getAttendanceLog().filter(
        (e) => schoolDate(e.timestamp) === date,
      );
    const present = new Set(events.map((e) => e.student_id)).size,
      late = new Set(
        events.filter((e) => e.status === "LATE").map((e) => e.student_id),
      ).size;
    return NextResponse.json({
      ok: true,
      date,
      schoolName: "Colegio de demostración",
      synthetic: true,
      review: 0,
      summary: {
        total: MOCK_STUDENTS.length,
        present,
        late,
        absent: 0,
        pending: MOCK_STUDENTS.length - present,
        justified: 0,
        nonTeaching: 0,
      },
      hourly: [],
      terminals: [],
      recent: events.slice(0, 12).map((e) => ({
        id: e.scan_id,
        student_name: e.student?.fullName || "Alumno de demo",
        grade: e.student?.grade || "",
        section: e.student?.section || "",
        occurred_at: e.timestamp,
        direction: e.status === "EXIT" ? "EXIT" : "ENTRY",
        status: e.status,
        disposition: "REVIEW",
        terminal_name: e.entrance_id || "Demo",
      })),
    });
  }
  return institutionApi(
    req,
    READ_ROLES,
    async (u, c) => {
      const snapshot = await buildReportSnapshot(c, schoolDate());
      const recent = (
        await c.query(
          `SELECT a.id,a.direction,a.occurred_at,a.status,a.disposition,a.reason,s.first_name||' '||s.last_name AS student_name,e.grade,e.section,t.name AS terminal_name
  FROM attendance_events a JOIN students s ON s.id=a.student_id JOIN enrollments e ON e.id=a.enrollment_id JOIN terminals t ON t.id=a.terminal_id
  WHERE a.local_date=$1 ORDER BY a.received_at DESC LIMIT 12`,
          [snapshot.date],
        )
      ).rows;
      const hourly = (
        await c.query(
          `SELECT extract(hour from occurred_at AT TIME ZONE 'America/Lima') AS hour,count(*)::int AS count FROM attendance_events a
  WHERE local_date=$1 AND direction='ENTRY' AND (disposition='ACCEPTED' OR EXISTS(SELECT 1 FROM attendance_adjustments j WHERE j.event_id=a.id AND j.decision='ACCEPT')) GROUP BY 1 ORDER BY 1`,
          [snapshot.date],
        )
      ).rows;
      const review = Number(
        (
          await c.query(
            "SELECT count(*) FROM attendance_events a WHERE disposition='REVIEW' AND NOT EXISTS(SELECT 1 FROM attendance_adjustments j WHERE j.event_id=a.id)",
          )
        ).rows[0].count,
      );
      const terminalStats = (
        await c.query(
          `SELECT t.id,t.name,t.direction,t.enabled,max(s.created_at) AS last_session FROM terminals t LEFT JOIN terminal_sessions s ON s.terminal_id=t.id GROUP BY t.id ORDER BY t.name`,
        )
      ).rows;
      return {
        summary: snapshot.summary,
        date: snapshot.date,
        schoolName: snapshot.schoolName,
        recent,
        hourly,
        review,
        terminals: terminalStats,
        synthetic: process.env.SCA_SYNTHETIC_DATA === "true",
      };
    },
    "REPEATABLE READ",
  );
}
