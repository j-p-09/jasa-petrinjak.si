
const V = 'evidelo-v2';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(V));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== V)
          .map(key => caches.delete(key))
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
      const cached = await caches.match(event.request);
      return cached || Response.error();
    })
  );
});
