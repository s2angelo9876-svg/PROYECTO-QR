import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  institutionApi,
  jsonInput,
  ALL_ROLES,
  ApiProblem,
} from "@/lib/institutionApi";
import { passwordSchema } from "@/lib/management";
import { audit } from "@/lib/db";
export async function POST(req: NextRequest) {
  return institutionApi(req, ALL_ROLES, async (u, c) => {
    const v = await jsonInput(
      req,
      z.object({
        currentPassword: z.string().min(1).max(200),
        newPassword: passwordSchema,
      }),
    );
    const row = (
      await c.query("SELECT password_hash FROM users WHERE id=$1 FOR UPDATE", [
        u.id,
      ])
    ).rows[0];
    if (!(await bcrypt.compare(v.currentPassword, row.password_hash)))
      throw new ApiProblem(
        400,
        "INVALID_PASSWORD",
        "La contraseña actual no coincide.",
      );
    if (await bcrypt.compare(v.newPassword, row.password_hash))
      throw new ApiProblem(
        400,
        "PASSWORD_REUSED",
        "Elige una contraseña diferente a la actual.",
      );
    await c.query(
      "UPDATE users SET password_hash=$2,must_change_password=false WHERE id=$1",
      [u.id, await bcrypt.hash(v.newPassword, 12)],
    );
    await c.query(
      "UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2",
      [u.id, u.sessionId],
    );
    await c.query(
      "UPDATE terminal_sessions SET revoked_at=now() WHERE operator_id=$1",
      [u.id],
    );
    await audit(c, u.schoolId!, u.id, "PASSWORD_CHANGED", u.id);
    return {};
  });
}
