// EviDelo – service worker: aplikacija se odpre tudi brez povezave.
// Strategija: najprej predpomnilnik, v ozadju osvežitev (stale-while-revalidate).
const CACHE = 'evidelo-v2.1-e';
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
  './sluzba/js/views/admin.js',
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

  // Najprej omrežje (največ 3 s), da je vedno najnovejša različica; brez povezave pride iz predpomnilnika.
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const fromNet = fetch(req, sameOrigin ? { cache: 'no-cache' } : undefined).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      });
      try {
        return await Promise.race([
          fromNet,
          new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3000)),
        ]);
      } catch {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) {
          e.waitUntil(fromNet.catch(() => {}));
          return hit;
        }
        if (req.mode === 'navigate') return (await cache.match('./sluzba.html')) || Response.error();
        try {
          return await fromNet;
        } catch {
          return Response.error();
        }
      }
    })()
  );
});
