const CACHE_NAME = "foodos-static-v2";
const OFFLINE_ASSETS = ["/offline", "/icon.svg", "/manifest.webmanifest"];
const AUTH_CALLBACK_PARAMETERS = ["code", "token_hash", "error", "error_code"];

function isAuthNavigation(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith("/auth/") || AUTH_CALLBACK_PARAMETERS.some((parameter) => url.searchParams.has(parameter));
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    // OAuth and recovery callbacks exchange a short-lived credential with the server.
    // They must use the network response, never the generic offline document.
    if (isAuthNavigation(event.request)) return;
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline")));
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && OFFLINE_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
  }
});
