import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import pg from "pg";
import { loadLocalEnv } from "./local-env.mjs";
import { tableManifest, childCommand, encryptDump } from "./backup-lib.mjs";
loadLocalEnv({ maintenance: true });
const path = process.argv[2];
if (!path) throw new Error("Usage: npm run backup -- /path/to/copy.sca");
if (existsSync(path) || existsSync(path + ".partial"))
  throw new Error("The destination already exists. Choose a new file.");
await mkdir(dirname(resolve(path)), { recursive: true, mode: 0o700 });
const client = new pg.Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
});
await client.connect();
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL timezone='UTC'");
  const snapshot = (await client.query("SELECT pg_export_snapshot() AS id"))
      .rows[0].id,
    manifest = {
      format: "sca-recovery-manifest",
      version: 1,
      createdAt: new Date().toISOString(),
      tables: await tableManifest(client),
    };
  const container = process.env.SCA_DB_CONTAINER || "sca-qr-postgres",
    database = new URL(process.env.MIGRATION_DATABASE_URL).pathname.slice(1);
  const { child, done } = childCommand([
    "exec",
    container,
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    database,
    "--format=custom",
    "--no-owner",
    "--no-acl",
    `--snapshot=${snapshot}`,
  ]);
  await encryptDump(resolve(path), manifest, child.stdout, done);
  await client.query("COMMIT");
  console.log(
    `Encrypted backup created: ${resolve(path)}. Verify a restore before relying on it.`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
