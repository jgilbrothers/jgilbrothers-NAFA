const CACHE_NAME = 'nafa-ledger-v1';
const PRE_CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRE_CACHE_ASSETS).catch((err) => {
        console.warn('[Service Worker] Pre-cache warning (usually safe of dev/nested routes):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle standard non-GET requests natively
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip dev environment HMR/socket connections
  if (url.pathname.includes('hot') || url.pathname.includes('vite') || url.pathname.includes('ws')) {
    return;
  }

  // Handle requests: try cache first, fallback to fetch and network cache update, fallback to offline shell
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          // If response is valid, clone and put it into current cache database
          if (response && response.status === 200 && response.type === 'basic') {
            const cacheCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cacheCopy);
            });
          }
          return response;
        })
        .catch((err) => {
          console.log('[Service Worker] Fetch failed, client is offline.', err);
          // Standard document fallback
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html') || caches.match('./');
          }
        });

      return cachedResponse || networkFetch;
    })
  );
});
