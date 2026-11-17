"use client";
import Link from "next/link";
import ManualAttendance from "./admin/ManualAttendance";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  QrCode,
  ScanLine,
  Wifi,
  WifiOff,
  ArrowUpRight,
  Download,
  RefreshCw,
  Settings2,
  ShieldCheck,
  LockKeyhole,
  Check,
} from "lucide-react";
import SerialReaderControls from "./SerialReaderControls";
import MultiScannerInput from "./MultiScannerInput";
import { api, ErrorNotice, Field, Badge, Empty, localTime } from "./admin/ui";
import { activateAvailableUpdate } from "@/lib/serviceWorkerRegistration";
import { refreshReceiptResolutions } from "@/lib/receiptResolution";
import { getLocalDB } from "@/lib/localDb";
import {
  enqueueScan,
  exportLocalRecords,
  getPendingScans,
  getRecentScans,
  syncOfflineQueue as syncPendingScans,
  OUTBOX_EVENT,
} from "@/lib/offlineQueue";
import {
  readTerminalSnapshot,
  saveTerminalSnapshot,
  type TerminalSnapshot,
} from "@/lib/terminalSnapshot";
import { verifyOfflineCredential } from "@/lib/qrPublic";
import { getStudentFromCache, refreshStudentsCache } from "@/lib/studentsCache";
import { parseQR, generateDemoQR } from "@/lib/qrValidator";
import { MOCK_STUDENTS } from "@/lib/mockData";
import { useClock } from "@/lib/useClock";
import { schoolDate } from "@/lib/schoolClock";
import type {
  PendingScan,
  RecentScan,
  ScannerConfig,
  MultiScanEvent,
  Student,
} from "@/types/attendance";
import {
  encryptLocalExport,
  importLocalExport,
  reconcileLocalRecords,
} from "@/lib/localRecovery";
interface Terminal {
  id: string;
  name: string;
  direction: string;
  enabled: boolean;
}
export default function TerminalClient() {
  const [manualOpen, setManualOpen] = useState(false),
    [updateReady, setUpdateReady] = useState(false),
    [mode, setMode] = useState("loading"),
    [online, setOnline] = useState(true),
    [ready, setReady] = useState(false),
    [storageLoaded, setStorageLoaded] = useState(false),
    [retainedCount, setRetainedCount] = useState(0),
    [exportBlock, setExportBlock] = useState(1),
    [snapshot, setSnapshot] = useState<TerminalSnapshot | null>(null),
    [terminals, setTerminals] = useState<Terminal[]>([]),
    [terminalId, setTerminalId] = useState(""),
    [authenticated, setAuthenticated] = useState(false),
    [pending, setPending] = useState<PendingScan[]>([]),
    [recent, setRecent] = useState<RecentScan[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState<{
      kind: "warning" | "success" | "danger";
      title: string;
      text: string;
      name?: string;
    } | null>(null),
    [manual, setManual] = useState(""),
    [passphrase, setPassphrase] = useState("");
  const latest = useRef(""),
    dialog = useRef<HTMLDialogElement>(null),
    clock = useClock();
  useEffect(() => {
    const ready = () => setUpdateReady(true);
    window.addEventListener("sca-update-ready", ready);
    void navigator.serviceWorker?.getRegistration("/").then((r) => {
      if (r?.waiting) setUpdateReady(true);
    });
    return () => window.removeEventListener("sca-update-ready", ready);
  }, []);
  const refresh = useCallback(async () => {
    setPending(await getPendingScans());
    setRecent(await getRecentScans());
    setStorageLoaded(true);
    setRetainedCount(await (await getLocalDB()).count("pending_scans"));
  }, []);
  const performSync = useCallback(
    async (resumeAuth = false) => {
      if (!navigator.onLine) return;
      const result = await syncPendingScans({ force: resumeAuth, resumeAuth });
      const event = result.events.find((e) => e.scanId === latest.current);
      if (event) {
        if (event.state === "ACKED") {
          const ack = event.acknowledgement!;
          setFeedback({
            kind: ack.persistence === "durable" ? "success" : "warning",
            title:
              ack.persistence === "durable"
                ? "Asistencia confirmada"
                : "Registro de demostración",
            text:
              ack.persistence === "durable"
                ? ack.message
                : "Copia conservada. El servidor de demostración no ofrece persistencia institucional.",
            name: ack.student.fullName,
          });
        } else
          setFeedback({
            kind: "warning",
            title:
              event.state === "REVIEW"
                ? "Captura en revisión"
                : "Copia local conservada",
            text:
              event.state === "BLOCKED_AUTH"
                ? "Inicia sesión de nuevo para reanudar la sincronización."
                : event.state === "REVIEW"
                  ? "La captura requiere una decisión de dirección o administración."
                  : "El servidor aún no confirmó esta captura. Puedes reintentar sin duplicarla.",
          });
      }
      await refreshReceiptResolutions();
      await refresh();
    },
    [refresh],
  );
  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const db = await getLocalDB();
        setOnline(navigator.onLine);
        let value = (await db.get("metadata", "runtime_mode"))?.value;
        try {
          const r = await api<{ mode: string }>("/api/runtime");
          value = r.mode;
          await db.put("metadata", { key: "runtime_mode", value });
        } catch {
          if (!value)
            throw new Error(
              "Conecta este equipo una primera vez para preparar la terminal.",
            );
        }
        if (!active) return;
        setMode(String(value));
        if (value === "demo") {
          await refreshStudentsCache();
          setReady(true);
        } else {
          const saved = await readTerminalSnapshot();
          if (
            saved &&
            new Date(saved.expiresAt).getTime() >
              Date.now() + (saved.clockOffsetMs || 0)
          ) {
            setSnapshot(saved);
            setReady(true);
          }
          if (navigator.onLine) {
            const r = await fetch("/api/terminal", { cache: "no-store" });
            if (r.ok) {
              const data = await r.json();
              setAuthenticated(true);
              setTerminals(data.rows);
              setTerminalId(saved?.terminal.id || data.rows[0]?.id || "");
            } else {
              setReady(false);
              if (r.status === 403)
                setError(
                  "Actualiza tu contraseña inicial desde Configuración → Cuenta.",
                );
            }
          }
        }
        await refresh();
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    }
    void initialize();
    const net = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine)
        void performSync().catch((e) => setError((e as Error).message));
    };
    const change = () =>
      void refresh().catch((e) => setError((e as Error).message));
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    window.addEventListener(OUTBOX_EVENT, change);
    const id = setInterval(() => {
      void performSync().catch((e) => setError((e as Error).message));
    }, 15000);
    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
      window.removeEventListener(OUTBOX_EVENT, change);
    };
  }, [refresh, performSync]);
  const expired = snapshot
    ? new Date(snapshot.expiresAt).getTime() <=
      clock + (snapshot.clockOffsetMs || 0)
    : false;
  const scannerId =
      mode === "demo" ? "N1" : snapshot?.terminal.scanner_id || "N1",
    entranceId =
      mode === "demo" ? "NORTE" : snapshot?.terminal.entrance_id || "PRINCIPAL";
  const scanners = useMemo<ScannerConfig[]>(
    () => [
      {
        id: scannerId,
        label: "Lector de esta estación",
        prefix: `${scannerId}|`,
        position: "center",
      },
    ],
    [scannerId],
  );
  const capture = useCallback(
    async (event: MultiScanEvent) => {
      if (!ready || expired) {
        setError("Abre una sesión de terminal vigente antes de capturar.");
        return;
      }
      setError("");
      const attemptId = crypto.randomUUID();
      latest.current = attemptId;
      setFeedback(null);
      try {
        let code = event.qrCode,
          signature = "JWS-ES256",
          student: Student | undefined;
        if (mode === "demo") {
          const parsed = parseQR(code);
          if (!parsed.valid) throw new Error(parsed.error);
          code = parsed.code;
          signature = parsed.signature;
          student = await getStudentFromCache(code);
        } else {
          if (!snapshot) throw new Error("Falta el padrón autorizado.");
          const credentialId = await verifyOfflineCredential(
            code,
            snapshot.schoolId,
            snapshot.keys,
            snapshot.credentials.filter((c) => c.revoked_at).map((c) => c.id),
            new Date(event.timestamp + (snapshot.clockOffsetMs || 0)),
          );
          const credential = snapshot.credentials.find(
            (c) => c.id === credentialId,
          );
          student = snapshot.students.find(
            (s) => s.id === credential?.student_id,
          );
          if (!student)
            throw new Error(
              "El carnet no está en este padrón. Actualiza la autorización de terminal.",
            );
        }
        const id = attemptId;
        await enqueueScan({
          scanId: id,
          qrCode: code,
          qrSignature: signature,
          isBurst: event.isBurst,
          timestamp: new Date(event.timestamp).toISOString(),
          scannerId: event.scannerId,
          entranceId: event.entranceId,
          ...(snapshot && mode === "institution"
            ? {
                terminalId: snapshot.terminal.id,
                terminalPermit: snapshot.permit,
                direction: snapshot.terminal.direction,
                clockOffsetMs: snapshot.clockOffsetMs || 0,
              }
            : {}),
        });
        if (latest.current === id)
          setFeedback({
            kind: "warning",
            title: "Guardado localmente",
            text: "Pendiente de confirmación del servidor.",
            name: student?.fullName,
          });
        await refresh();
        if (navigator.onLine) await performSync();
      } catch (e) {
        if (latest.current === attemptId) {
          setError((e as Error).message);
          setFeedback({
            kind: "danger",
            title: "No se guardó la captura",
            text: "Corrige el problema y vuelve a leer el carnet.",
          });
        }
      }
    },
    [ready, expired, mode, snapshot, refresh, performSync],
  );
  async function authorize() {
    setBusy(true);
    setError("");
    try {
      const sentAt = performance.now();
      const data = await api<{ snapshot: TerminalSnapshot }>("/api/terminal", {
        terminalId,
      });
      data.snapshot.clockOffsetMs = Math.round(
        Date.parse(data.snapshot.serverTime) -
          Date.now() +
          Math.min(5000, (performance.now() - sentAt) / 2),
      );
      await saveTerminalSnapshot(data.snapshot);
      setSnapshot(data.snapshot);
      setReady(true);
      await performSync(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportCopy() {
    try {
      let text = await exportLocalRecords(
          mode === "institution"
            ? { offset: (exportBlock - 1) * 5000, limit: 5000 }
            : undefined,
        ),
        extension = "json";
      if (mode === "institution") {
        text = await encryptLocalExport(text, passphrase);
        extension = "sca";
      }
      const url = URL.createObjectURL(
          new Blob([text], { type: "application/octet-stream" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = `sca-qr-copia-${schoolDate()}${mode === "institution" ? `-bloque-${exportBlock}` : ""}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="terminal-page">
      <a className="skip-link" href="#capture">
        Saltar al lector
      </a>
      <header className="terminal-top">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <QrCode size={22} />
          </span>
          SCA<span className="brand-qr"> / QR</span>
        </Link>
        <div className="row wrap">
          <span className="terminal-time">
            {clock
              ? localTime(
                  new Date(
                    clock + (snapshot?.clockOffsetMs || 0),
                  ).toISOString(),
                )
              : "—"}
          </span>
          <span
            className={`connection-pill ${online ? "" : "offline"}`}
            data-testid="connectivity-badge"
          >
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
            {online ? "ONLINE" : "OFFLINE"}
          </span>
          <Link className="button secondary" href="/admin/dashboard">
            Panel
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      {updateReady && (
        <div className="notice neutral spacer">
          <span>
            Hay una nueva versión preparada. Las capturas permanecen guardadas
            en este equipo.
          </span>
          <button
            className="text-button"
            onClick={() => void activateAvailableUpdate()}
          >
            Actualizar aplicación
          </button>
        </div>
      )}
      {mode === "demo" && (
        <div className="demo-banner spacer">
          Demostración con datos sintéticos · Un lector por estación · Las
          capturas no son asistencia institucional.
        </div>
      )}
      <div className="spacer">
        <ErrorNotice message={error} />
      </div>
      {mode === "institution" && (!ready || expired) && (
        <section className="surface terminal-auth">
          <LockKeyhole size={28} className="muted" />
          <h1 className="spacer">Prepara esta terminal</h1>
          <p>
            {expired
              ? "La autorización de captura ha vencido. Renueva el permiso cuando tengas conexión."
              : "Inicia sesión y selecciona la terminal asignada para descargar el padrón y autorizar las capturas."}
          </p>
          {authenticated ? (
            <>
              <Field label="Terminal autorizada">
                <select
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                >
                  <option value="">Seleccionar terminal</option>
                  {terminals
                    .filter((t) => t.enabled)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ·{" "}
                        {t.direction === "ENTRY" ? "Entrada" : "Salida"}
                      </option>
                    ))}
                </select>
              </Field>
              <div className="form-actions">
                <button
                  className="button"
                  disabled={busy || !terminalId || !online}
                  onClick={() => void authorize()}
                >
                  Autorizar por 8 horas
                </button>
              </div>
              {!terminals.length && (
                <p>
                  Administración debe asignarte una terminal desde
                  Configuración.
                </p>
              )}
            </>
          ) : (
            <Link className="button" href="/admin/login?redirect=/ingreso">
              Iniciar sesión
            </Link>
          )}
        </section>
      )}
      <div className="terminal-grid">
        <section>
          <section className="scan-stage" id="capture">
            <div className="scan-symbol">
              <ScanLine size={48} />
            </div>
            <h1>
              {ready && !expired
                ? "Listo para leer el carnet"
                : "Esperando autorización"}
            </h1>
            <p>
              {mode === "demo"
                ? "Pasa un QR de demostración o utiliza los botones de prueba."
                : snapshot
                  ? `${snapshot.terminal.name} · ${snapshot.terminal.direction === "ENTRY" ? "Registro de entradas" : "Registro de salidas"}`
                  : "Cada equipo necesita una sesión de captura autorizada."}
            </p>
            {ready && !expired && (
              <div className="row muted spacer" style={{ fontSize: 11 }}>
                <ShieldCheck size={15} />
                {mode === "demo"
                  ? "Validación de demostración"
                  : `Firma ES256 · Permiso hasta ${localTime(snapshot?.expiresAt)}`}
              </div>
            )}
            {feedback && (
              <div
                className={`scan-feedback ${feedback.kind}`}
                data-testid={`status-${feedback.kind}`}
                role="status"
              >
                <strong>{feedback.name || feedback.title}</strong>
                {feedback.name && (
                  <strong style={{ fontSize: 12 }}>{feedback.title}</strong>
                )}
                <p>{feedback.text}</p>
              </div>
            )}
          </section>
          <MultiScannerInput
            entranceId={entranceId}
            scanners={scanners}
            enabled={ready && !expired}
            onScan={(event) => void capture(event)}
            onInvalidInput={setError}
          />
          <section className="surface form-panel terminal-tools">
            <div className="row between">
              <h2>Lector de esta estación</h2>
              <button
                className="text-button"
                aria-label="Abrir panel de escáneres"
                onClick={() => dialog.current?.showModal()}
              >
                <Settings2 size={16} />
                Comprobar lector
              </button>
            </div>
            <p>
              Un lector HID por laptop. Usa un prefijo completo o una lectura
              sin prefijo desde el único lector configurado.
            </p>
            {mode === "institution" &&
              authenticated &&
              terminals.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <Field label="Terminal operativa">
                    <select
                      value={terminalId}
                      onChange={(e) => setTerminalId(e.target.value)}
                    >
                      {terminals
                        .filter((t) => t.enabled)
                        .map((t) => (
                          <option value={t.id} key={t.id}>
                            {t.name} ·{" "}
                            {t.direction === "ENTRY" ? "Entrada" : "Salida"}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
              )}
            {mode === "institution" && authenticated && (
              <button
                className="button secondary"
                disabled={busy || !online || !terminalId}
                onClick={() => void authorize()}
              >
                <RefreshCw size={15} />
                {snapshot?.terminal.id === terminalId
                  ? "Actualizar padrón y permiso"
                  : "Activar terminal seleccionada"}
              </button>
            )}

            {mode === "demo" && (
              <div className="chip-buttons">
                {MOCK_STUDENTS.slice(0, 4).map((s) => (
                  <button
                    key={s.id}
                    className="button secondary"
                    disabled={!ready}
                    onClick={() =>
                      void capture({
                        qrCode: generateDemoQR(s.dni),
                        scannerId,
                        entranceId,
                        isBurst: false,
                        timestamp: Date.now(),
                      })
                    }
                  >
                    Simular {s.firstName.split(" ")[0]}
                  </button>
                ))}
              </div>
            )}
            {mode === "institution" && snapshot && (
              <SerialReaderControls
                key={snapshot.sessionId}
                scanners={snapshot.scanners || []}
                enabled={ready && !expired}
                onError={setError}
                onFrame={(id, frame) =>
                  void capture({
                    qrCode: frame,
                    scannerId: id,
                    entranceId,
                    isBurst: false,
                    timestamp: Date.now(),
                  })
                }
              />
            )}
            <form
              className="row spacer"
              onSubmit={(e) => {
                e.preventDefault();
                void capture({
                  qrCode: manual,
                  scannerId,
                  entranceId,
                  isBurst: false,
                  timestamp: Date.now(),
                });
                setManual("");
              }}
            >
              <Field
                label="Pegar lectura completa"
                hint="Conserva el QR firmado completo, incluido SCA1."
              >
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  maxLength={1024}
                  required
                />
              </Field>
              <button
                className="button secondary"
                style={{ alignSelf: "center" }}
                disabled={!ready || expired}
              >
                Procesar lectura
              </button>
            </form>
          </section>
          {mode === "institution" &&
            snapshot &&
            ready &&
            !expired &&
            online && (
              <div className="spacer">
                <button
                  className="button secondary"
                  onClick={() => setManualOpen(!manualOpen)}
                >
                  Registro manual con motivo
                </button>
                {manualOpen && (
                  <ManualAttendance
                    terminal={snapshot}
                    onClose={() => setManualOpen(false)}
                    onSaved={() => void refresh()}
                  />
                )}
              </div>
            )}
          <section className="surface terminal-section">
            <div className="surface-header">
              <div>
                <h2>Movimientos en este equipo</h2>
                <p>
                  Los registros pendientes también permanecen en la cola local.
                </p>
              </div>
            </div>
            {recent.length ? (
              <div className="recent-list">
                {recent.map((r) => (
                  <div className="recent-row" key={r.scanId}>
                    <div>
                      <strong>{r.studentName || "Captura local"}</strong>
                      <small>{localTime(r.timestamp)}</small>
                    </div>
                    <Badge
                      state={
                        r.status === "SUCCESS"
                          ? "ACCEPTED"
                          : r.status === "ERROR"
                            ? "REJECTED"
                            : "REVIEW"
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="Todavía no hay movimientos"
                description="El próximo carnet leído aparecerá en este registro local."
              />
            )}
          </section>
        </section>
        <aside>
          <section className="surface">
            <div className="surface-header">
              <div>
                <h2>Cola de sincronización</h2>
                <p>
                  {storageLoaded ? pending.length : "—"} capturas pendientes de
                  resolver
                </p>
              </div>
              <span className="badge neutral">
                {storageLoaded ? pending.length : "—"}
              </span>
            </div>
            <div className="surface-body">
              <button
                className="button secondary"
                disabled={!online || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await performSync(true);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RefreshCw size={15} />
                Reintentar pendientes
              </button>
            </div>
            {pending.length ? (
              <div className="outbox-list">
                {pending.slice(0, 30).map((p) => (
                  <div className="outbox-row" key={p.scanId}>
                    <div>
                      <strong>{localTime(p.timestamp)}</strong>
                      <small
                        style={{
                          display: "block",
                          fontSize: 10,
                          color: "var(--muted)",
                        }}
                      >
                        {p.scanId.slice(0, 8)}
                      </small>
                    </div>
                    <Badge state={p.state || "REVIEW"} />
                  </div>
                ))}
              </div>
            ) : (
              <p
                className="muted"
                style={{ padding: "0 24px 24px", fontSize: 12 }}
              >
                {storageLoaded
                  ? "No hay capturas pendientes en este equipo."
                  : "La cola local todavía no pudo consultarse."}
              </p>
            )}
          </section>
          <section className="surface form-panel spacer">
            <h2>Copia y recuperación</h2>
            <p>
              Conserva los identificadores y recibos originales. No se eliminan
              registros confirmados automáticamente.
            </p>
            {mode === "institution" && (
              <Field
                label="Contraseña de la copia"
                hint="Mínimo 12 caracteres. Guárdala separada del archivo."
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </Field>
            )}
            {mode === "institution" && (
              <div className="spacer">
                <Field
                  label="Bloque de la copia"
                  hint={`${retainedCount} registros retenidos. Descarga todos los bloques para conservar una copia completa.`}
                >
                  <select
                    value={exportBlock}
                    onChange={(e) => setExportBlock(Number(e.target.value))}
                  >
                    {Array.from(
                      { length: Math.max(1, Math.ceil(retainedCount / 5000)) },
                      (_, i) => (
                        <option key={i} value={i + 1}>
                          Bloque {i + 1} · hasta 5.000 capturas
                        </option>
                      ),
                    )}
                  </select>
                </Field>
              </div>
            )}
            <div className="form-actions">
              {mode === "institution" && (
                <button
                  className="button secondary"
                  disabled={!online || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await reconcileLocalRecords();
                      setFeedback({
                        kind: "warning",
                        title: "Reconciliación terminada",
                        text: `${r.restored} recibos cotejados; ${r.review} casos requieren revisión.`,
                      });
                      await refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Reconciliar recibos (admin)
                </button>
              )}
              <button
                className="button secondary"
                onClick={() => void exportCopy()}
              >
                <Download size={15} />
                Exportar copia local
              </button>
            </div>
            {mode === "institution" && (
              <Field
                label="Restaurar copia cifrada"
                hint="No reemplaza registros ni genera nuevos identificadores."
              >
                <input
                  className="spacer"
                  type="file"
                  accept=".sca"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      if (f.size > 96000000)
                        throw new Error(
                          "La copia supera 96 MB. Importa los bloques separados de la exportación.",
                        );
                      const count = await importLocalExport(
                        await f.text(),
                        passphrase,
                      );
                      setError("");
                      setFeedback({
                        kind: "warning",
                        title: "Copia incorporada",
                        text: `${count} registros incorporados. Administración debe reconciliar los recibos confirmados tras restaurar el servidor.`,
                      });
                      await refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              </Field>
            )}
          </section>
        </aside>
      </div>
      <dialog ref={dialog}>
        <div className="dialog-body">
          <h2>Prueba del lector</h2>
          <p>
            Esta prueba comprueba el aviso visual. La validación física consiste
            en leer un carnet real desde el equipo y modelo de lector que se
            usará en el colegio.
          </p>
          <p>
            Identificador: {scannerId} · Prefijo: {scannerId}| · Una estación
            por flujo de teclado.
          </p>
          <div className="form-actions">
            <button
              className="button"
              onClick={() => {
                setFeedback({
                  kind: "warning",
                  title: "Prueba visual completada",
                  text: "No registra asistencia. Falta validar el lector físico con un carnet.",
                });
              }}
            >
              <ScanLine size={16} />
              Probar aviso visual
            </button>
            <button
              className="button secondary"
              onClick={() => dialog.current?.close()}
            >
              <Check size={15} />
              Entendido
            </button>
          </div>
        </div>
      </dialog>
    </main>
  );
}
