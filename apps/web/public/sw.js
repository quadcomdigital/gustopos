// OmniRestaurant Service Worker — v11
// Strategy: network-first for navigations (fresh SPA), stale-while-revalidate
// for hashed assets, and a minimal offline fallback for the app shell.
// The API is NEVER cached (always network) so stale data is never served.
//
// v11: rebrand to OmniRestaurant — PWA icons moved under a versioned dir
//     (/icons/v2/) so installed PWAs refetch the bytes, header mark + venue
//     name, product wordmark, and renamed notification titles/fallbacks.
// v10: POS/Magazzino — category order owned by the tenant (Magazzino →
//     Categorie, up/down arrows → POS pills) + A→Z POS product grid for the
//     tenant that opted in + product archiving and a protected product delete.
// v9: Web Push — `push` shows a system notification (or forwards the payload
//     to a focused window as an in-app toast, so an always-open POS terminal
//     does not stack OS notifications over its UI) and `notificationclick`
//     focuses/opens the app on the notification's route.
// v8: modal focus no longer stolen from inputs — the mobile soft-keyboard was
// closing right after opening on the product-modal "Note" field because the
// open-effects re-ran on every parent render (inline onClose + viewport
// resize) and re-focused the confirm button. Latest-ref + init-on-open.
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

const CACHE_NAME = 'gustopos-v12';
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

// ─── Web Push ──────────────────────────────────────────────────────────────
// Payload shape comes from `pushNotificationPayloadSchema` in @gustopos/shared:
// { title, body, tag?, url?, icon?, whenVisible }.

self.addEventListener('push', (event) => {
  event.waitUntil(handlePushEvent(event));
});

async function handlePushEvent(event) {
  const payload = parsePushPayload(event);
  const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const visible = windowClients.filter(
    (client) => client.focused && client.visibilityState === 'visible',
  );

  // The app is open and in front (the normal state of a POS terminal): a
  // system notification would only pile up over the UI, so the payload is
  // handed to the page as an in-app toast instead. Set `whenVisible: false`
  // on the payload to always show a system notification.
  if (payload.whenVisible !== false && visible.length > 0) {
    visible.forEach((client) => client.postMessage({ type: 'PUSH_FOREGROUND', notification: payload }));
    return;
  }

  await self.registration.showNotification(payload.title || 'OmniRestaurant', {
    body: payload.body || '',
    icon: payload.icon || '/icons/v2/icon-192.png',
    badge: '/icons/v2/icon-192.png',
    tag: payload.tag,
    data: { url: payload.url || '/' },
  });
}

function parsePushPayload(event) {
  if (!event.data) {
    return { title: 'OmniRestaurant', body: '', whenVisible: true };
  }
  try {
    const parsed = event.data.json();
    if (parsed && typeof parsed === 'object') {
      return { title: 'OmniRestaurant', body: '', whenVisible: true, ...parsed };
    }
  } catch {
    // Not JSON (e.g. a manual "Push" from DevTools) — fall back to plain text.
  }
  return { title: 'OmniRestaurant', body: event.data.text(), whenVisible: true };
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(openOrFocus(target));
});

async function openOrFocus(target) {
  const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const sameOrigin = windowClients.find((client) => {
    try {
      return new URL(client.url).origin === self.location.origin;
    } catch {
      return false;
    }
  });

  // Focus an existing window without navigating it: the POS may hold an
  // unsaved cart / open modal, and yanking the route away would drop it.
  // With no window open, open the route the notification points at.
  if (sameOrigin) {
    await sameOrigin.focus();
    return;
  }
  await self.clients.openWindow(target);
}
