'use strict';

var CACHE_NAME = 'ridge-to-coast-v1';
var OFFLINE_FALLBACK_URL = '/';
var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/map.js',
  '/manifest.json',
  '/assets/icon.svg',
  '/lib/leaflet.css',
  '/lib/leaflet.js',
  '/lib/geo-data.js',
  '/data/regions.geojson',
  '/data/hardiness.geojson',
  '/data/planting-calendar.js'
];

function isCacheableResponse(response) {
  return !!response && response.ok && response.type !== 'opaque';
}

function isManagedSameOriginRequest(url) {
  if (url.origin !== self.location.origin) {
    return false;
  }

  return (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/style.css' ||
    url.pathname === '/map.js' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/assets/icon.svg' ||
    url.pathname === '/lib/leaflet.css' ||
    url.pathname === '/lib/leaflet.js' ||
    url.pathname === '/lib/geo-data.js' ||
    url.pathname === '/data/regions.geojson' ||
    url.pathname === '/data/hardiness.geojson' ||
    url.pathname === '/data/planting-calendar.js'
  );
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
              cache.put(OFFLINE_FALLBACK_URL, responseClone);
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(OFFLINE_FALLBACK_URL);
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
