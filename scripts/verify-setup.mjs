import {
  mkdtemp,
  symlink,
  rm,
  mkdir,
  writeFile,
  readFile,
  readdir,
} from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import pg from "pg";
import { tmpdir } from "node:os";
const root = process.cwd(),
  temp = await mkdtemp(join(tmpdir(), "sca-setup-")),
  name = "sca_setup_" + randomBytes(5).toString("hex");
let containerCreated = false;
try {
  for (const path of ["scripts", "db", "node_modules"])
    await symlink(
      join(root, path),
      join(temp, path),
      process.platform === "win32" ? "junction" : "dir",
    );
  const child = spawn(
    process.execPath,
    [join(root, "scripts/setup-local.mjs")],
    {
      cwd: temp,
      env: {
        ...process.env,
        SCA_DB_CONTAINER: name,
        SCA_DB_PORT: process.env.SCA_SETUP_TEST_PORT || "54330",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (v) => (output += v));
  child.stderr.on("data", (v) => (output += v));
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  containerCreated = true;
  if (code !== 0) throw new Error("Fresh setup failed: " + output);
  const runtime = Object.fromEntries(
    (await readFile(join(temp, ".env.local"), "utf8"))
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  if (runtime.MIGRATION_DATABASE_URL)
    throw new Error("Owner credentials leaked into runtime configuration.");
  const client = new pg.Client({ connectionString: runtime.DATABASE_URL });
  await client.connect();
  let role, count;
  try {
    role = (await client.query("SELECT current_user")).rows[0].current_user;
    count = (await client.query("SELECT count(*) FROM students")).rows[0].count;
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.school_id',$1,true)", [
      runtime.SCA_SCHOOL_ID,
    ]);
    if (
      !(await client.query("SELECT 1 FROM users WHERE must_change_password"))
        .rowCount
    )
      throw new Error("Bootstrap password change was not enforced.");
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
  const report = {
    verifiedAt: new Date().toISOString(),
    freshCluster: true,
    migrations: (await readdir(join(root, "db/migrations"))).filter((f) =>
      f.endsWith(".sql"),
    ).length,
    runtimeRole: role,
    unscopedStudents: count,
    ownerOutsideRuntime: true,
    bootstrapRequiresPasswordChange: true,
  };
  await mkdir(join(root, "docs/evidencia"), { recursive: true });
  await writeFile(
    join(root, "docs/evidencia/instalacion.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "Fresh isolated setup verified; owner credentials are separated and RLS is active.",
  );
} finally {
  if (containerCreated) {
    try {
      execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" });
      execFileSync("docker", ["volume", "rm", name + "-data"], {
        stdio: "ignore",
      });
    } catch {}
  }
  await rm(temp, { recursive: true, force: true });
}
