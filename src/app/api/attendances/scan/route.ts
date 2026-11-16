import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStudentByDni, checkIdempotency, saveIdempotency, logAttendance, getAttendanceLog, MOCK_STUDENTS } from '@/lib/mockData-exports';
import { getCache } from '@/lib/cache';
import type { ApiScanRequest, ApiScanResponse, AttendanceStatus, Student } from '@/types/attendance';

const ScanSchema = z.object({
  qr_code: z.string().min(1).max(200),
  qr_signature: z.string().min(1).max(500),
  is_burst: z.boolean(),
  client_scan_id: z.string().min(1).max(100),
  scanner_id: z.string().optional(),
  entrance_id: z.string().optional(),
  offline_timestamp: z.string().datetime().optional(),
});

function computeAttendanceStatus(shift: string, isBurst: boolean, isExit: boolean): AttendanceStatus {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeDecimal = hour + minute / 60;

  if (isExit) return 'EXIT';

  // Turno mañana: 7:00 - 13:00. Tolerancia 10 min
  if (shift === 'MORNING') {
    if (timeDecimal < 7) return 'EARLY_LEAVE';
    if (timeDecimal <= 7.17) return 'ON_TIME'; // 7:10
    if (timeDecimal < 13) return 'LATE';
    return 'EXIT';
  }
  if (shift === 'AFTERNOON') {
    if (timeDecimal < 13) return 'EARLY_LEAVE';
    if (timeDecimal <= 13.17) return 'ON_TIME';
    if (timeDecimal < 18) return 'LATE';
    return 'EXIT';
  }
  return 'ON_TIME';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ScanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: 'INVALID_QR',
          message: 'Payload inválido: ' + parsed.error.issues[0].message,
        } satisfies ApiScanResponse,
        { status: 400 },
      );
    }

    const data: ApiScanRequest = parsed.data;

    // 1. Idempotencia
    const cached = checkIdempotency(data.client_scan_id) as ApiScanResponse | null;
    if (cached && cached.ok) {
      return NextResponse.json({ ...cached, idempotent: true });
    }

    // 2. Buscar estudiante por DNI (con cache)
    const cache = getCache();
    const cacheKey = `student:${data.qr_code}`;
    let student: Student | null = await cache.get<Student>(cacheKey);
    if (!student) {
      const found = getStudentByDni(data.qr_code);
      if (found) {
        // Cachear por 1 hora - los datos de alumnos cambian poco
        await cache.set(cacheKey, found, 3600);
        student = found;
      }
    }
    if (!student) {
      return NextResponse.json(
        {
          ok: false,
          code: 'STUDENT_NOT_FOUND',
          message: `DNI ${data.qr_code} no encontrado en el sistema`,
        } satisfies ApiScanResponse,
        { status: 404 },
      );
    }

    // 3. Validar firma (DEMO: cualquier firma >= 8 chars pasa)
    if (data.qr_signature.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          code: 'INVALID_QR',
          message: 'Firma del QR inválida',
        } satisfies ApiScanResponse,
        { status: 400 },
      );
    }

    // 4. Verificar duplicados recientes (anti doble marcación)
    const recentDuplicate = getAttendanceLog().find(
      (a) => a.student_id === student.id &&
        Date.now() - new Date(a.timestamp).getTime() < 60_000, // 1 min
    );
    if (recentDuplicate && !data.is_burst) {
      return NextResponse.json(
        {
          ok: false,
          code: 'DUPLICATE_SCAN',
          message: `${student.firstName} ya marcó entrada hace menos de 1 minuto`,
        } satisfies ApiScanResponse,
        { status: 409 },
      );
    }

    // 5. Determinar estado de asistencia
    const attendanceStatus = computeAttendanceStatus(student.shift, data.is_burst, false);
    const scanId = crypto.randomUUID();
    const isOfflineSync = !!data.offline_timestamp;

    // 6. Registrar (en producción: INSERT en BD)
    logAttendance({
      scan_id: scanId,
      student_id: student.id,
      student,
      timestamp: data.offline_timestamp ?? new Date().toISOString(),
      is_burst: data.is_burst,
      status: attendanceStatus,
      is_offline_sync: isOfflineSync,
      scanner_id: data.scanner_id,
      entrance_id: data.entrance_id,
    });

    // 7. Construir respuesta
    const response: ApiScanResponse = {
      ok: true,
      scan_id: scanId,
      attendance_status: attendanceStatus,
      is_burst: data.is_burst,
      student,
      message: data.is_burst
        ? `⚠️ Ráfaga detectada [${data.scanner_id || '?'}]`
        : `Entrada registrada: ${attendanceStatus}`,
      server_timestamp: new Date().toISOString(),
    };

    saveIdempotency(data.client_scan_id, response);

    return NextResponse.json(response);
  } catch (err) {
    console.error('[API /scan] Error:', err);
    return NextResponse.json(
      {
        ok: false,
        code: 'INTERNAL',
        message: 'Error interno del servidor',
      } satisfies ApiScanResponse,
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'SCA-QR Scan API (Demo)',
    students_count: MOCK_STUDENTS.length,
  });
}
