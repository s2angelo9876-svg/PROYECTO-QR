// Service Worker - SCA-QR Demo
const CACHE_VERSION = 'sca-qr-v1';
const RUNTIME_CACHE = 'sca-qr-runtime-v1';
const PRECACHE_URLS = [
  '/ingreso',
  '/sounds/success.wav',
  '/sounds/warning.wav',
  '/sounds/error.wav',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch (err) {
        console.warn('[SW] Algunos assets no se pudieron pre-cachear:', err);
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION && k !== RUNTIME_CACHE)
          .map((k) => {
            console.log('[SW] Eliminando cache viejo:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== location.origin) return;

  // Network-first para navegación
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/ingreso'))
        )
    );
    return;
  }

  // Cache-first para assets estáticos
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// Mensajes desde la app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
