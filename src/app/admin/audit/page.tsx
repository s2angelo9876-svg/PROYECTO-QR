"use client";
import { useState } from "react";
import {
  PageHeading,
  useResource,
  ErrorNotice,
  Loading,
  Empty,
  SearchField,
  localDate,
  localTime,
} from "@/components/admin/ui";
interface Entry {
  id: string;
  actor: string | null;
  action: string;
  entity_id: string;
  metadata: object;
  created_at: string;
}
export default function Audit() {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    r = useResource<{ rows: Entry[] }>(
      `/api/admin/manage/audit?q=${encodeURIComponent(q)}&page=${page}`,
    );
  return (
    <>
      <PageHeading
        title="Auditoría de actividad"
        description="Accesos, cambios y resoluciones conservados como evidencia de la operación."
      />
      <ErrorNotice message={r.error} />
      <section className="surface">
        <div className="table-toolbar">
          <SearchField
            value={q}
            onChange={(s) => {
              setQ(s);
              setPage(1);
            }}
            placeholder="Filtrar por acción"
          />
          <span className="muted" style={{ fontSize: 11 }}>
            Página {page} · hasta 100 entradas
          </span>
        </div>
        {r.loading && !r.data ? (
          <Loading />
        ) : r.data?.rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Responsable</th>
                  <th>Acción</th>
                  <th>Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {r.data.rows.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {localDate(a.created_at)}
                      <br />
                      <small>{localTime(a.created_at)}</small>
                    </td>
                    <td>{a.actor || "Operación del sistema"}</td>
                    <td>{a.action}</td>
                    <td>
                      <details>
                        <summary style={{ cursor: "pointer" }}>
                          Ver detalle
                        </summary>
                        <div
                          style={{
                            fontSize: 10,
                            maxWidth: 360,
                            whiteSpace: "normal",
                            paddingTop: 8,
                          }}
                        >
                          <p>Referencia: {a.entity_id}</p>
                          <pre
                            style={{
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {JSON.stringify(a.metadata, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No hay entradas con este filtro"
            description="Prueba otra acción o vuelve a la primera página."
          />
        )}
        <div className="pagination">
          <button
            className="button secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </button>
          <button
            className="button secondary"
            disabled={(r.data?.rows.length || 0) < 100}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </section>
    </>
  );
}
