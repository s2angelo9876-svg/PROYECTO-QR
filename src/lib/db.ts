import { Pool, type PoolClient } from "pg";

const globalDb = globalThis as unknown as { scaPool?: Pool };
export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
export function pool() {
  if (!databaseConfigured()) throw new Error("DATABASE_CONFIGURATION_REQUIRED");
  if (!globalDb.scaPool) {
    globalDb.scaPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    globalDb.scaPool.on("error", () =>
      console.warn("[db] IDLE_CONNECTION_LOST"),
    );
  }
  return globalDb.scaPool;
}
export async function inSchool<T>(
  schoolId: string,
  fn: (client: PoolClient) => Promise<T>,
  isolation = "READ COMMITTED",
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query(
      `BEGIN ISOLATION LEVEL ${isolation === "REPEATABLE READ" ? "REPEATABLE READ" : "READ COMMITTED"}`,
    );
    await client.query(
      "SELECT set_config('app.school_id',$1,true),set_config('app.request_id',$2,true),set_config('statement_timeout','15000',true),set_config('lock_timeout','8000',true)",
      [schoolId, crypto.randomUUID()],
    );
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function audit(
  client: PoolClient,
  schoolId: string,
  actor: string | null,
  action: string,
  entity: string,
  metadata: object = {},
) {
  await client.query(
    "INSERT INTO audit_log(id,school_id,actor_id,action,entity_id,metadata) VALUES($1,$2,$3,$4,$5,$6)",
    [crypto.randomUUID(), schoolId, actor, action, entity, metadata],
  );
}
