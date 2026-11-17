import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { schoolDate, schoolSeconds, timeSeconds, weekday } from "./schoolClock";
export interface ReportRow {
  studentId: string;
  enrollmentId: string;
  code: string;
  name: string;
  grade: string;
  section: string;
  entry: string | null;
  exit: string | null;
  state: string;
}
export interface ReportSnapshot {
  id: string;
  schoolName: string;
  date: string;
  timezone: string;
  generatedAt: string;
  hash: string;
  rows: ReportRow[];
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    pending: number;
    justified: number;
    nonTeaching: number;
  };
}
export async function buildReportSnapshot(
  c: PoolClient,
  date: string,
): Promise<ReportSnapshot> {
  const school = (await c.query("SELECT * FROM schools")).rows[0],
    now = new Date(),
    today = schoolDate(now),
    calendar = (
      await c.query("SELECT * FROM calendar_days WHERE local_date=$1", [date])
    ).rows[0];
  const records = (
    await c.query(
      `SELECT s.id AS student_id,s.code,s.first_name,s.last_name,e.id AS enrollment_id,e.grade,e.section,sc.end_time,sc.weekdays,
 d.first_entry,d.last_exit,d.state FROM enrollments e JOIN students s ON s.id=e.student_id AND s.school_id=e.school_id JOIN LATERAL (SELECT * FROM schedule_versions sv WHERE sv.schedule_id=e.schedule_id AND sv.school_id=e.school_id AND sv.effective_from<=$2::timestamptz ORDER BY sv.version DESC LIMIT 1) sc ON true
 LEFT JOIN daily_attendance d ON d.enrollment_id=e.id AND d.local_date=$1 WHERE e.active AND e.valid_from<=$1 AND e.valid_until>=$1 ORDER BY e.grade,e.section,s.last_name,s.first_name,s.id`,
      [date, date < today ? `${date}T23:59:59-05:00` : now.toISOString()],
    )
  ).rows;
  const rows = records.map((r) => {
    const teaching = calendar
      ? calendar.teaching
      : r.weekdays.includes(weekday(date));
    const closed =
      date < today ||
      (date === today && schoolSeconds(now) >= timeSeconds(r.end_time));
    const state = r.first_entry
      ? r.state
      : r.state === "JUSTIFIED"
        ? "JUSTIFIED"
        : !teaching
          ? "NON_TEACHING"
          : closed
            ? "ABSENT"
            : "NO_RECORD";
    return {
      studentId: r.student_id,
      enrollmentId: r.enrollment_id,
      code: r.code,
      name: `${r.first_name} ${r.last_name}`,
      grade: r.grade,
      section: r.section,
      entry: r.first_entry?.toISOString() || null,
      exit: r.last_exit?.toISOString() || null,
      state,
    };
  });
  const summary = {
    total: rows.length,
    present: rows.filter((r) => r.entry).length,
    late: rows.filter((r) => r.state === "LATE").length,
    absent: rows.filter((r) => r.state === "ABSENT").length,
    pending: rows.filter((r) => r.state === "NO_RECORD").length,
    justified: rows.filter((r) => r.state === "JUSTIFIED").length,
    nonTeaching: rows.filter((r) => r.state === "NON_TEACHING").length,
  };
  const hash = createHash("sha256")
    .update(JSON.stringify({ date, rows, summary }))
    .digest("hex");
  return {
    id: crypto.randomUUID(),
    schoolName: school.name,
    date,
    timezone: school.timezone,
    generatedAt: now.toISOString(),
    hash,
    rows,
    summary,
  };
}
export function safeCsvCell(value: unknown) {
  const s = String(value ?? "");
  return `"${(/^[\s]*[=+@\-\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""')}"`;
}
export function snapshotCsv(snapshot: ReportSnapshot) {
  return (
    "\uFEFF" +
    [
      [
        "Código",
        "Alumno",
        "Grado",
        "Sección",
        "Entrada (UTC)",
        "Salida (UTC)",
        "Estado",
        "Fecha escolar",
        "Instantánea",
      ],
      ...snapshot.rows.map((r) => [
        r.code,
        r.name,
        r.grade,
        r.section,
        r.entry,
        r.exit,
        r.state,
        snapshot.date,
        snapshot.id,
      ]),
    ]
      .map((r) => r.map(safeCsvCell).join(","))
      .join("\r\n")
  );
}
