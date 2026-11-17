import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import bcrypt from "bcryptjs";
import { loadLocalEnv } from "./local-env.mjs";
loadLocalEnv({ maintenance: true });
const username = process.argv[2],
  file = process.env.SCA_PASSWORD_FILE;
if (!username || !file)
  throw new Error(
    "Usage: set SCA_PASSWORD_FILE to a protected password file, then npm run user:reset -- username. Verify the requester’s identity first.",
  );
const password = (await readFile(file, "utf8")).trim();
if (password.length < 12 || Buffer.byteLength(password) > 72)
  throw new Error("Use 12 characters or more and no more than 72 UTF-8 bytes.");
const client = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
await client.connect();
try {
  await client.query("BEGIN");
  const user = (
    await client.query(
      "SELECT id FROM users WHERE school_id=$1 AND username=$2 FOR UPDATE",
      [process.env.SCA_SCHOOL_ID, username],
    )
  ).rows[0];
  if (!user) throw new Error("Account not found in the configured school.");
  await client.query(
    "UPDATE users SET password_hash=$2,must_change_password=true WHERE id=$1",
    [user.id, await bcrypt.hash(password, 12)],
  );
  await client.query("UPDATE sessions SET revoked_at=now() WHERE user_id=$1", [
    user.id,
  ]);
  await client.query(
    "UPDATE terminal_sessions SET revoked_at=now() WHERE operator_id=$1",
    [user.id],
  );
  await client.query(
    "INSERT INTO audit_log(id,school_id,action,entity_id,metadata) VALUES($1,$2,$3,$4,$5)",
    [
      randomUUID(),
      process.env.SCA_SCHOOL_ID,
      "PASSWORD_RESET_BY_MAINTAINER",
      user.id,
      { requestId: randomUUID() },
    ],
  );
  await client.query("COMMIT");
  console.log(
    "Password reset, sessions revoked and audit recorded. Deliver the temporary password through the institution’s verified process.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
