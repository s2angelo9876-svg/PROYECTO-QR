"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useResource, Field, ErrorNotice } from "./ui";
import { getLocalDB } from "@/lib/localDb";
import { verifyPublicReceipt, type PublicKeyRecord } from "@/lib/qrPublic";
import type { TerminalSnapshot } from "@/lib/terminalSnapshot";
import { schoolDate } from "@/lib/schoolClock";
import { localTime } from "./ui";
import type { AdminUser } from "@/lib/authToken";
interface Draft {
  terminalPermit?: string;
  clientScanId: string;
  studentId: string;
  terminalId: string;
  direction: string;
  occurredAt: string;
  reason: string;
}
export default function ManualAttendance({
  onClose,
  onSaved,
  terminal,
}: {
  terminal?: TerminalSnapshot;
  onClose: () => void;
  onSaved: () => void;
}) {
  const data = useResource<{
      schoolId: string;
      terminals: { id: string; name: string; direction: string }[];
      keys: PublicKeyRecord[];
    }>(terminal ? "/api/terminal/manual" : "/api/admin/manual-attendance"),
    session = useResource<{ user: AdminUser }>("/api/admin/session");
  const [captureTime, setCaptureTime] = useState(
      () => `${schoolDate()}T${localTime(new Date().toISOString())}`,
    ),
    [query, setQuery] = useState(""),
    [studentId, setStudentId] = useState(""),
    [terminalId, setTerminalId] = useState(""),
    [reason, setReason] = useState(""),
    [draft, setDraft] = useState<Draft | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [pendingReview, setPendingReview] = useState(false);
  const students = useResource<{
    rows: { id: string; code: string; fullName: string }[];
  }>(
    terminal
      ? "/api/admin/session"
      : `/api/admin/manage/students?q=${encodeURIComponent(query)}`,
  );
  useEffect(() => {
    if (!session.data?.user.id) return;
    void getLocalDB()
      .then(async (db) => {
        const raw = (
          await db.get("metadata", `manual_draft_${session.data!.user.id}`)
        )?.value;
        if (typeof raw === "string") setDraft(JSON.parse(raw));
      })
      .catch((e) => setError(e.message));
  }, [session.data]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!data.data || !session.data) return;
    setBusy(true);
    setError("");
    try {
      const selectedTerminal = data.data.terminals.find(
        (t) => t.id === (terminal?.terminal.id || terminalId),
      );
      if (!draft && !selectedTerminal)
        throw new Error("Selecciona una terminal.");
      const command = draft || {
        clientScanId: crypto.randomUUID(),
        studentId,
        terminalId: terminal?.terminal.id || terminalId,
        direction: terminal?.terminal.direction || selectedTerminal!.direction,
        terminalPermit: terminal?.permit,
        occurredAt: new Date(`${captureTime}-05:00`).toISOString(),
        reason,
      };
      const db = await getLocalDB();
      await db.put("metadata", {
        key: `manual_draft_${session.data.user.id}`,
        value: JSON.stringify(command),
      });
      setDraft(command);
      const r = await fetch(
          terminal ? "/api/terminal/manual" : "/api/admin/manual-attendance",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(command),
            cache: "no-store",
          },
        ),
        body = await r.json(),
        { receipt, ...signed } = body;
      if (
        ![200, 409].includes(r.status) ||
        !receipt ||
        !(await verifyPublicReceipt(
          receipt,
          data.data.schoolId,
          data.data.keys,
          signed,
        ))
      )
        throw new Error(
          body.message ||
            "No se pudo verificar el recibo. El borrador se conserva para reintentar.",
        );
      await db.put("metadata", {
        key: `manual_receipt_${command.clientScanId}`,
        value: JSON.stringify({ command, result: body }),
      });
      await db.delete("metadata", `manual_draft_${session.data.user.id}`);
      setDraft(null);
      setStudentId("");
      setReason("");
      setMessage(body.message);
      setPendingReview(body.disposition === "REVIEW");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface form-panel spacer">
      <div className="row between">
        <h2>Registrar asistencia manual</h2>
        <button
          className="icon-button"
          aria-label="Cerrar registro manual"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <p>
        Identifica al alumno y registra el motivo de la marcación manual. La
        hora indicada se conserva en el borrador y en los reintentos.
      </p>
      <ErrorNotice message={error || data.error} />
      {message && (
        <div
          className={`notice ${pendingReview ? "warning" : "success"}`}
          role="status"
        >
          {message}
        </div>
      )}
      {draft && (
        <div className="notice warning">
          Hay un envío pendiente. Reintenta el mismo borrador para recuperar su
          resultado. Identificador: {draft.clientScanId.slice(0, 8)}
        </div>
      )}
      <form onSubmit={submit}>
        <fieldset disabled={Boolean(draft) || busy}>
          <div className="form-grid">
            <Field label="Buscar alumno">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
            <Field label="Alumno">
              <select
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Seleccionar alumno</option>
                {(terminal
                  ? terminal.students
                      .filter(
                        (s) =>
                          s.fullName
                            .toLowerCase()
                            .includes(query.toLowerCase()) ||
                          s.dni.includes(query),
                      )
                      .slice(0, 25)
                      .map((s) => ({
                        id: s.id,
                        code: s.dni,
                        fullName: s.fullName,
                      }))
                  : students.data?.rows
                )?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Terminal y movimiento">
              <select
                required
                disabled={Boolean(terminal)}
                value={terminal?.terminal.id || terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
              >
                <option value="">Seleccionar terminal</option>
                {data.data?.terminals.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.direction === "ENTRY" ? "Entrada" : "Salida"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha y hora de captura (Lima)">
              <input
                type="datetime-local"
                step="1"
                required
                value={captureTime}
                onChange={(e) => setCaptureTime(e.target.value)}
              />
            </Field>
            <Field
              label="Motivo del registro manual"
              hint="Mínimo 10 caracteres; evita datos sensibles."
            >
              <input
                required
                minLength={10}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </div>
        </fieldset>
        <div className="form-actions">
          <button className="button" disabled={busy || !data.data}>
            {busy
              ? "Registrando…"
              : draft
                ? "Reintentar borrador pendiente"
                : "Registrar movimiento"}
          </button>
          <button type="button" className="button secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </form>
    </section>
  );
}
