"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { QrCode, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { safeLoginRedirect } from "@/lib/safeRedirect";
import { Field, ErrorNotice, api } from "@/components/admin/ui";
function LoginForm() {
  const params = useSearchParams(),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [demo, setDemo] = useState(false);
  useEffect(() => {
    void api<{ mode: string }>("/api/runtime")
      .then((d) => setDemo(d.mode === "demo"))
      .catch(() => {});
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const d = await api<{
        user: { mustChangePassword?: boolean; role: string };
      }>("/api/admin/login", { username, password });
      window.location.assign(
        d.user.mustChangePassword
          ? "/admin/settings"
          : d.user.role === "porter"
            ? "/ingreso"
            : safeLoginRedirect(params.get("redirect")),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="auth-form">
      <h1>Bienvenido de nuevo</h1>
      <p>Accede al registro de asistencia de tu institución.</p>
      <ErrorNotice message={error} />
      <form onSubmit={submit}>
        <Field label="Usuario">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            autoFocus
            maxLength={50}
          />
        </Field>
        <Field label="Contraseña">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            maxLength={200}
          />
        </Field>
        <button className="button" disabled={loading}>
          {loading ? "Validando acceso…" : "Iniciar Sesión"}
          <ArrowRight size={16} />
        </button>
      </form>
      {demo && (
        <div className="notice warning spacer">
          Demostración: admin / admin123. Estos accesos solo funcionan en el
          modo demo.
        </div>
      )}
      <p className="auth-return">
        ¿Necesitas recuperar el acceso? Contacta a la persona que administra el
        sistema.
      </p>
      <Link href="/" className="more-link spacer">
        <ArrowLeft size={14} />
        Volver al inicio
      </Link>
    </div>
  );
}
export default function LoginPage() {
  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <QrCode size={21} />
          </span>
          SCA<span className="brand-qr"> / QR</span>
        </Link>
        <div>
          <h2>Cada jornada empieza con un registro.</h2>
          <p>
            Entradas, salidas y decisiones de asistencia en un mismo lugar, con
            una copia local durante los cortes de conexión.
          </p>
          <div className="row spacer secondary-text">
            <ShieldCheck size={18} />
            <span style={{ fontSize: 12 }}>
              Acceso según tu rol y tu institución
            </span>
          </div>
        </div>
        <footer>Control de asistencia escolar · America/Lima</footer>
      </aside>
      <section className="auth-form-wrap">
        <Suspense fallback={<p>Cargando acceso…</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
