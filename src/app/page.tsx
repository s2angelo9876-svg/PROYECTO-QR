import Link from "next/link";
import { QrCode, ArrowRight, ScanLine, LogIn } from "lucide-react";
export default function Home() {
  return (
    <main className="landing">
      <header>
        <Link className="brand" href="/">
          <span className="brand-mark">
            <QrCode size={22} />
          </span>
          SCA<span className="brand-qr"> / QR</span>
        </Link>
        <Link className="button secondary" href="/admin/login">
          <LogIn size={16} />
          Acceder al panel
        </Link>
      </header>
      <section className="landing-main">
        <div>
          <h1>El registro de cada jornada, en orden.</h1>
          <p>
            Control de asistencia escolar con carnets QR, capturas sin conexión
            y revisión de incidencias.
          </p>
          <div className="row wrap">
            <Link className="button" href="/ingreso">
              <ScanLine size={17} />
              Abrir portería
              <ArrowRight size={16} />
            </Link>
            <Link className="button quiet" href="/admin/dashboard">
              Consultar asistencia
            </Link>
          </div>
          <div className="landing-note">
            La terminal conserva las capturas pendientes en este equipo. Una
            asistencia se confirma cuando el servidor guarda y devuelve su
            recibo.
          </div>
        </div>
        <ol className="landing-steps">
          <li>
            <h2>Registrar en portería</h2>
            <p>
              Selecciona una terminal autorizada y utiliza el lector para marcar
              entradas o salidas.
            </p>
          </li>
          <li>
            <h2>Resolver con contexto</h2>
            <p>
              Revisa horarios, duplicados e incidencias sin perder la captura
              original.
            </p>
          </li>
          <li>
            <h2>Cerrar con un reporte</h2>
            <p>Exporta una misma instantánea de la jornada en PDF y CSV.</p>
          </li>
        </ol>
      </section>
      <footer className="muted" style={{ fontSize: 11 }}>
        SCA-QR · Software con ruta de operación local y servicios gratuitos.
      </footer>
    </main>
  );
}
