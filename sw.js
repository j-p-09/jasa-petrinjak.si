
const V = 'evidelo-v3';

const F = [
  '/jasa-petrinjak.si/sluzba.html',
  '/jasa-petrinjak.si/manifest.webmanifest',
  '/jasa-petrinjak.si/icon-180.png',
  '/jasa-petrinjak.si/icon-192.png',
  '/jasa-petrinjak.si/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(V).then(cache => cache.addAll(F))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== V).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (
    url.origin !== location.origin ||
    event.request.method !== 'GET'
  ) return;

  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(V).then(cache =>
          cache.put(event.request, copy)
        );
      }
      return response;
    }).catch(async () => {
      return await caches.match(event.request) || Response.error();
    })
  );
});
