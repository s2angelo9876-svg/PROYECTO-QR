"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  ClipboardCheck,
  FileDown,
  Settings2,
  History,
  Bell,
  QrCode,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import type { AdminUser } from "@/lib/authToken";
const navigation = [
  {
    href: "/admin/dashboard",
    label: "Resumen",
    icon: LayoutDashboard,
    roles: ["admin", "director", "secretary"],
  },
  {
    href: "/admin/students",
    label: "Alumnos y matrículas",
    icon: Users,
    roles: ["admin", "director", "secretary"],
  },
  {
    href: "/admin/scans",
    label: "Registro de asistencia",
    icon: ScanLine,
    roles: ["admin", "director", "secretary"],
  },
  {
    href: "/admin/review",
    label: "Incidencias",
    icon: ClipboardCheck,
    roles: ["admin", "director"],
  },
  {
    href: "/admin/reports",
    label: "Reportes",
    icon: FileDown,
    roles: ["admin", "director", "secretary"],
  },
  {
    href: "/admin/notifications",
    label: "Avisos",
    icon: Bell,
    roles: ["admin", "director", "secretary"],
  },
  {
    href: "/admin/audit",
    label: "Auditoría",
    icon: History,
    roles: ["admin", "director"],
  },
  {
    href: "/admin/settings",
    label: "Configuración",
    icon: Settings2,
    roles: ["admin", "director", "secretary", "porter"],
  },
];
const roleNames = {
  admin: "Administración",
  director: "Dirección",
  secretary: "Secretaría",
  porter: "Portería",
};
export default function AdminShell({
  children,
  user,
  schoolName,
  demo,
}: {
  children: React.ReactNode;
  user: AdminUser | null;
  schoolName: string;
  demo: boolean;
}) {
  const path = usePathname(),
    [open, setOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const returnFocus = trigger.current;
    const links = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ) || [],
      );
    links()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = links(),
        first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    const resized = () => {
      if (window.innerWidth > 760) setOpen(false);
    };
    document.addEventListener("keydown", key);
    window.addEventListener("resize", resized);
    return () => {
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", resized);
      returnFocus?.focus();
    };
  }, [open]);
  if (path === "/admin/login" || !user) return <>{children}</>;
  const title = navigation.find((n) => n.href === path)?.label || "Panel";
  return (
    <div className="admin-app">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Cerrar navegación"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${open ? "is-open" : ""}`}
        id="admin-navigation"
        ref={sidebar}
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label="Navegación principal"
      >
        {open && (
          <button
            className="icon-button mobile-menu drawer-close"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        )}
        <Link
          href="/admin/dashboard"
          className="brand"
          onClick={() => setOpen(false)}
        >
          <span className="brand-mark">
            <QrCode size={21} />
          </span>
          <span>
            SCA<span className="brand-qr"> / QR</span>
          </span>
        </Link>
        <div className="school-identity">
          <span className="school-avatar">{schoolName.slice(0, 1)}</span>
          <div>
            <strong>{schoolName}</strong>
            <span>Control de asistencia</span>
          </div>
        </div>
        <nav>
          {navigation
            .filter((n) => n.roles.includes(user.role))
            .map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={path === n.href ? "page" : undefined}
                className={`nav-item ${path === n.href ? "active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
                {path === n.href && (
                  <ChevronRight className="nav-caret" size={14} />
                )}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <Link className="terminal-link" href="/ingreso">
            <ScanLine size={18} />
            <span>Abrir portería</span>
            <ArrowUpRight size={16} />
          </Link>
          <div className="local-note">
            <ShieldCheck size={16} />
            <span>
              {demo ? "Modo demostración" : "Operación local · PostgreSQL"}
            </span>
          </div>
          <div className="profile">
            <span className="avatar">{user.fullName.slice(0, 1)}</span>
            <div>
              <strong>{user.fullName}</strong>
              <span>{roleNames[user.role]}</span>
            </div>
            <form action="/api/admin/logout" method="POST">
              <button
                className="icon-button"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="app-body" inert={open}>
        <header className="topbar">
          <div className="row">
            <button
              ref={trigger}
              className="icon-button mobile-menu"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls="admin-navigation"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="topbar-parent">Panel escolar</span>
            <ChevronRight size={14} />
            <span>{title}</span>
          </div>
          <Link
            href="/admin/notifications"
            className="icon-button"
            aria-label="Ver avisos"
          >
            <Bell size={18} />
          </Link>
        </header>
        <main id="main" className="page-content">
          {demo && (
            <div className="demo-banner">
              <span className="status-dot" />
              Demostración con datos sintéticos. Las capturas no tienen
              persistencia institucional.
            </div>
          )}
          {user.mustChangePassword && (
            <div className="notice warning">
              Cambia tu contraseña inicial para habilitar la operación.{" "}
              <Link href="/admin/settings">Abrir cuenta</Link>
            </div>
          )}
          {children}
        </main>
        <footer className="app-footer">
          <span>SCA-QR · Registro escolar</span>
          <span>Zona horaria: America/Lima</span>
        </footer>
      </div>
    </div>
  );
}
