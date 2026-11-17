import type { PoolClient } from "pg";
import type { AdminUser } from "./authToken";
import type { ApiScanRequest } from "@/types/attendance";
import { ApiProblem } from "./apiProblem";
import { audit } from "./db";
import { hashScanCommand } from "./scanContract";
import { verifyTokenArtifact, signReceipt } from "./artifacts";
import { evaluateCapture, schoolDate, weekday } from "./schoolClock";
import { studentDto } from "./studentDto";
import { canonicalJson } from "./canonicalJson";

export async function processInstitutionScan(
  c: PoolClient,
  user: AdminUser,
  command: ApiScanRequest,
  recovery?: { signedResult: Record<string, unknown> },
) {
  const schoolId = user.schoolId!,
    terminalId = command.terminal_id;
  if (!terminalId || !/^[0-9a-f-]{36}$/i.test(terminalId))
    throw new ApiProblem(
      400,
      "TERMINAL_REQUIRED",
      "Abre una sesión de terminal autorizada.",
    );
  const terminal = (
    await c.query("SELECT * FROM terminals WHERE id=$1 FOR SHARE", [terminalId])
  ).rows[0];
  if (!terminal)
    throw new ApiProblem(
      403,
      "INVALID_TERMINAL",
      "La terminal no pertenece a este colegio.",
    );
  const hash = await hashScanCommand(command);
  // Serializes this receipt even before a row exists. Business serialization uses the daily projection row below.
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `${terminalId}:${command.client_scan_id}`,
  ]);
  const previous = (
    await c.query(
      "SELECT * FROM scan_receipts WHERE terminal_id=$1 AND event_id=$2",
      [terminalId, command.client_scan_id],
    )
  ).rows[0];
  if (previous) {
    if (previous.payload_hash !== hash)
      throw new ApiProblem(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Este identificador ya corresponde a otra captura. Conserva el original para revisión.",
      );
    return { status: previous.http_status, body: previous.result };
  }
  const receivedAt = recovery
      ? String(recovery.signedResult.server_timestamp)
      : new Date().toISOString(),
    occurredAt = command.offline_timestamp || receivedAt;
  const authorizationTime = new Date(
    new Date(occurredAt).getTime() + (command.clock_offset_ms || 0),
  );
  const receiptId = crypto.randomUUID();
  const persist = async (status: number, body: Record<string, unknown>) => {
    const signed = {
      ...body,
      client_scan_id: command.client_scan_id,
      payload_hash: hash,
      terminal_id: terminalId,
      server_timestamp: receivedAt,
    };
    const receipt = await signReceipt(c, schoolId, signed);
    let result: Record<string, unknown> = { ...signed, receipt };
    if (recovery) {
      const comparable = (v: Record<string, unknown>) => ({
        ok: v.ok,
        code: v.code,
        disposition: v.disposition,
        attendance_status: v.attendance_status,
        student_id: (v.student as { id?: string })?.id,
        credential_id: v.credential_id,
      });
      if (
        canonicalJson(comparable(result)) !==
        canonicalJson(comparable(recovery.signedResult))
      )
        throw new Error("RECOVERY_CONTEXT_CHANGED");
      result = recovery.signedResult;
    }
    await c.query(
      "INSERT INTO scan_receipts(id,school_id,terminal_id,event_id,payload_hash,http_status,result) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        receiptId,
        schoolId,
        terminalId,
        command.client_scan_id,
        hash,
        status,
        result,
      ],
    );
    return { status, body: result };
  };
  const reject = (code: string, message: string, status = 422) =>
    persist(status, { ok: false, code, message, disposition: "REJECTED" });
  let permit;
  try {
    permit = await verifyTokenArtifact(
      c,
      schoolId,
      "PERMIT",
      command.terminal_permit || "",
      authorizationTime,
    );
  } catch {
    return reject(
      "INVALID_PERMIT",
      "Renueva la autorización de terminal y revisa la captura.",
      403,
    );
  }
  if (typeof permit.sid !== "string" || !/^[a-f0-9-]{36}$/i.test(permit.sid))
    return reject("INVALID_PERMIT", "La sesión de captura no es válida.", 403);
  const session = (
    await c.query(
      "SELECT ts.*,u.active AS operator_active FROM terminal_sessions ts JOIN users u ON u.id=ts.operator_id AND u.school_id=ts.school_id WHERE ts.id=$1 FOR SHARE OF ts,u",
      [permit.sid],
    )
  ).rows[0];
  if (
    !session ||
    session.terminal_id !== terminalId ||
    permit.terminal_id !== terminalId ||
    permit.sub !== session.operator_id ||
    authorizationTime.getTime() <
      new Date(session.created_at).getTime() - 120000 ||
    authorizationTime > new Date(session.expires_at)
  )
    return reject(
      "CAPTURE_SESSION_REVOKED",
      "La sesión de captura expiró o fue revocada.",
      403,
    );
  const reader = (
    await c.query(
      "SELECT id FROM scanners WHERE terminal_id=$1 AND id=$2 AND enabled FOR SHARE",
      [terminalId, command.scanner_id],
    )
  ).rows[0];
  if (!command.scanner_id || !command.entrance_id || !command.direction)
    return reject(
      "MISSING_CAPTURE_CONTEXT",
      "Falta el contexto autorizado de la captura.",
      400,
    );
  if (permit.direction !== command.direction)
    return reject(
      "TERMINAL_SCOPE_MISMATCH",
      "El movimiento no coincide con el permiso firmado.",
      403,
    );
  const scopeChanged =
    command.entrance_id !== terminal.entrance_id ||
    !reader ||
    command.direction !== terminal.direction;
  let qr;
  try {
    if (!command.qr_code.startsWith("SCA1:")) throw new Error("INVALID_FORMAT");
    qr = await verifyTokenArtifact(
      c,
      schoolId,
      "QR",
      command.qr_code.slice(5),
      authorizationTime,
    );
  } catch {
    return reject(
      "INVALID_QR",
      "El carnet no tiene una firma o vigencia válida.",
    );
  }
  if (typeof qr.jti !== "string" || !/^[a-f0-9-]{36}$/i.test(qr.jti))
    return reject("INVALID_QR", "El identificador de credencial no es válido.");
  const credential = (
    await c.query("SELECT * FROM credentials WHERE id=$1 FOR SHARE", [qr.jti])
  ).rows[0];
  if (!credential)
    return reject("REVOKED_QR", "La credencial fue revocada o no existe.");
  const submitterAssigned =
    user.role === "admin" ||
    user.id === session.operator_id ||
    Boolean(
      (
        await c.query(
          "SELECT 1 FROM terminal_operators WHERE terminal_id=$1 AND user_id=$2",
          [terminalId, user.id],
        )
      ).rowCount,
    );
  const authorizationReason = !submitterAssigned
    ? "SUBMITTER_NOT_ASSIGNED"
    : scopeChanged
      ? "TERMINAL_CONFIGURATION_CHANGED"
      : !terminal.enabled
        ? "TERMINAL_DISABLED"
        : session.revoked_at
          ? "CAPTURE_SESSION_REVOKED"
          : !session.operator_active
            ? "CAPTURE_OPERATOR_INACTIVE"
            : null;
  const student = (
    await c.query("SELECT * FROM students WHERE id=$1 FOR SHARE", [
      credential.student_id,
    ])
  ).rows[0];
  const date = schoolDate(occurredAt);
  const enrollment = (
    await c.query(
      `SELECT e.*,s.start_time,s.end_time,s.grace_minutes,s.weekdays,s.version AS rule_version
 FROM enrollments e JOIN LATERAL (SELECT * FROM schedule_versions sv WHERE sv.schedule_id=e.schedule_id AND sv.school_id=e.school_id AND sv.effective_from<=$4::timestamptz ORDER BY sv.version DESC LIMIT 1) s ON true
 WHERE e.student_id=$1 AND e.active AND e.year=$2 AND e.valid_from<=$3 AND e.valid_until>=$3 FOR SHARE OF e`,
      [student.id, Number(date.slice(0, 4)), date, occurredAt],
    )
  ).rows[0];
  if (!enrollment)
    return reject(
      "NO_ACTIVE_ENROLLMENT",
      "No hay matrícula vigente para la fecha de captura.",
    );
  await c.query(
    "INSERT INTO daily_attendance(school_id,enrollment_id,local_date) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [schoolId, enrollment.id, date],
  );
  const daily = (
    await c.query(
      "SELECT * FROM daily_attendance WHERE enrollment_id=$1 AND local_date=$2 FOR UPDATE",
      [enrollment.id, date],
    )
  ).rows[0];
  const calendar = (
    await c.query("SELECT * FROM calendar_days WHERE local_date=$1", [date])
  ).rows[0];
  const teaching = calendar
    ? calendar.teaching
    : enrollment.weekdays.includes(weekday(date));
  const decision = evaluateCapture({
    occurredAt,
    receivedAt,
    direction: command.direction!,
    start: enrollment.start_time,
    end: enrollment.end_time,
    grace: enrollment.grace_minutes,
    teaching,
    previousEntry: daily.first_entry?.toISOString(),
    previousExit: daily.last_exit?.toISOString(),
    burst: command.is_burst,
  });
  let disposition: string = decision.disposition,
    reason: string | null = decision.reason;
  if (credential.revoked_at) {
    disposition = "REVIEW";
    reason = "CREDENTIAL_REVOKED";
  }
  if (authorizationReason) {
    disposition = "REVIEW";
    reason = authorizationReason;
  }
  if (student.status !== "ACTIVE") {
    disposition = "REVIEW";
    reason = "STUDENT_INACTIVE";
  }
  if (Math.abs(command.clock_offset_ms || 0) > 120000) {
    disposition = "REVIEW";
    reason = "CLOCK_OFFSET";
  }
  const recent = (
    await c.query(
      "SELECT 1 FROM attendance_events WHERE student_id=$1 AND disposition='ACCEPTED' AND direction=$2 AND abs(extract(epoch from (occurred_at-$3::timestamptz)))<60 LIMIT 1",
      [student.id, command.direction, occurredAt],
    )
  ).rowCount;
  if (recent) {
    disposition = "REVIEW";
    reason = "DOUBLE_READ";
  }
  const eventId =
    recovery && typeof recovery.signedResult.scan_id === "string"
      ? recovery.signedResult.scan_id
      : crypto.randomUUID();
  await c.query(
    `INSERT INTO attendance_events(id,school_id,student_id,enrollment_id,credential_id,terminal_id,event_id,captured_by,submitted_by,direction,occurred_at,received_at,local_date,rule_version,disposition,status,reason,payload_hash,scanner_id,entrance_id,clock_offset_ms)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
    [
      eventId,
      schoolId,
      student.id,
      enrollment.id,
      credential.id,
      terminalId,
      command.client_scan_id,
      session.operator_id,
      user.id,
      command.direction,
      occurredAt,
      receivedAt,
      date,
      enrollment.rule_version,
      disposition,
      decision.status,
      reason,
      hash,
      command.scanner_id,
      command.entrance_id,
      command.clock_offset_ms || 0,
    ],
  );
  if (disposition === "ACCEPTED") {
    await c.query(
      `UPDATE daily_attendance SET first_entry=CASE WHEN $3='ENTRY' THEN $4::timestamptz ELSE first_entry END,
  last_exit=CASE WHEN $3='EXIT' THEN $4::timestamptz ELSE last_exit END,state=CASE WHEN $3='ENTRY' THEN $5 ELSE state END,version=version+1
  WHERE enrollment_id=$1 AND local_date=$2`,
      [enrollment.id, date, command.direction, occurredAt, decision.status],
    );
  } else {
    await c.query(
      "INSERT INTO notifications(id,school_id,title,body) VALUES($1,$2,$3,$4)",
      [
        crypto.randomUUID(),
        schoolId,
        "Captura pendiente de revisión",
        `Motivo: ${reason}. Consulta el registro de incidencias.`,
      ],
    );
  }
  await audit(c, schoolId, user.id, `SCAN_${disposition}`, eventId, {
    terminalId,
    direction: command.direction,
    reason,
    capturedBy: session.operator_id,
  });
  if (disposition !== "ACCEPTED")
    return persist(409, {
      ok: false,
      code: reason,
      message:
        "Captura conservada para revisión. Todavía no confirma asistencia.",
      disposition,
      scan_id: eventId,
    });
  return persist(200, {
    ok: true,
    scan_id: eventId,
    attendance_status: decision.status,
    is_burst: command.is_burst,
    student: studentDto({
      ...student,
      ...{ grade: enrollment.grade, section: enrollment.section },
    }),
    credential_id: credential.id,
    persistence: "durable",
    disposition: "ACCEPTED",
    message:
      command.direction === "ENTRY"
        ? "Entrada registrada"
        : "Salida registrada",
  });
}
