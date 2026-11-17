"use client";
import { useState } from "react";
import { FileDown, Download, CalendarDays, ClipboardCheck } from "lucide-react";
import {
  api,
  PageHeading,
  ErrorNotice,
  Field,
  Empty,
  Badge,
  localTime,
  localDate,
  Pagination,
} from "@/components/admin/ui";
import type { ReportSnapshot, ReportRow } from "@/lib/reportSnapshot";
import { schoolDate } from "@/lib/schoolClock";
export default function Reports() {
  const [date, setDate] = useState(schoolDate()),
    [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<ReportRow | null>(null),
    [reason, setReason] = useState(""),
    [notice, setNotice] = useState("");
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await api<{ snapshot: ReportSnapshot }>(
        "/api/admin/report-snapshots",
        { date },
      );
      setSnapshot(d.snapshot);
      setPage(1);
      setSelected(null);
      setNotice("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function justify() {
    if (!selected || !snapshot) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/review", {
        decision: "JUSTIFY",
        enrollmentId: selected.enrollmentId,
        date: snapshot.date,
        reason,
      });
      setSelected(null);
      setReason("");
      setNotice(
        "Justificación registrada. Crea una nueva instantánea para incluirla; el reporte anterior se conserva.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Reportes de asistencia"
        description="Consulta una jornada y exporta la misma instantánea completa en PDF y CSV."
      />
      <ErrorNotice message={error} />
      {notice && <div className="notice success">{notice}</div>}
      <section className="surface form-panel no-print">
        <form
          className="row wrap"
          style={{ alignItems: "flex-end", gap: 16 }}
          onSubmit={generate}
        >
          <Field label="Fecha escolar">
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <button className="button" disabled={busy}>
            <CalendarDays size={16} />
            {busy
              ? "Preparando reporte…"
              : snapshot
                ? "Crear nueva instantánea"
                : "Crear instantánea"}
          </button>
          <span className="muted" style={{ fontSize: 11, paddingBottom: 8 }}>
            America/Lima · No lectivo y sin registro se distinguen de ausencia.
          </span>
        </form>
      </section>
      {snapshot ? (
        <>
          <section
            className="summary-strip spacer"
            aria-label="Totales del reporte"
          >
            {[
              ["Matriculados", snapshot.summary.total],
              ["Presentes", snapshot.summary.present],
              ["Tardanzas", snapshot.summary.late],
              ["Ausentes al cierre", snapshot.summary.absent],
            ].map(([label, value]) => (
              <div className="summary-item" key={label}>
                <span className="summary-label">{label}</span>
                <span className="summary-number">{value}</span>
              </div>
            ))}
          </section>
          <section className="surface">
            <div className="surface-header">
              <div>
                <h2>Jornada del {localDate(snapshot.date)}</h2>
                <p>
                  {snapshot.rows.length} alumnos · {snapshot.summary.pending}{" "}
                  sin registro · {snapshot.summary.justified} justificados ·{" "}
                  {snapshot.summary.nonTeaching} no lectivos
                </p>
              </div>
              <div className="row wrap">
                <a
                  className="button secondary"
                  href={`/api/admin/report-snapshots?id=${snapshot.id}&format=csv`}
                  download
                >
                  <Download size={15} />
                  CSV completo
                </a>
                <a
                  className="button"
                  href={`/api/admin/report-snapshots?id=${snapshot.id}&format=pdf`}
                  download
                >
                  <FileDown size={15} />
                  PDF completo
                </a>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <caption className="visually-hidden">
                  Asistencia de la instantánea seleccionada
                </caption>
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Aula</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.rows.slice((page - 1) * 25, page * 25).map((r) => (
                    <tr key={r.studentId}>
                      <td>
                        <strong>{r.name}</strong>
                        <small>{r.code}</small>
                      </td>
                      <td>
                        {r.grade} {r.section}
                      </td>
                      <td>{localTime(r.entry)}</td>
                      <td>{localTime(r.exit)}</td>
                      <td>
                        <Badge state={r.state} />
                      </td>
                      <td>
                        {!r.entry &&
                          ["ABSENT", "NO_RECORD"].includes(r.state) && (
                            <button
                              className="text-button"
                              onClick={() => {
                                setSelected(r);
                                setReason("");
                              }}
                            >
                              <ClipboardCheck size={14} />
                              Justificar
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              total={snapshot.rows.length}
              onChange={setPage}
            />
            <div className="report-hash">
              Instantánea: {snapshot.id}
              <br />
              SHA-256: {snapshot.hash}
              <br />
              Creada: {localDate(snapshot.generatedAt)} ·{" "}
              {localTime(snapshot.generatedAt)}. Las exportaciones incluyen
              todos los alumnos.
            </div>
          </section>
          {selected && (
            <section className="surface form-panel spacer">
              <h2>Justificar la jornada de {selected.name}</h2>
              <p>
                Disponible para dirección y administración. No incluye
                información médica en el motivo.
              </p>
              <Field label="Motivo de la justificación">
                <textarea
                  minLength={10}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <div className="form-actions">
                <button
                  className="button"
                  disabled={busy || reason.trim().length < 10}
                  onClick={() => void justify()}
                >
                  Guardar justificación
                </button>
                <button
                  className="button secondary"
                  onClick={() => setSelected(null)}
                >
                  Cancelar
                </button>
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="surface spacer">
          <Empty
            title="Elige la jornada que quieres consultar"
            description="El reporte incluye a todos los alumnos con matrícula vigente en esa fecha. El PDF y el CSV se generan desde una misma instantánea."
          />
        </section>
      )}
    </>
  );
}
