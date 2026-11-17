"use client";
import { useState } from "react";
import { Plus, Save, Pencil, KeyRound, ShieldCheck } from "lucide-react";
import {
  useResource,
  api,
  PageHeading,
  ErrorNotice,
  Field,
  Loading,
  Badge,
  localDate,
} from "@/components/admin/ui";
import type { AdminUser } from "@/lib/authToken";
import { schoolDate } from "@/lib/schoolClock";
type RecordRow = {
  scanners?: { id: string; protocol: string }[];
  id: string;
  name?: string;
  full_name?: string;
  username?: string;
  role?: string;
  active?: boolean;
  enabled?: boolean;
  entrance_id?: string;
  scanner_id?: string;
  direction?: string;
  operators?: string[];
  start_time?: string;
  end_time?: string;
  grace_minutes?: number;
  weekdays?: number[];
  local_date?: string;
  teaching?: boolean;
  reason?: string;
  version?: number;
};
type Form = {
  serialIds: string;
  id?: string;
  name: string;
  fullName: string;
  username: string;
  role: string;
  active: boolean;
  password: string;
  start: string;
  end: string;
  grace: number;
  weekdays: number[];
  entranceId: string;
  scannerId: string;
  direction: string;
  enabled: boolean;
  operators: string[];
  date: string;
  teaching: boolean;
  reason: string;
};
const initial = (): Form => ({
  serialIds: "",
  name: "",
  fullName: "",
  username: "",
  role: "porter",
  active: true,
  password: "",
  start: "07:00",
  end: "13:00",
  grace: 10,
  weekdays: [1, 2, 3, 4, 5],
  entranceId: "PRINCIPAL",
  scannerId: "N1",
  direction: "ENTRY",
  enabled: true,
  operators: [],
  date: schoolDate(),
  teaching: false,
  reason: "",
});
const names: Record<string, string> = {
  account: "Cuenta",
  settings: "Institución",
  schedules: "Horarios",
  calendar: "Calendario",
  terminals: "Terminales",
  users: "Usuarios",
  security: "Seguridad y copias",
};
export default function Settings() {
  const session = useResource<{ user: AdminUser; mode: string }>(
      "/api/admin/session",
    ),
    [tab, setTab] = useState("account"),
    [form, setForm] = useState<Form | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState("");
  const resource = useResource<{
    rows: RecordRow[];
    school?: { name: string; timezone: string };
    keys?: {
      kid: string;
      purpose: string;
      created_at: string;
      active: boolean;
    }[];
  }>(
    tab === "account"
      ? "/api/admin/session"
      : `/api/admin/manage/${tab === "security" ? "settings" : tab}`,
  );
  const users = useResource<{ rows: RecordRow[] }>(
    session.data?.user.role === "admin"
      ? "/api/admin/manage/users"
      : "/api/admin/session",
  );
  const isAdmin = session.data?.user.role === "admin";
  const change = (key: keyof Form, value: unknown) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));
  const switchTab = (t: string) => {
    setTab(t);
    setForm(null);
    setError("");
    setNotice("");
  };
  function edit(row: RecordRow) {
    setForm({
      ...initial(),
      id: row.id,
      serialIds:
        row.scanners
          ?.filter((s) => s.protocol === "SERIAL")
          .map((s) => s.id)
          .join(", ") || "",
      name: row.name || "",
      fullName: row.full_name || "",
      username: row.username || "",
      role: row.role || "porter",
      active: row.active ?? true,
      start: row.start_time?.slice(0, 5) || "07:00",
      end: row.end_time?.slice(0, 5) || "13:00",
      grace: row.grace_minutes ?? 10,
      weekdays: row.weekdays || [1, 2, 3, 4, 5],
      entranceId: row.entrance_id || "PRINCIPAL",
      scannerId: row.scanner_id || "N1",
      direction: row.direction || "ENTRY",
      enabled: row.enabled ?? true,
      operators: row.operators || [],
    });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/manage/${tab}`, {
        ...form,
        password: form.password || undefined,
      });
      setForm(null);
      setNotice("Configuración guardada y auditada.");
      await resource.reload();
      if (tab === "users") await users.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/account", {
        currentPassword: current,
        newPassword: password,
      });
      setCurrent("");
      setPassword("");
      setNotice(
        "Contraseña actualizada. Las otras sesiones y permisos de terminal se han revocado.",
      );
      await session.reload();
      window.location.assign(
        session.data?.user.role === "porter" ? "/ingreso" : "/admin/settings",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function rotate(purpose: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/manage/keys", { purpose });
      setNotice(
        "Nueva clave activa. Las claves públicas anteriores se conservan para verificar credenciales y recibos vigentes.",
      );
      await resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Configuración"
        description="Cuenta, reglas de la jornada y acceso autorizado a la operación."
      />
      <div className="tabs">
        {Object.entries(names)
          .filter(([key]) => key === "account" || isAdmin)
          .map(([key, name]) => (
            <button
              className={`tab ${tab === key ? "active" : ""}`}
              key={key}
              onClick={() => switchTab(key)}
            >
              {name}
            </button>
          ))}
      </div>
      <ErrorNotice message={error || resource.error} />
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      {tab === "account" ? (
        <section className="surface form-panel" style={{ maxWidth: 600 }}>
          <h2>Tu cuenta</h2>
          <p>
            {session.data?.user.fullName} · {session.data?.user.username}
          </p>
          <form onSubmit={changePassword} className="small-stack">
            <Field label="Contraseña actual">
              <input
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <Field
              label="Nueva contraseña"
              hint="Usa al menos 12 caracteres. Máximo 72 bytes; evita reutilizar contraseñas."
            >
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <div className="form-actions">
              <button
                className="button"
                disabled={busy || session.data?.mode === "demo"}
              >
                <KeyRound size={16} />
                {busy ? "Actualizando…" : "Cambiar contraseña"}
              </button>
            </div>
            {session.data?.mode === "demo" && (
              <p className="muted">
                El cambio de cuenta requiere configurar la base de datos
                institucional.
              </p>
            )}
          </form>
        </section>
      ) : tab === "security" ? (
        <div className="stack">
          <section className="surface form-panel">
            <div className="row">
              <ShieldCheck size={20} />
              <h2>Seguridad y recuperación local</h2>
            </div>
            <p>
              Las claves privadas permanecen en el servidor. Una rotación cambia
              las nuevas emisiones y conserva la verificación anterior.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Uso</th>
                    <th>Identificador público</th>
                    <th>Estado</th>
                    <th>Creación</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data?.keys?.map((k) => (
                    <tr key={k.kid}>
                      <td>{k.purpose}</td>
                      <td>
                        <code className="inline-code">{k.kid}</code>
                      </td>
                      <td>
                        <Badge state={k.active ? "ACTIVE" : "NO_RECORD"} />
                      </td>
                      <td>{localDate(k.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              {["QR", "RECEIPT", "PERMIT"].map((p) => (
                <button
                  key={p}
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void rotate(p)}
                >
                  Rotar clave {p}
                </button>
              ))}
            </div>
          </section>
          <section className="surface form-panel">
            <h2>Copias cifradas</h2>
            <p>
              La copia se ejecuta desde el equipo administrador, con una
              contraseña guardada fuera del repositorio. Incluye base de datos,
              sesiones y claves de firma.
            </p>
            <dl className="info-list">
              <div>
                <dt>Crear copia</dt>
                <dd>
                  <code className="inline-code">
                    npm run backup -- archivo.sca
                  </code>
                </dd>
              </div>
              <div>
                <dt>Verificar restauración aislada</dt>
                <dd>
                  <code className="inline-code">
                    npm run restore:verify -- archivo.sca
                  </code>
                </dd>
              </div>
              <div>
                <dt>Frecuencia propuesta</dt>
                <dd>Diaria, con dos copias institucionales</dd>
              </div>
            </dl>
            <p className="spacer">
              Consulta docs/OPERACION_GRATUITA.md. RPO 24 h y RTO 4 h son
              objetivos que el colegio debe medir. No hay borrado automático del
              historial.
            </p>
          </section>
        </div>
      ) : tab === "settings" ? (
        <section className="surface form-panel" style={{ maxWidth: 640 }}>
          <h2>Identidad de la institución</h2>
          <p>
            El nombre aparece en el panel y en los reportes. La zona escolar se
            mantiene en America/Lima.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const data = new FormData(e.currentTarget);
              try {
                await api("/api/admin/manage/settings", {
                  name: data.get("name"),
                });
                setNotice(
                  "Nombre actualizado. Recarga el panel para actualizar la navegación.",
                );
                await resource.reload();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Nombre de la institución">
              <input
                key={resource.data?.school?.name}
                name="name"
                required
                minLength={3}
                maxLength={120}
                defaultValue={resource.data?.school?.name}
              />
            </Field>
            <div className="form-actions">
              <button className="button" disabled={busy}>
                <Save size={16} />
                Guardar institución
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className={form ? "split-view" : "stack"}>
          <section className="surface">
            <div className="surface-header">
              <div>
                <h2>{names[tab]}</h2>
                <p>
                  {tab === "terminals"
                    ? "Un lector HID por estación. Los cambios revocan las autorizaciones abiertas."
                    : tab === "calendar"
                      ? "Las excepciones sustituyen el calendario semanal."
                      : tab === "users"
                        ? "Las cuentas nuevas deben cambiar su contraseña inicial."
                        : "Reglas versionadas; la tardanza usa la hora original de captura."}
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() => setForm(initial())}
              >
                <Plus size={15} />
                Añadir
              </button>
            </div>
            {resource.loading && !resource.data ? (
              <Loading />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {tab === "users" ? (
                        <>
                          <th>Persona</th>
                          <th>Rol</th>
                          <th>Acceso</th>
                        </>
                      ) : tab === "calendar" ? (
                        <>
                          <th>Fecha</th>
                          <th>Jornada</th>
                          <th>Motivo</th>
                        </>
                      ) : tab === "schedules" ? (
                        <>
                          <th>Horario</th>
                          <th>Inicio / cierre</th>
                          <th>Tolerancia</th>
                        </>
                      ) : (
                        <>
                          <th>Terminal</th>
                          <th>Modo / lector</th>
                          <th>Estado</th>
                        </>
                      )}
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data?.rows?.map((r) => (
                      <tr key={r.id || r.local_date}>
                        {tab === "users" ? (
                          <>
                            <td>
                              <strong>{r.full_name}</strong>
                              <small>{r.username}</small>
                            </td>
                            <td>{r.role}</td>
                            <td>
                              <Badge
                                state={r.active ? "ACTIVE" : "SUSPENDED"}
                              />
                            </td>
                          </>
                        ) : tab === "calendar" ? (
                          <>
                            <td>{localDate(r.local_date!)}</td>
                            <td>{r.teaching ? "Lectivo" : "No lectivo"}</td>
                            <td>{r.reason}</td>
                          </>
                        ) : tab === "schedules" ? (
                          <>
                            <td>
                              {r.name}
                              <small> · v{r.version}</small>
                            </td>
                            <td>
                              {r.start_time?.slice(0, 5)} –{" "}
                              {r.end_time?.slice(0, 5)}
                            </td>
                            <td>{r.grace_minutes} min</td>
                          </>
                        ) : (
                          <>
                            <td>
                              <strong>{r.name}</strong>
                              <small>{r.entrance_id}</small>
                            </td>
                            <td>
                              {r.direction === "ENTRY" ? "Entrada" : "Salida"} ·{" "}
                              {r.scanner_id}
                            </td>
                            <td>
                              <Badge
                                state={r.enabled ? "ACTIVE" : "SUSPENDED"}
                              />
                            </td>
                          </>
                        )}
                        <td>
                          {tab !== "calendar" && (
                            <button
                              className="icon-button"
                              aria-label={`Editar ${r.name || r.full_name}`}
                              onClick={() => edit(r)}
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!resource.data?.rows?.length && (
                  <p className="muted" style={{ padding: 24, fontSize: 12 }}>
                    Aún no hay registros. Usa Añadir para crear el primero.
                  </p>
                )}
              </div>
            )}
          </section>
          {form && (
            <aside className="surface form-panel">
              <h2>
                {form.id ? "Editar" : "Añadir"} {names[tab].toLowerCase()}
              </h2>
              <p>Guarda los cambios cuando estén revisados.</p>
              <form onSubmit={save}>
                <div className="small-stack">
                  {tab === "users" ? (
                    <>
                      <Field label="Nombre completo">
                        <input
                          required
                          value={form.fullName}
                          onChange={(e) => change("fullName", e.target.value)}
                        />
                      </Field>
                      <Field label="Usuario">
                        <input
                          required
                          value={form.username}
                          pattern={"[a-zA-Z0-9_.\\-]{3,50}"}
                          onChange={(e) => change("username", e.target.value)}
                        />
                      </Field>
                      <Field label="Rol">
                        <select
                          value={form.role}
                          onChange={(e) => change("role", e.target.value)}
                        >
                          <option value="porter">Portería</option>
                          <option value="secretary">Secretaría</option>
                          <option value="director">Dirección</option>
                          <option value="admin">Administración</option>
                        </select>
                      </Field>
                      <Field
                        label={
                          form.id
                            ? "Nueva contraseña (opcional)"
                            : "Contraseña inicial"
                        }
                      >
                        <input
                          type="password"
                          autoComplete="new-password"
                          required={!form.id}
                          minLength={12}
                          maxLength={72}
                          value={form.password}
                          onChange={(e) => change("password", e.target.value)}
                        />
                      </Field>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={form.active}
                          onChange={(e) => change("active", e.target.checked)}
                        />
                        Cuenta activa
                      </label>
                    </>
                  ) : tab === "schedules" ? (
                    <>
                      <Field label="Nombre del horario">
                        <input
                          required
                          value={form.name}
                          onChange={(e) => change("name", e.target.value)}
                        />
                      </Field>
                      <div className="form-grid">
                        <Field label="Inicio">
                          <input
                            required
                            type="time"
                            value={form.start}
                            onChange={(e) => change("start", e.target.value)}
                          />
                        </Field>
                        <Field label="Cierre">
                          <input
                            required
                            type="time"
                            value={form.end}
                            onChange={(e) => change("end", e.target.value)}
                          />
                        </Field>
                      </div>
                      <Field label="Tolerancia en minutos">
                        <input
                          required
                          type="number"
                          min={0}
                          max={120}
                          value={form.grace}
                          onChange={(e) =>
                            change("grace", Number(e.target.value))
                          }
                        />
                      </Field>
                      <fieldset>
                        <legend style={{ fontSize: 12, marginBottom: 8 }}>
                          Días lectivos
                        </legend>
                        <div className="chip-buttons">
                          {[
                            "Dom",
                            "Lun",
                            "Mar",
                            "Mié",
                            "Jue",
                            "Vie",
                            "Sáb",
                          ].map((d, i) => (
                            <label className="checkbox-row" key={d}>
                              <input
                                type="checkbox"
                                checked={form.weekdays.includes(i)}
                                onChange={(e) =>
                                  change(
                                    "weekdays",
                                    e.target.checked
                                      ? [...form.weekdays, i]
                                      : form.weekdays.filter((n) => n !== i),
                                  )
                                }
                              />
                              {d}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </>
                  ) : tab === "calendar" ? (
                    <>
                      <Field label="Fecha">
                        <input
                          required
                          type="date"
                          value={form.date}
                          onChange={(e) => change("date", e.target.value)}
                        />
                      </Field>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={form.teaching}
                          onChange={(e) => change("teaching", e.target.checked)}
                        />
                        Es día lectivo
                      </label>
                      <Field label="Motivo">
                        <input
                          required
                          minLength={5}
                          maxLength={200}
                          value={form.reason}
                          onChange={(e) => change("reason", e.target.value)}
                        />
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label="Nombre de la terminal">
                        <input
                          required
                          value={form.name}
                          onChange={(e) => change("name", e.target.value)}
                        />
                      </Field>
                      <Field label="Entrada autorizada">
                        <input
                          required
                          value={form.entranceId}
                          pattern={"[A-Za-z0-9_\\-]{1,30}"}
                          onChange={(e) => change("entranceId", e.target.value)}
                        />
                      </Field>
                      <Field label="Identificador del lector">
                        <input
                          required
                          value={form.scannerId}
                          pattern={"[A-Za-z0-9_\\-]{1,20}"}
                          onChange={(e) => change("scannerId", e.target.value)}
                        />
                      </Field>
                      <Field
                        label="Lectores serial adicionales"
                        hint="Identificadores separados por coma, por ejemplo S1, S2. Requieren puertos independientes y validación física."
                      >
                        <input
                          value={form.serialIds}
                          onChange={(e) => change("serialIds", e.target.value)}
                          maxLength={200}
                        />
                      </Field>
                      <Field label="Movimiento">
                        <select
                          value={form.direction}
                          onChange={(e) => change("direction", e.target.value)}
                        >
                          <option value="ENTRY">Entrada</option>
                          <option value="EXIT">Salida</option>
                        </select>
                      </Field>
                      <Field
                        label="Operadores asignados"
                        hint="Selecciona con Ctrl o Cmd. Administración puede abrir cualquier terminal."
                      >
                        <select
                          multiple
                          value={form.operators}
                          onChange={(e) =>
                            change(
                              "operators",
                              Array.from(
                                e.target.selectedOptions,
                                (o) => o.value,
                              ),
                            )
                          }
                        >
                          {users.data?.rows
                            ?.filter((u) => u.active)
                            .map((u) => (
                              <option value={u.id} key={u.id}>
                                {u.full_name} · {u.role}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={form.enabled}
                          onChange={(e) => change("enabled", e.target.checked)}
                        />
                        Terminal habilitada
                      </label>
                    </>
                  )}
                </div>
                <div className="form-actions">
                  <button className="button" disabled={busy}>
                    <Save size={15} />
                    {busy ? "Guardando…" : "Guardar cambios"}
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
        </div>
      )}
    </>
  );
}
