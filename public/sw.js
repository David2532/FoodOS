const CACHE_PREFIX = "foodos-static-";
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const LEGACY_CACHE_NAMES = new Set(["foodos-static-v1", "foodos-static-v2"]);
const OFFLINE_ASSETS = ["/offline", "/icon.svg", "/manifest.webmanifest"];
const AUTH_CALLBACK_PARAMETERS = ["code", "token_hash", "error", "error_code"];

function isAuthNavigation(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith("/auth/") || AUTH_CALLBACK_PARAMETERS.some((parameter) => url.searchParams.has(parameter));
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME && (key.startsWith(CACHE_PREFIX) || LEGACY_CACHE_NAMES.has(key)))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function offlineNavigationResponse() {
  const cached = await caches.match("/offline");
  return cached ?? new Response("FoodOS ist gerade offline. Stelle die Verbindung wieder her und versuche es erneut.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    // OAuth and recovery callbacks exchange a short-lived credential with the server.
    // They must use the network response, never the generic offline document.
    if (isAuthNavigation(event.request)) return;
    event.respondWith(fetch(event.request).catch(() => offlineNavigationResponse()));
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && OFFLINE_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
  }
});
