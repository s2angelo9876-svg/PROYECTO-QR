import PDFDocument from "pdfkit";
import type { ReportSnapshot } from "./reportSnapshot";
const labels: Record<string, string> = {
  ON_TIME: "Puntual",
  LATE: "Tardanza",
  ABSENT: "Ausente",
  NO_RECORD: "Sin registro",
  JUSTIFIED: "Justificado",
  NON_TEACHING: "No lectivo",
};
export async function snapshotPdf(s: ReportSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true }),
      chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc
      .fillColor("#174f3d")
      .font("Helvetica-Bold")
      .fontSize(19)
      .text(s.schoolName);
    doc.fillColor("#233a31").fontSize(13).text(`Asistencia del ${s.date}`);
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(`Zona: ${s.timezone} · Generado: ${s.generatedAt}`);
    doc
      .moveDown()
      .text(
        `Matriculados: ${s.summary.total} · Presentes: ${s.summary.present} · Tardanzas: ${s.summary.late} · Ausentes: ${s.summary.absent}`,
      );
    doc
      .text(
        `Sin registro: ${s.summary.pending} · Justificados: ${s.summary.justified} · No lectivos: ${s.summary.nonTeaching}`,
      )
      .moveDown();
    let y = doc.y + 10;
    const header = () => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#233a31");
      doc.text("Código / Alumno", 40, y);
      doc.text("Aula", 292, y);
      doc.text("Entrada", 344, y);
      doc.text("Salida", 412, y);
      doc.text("Estado", 475, y);
      y += 22;
      doc.font("Helvetica").fontSize(9);
    };
    header();
    for (const r of s.rows) {
      const height = Math.max(
        30,
        doc.heightOfString(`${r.code} · ${r.name}`, { width: 238 }) + 12,
      );
      if (y + height > doc.page.height - 74) {
        doc.addPage();
        y = 40;
        header();
      }
      const local = (v: string | null) =>
        v
          ? new Intl.DateTimeFormat("es-PE", {
              timeZone: s.timezone,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hourCycle: "h23",
            }).format(new Date(v))
          : "—";
      doc
        .fillColor("#233a31")
        .text(`${r.code} · ${r.name}`, 40, y, { width: 238 });
      doc.text(`${r.grade} ${r.section}`, 292, y, { width: 45 });
      doc.text(local(r.entry), 344, y, { width: 62 });
      doc.text(local(r.exit), 412, y, { width: 62 });
      doc.text(labels[r.state] || r.state, 475, y, { width: 78 });
      y += height;
      doc
        .strokeColor("#d9e1dc")
        .moveTo(40, y - 6)
        .lineTo(555, y - 6)
        .stroke();
    }
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(7)
        .fillColor("#52655b")
        .text(
          `Instantánea ${s.id} · ${i + 1}/${range.count}`,
          40,
          doc.page.height - 55,
          { lineBreak: false },
        );
      doc.text(`SHA-256 ${s.hash}`, 40, doc.page.height - 43, {
        lineBreak: false,
      });
    }
    doc.end();
  });
}
