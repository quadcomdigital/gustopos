// GustoPOS Service Worker — v7
// Strategy: network-first for navigations (fresh SPA), stale-while-revalidate
// for hashed assets, and a minimal offline fallback for the app shell.
// The API is NEVER cached (always network) so stale data is never served.
//
// v7: backdrop dismiss guarded on pointer press target (fixes mobile
// soft-keyboard ghost click closing the item modal when tapping the notes).
// v6: selecting a table from the map switches the POS back to "Sala" (dine-in).
// v5: alphabetical sorting of the POS modifier "Togli"/"Aggiungi" lists.
// v4: large vertical scrollbar on the detected POS terminal (installed PWA).
// v3: bumped to force installed PWAs to pick up the terminal-detection build
// (touch scrollbars + viewport/profile reporting).
// v2: explicit update flow — when a new SW version activates, notify every
// client with {type:'NEW_VERSION'} so the app can prompt/reload to pick up
// the latest build (PWA "deploy aggiornato"). Old caches are purged on activate.

const CACHE_NAME = 'gustopos-v7';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Tell all open clients that a new version is live. The app decides
        // whether to auto-reload or show a banner (see main.tsx).
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: 'NEW_VERSION', cacheName: CACHE_NAME }));
        });
      }),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API, socket.io, or QZ signing calls.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/') || url.pathname.startsWith('/signing/')) {
    return;
  }

  // Navigations: network-first, fall back to cached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Hashed assets + manifest: stale-while-revalidate.
  if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.webmanifest' || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Everything else: network with cache fallback.
  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});
