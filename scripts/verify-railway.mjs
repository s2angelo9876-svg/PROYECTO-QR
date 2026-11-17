// Local container rehearsal only: this script never calls Railway or deploys services.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const image = process.env.SCA_VERIFY_IMAGE || "sca-qr:railway-check";
const name = `sca_railway_${randomBytes(5).toString("hex")}`;
const directory = resolve("var", name);
const output = `${directory}/bootstrap`;
const password = randomBytes(36).toString("base64url");
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const pause = () => new Promise((resolve) => setTimeout(resolve, 400));
let network = false,
  database = false,
  web = false;
try {
  docker("image", "inspect", image);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(
    `${directory}/postgres.env`,
    `POSTGRES_PASSWORD=${password}\nPOSTGRES_DB=sca_cloud\n`,
    { mode: 0o600 },
  );
  docker("network", "create", name);
  network = true;
  docker(
    "run",
    "-d",
    "--name",
    `${name}_db`,
    "--network",
    name,
    "--network-alias",
    "postgres",
    "--env-file",
    `${directory}/postgres.env`,
    "-p",
    "127.0.0.1::5432",
    "postgres:17-alpine",
  );
  database = true;
  const dbPort = docker("port", `${name}_db`, "5432/tcp").split(":").at(-1);
  const ownerUrl = `postgresql://postgres:${password}@127.0.0.1:${dbPort}/sca_cloud`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    const client = new pg.Client({
      connectionString: ownerUrl,
      connectionTimeoutMillis: 1000,
    });
    try {
      await client.connect();
      ready = true;
      break;
    } catch {
      await pause();
    } finally {
      await client.end();
    }
  }
  assert.ok(ready, "Isolated PostgreSQL did not become ready");
  const bootstrapEnv = {
    ...process.env,
    MIGRATION_DATABASE_URL: ownerUrl,
    SCA_SETUP_OUTPUT_DIR: output,
    SCA_RUNTIME_DATABASE_HOST: "postgres",
    SCA_PUBLIC_ORIGIN: "https://school.example",
  };
  const initialize = () =>
    spawnSync(process.execPath, ["scripts/bootstrap-database.mjs"], {
      env: bootstrapEnv,
      encoding: "utf8",
    });
  assert.equal(
    initialize().status,
    0,
    "Fresh external database bootstrap failed",
  );
  assert.notEqual(
    initialize().status,
    0,
    "Bootstrap must refuse an existing institution",
  );
  const runtimeText = await readFile(`${output}/runtime.env`, "utf8");
  const runtime = Object.fromEntries(
    runtimeText
      .trim()
      .split("\n")
      .map((line) => [
        line.slice(0, line.indexOf("=")),
        line.slice(line.indexOf("=") + 1),
      ]),
  );
  assert.ok(
    !runtime.MIGRATION_DATABASE_URL,
    "Maintenance credentials entered runtime",
  );
  const runtimeUrl = new URL(runtime.DATABASE_URL);
  runtimeUrl.hostname = "127.0.0.1";
  runtimeUrl.port = dbPort;
  const client = new pg.Client({ connectionString: runtimeUrl.href });
  await client.connect();
  try {
    const role = (
      await client.query(
        "SELECT rolsuper,rolbypassrls,rolcreaterole FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    assert.deepEqual(role, {
      rolsuper: false,
      rolbypassrls: false,
      rolcreaterole: false,
    });
    assert.equal(
      (await client.query("SELECT count(*) FROM schools")).rows[0].count,
      "0",
      "School scope must be required",
    );
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.school_id',$1,true)", [
      runtime.SCA_SCHOOL_ID,
    ]);
    assert.equal(
      (await client.query("SELECT count(*) FROM students")).rows[0].count,
      "0",
    );
    assert.equal(
      (await client.query("SELECT count(*) FROM signing_keys")).rows[0].count,
      "3",
    );
    assert.equal(
      (await client.query("SELECT must_change_password FROM users")).rows[0]
        .must_change_password,
      true,
    );
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
  docker(
    "run",
    "-d",
    "--name",
    `${name}_web`,
    "--network",
    name,
    "--env-file",
    `${output}/runtime.env`,
    "-e",
    "PORT=4517",
    "-e",
    "RAILWAY_ENVIRONMENT_ID=local-rehearsal",
    "-p",
    "127.0.0.1::4517",
    image,
  );
  web = true;
  const port = docker("port", `${name}_web`, "4517/tcp").split(":").at(-1);
  const base = `http://127.0.0.1:${port}`;
  let healthy = false;
  for (let i = 0; i < 100; i++) {
    try {
      if (
        (
          await fetch(`${base}/api/ready`, {
            signal: AbortSignal.timeout(2000),
          })
        ).ok
      ) {
        healthy = true;
        break;
      }
    } catch {}
    await pause();
  }
  assert.ok(healthy, "Web image failed its database readiness check");
  const uid = docker(
    "exec",
    `${name}_web`,
    "node",
    "-e",
    "process.stdout.write(String(process.getuid()))",
  );
  assert.notEqual(uid, "0", "Web image must run without root");
  docker(
    "exec",
    `${name}_web`,
    "node",
    "-e",
    "const fs=require('fs'); for(const path of ['.env.local','var','.git','node_modules/vitest']) if(fs.existsSync(path)) process.exit(1); if(!fs.existsSync('.next/server/app/ingreso.html')) process.exit(1);",
  );
  const redirect = await fetch(`${base}/admin/dashboard`, {
    redirect: "manual",
  });
  assert.equal(redirect.status, 307);
  assert.ok(
    redirect.headers
      .get("location")
      .startsWith("https://school.example/admin/login"),
  );
  const entry = await fetch(`${base}/ingreso`);
  assert.equal(entry.status, 200);
  assert.match(
    entry.headers.get("content-security-policy"),
    /script-src 'self' 'sha256-/,
  );
  const credential = (await readFile(`${output}/bootstrap.txt`, "utf8")).match(
    /Contraseña inicial: (\S+)/,
  )[1];
  const login = async (origin) =>
    fetch(`${base}/api/admin/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "https",
      },
      body: JSON.stringify({ username: "admin", password: credential }),
    });
  const authenticated = await login("https://school.example");
  assert.equal(
    authenticated.status,
    200,
    "HTTPS public origin must work behind the proxy",
  );
  assert.equal((await authenticated.json()).user.mustChangePassword, true);
  assert.match(authenticated.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(authenticated.headers.get("set-cookie"), /Secure/i);
  assert.equal(
    (await login("https://attacker.example")).status,
    403,
    "Forwarded headers must not authorize another origin",
  );
  const report = {
    verifiedAt: new Date().toISOString(),
    scope:
      "Local Docker rehearsal using Railway configuration; not a Railway deployment.",
    imageId: docker("image", "inspect", image, "--format", "{{.Id}}"),
    cleanBuildWithoutInstallationSecrets: true,
    freshExternalDatabase: true,
    repeatBootstrapRefused: true,
    syntheticStudentsCreated: 0,
    runtimeRoleWithoutBypassOrSuperuser: true,
    maintenanceCredentialsOutsideRuntime: true,
    requiresInitialPasswordChange: true,
    nonRootRuntime: true,
    assignedPort: 4517,
    databaseReadiness: "passed",
    httpsOriginLoginAndRedirects: "passed",
    forgedOriginRejected: true,
    secureHttpOnlyCookie: true,
    publicShellCspHashesPreserved: true,
    railwayDeployment:
      "pending account access, project creation and free credit verification",
  };
  await writeFile(
    "docs/evidencia/railway-preparacion.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "Railway container rehearsal passed: fresh database, restricted role, assigned port, HTTPS proxy, secure session and clean non-root image.",
  );
} finally {
  if (web) docker("rm", "-f", `${name}_web`);
  if (database) docker("rm", "-f", "-v", `${name}_db`);
  if (network) docker("network", "rm", name);
  await rm(directory, { recursive: true, force: true });
}
