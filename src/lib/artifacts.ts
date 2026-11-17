import {
  CompactSign,
  compactVerify,
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
  SignJWT,
} from "jose";
import type { PoolClient } from "pg";
import { ApiProblem } from "./apiProblem";

export type KeyPurpose = "QR" | "RECEIPT" | "PERMIT";
const types = {
  QR: "sca-credential+jwt",
  RECEIPT: "sca-receipt+jws",
  PERMIT: "sca-terminal+jwt",
};
export async function activeKey(
  c: PoolClient,
  schoolId: string,
  purpose: KeyPurpose,
) {
  const { rows } = await c.query(
    "SELECT * FROM signing_keys WHERE school_id=$1 AND purpose=$2 AND active",
    [schoolId, purpose],
  );
  if (!rows[0]) throw new Error("SIGNING_KEY_MISSING");
  return rows[0];
}
async function trustedKey(
  c: PoolClient,
  schoolId: string,
  purpose: KeyPurpose,
  token: string,
) {
  const h = decodeProtectedHeader(token);
  if (
    h.alg !== "ES256" ||
    h.typ !== types[purpose] ||
    typeof h.kid !== "string" ||
    !/^[a-f0-9-]{36}$/.test(h.kid) ||
    h.jku ||
    h.jwk ||
    h.x5u
  )
    throw new Error("INVALID_HEADER");
  const { rows } = await c.query(
    "SELECT public_jwk FROM signing_keys WHERE school_id=$1 AND kid=$2 AND purpose=$3",
    [schoolId, h.kid, purpose],
  );
  if (!rows[0]) throw new Error("UNKNOWN_KEY");
  return importJWK(rows[0].public_jwk, "ES256");
}
export async function signTokenArtifact(
  c: PoolClient,
  schoolId: string,
  purpose: "QR" | "PERMIT",
  payload: object,
  seconds: number,
) {
  const key = await activeKey(c, schoolId, purpose);
  return new SignJWT({ ...payload, ver: 1 })
    .setProtectedHeader({ alg: "ES256", kid: key.kid, typ: types[purpose] })
    .setIssuer(schoolId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + seconds)
    .sign(await importJWK(key.private_jwk, "ES256"));
}
export async function verifyTokenArtifact(
  c: PoolClient,
  schoolId: string,
  purpose: "QR" | "PERMIT",
  token: string,
  at = new Date(),
) {
  try {
    const { payload } = await jwtVerify(
      token,
      await trustedKey(c, schoolId, purpose, token),
      {
        algorithms: ["ES256"],
        issuer: schoolId,
        typ: types[purpose],
        currentDate: at,
        requiredClaims: ["exp", "iat", "iss"],
      },
    );
    if (payload.ver !== 1 || Number(payload.iat) > at.getTime() / 1000 + 120)
      throw new Error("INVALID_VERSION_OR_TIME");
    return payload;
  } catch {
    throw new ApiProblem(
      422,
      purpose === "QR" ? "INVALID_QR" : "INVALID_PERMIT",
      "La firma, vigencia o autorización de la captura no es válida.",
    );
  }
}
export async function signReceipt(
  c: PoolClient,
  schoolId: string,
  result: object,
) {
  const key = await activeKey(c, schoolId, "RECEIPT");
  return new CompactSign(
    new TextEncoder().encode(JSON.stringify({ ver: 1, iss: schoolId, result })),
  )
    .setProtectedHeader({ alg: "ES256", kid: key.kid, typ: types.RECEIPT })
    .sign(await importJWK(key.private_jwk, "ES256"));
}
export async function verifyReceipt(
  c: PoolClient,
  schoolId: string,
  receipt: string,
) {
  const { payload } = await compactVerify(
    receipt,
    await trustedKey(c, schoolId, "RECEIPT", receipt),
    { algorithms: ["ES256"] },
  );
  const parsed = JSON.parse(new TextDecoder().decode(payload));
  if (parsed.ver !== 1 || parsed.iss !== schoolId)
    throw new Error("INVALID_RECEIPT");
  return parsed.result;
}
