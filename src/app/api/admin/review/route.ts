import { NextRequest } from "next/server";
import { z } from "zod";
import {
  institutionApi,
  jsonInput,
  REVIEW_ROLES,
  ApiProblem,
} from "@/lib/institutionApi";
import { audit } from "@/lib/db";
export async function POST(req: NextRequest) {
  return institutionApi(req, REVIEW_ROLES, async (u, c) => {
    const v = await jsonInput(
      req,
      z.discriminatedUnion("decision", [
        z.object({
          decision: z.enum(["ACCEPT", "REJECT"]),
          eventId: z.uuid(),
          reason: z.string().trim().min(10).max(500),
        }),
        z.object({
          decision: z.literal("JUSTIFY"),
          enrollmentId: z.uuid(),
          date: z.iso.date(),
          reason: z.string().trim().min(10).max(500),
        }),
      ]),
    );
    let enrollmentId: string,
      date: string,
      eventId: string | null = null,
      event;
    if (v.decision === "JUSTIFY") {
      enrollmentId = v.enrollmentId;
      date = v.date;
    } else {
      event = (
        await c.query(
          "SELECT * FROM attendance_events WHERE id=$1 AND disposition='REVIEW'",
          [v.eventId],
        )
      ).rows[0];
      if (!event)
        throw new ApiProblem(
          404,
          "NOT_FOUND",
          "La incidencia ya no está disponible.",
        );
      enrollmentId = event.enrollment_id;
      date = new Date(event.local_date).toISOString().slice(0, 10);
      eventId = event.id;
    }
    if (
      !(await c.query("SELECT id FROM enrollments WHERE id=$1", [enrollmentId]))
        .rowCount
    )
      throw new ApiProblem(404, "NOT_FOUND", "Matrícula no encontrada.");
    await c.query(
      "INSERT INTO daily_attendance(school_id,enrollment_id,local_date) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [u.schoolId, enrollmentId, date],
    );
    const before = (
      await c.query(
        "SELECT * FROM daily_attendance WHERE enrollment_id=$1 AND local_date=$2 FOR UPDATE",
        [enrollmentId, date],
      )
    ).rows[0];
    if (
      eventId &&
      (
        await c.query(
          "SELECT id FROM attendance_adjustments WHERE event_id=$1",
          [eventId],
        )
      ).rowCount
    )
      throw new ApiProblem(
        409,
        "ALREADY_RESOLVED",
        "Otra persona ya resolvió esta incidencia.",
      );
    if (v.decision === "ACCEPT") {
      if (
        (event.direction === "ENTRY" && before.first_entry) ||
        (event.direction === "EXIT" &&
          (before.last_exit ||
            !before.first_entry ||
            new Date(event.occurred_at) < new Date(before.first_entry)))
      )
        throw new ApiProblem(
          409,
          "SEQUENCE_CONFLICT",
          "Esta captura entra en conflicto con la secuencia del día. Rechaza el duplicado o revisa primero la entrada.",
        );
      await c.query(
        `UPDATE daily_attendance SET first_entry=CASE WHEN $3='ENTRY' THEN $4 ELSE first_entry END,last_exit=CASE WHEN $3='EXIT' THEN $4 ELSE last_exit END,
   state=CASE WHEN $3='ENTRY' THEN $5 ELSE state END,version=version+1 WHERE enrollment_id=$1 AND local_date=$2`,
        [enrollmentId, date, event.direction, event.occurred_at, event.status],
      );
    }
    if (v.decision === "JUSTIFY") {
      if (before.first_entry)
        throw new ApiProblem(
          409,
          "ALREADY_PRESENT",
          "El alumno ya tiene presencia registrada. La justificación corresponde a días sin entrada.",
        );
      await c.query(
        "UPDATE daily_attendance SET state='JUSTIFIED',version=version+1 WHERE enrollment_id=$1 AND local_date=$2",
        [enrollmentId, date],
      );
    }
    const after = (
        await c.query(
          "SELECT * FROM daily_attendance WHERE enrollment_id=$1 AND local_date=$2",
          [enrollmentId, date],
        )
      ).rows[0],
      id = crypto.randomUUID();
    await c.query(
      "INSERT INTO attendance_adjustments(id,school_id,event_id,enrollment_id,local_date,actor_id,reason,decision,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        id,
        u.schoolId,
        eventId,
        enrollmentId,
        date,
        u.id,
        v.reason,
        v.decision,
        before,
        after,
      ],
    );
    await audit(c, u.schoolId!, u.id, "ATTENDANCE_ADJUDICATED", id, {
      decision: v.decision,
      eventId,
    });
    return { id };
  });
}
