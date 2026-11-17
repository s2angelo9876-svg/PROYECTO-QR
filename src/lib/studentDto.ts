import type { Student } from "@/types/attendance";
// `dni` remains a compatibility field for the phase-one cache. It contains an institutional code, never a national identifier.
export function studentDto(row: Record<string, unknown>): Student {
  return {
    id: String(row.id),
    dni: String(row.code),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    fullName: `${row.first_name} ${row.last_name}`,
    grade: String(row.grade || ""),
    section: String(row.section || ""),
    shift: "MORNING",
    photoUrl: "/icons/icon-192.svg",
    status: row.status as Student["status"],
  };
}
