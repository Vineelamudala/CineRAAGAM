/* Cineraagam service worker — makes the app installable and resilient offline.
 *
 * Deliberately conservative:
 *  - Only same-origin GET requests are handled. Supabase (auth, game API,
 *    signed audio URLs) is cross-origin and never cached.
 *  - /admin and /api (except the public catalogue) are never cached.
 *  - Hashed build assets: cache-first. Pages: network-first with an offline
 *    fallback. Public catalogue: stale-while-revalidate.
 */
const VERSION = 'v1';
const STATIC_CACHE = `cineraagam-static-${VERSION}`;
const PAGE_CACHE = `cineraagam-pages-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, PAGE_CACHE]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase & other origins: browser default
  if (url.pathname.startsWith('/admin')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname === '/api/catalog') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || network;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    // Pages are static shells (player data loads client-side), safe to keep for offline use.
    if (response.ok && response.type === 'basic') cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}
