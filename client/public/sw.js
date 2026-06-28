const CACHE = 'shelf-v1';

// App shell files to pre-cache
const PRECACHE = ['/'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle http/https — skip chrome-extension://, data:, etc.
  if (!url.protocol.startsWith('http')) return;

  // Never intercept API or upload requests
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) return;

  // For same-origin navigation requests: network-first, fall back to cached shell
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }

  // For assets: cache-first with network fallback
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE).then((c) => c.put(request, clone));
        return response;
      });
    })
  );
});
