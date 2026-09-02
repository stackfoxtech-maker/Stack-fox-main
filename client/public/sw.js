// StackFox — service worker (production only; registered from main.jsx).
//
// Strategy:
//   • /assets/*  — content-hashed, immutable → cache-first, cache forever
//   • navigations — network-first, fall back to the cached shell when offline
//   • everything else (API, fonts, Cloudinary, Razorpay) — not touched
//
// The old v2 worker was network-first for *every* same-origin GET and cached
// each response into one never-pruned bucket. It gave no repeat-visit speedup
// and, in dev, mangled Vite's module requests.

const VERSION = 'v3';
const SHELL_CACHE = `stackfox-shell-${VERSION}`;
const ASSET_CACHE = `stackfox-assets-${VERSION}`;
const SHELL = ['/', '/index.html', '/manifest.json', '/favicon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API, fonts, CDNs → network

  // Immutable build assets: cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navigations: network-first, offline → cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((c) => c || caches.match('/index.html')),
      ),
    );
  }
});
