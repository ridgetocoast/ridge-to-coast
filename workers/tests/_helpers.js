// workers/tests/_helpers.js
// Shared helpers for node --test workers/tests/*

'use strict';

/**
 * Build a Request whose URL carries the given query string.
 * Path defaults to /v1/echo since the tests pass it directly to a handler;
 * the router does its own path matching in workers/index.js.
 */
function requestOf(queryString, path = '/v1/echo') {
  const qs = queryString ? (queryString.startsWith('?') ? queryString : '?' + queryString) : '';
  return new Request('https://api.ridgetocoast.com' + path + qs);
}

/**
 * Swap globalThis.fetch with a stub. Returns a restore() fn the caller
 * MUST invoke in the test's afterEach / try-finally to avoid pollution.
 */
function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return function restore() { globalThis.fetch = original; };
}

module.exports = { requestOf, mockFetch };
