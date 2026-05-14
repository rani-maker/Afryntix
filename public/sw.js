// AFRYNTIX — Service Worker minimaliste pour le mode entrepôt
// Strategy : network-first pour les pages, cache-first pour les statiques.
// Note : la sync hors-ligne complète (queue IndexedDB des actions) reste à implémenter.

const CACHE_VERSION = "afryntix-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const STATIC_ASSETS = ["/", "/favicon.ico", "/icon.png", "/logo.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ne pas intercepter POST, ni les API server actions, ni les uploads
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;

  // Cache-first pour les statiques (Next.js _next/static, images, etc.)
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/uploads/")) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ||
        fetch(event.request).then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(event.request, copy));
          return res;
        }),
      ),
    );
    return;
  }

  // Network-first pour les pages HTML
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // On ne cache pas les pages dynamiques pour éviter d'afficher des données obsolètes
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
  );
});
