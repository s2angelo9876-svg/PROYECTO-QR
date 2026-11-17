import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import pg from "pg";
import { randomUUID, randomBytes } from "node:crypto";
import { seedInstitution } from "../helpers/institution.mts";
import { inSchool, pool } from "@/lib/db";
import { processInstitutionScan } from "@/lib/institutionScan";
import { signTokenArtifact, verifyReceipt } from "@/lib/artifacts";
import { hashScanCommand } from "@/lib/scanContract";
import { buildReportSnapshot, snapshotCsv } from "@/lib/reportSnapshot";
import { snapshotPdf } from "@/lib/snapshotPdf";
import type { ApiScanRequest } from "@/types/attendance";
import type { AdminUser } from "@/lib/authToken";
const enabled = process.env.SCA_RUN_INTEGRATION === "true";
describe.runIf(enabled)("real PostgreSQL institution invariants", () => {
  let owner: pg.Client,
    client: pg.Client,
    fixture: Awaited<ReturnType<typeof seedInstitution>>,
    other: Awaited<ReturnType<typeof seedInstitution>>,
    user: AdminUser,
    dbName: string,
    originalUrl: string | undefined;
  beforeAll(async () => {
    if (existsSync(".env.local")) process.loadEnvFile(".env.local");
    if (existsSync("var/maintenance.env"))
      process.loadEnvFile("var/maintenance.env");
    originalUrl = process.env.DATABASE_URL;
    if (!process.env.MIGRATION_DATABASE_URL || !originalUrl)
      throw new Error("Run setup:local first.");
    const ownerUrl = new URL(process.env.MIGRATION_DATABASE_URL),
      appUrl = new URL(originalUrl);
    dbName = "sca_integration_" + randomBytes(6).toString("hex");
    owner = new pg.Client({ connectionString: ownerUrl.toString() });
    await owner.connect();
    await owner.query(`CREATE DATABASE "${dbName}"`);
    ownerUrl.pathname = "/" + dbName;
    appUrl.pathname = "/" + dbName;
    client = new pg.Client({ connectionString: ownerUrl.toString() });
    await client.connect();
    for (const name of (await readdir("db/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await client.query(await readFile("db/migrations/" + name, "utf8"));
    await client.query(
      "GRANT USAGE ON SCHEMA public TO sca_runtime;GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO sca_runtime;GRANT DELETE ON login_limits,calendar_days,terminal_operators TO sca_runtime;GRANT EXECUTE ON FUNCTION auth_login(uuid,text),auth_session(uuid) TO sca_runtime",
    );
    fixture = await seedInstitution(client, 120);
    other = await seedInstitution(client, 2);
    process.env.DATABASE_URL = appUrl.toString();
    user = {
      id: fixture.ids.porter,
      schoolId: fixture.schoolId,
      role: "porter",
      username: "porter",
      fullName: "Portería sintética",
    };
  }, 30000);
  afterAll(async () => {
    if (enabled) {
      await pool().end();
      delete (globalThis as { scaPool?: pg.Pool }).scaPool;
      await client?.end();
      await owner?.query(`DROP DATABASE "${dbName}" WITH(FORCE)`);
      await owner?.end();
      if (originalUrl) process.env.DATABASE_URL = originalUrl;
    }
  }, 15000);
  const command = (
    index: number,
    extra: Partial<ApiScanRequest> = {},
  ): ApiScanRequest => ({
    qr_code: fixture.students[index].token,
    qr_signature: "JWS-ES256",
    is_burst: false,
    client_scan_id: randomUUID(),
    terminal_id: fixture.terminalId,
    scanner_id: "N1",
    entrance_id: "PRINCIPAL",
    direction: "ENTRY",
    terminal_permit: fixture.permit,
    offline_timestamp: new Date().toISOString(),
    ...extra,
  });
  const scan = (value: ApiScanRequest) =>
    inSchool(fixture.schoolId, (c) => processInstitutionScan(c, user, value));
  it("uses a non-owner role, hides all schools without scope and prevents cross-school relations", async () => {
    const connection = await pool().connect();
    try {
      expect(
        (await connection.query("SELECT current_user")).rows[0].current_user,
      ).toBe("sca_runtime");
      expect(
        (await connection.query("SELECT count(*) FROM students")).rows[0].count,
      ).toBe("0");
    } finally {
      connection.release();
    }
    expect(
      await inSchool(
        fixture.schoolId,
        async (c) =>
          (await c.query("SELECT count(*) FROM students")).rows[0].count,
      ),
    ).toBe("120");
    await expect(
      inSchool(fixture.schoolId, (c) =>
        c.query(
          "INSERT INTO enrollments(id,school_id,student_id,year,grade,section,schedule_id,valid_from,valid_until) VALUES($1,$2,$3,2026,'1','A',$4,'2026-01-01','2026-12-31')",
          [
            randomUUID(),
            fixture.schoolId,
            other.students[0].id,
            fixture.scheduleId,
          ],
        ),
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
  it("returns exactly the same durable receipt to concurrent retries", async () => {
    const cmd = command(0),
      results = await Promise.all(Array.from({ length: 12 }, () => scan(cmd)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.body.scan_id)).size).toBe(1);
    expect(new Set(results.map((r) => r.body.receipt)).size).toBe(1);
    const counts = await inSchool(fixture.schoolId, async (c) => ({
      events: (
        await c.query(
          "SELECT count(*) FROM attendance_events WHERE event_id=$1",
          [cmd.client_scan_id],
        )
      ).rows[0].count,
      receipts: (
        await c.query("SELECT count(*) FROM scan_receipts WHERE event_id=$1", [
          cmd.client_scan_id,
        ])
      ).rows[0].count,
    }));
    expect(counts).toEqual({ events: "1", receipts: "1" });
  });
  it("serializes the first projection row for simultaneous distinct event IDs", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => scan(command(1))),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(7);
    expect(
      await inSchool(
        fixture.schoolId,
        async (c) =>
          (
            await c.query(
              "SELECT count(*) FROM daily_attendance WHERE enrollment_id=$1",
              [fixture.students[1].enrollmentId],
            )
          ).rows[0].count,
      ),
    ).toBe("1");
  });
  it("reserves review IDs and rejects reuse with changed canonical content", async () => {
    const cmd = command(2, {
        offline_timestamp: new Date(Date.now() + 5 * 60000).toISOString(),
      }),
      result = await scan(cmd);
    expect(result.status).toBe(409);
    expect(result.body.code).toBe("CLOCK_FUTURE");
    expect((await scan(cmd)).body).toEqual(result.body);
    await expect(scan({ ...cmd, is_burst: true })).rejects.toMatchObject({
      status: 409,
      code: "IDEMPOTENCY_KEY_REUSED",
    });
    expect(await hashScanCommand(cmd)).toBe(result.body.payload_hash);
  });
  it("keeps durable rejections for invalid and revoked QR without projecting attendance", async () => {
    const bad = command(3, { qr_code: "SCA1:invalid" });
    expect((await scan(bad)).status).toBe(422);
    await inSchool(fixture.schoolId, (c) =>
      c.query("UPDATE credentials SET revoked_at=now() WHERE id=$1", [
        fixture.students[4].credentialId,
      ]),
    );
    const revoked = await scan(command(4));
    expect(revoked.body.code).toBe("CREDENTIAL_REVOKED");
    expect(revoked.status).toBe(409);
    expect(
      await inSchool(
        fixture.schoolId,
        async (c) =>
          (
            await c.query(
              "SELECT count(*) FROM daily_attendance WHERE enrollment_id=ANY($1::uuid[])",
              [[fixture.students[3].enrollmentId]],
            )
          ).rows[0].count,
      ),
    ).toBe("0");
  });
  it("records an explicit exit and keeps separate capture and receipt times", async () => {
    const entry = command(5);
    expect((await scan(entry)).status).toBe(200);
    const terminal = randomUUID(),
      sid = randomUUID();
    const permit = await inSchool(fixture.schoolId, async (c) => {
      await c.query(
        "INSERT INTO terminals(id,school_id,name,entrance_id,scanner_id,direction) VALUES($1,$2,'Salida','PRINCIPAL','S1','EXIT')",
        [terminal, fixture.schoolId],
      );
      await c.query(
        "INSERT INTO terminal_sessions(id,school_id,terminal_id,operator_id,created_at,expires_at) VALUES($1,$2,$3,$4,now()-interval '1 hour',now()+interval '1 hour')",
        [sid, fixture.schoolId, terminal, user.id],
      );
      return signTokenArtifact(
        c,
        fixture.schoolId,
        "PERMIT",
        { sid, sub: user.id, terminal_id: terminal, direction: "EXIT" },
        3600,
      );
    });
    const result = await scan(
      command(5, {
        terminal_id: terminal,
        scanner_id: "S1",
        direction: "EXIT",
        terminal_permit: permit,
        offline_timestamp: new Date(Date.now() + 1000).toISOString(),
      }),
    );
    expect(result.status).toBe(200);
    expect(result.body.attendance_status).toBe("EARLY_LEAVE");
    const daily = await inSchool(
      fixture.schoolId,
      async (c) =>
        (
          await c.query(
            "SELECT * FROM daily_attendance WHERE enrollment_id=$1",
            [fixture.students[5].enrollmentId],
          )
        ).rows[0],
    );
    expect(daily.first_entry).toBeTruthy();
    expect(daily.last_exit).toBeTruthy();
  });
  it("rolls back event and projection when receipt persistence fails", async () => {
    await client.query(
      "CREATE FUNCTION test_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER test_receipt_failure BEFORE INSERT ON scan_receipts FOR EACH ROW EXECUTE FUNCTION test_receipt_failure()",
    );
    try {
      await expect(scan(command(6))).rejects.toThrow("injected failure");
      expect(
        await inSchool(
          fixture.schoolId,
          async (c) =>
            (
              await c.query(
                "SELECT count(*) FROM attendance_events WHERE student_id=$1",
                [fixture.students[6].id],
              )
            ).rows[0].count,
        ),
      ).toBe("0");
      expect(
        await inSchool(
          fixture.schoolId,
          async (c) =>
            (
              await c.query(
                "SELECT count(*) FROM daily_attendance WHERE enrollment_id=$1",
                [fixture.students[6].enrollmentId],
              )
            ).rows[0].count,
        ),
      ).toBe("0");
    } finally {
      await client.query(
        "DROP TRIGGER test_receipt_failure ON scan_receipts; DROP FUNCTION test_receipt_failure()",
      );
    }
  });
  it("rejects mutation of immutable events and preserves old keys after rotation", async () => {
    const cmd = command(7),
      r = await scan(cmd);
    await expect(
      inSchool(fixture.schoolId, (c) =>
        c.query("UPDATE attendance_events SET status='ON_TIME' WHERE id=$1", [
          r.body.scan_id,
        ]),
      ),
    ).rejects.toThrow("Immutable");
    const verified = await inSchool(fixture.schoolId, (c) =>
      verifyReceipt(c, fixture.schoolId, String(r.body.receipt)),
    );
    expect(verified.client_scan_id).toBe(cmd.client_scan_id);
  });
  it("exports all 120 enrolled students consistently and does not mark a future day absent", async () => {
    const snapshot = await inSchool(fixture.schoolId, (c) =>
      buildReportSnapshot(c, "2026-12-01"),
    );
    expect(snapshot.rows).toHaveLength(120);
    expect(snapshot.summary.absent).toBe(0);
    expect(snapshotCsv(snapshot).split("\r\n")).toHaveLength(121);
    const pdf = await snapshotPdf(snapshot);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(5000);
  });
  it("restores an original signed confirmation without generating a new event identity", async () => {
    const cmd = command(110),
      original = await scan(cmd);
    expect(original.status).toBe(200);
    await client.query("BEGIN");
    try {
      await client.query(
        "ALTER TABLE scan_receipts DISABLE TRIGGER immutable_receipts;ALTER TABLE attendance_events DISABLE TRIGGER immutable_events",
      );
      await client.query("DELETE FROM scan_receipts WHERE event_id=$1", [
        cmd.client_scan_id,
      ]);
      await client.query("DELETE FROM attendance_events WHERE event_id=$1", [
        cmd.client_scan_id,
      ]);
      await client.query(
        "DELETE FROM daily_attendance WHERE enrollment_id=$1",
        [fixture.students[110].enrollmentId],
      );
      await client.query(
        "ALTER TABLE scan_receipts ENABLE TRIGGER immutable_receipts;ALTER TABLE attendance_events ENABLE TRIGGER immutable_events",
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    const restored = await inSchool(fixture.schoolId, (c) =>
      processInstitutionScan(c, user, cmd, { signedResult: original.body }),
    );
    expect(restored.body).toEqual(original.body);
    const event = await inSchool(
      fixture.schoolId,
      async (c) =>
        (
          await c.query(
            "SELECT id,received_at FROM attendance_events WHERE event_id=$1",
            [cmd.client_scan_id],
          )
        ).rows[0],
    );
    expect(event.id).toBe(original.body.scan_id);
    expect(event.received_at.toISOString()).toBe(
      original.body.server_timestamp,
    );
  });
  it("keeps credential revocation irreversible in PostgreSQL", async () => {
    await expect(
      inSchool(fixture.schoolId, (c) =>
        c.query("UPDATE credentials SET revoked_at=NULL WHERE id=$1", [
          fixture.students[4].credentialId,
        ]),
      ),
    ).rejects.toThrow("immutable");
  });
  it("measures 100 durable captures with eight concurrent workers", async () => {
    const timings: number[] = [],
      statuses: number[] = [];
    let index = 10;
    const started = performance.now();
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (index < 110) {
          const i = index++,
            at = performance.now(),
            result = await scan(command(i));
          timings.push(performance.now() - at);
          statuses.push(result.status);
        }
      }),
    );
    expect(statuses.every((s) => s === 200)).toBe(true);
    timings.sort((a, b) => a - b);
    const report = {
      measuredAt: new Date().toISOString(),
      synthetic: true,
      method:
        "Real PostgreSQL and ES256 receipts through application domain; excludes HTTP/browser/network/hardware.",
      events: 100,
      concurrency: 8,
      totalMs: Math.round(performance.now() - started),
      p50Ms: Math.round(timings[49]),
      p95Ms: Math.round(timings[94]),
      maximumMs: Math.round(timings[99]),
      allCommitted: true,
    };
    await mkdir("docs/evidencia", { recursive: true });
    await writeFile(
      "docs/evidencia/captura-concurrente.json",
      JSON.stringify(report, null, 2) + "\n",
    );
  }, 30000);
  it("uses the rules in effect at capture time after a schedule change", async () => {
    const before = command(8, {
      offline_timestamp: new Date(Date.now() - 60000).toISOString(),
    });
    await inSchool(fixture.schoolId, (c) =>
      c.query(
        "UPDATE schedules SET start_time='23:00',end_time='23:59',version=version+1 WHERE id=$1",
        [fixture.scheduleId],
      ),
    );
    const result = await scan(before);
    expect(result.status).toBe(200);
    const event = await inSchool(
      fixture.schoolId,
      async (c) =>
        (
          await c.query(
            "SELECT rule_version FROM attendance_events WHERE id=$1",
            [result.body.scan_id],
          )
        ).rows[0],
    );
    expect(event.rule_version).toBe(1);
  });
  it("retains an authorized offline capture for review after terminal configuration changes", async () => {
    const original = command(119);
    await inSchool(fixture.schoolId, (c) =>
      c.query("UPDATE terminals SET direction='EXIT' WHERE id=$1", [
        fixture.terminalId,
      ]),
    );
    const result = await scan(original);
    expect(result.status).toBe(409);
    expect(result.body.code).toBe("TERMINAL_CONFIGURATION_CHANGED");
    const event = await inSchool(
      fixture.schoolId,
      async (c) =>
        (
          await c.query(
            "SELECT disposition,direction,scanner_id,entrance_id FROM attendance_events WHERE event_id=$1",
            [original.client_scan_id],
          )
        ).rows[0],
    );
    expect(event).toMatchObject({
      disposition: "REVIEW",
      direction: "ENTRY",
      scanner_id: "N1",
      entrance_id: "PRINCIPAL",
    });
    const forged = await scan(command(119, { direction: "EXIT" }));
    expect(forged.status).toBe(403);
    expect(forged.body.code).toBe("TERMINAL_SCOPE_MISMATCH");
  });
});
