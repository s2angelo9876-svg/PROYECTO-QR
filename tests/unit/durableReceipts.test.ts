import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { generateKeyPair, exportJWK, CompactSign } from "jose";
import { closeLocalDB, getLocalDB } from "@/lib/localDb";
import {
  saveTerminalSnapshot,
  type TerminalSnapshot,
} from "@/lib/terminalSnapshot";
import {
  enqueueScan,
  syncOfflineQueue,
  getPendingScans,
  toCommand,
} from "@/lib/offlineQueue";
import { MOCK_STUDENTS } from "@/lib/mockData";
import type { ApiScanRequest } from "@/types/attendance";
beforeEach(async () => {
  await closeLocalDB();
  vi.stubGlobal("indexedDB", new IDBFactory());
});
afterEach(async () => {
  await closeLocalDB();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function prepare() {
  const pair = await generateKeyPair("ES256", { extractable: true }),
    schoolId = crypto.randomUUID(),
    kid = crypto.randomUUID(),
    credentialId = crypto.randomUUID(),
    terminalId = crypto.randomUUID(),
    student = MOCK_STUDENTS[0];
  await saveTerminalSnapshot({
    version: 1,
    schoolId,
    sessionId: crypto.randomUUID(),
    operatorId: crypto.randomUUID(),
    permit: "test-permit",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    serverTime: new Date().toISOString(),
    terminal: {
      id: terminalId,
      name: "Terminal sintética",
      entrance_id: "PRINCIPAL",
      scanner_id: "N1",
      direction: "ENTRY",
    },
    students: [student],
    credentials: [
      { id: credentialId, student_id: student.id, revoked_at: null },
    ],
    keys: [
      { kid, purpose: "RECEIPT", public_jwk: await exportJWK(pair.publicKey) },
    ],
  } satisfies TerminalSnapshot);
  const record = await enqueueScan({
    scanId: crypto.randomUUID(),
    qrCode: "SCA1:opaque-test-token",
    qrSignature: "JWS-ES256",
    isBurst: false,
    timestamp: new Date().toISOString(),
    scannerId: "N1",
    entranceId: "PRINCIPAL",
    terminalId,
    direction: "ENTRY",
    terminalPermit: "test-permit",
  });
  return { pair, schoolId, kid, credentialId, student, record };
}
it("accepts a durable ACK only after verifying its signature and full result", async () => {
  const f = await prepare();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      const cmd = JSON.parse(init?.body as string) as ApiScanRequest;
      const result = {
        ok: true,
        scan_id: crypto.randomUUID(),
        client_scan_id: cmd.client_scan_id,
        payload_hash: f.record.payloadHash,
        persistence: "durable",
        attendance_status: "ON_TIME",
        is_burst: false,
        student: f.student,
        credential_id: f.credentialId,
        message: "Confirmado",
        server_timestamp: new Date().toISOString(),
        terminal_id: cmd.terminal_id,
      };
      const receipt = await new CompactSign(
        new TextEncoder().encode(
          JSON.stringify({ ver: 1, iss: f.schoolId, result }),
        ),
      )
        .setProtectedHeader({
          alg: "ES256",
          kid: f.kid,
          typ: "sca-receipt+jws",
        })
        .sign(f.pair.privateKey);
      return Response.json({ ...result, receipt });
    }),
  );
  expect((await syncOfflineQueue()).synced).toBe(1);
  const stored = (await (await getLocalDB()).getAll("pending_scans"))[0];
  expect(stored.state).toBe("ACKED");
  expect(stored.serverReceipt?.body.receipt).toBeTruthy();
  expect(toCommand(stored)).toEqual(toCommand(f.record));
});
it("keeps an otherwise matching HTTP 200 in review when its receipt is forged", async () => {
  const f = await prepare();
  const result = {
    ok: true,
    scan_id: crypto.randomUUID(),
    client_scan_id: f.record.scanId,
    payload_hash: f.record.payloadHash,
    persistence: "durable",
    attendance_status: "ON_TIME",
    is_burst: false,
    student: f.student,
    credential_id: f.credentialId,
    message: "Forged",
    server_timestamp: new Date().toISOString(),
  };
  const impostor = await generateKeyPair("ES256");
  const receipt = await new CompactSign(
    new TextEncoder().encode(
      JSON.stringify({ ver: 1, iss: f.schoolId, result }),
    ),
  )
    .setProtectedHeader({ alg: "ES256", kid: f.kid, typ: "sca-receipt+jws" })
    .sign(impostor.privateKey);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ...result, receipt })),
  );
  expect((await syncOfflineQueue()).synced).toBe(0);
  expect((await getPendingScans())[0]).toMatchObject({
    scanId: f.record.scanId,
    state: "REVIEW",
    lastError: "ACK_MISMATCH",
  });
});
