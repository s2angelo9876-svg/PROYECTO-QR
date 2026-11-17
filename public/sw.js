/* Public app shell only. Credentials, API responses and admin pages never enter Cache Storage. */
const CACHE_NAME = "sca-qr-public-v3";
const SHELL = "/ingreso";
const PUBLIC_ASSETS = [
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/sounds/success.wav",
  "/sounds/warning.wav",
  "/sounds/error.wav",
];
const isAsset = (url) =>
  !url.search &&
  (url.pathname.startsWith("/_next/static/") ||
    PUBLIC_ASSETS.includes(url.pathname));
const isPublic = (res) =>
  res.ok && !/private|no-store/i.test(res.headers.get("Cache-Control") || "");

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const shell = await fetch(SHELL, { cache: "reload" });
      if (!isPublic(shell)) throw new Error("Public shell is unavailable");
      const html = await shell.clone().text();
      await cache.put(SHELL, shell);
      // Include the actual compiled JS/CSS, not just an HTML page that cannot boot offline.
      const compiledAssets = [
        ...new Set(html.match(/\/_next\/static\/[^\s"'<>\\]+/g) || []),
      ];
      await cache.addAll([...PUBLIC_ASSETS, ...compiledAssets]);
      // Self-hosted font files referenced by the compiled CSS must also boot offline.
      for (const asset of compiledAssets.filter((path) =>
        path.endsWith(".css"),
      )) {
        const response = await cache.match(asset);
        if (!response) continue;
        const css = await response.text();
        const fonts = [
          ...new Set(
            css.match(/\/_next\/static\/media\/[^\s"')]+\.woff2/g) || [],
          ),
        ];
        await cache.addAll(fonts);
      }
      // No skipWaiting: a new version must not replace an active capture session.
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("sca-qr-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Explicit allowlist. This also excludes RSC/query responses and all /api and /admin requests.
  const shellNavigation =
    request.mode === "navigate" && url.pathname === SHELL && !url.search;
  if (!shellNavigation && !isAsset(url)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      if (!shellNavigation) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }
      try {
        const res = await fetch(request);
        if (isPublic(res))
          await cache.put(shellNavigation ? SHELL : request, res.clone());
        return res;
      } catch (error) {
        const hit = await cache.match(shellNavigation ? SHELL : request);
        if (hit) return hit;
        throw error;
      }
    })(),
  );
});
