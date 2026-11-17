import { describe, it, expect, beforeAll } from "vitest";
import { CompactSign, SignJWT, generateKeyPair, exportJWK } from "jose";
import {
  verifyOfflineCredential,
  verifyPublicReceipt,
  type PublicKeyRecord,
} from "@/lib/qrPublic";
let pair: Awaited<ReturnType<typeof generateKeyPair>>, keys: PublicKeyRecord[];
const school = crypto.randomUUID(),
  credential = crypto.randomUUID(),
  kid = crypto.randomUUID();
beforeAll(async () => {
  pair = await generateKeyPair("ES256", { extractable: true });
  keys = [
    { kid, purpose: "QR", public_jwk: await exportJWK(pair.publicKey) },
    { kid, purpose: "RECEIPT", public_jwk: await exportJWK(pair.publicKey) },
  ];
});
async function token(extraHeader: object = {}, expires = "1h") {
  return (
    "SCA1:" +
    (await new SignJWT({ ver: 1 })
      .setProtectedHeader({
        alg: "ES256",
        typ: "sca-credential+jwt",
        kid,
        ...extraHeader,
      })
      .setIssuer(school)
      .setJti(credential)
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(pair.privateKey))
  );
}
describe("signed, opaque QR credentials", () => {
  it("verifies ES256 without embedding a student name or document", async () => {
    const qr = await token();
    expect(qr.length).toBeGreaterThan(200);
    expect(await verifyOfflineCredential(qr, school, keys, [])).toBe(
      credential,
    );
  });
  it("rejects revoked credentials and an untrusted issuer", async () => {
    const qr = await token();
    await expect(
      verifyOfflineCredential(qr, school, keys, [credential]),
    ).rejects.toThrow();
    await expect(
      verifyOfflineCredential(qr, crypto.randomUUID(), keys, []),
    ).rejects.toThrow();
  });
  it("rejects tokens that select remote or unknown keys", async () => {
    await expect(
      verifyOfflineCredential(
        await token({ jku: "https://example.invalid/keys" }),
        school,
        keys,
        [],
      ),
    ).rejects.toThrow();
    await expect(
      verifyOfflineCredential(
        await token({ kid: crypto.randomUUID() }),
        school,
        keys,
        [],
      ),
    ).rejects.toThrow();
  });
  it("rejects altered and expired credentials", async () => {
    const qr = await token();
    const altered =
      qr.slice(0, -5) + (qr.slice(-5) === "AAAAA" ? "BBBBB" : "AAAAA");
    await expect(
      verifyOfflineCredential(altered, school, keys, []),
    ).rejects.toThrow();
    await expect(
      verifyOfflineCredential(await token({}, "-1s"), school, keys, []),
    ).rejects.toThrow();
  });
  it("authenticates the entire receipt independent of JSONB key order", async () => {
    const result = {
      ok: true,
      client_scan_id: crypto.randomUUID(),
      payload_hash: "a".repeat(64),
      student: { id: crypto.randomUUID(), fullName: "Alumno sintético" },
    };
    const receipt = await new CompactSign(
      new TextEncoder().encode(JSON.stringify({ ver: 1, iss: school, result })),
    )
      .setProtectedHeader({ alg: "ES256", kid, typ: "sca-receipt+jws" })
      .sign(pair.privateKey);
    expect(
      await verifyPublicReceipt(receipt, school, keys, {
        student: result.student,
        payload_hash: result.payload_hash,
        client_scan_id: result.client_scan_id,
        ok: true,
      }),
    ).toBe(true);
    expect(
      await verifyPublicReceipt(receipt, school, keys, {
        ...result,
        student: { ...result.student, fullName: "Nombre alterado" },
      }),
    ).toBe(false);
  });
});
