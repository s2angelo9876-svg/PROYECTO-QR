import { decodeProtectedHeader } from "jose";
import { z } from "zod";
import { getLocalDB } from "./localDb";
import { readTerminalSnapshot } from "./terminalSnapshot";
export async function receiptTrust(receipt: unknown) {
  const snapshot = await readTerminalSnapshot();
  if (!snapshot || typeof receipt !== "string") return snapshot;
  const { kid } = decodeProtectedHeader(receipt);
  if (snapshot.keys.some((k) => k.kid === kid)) return snapshot;
  const response = await fetch("/api/terminal/keys", { cache: "no-store" });
  if (!response.ok) return snapshot;
  const parsed = z
    .object({
      schoolId: z.uuid(),
      keys: z
        .array(
          z.object({
            kid: z.uuid(),
            purpose: z.enum(["QR", "RECEIPT", "PERMIT"]),
            public_jwk: z
              .object({
                kty: z.literal("EC"),
                crv: z.literal("P-256"),
                x: z.string(),
                y: z.string(),
              })
              .strict(),
          }),
        )
        .max(100),
    })
    .safeParse(await response.json());
  if (!parsed.success || parsed.data.schoolId !== snapshot.schoolId)
    return snapshot;
  const updated = { ...snapshot, keys: parsed.data.keys };
  const db = await getLocalDB();
  await db.put("metadata", {
    key: "institution_snapshot",
    value: JSON.stringify(updated),
  });
  return updated;
}
