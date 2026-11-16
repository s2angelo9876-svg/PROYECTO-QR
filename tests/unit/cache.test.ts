import { describe, it, expect, beforeEach } from 'vitest';
import { getCache, cached } from '@/lib/cache';

describe('cache abstraction', () => {
  beforeEach(async () => {
    const cache = getCache();
    await cache.clear();
  });

  it('usa memory por defecto', () => {
    const cache = getCache();
    expect(cache.backend).toBe('memory');
  });

  it('guarda y recupera valores', async () => {
    const cache = getCache();
    await cache.set('key1', { name: 'Test', value: 42 }, 60);
    const result = await cache.get<{ name: string; value: number }>('key1');
    expect(result).toEqual({ name: 'Test', value: 42 });
  });

  it('respeta TTL', async () => {
    const cache = getCache();
    await cache.set('expiring', 'value', 0.05); // 50ms
    expect(await cache.get('expiring')).toBe('value');
    await new Promise((r) => setTimeout(r, 100));
    expect(await cache.get('expiring')).toBeNull();
  });

  it('helper cached() evita recalcular', async () => {
    let calls = 0;
    const compute = async () => {
      calls++;
      return { data: 'computed' };
    };
    const a = await cached('cache-key', 60, compute);
    const b = await cached('cache-key', 60, compute);
    expect(a).toEqual({ data: 'computed' });
    expect(b).toEqual({ data: 'computed' });
    expect(calls).toBe(1);
  });

  it('has() retorna true para keys existentes', async () => {
    const cache = getCache();
    await cache.set('exists', 'value');
    expect(await cache.has('exists')).toBe(true);
    expect(await cache.has('not-exists')).toBe(false);
  });
});
