/* ==========================================================================
   Snake Rush — Progressive Web App Service Worker
   Offline caching & fast loading for GitHub Pages, Netlify, and custom domains
   ========================================================================== */

const CACHE_NAME = 'snake-rush-v1';

// All paths are relative to ensure complete GitHub Pages subpath compatibility
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'favicon.ico',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/favicon-16.png'
];

// --- Install Event: Pre-cache core game files ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// --- Activate Event: Clean up outdated caches and take control immediately ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// --- Fetch Event: Cache-first with stale-while-revalidate & offline navigation fallback ---
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests and http/https schemes
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http://') && !req.url.startsWith('https://')) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Asynchronously revalidate cache from network when online
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(req, responseToCache);
              });
            }
          })
          .catch(() => {
            // Network fetch failed (offline); cached version is served seamlessly
          });

        return cachedResponse;
      }

      // If not in cache, fetch from network and store in cache
      return fetch(req)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback for navigation requests
          if (req.mode === 'navigate') {
            return caches.match('./', { ignoreSearch: true })
              .then((fallback) => fallback || caches.match('index.html', { ignoreSearch: true }));
          }
        });
    })
  );
});
