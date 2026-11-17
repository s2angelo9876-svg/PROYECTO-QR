import { z } from "zod";
import { getLocalDB } from "./localDb";
import { hashScanCommand, ScanCommandSchema } from "./scanContract";
import { toCommand } from "./offlineQueue";
import type { PendingScan } from "@/types/attendance";
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
function base64(bytes: Uint8Array) {
  let result = "";
  for (const byte of bytes) result += String.fromCharCode(byte);
  return btoa(result);
}
function unbase64(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
async function derive(passphrase: string, salt: Uint8Array) {
  if (passphrase.length < 12)
    throw new Error(
      "La contraseña de la copia debe tener al menos 12 caracteres.",
    );
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 600000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptLocalExport(plain: string, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    key = await derive(passphrase, salt);
  const cipher = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode("sca-local-backup-v1"),
    },
    key,
    encoder.encode(plain),
  );
  return JSON.stringify({
    format: "sca-local-encrypted",
    version: 1,
    kdf: "PBKDF2-SHA256-600000",
    salt: base64(salt),
    iv: base64(iv),
    ciphertext: base64(new Uint8Array(cipher)),
  });
}
export async function decryptLocalExport(
  encrypted: string,
  passphrase: string,
) {
  const envelope = z
    .object({
      format: z.literal("sca-local-encrypted"),
      version: z.literal(1),
      kdf: z.literal("PBKDF2-SHA256-600000"),
      salt: z.string().max(24),
      iv: z.string().max(16),
      ciphertext: z.string().max(96000000),
    })
    .parse(JSON.parse(encrypted));
  try {
    const key = await derive(passphrase, unbase64(envelope.salt));
    return decoder.decode(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: unbase64(envelope.iv),
          additionalData: encoder.encode("sca-local-backup-v1"),
        },
        key,
        unbase64(envelope.ciphertext),
      ),
    );
  } catch {
    throw new Error(
      "No se pudo abrir la copia. Revisa la contraseña y la integridad del archivo.",
    );
  }
}
const LocalRecord = z.object({
  scanId: z.uuid(),
  qrCode: z.string().max(1024),
  qrSignature: z.string().max(500),
  isBurst: z.boolean(),
  timestamp: z.iso.datetime(),
  retryCount: z.number().int().min(0),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  terminalId: z.string().max(100).optional(),
  scannerId: z.string().max(100).optional(),
  entranceId: z.string().max(100).optional(),
  direction: z.enum(["ENTRY", "EXIT"]).optional(),
  terminalPermit: z.string().max(2048).optional(),
  clockOffsetMs: z.number().optional(),
  resolvedAt: z.iso.datetime().optional(),
  resolution: z
    .object({
      payload: z.record(z.string(), z.unknown()),
      receipt: z.string().max(4096),
    })
    .optional(),
  state: z
    .enum([
      "PENDING",
      "SENDING",
      "RETRY",
      "BLOCKED_AUTH",
      "REVIEW",
      "REJECTED",
      "ACKED",
    ])
    .optional(),
  acknowledgement: z.unknown().optional(),
  serverReceipt: z
    .object({
      status: z.number().int(),
      body: z.record(z.string(), z.unknown()),
    })
    .optional(),
});
export async function importLocalExport(text: string, passphrase: string) {
  const plain = await decryptLocalExport(text, passphrase),
    envelope = z
      .object({
        format: z.literal("sca-qr-local-export"),
        version: z.literal(1),
        records: z.array(LocalRecord).max(20000),
        manualRecords: z
          .array(
            z.object({
              key: z.string().regex(/^manual_(draft|receipt)_[a-f0-9-]{36}$/),
              value: z.string().max(16384),
            }),
          )
          .max(5000)
          .optional(),
      })
      .parse(JSON.parse(plain));
  const records: PendingScan[] = [];
  for (const original of envelope.records) {
    const record = original as PendingScan,
      command = ScanCommandSchema.parse(toCommand(record));
    if ((await hashScanCommand(command)) !== record.payloadHash)
      throw new Error(
        "Una captura tiene un hash distinto al original. No se importó la copia.",
      );
    records.push({
      ...record,
      resolvedAt: undefined,
      resolution: undefined,
      state:
        record.serverReceipt || record.state === "ACKED"
          ? "REVIEW"
          : record.state === "REVIEW" || record.state === "REJECTED"
            ? record.state
            : "PENDING",
      lastError:
        record.serverReceipt || record.state === "ACKED"
          ? "RESTORE_RECONCILIATION_REQUIRED"
          : record.lastError,
      nextAttemptAt: 0,
    });
  }
  const db = await getLocalDB(),
    tx = db.transaction(["pending_scans", "metadata"], "readwrite");
  let count = 0;
  try {
    for (const record of records) {
      const exists = await tx
        .objectStore("pending_scans")
        .index("by_scanId")
        .get(record.scanId);
      if (exists) {
        if (exists.payloadHash !== record.payloadHash)
          throw new Error("El identificador ya existe con otro contenido.");
        continue;
      }
      await tx.objectStore("pending_scans").add(record);
      count++;
    }
    for (const manual of envelope.manualRecords || []) {
      const existing = await tx.objectStore("metadata").get(manual.key);
      if (existing && existing.value !== manual.value)
        throw new Error(
          "Hay un borrador manual distinto en este equipo. Conserva ambas copias.",
        );
      if (!existing) {
        await tx.objectStore("metadata").put(manual);
        count++;
      }
    }
    await tx.done;
  } catch (error) {
    try {
      tx.abort();
    } catch {}
    await tx.done.catch(() => {});
    throw error;
  }
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("sca-outbox-change"));
  return count;
}
export async function reconcileLocalRecords() {
  const db = await getLocalDB(),
    records = (await db.getAll("pending_scans"))
      .filter((r) => r.serverReceipt)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  let restored = 0,
    review = 0;
  for (const record of records) {
    const response = await fetch("/api/admin/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: toCommand(record),
        signedResult: record.serverReceipt!.body,
      }),
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.message ||
          "La reconciliación necesita una sesión de administración.",
      );
    if (result.status === "MATCHED" || result.status === "RESTORED") {
      const body = result.result;
      await db.put("pending_scans", {
        ...record,
        state: body.ok
          ? "ACKED"
          : body.disposition === "REVIEW"
            ? "REVIEW"
            : "REJECTED",
        acknowledgement: body.ok ? body : record.acknowledgement,
        lastError: undefined,
      });
      restored++;
    } else {
      await db.put("pending_scans", {
        ...record,
        state: "REVIEW",
        lastError: "RECOVERY_CASE_OPEN",
      });
      review++;
    }
  }
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("sca-outbox-change"));
  return { restored, review };
}
