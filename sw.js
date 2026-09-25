const CACHE_NAME = 'spesa-pwa-v4';
const urlsToCache = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  // Forza l'attivazione immediata del nuovo Service Worker
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Pulisce le vecchie cache (come la v1 e v2)
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Usa la cache se c'è, altrimenti scarica da internet
      return response || fetch(event.request);
    })
  );
});
