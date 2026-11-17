import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, open, appendFile, rename, rm, stat } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
export const backupTables = [
  "schools",
  "users",
  "sessions",
  "schedules",
  "schedule_versions",
  "calendar_days",
  "students",
  "enrollments",
  "signing_keys",
  "credentials",
  "terminals",
  "terminal_sessions",
  "terminal_operators",
  "scanners",
  "scan_receipts",
  "attendance_events",
  "daily_attendance",
  "attendance_adjustments",
  "notifications",
  "notification_reads",
  "audit_log",
  "import_batches",
  "report_snapshots",
  "recovery_cases",
];
export async function tableManifest(client) {
  const result = {};
  for (const table of backupTables) {
    const r = await client.query(
      `SELECT count(*)::text AS count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest FROM ${table} t`,
    );
    result[table] = r.rows[0];
  }
  return result;
}
export async function backupKey() {
  const key = await readFile(
    process.env.SCA_BACKUP_KEY_FILE || "var/backup.key",
    "utf8",
  );
  if (key.trim().length < 32)
    throw new Error(
      "The backup key file must contain at least 32 characters. Store the key separately.",
    );
  return key.trim();
}
function derive(pass, salt) {
  return scryptSync(pass, salt, 32, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
}
export function childCommand(args) {
  const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
  let errorText = "";
  child.stderr.on("data", (d) => {
    if (errorText.length < 1000) errorText += d;
  });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `PostgreSQL command failed (${code}). Check the database/container configuration.`,
            ),
          ),
    );
  });
  done.catch(() => {});
  return { child, done };
}
export async function encryptDump(path, manifest, source, done) {
  const salt = randomBytes(16),
    iv = randomBytes(12),
    header = Buffer.from(
      JSON.stringify({
        format: "sca-database-backup",
        version: 1,
        kdf: "scrypt-N131072-r8-p1",
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
      }) + "\n",
    ),
    key = derive(await backupKey(), salt),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(header);
  const temp = path + ".partial";
  const output = createWriteStream(temp, { flags: "wx", mode: 0o600 });
  output.write(header);
  try {
    const input = Readable.from(
      (async function* () {
        yield Buffer.from(JSON.stringify(manifest) + "\n");
        for await (const chunk of source) yield chunk;
      })(),
    );
    await pipeline(input, cipher, output);
    await done;
    await appendFile(temp, cipher.getAuthTag());
    await rename(temp, path);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}
export async function decryptDump(path, target) {
  const size = (await stat(path)).size,
    handle = await open(path, "r"),
    first = Buffer.alloc(1024);
  await handle.read(first, 0, 1024, 0);
  const offset = first.indexOf(10) + 1;
  if (offset < 2 || offset > 1000) throw new Error("Invalid backup header");
  const raw = first.subarray(0, offset),
    h = JSON.parse(raw.toString());
  if (
    h.format !== "sca-database-backup" ||
    h.version !== 1 ||
    h.kdf !== "scrypt-N131072-r8-p1"
  )
    throw new Error("Unsupported backup format");
  const tag = Buffer.alloc(16);
  await handle.read(tag, 0, 16, size - 16);
  await handle.close();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    derive(await backupKey(), Buffer.from(h.salt, "base64")),
    Buffer.from(h.iv, "base64"),
  );
  decipher.setAAD(raw);
  decipher.setAuthTag(tag);
  let manifest = null,
    prefix = Buffer.alloc(0);
  const split = new Transform({
    transform(chunk, _, callback) {
      if (manifest) {
        callback(null, chunk);
        return;
      }
      prefix = Buffer.concat([prefix, chunk]);
      const n = prefix.indexOf(10);
      if (n === -1) {
        if (prefix.length > 100000)
          callback(new Error("Invalid backup manifest"));
        else callback();
        return;
      }
      try {
        manifest = JSON.parse(prefix.subarray(0, n).toString());
        callback(null, prefix.subarray(n + 1));
        prefix = Buffer.alloc(0);
      } catch (error) {
        callback(error);
      }
    },
  });
  try {
    await pipeline(
      createReadStream(path, { start: offset, end: size - 17 }),
      decipher,
      split,
      createWriteStream(target, { flags: "wx", mode: 0o600 }),
    );
    if (!manifest) throw new Error("Missing backup manifest");
    return manifest;
  } catch {
    await rm(target, { force: true });
    throw new Error(
      "Backup authentication failed. Verify the key and file integrity.",
    );
  }
}
