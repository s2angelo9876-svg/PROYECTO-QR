import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";
import { originGuard } from "@/lib/demoMode";
import { getCurrentUser } from "@/lib/auth";
import { databaseConfigured, inSchool, audit } from "@/lib/db";
import { publicUrl } from "@/lib/publicOrigin";

export async function POST(request: Request) {
  const denied = originGuard(request);
  if (denied) return denied;
  if (databaseConfigured()) {
    const user = await getCurrentUser();
    if (user?.sessionId && user.schoolId)
      await inSchool(user.schoolId, async (c) => {
        await c.query("UPDATE sessions SET revoked_at=now() WHERE id=$1", [
          user.sessionId,
        ]);
        await c.query(
          "UPDATE terminal_sessions SET revoked_at=now() WHERE operator_id=$1 AND revoked_at IS NULL",
          [user.id],
        );
        await audit(
          c,
          user.schoolId!,
          user.id,
          "SESSION_CLOSED",
          user.sessionId!,
        );
      });
  }
  const response = NextResponse.redirect(
    publicUrl("/admin/login", request),
    303,
  );
  clearAuthCookie(response);
  return response;
}
