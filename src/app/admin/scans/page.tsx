"use client";
import ManualAttendance from "@/components/admin/ManualAttendance";
import type { AdminUser } from "@/lib/authToken";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
  PageHeading,
  useResource,
  ErrorNotice,
  Loading,
  Empty,
  Pagination,
  SearchField,
  Badge,
  localTime,
  RefreshButton,
} from "@/components/admin/ui";
import { schoolDate } from "@/lib/schoolClock";
interface Row {
  id: string;
  student_name: string;
  code: string;
  grade: string;
  section: string;
  occurred_at: string;
  received_at: string;
  direction: string;
  disposition: string;
  status: string;
  adjudication: string | null;
  terminal_name: string;
  reason: string | null;
}
export default function Scans() {
  const session = useResource<{ user: AdminUser }>("/api/admin/session"),
    [manual, setManual] = useState(false);
  const [date, setDate] = useState(schoolDate()),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const r = useResource<{ rows: Row[]; total: number }>(
    `/api/admin/events?date=${date}&q=${encodeURIComponent(q)}&page=${page}`,
    15000,
  );
  return (
    <>
      <PageHeading
        title="Registro de asistencia"
        description="Cada movimiento conserva su hora de captura, recepción y resolución."
      >
        <RefreshButton onClick={() => void r.reload()} disabled={r.loading} />
        {["admin", "secretary"].includes(session.data?.user.role || "") && (
          <button className="button" onClick={() => setManual(!manual)}>
            <Plus size={16} />
            Registro manual
          </button>
        )}
      </PageHeading>
      {manual && (
        <ManualAttendance
          onClose={() => setManual(false)}
          onSaved={() => void r.reload()}
        />
      )}
      <ErrorNotice message={r.error} retry={() => void r.reload()} />
      <section className="surface">
        <div className="table-toolbar">
          <SearchField
            value={q}
            onChange={(s) => {
              setQ(s);
              setPage(1);
            }}
          />
          <label className="row muted" style={{ fontSize: 11 }}>
            Jornada
            <input
              aria-label="Fecha del registro"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        {r.loading && !r.data ? (
          <Loading />
        ) : r.data?.rows.length ? (
          <>
            <div className="table-scroll">
              <table>
                <caption className="visually-hidden">
                  Eventos de asistencia de la jornada
                </caption>
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Aula</th>
                    <th>Captura / recepción</th>
                    <th>Movimiento</th>
                    <th>Estado</th>
                    <th>Terminal</th>
                  </tr>
                </thead>
                <tbody>
                  {r.data.rows.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.student_name}</strong>
                        <small>{e.code}</small>
                      </td>
                      <td>
                        {e.grade} {e.section}
                      </td>
                      <td>
                        {localTime(e.occurred_at)}
                        <br />
                        <small>Recibido {localTime(e.received_at)}</small>
                      </td>
                      <td>{e.direction === "ENTRY" ? "Entrada" : "Salida"}</td>
                      <td>
                        <Badge
                          state={
                            e.adjudication === "ACCEPT"
                              ? e.status
                              : e.adjudication === "REJECT"
                                ? "REJECTED"
                                : e.disposition === "ACCEPTED"
                                  ? e.status
                                  : e.disposition
                          }
                        />
                        {e.adjudication && (
                          <small style={{ display: "block" }}>
                            Con resolución
                          </small>
                        )}
                      </td>
                      <td className="muted">{e.terminal_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={r.data.total} onChange={setPage} />
          </>
        ) : (
          <Empty
            title="Sin movimientos para esta búsqueda"
            description="Prueba otra fecha o busca por código. La asistencia se confirma desde una terminal autorizada."
          />
        )}
      </section>
    </>
  );
}
