'use strict';

// Bumped to v2 when the content pages landed. The activate handler deletes every
// cache whose name is not this one, so the stale v1 entries are evicted.
var CACHE_NAME = 'ridge-to-coast-v2';
var OFFLINE_FALLBACK_URL = '/';
var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/site.css',
  '/map.js',
  '/join.js',
  '/preferences.js',
  '/manifest.json',
  '/assets/icon.svg',
  '/lib/leaflet.css',
  '/lib/leaflet.js',
  '/lib/api-base.js',
  '/lib/prefs.js',
  '/lib/geo-data.js',
  '/data/regions.geojson',
  '/data/hardiness.geojson',
  '/data/planting-calendar.js',
  '/about.html',
  '/guides.html',
  '/join.html',
  '/preferences.html',
  '/privacy.html'
];

function isCacheableResponse(response) {
  return !!response && response.ok && response.type !== 'opaque';
}

/**
 * Navigations allowed to overwrite the offline fallback slot.
 *
 * Previously every navigation was written to OFFLINE_FALLBACK_URL ('/'), so as
 * soon as a second page existed, visiting /about.html replaced the cached
 * homepage with About's markup — and an offline visitor to '/' got About.
 */
function isFallbackDocument(url) {
  return url.pathname === '/' || url.pathname === '/index.html';
}

function isManagedSameOriginRequest(url) {
  if (url.origin !== self.location.origin) {
    return false;
  }

  return PRECACHE_URLS.indexOf(url.pathname) !== -1;
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        }));
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
    return;
  }

  var requestUrl = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          if (isCacheableResponse(response)) {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              // Refresh the page's own entry when we manage it, and only let
              // the homepage refresh the offline fallback slot.
              if (isManagedSameOriginRequest(requestUrl)) {
                cache.put(event.request, responseClone.clone());
              }
              if (isFallbackDocument(requestUrl)) {
                cache.put(OFFLINE_FALLBACK_URL, responseClone);
              }
            });
          }
          return response;
        })
        .catch(function () {
          // Offline: prefer this page if we have it, else the homepage shell.
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match(OFFLINE_FALLBACK_URL);
          });
        })
    );
    return;
  }

  if (!isManagedSameOriginRequest(requestUrl)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        if (isCacheableResponse(response)) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match(OFFLINE_FALLBACK_URL);
        });
      })
  );
});
