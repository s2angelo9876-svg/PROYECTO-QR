import bcrypt from "bcryptjs";
import { pool, inSchool, audit } from "./db";
import { rateLimit } from "./rateLimit";
import type { AdminUser } from "./authToken";

export async function resolveSession(
  user: AdminUser,
): Promise<AdminUser | null> {
  if (!user.sessionId || !user.schoolId) return null;
  const { rows } = await pool().query("SELECT * FROM auth_session($1)", [
    user.sessionId,
  ]);
  const current = rows[0];
  if (!current || current.school_id !== user.schoolId || current.id !== user.id)
    return null;
  return {
    id: current.id,
    schoolId: current.school_id,
    sessionId: user.sessionId,
    username: current.username,
    fullName: current.full_name,
    role: current.role,
    mustChangePassword: current.must_change_password,
  };
}
export async function institutionLogin(
  username: string,
  password: string,
): Promise<{ user?: AdminUser; limited?: boolean }> {
  const schoolId = process.env.SCA_SCHOOL_ID;
  if (!schoolId) throw new Error("SCHOOL_CONFIGURATION_REQUIRED");
  await pool().query(
    "DELETE FROM login_limits WHERE key IN (SELECT key FROM login_limits WHERE reset_at<now() LIMIT 100)",
  );
  try {
    await rateLimit(pool(), `login-global:${schoolId}`, 100);
  } catch {
    return { limited: true };
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${schoolId}:${username.toLowerCase()}`),
  );
  const rateKey = Buffer.from(digest).toString("hex");
  const rate = await pool().query(
    `INSERT INTO login_limits(key,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes')
 ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_limits.reset_at<now() THEN 1 ELSE login_limits.attempts+1 END,
 reset_at=CASE WHEN login_limits.reset_at<now() THEN now()+interval '15 minutes' ELSE login_limits.reset_at END RETURNING attempts`,
    [rateKey],
  );
  if (rate.rows[0].attempts > 10) return { limited: true };
  const { rows } = await pool().query("SELECT * FROM auth_login($1,$2)", [
    schoolId,
    username,
  ]);
  const u = rows[0];
  // A fixed cost-12 hash keeps unknown usernames on the same password verification path.
  const valid = await bcrypt.compare(
    password,
    u?.password_hash ||
      "$2b$12$C6UzMDM.H6dfI/f/IKcEe.4TaYHwh.3GakPQwJP1fPqJZ7N6Q93Te",
  );
  if (!u || !valid) {
    await inSchool(schoolId, (c) =>
      audit(c, schoolId, null, "LOGIN_FAILED", u?.id || "unknown", {
        accountKey: rateKey,
      }),
    );
    return {};
  }
  const sessionId = crypto.randomUUID();
  await inSchool(schoolId, async (c) => {
    await c.query(
      "INSERT INTO sessions(id,school_id,user_id,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",
      [sessionId, schoolId, u.id],
    );
    await c.query("DELETE FROM login_limits WHERE key=$1", [rateKey]);
    await audit(c, schoolId, u.id, "SESSION_OPENED", sessionId);
  });
  return {
    user: {
      id: u.id,
      schoolId,
      sessionId,
      username: u.username,
      role: u.role,
      fullName: u.full_name,
      mustChangePassword: u.must_change_password,
    },
  };
}
