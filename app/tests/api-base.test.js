// app/tests/api-base.test.js — API origin resolution
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { resolveApiBase, PRODUCTION_API, ALPHA_API, PREPROD_API } = require('../lib/api-base.js');

test('api-base: apex and www resolve to the production API', () => {
  assert.equal(resolveApiBase('ridgetocoast.com'), PRODUCTION_API);
  assert.equal(resolveApiBase('www.ridgetocoast.com'), PRODUCTION_API);
});

test('api-base: alpha resolves to the alpha API', () => {
  assert.equal(resolveApiBase('alpha.ridgetocoast.com'), ALPHA_API);
});

test('api-base: local hostnames resolve to same-origin', () => {
  // '' means "use a relative URL" — scripts/dev-server.mjs proxies /v1/* to the
  // local wrangler dev, so the request must stay on the page's own origin.
  for (const host of ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']) {
    assert.equal(resolveApiBase(host), '', `expected same-origin for ${host}`);
  }
});

test('api-base: same-origin base builds a root-relative URL', () => {
  assert.equal(resolveApiBase('localhost') + '/v1/gardens', '/v1/gardens');
});

test('api-base: pages.dev previews and unknown hosts fall back to preprod', () => {
  for (const host of ['abc123.ridgetocoast.pages.dev', 'example.com', 'staging.internal']) {
    assert.equal(resolveApiBase(host), PREPROD_API, `expected preprod for ${host}`);
  }
});

test('api-base: hostname matching is case-insensitive', () => {
  assert.equal(resolveApiBase('RidgeToCoast.com'), PRODUCTION_API);
  assert.equal(resolveApiBase('LOCALHOST'), '');
});

test('api-base: null and undefined fall back to preprod rather than throwing', () => {
  assert.equal(resolveApiBase(null), PREPROD_API);
  assert.equal(resolveApiBase(undefined), PREPROD_API);
});

test('api-base: lookalike hostnames do NOT resolve to production', () => {
  // A hostname that merely ends with the production domain must not be trusted.
  for (const host of ['ridgetocoast.com.evil.test', 'notridgetocoast.com', 'api.ridgetocoast.com']) {
    assert.notEqual(resolveApiBase(host), PRODUCTION_API, `${host} must not map to production`);
  }
});
