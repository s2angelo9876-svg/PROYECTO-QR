import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import {
  sendLateArrivalNotification,
  sendDailySummary,
  sendAbsentNotification,
} from '@/lib/email';

const Schema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('late'),
    guardian: z.object({ email: z.string().email(), name: z.string().optional() }),
    studentName: z.string(),
    arrivalTime: z.string(),
    grade: z.string(),
  }),
  z.object({
    type: z.literal('absent'),
    guardian: z.object({ email: z.string().email(), name: z.string().optional() }),
    studentName: z.string(),
    date: z.string(),
  }),
  z.object({
    type: z.literal('summary'),
    director: z.object({ email: z.string().email(), name: z.string().optional() }),
    date: z.string(),
    stats: z.object({
      totalStudents: z.number(),
      present: z.number(),
      absent: z.number(),
      late: z.number(),
      attendanceRate: z.number(),
    }),
  }),
]);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, code: 'INVALID_INPUT', message: 'Datos inválidos' },
        { status: 400 },
      );
    }

    const data = parsed.data;
    let result;

    if (data.type === 'late') {
      result = await sendLateArrivalNotification(
        data.guardian,
        data.studentName,
        data.arrivalTime,
        data.grade,
      );
    } else if (data.type === 'absent') {
      result = await sendAbsentNotification(
        data.guardian,
        data.studentName,
        data.date,
      );
    } else {
      result = await sendDailySummary(data.director, data.date, data.stats);
    }

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: 'EMAIL_FAILED', message: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      messageId: result.id,
      message: 'Email enviado correctamente',
    });
  } catch (err) {
    console.error('[API /notifications/email] Error:', err);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: 'Error al enviar email' },
      { status: 500 },
    );
  }
}
