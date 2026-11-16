import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser().catch(() => null);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 select-none">
      <nav className="glass-card border-b border-white/10 sticky top-0 z-30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-2.5 text-lg font-black tracking-tight text-white hover:text-sky-300 transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-400 flex items-center justify-center text-sm font-bold">
                QR
              </span>
              <span>SCA-QR · Panel</span>
            </Link>

            {user && (
              <div className="flex gap-2 text-xs font-bold">
                <Link
                  href="/admin/dashboard"
                  className="pressable px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/scans"
                  className="pressable px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  Marcaciones
                </Link>
                <Link
                  href="/admin/reports"
                  className="pressable px-3.5 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  Reportes
                </Link>
                <Link
                  href="/ingreso"
                  className="pressable px-3.5 py-1.5 rounded-full text-sky-400 hover:text-sky-300 bg-sky-500/10 border border-sky-500/20 transition-all flex items-center gap-1"
                >
                  <span>Terminal Portería</span>
                  <span>↗</span>
                </Link>
              </div>
            )}
          </div>

          {user && (
            <div className="flex items-center gap-4 text-sm">
              <div className="text-right hidden sm:block">
                <p className="text-slate-100 font-bold text-xs">{user.fullName}</p>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  {user.role}
                </p>
              </div>
              <form action="/api/admin/logout" method="POST">
                <button
                  type="submit"
                  className="pressable bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-slate-300 hover:text-rose-200 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          )}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
