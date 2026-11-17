import { NextRequest } from "next/server";
import { z } from "zod";
import { institutionApi, jsonInput, ALL_ROLES } from "@/lib/institutionApi";
import { signReceipt } from "@/lib/artifacts";
export async function POST(req: NextRequest) {
  return institutionApi(req, ALL_ROLES, async (u, c) => {
    const { events } = await jsonInput(
      req,
      z.object({
        events: z
          .array(
            z.object({
              eventId: z.uuid(),
              terminalId: z.uuid(),
              hash: z.string().regex(/^[a-f0-9]{64}$/),
            }),
          )
          .max(20),
      }),
    );
    const results = [];
    for (const event of events) {
      const r = (
        await c.query(
          `SELECT r.result,a.captured_by,j.id AS adjustment_id,j.decision,j.created_at AS resolved_at FROM scan_receipts r
 LEFT JOIN attendance_events a ON a.event_id=r.event_id AND a.terminal_id=r.terminal_id
 LEFT JOIN attendance_adjustments j ON j.event_id=a.id
 WHERE r.event_id=$1 AND r.terminal_id=$2 AND r.payload_hash=$3 AND ($4 OR a.captured_by=$5 OR EXISTS(SELECT 1 FROM terminal_operators o WHERE o.terminal_id=r.terminal_id AND o.user_id=$5))`,
          [
            event.eventId,
            event.terminalId,
            event.hash,
            u.role !== "porter",
            u.id,
          ],
        )
      ).rows[0];
      if (!r) continue;
      const payload = r.adjustment_id
        ? {
            kind: "attendance-resolution",
            client_scan_id: event.eventId,
            payload_hash: event.hash,
            terminal_id: event.terminalId,
            decision: r.decision,
            adjustment_id: r.adjustment_id,
            resolved_at: r.resolved_at.toISOString(),
          }
        : null;
      results.push({
        eventId: event.eventId,
        original: r.result,
        resolution: payload
          ? { payload, receipt: await signReceipt(c, u.schoolId!, payload) }
          : null,
      });
    }
    return { results };
  });
}
