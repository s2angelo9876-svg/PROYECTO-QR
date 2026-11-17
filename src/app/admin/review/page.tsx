"use client";
import type { AdminUser } from "@/lib/authToken";
import { useState } from "react";
import { Check, X, ClipboardCheck } from "lucide-react";
import {
  PageHeading,
  useResource,
  ErrorNotice,
  Loading,
  Empty,
  Field,
  api,
  localDate,
  localTime,
  RefreshButton,
} from "@/components/admin/ui";
interface Incident {
  id: string;
  student_name: string;
  code: string;
  direction: string;
  reason: string;
  occurred_at: string;
  received_at: string;
  terminal_name: string;
}
const reasons: Record<string, string> = {
  TERMINAL_CONFIGURATION_CHANGED: "Configuración de terminal modificada",
  SUBMITTER_NOT_ASSIGNED: "Remitente sin asignación operativa",
  TERMINAL_DISABLED: "Terminal deshabilitada",
  CAPTURE_SESSION_REVOKED: "Permiso de captura revocado",
  CAPTURE_OPERATOR_INACTIVE: "Operador inactivo",
  CREDENTIAL_REVOKED: "Credencial revocada",
  CLOCK_FUTURE: "Hora adelantada",
  CLOCK_OFFSET: "Desfase del reloj",
  OFFLINE_TOO_OLD: "Captura con más de 72 horas",
  NON_TEACHING_DAY: "Día no lectivo",
  OUTSIDE_WINDOW: "Fuera de jornada",
  BURST_REVIEW: "Lectura en ráfaga",
  EXIT_WITHOUT_ENTRY: "Salida sin entrada",
  ENTRY_ALREADY_RECORDED: "Entrada ya registrada",
  EXIT_ALREADY_RECORDED: "Salida ya registrada",
  AMBIGUOUS_SEQUENCE: "Secuencia ambigua",
  DOUBLE_READ: "Doble lectura",
  STUDENT_INACTIVE: "Alumno inactivo",
};
export default function Review() {
  const session = useResource<{ user: AdminUser }>("/api/admin/session");
  const recovery = useResource<{
    rows?: {
      id: string;
      event_id: string;
      created_at: string;
      terminal_name: string;
    }[];
  }>(
    session.data?.user.role === "admin"
      ? "/api/admin/manage/recovery"
      : "/api/admin/session",
  );

  const result = useResource<{ rows: Incident[] }>("/api/admin/manage/review"),
    [selected, setSelected] = useState<Incident | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function resolve(decision: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/review", {
        eventId: selected.id,
        decision,
        reason,
      });
      setNotice(
        `Incidencia ${decision === "ACCEPT" ? "aceptada" : "rechazada"} con trazabilidad.`,
      );
      setSelected(null);
      setReason("");
      await result.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Incidencias"
        description="Decide sobre las capturas que necesitan revisión. El registro original se conserva."
      >
        <RefreshButton
          onClick={() => void result.reload()}
          disabled={result.loading}
        />
      </PageHeading>
      <ErrorNotice message={error || result.error} />
      {notice && <div className="notice success">{notice}</div>}
      {recovery.data?.rows?.length ? (
        <section className="surface form-panel" style={{ marginBottom: 24 }}>
          <h2>Recuperaciones con contexto incompleto</h2>
          <p>
            Conserva las copias originales y revisa el respaldo con el
            responsable de recuperación. Evita registrar estas capturas con
            identificadores nuevos.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Terminal</th>
                  <th>Recibida</th>
                </tr>
              </thead>
              <tbody>
                {recovery.data.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.event_id.slice(0, 8)}</td>
                    <td>{r.terminal_name}</td>
                    <td>
                      {localDate(r.created_at)} · {localTime(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <div className={selected ? "split-view" : "stack"}>
        <section className="surface">
          {result.loading && !result.data ? (
            <Loading />
          ) : result.data?.rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Captura</th>
                    <th>Motivo</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.rows.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.student_name}</strong>
                        <small>{i.code}</small>
                      </td>
                      <td>
                        {localDate(i.occurred_at)}
                        <br />
                        <small>
                          {localTime(i.occurred_at)} ·{" "}
                          {i.direction === "ENTRY" ? "Entrada" : "Salida"}
                        </small>
                      </td>
                      <td>{reasons[i.reason] || i.reason}</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => {
                            setSelected(i);
                            setReason("");
                          }}
                        >
                          <ClipboardCheck size={15} />
                          Revisar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Todo revisado"
              description="Las capturas con problemas de horario, secuencia o estado aparecerán aquí para su resolución."
            />
          )}
        </section>
        {selected && (
          <aside className="surface form-panel">
            <h2>{selected.student_name}</h2>
            <p>{reasons[selected.reason] || selected.reason}</p>
            <dl className="info-list">
              <div>
                <dt>Hora original</dt>
                <dd>
                  {localDate(selected.occurred_at)}
                  <br />
                  {localTime(selected.occurred_at)}
                </dd>
              </div>
              <div>
                <dt>Recibida en servidor</dt>
                <dd>{localTime(selected.received_at)}</dd>
              </div>
              <div>
                <dt>Terminal</dt>
                <dd>{selected.terminal_name}</dd>
              </div>
            </dl>
            <div className="spacer">
              <Field
                label="Motivo de la resolución"
                hint="Mínimo 10 caracteres. No incluyas información médica u otros datos sensibles."
              >
                <textarea
                  minLength={10}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            </div>
            <div className="form-actions">
              <button
                className="button"
                disabled={busy || reason.trim().length < 10}
                onClick={() => void resolve("ACCEPT")}
              >
                <Check size={16} />
                Aceptar captura
              </button>
              <button
                className="button secondary"
                disabled={busy || reason.trim().length < 10}
                onClick={() => void resolve("REJECT")}
              >
                <X size={16} />
                Rechazar
              </button>
              <button className="text-button" onClick={() => setSelected(null)}>
                Cerrar
              </button>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
