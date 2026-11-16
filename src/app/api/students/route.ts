import { demoGuard, originGuard } from '@/lib/demoMode';
import { NextResponse } from 'next/server';
import { MOCK_STUDENTS } from '@/lib/mockData';
import { getCache, cached } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'students:all';
const CACHE_TTL_SECONDS = 300; // 5 minutos

export async function GET() {
  const denied = demoGuard();
  if (denied) return denied;
  try {
    const cache = getCache();
    const wasHit = (await cache.get(CACHE_KEY)) !== null;
    const data = await cached(
      CACHE_KEY,
      CACHE_TTL_SECONDS,
      async () => ({
        ok: true,
        students: MOCK_STUDENTS,
        total: MOCK_STUDENTS.length,
        fetched_at: new Date().toISOString(),
      }),
    );

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Cache': wasHit ? 'HIT' : 'MISS',
        'X-Cache-Backend': cache.backend,
      },
    });
  } catch (err) {
    console.error('[API /students] Error:', err);
    return NextResponse.json(
      { ok: false, code: 'INTERNAL', message: 'Error al obtener estudiantes' },
      { status: 500 },
    );
  }
}

// Endpoint para refrescar el cache (llamar cuando se actualicen alumnos)
export async function POST(request: Request) {
  const denied = demoGuard() || originGuard(request);
  if (denied) return denied;
  const cache = getCache();
  await cache.delete(CACHE_KEY);
  return NextResponse.json({ ok: true, message: 'Cache invalidado' });
}
