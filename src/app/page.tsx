import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden select-none">
      {/* Luces atmosféricas de fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-sky-500/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[250px] bg-indigo-500/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-5xl w-full text-center space-y-10 relative z-10 py-8">
        {/* Badge superior */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full glass-pill border border-white/10 shadow-lg animate-scale-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
            SCA-QR · Sistema de Asistencia Escolar PWA
          </span>
          <span className="text-[10px] bg-sky-500/20 text-sky-300 font-extrabold px-2 py-0.5 rounded-full border border-sky-500/30">
            Multi-Lector v2.0
          </span>
        </div>

        {/* Hero Title */}
        <div className="space-y-4 max-w-3xl mx-auto">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-white">
            Control de Ingreso con <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-400">Códigos QR</span>
          </h1>
          <p className="text-slate-400 text-base md:text-xl font-normal leading-relaxed">
            Plataforma diseñada para colegios de alta afluencia. Soporta <strong className="text-slate-200">hasta 4 lectores USB por laptop</strong>, funcionamiento 100% offline con sincronización automática y validación criptográfica en milisegundos.
          </p>
        </div>

        {/* Live Status Teaser (Muestra de Telemetría) */}
        <div className="max-w-xl mx-auto glass-card rounded-2xl p-4 border border-white/10 shadow-xl flex items-center justify-between gap-4 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl">
              🔌
            </div>
            <div>
              <p className="text-xs font-extrabold text-white flex items-center gap-2">
                <span>Hub Multi-Lector Activo</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </p>
              <p className="text-[11px] text-slate-400">
                4 lectores USB HID (N1, N2, N3, N4) con prefijos configurados
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
              OPERATIVO
            </span>
          </div>
        </div>

        {/* Call to Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/ingreso"
            className="pressable inline-flex items-center gap-3 bg-gradient-to-r from-sky-500 to-sky-400 hover:from-sky-400 hover:to-sky-300 text-slate-950 font-black text-lg px-8 py-4 rounded-2xl shadow-xl shadow-sky-500/25 border border-sky-300/40 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <span className="text-2xl">📷</span>
            <span>Abrir Terminal de Portería</span>
          </Link>

          <Link
            href="/admin/dashboard"
            className="pressable inline-flex items-center gap-2.5 glass-card hover:bg-white/[0.08] text-white font-bold text-base px-6 py-4 rounded-2xl border border-white/15 transition-all hover:scale-[1.02]"
          >
            <span>📊</span>
            <span>Panel Administrativo</span>
          </Link>
        </div>

        {/* Bento Grid de Capacidades */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left pt-6">
          <BentoCard
            icon="🔌"
            title="Soporte Multi-Lector USB"
            description="Conecta 3 a 4 pistolas ópticas en un solo Hub USB. La terminal discrimina cada puerta por prefijo de hardware (N1, N2, N3, N4)."
            badge="Hardware"
          />
          <BentoCard
            icon="📦"
            title="Modo Offline de Grado Militar"
            description="La cola local en IndexedDB almacena cada asistencia de inmediato aunque caiga el internet del colegio. Se sincroniza sola al volver."
            badge="Resiliencia"
          />
          <BentoCard
            icon="🛡️"
            title="Anti-Suplantación & Firmas"
            description="Verificación criptográfica HMAC y detección algorítmica de ráfagas para evitar capturas de pantalla o dobles marcaciones."
            badge="Seguridad"
          />
          <BentoCard
            icon="⚡"
            title="Respuesta en <30ms"
            description="Pre-caché local de alumnos con foto y datos de apoderado. El alumno y portero ven el resultado al instante en pantalla."
            badge="Rendimiento"
          />
          <BentoCard
            icon="🆔"
            title="Idempotencia con UUIDv4"
            description="Toda lectura lleva identificador de cliente único. Cero duplicados o registros corruptos al recuperar la red."
            badge="Fiabilidad"
          />
          <BentoCard
            icon="⌨️"
            title="Fallback de Búsqueda Manual"
            description="Búsqueda instantánea con teclado por DNI, nombre o grado si un alumno olvida el carnet físico en casa."
            badge="Operatividad"
          />
        </div>

        {/* Footer Guía de Pruebas */}
        <div className="pt-6 border-t border-white/10 text-xs text-slate-500 max-w-xl mx-auto space-y-2">
          <p className="font-semibold text-slate-400">
            💡 <strong>Entorno de Demostración:</strong>
          </p>
          <p>
            Puedes probar sin lectores USB conectando un teclado o usando los botones de simulación dentro de la terminal de portería.
          </p>
          <p className="font-mono text-[11px] text-sky-400">
            Códigos de prueba: <code>72345678|12345678</code>, <code>71234567|12345678</code>
          </p>
        </div>
      </div>
    </main>
  );
}

function BentoCard({
  icon,
  title,
  description,
  badge,
}: {
  icon: string;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="pressable glass-card rounded-3xl p-5 border border-white/10 hover:border-white/20 transition-all duration-200 flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-3xl">{icon}</span>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5 group-hover:border-sky-500/30 group-hover:text-sky-300 transition-colors">
            {badge}
          </span>
        </div>
        <h3 className="font-bold text-base text-white group-hover:text-sky-300 transition-colors mb-1.5">
          {title}
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
