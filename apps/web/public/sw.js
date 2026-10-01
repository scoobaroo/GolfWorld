const CACHE = 'golfworld-v1';
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest']))); self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/api/geo/search') return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) ?? (event.request.mode === 'navigate' ? await caches.match('/') : undefined) ?? Response.error()));
});
