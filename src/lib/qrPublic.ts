import {
  compactVerify,
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
  type JWK,
} from "jose";
import { canonicalJson } from "./canonicalJson";
export interface PublicKeyRecord {
  kid: string;
  purpose: string;
  public_jwk: JWK;
}
export async function verifyOfflineCredential(
  token: string,
  schoolId: string,
  keys: PublicKeyRecord[],
  revoked: string[],
  at = new Date(),
) {
  if (!token.startsWith("SCA1:") || token.length > 1024)
    throw new Error("Formato de carnet inválido.");
  const jws = token.slice(5),
    header = decodeProtectedHeader(jws);
  const record = keys.find((k) => k.kid === header.kid && k.purpose === "QR");
  if (
    !record ||
    header.alg !== "ES256" ||
    header.typ !== "sca-credential+jwt" ||
    header.jku ||
    header.jwk ||
    header.x5u
  )
    throw new Error("Clave del carnet no reconocida. Actualiza el padrón.");
  const { payload } = await jwtVerify(
    jws,
    await importJWK(record.public_jwk, "ES256"),
    {
      algorithms: ["ES256"],
      currentDate: at,
      issuer: schoolId,
      requiredClaims: ["iat", "exp", "jti"],
      typ: "sca-credential+jwt",
    },
  );
  if (
    payload.ver !== 1 ||
    typeof payload.jti !== "string" ||
    revoked.includes(payload.jti)
  )
    throw new Error("Carnet revocado o inválido.");
  return payload.jti;
}
export async function verifyPublicReceipt(
  receipt: string,
  schoolId: string,
  keys: PublicKeyRecord[],
  expected: object,
) {
  try {
    const header = decodeProtectedHeader(receipt),
      record = keys.find(
        (k) => k.kid === header.kid && k.purpose === "RECEIPT",
      );
    if (
      !record ||
      header.alg !== "ES256" ||
      header.typ !== "sca-receipt+jws" ||
      header.jku ||
      header.jwk ||
      header.x5u
    )
      return false;
    const { payload } = await compactVerify(
      receipt,
      await importJWK(record.public_jwk, "ES256"),
      { algorithms: ["ES256"] },
    );
    const p = JSON.parse(new TextDecoder().decode(payload));
    return (
      p.ver === 1 &&
      p.iss === schoolId &&
      canonicalJson(p.result) === canonicalJson(expected)
    );
  } catch {
    return false;
  }
}
