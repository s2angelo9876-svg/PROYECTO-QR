import { z } from "zod";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { AdminUser } from "./authToken";
import { ApiProblem } from "./apiProblem";
import { evaluateCapture, schoolDate, weekday } from "./schoolClock";
import { studentDto } from "./studentDto";
import { signReceipt } from "./artifacts";
import { audit } from "./db";
export const ManualCommand = z.object({
  terminalPermit: z.string().max(2048).optional(),
  clientScanId: z.uuid(),
  studentId: z.uuid(),
  terminalId: z.uuid(),
  direction: z.enum(["ENTRY", "EXIT"]),
  occurredAt: z.iso.datetime(),
  reason: z.string().trim().min(10).max(500),
});
export async function processManualScan(
  c: PoolClient,
  u: AdminUser,
  v: z.infer<typeof ManualCommand>,
) {
  const hash = createHash("sha256")
    .update(
      JSON.stringify([
        v.terminalPermit ? 4 : 3,
        v.clientScanId,
        v.studentId,
        v.terminalId,
        v.direction,
        v.occurredAt,
        v.reason,
        ...(v.terminalPermit ? [v.terminalPermit] : []),
      ]),
    )
    .digest("hex");
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `${v.terminalId}:${v.clientScanId}`,
  ]);
  const old = (
    await c.query(
      "SELECT * FROM scan_receipts WHERE terminal_id=$1 AND event_id=$2",
      [v.terminalId, v.clientScanId],
    )
  ).rows[0];
  if (old) {
    if (old.payload_hash !== hash)
      throw new ApiProblem(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "El identificador ya corresponde a otro registro.",
      );
    return { status: old.http_status, result: old.result };
  }
  const terminal = (
    await c.query("SELECT * FROM terminals WHERE id=$1 AND enabled FOR SHARE", [
      v.terminalId,
    ])
  ).rows[0];
  if (!terminal || terminal.direction !== v.direction)
    throw new ApiProblem(
      403,
      "TERMINAL_SCOPE_MISMATCH",
      "La terminal no está habilitada para este movimiento.",
    );
  const student = (
    await c.query("SELECT * FROM students WHERE id=$1 FOR SHARE", [v.studentId])
  ).rows[0];
  if (!student) throw new ApiProblem(404, "NOT_FOUND", "Alumno no encontrado.");
  const date = schoolDate(v.occurredAt),
    e = (
      await c.query(
        `SELECT e.*,s.start_time,s.end_time,s.grace_minutes,s.weekdays,s.version FROM enrollments e JOIN LATERAL (SELECT * FROM schedule_versions sv WHERE sv.schedule_id=e.schedule_id AND sv.school_id=e.school_id AND sv.effective_from<=$3::timestamptz ORDER BY sv.version DESC LIMIT 1) s ON true WHERE e.student_id=$1 AND e.active AND e.valid_from<=$2 AND e.valid_until>=$2 FOR SHARE OF e`,
        [v.studentId, date, v.occurredAt],
      )
    ).rows[0];
  if (!e)
    throw new ApiProblem(
      422,
      "NO_ACTIVE_ENROLLMENT",
      "No hay matrícula vigente para esa fecha.",
    );
  await c.query(
    "INSERT INTO daily_attendance(school_id,enrollment_id,local_date) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [u.schoolId, e.id, date],
  );
  const daily = (
      await c.query(
        "SELECT * FROM daily_attendance WHERE enrollment_id=$1 AND local_date=$2 FOR UPDATE",
        [e.id, date],
      )
    ).rows[0],
    calendar = (
      await c.query("SELECT teaching FROM calendar_days WHERE local_date=$1", [
        date,
      ])
    ).rows[0],
    received = new Date().toISOString();
  const d = evaluateCapture({
    occurredAt: v.occurredAt,
    receivedAt: received,
    direction: v.direction,
    start: e.start_time,
    end: e.end_time,
    grace: e.grace_minutes,
    teaching: calendar ? calendar.teaching : e.weekdays.includes(weekday(date)),
    previousEntry: daily.first_entry?.toISOString(),
    previousExit: daily.last_exit?.toISOString(),
    burst: false,
  });
  const disposition = student.status === "ACTIVE" ? d.disposition : "REVIEW",
    reason = student.status === "ACTIVE" ? d.reason : "STUDENT_INACTIVE",
    id = crypto.randomUUID();
  await c.query(
    `INSERT INTO attendance_events(id,school_id,student_id,enrollment_id,terminal_id,event_id,captured_by,submitted_by,direction,occurred_at,received_at,local_date,rule_version,disposition,status,reason,payload_hash,capture_method,manual_reason,scanner_id,entrance_id)
 VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'MANUAL',$17,$18,$19)`,
    [
      id,
      u.schoolId,
      student.id,
      e.id,
      v.terminalId,
      v.clientScanId,
      u.id,
      v.direction,
      v.occurredAt,
      received,
      date,
      e.version,
      disposition,
      d.status,
      reason,
      hash,
      v.reason,
      terminal.scanner_id,
      terminal.entrance_id,
    ],
  );
  if (disposition === "ACCEPTED")
    await c.query(
      `UPDATE daily_attendance SET first_entry=CASE WHEN $3='ENTRY' THEN $4 ELSE first_entry END,last_exit=CASE WHEN $3='EXIT' THEN $4 ELSE last_exit END,state=CASE WHEN $3='ENTRY' THEN $5 ELSE state END,version=version+1 WHERE enrollment_id=$1 AND local_date=$2`,
      [e.id, date, v.direction, v.occurredAt, d.status],
    );
  else
    await c.query(
      "INSERT INTO notifications(id,school_id,title,body) VALUES($1,$2,$3,$4)",
      [
        crypto.randomUUID(),
        u.schoolId,
        "Registro manual por revisar",
        `Motivo: ${reason}. Consulta Incidencias.`,
      ],
    );
  const signed = {
      ok: disposition === "ACCEPTED",
      scan_id: id,
      client_scan_id: v.clientScanId,
      payload_hash: hash,
      terminal_id: v.terminalId,
      server_timestamp: received,
      disposition,
      code: reason,
      attendance_status: d.status,
      student: studentDto({ ...student, grade: e.grade, section: e.section }),
      persistence: "durable",
      message:
        disposition === "ACCEPTED"
          ? "Registro manual confirmado."
          : "Registro conservado para revisión.",
    },
    result = { ...signed, receipt: await signReceipt(c, u.schoolId!, signed) },
    status = disposition === "ACCEPTED" ? 200 : 409;
  await c.query(
    "INSERT INTO scan_receipts(id,school_id,terminal_id,event_id,payload_hash,http_status,result) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      crypto.randomUUID(),
      u.schoolId,
      v.terminalId,
      v.clientScanId,
      hash,
      status,
      result,
    ],
  );
  await audit(c, u.schoolId!, u.id, "MANUAL_CAPTURE_RECORDED", id, {
    disposition,
    reason,
  });
  return { status, result };
}
