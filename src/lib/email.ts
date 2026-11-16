// src/lib/email.ts
// Servicio de email transaccional con Resend
// Free tier: 100 emails/día, 3,000/mes

interface EmailRecipient {
  email: string;
  name?: string;
}

interface EmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const FROM_ADDRESS =
  process.env.EMAIL_FROM || 'SCA-QR Colegio <noreply@tu-dominio.com>';

async function sendEmail(
  to: EmailRecipient,
  subject: string,
  html: string,
  text?: string,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // Modo dev sin API key: solo loguear
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY no configurada. Modo simulación.');
    console.log(`[Email] To: ${to.email}, Subject: ${subject}`);
    return { ok: true, id: 'simulated-' + Date.now() };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to.email],
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ''),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${err}` };
    }

    const data = (await res.json()) as { id: string };
    return { ok: true, id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    };
  }
}

// =====================================================
// Templates de email
// =====================================================

export async function sendLateArrivalNotification(
  guardian: EmailRecipient,
  studentName: string,
  arrivalTime: string,
  grade: string,
): Promise<EmailResult> {
  const subject = `⚠️ Tardanza registrada - ${studentName}`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f59e0b; color: white; padding: 20px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Aviso de Tardanza</h1>
      </div>
      <div style="background: #fffbeb; padding: 24px; border: 1px solid #fcd34d; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Estimado(a) <strong>${guardian.name || 'apoderado'}</strong>,</p>
        <p>Le informamos que su menor hijo(a) <strong>${studentName}</strong> del <strong>${grade}</strong> ha registrado su entrada a las <strong>${arrivalTime}</strong>, siendo considerado como <strong>TARDANZA</strong>.</p>
        <p>Le pedimos revisar y conversar con su hijo(a) sobre la importancia de la puntualidad.</p>
        <hr style="border: none; border-top: 1px solid #fcd34d; margin: 20px 0;" />
        <p style="color: #78716c; font-size: 12px;">Este es un mensaje automático del Sistema de Control de Asistencia. Por favor no responder a este correo.</p>
      </div>
    </div>
  `;
  return sendEmail(guardian, subject, html);
}

export async function sendDailySummary(
  director: EmailRecipient,
  date: string,
  stats: {
    totalStudents: number;
    present: number;
    absent: number;
    late: number;
    attendanceRate: number;
  },
): Promise<EmailResult> {
  const subject = `📊 Resumen de asistencia - ${date}`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #0284c7; color: white; padding: 20px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Resumen Diario de Asistencia</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">${date}</p>
      </div>
      <div style="background: #f0f9ff; padding: 24px; border: 1px solid #bae6fd; border-top: none;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #475569;">Total alumnos</td><td style="text-align: right; font-weight: bold; font-size: 18px;">${stats.totalStudents}</td></tr>
          <tr><td style="padding: 8px 0; color: #475569;">Presentes</td><td style="text-align: right; font-weight: bold; font-size: 18px; color: #16a34a;">${stats.present}</td></tr>
          <tr><td style="padding: 8px 0; color: #475569;">Tardanzas</td><td style="text-align: right; font-weight: bold; font-size: 18px; color: #f59e0b;">${stats.late}</td></tr>
          <tr><td style="padding: 8px 0; color: #475569;">Ausentes</td><td style="text-align: right; font-weight: bold; font-size: 18px; color: #dc2626;">${stats.absent}</td></tr>
          <tr><td colspan="2" style="border-top: 1px solid #bae6fd; padding-top: 12px;"></td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Asistencia</td><td style="text-align: right; font-weight: bold; font-size: 24px; color: #0284c7;">${stats.attendanceRate.toFixed(1)}%</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #bae6fd; margin: 20px 0;" />
        <p style="color: #64748b; font-size: 12px;">Reporte generado automáticamente. Ver dashboard completo en: <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/dashboard">${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/dashboard</a></p>
      </div>
    </div>
  `;
  return sendEmail(director, subject, html);
}

export async function sendAbsentNotification(
  guardian: EmailRecipient,
  studentName: string,
  date: string,
): Promise<EmailResult> {
  const subject = `📋 Ausencia registrada - ${studentName}`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #dc2626; color: white; padding: 20px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Aviso de Ausencia</h1>
      </div>
      <div style="background: #fef2f2; padding: 24px; border: 1px solid #fecaca; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Estimado(a) <strong>${guardian.name || 'apoderado'}</strong>,</p>
        <p>Le informamos que su menor hijo(a) <strong>${studentName}</strong> <strong>NO HA REGISTRADO ASISTENCIA</strong> el día de hoy, <strong>${date}</strong>.</p>
        <p>Si su hijo(a) se encuentra enfermo o tiene una justificación válida, le pedimos presentar el documento correspondiente a la dirección del colegio.</p>
        <hr style="border: none; border-top: 1px solid #fecaca; margin: 20px 0;" />
        <p style="color: #78716c; font-size: 12px;">Este es un mensaje automático. Por favor no responder a este correo.</p>
      </div>
    </div>
  `;
  return sendEmail(guardian, subject, html);
}
