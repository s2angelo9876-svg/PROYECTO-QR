import { readJsonBody } from '@/lib/httpBody';
import { NextResponse } from 'next/server';
import { demoGuard, originGuard } from '@/lib/demoMode';
import { hashScanCommand, ScanCommandSchema } from '@/lib/scanContract';
import {
  getStudentByDni, checkIdempotency, saveIdempotency, logAttendance, getAttendanceLog, MOCK_STUDENTS,
} from '@/lib/mockData-exports';
import type { ApiScanSuccess, AttendanceStatus } from '@/types/attendance';

// Prototype domain policy; institutional calendars/entry-exit rules belong to the next phases.
function demoStatus(shift: string, at: Date): AttendanceStatus {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const minutes = Number(parts.find((p) => p.type === 'hour')?.value) * 60
    + Number(parts.find((p) => p.type === 'minute')?.value);
  const start = shift === 'MORNING' ? 7 * 60 : shift === 'AFTERNOON' ? 13 * 60 : 18 * 60;
  const end = shift === 'MORNING' ? 13 * 60 : shift === 'AFTERNOON' ? 18 * 60 : 22 * 60;
  return minutes >= end ? 'EXIT' : minutes > start + 10 ? 'LATE' : 'ON_TIME';
}

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'no-store' },
});

export async function POST(request: Request) {
  const denied = demoGuard() || originGuard(request);
  if (denied) return denied;
  try {
    const body = await readJsonBody(request);
    if (!body.ok) return json({ ok: false, code: 'INVALID_INPUT', message: 'JSON inválido o solicitud demasiado grande' }, body.status);
    const parsed = ScanCommandSchema.safeParse(body.value);
    if (!parsed.success) return json({ ok: false, code: 'INVALID_INPUT', message: 'Marcación inválida' }, 422);
    const data = parsed.data;
    const hash = await hashScanCommand(data);
    const key = `${data.terminal_id || 'legacy'}:${data.client_scan_id}`;
    const cached = checkIdempotency(key) as ApiScanSuccess | null;
    if (cached) {
      if (cached.payload_hash !== hash) {
        return json({ ok: false, code: 'IDEMPOTENCY_KEY_REUSED', message: 'El ID pertenece a otro contenido' }, 409);
      }
      return json({ ...cached, idempotent: true });
    }
    // No awaits from this check through saveIdempotency: serialize only within this demo process.
    // This is deliberately NOT a substitute for the PostgreSQL transaction planned in phase 2.
    const student = getStudentByDni(data.qr_code);
    if (!student) return json({ ok: false, code: 'STUDENT_NOT_FOUND', message: 'Alumno no encontrado' }, 404);
    if (student.status !== 'ACTIVE') {
      return json({ ok: false, code: 'INVALID_QR', message: 'Alumno inactivo: requiere revisión del responsable' }, 403);
    }
    // Demo signatures remain non-cryptographic; the demo guard prevents enabling this as production.
    if (data.qr_signature.length < 8) return json({ ok: false, code: 'INVALID_QR', message: 'Firma demo inválida' }, 400);
    const occurredAt = data.offline_timestamp ? new Date(data.offline_timestamp) : new Date();
    if (occurredAt.getTime() > Date.now() + 5 * 60_000) {
      return json({ ok: false, code: 'INVALID_INPUT', message: 'Fecha futura: revisa el reloj de la terminal' }, 422);
    }
    const duplicate = getAttendanceLog().find((entry) => entry.student_id === student.id &&
      Math.abs(occurredAt.getTime() - new Date(entry.timestamp).getTime()) < 60_000);
    if (duplicate) return json({ ok: false, code: 'DUPLICATE_SCAN', message: 'Lectura reciente: requiere revisión' }, 409);
    const scanId = crypto.randomUUID();
    const status = demoStatus(student.shift, occurredAt);
    logAttendance({ scan_id: scanId, student_id: student.id, student, timestamp: occurredAt.toISOString(),
      is_burst: data.is_burst, status, is_offline_sync: !!data.offline_timestamp,
      scanner_id: data.scanner_id, entrance_id: data.entrance_id });
    const response: ApiScanSuccess = {
      ok: true, scan_id: scanId, client_scan_id: data.client_scan_id, payload_hash: hash,
      persistence: 'memory-demo', attendance_status: status, is_burst: data.is_burst,
      student, message: 'Recibido por servidor de demostración; conserva la copia local',
      server_timestamp: new Date().toISOString(),
    };
    saveIdempotency(key, response);
    return json(response);
  } catch {
    console.error('[scan] REQUEST_FAILED');
    return json({ ok: false, code: 'INTERNAL', message: 'No se pudo procesar la marcación' }, 500);
  }
}

export async function GET() {
  const denied = demoGuard();
  return denied || json({ ok: true, service: 'SCA-QR Scan API (Demo)', students_count: MOCK_STUDENTS.length });
}
