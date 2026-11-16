import { demoGuard } from '@/lib/demoMode';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { MOCK_STUDENTS, getAttendanceLog } from '@/lib/mockData-exports';

export async function GET(request: NextRequest) {
  const denied = demoGuard();
  if (denied) return denied;
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // Calcular estadísticas del día
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const allScans = getAttendanceLog();
    const todayScans = allScans.filter(
      (a) => new Date(a.timestamp).getTime() >= todayMs,
    );
    const present = new Set(todayScans.map((a) => a.student_id)).size;
    const lateScans = todayScans.filter((a) => a.status === 'LATE');
    const late = new Set(lateScans.map((a) => a.student_id)).size;
    const totalStudents = MOCK_STUDENTS.length;
    const absent = Math.max(0, totalStudents - present);
    const attendanceRate = totalStudents > 0 ? (present / totalStudents) * 100 : 0;

    // Marcaciones por hora
    const scansByHour: Record<number, number> = {};
    todayScans.forEach((scan) => {
      const hour = new Date(scan.timestamp).getHours();
      scansByHour[hour] = (scansByHour[hour] || 0) + 1;
    });
    const scansByHourArray = Array.from({ length: 14 }, (_, i) => {
      const hour = i + 6; // desde las 6am
      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count: scansByHour[hour] || 0,
      };
    });

    // Top tardanzas
    const lateByStudent: Record<string, number> = {};
    lateScans.forEach((s) => {
      lateByStudent[s.student_id] = (lateByStudent[s.student_id] || 0) + 1;
    });
    const topLate = Object.entries(lateByStudent)
      .map(([id, count]) => {
        const student = MOCK_STUDENTS.find((s) => s.id === id);
        return {
          studentId: id,
          studentName: student?.fullName || 'Desconocido',
          grade: student?.grade || '',
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      ok: true,
      date: today.toISOString().split('T')[0],
      stats: {
        totalStudents,
        present,
        absent,
        late,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        totalScansToday: todayScans.length,
      },
      scansByHour: scansByHourArray,
      topLate,
      generatedBy: auth.user.fullName,
    });
  } catch (err) {
    console.error('[API /admin/stats] Error:', err);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: 'Error al obtener estadísticas' },
      { status: 500 },
    );
  }
}
