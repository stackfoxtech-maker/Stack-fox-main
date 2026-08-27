// StackFox — Service Worker (PWA offline shell)
// Caches the app shell and serves from cache when offline.
// Dynamic API calls (quotes, login) always go to network.

const CACHE_NAME = 'stackfox-v1';
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png'
];

// Install — pre-cache shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(SHELL_URLS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Always go to network for API calls
  if (url.pathname.startsWith('/api/')) return;

  // For navigation and static assets: try network, fall back to cache
  event.respondWith(
    fetch(request)
      .then(response => {
        // Clone and cache successful responses
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || new Response('Offline', { status: 503 })))
  );
});
