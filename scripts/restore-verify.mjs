import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import pg from "pg";
import { loadLocalEnv } from "./local-env.mjs";
import { decryptDump, tableManifest, childCommand } from "./backup-lib.mjs";
loadLocalEnv({ maintenance: true });
const path = process.argv[2];
if (!path)
  throw new Error("Usage: npm run restore:verify -- copy.sca [--keep]");
const keep = process.argv.includes("--keep"),
  database = `sca_verify_${randomBytes(6).toString("hex")}`,
  temp = `var/${database}.dump`,
  started = Date.now();
await mkdir("var", { recursive: true, mode: 0o700 });
const manifest = await decryptDump(path, temp),
  url = new URL(process.env.MIGRATION_DATABASE_URL),
  owner = new pg.Client({ connectionString: url.toString() });
await owner.connect();
let created = false,
  restored;
try {
  await owner.query(`CREATE DATABASE "${database}"`);
  created = true;
  const { child, done } = childCommand([
    "exec",
    "-i",
    process.env.SCA_DB_CONTAINER || "sca-qr-postgres",
    "pg_restore",
    "-U",
    "postgres",
    "-d",
    database,
    "--exit-on-error",
    "--no-owner",
    "--no-acl",
  ]);
  await pipeline(createReadStream(temp), child.stdin);
  await done;
  url.pathname = "/" + database;
  restored = new pg.Client({ connectionString: url.toString() });
  await restored.connect();
  await restored.query("SET timezone='UTC'");
  const actual = await tableManifest(restored);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.tables))
    throw new Error(
      "Restore reconciliation failed: counts or fingerprints differ.",
    );
  const grants =
    "GRANT USAGE ON SCHEMA public TO sca_runtime; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO sca_runtime; GRANT DELETE ON login_limits,calendar_days,terminal_operators,scanners TO sca_runtime; GRANT EXECUTE ON FUNCTION auth_login(uuid,text),auth_session(uuid) TO sca_runtime";
  await restored.query(grants);
  const report = {
    verifiedAt: new Date().toISOString(),
    sourceCreatedAt: manifest.createdAt,
    seconds: (Date.now() - started) / 1000,
    tables: Object.keys(actual).length,
    fingerprintsMatch: true,
    kept: keep,
    database: keep ? database : undefined,
  };
  await writeFile(
    "var/last-restore-verification.json",
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  console.log(
    `Restore verified: ${report.tables} table fingerprints match; ${report.seconds}s.${keep ? ` Retained database: ${database}` : " Isolated database will be removed."}`,
  );
} finally {
  if (restored) await restored.end();
  if (created && !keep)
    await owner.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await owner.end();
  await rm(temp, { force: true });
}
