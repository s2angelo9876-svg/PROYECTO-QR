"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import {
  Plus,
  Upload,
  Download,
  Printer,
  QrCode,
  Pencil,
  X,
  Ban,
} from "lucide-react";
import {
  PageHeading,
  useResource,
  ErrorNotice,
  Loading,
  Empty,
  Pagination,
  SearchField,
  Field,
  Badge,
  api,
  localDate,
} from "@/components/admin/ui";
import type { AdminUser } from "@/lib/authToken";
import type { Student } from "@/types/attendance";
import { schoolDate } from "@/lib/schoolClock";
interface Row extends Student {
  code: string;
  year: number;
  scheduleId: string;
  enrollmentId: string;
}
interface Form {
  id?: string;
  code: string;
  firstName: string;
  lastName: string;
  grade: string;
  section: string;
  year: number;
  scheduleId: string;
  status: string;
}
interface Preview {
  valid: boolean;
  batchId?: string;
  hash?: string;
  total: number;
  errors?: { line: number; message: string }[];
  errorCount?: number;
  preview?: Form[];
}
interface Credential {
  id: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
}
const blank = (): Form => ({
  code: "",
  firstName: "",
  lastName: "",
  grade: "",
  section: "",
  year: Number(schoolDate().slice(0, 4)),
  scheduleId: "",
  status: "ACTIVE",
});
function downloadText(text: string, name: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export default function StudentsPage() {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [year, setYear] = useState(Number(schoolDate().slice(0, 4))),
    [tab, setTab] = useState("students"),
    [form, setForm] = useState<Form | null>(null),
    [formSequence, setFormSequence] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [selected, setSelected] = useState<Row | null>(null),
    [credentials, setCredentials] = useState<Credential[]>([]),
    [issued, setIssued] = useState<{
      image: string;
      token: string;
      student: Student;
    } | null>(null),
    [revokeReason, setRevokeReason] = useState("");
  const result = useResource<{ rows: Row[]; total: number }>(
    `/api/admin/manage/students?q=${encodeURIComponent(q)}&page=${page}&year=${year}`,
  );
  const schedules = useResource<{ rows: { id: string; name: string }[] }>(
    "/api/admin/manage/schedules",
  );
  const session = useResource<{ user: AdminUser; mode: string }>(
    "/api/admin/session",
  );
  const canEdit = ["admin", "secretary"].includes(
    session.data?.user.role || "",
  );
  const editor = useRef<HTMLElement>(null),
    opener = useRef<HTMLElement | null>(null),
    createButton = useRef<HTMLButtonElement>(null);
  const formOpen = Boolean(form);
  useEffect(() => {
    if (!formSequence || tab !== "students") return;
    if (formOpen) {
      const input = editor.current?.querySelector<HTMLInputElement>("input");
      if (window.matchMedia("(max-width:1200px)").matches)
        editor.current?.scrollIntoView({ block: "start" });
      input?.focus({
        preventScroll: window.matchMedia("(max-width:1200px)").matches,
      });
    } else {
      const target = opener.current?.isConnected
        ? opener.current
        : createButton.current;
      target?.focus();
    }
  }, [formSequence, formOpen, tab]);
  const change = (key: keyof Form, value: string | number) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/manage/students", form);
      setNotice("Alumno y matrícula guardados.");
      await result.reload();
      setForm(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function showCredentials(row: Row) {
    setSelected(row);
    setIssued(null);
    setError("");
    try {
      const d = await api<{ rows: Credential[] }>(
        `/api/admin/manage/credentials?studentId=${row.id}`,
      );
      setCredentials(d.rows);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function issue() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const expiresAt = new Date(Date.now() + 180 * 86400000).toISOString();
      const d = await api<{ token: string; student: Student }>(
        "/api/admin/manage/credentials",
        { action: "issue", studentId: selected.id, expiresAt },
      );
      const image = await QRCode.toDataURL(d.token, {
        width: 600,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      setIssued({ image, token: d.token, student: d.student });
      const list = await api<{ rows: Credential[] }>(
        `/api/admin/manage/credentials?studentId=${selected.id}`,
      );
      setCredentials(list.rows);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/manage/credentials", {
        action: "revoke",
        id,
        reason: revokeReason,
      });
      setRevokeReason("");
      if (selected) await showCredentials(selected);
      setNotice(
        "Credencial revocada. Actualiza el padrón de las terminales conectadas.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importCsv(action: "preview" | "commit") {
    setBusy(true);
    setError("");
    try {
      const data = await api<Preview & { imported?: number }>(
        "/api/admin/imports",
        action === "preview"
          ? { action, csv }
          : { action, batchId: preview?.batchId, hash: preview?.hash },
      );
      if (action === "preview") setPreview(data);
      else {
        setNotice(`${data.imported} alumnos importados con su matrícula.`);
        setPreview(null);
        setCsv("");
        await result.reload();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="no-print">
        <PageHeading
          title="Alumnos y matrículas"
          description="Un padrón vigente para cada año escolar, con carnets y estado de matrícula."
        >
          {canEdit && (
            <>
              <button
                className="button secondary"
                onClick={() => {
                  setTab("import");
                  setSelected(null);
                }}
              >
                <Upload size={16} />
                Importar CSV
              </button>
              <button
                className="button"
                ref={createButton}
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setFormSequence((n) => n + 1);
                  setTab("students");
                  setSelected(null);
                  setForm({
                    ...blank(),
                    scheduleId: schedules.data?.rows[0]?.id || "",
                  });
                }}
              >
                <Plus size={16} />
                Nuevo alumno
              </button>
            </>
          )}
        </PageHeading>
        <ErrorNotice
          message={error || result.error}
          retry={() => void result.reload()}
        />
        {notice && (
          <div className="notice success" role="status">
            {notice}
          </div>
        )}
        <div className="tabs">
          <button
            className={`tab ${tab === "students" ? "active" : ""}`}
            onClick={() => setTab("students")}
          >
            Padrón escolar
          </button>
          {canEdit && (
            <button
              className={`tab ${tab === "import" ? "active" : ""}`}
              onClick={() => setTab("import")}
            >
              Importación CSV
            </button>
          )}
        </div>
      </div>
      {tab === "students" ? (
        <>
          <div className={form ? "split-view no-print" : "no-print"}>
            {form && (
              <aside
                ref={editor}
                className="surface form-panel student-editor"
                aria-labelledby="student-editor-title"
              >
                <div className="row between">
                  <h2 id="student-editor-title">
                    {form.id ? "Editar alumno" : "Nuevo alumno"}
                  </h2>
                  <button
                    className="icon-button"
                    aria-label="Cerrar formulario"
                    onClick={() => setForm(null)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <p>La matrícula se guarda para el año elegido.</p>
                <form onSubmit={save}>
                  <div className="form-grid">
                    <Field label="Código institucional">
                      <input
                        required
                        value={form.code}
                        onChange={(e) => change("code", e.target.value)}
                        maxLength={30}
                        pattern={"[A-Za-z0-9_\\-]{2,30}"}
                      />
                    </Field>
                    <Field label="Año">
                      <input
                        required
                        type="number"
                        min={2000}
                        max={2200}
                        value={form.year}
                        onChange={(e) => change("year", Number(e.target.value))}
                      />
                    </Field>
                    <div className="full-width">
                      <Field label="Nombres">
                        <input
                          required
                          maxLength={80}
                          value={form.firstName}
                          onChange={(e) => change("firstName", e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="full-width">
                      <Field label="Apellidos">
                        <input
                          required
                          maxLength={100}
                          value={form.lastName}
                          onChange={(e) => change("lastName", e.target.value)}
                        />
                      </Field>
                    </div>
                    <Field label="Grado">
                      <input
                        required
                        value={form.grade}
                        onChange={(e) => change("grade", e.target.value)}
                        maxLength={30}
                      />
                    </Field>
                    <Field label="Sección">
                      <input
                        required
                        value={form.section}
                        onChange={(e) => change("section", e.target.value)}
                        maxLength={20}
                      />
                    </Field>
                    <div className="full-width">
                      <Field label="Horario">
                        <select
                          required
                          value={form.scheduleId}
                          onChange={(e) => change("scheduleId", e.target.value)}
                        >
                          <option value="">Seleccionar horario</option>
                          {schedules.data?.rows.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="full-width">
                      <Field label="Estado">
                        <select
                          value={form.status}
                          onChange={(e) => change("status", e.target.value)}
                        >
                          <option value="ACTIVE">Activo</option>
                          <option value="SUSPENDED">Suspendido</option>
                          <option value="GRADUATED">Egresado</option>
                        </select>
                      </Field>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button className="button" disabled={busy}>
                      {busy ? "Guardando…" : "Guardar alumno"}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setForm(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </aside>
            )}
            <section className="surface students-list">
              <div className="table-toolbar">
                <SearchField
                  value={q}
                  onChange={(s) => {
                    setQ(s);
                    setPage(1);
                  }}
                />
                <label className="row" style={{ fontSize: 11 }}>
                  Año
                  <input
                    type="number"
                    aria-label="Año de matrícula"
                    min={2000}
                    max={2200}
                    value={year}
                    onChange={(e) => {
                      setYear(Number(e.target.value));
                      setPage(1);
                    }}
                    style={{ width: 100, minHeight: 36 }}
                  />
                </label>
              </div>
              {result.loading && !result.data ? (
                <Loading />
              ) : result.data?.rows.length ? (
                <>
                  <div className="table-scroll">
                    <table>
                      <caption className="visually-hidden">
                        Padrón de alumnos
                      </caption>
                      <thead>
                        <tr>
                          <th>Alumno</th>
                          <th>Código</th>
                          <th>Aula</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.rows.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <div className="name-cell">
                                <span className="avatar">
                                  {r.firstName.slice(0, 1)}
                                </span>
                                <strong>{r.fullName}</strong>
                              </div>
                            </td>
                            <td>{r.code}</td>
                            <td>
                              {r.grade || "Sin matrícula"} {r.section}
                            </td>
                            <td>
                              <Badge state={r.status} />
                            </td>
                            <td>
                              <div className="row">
                                {canEdit && (
                                  <button
                                    className="icon-button"
                                    aria-label={`Editar ${r.fullName}`}
                                    onClick={(event) => {
                                      opener.current = event.currentTarget;
                                      setFormSequence((n) => n + 1);
                                      setSelected(null);
                                      setForm({
                                        id: r.id,
                                        code: r.code,
                                        firstName: r.firstName,
                                        lastName: r.lastName,
                                        grade: r.grade,
                                        section: r.section,
                                        year: r.year || year,
                                        scheduleId:
                                          r.scheduleId ||
                                          schedules.data?.rows[0]?.id ||
                                          "",
                                        status: r.status,
                                      });
                                    }}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                )}
                                <button
                                  className="text-button"
                                  onClick={() => void showCredentials(r)}
                                >
                                  <QrCode size={15} />
                                  Carnet
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={page}
                    total={result.data.total}
                    onChange={setPage}
                  />
                </>
              ) : (
                <Empty
                  title="No se encontraron alumnos"
                  description="Cambia la búsqueda o incorpora alumnos mediante el formulario y la importación CSV."
                />
              )}
            </section>
          </div>
          {selected && (
            <section className="surface spacer">
              <div className="surface-header no-print">
                <div>
                  <h2>Carnet de {selected.fullName}</h2>
                  <p>
                    La firma acredita la emisión. Portería debe cotejar la
                    identidad del alumno.
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Cerrar carnets"
                  onClick={() => {
                    setSelected(null);
                    setIssued(null);
                  }}
                >
                  <X size={17} />
                </button>
              </div>
              <div className="surface-body">
                <div className="row wrap no-print" style={{ marginBottom: 24 }}>
                  {canEdit && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void issue()}
                    >
                      <QrCode size={16} />
                      Emitir carnet por 180 días
                    </button>
                  )}
                  {issued && (
                    <button
                      className="button secondary"
                      onClick={() => window.print()}
                    >
                      <Printer size={16} />
                      Imprimir carnet
                    </button>
                  )}
                </div>
                {issued && (
                  <div className="credential">
                    <div className="row" style={{ justifyContent: "center" }}>
                      <QrCode size={17} />
                      SCA-QR · Carnet escolar
                    </div>
                    <Image
                      src={issued.image}
                      alt={`Código QR firmado para ${selected.fullName}`}
                      width={220}
                      height={220}
                      unoptimized
                    />
                    <h3>{selected.fullName}</h3>
                    <p>
                      {selected.code} · {selected.grade} {selected.section}
                    </p>
                    <small>Cotejar identidad al ingreso</small>
                  </div>
                )}
                <div className="no-print spacer">
                  <h3>Historial de credenciales</h3>
                  {credentials.length ? (
                    <>
                      <Field
                        label="Motivo para revocar"
                        hint="Al menos 10 caracteres; por ejemplo, extravío del carnet."
                      >
                        <input
                          value={revokeReason}
                          onChange={(e) => setRevokeReason(e.target.value)}
                          maxLength={300}
                        />
                      </Field>
                      <div className="table-scroll spacer">
                        <table>
                          <thead>
                            <tr>
                              <th>Emitida</th>
                              <th>Vence</th>
                              <th>Estado</th>
                              <th>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {credentials.map((c) => (
                              <tr key={c.id}>
                                <td>{localDate(c.issued_at)}</td>
                                <td>{localDate(c.expires_at)}</td>
                                <td>
                                  <Badge
                                    state={c.revoked_at ? "REJECTED" : "ACTIVE"}
                                  />
                                </td>
                                <td>
                                  {!c.revoked_at && canEdit && (
                                    <button
                                      className="text-button"
                                      disabled={
                                        busy || revokeReason.trim().length < 10
                                      }
                                      onClick={() => void revoke(c.id)}
                                    >
                                      <Ban size={14} />
                                      Revocar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="muted spacer">
                      Este alumno aún no tiene credenciales.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="surface form-panel">
          <h2>Importar alumnos desde CSV</h2>
          <p>
            La carga incorpora alumnos nuevos. El archivo completo se valida
            antes de confirmar y no sobrescribe códigos existentes.
          </p>
          <div className="row wrap" style={{ marginBottom: 20 }}>
            <button
              className="button secondary"
              onClick={() =>
                downloadText(
                  `code,firstName,lastName,year,grade,section,scheduleId\nALU001,Nombres,Apellidos,${year},1,A,${schedules.data?.rows[0]?.id || "UUID_DEL_HORARIO"}\n`,
                  "plantilla-alumnos.csv",
                )
              }
            >
              <Download size={16} />
              Descargar plantilla
            </button>
            <label className="field">
              Archivo CSV UTF-8
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 2000000) {
                    setError("El archivo supera los 2 MB.");
                    return;
                  }
                  setCsv(await f.text());
                  setPreview(null);
                }}
              />
            </label>
          </div>
          <Field
            label="Contenido CSV"
            hint="Hasta 5.000 alumnos y 2 MB. El horario debe pertenecer al colegio."
          >
            <textarea
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setPreview(null);
              }}
              rows={7}
            />
          </Field>
          <div className="form-actions">
            <button
              className="button"
              disabled={busy || !csv}
              onClick={() => void importCsv("preview")}
            >
              {busy ? "Validando…" : "Validar y previsualizar"}
            </button>
            {preview?.valid && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void importCsv("commit")}
              >
                Confirmar importación de {preview.total} alumnos
              </button>
            )}
          </div>
          {preview && (
            <div className="spacer">
              {preview.valid ? (
                <>
                  <div className="notice success">
                    {preview.total} filas válidas. Se muestran hasta 20 antes de
                    confirmar.
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Alumno</th>
                          <th>Año</th>
                          <th>Aula</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview?.map((r) => (
                          <tr key={r.code}>
                            <td>{r.code}</td>
                            <td>
                              {r.firstName} {r.lastName}
                            </td>
                            <td>{r.year}</td>
                            <td>
                              {r.grade} {r.section}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div className="notice danger">
                    Corrige {preview.errorCount} errores antes de importar.
                  </div>
                  {preview.errors?.map((e) => (
                    <p
                      key={e.line}
                      className="secondary-text"
                      style={{ fontSize: 12 }}
                    >
                      Fila {e.line}: {e.message}
                    </p>
                  ))}
                </>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
