// src/lib/pdf.ts
// Generador de reportes PDF con pdfkit
import PDFDocument from 'pdfkit';
import type { Student } from '@/types/attendance';

export interface ScanRecordForReport {
  id: string;
  student: Student | null;
  timestamp: string;
  status: 'ON_TIME' | 'LATE' | 'EARLY_LEAVE' | 'EXIT';
  isBurst: boolean;
  scannerId?: string;
  entranceId?: string;
}

export interface DailyReportData {
  schoolName: string;
  date: string;
  scans: ScanRecordForReport[];
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  generatedBy?: string;
}

const COLORS = {
  primary: '#0284c7',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
};

const STATUS_LABELS = {
  ON_TIME: 'Puntual',
  LATE: 'Tardanza',
  EARLY_LEAVE: 'Salida temprana',
  EXIT: 'Salida',
};

export async function generateDailyReport(
  data: DailyReportData,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fillColor(COLORS.primary)
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(data.schoolName, { align: 'center' });
      doc
        .fillColor(COLORS.muted)
        .fontSize(14)
        .font('Helvetica')
        .text('Reporte Diario de Asistencia', { align: 'center' });
      doc
        .fontSize(11)
        .text(`Fecha: ${data.date}`, { align: 'center' });

      doc.moveDown(1.5);

      // Summary box
      const summaryY = doc.y;
      const boxWidth = (doc.page.width - 100 - 30) / 4;
      drawStatBox(
        doc,
        50,
        summaryY,
        boxWidth,
        'Total',
        data.totalStudents.toString(),
        COLORS.primary,
      );
      drawStatBox(
        doc,
        50 + (boxWidth + 10) * 1,
        summaryY,
        boxWidth,
        'Presentes',
        data.present.toString(),
        COLORS.success,
      );
      drawStatBox(
        doc,
        50 + (boxWidth + 10) * 2,
        summaryY,
        boxWidth,
        'Tardanzas',
        data.late.toString(),
        COLORS.warning,
      );
      drawStatBox(
        doc,
        50 + (boxWidth + 10) * 3,
        summaryY,
        boxWidth,
        'Ausentes',
        data.absent.toString(),
        COLORS.danger,
      );

      doc.y = summaryY + 80;
      doc.moveDown(1);

      // Attendance rate
      const attendanceRate =
        data.totalStudents > 0 ? (data.present / data.totalStudents) * 100 : 0;
      doc
        .fillColor(COLORS.text)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(
          `Tasa de asistencia: ${attendanceRate.toFixed(1)}%`,
          { align: 'center' },
        );

      doc.moveDown(1.5);

      // Scans table
      if (data.scans.length > 0) {
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Detalle de marcaciones', { underline: true });

        doc.moveDown(0.5);

        // Table header
        const tableTop = doc.y;
        const colHora = 50;
        const colAlumno = 130;
        const colEstado = 380;
        const colLector = 460;

        doc
          .fontSize(10)
          .fillColor(COLORS.text)
          .font('Helvetica-Bold');
        doc.text('Hora', colHora, tableTop);
        doc.text('Alumno', colAlumno, tableTop);
        doc.text('Estado', colEstado, tableTop);
        doc.text('Lector', colLector, tableTop);

        doc
          .moveTo(50, tableTop + 15)
          .lineTo(doc.page.width - 50, tableTop + 15)
          .strokeColor(COLORS.border)
          .stroke();

        doc.font('Helvetica').fontSize(9);
        let y = tableTop + 22;

        for (const scan of data.scans.slice(0, 80)) {
          if (y > doc.page.height - 80) {
            doc.addPage();
            y = 50;
          }
          const time = new Date(scan.timestamp).toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
          const studentName = scan.student?.fullName || '—';
          const statusLabel = STATUS_LABELS[scan.status] || scan.status;
          const statusColor =
            scan.status === 'ON_TIME'
              ? COLORS.success
              : scan.status === 'LATE'
              ? COLORS.warning
              : COLORS.muted;
          const scanner = scan.scannerId || '—';

          doc.fillColor(COLORS.text).text(time, colHora, y);
          doc.text(studentName, colAlumno, y, { width: 240, ellipsis: true });
          doc.fillColor(statusColor).text(statusLabel, colEstado, y);
          doc.fillColor(COLORS.muted).text(scanner, colLector, y);

          y += 18;
        }

        if (data.scans.length > 80) {
          doc.moveDown(1);
          doc
            .fillColor(COLORS.muted)
            .fontSize(9)
            .text(
              `Mostrando primeras 80 marcaciones de ${data.scans.length} totales.`,
              { align: 'center' },
            );
        }
      } else {
        doc
          .fillColor(COLORS.muted)
          .fontSize(12)
          .text('No se registraron marcaciones este día.', { align: 'center' });
      }

      // Footer
      const footerY = doc.page.height - 60;
      doc
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          `Generado por SCA-QR el ${new Date().toLocaleString('es-PE')}${data.generatedBy ? ` por ${data.generatedBy}` : ''}`,
          50,
          footerY,
          { align: 'center', width: doc.page.width - 100 },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function drawStatBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  color: string,
): void {
  doc
    .roundedRect(x, y, width, 70, 8)
    .fillColor('#f8fafc')
    .fill();
  doc
    .roundedRect(x, y, width, 70, 8)
    .strokeColor(color)
    .lineWidth(2)
    .stroke();

  doc
    .fillColor('#64748b')
    .fontSize(9)
    .font('Helvetica')
    .text(label, x + 10, y + 12, { width: width - 20, align: 'center' });
  doc
    .fillColor(color)
    .fontSize(24)
    .font('Helvetica-Bold')
    .text(value, x + 10, y + 28, { width: width - 20, align: 'center' });
}
