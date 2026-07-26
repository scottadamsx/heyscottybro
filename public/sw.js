/* heyscottybro service worker — minimal, safe:
   network-first for same-origin GETs, falling back to cache when offline.
   Makes the installed PWA usable on flaky mobile connections. */
const CACHE = "hsb-v2";

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;   // never touch API/POST/cross-origin
  if (url.pathname.startsWith("/api/")) return;                               // live data only

  // index.html is a valid fallback for a PAGE, never for a script or stylesheet.
  // Serving it for a missing JS chunk is what produced the browser error
  // "'text/html' is not a valid JavaScript MIME type" — which is how a stale
  // cache after a deploy showed up as consult_archivist "breaking".
  const isNavigation = e.request.mode === "navigate" || e.request.destination === "document";

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => {
        if (hit) return hit;
        if (isNavigation) return caches.match("/index.html");
        // Let the real network error surface — the app retries and reloads.
        return Response.error();
      }))
  );
});
