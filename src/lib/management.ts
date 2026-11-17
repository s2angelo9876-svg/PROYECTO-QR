import type { PoolClient } from "pg";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateKeyPair, exportJWK } from "jose";
import type { AdminUser } from "./authToken";
import { audit } from "./db";
import { ApiProblem } from "./apiProblem";
import { studentDto } from "./studentDto";
import { schoolDate } from "./schoolClock";
import { signTokenArtifact } from "./artifacts";

export const passwordSchema = z
  .string()
  .min(12)
  .max(72)
  .refine((s) => Buffer.byteLength(s, "utf8") <= 72, "Máximo 72 bytes");
export const StudentInput = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{2,30}$/),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(100),
  grade: z.string().trim().min(1).max(30),
  section: z.string().trim().min(1).max(20),
  scheduleId: z.uuid(),
  year: z.number().int().min(2000).max(2200),
  status: z.enum(["ACTIVE", "SUSPENDED", "GRADUATED"]).default("ACTIVE"),
});
export type StudentInputType = z.infer<typeof StudentInput>;
export async function saveStudent(
  c: PoolClient,
  user: AdminUser,
  input: StudentInputType,
  id?: string,
) {
  const studentId = id || crypto.randomUUID();
  if (id) {
    const r = await c.query(
      "UPDATE students SET code=$2,first_name=$3,last_name=$4,status=$5 WHERE id=$1 RETURNING id",
      [id, input.code, input.firstName, input.lastName, input.status],
    );
    if (!r.rowCount)
      throw new ApiProblem(404, "NOT_FOUND", "Alumno no encontrado.");
  } else
    await c.query(
      "INSERT INTO students(id,school_id,code,first_name,last_name,status) VALUES($1,$2,$3,$4,$5,$6)",
      [
        studentId,
        user.schoolId,
        input.code,
        input.firstName,
        input.lastName,
        input.status,
      ],
    );
  await c.query(
    `INSERT INTO enrollments(id,school_id,student_id,year,grade,section,schedule_id,valid_from,valid_until)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(school_id,student_id,year) DO UPDATE SET grade=excluded.grade,section=excluded.section,schedule_id=excluded.schedule_id`,
    [
      crypto.randomUUID(),
      user.schoolId,
      studentId,
      input.year,
      input.grade,
      input.section,
      input.scheduleId,
      `${input.year}-01-01`,
      `${input.year}-12-31`,
    ],
  );
  await audit(
    c,
    user.schoolId!,
    user.id,
    id ? "STUDENT_UPDATED" : "STUDENT_CREATED",
    studentId,
    { year: input.year, status: input.status },
  );
  return studentId;
}
export async function readManagement(
  c: PoolClient,
  user: AdminUser,
  resource: string,
  url: URL,
) {
  const page = Math.max(
      1,
      Math.min(100000, Number(url.searchParams.get("page")) || 1),
    ),
    limit = 25,
    offset = (page - 1) * limit;
  const q = (url.searchParams.get("q") || "").slice(0, 100);
  if (resource === "students") {
    const year =
      Number(url.searchParams.get("year")) || Number(schoolDate().slice(0, 4));
    const base = `FROM students s LEFT JOIN enrollments e ON e.student_id=s.id AND e.school_id=s.school_id AND e.year=$1 WHERE ($2='' OR s.code ILIKE '%'||$2||'%' OR s.first_name||' '||s.last_name ILIKE '%'||$2||'%')`;
    const rows = (
      await c.query(
        `SELECT s.*,e.id AS enrollment_id,e.year,e.grade,e.section,e.schedule_id,e.active ${base} ORDER BY s.last_name,s.first_name,s.id LIMIT $3 OFFSET $4`,
        [year, q, limit, offset],
      )
    ).rows;
    const total = Number(
      (await c.query(`SELECT count(*) ${base}`, [year, q])).rows[0].count,
    );
    return {
      rows: rows.map((r) => ({
        ...studentDto(r),
        code: r.code,
        year: r.year,
        scheduleId: r.schedule_id,
        enrollmentId: r.enrollment_id,
        enrollmentActive: r.active,
      })),
      total,
      page,
      limit,
    };
  }
  if (resource === "schedules")
    return {
      rows: (await c.query("SELECT * FROM schedules ORDER BY name")).rows,
    };
  if (resource === "calendar")
    return {
      rows: (
        await c.query(
          "SELECT * FROM calendar_days ORDER BY local_date DESC LIMIT 366",
        )
      ).rows,
    };
  if (resource === "users")
    return {
      rows: (
        await c.query(
          "SELECT id,username,full_name,role,active,must_change_password FROM users ORDER BY full_name",
        )
      ).rows,
    };
  if (resource === "terminals")
    return {
      rows: (
        await c.query(
          `SELECT t.*,coalesce((SELECT jsonb_agg(o.user_id) FROM terminal_operators o WHERE o.terminal_id=t.id),'[]'::jsonb) AS operators,coalesce((SELECT jsonb_agg(jsonb_build_object('id',sc.id,'protocol',sc.protocol,'baud_rate',sc.baud_rate)) FROM scanners sc WHERE sc.terminal_id=t.id),'[]'::jsonb) AS scanners FROM terminals t WHERE $1 OR EXISTS(SELECT 1 FROM terminal_operators o WHERE o.terminal_id=t.id AND o.user_id=$2) ORDER BY name`,
          [user.role === "admin", user.id],
        )
      ).rows,
    };
  if (resource === "recovery")
    return {
      rows: (
        await c.query(
          `SELECT r.id,r.event_id,r.payload_hash,r.created_at,r.reason,t.name AS terminal_name FROM recovery_cases r JOIN terminals t ON t.id=r.terminal_id WHERE NOT EXISTS(SELECT 1 FROM scan_receipts s WHERE s.terminal_id=r.terminal_id AND s.event_id=r.event_id AND s.payload_hash=r.payload_hash) ORDER BY r.created_at`,
        )
      ).rows,
    };
  if (resource === "review")
    return {
      rows: (
        await c.query(`SELECT a.id,a.student_id,a.direction,a.occurred_at,a.received_at,a.local_date,a.status,a.reason,s.first_name||' '||s.last_name AS student_name,s.code,t.name AS terminal_name
 FROM attendance_events a JOIN students s ON s.id=a.student_id JOIN terminals t ON t.id=a.terminal_id
 WHERE a.disposition='REVIEW' AND NOT EXISTS(SELECT 1 FROM attendance_adjustments j WHERE j.event_id=a.id) ORDER BY a.received_at LIMIT 200`)
      ).rows,
    };
  if (resource === "audit")
    return {
      rows: (
        await c.query(
          `SELECT a.id,a.action,a.entity_id,a.metadata,a.created_at,u.full_name AS actor FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id WHERE ($1='' OR a.action ILIKE '%'||$1||'%') ORDER BY a.created_at DESC,a.id LIMIT 100 OFFSET $2`,
          [q, offset],
        )
      ).rows,
      page,
    };
  if (resource === "notifications")
    return {
      rows: (
        await c.query(
          `SELECT n.*,r.read_at FROM notifications n LEFT JOIN notification_reads r ON r.notification_id=n.id AND r.user_id=$1 ORDER BY n.created_at DESC LIMIT 100`,
          [user.id],
        )
      ).rows,
    };
  if (resource === "settings")
    return {
      school: (await c.query("SELECT * FROM schools")).rows[0],
      synthetic: process.env.SCA_SYNTHETIC_DATA === "true",
      keys: (
        await c.query(
          "SELECT kid,purpose,active,created_at FROM signing_keys ORDER BY created_at DESC",
        )
      ).rows,
    };
  if (resource === "credentials") {
    const id = z.uuid().parse(url.searchParams.get("studentId"));
    return {
      rows: (
        await c.query(
          "SELECT id,student_id,kid,issued_at,expires_at,revoked_at FROM credentials WHERE student_id=$1 ORDER BY issued_at DESC",
          [id],
        )
      ).rows,
    };
  }
  throw new ApiProblem(404, "NOT_FOUND", "Apartado no encontrado.");
}
export async function writeManagement(
  c: PoolClient,
  user: AdminUser,
  resource: string,
  value: unknown,
) {
  const school = user.schoolId!;
  if (resource === "students") {
    const input = StudentInput.extend({ id: z.uuid().optional() }).parse(value);
    return { id: await saveStudent(c, user, input, input.id) };
  }
  if (resource === "schedules") {
    const v = z
      .object({
        id: z.uuid().optional(),
        name: z.string().trim().min(1).max(80),
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
        grace: z.number().int().min(0).max(120),
        weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
      })
      .parse(value);
    if (v.end <= v.start)
      throw new ApiProblem(
        400,
        "INVALID_SCHEDULE",
        "La salida debe ser posterior al inicio.",
      );
    const id = v.id || crypto.randomUUID();
    const old = v.id
      ? (await c.query("SELECT * FROM schedules WHERE id=$1 FOR UPDATE", [id]))
          .rows[0]
      : null;
    if (v.id && !old)
      throw new ApiProblem(404, "NOT_FOUND", "Horario no encontrado.");
    await c.query(
      `INSERT INTO schedules(id,school_id,name,start_time,end_time,grace_minutes,weekdays) VALUES($1,$2,$3,$4,$5,$6,$7)
  ON CONFLICT(id) DO UPDATE SET name=excluded.name,start_time=excluded.start_time,end_time=excluded.end_time,grace_minutes=excluded.grace_minutes,weekdays=excluded.weekdays,version=schedules.version+1`,
      [id, school, v.name, v.start, v.end, v.grace, v.weekdays],
    );
    await audit(c, school, user.id, "SCHEDULE_VERSION_SAVED", id, {
      before: old,
      after: v,
    });
    return { id };
  }
  if (resource === "calendar") {
    const v = z
      .object({
        date: z.iso.date(),
        teaching: z.boolean(),
        reason: z.string().trim().min(5).max(200),
      })
      .parse(value);
    await c.query(
      `INSERT INTO calendar_days(school_id,local_date,teaching,reason) VALUES($1,$2,$3,$4) ON CONFLICT(school_id,local_date) DO UPDATE SET teaching=excluded.teaching,reason=excluded.reason,version=calendar_days.version+1`,
      [school, v.date, v.teaching, v.reason],
    );
    await audit(c, school, user.id, "CALENDAR_UPDATED", v.date, v);
    return {};
  }
  if (resource === "terminals") {
    const v = z
      .object({
        id: z.uuid().optional(),
        name: z.string().trim().min(2).max(80),
        entranceId: z.string().regex(/^[A-Za-z0-9_-]{1,30}$/),
        scannerId: z.string().regex(/^[A-Za-z0-9_-]{1,20}$/),
        direction: z.enum(["ENTRY", "EXIT"]),
        enabled: z.boolean(),
        operators: z.array(z.uuid()).max(30),
        serialIds: z.string().max(200).default(""),
      })
      .parse(value);
    const id = v.id || crypto.randomUUID();
    await c.query(
      `INSERT INTO terminals(id,school_id,name,entrance_id,scanner_id,direction,enabled) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=excluded.name,entrance_id=excluded.entrance_id,scanner_id=excluded.scanner_id,direction=excluded.direction,enabled=excluded.enabled`,
      [id, school, v.name, v.entranceId, v.scannerId, v.direction, v.enabled],
    );
    const serialIds = v.serialIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      serialIds.length > 7 ||
      new Set([v.scannerId, ...serialIds]).size !== serialIds.length + 1 ||
      serialIds.some((s) => !/^[A-Za-z0-9_-]{1,20}$/.test(s))
    )
      throw new ApiProblem(
        400,
        "INVALID_SCANNERS",
        "Configura como máximo siete lectores serial adicionales con identificadores distintos.",
      );
    await c.query("DELETE FROM scanners WHERE terminal_id=$1", [id]);
    await c.query(
      "INSERT INTO scanners(school_id,terminal_id,id,protocol) VALUES($1,$2,$3,'HID')",
      [school, id, v.scannerId],
    );
    for (const scanner of serialIds)
      await c.query(
        "INSERT INTO scanners(school_id,terminal_id,id,protocol) VALUES($1,$2,$3,'SERIAL')",
        [school, id, scanner],
      );
    await c.query("DELETE FROM terminal_operators WHERE terminal_id=$1", [id]);
    for (const operator of v.operators)
      await c.query(
        "INSERT INTO terminal_operators(school_id,terminal_id,user_id) VALUES($1,$2,$3)",
        [school, id, operator],
      );
    if (v.id)
      await c.query(
        "UPDATE terminal_sessions SET revoked_at=now() WHERE terminal_id=$1 AND revoked_at IS NULL",
        [id],
      );
    await audit(c, school, user.id, "TERMINAL_UPDATED", id, {
      enabled: v.enabled,
      direction: v.direction,
      operatorCount: v.operators.length,
    });
    return { id };
  }
  if (resource === "users") {
    const v = z
      .object({
        id: z.uuid().optional(),
        username: z.string().regex(/^[a-zA-Z0-9_.-]{3,50}$/),
        fullName: z.string().trim().min(2).max(100),
        role: z.enum(["admin", "director", "secretary", "porter"]),
        active: z.boolean(),
        password: passwordSchema.optional(),
      })
      .parse(value);
    if (v.id === user.id && (!v.active || v.role !== "admin"))
      throw new ApiProblem(
        409,
        "SELF_LOCKOUT",
        "Conserva tu cuenta activa como administrador.",
      );
    const id = v.id || crypto.randomUUID();
    if (!v.id && !v.password)
      throw new ApiProblem(
        400,
        "PASSWORD_REQUIRED",
        "Define una contraseña inicial de al menos 12 caracteres.",
      );
    const passwordHash = v.password ? await bcrypt.hash(v.password, 12) : null;
    if (v.id) {
      const updated = await c.query(
        `UPDATE users SET username=$2,full_name=$3,role=$4,active=$5,password_hash=coalesce($6,password_hash),must_change_password=CASE WHEN $6::text IS NOT NULL THEN true ELSE must_change_password END WHERE id=$1 RETURNING id`,
        [id, v.username, v.fullName, v.role, v.active, passwordHash],
      );
      if (!updated.rowCount)
        throw new ApiProblem(404, "NOT_FOUND", "Usuario no encontrado.");
      await c.query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1", [
        id,
      ]);
      await c.query(
        "UPDATE terminal_sessions SET revoked_at=now() WHERE operator_id=$1",
        [id],
      );
    } else
      await c.query(
        "INSERT INTO users(id,school_id,username,full_name,role,active,password_hash) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id, school, v.username, v.fullName, v.role, v.active, passwordHash],
      );
    await audit(c, school, user.id, "USER_UPDATED", id, {
      role: v.role,
      active: v.active,
      passwordReset: Boolean(v.password),
    });
    return { id };
  }
  if (resource === "settings") {
    const v = z
      .object({ name: z.string().trim().min(3).max(120) })
      .parse(value);
    await c.query(
      "UPDATE schools SET name=$1,settings_version=settings_version+1",
      [v.name],
    );
    await audit(c, school, user.id, "SCHOOL_UPDATED", school);
    return {};
  }
  if (resource === "keys") {
    const v = z
      .object({ purpose: z.enum(["QR", "RECEIPT", "PERMIT"]) })
      .parse(value);
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${school}:${v.purpose}`,
    ]);
    const pair = await generateKeyPair("ES256", { extractable: true }),
      kid = crypto.randomUUID();
    await c.query(
      "UPDATE signing_keys SET active=false WHERE purpose=$1 AND active",
      [v.purpose],
    );
    await c.query(
      "INSERT INTO signing_keys(school_id,kid,purpose,public_jwk,private_jwk) VALUES($1,$2,$3,$4,$5)",
      [
        school,
        kid,
        v.purpose,
        await exportJWK(pair.publicKey),
        await exportJWK(pair.privateKey),
      ],
    );
    await audit(c, school, user.id, "SIGNING_KEY_ROTATED", kid, {
      purpose: v.purpose,
    });
    return { kid };
  }
  if (resource === "credentials") {
    const v = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("issue"),
          studentId: z.uuid(),
          expiresAt: z.iso.datetime(),
        }),
        z.object({
          action: z.literal("revoke"),
          id: z.uuid(),
          reason: z.string().trim().min(10).max(300),
        }),
      ])
      .parse(value);
    if (v.action === "revoke") {
      const r = await c.query(
        "UPDATE credentials SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL RETURNING id",
        [v.id],
      );
      if (!r.rowCount)
        throw new ApiProblem(
          409,
          "ALREADY_REVOKED",
          "La credencial ya está revocada o no existe.",
        );
      await audit(c, school, user.id, "CREDENTIAL_REVOKED", v.id, {
        reason: v.reason,
      });
      return {};
    }
    const seconds = Math.floor(
      (new Date(v.expiresAt).getTime() - Date.now()) / 1000,
    );
    if (seconds <= 0 || seconds > 366 * 86400)
      throw new ApiProblem(
        400,
        "INVALID_EXPIRY",
        "El carnet debe vencer dentro de los próximos 366 días.",
      );
    const student = (
      await c.query("SELECT * FROM students WHERE id=$1 AND status='ACTIVE'", [
        v.studentId,
      ])
    ).rows[0];
    if (!student)
      throw new ApiProblem(404, "NOT_FOUND", "Selecciona un alumno activo.");
    const id = crypto.randomUUID(),
      token = await signTokenArtifact(c, school, "QR", { jti: id }, seconds);
    const kid = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString(),
    ).kid;
    await c.query(
      "INSERT INTO credentials(id,school_id,student_id,kid,issued_at,expires_at) VALUES($1,$2,$3,$4,now(),$5)",
      [id, school, v.studentId, kid, v.expiresAt],
    );
    await audit(c, school, user.id, "CREDENTIAL_ISSUED", id, {
      studentId: v.studentId,
    });
    return { id, token: `SCA1:${token}`, student: studentDto(student) };
  }
  if (resource === "notifications") {
    const v = z.object({ id: z.uuid() }).parse(value);
    if (
      !(await c.query("SELECT id FROM notifications WHERE id=$1", [v.id]))
        .rowCount
    )
      throw new ApiProblem(404, "NOT_FOUND", "Aviso no encontrado.");
    await c.query(
      "INSERT INTO notification_reads(school_id,notification_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [school, v.id, user.id],
    );
    return {};
  }
  throw new ApiProblem(404, "NOT_FOUND", "Acción no encontrada.");
}
