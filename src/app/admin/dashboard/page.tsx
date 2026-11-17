"use client";
import Link from "next/link";
import {
  CalendarDays,
  ArrowUpRight,
  Users,
  UserCheck,
  Clock3,
  UserRoundMinus,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import {
  PageHeading,
  useResource,
  ErrorNotice,
  Loading,
  Empty,
  RefreshButton,
  Badge,
  MoreLink,
  localDate,
  localTime,
} from "@/components/admin/ui";
interface Overview {
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    pending: number;
    justified: number;
    nonTeaching: number;
  };
  date: string;
  schoolName: string;
  review: number;
  synthetic: boolean;
  hourly: { hour: number; count: number }[];
  recent: {
    id: string;
    student_name: string;
    grade: string;
    section: string;
    occurred_at: string;
    direction: string;
    status: string;
    disposition: string;
    terminal_name: string;
  }[];
  terminals: {
    id: string;
    name: string;
    direction: string;
    enabled: boolean;
  }[];
}
function AttendanceChart({ hours }: { hours: Overview["hourly"] }) {
  const firstHour = Math.min(6, ...hours.map((h) => Number(h.hour))),
    lastHour = Math.max(19, ...hours.map((h) => Number(h.hour)));
  const items = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => ({
    hour: i + firstHour,
    count: Number(
      hours.find((h) => Number(h.hour) === i + firstHour)?.count || 0,
    ),
  }));
  const max = Math.max(4, ...items.map((i) => i.count)),
    step = Math.ceil(max / 4),
    total = items.reduce((n, i) => n + i.count, 0);
  return (
    <div className="chart">
      <svg
        viewBox="0 0 650 252"
        role="img"
        aria-label={`Entradas confirmadas por hora. Total: ${total}. ${hours.map((h) => `${h.hour}:00: ${h.count}`).join("; ")}`}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const y = 20 + i * 44;
          return (
            <g key={i}>
              <line
                x1="35"
                y1={y}
                x2="642"
                y2={y}
                stroke="#e8ede9"
                strokeDasharray="3 4"
              />
              <text x="22" y={y + 4} textAnchor="end" className="chart-label">
                {step * (4 - i)}
              </text>
            </g>
          );
        })}
        {items.map((item, i) => {
          const height = (item.count / (step * 4)) * 176,
            x = 42 + i * (600 / items.length);
          return (
            <g key={item.hour}>
              <rect
                x={x}
                y={196 - height}
                width={Math.min(23, (600 / items.length) * 0.6)}
                height={height}
                rx="3"
                fill={item.hour < 12 ? "#287a56" : "#8db59c"}
              >
                <title>
                  {item.hour}:00 · {item.count} entradas
                </title>
              </rect>
              <text
                x={x + Math.min(23, (600 / items.length) * 0.6) / 2}
                y="220"
                textAnchor="middle"
                className={`chart-label ${i % 3 ? "chart-hour-extra" : ""}`}
              >
                {String(item.hour).padStart(2, "0")}
              </text>
            </g>
          );
        })}
        {!total && (
          <text x="340" y="106" textAnchor="middle" className="chart-label">
            Sin entradas confirmadas
          </text>
        )}
      </svg>
      <div className="row between">
        <span className="chart-legend">
          <span className="legend-square" />
          Entradas confirmadas
        </span>
        <span className="muted" style={{ fontSize: 10 }}>
          Hora local · America/Lima
        </span>
      </div>
    </div>
  );
}
export default function Dashboard() {
  const { data, error, loading, reload } = useResource<Overview>(
    "/api/admin/overview",
    30000,
  );
  const s = data?.summary;
  return (
    <>
      <PageHeading
        title="Resumen de asistencia"
        description="Una vista de la jornada, desde la primera entrada hasta el cierre."
      >
        <RefreshButton onClick={() => void reload()} disabled={loading} />
        <Link href="/admin/reports" className="button">
          <ArrowUpRight size={16} />
          Crear reporte
        </Link>
      </PageHeading>
      <ErrorNotice message={error} retry={() => void reload()} />
      {loading && !data ? (
        <Loading />
      ) : data && s ? (
        <>
          <div
            className="row between"
            style={{ marginBottom: 20, fontSize: 11 }}
          >
            <div className="row muted">
              <CalendarDays size={15} />
              {localDate(data.date)}
            </div>
            <span className="row muted">
              <span className="status-dot" />
              Actualización cada 30 segundos
            </span>
          </div>
          {data.synthetic && (
            <div className="notice neutral">
              Entorno de prueba con alumnos y registros sintéticos. No
              representa la asistencia de un colegio real.
            </div>
          )}
          <section className="summary-strip" aria-label="Resumen de la jornada">
            {[
              {
                label: "Alumnos matriculados",
                value: s.total,
                detail: "Matrículas vigentes",
                icon: Users,
                style: "",
              },
              {
                label: "Presentes",
                value: s.present,
                detail: `${s.total ? Math.round((s.present / s.total) * 100) : 0}% del padrón de hoy`,
                icon: UserCheck,
                style: "positive",
              },
              {
                label: "Tardanzas",
                value: s.late,
                detail: "Según horario y tolerancia",
                icon: Clock3,
                style: "caution",
              },
              {
                label: "Sin entrada",
                value: Math.max(
                  0,
                  s.total - s.present - s.justified - s.nonTeaching,
                ),
                detail: `${s.pending} sin registro · ${s.absent} ausentes al cierre`,
                icon: UserRoundMinus,
                style: "",
              },
            ].map((m) => (
              <div className={`summary-item ${m.style}`} key={m.label}>
                <div className="summary-label">
                  {m.label}
                  <m.icon size={15} />
                </div>
                <span className="summary-number">
                  {m.value.toLocaleString("es-PE")}
                </span>
                <p>{m.detail}</p>
              </div>
            ))}
          </section>
          <div className="dashboard-grid">
            <section className="surface">
              <div className="surface-header">
                <div>
                  <h2>El ritmo de la jornada</h2>
                  <p>Entradas confirmadas, agrupadas por hora de captura.</p>
                </div>
                <ScanLine size={17} className="muted" />
              </div>
              <AttendanceChart hours={data.hourly} />
            </section>
            <section className="surface review-summary">
              <div>
                <div className="row between">
                  <h2>Por revisar</h2>
                  <ShieldCheck size={17} className="muted" />
                </div>
                <div className="review-number">{data.review}</div>
                <p>
                  {data.review
                    ? "Capturas que necesitan una decisión antes de confirmar asistencia."
                    : "No hay incidencias pendientes de resolver."}
                </p>
                <MoreLink href="/admin/review">Abrir incidencias</MoreLink>
              </div>
              <div className="review-tasks">
                <div className="review-task">
                  <span>Justificaciones del día</span>
                  <strong>{s.justified}</strong>
                </div>
                <div className="review-task">
                  <span>Terminales habilitadas</span>
                  <strong>
                    {data.terminals.filter((t) => t.enabled).length}
                  </strong>
                </div>
              </div>
            </section>
          </div>
          <section className="surface">
            <div className="surface-header">
              <div>
                <h2>Últimos movimientos</h2>
                <p>La hora corresponde a la captura original.</p>
              </div>
              <MoreLink href="/admin/scans">Ver registro</MoreLink>
            </div>
            {data.recent.length ? (
              <div className="table-scroll">
                <table>
                  <caption className="visually-hidden">
                    Movimientos recientes de asistencia
                  </caption>
                  <thead>
                    <tr>
                      <th>Alumno</th>
                      <th>Aula</th>
                      <th>Hora</th>
                      <th>Movimiento</th>
                      <th>Estado</th>
                      <th>Terminal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="name-cell">
                            <span className="avatar">
                              {r.student_name.slice(0, 1)}
                            </span>
                            <strong>{r.student_name}</strong>
                          </div>
                        </td>
                        <td>
                          {r.grade} · {r.section}
                        </td>
                        <td>{localTime(r.occurred_at)}</td>
                        <td>
                          {r.direction === "ENTRY" ? "Entrada" : "Salida"}
                        </td>
                        <td>
                          <Badge
                            state={
                              r.disposition === "ACCEPTED"
                                ? r.status
                                : r.disposition
                            }
                          />
                        </td>
                        <td className="muted">{r.terminal_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="La jornada todavía no tiene movimientos"
                description="Abre la terminal de portería y registra el primer carnet. Las capturas confirmadas se mostrarán en esta lista."
              >
                <Link className="button secondary" href="/ingreso">
                  Abrir portería
                  <ArrowUpRight size={15} />
                </Link>
              </Empty>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
