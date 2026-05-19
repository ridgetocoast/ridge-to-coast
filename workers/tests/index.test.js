// workers/tests/index.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

async function dispatch(method, path) {
  const mod = await import('../index.js');
  const handler = mod.default;
  return handler.fetch(new Request('https://api.ridgetocoast.com' + path, { method }));
}

test('router: GET / returns api info with all four endpoints', async () => {
  const r = await dispatch('GET', '/');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.api, 'Ridge to Coast');
  assert.deepEqual(body.endpoints.sort(), ['/v1/calendar', '/v1/ecoregion', '/v1/gardens', '/v1/plants']);
});

test('router: GET /unknown returns 404', async () => {
  const r = await dispatch('GET', '/nope');
  assert.equal(r.status, 404);
});

test('router: OPTIONS preflight returns 200 with CORS headers', async () => {
  const r = await dispatch('OPTIONS', '/v1/ecoregion');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(r.headers.get('Access-Control-Allow-Methods'), /GET/);
});

test('router: every response carries CORS headers (sample /v1/calendar 400)', async () => {
  const r = await dispatch('GET', '/v1/calendar?zone=7b'); // missing month → 400
  assert.equal(r.status, 400);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*');
});
