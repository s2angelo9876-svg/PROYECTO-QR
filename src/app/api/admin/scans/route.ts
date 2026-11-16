import { demoGuard } from '@/lib/demoMode';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAttendanceLog } from '@/lib/mockData-exports';

export async function GET(request: NextRequest) {
  const denied = demoGuard();
  if (denied) return denied;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const date = searchParams.get('date'); // formato YYYY-MM-DD

    let scans = getAttendanceLog();
    if (date) {
      scans = scans.filter((s) => s.timestamp.startsWith(date));
    }
    scans = scans.slice(0, Math.min(limit, 200));

    return NextResponse.json({
      ok: true,
      scans: scans.map((s) => ({
        id: s.scan_id,
        timestamp: s.timestamp,
        student: {
          id: s.student_id,
          name: s.student.fullName,
          dni: s.student.dni,
          grade: s.student.grade,
          section: s.student.section,
        },
        status: s.status,
        isBurst: s.is_burst,
        scannerId: s.scanner_id,
        entranceId: s.entrance_id,
        isOfflineSync: s.is_offline_sync,
      })),
      total: scans.length,
    });
  } catch (err) {
    console.error('[API /admin/scans] Error:', err);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: 'Error al obtener marcaciones' },
      { status: 500 },
    );
  }
}
