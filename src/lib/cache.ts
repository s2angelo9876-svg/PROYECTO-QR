import Redis from 'ioredis';
// src/lib/cache.ts
// Capa de abstracción de cache. Por defecto usa memoria local.
// Si se define REDIS_URL, usa Redis (Upstash, Redis Cloud, etc.)

type CacheValue = string | number | boolean | object | null | undefined;

interface CacheInterface {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  size(): number;
  backend: 'memory' | 'redis';
}

// =====================================================
// Implementación 1: Memoria local (por defecto)
// Pros: instantáneo, gratis, simple
// Contras: se pierde al reiniciar, no comparte entre instancias
// =====================================================

class MemoryCache implements CacheInterface {
  backend = 'memory' as const;
  private store = new Map<
    string,
    { value: unknown; expiresAt: number | null }
  >();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  // Utilidad: limpia entries expirados (llamar periódicamente)
  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt !== null && entry.expiresAt < now) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

// =====================================================
// Implementación 2: Redis (opcional, si REDIS_URL está definida)
// Pros: compartido entre instancias, persistente
// Contras: 1-5ms latencia de red, costo extra
// =====================================================

class RedisCache implements CacheInterface {
  backend = 'redis' as const;
  private client: Redis | null = null;
  private connecting: Promise<void> | null = null;

  constructor(private redisUrl: string) {
    this.connecting = this.connect();
  }

  private async connect(): Promise<void> {
    try {
      this.client = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      await this.client.connect();
      console.log('[Cache] Conectado a Redis');
    } catch (err) {
      console.error('[Cache] REDIS_CONNECTION_FAILED');
      this.client = null;
    }
  }

  private async ensureConnected(): Promise<boolean> {
    // The connection promise may change client.status; read it only after that transition.
    if (this.connecting) await this.connecting;
    return this.client?.status === 'ready';
  }

  async get<T>(key: string): Promise<T | null> {
    if (!(await this.ensureConnected()) || !this.client) return null;
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!(await this.ensureConnected()) || !this.client) return;
    const stringValue = JSON.stringify(value);
    if (stringValue === undefined) return;
    if (ttlSeconds) {
      await this.client.set(key, stringValue, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, stringValue);
    }
  }

  async delete(key: string): Promise<void> {
    if (!(await this.ensureConnected()) || !this.client) return;
    await this.client.del(key);
  }

  async has(key: string): Promise<boolean> {
    if (!(await this.ensureConnected()) || !this.client) return false;
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  async clear(): Promise<void> {
    if (!(await this.ensureConnected()) || !this.client) return;
    await this.client.flushdb();
  }

  size(): number {
    // Redis no expone size directamente sin SCAN
    return -1;
  }
}

// =====================================================
// Factory: elige automáticamente la implementación
// =====================================================

let cacheInstance: CacheInterface | null = null;

export function getCache(): CacheInterface {
  if (cacheInstance) return cacheInstance;

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl && redisUrl.length > 0) {
    console.log('[Cache] Redis configurado');
    cacheInstance = new RedisCache(redisUrl);
  } else {
    console.log('[Cache] Inicializando con memoria local (sin Redis)');
    cacheInstance = new MemoryCache();
  }

  return cacheInstance;
}

// Helper: get or compute pattern (memoización)
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const cache = getCache();
  const cachedValue = await cache.get<T>(key);
  if (cachedValue !== null) return cachedValue;

  const fresh = await compute();
  await cache.set(key, fresh, ttlSeconds);
  return fresh;
}

// Helper: invalidar cache por patrón (sirve solo en memoria)
export function invalidatePattern(pattern: string): number {
  const cache = getCache();
  if (cache.backend !== 'memory') return 0;
  let count = 0;
  const memoryCache = cache as MemoryCache;
  // Hack: acceder al store privado - en producción usar Map externo
  const store = (memoryCache as any).store as Map<string, unknown>;
  for (const key of store.keys()) {
    if (key.includes(pattern.replace('*', ''))) {
      store.delete(key);
      count++;
    }
  }
  return count;
}
