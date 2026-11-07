/**
 * Service Worker for Hotel Suite Pro.
 *
 * Keep offline navigation available without serving stale Next.js HTML/RSC
 * alongside a different deployment's JavaScript chunks.
 */
const CACHE_NAME = 'hotel-suite-pro-v2';
const AUDIO_CACHE_NAME = 'hotel-suite-audio-v1';
const LEGACY_CACHE_NAMES = new Set(['studio-pwa-v1']);
const SHELL_ASSETS = ['/', '/manifest.json', '/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // A single missing shell URL must not prevent the worker from installing.
    await Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => {
      // Only remove caches owned by this app. Preserve audio and unrelated
      // application caches rather than clearing the browser's entire cache.
      if (
        (name.startsWith('hotel-suite-pro-') && name !== CACHE_NAME) ||
        LEGACY_CACHE_NAMES.has(name)
      ) {
        return caches.delete(name);
      }
      return Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return;

  // APIs must always attempt the live/local server first. Never cache writes
  // or API data as generic static assets.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request, 'api'));
    return;
  }

  // Next.js RSC, router-prefetch and data payloads are deployment-specific.
  // Caching these can pair an old route tree with a new set of JS chunks.
  const isNextPayload =
    request.headers.has('RSC') ||
    request.headers.has('Next-Router-Prefetch') ||
    request.headers.has('Next-Router-State-Tree') ||
    url.searchParams.has('_rsc') ||
    url.pathname.startsWith('/_next/data/');

  if (isNextPayload) {
    event.respondWith(networkOnly(request, 'next'));
    return;
  }

  // Hashed Next.js build assets are immutable. Cache-first is safe here:
  // a URL containing a different content hash is a different cache key.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirstImmutable(request));
    return;
  }

  // Documents must be network-first so a new deployment's HTML is not paired
  // with stale cached HTML. If offline, fall back to the last cached document.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  // Public files (images, fonts, stylesheets, etc.) use network-first so
  // updated assets become visible promptly, with cache fallback when offline.
  event.respondWith(networkFirstAsset(request));
});

async function networkOnly(request, kind) {
  try {
    return await fetch(request);
  } catch (error) {
    if (kind === 'api') {
      return new Response(
        JSON.stringify({ error: 'Offline', message: 'The server is currently unavailable.' }),
        { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' } }
      );
    }
    // Do not return offline.html for a JavaScript/RSC request. That turns a
    // recoverable network interruption into a misleading chunk/parse error.
    return new Response('Temporarily unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }
}

async function cacheFirstImmutable(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return new Response('', {
      status: 503,
      statusText: 'Offline asset unavailable',
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}

async function networkFirstDocument(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && isHtml(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    const offlinePage = await cache.match('/offline.html');
    if (offlinePage) return offlinePage;

    return new Response(
      '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body><h1>You are offline</h1><p>Reconnect to the hotel server and try again.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
    );
  }
}

async function networkFirstAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && shouldCacheAsset(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('', { status: 503, statusText: 'Offline asset unavailable' });
  }
}

function isHtml(response) {
  return (response.headers.get('content-type') || '').includes('text/html');
}

function shouldCacheAsset(response) {
  const type = response.headers.get('content-type') || '';
  const cacheControl = response.headers.get('cache-control') || '';
  return !isHtml(response) && !/no-store|private/i.test(cacheControl) &&
    !type.includes('application/json');
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Intentionally do not expose a blanket CLEAR_CACHE command: offline data
  // and cached assets must not be destroyed by a generic UI action.
});

async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request)) || new Response('', {
      status: 404,
      statusText: 'Audio not available',
      headers: { 'Content-Type': 'audio/mpeg' }
    });
  }
}
