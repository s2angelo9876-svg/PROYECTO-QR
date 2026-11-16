import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAttendanceLog, MOCK_STUDENTS } from '@/lib/mockData-exports';
import { generateDailyReport } from '@/lib/pdf';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const allScans = getAttendanceLog();
    const dayScans = allScans.filter((s) => s.timestamp.startsWith(dateStr));

    const presentIds = new Set(dayScans.map((s) => s.student_id));
    const lateScans = dayScans.filter((s) => s.status === 'LATE');
    const lateIds = new Set(lateScans.map((s) => s.student_id));

    const totalStudents = MOCK_STUDENTS.length;
    const present = presentIds.size;
    const absent = totalStudents - present;
    const late = lateIds.size;

    const pdfBuffer = await generateDailyReport({
      schoolName: process.env.SCHOOL_NAME || 'Colegio Santa María',
      date: dateStr,
      scans: dayScans.map((s) => ({
        id: s.scan_id,
        student: s.student,
        timestamp: s.timestamp,
        status: s.status,
        isBurst: s.is_burst,
        scannerId: s.scanner_id,
        entranceId: s.entrance_id,
      })),
      totalStudents,
      present,
      absent,
      late,
      generatedBy: auth.user.fullName,
    });

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="reporte-${dateStr}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[API /reports/daily] Error:', err);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: 'Error al generar el reporte' },
      { status: 500 },
    );
  }
}
