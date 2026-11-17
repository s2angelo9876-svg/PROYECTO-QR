"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import {
  PageHeading,
  useResource,
  ErrorNotice,
  Loading,
  Empty,
  api,
  localDate,
  localTime,
  RefreshButton,
} from "@/components/admin/ui";
interface Notice {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}
export default function Notifications() {
  const r = useResource<{ rows: Notice[] }>(
      "/api/admin/manage/notifications",
      30000,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  async function mark(id: string) {
    setBusy(id);
    try {
      await api("/api/admin/manage/notifications", { id });
      await r.reload();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeading
        title="Avisos del sistema"
        description="Incidencias de operación dentro del panel, sin servicios de mensajería externos."
      >
        <RefreshButton onClick={() => void r.reload()} disabled={r.loading} />
      </PageHeading>
      <ErrorNotice message={error || r.error} />
      <section className="surface">
        {r.loading && !r.data ? (
          <Loading />
        ) : r.data?.rows.length ? (
          r.data.rows.map((n) => (
            <article
              key={n.id}
              style={{ padding: 24, borderBottom: "1px solid var(--line)" }}
            >
              <div className="row between wrap">
                <div>
                  <h2 style={{ fontSize: 14 }}>{n.title}</h2>
                  <p className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                    {localDate(n.created_at)} · {localTime(n.created_at)} ·{" "}
                    {n.read_at ? "Leído" : "Sin leer"}
                  </p>
                </div>
                {!n.read_at && (
                  <button
                    className="button secondary"
                    disabled={busy === n.id}
                    onClick={() => void mark(n.id)}
                  >
                    <Check size={15} />
                    Marcar como leído
                  </button>
                )}
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--secondary)",
                  marginTop: 12,
                }}
              >
                {n.body}
              </p>
            </article>
          ))
        ) : (
          <Empty
            title="No hay avisos"
            description="Las capturas que requieren revisión generarán un aviso aquí."
          />
        )}
      </section>
    </>
  );
}
