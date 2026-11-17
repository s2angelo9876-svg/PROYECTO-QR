import { getLocalDB } from "./localDb";
import { readTerminalSnapshot } from "./terminalSnapshot";
import { verifyPublicReceipt } from "./qrPublic";
import { receiptTrust } from "./receiptTrust";
export async function refreshReceiptResolutions() {
  const db = await getLocalDB(),
    snapshot = await readTerminalSnapshot();
  if (!snapshot) return;
  const records = (
    await db.getAllFromIndex("pending_scans", "by_state", "REVIEW")
  )
    .filter((r) => !r.resolvedAt && r.serverReceipt)
    .slice(0, 20);
  if (!records.length) return;
  const response = await fetch("/api/terminal/receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      events: records.map((r) => ({
        eventId: r.scanId,
        terminalId: r.terminalId,
        hash: r.payloadHash,
      })),
    }),
  });
  if (!response.ok) return;
  const data = await response.json();
  if (!Array.isArray(data.results)) return;
  let changed = false;
  for (const item of data.results) {
    const record = records.find((r) => r.scanId === item.eventId);
    if (!record || !item.resolution) continue;
    const p = item.resolution.payload;
    if (
      p?.kind !== "attendance-resolution" ||
      p.client_scan_id !== record.scanId ||
      p.terminal_id !== record.terminalId ||
      p.payload_hash !== record.payloadHash ||
      !["ACCEPT", "REJECT"].includes(p.decision)
    )
      continue;
    const trusted = await receiptTrust(item.resolution.receipt);
    if (
      !trusted ||
      !(await verifyPublicReceipt(
        item.resolution.receipt,
        trusted.schoolId,
        trusted.keys,
        p,
      ))
    )
      continue;
    await db.put("pending_scans", {
      ...record,
      resolvedAt: p.resolved_at,
      resolution: item.resolution,
      lastError: undefined,
    });
    changed = true;
  }
  if (changed && typeof window !== "undefined")
    window.dispatchEvent(new Event("sca-outbox-change"));
}
