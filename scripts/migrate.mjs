import { readdir, readFile } from "node:fs/promises";
import pg from "pg";
import { loadLocalEnv } from "./local-env.mjs";
loadLocalEnv({ maintenance: true });
export async function migrate(
  connectionString = process.env.MIGRATION_DATABASE_URL,
) {
  if (!connectionString) throw new Error("MIGRATION_DATABASE_URL is required");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(8200401)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await readdir("db/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      if (
        (
          await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
            name,
          ])
        ).rowCount
      )
        continue;
      await client.query("BEGIN");
      try {
        await client.query(await readFile(`db/migrations/${name}`, "utf8"));
        await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
          name,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      console.log(`Migration applied: ${name}`);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(8200401)");
    await client.end();
  }
}
if (process.argv[1]?.endsWith("migrate.mjs")) await migrate();
