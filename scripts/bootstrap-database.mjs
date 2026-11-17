import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";
import { exportJWK, generateKeyPair } from "jose";
import { configuredPublicOrigin } from "../src/lib/publicOrigin.ts";

// Explicit maintenance credentials only. Never silently select the local installation.
const ownerUrl = process.env.MIGRATION_DATABASE_URL;
if (!ownerUrl)
  throw new Error(
    "Set MIGRATION_DATABASE_URL through a private maintenance environment file.",
  );
const database = new URL(ownerUrl);
if (!["postgres:", "postgresql:"].includes(database.protocol))
  throw new Error("A PostgreSQL maintenance URL is required.");
const origin = configuredPublicOrigin();
const output = resolve(
  process.env.SCA_SETUP_OUTPUT_DIR || "var/database-bootstrap",
);
const token = () => randomBytes(36).toString("base64url");
const appPassword = token(),
  adminPassword = token(),
  schoolId = randomUUID();
const runtimeUrl = new URL(ownerUrl);
runtimeUrl.username = "sca_runtime";
runtimeUrl.password = appPassword;
if (process.env.SCA_RUNTIME_DATABASE_HOST) {
  const hostname = process.env.SCA_RUNTIME_DATABASE_HOST;
  if (!/^[a-zA-Z0-9.-]+$/.test(hostname))
    throw new Error("Invalid runtime database hostname.");
  runtimeUrl.hostname = hostname;
  runtimeUrl.port = process.env.SCA_RUNTIME_DATABASE_PORT || "5432";
  // Public connection SSL settings do not describe Railway's private network.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    runtimeUrl.searchParams.delete(key);
}

async function bootstrap() {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  let transaction = false;
  try {
    await client.query("SELECT pg_advisory_lock(8200402)");
    const existing = await client.query(
      "SELECT to_regclass('public.schools') AS schools",
    );
    if (
      existing.rows[0].schools &&
      (await client.query("SELECT 1 FROM schools LIMIT 1")).rowCount
    )
      throw new Error("DATABASE_ALREADY_INITIALIZED");
    if (
      (await client.query("SELECT 1 FROM pg_roles WHERE rolname='sca_runtime'"))
        .rowCount
    )
      throw new Error("RUNTIME_ROLE_ALREADY_EXISTS_USE_A_DEDICATED_CLUSTER");
    // Exclusive directory: a retry never overwrites credentials from an earlier run.
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    await mkdir(output, { recursive: false, mode: 0o700 });
    const { migrate } = await import("./migrate.mjs");
    await migrate(ownerUrl);
    await client.query("BEGIN");
    transaction = true;
    await client.query(
      `CREATE ROLE sca_runtime LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
    );
    const dbName = (await client.query("SELECT current_database() AS name"))
      .rows[0].name;
    await client.query(
      `GRANT CONNECT ON DATABASE ${pg.escapeIdentifier(dbName)} TO sca_runtime`,
    );
    await client.query(
      "GRANT USAGE ON SCHEMA public TO sca_runtime; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO sca_runtime; GRANT DELETE ON login_limits,calendar_days,terminal_operators,scanners TO sca_runtime; GRANT EXECUTE ON FUNCTION auth_login(uuid,text),auth_session(uuid) TO sca_runtime",
    );
    await client.query("INSERT INTO schools(id,name) VALUES($1,$2)", [
      schoolId,
      process.env.SCA_SCHOOL_NAME || "Institución por configurar",
    ]);
    await client.query(
      "INSERT INTO users(id,school_id,username,full_name,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        schoolId,
        "admin",
        "Administración",
        await bcrypt.hash(adminPassword, 12),
        "admin",
      ],
    );
    await client.query(
      "INSERT INTO schedules(id,school_id,name,start_time,end_time,grace_minutes) VALUES($1,$2,$3,$4,$5,$6)",
      [randomUUID(), schoolId, "Mañana", "07:00", "13:00", 10],
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
    const options = { mode: 0o600, flag: "wx" };
    await writeFile(
      `${output}/runtime.env`,
      `DATABASE_URL=${runtimeUrl.href}\nSCA_SCHOOL_ID=${schoolId}\nJWT_SECRET=${token()}\nSCA_DEMO_MODE=false\nSCA_SYNTHETIC_DATA=false\nSCA_EMAIL_ENABLED=false\nNEXT_TELEMETRY_DISABLED=1\n${origin ? `SCA_PUBLIC_ORIGIN=${origin}\n` : ""}`,
      options,
    );
    await writeFile(
      `${output}/maintenance.env`,
      `MIGRATION_DATABASE_URL=${ownerUrl}\nSCA_SCHOOL_ID=${schoolId}\n`,
      options,
    );
    await writeFile(`${output}/backup.key`, token(), options);
    await writeFile(
      `${output}/bootstrap.txt`,
      `Usuario inicial: admin\nContraseña inicial: ${adminPassword}\nCambiar en Configuración → Cuenta al entrar.\n`,
      options,
    );
    await client.query("COMMIT");
    transaction = false;
    console.log(
      "Base institucional inicializada sin alumnos de prueba. Configuración y acceso inicial en el directorio privado de salida; no se imprimen secretos.",
    );
  } catch (error) {
    if (transaction) await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.query("SELECT pg_advisory_unlock(8200402)");
    await client.end();
  }
}
try {
  await bootstrap();
} catch (error) {
  const code =
    error.code ||
    (error.message?.match(/^[A-Z_]+$/) ? error.message : error.name);
  console.error("DATABASE_BOOTSTRAP_FAILED", code);
  process.exitCode = 1;
}
