'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { safeLoginRedirect } from '@/lib/safeRedirect';

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = safeLoginRedirect(searchParams.get('redirect'));

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || 'Error de autenticación');
        return;
      }
      // Authentication changes invalidate prefetched unauthenticated redirects and RSC state.
      // A full document navigation re-enters the verified session boundary with the new cookie.
      window.location.assign(redirect);
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-1.5">
          Usuario
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
          autoComplete="username"
          className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition-all placeholder-slate-600"
          placeholder="admin"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-widest mb-1.5">
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition-all placeholder-slate-600"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold rounded-2xl px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="pressable w-full bg-gradient-to-r from-sky-500 to-sky-400 hover:from-sky-400 hover:to-sky-300 text-slate-950 font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {loading ? 'Validando...' : 'Iniciar Sesión'}
      </button>

      {/* Demo Credentials Box */}
      <div className="text-xs text-slate-400 text-center space-y-1.5 pt-4 border-t border-white/10 mt-4">
        <p className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">
          Credenciales de demostración:
        </p>
        <div className="flex justify-center gap-4 text-[11px]">
          <span className="font-mono bg-white/5 px-2 py-1 rounded-lg border border-white/5">
            👤 <code className="text-sky-300 font-bold">admin</code> / 🔑 <code className="text-sky-300 font-bold">admin123</code>
          </span>
        </div>
      </div>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-6 relative overflow-hidden select-none">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-sky-500/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-pill text-xs text-slate-400 hover:text-white border border-white/10 mb-4 transition-colors"
          >
            <span>← Volver al inicio</span>
          </Link>
          <h1 className="text-4xl font-black text-white tracking-tight">SCA-QR</h1>
          <p className="text-slate-400 text-xs mt-1">Panel de Gestión y Control Escolar</p>
        </div>

        <div className="glass-card rounded-3xl p-8 border border-white/10 shadow-2xl">
          <Suspense fallback={<div className="text-slate-400 text-center text-xs">Cargando...</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
