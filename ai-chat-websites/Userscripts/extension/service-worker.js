/**
 * Service Worker — PWA offline support for the Unified AI Assistant Suite.
 * Standard Service Worker events (install / activate / fetch).
 * Offline caching via the CacheStorage API when the host browser exposes it,
 * with a guarded fallback so the worker never crashes on unsupported hosts.
 */

const CACHE_VERSION = 'v1.1.0';
const CACHE_PREFIX = 'ai-assistant-suite-v';
const CURRENT_CACHE = CACHE_PREFIX + CACHE_VERSION;

/** Relative URLs warmed into the offline cache on install. */
const OFFLINE_ASSETS = [
  './',
  './manifest.webmanifest',
  './popup.html',
  './popup.js',
  './options.html',
  './background.js',
  './content-script.js',
  './icons/icon16.png',
  './icons/icon32.png',
  './icons/icon48.png',
  './icons/icon128.png'
];

/** @returns {Promise<Cache|null>} The versioned cache, or null when unsupported. */
function openCache() {
  if (typeof caches === 'undefined') return Promise.resolve(null);
  try {
    return caches.open(CURRENT_CACHE).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

/** @returns {string} Absolute URL for a relative asset under the SW scope. */
function scopedAssetUrl(asset) {
  const base = self.registration?.scope || (typeof location !== 'undefined' ? location.href : './');
  return new URL(asset, base).toString();
}

/** Warm the offline cache so the PWA works during network drops. */
async function warmCache() {
  const cache = await openCache();
  if (!cache) return;
  for (const asset of OFFLINE_ASSETS) {
    try {
      const response = await fetch(asset);
      if (response.ok) {
        await cache.put(new Request(scopedAssetUrl(asset), { method: 'GET' }), response);
      }
    } catch {
      /* network unavailable or cache API rejected — skip asset */
    }
  }
}

/** Delete caches from previous app versions. */
async function pruneOldCaches() {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      if (key.startsWith(CACHE_PREFIX) && key !== CURRENT_CACHE) {
        await caches.delete(key);
      }
    }
  } catch {
    /* best effort only */
  }
}

/** Serve a request from the offline cache when the network fails. */
async function offlineFallback(request) {
  const cache = await openCache();
  if (cache) {
    const hit = await cache.match(request).catch(() => null);
    if (hit) return hit;
  }
  return new Response('Offline — the AI Assistant Suite cache is unavailable.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('install', (event) => {
  // Activate immediately; precache in the background.
  self.skipWaiting = true;
  event.waitUntil(warmCache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(pruneOldCaches());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Network-first with offline cache fallback.
  event.respondWith(fetch(event.request).catch(() => offlineFallback(event.request)));
});