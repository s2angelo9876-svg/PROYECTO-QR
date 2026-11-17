import type { SerialScanner } from "./serialReaders";
import type { PublicKeyRecord } from "./qrPublic";
import type { Student } from "@/types/attendance";
import { getLocalDB } from "./localDb";
export interface TerminalSnapshot {
  version: 1;
  clockOffsetMs?: number;
  schoolId: string;
  sessionId: string;
  operatorId: string;
  permit: string;
  expiresAt: string;
  serverTime: string;
  terminal: {
    id: string;
    name: string;
    entrance_id: string;
    scanner_id: string;
    direction: "ENTRY" | "EXIT";
  };
  scanners?: SerialScanner[];
  students: Student[];
  credentials: { id: string; student_id: string; revoked_at: string | null }[];
  keys: PublicKeyRecord[];
}
export async function readTerminalSnapshot(): Promise<TerminalSnapshot | null> {
  const db = await getLocalDB(),
    value = (await db.get("metadata", "institution_snapshot"))?.value;
  return typeof value === "string" ? JSON.parse(value) : null;
}
export async function saveTerminalSnapshot(snapshot: TerminalSnapshot) {
  const db = await getLocalDB(),
    tx = db.transaction(["metadata", "students"], "readwrite");
  await tx
    .objectStore("metadata")
    .put({ key: "institution_snapshot", value: JSON.stringify(snapshot) });
  await tx
    .objectStore("metadata")
    .put({ key: "terminal_id", value: snapshot.terminal.id });
  await tx.objectStore("students").clear();
  for (const student of snapshot.students)
    await tx.objectStore("students").put(student);
  await tx.done;
}
