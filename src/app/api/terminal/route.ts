import { NextRequest } from "next/server";
import { z } from "zod";
import {
  institutionApi,
  jsonInput,
  ALL_ROLES,
  ApiProblem,
} from "@/lib/institutionApi";
import { readManagement } from "@/lib/management";
import { signTokenArtifact } from "@/lib/artifacts";
import { audit } from "@/lib/db";
import { schoolDate } from "@/lib/schoolClock";
import { studentDto } from "@/lib/studentDto";
export async function GET(req: NextRequest) {
  return institutionApi(req, ALL_ROLES, async (u, c) => ({
    user: u,
    ...(await readManagement(c, u, "terminals", req.nextUrl)),
  }));
}
export async function POST(req: NextRequest) {
  return institutionApi(req, ALL_ROLES, async (u, c) => {
    const { terminalId } = await jsonInput(
      req,
      z.object({ terminalId: z.uuid() }),
    );
    const terminal = (
      await c.query(
        "SELECT * FROM terminals WHERE id=$1 AND enabled FOR SHARE",
        [terminalId],
      )
    ).rows[0];
    if (
      !terminal ||
      (u.role !== "admin" &&
        !(
          await c.query(
            "SELECT 1 FROM terminal_operators WHERE terminal_id=$1 AND user_id=$2",
            [terminalId, u.id],
          )
        ).rowCount)
    )
      throw new ApiProblem(
        403,
        "TERMINAL_FORBIDDEN",
        "Administración debe asignarte esta terminal.",
      );
    const sid = crypto.randomUUID(),
      expiresAt = new Date(Date.now() + 8 * 3600000).toISOString();
    await c.query(
      "INSERT INTO terminal_sessions(id,school_id,terminal_id,operator_id,expires_at) VALUES($1,$2,$3,$4,$5)",
      [sid, u.schoolId, terminalId, u.id, expiresAt],
    );
    const permit = await signTokenArtifact(
      c,
      u.schoolId!,
      "PERMIT",
      {
        sid,
        sub: u.id,
        terminal_id: terminalId,
        direction: terminal.direction,
      },
      8 * 3600,
    );
    const year = Number(schoolDate().slice(0, 4));
    const students = (
      await c.query(
        `SELECT s.*,e.grade,e.section,e.schedule_id FROM students s JOIN enrollments e ON e.student_id=s.id AND e.school_id=s.school_id WHERE e.active AND e.year=$1`,
        [year],
      )
    ).rows.map(studentDto);
    const credentials = (
      await c.query(
        "SELECT id,student_id,revoked_at FROM credentials WHERE expires_at>now()",
      )
    ).rows;
    const keys = (
      await c.query("SELECT kid,purpose,public_jwk FROM signing_keys")
    ).rows;
    const schedules = (
      await c.query(
        "SELECT id,start_time,end_time,grace_minutes,weekdays,version FROM schedules",
      )
    ).rows;
    await audit(c, u.schoolId!, u.id, "TERMINAL_SESSION_OPENED", sid, {
      terminalId,
    });
    return {
      snapshot: {
        version: 1,
        schoolId: u.schoolId,
        terminal,
        permit,
        sessionId: sid,
        operatorId: u.id,
        expiresAt,
        serverTime: new Date().toISOString(),
        students,
        credentials,
        keys,
        schedules,
        scanners: (
          await c.query(
            "SELECT id,protocol,baud_rate FROM scanners WHERE terminal_id=$1 AND enabled ORDER BY id",
            [terminalId],
          )
        ).rows,
      },
    };
  });
}
