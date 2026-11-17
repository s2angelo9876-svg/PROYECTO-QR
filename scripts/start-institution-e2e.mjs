import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import pg from "pg";
import { loadLocalEnv } from "./local-env.mjs";
import { seedInstitution } from "../tests/helpers/institution.mts";
loadLocalEnv({ maintenance: true });
if (!process.env.MIGRATION_DATABASE_URL || !process.env.DATABASE_URL)
  throw new Error("Run npm run setup:local before institutional E2E tests.");
const dbName = "sca_e2e_" + randomBytes(6).toString("hex"),
  ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL),
  appUrl = new URL(process.env.DATABASE_URL),
  owner = new pg.Client({ connectionString: ownerUrl.toString() });
await owner.connect();
await owner.query(`CREATE DATABASE "${dbName}"`);
ownerUrl.pathname = "/" + dbName;
appUrl.pathname = "/" + dbName;
const client = new pg.Client({ connectionString: ownerUrl.toString() });
await client.connect();
for (const name of (await readdir("db/migrations"))
  .filter((n) => n.endsWith(".sql"))
  .sort())
  await client.query(await readFile("db/migrations/" + name, "utf8"));
await client.query(
  'GRANT CONNECT ON DATABASE "' +
    dbName +
    '" TO sca_runtime; GRANT USAGE ON SCHEMA public TO sca_runtime; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO sca_runtime; GRANT DELETE ON login_limits,calendar_days,terminal_operators,scanners TO sca_runtime; GRANT EXECUTE ON FUNCTION auth_login(uuid,text),auth_session(uuid) TO sca_runtime',
);
const fixture = await seedInstitution(client, 120, true);
await client.end();
await mkdir("var", { recursive: true, mode: 0o700 });
await writeFile(
  process.env.SCA_FIXTURE_FILE || "var/e2e-fixture.json",
  JSON.stringify(fixture),
  {
    mode: 0o600,
  },
);
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    process.env.SCA_E2E_PORT || "3101",
    "-H",
    "localhost",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: appUrl.toString(),
      MIGRATION_DATABASE_URL: "",
      SCA_SCHOOL_ID: fixture.schoolId,
      SCA_DEMO_MODE: "false",
      SCA_SYNTHETIC_DATA: "true",
      JWT_SECRET: randomBytes(48).toString("base64url"),
    },
  },
);
let cleaning;
async function cleanup() {
  if (cleaning) return cleaning;
  cleaning = (async () => {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      if (server.exitCode !== null || server.signalCode !== null) resolve();
      else server.once("exit", resolve);
    });
    await owner.query(`DROP DATABASE "${dbName}" WITH(FORCE)`);
    await owner.end();
  })();
  return cleaning;
}
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => void cleanup().then(() => process.exit(0)));
server.on("exit", () => void cleanup());
