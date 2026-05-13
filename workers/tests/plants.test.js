// workers/tests/plants.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestOf } = require('./_helpers.js');

async function call(qs) {
  const { handlePlants } = await import('../plants.js');
  return handlePlants(requestOf(qs, '/v1/plants'));
}

test('plants: 400 when region missing', async () => {
  const r = await call('');
  assert.equal(r.status, 400);
});

test('plants: 404 when region unknown', async () => {
  const r = await call('region=neverland');
  assert.equal(r.status, 404);
});

test('plants: 400 when type is not in the allowed enum', async () => {
  const r = await call('region=piedmont&type=mushroom');
  assert.equal(r.status, 400);
});

test('plants: 400 for legacy enum value "herbaceous" (no longer accepted)', async () => {
  const r = await call('region=piedmont&type=herbaceous');
  assert.equal(r.status, 400);
});

test('plants: 200 with full list for known region', async () => {
  const r = await call('region=piedmont');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.region, 'piedmont');
  assert.equal(body.type, null);
  assert.ok(Array.isArray(body.plants));
  assert.ok(body.plants.length > 0);
  body.plants.forEach(p => {
    assert.equal(typeof p.name, 'string');
    assert.equal(typeof p.latin, 'string');
    assert.equal(typeof p.type, 'string');
  });
});

test('plants: 200 with type filter narrows results', async () => {
  const all = await (await call('region=piedmont')).json();
  const trees = await (await call('region=piedmont&type=tree')).json();
  assert.ok(trees.plants.length > 0);
  assert.ok(trees.plants.length <= all.plants.length);
  trees.plants.forEach(p => assert.equal(p.type, 'tree'));
  assert.equal(trees.type, 'tree');
});

test('plants: type matching is case-sensitive (TREE rejected)', async () => {
  const r = await call('region=piedmont&type=TREE');
  assert.equal(r.status, 400);
});
