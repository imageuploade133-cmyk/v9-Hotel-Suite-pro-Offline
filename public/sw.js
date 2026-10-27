/**
 * Service Worker for Hotel Suite Pro
 * Handles caching and offline functionality
 */

const CACHE_NAME = 'hotel-suite-pro-v1';
const AUDIO_CACHE_NAME = 'hotel-suite-audio-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Failed to cache some static assets:', err);
      });
    }).then(() => {
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== AUDIO_CACHE_NAME)
          .map((name) => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Take control immediately
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle audio files with special caching strategy
  if (url.pathname.endsWith('.mp3') || url.pathname.endsWith('.wav') || url.pathname.endsWith('.ogg')) {
    event.respondWith(handleAudioRequest(request));
    return;
  }

  // Handle API requests - network first, then cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets - cache first, then network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and update cache in background
        event.waitUntil(updateCache(request));
        return cachedResponse;
      }

      // No cache, fetch from network
      return fetch(request).then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch((err) => {
              console.warn('Failed to cache response:', err);
            });
          });
        }
        return response;
      }).catch((error) => {
        console.error('Fetch failed:', error);
        // Return offline fallback if available
        return caches.match('/offline.html').catch(() => {
          // If no offline page, return a basic error response
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      });
    })
  );
});

/**
 * Handle audio file requests with error handling
 */
async function handleAudioRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);

    if (response.ok) {
      // Cache the audio file
      const responseClone = response.clone();
      caches.open(AUDIO_CACHE_NAME).then((cache) => {
        cache.put(request, responseClone).catch((err) => {
          console.warn('Failed to cache audio:', err);
        });
      });
    }

    return response;
  } catch (error) {
    console.warn('Audio fetch failed, trying cache:', error);

    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return a silent audio fallback or empty response
    // This prevents the error from propagating
    return new Response('', {
      status: 404,
      statusText: 'Audio not available',
      headers: { 'Content-Type': 'audio/mpeg' }
    });
  }
}

/**
 * Handle API requests - network first
 */
async function handleApiRequest(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    console.warn('API fetch failed:', error);

    // Return offline response for API calls
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'You are currently offline.' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Update cache in the background
 */
async function updateCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response);
    }
  } catch (error) {
    // Silently fail - cache update is non-critical
    console.debug('Cache update failed:', error);
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    }).then(() => {
      // Notify clients that cache was cleared
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      });
    });
  }
});
