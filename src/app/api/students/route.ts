import { NextResponse } from 'next/server';
import { MOCK_STUDENTS } from '@/lib/mockData';
import { getCache, cached } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const CACHE_KEY = 'students:all';
const CACHE_TTL_SECONDS = 300; // 5 minutos

export async function GET() {
  try {
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

    const cache = getCache();
    const wasHit = (await cache.get(CACHE_KEY)) !== null;

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
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
export async function POST() {
  const cache = getCache();
  await cache.delete(CACHE_KEY);
  return NextResponse.json({ ok: true, message: 'Cache invalidado' });
}
