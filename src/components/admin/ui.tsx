"use client";
import {
  useCallback,
  useEffect,
  useState,
  useId,
  cloneElement,
  isValidElement,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Inbox,
} from "lucide-react";
import Link from "next/link";
export async function api<T = Record<string, unknown>>(
  path: string,
  value?: unknown,
): Promise<T> {
  const r = await fetch(path, {
    method: value === undefined ? "GET" : "POST",
    cache: "no-store",
    headers:
      value === undefined ? undefined : { "Content-Type": "application/json" },
    body: value === undefined ? undefined : JSON.stringify(value),
  });
  const data = await r.json();
  if (!r.ok || data.ok === false)
    throw new Error(data.message || "No se pudo completar la solicitud.");
  return data as T;
}
export function useResource<T>(path: string, refreshMs = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await api<T>(path);
        if (active) {
          setData(next);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "No se pudo cargar.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const id = refreshMs
      ? setInterval(() => void load(), refreshMs)
      : undefined;
    return () => {
      active = false;
      if (id) clearInterval(id);
    };
  }, [path, refreshMs]);
  return { data, error, loading, reload };
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return message ? (
    <div className="notice danger" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {retry ? (
        <button className="text-button" onClick={retry}>
          Reintentar
        </button>
      ) : (
        <Link href="/admin/login">Revisar sesión</Link>
      )}
    </div>
  ) : null;
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status" aria-label="Cargando datos">
      <div />
      <div />
      <div />
    </div>
  );
}
export const statusLabels: Record<string, string> = {
  ON_TIME: "Puntual",
  LATE: "Tardanza",
  EARLY_LEAVE: "Salida anticipada",
  EXIT: "Salida",
  ACCEPTED: "Confirmado",
  REVIEW: "En revisión",
  REJECTED: "Rechazado",
  NO_RECORD: "Sin registro",
  ABSENT: "Ausente",
  JUSTIFIED: "Justificado",
  NON_TEACHING: "No lectivo",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  GRADUATED: "Egresado",
  ENTRY: "Entrada",
  ACCEPT: "Aceptado",
  REJECT: "Rechazado",
};
export function Badge({ state }: { state: string }) {
  const color = ["ON_TIME", "ACCEPTED", "ACTIVE", "ACKED", "ACCEPT"].includes(
    state,
  )
    ? "success"
    : [
          "LATE",
          "REVIEW",
          "EARLY_LEAVE",
          "PENDING",
          "RETRY",
          "BLOCKED_AUTH",
        ].includes(state)
      ? "warning"
      : ["REJECTED", "ABSENT", "SUSPENDED", "ERROR", "REJECT"].includes(state)
        ? "danger"
        : "neutral";
  return (
    <span className={`badge ${color}`}>
      <span className="status-dot" />
      {statusLabels[state] || state}
    </span>
  );
}
export function localTime(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).format(new Date(value))
    : "—";
}
export function localDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}
export function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 25));
  return (
    <div className="pagination">
      <span>
        {total} registros · Página {page} de {pages}
      </span>
      <div className="row">
        <button
          className="icon-button"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Página siguiente"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "Buscar alumno o código",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-field">
      <Search size={17} />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function RefreshButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="button secondary" onClick={onClick} disabled={disabled}>
      <RefreshCw size={16} />
      Actualizar
    </button>
  );
}
export function MoreLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className="more-link" href={href}>
      {children}
      <ArrowRight size={15} />
    </Link>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const fieldId = useId(),
    hintId = fieldId + "-hint";
  const control = isValidElement<{ id?: string; "aria-describedby"?: string }>(
    children,
  )
    ? cloneElement(children, {
        id: fieldId,
        "aria-describedby": hint ? hintId : undefined,
      })
    : children;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      {control}
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  );
}
