import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import bcrypt from "bcryptjs";
import { exportJWK, generateKeyPair } from "jose";
import { migrate } from "./migrate.mjs";

if (existsSync(".env.local"))
  throw new Error(
    ".env.local already exists. Keep it; use npm run db:migrate for an existing installation.",
  );
const token = () => randomBytes(36).toString("base64url");
const ownerPassword = token(),
  appPassword = token(),
  adminPassword = process.env.SCA_BOOTSTRAP_PASSWORD || token();
const schoolId = randomUUID(),
  container = process.env.SCA_DB_CONTAINER || "sca-qr-postgres",
  port = process.env.SCA_DB_PORT || "54329";
const ownerUrl = `postgresql://postgres:${ownerPassword}@127.0.0.1:${port}/sca`;
const appUrl = `postgresql://sca_runtime:${appPassword}@127.0.0.1:${port}/sca`;
await mkdir("var", { recursive: true, mode: 0o700 });
const containerEnv = "var/postgres.env";
await writeFile(
  containerEnv,
  `POSTGRES_PASSWORD=${ownerPassword}\nPOSTGRES_DB=sca\n`,
  { mode: 0o600 },
);
execFileSync(
  "docker",
  [
    "run",
    "-d",
    "--name",
    container,
    "--restart",
    "unless-stopped",
    "--env-file",
    containerEnv,
    "-p",
    `127.0.0.1:${port}:5432`,
    "-v",
    `${container}-data:/var/lib/postgresql/data`,
    "postgres:17-alpine",
  ],
  { stdio: "ignore" },
);
const client = new pg.Client({ connectionString: ownerUrl });
let connected = false;
for (let i = 0; i < 30; i++) {
  try {
    const probe = new pg.Client({ connectionString: ownerUrl });
    await probe.connect();
    await probe.end();
    connected = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!connected)
  throw new Error(
    "PostgreSQL did not start. Inspect docker logs; retain var/postgres.env.",
  );
await migrate(ownerUrl);
await client.connect();
try {
  await client.query(
    `CREATE ROLE sca_runtime LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
  );
  await client.query(
    "GRANT CONNECT ON DATABASE sca TO sca_runtime; GRANT USAGE ON SCHEMA public TO sca_runtime; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO sca_runtime; GRANT DELETE ON login_limits,calendar_days,terminal_operators,scanners TO sca_runtime; GRANT EXECUTE ON FUNCTION auth_login(uuid,text),auth_session(uuid) TO sca_runtime",
  );
  await client.query("BEGIN");
  await client.query("INSERT INTO schools(id,name) VALUES($1,$2)", [
    schoolId,
    process.env.SCA_SCHOOL_NAME || "Institución por configurar",
  ]);
  const adminId = randomUUID(),
    scheduleId = randomUUID();
  await client.query(
    "INSERT INTO users(id,school_id,username,full_name,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)",
    [
      adminId,
      schoolId,
      "admin",
      "Administración",
      await bcrypt.hash(adminPassword, 12),
      "admin",
    ],
  );
  await client.query(
    "INSERT INTO schedules(id,school_id,name,start_time,end_time,grace_minutes) VALUES($1,$2,$3,$4,$5,$6)",
    [scheduleId, schoolId, "Mañana", "07:00", "13:00", 10],
  );
  for (const purpose of ["QR", "RECEIPT", "PERMIT"]) {
    const pair = await generateKeyPair("ES256", { extractable: true });
    await client.query(
      "INSERT INTO signing_keys(school_id,kid,purpose,public_jwk,private_jwk) VALUES($1,$2,$3,$4,$5)",
      [
        schoolId,
        randomUUID(),
        purpose,
        await exportJWK(pair.publicKey),
        await exportJWK(pair.privateKey),
      ],
    );
  }
  await client.query(
    "INSERT INTO terminals(id,school_id,name,entrance_id,scanner_id,direction) VALUES($1,$2,$3,$4,$5,$6)",
    [randomUUID(), schoolId, "Entrada principal", "PRINCIPAL", "N1", "ENTRY"],
  );
  const fixtures = process.argv.includes("--fixtures");
  if (fixtures) {
    const year = Number(
      new Intl.DateTimeFormat("en", {
        timeZone: "America/Lima",
        year: "numeric",
      }).format(new Date()),
    );
    for (let i = 1; i <= 120; i++) {
      const id = randomUUID();
      await client.query(
        "INSERT INTO students(id,school_id,code,first_name,last_name) VALUES($1,$2,$3,$4,$5)",
        [
          id,
          schoolId,
          `TEST${String(i).padStart(4, "0")}`,
          `Alumno ${i}`,
          "Sintético",
        ],
      );
      await client.query(
        "INSERT INTO enrollments(id,school_id,student_id,year,grade,section,schedule_id,valid_from,valid_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          randomUUID(),
          schoolId,
          id,
          year,
          String((i % 5) + 1),
          i % 2 ? "A" : "B",
          scheduleId,
          `${year}-01-01`,
          `${year}-12-31`,
        ],
      );
    }
  }
  await client.query("COMMIT");
  await writeFile(
    ".env.local",
    `DATABASE_URL=${appUrl}\nSCA_SCHOOL_ID=${schoolId}\nJWT_SECRET=${token()}\nSCA_DEMO_MODE=false\nSCA_EMAIL_ENABLED=false\nSCA_SYNTHETIC_DATA=${fixtures}\nNEXT_TELEMETRY_DISABLED=1\nSCA_DB_CONTAINER=${container}\n`,
    { mode: 0o600 },
  );
  await writeFile(
    "var/maintenance.env",
    `MIGRATION_DATABASE_URL=${ownerUrl}\n`,
    { mode: 0o600 },
  );
  await writeFile("var/backup.key", token(), { mode: 0o600 });
  await writeFile(
    "var/bootstrap.txt",
    `Usuario inicial: admin\nContraseña inicial: ${adminPassword}\nCambiar en Configuración → Cuenta al entrar.\n${fixtures ? "Instalación de pruebas: 120 alumnos SINTÉTICOS.\n" : ""}`,
    { mode: 0o600 },
  );
  console.log(
    "PostgreSQL, migrations and local configuration ready. Initial access is in var/bootstrap.txt (private file). Change the password before operation.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
