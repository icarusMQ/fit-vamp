// FitTrack Lite service worker
// Caches the app shell so it works fully offline once installed. All user
// data lives in IndexedDB on-device; the only network calls the app itself
// makes are opt-in, to servers you configure — see app.js's header comment.

const CACHE_NAME = "fittrack-lite-v14";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./identity.js",
  "./groups.js",
  "./sync.js",
  "./drops.js",
  "./leaderboards.js",
  "./moderation.js",
  "./moderation-ui.js",
  "./backup.js",
  "./drive-backup.js",
  "./backup-ui.js",
  "./exercises-data.js",
  "./achievements-data.js",
  "./mascot.js",
  "./dialogue.js",
  "./sounds.js",
  "./vendor/qrcode.min.js",
  "./vendor/qrcode-utf8.min.js",
  "./vendor/jsQR.min.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Cache-first, falling back to network, so the app opens instantly offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
