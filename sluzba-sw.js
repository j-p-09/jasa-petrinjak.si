// EviDelo – service worker: aplikacija se odpre tudi brez povezave.
// Strategija: najprej predpomnilnik, v ozadju osvežitev (stale-while-revalidate).
const CACHE = 'evidelo-v2.1';
const FIREBASE_SDK = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js',
];
const CORE = [
  './sluzba.html',
  './sluzba/manifest.webmanifest',
  './sluzba/css/app.css',
  './sluzba/js/app.js',
  './sluzba/js/config.js',
  './sluzba/js/firebase.js',
  './sluzba/js/icons.js',
  './sluzba/js/install.js',
  './sluzba/js/shiftpanel.js',
  './sluzba/js/store.js',
  './sluzba/js/ui.js',
  './sluzba/js/util.js',
  './sluzba/js/weekstrip.js',
  './sluzba/js/views/calendar.js',
  './sluzba/js/views/entry.js',
  './sluzba/js/views/home.js',
  './sluzba/js/views/login.js',
  './sluzba/js/views/plan.js',
  './sluzba/js/views/profile.js',
  './sluzba/js/views/stats.js',
  './sluzba/icons/logo.svg',
  './sluzba/icons/mark.svg',
  './sluzba/icons/icon-192.png',
  './sluzba/icons/icon-512.png',
  './sluzba/icons/icon-maskable-512.png',
  './sluzba/icons/apple-touch-icon.png',
  './sluzba/icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await Promise.all(CORE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
      // Firebase SDK iz CDN-ja (CORS) – da deluje brez povezave
      await Promise.all(FIREBASE_SDK.map((u) => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isSdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!sameOrigin && !isSdk) return; // Firebase podatki (websocket/long-poll) gredo mimo

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (hit) {
        e.waitUntil(net);
        return hit;
      }
      const res = await net;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match('./sluzba.html')) || Response.error();
      return Response.error();
    })()
  );
});
