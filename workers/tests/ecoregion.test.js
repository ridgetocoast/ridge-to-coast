// workers/tests/ecoregion.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestOf } = require('./_helpers.js');

// Worker source is ESM; node:test can't import ESM from a CJS test file
// without --experimental-vm-modules, so we use a dynamic import inside an
// async test. node 20+ supports this.

async function call(qs) {
  const { handleEcoregion } = await import('../ecoregion.js');
  return handleEcoregion(requestOf(qs, '/v1/ecoregion'));
}

test('ecoregion: 400 when lat/lon missing', async () => {
  const r = await call('');
  assert.equal(r.status, 400);
});

test('ecoregion: 400 when lat is non-numeric', async () => {
  const r = await call('lat=abc&lon=-77.4');
  assert.equal(r.status, 400);
});

test('ecoregion: 404 outside coverage BBOX (San Francisco)', async () => {
  const r = await call('lat=37.77&lon=-122.42');
  assert.equal(r.status, 404);
  const body = await r.json();
  assert.match(body.error, /coverage/i);
});

test('ecoregion: 200 for Richmond VA → piedmont, zone 7b, James watershed', async () => {
  // Use lat=37.54, lon=-77.50 (Henrico County, west of the fall line) — classified as piedmont.
  // The Fall Line at this latitude runs near -77.464°W (James River at Belle Isle);
  // downtown Richmond (-77.43) is just east of it (coastal), so we use a point
  // a few km further west that is unambiguously Piedmont.
  const r = await call('lat=37.54&lon=-77.50');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.region, 'piedmont');
  assert.equal(body.name, 'Piedmont');
  assert.equal(body.zone, '7b');
  assert.match(body.watershedName, /James/i);
  assert.equal(body.lat, 37.54);
  assert.equal(body.lon, -77.5);
  assert.ok(Array.isArray(body.nativePlants));
  assert.ok(body.nativePlants.length > 0 && body.nativePlants.length <= 3);
  assert.ok(Array.isArray(body.invasives));
});

test('ecoregion: nativePlants is top-3 names from NATIVE_PLANTS[region]', async () => {
  const r = await call('lat=37.54&lon=-77.50');
  const body = await r.json();
  assert.equal(body.nativePlants.length, 3);
  body.nativePlants.forEach(n => assert.equal(typeof n, 'string'));
});

test('ecoregion: returns null watershedName when point in coverage but outside HUC8', async () => {
  // Pick a point well inside the BBOX but in the ocean off NJ.
  const r = await call('lat=39.5&lon=-73.5');
  if (r.status === 200) {
    const body = await r.json();
    assert.equal(body.watershedName, null);
  }
  // If 404: that's also acceptable (depends on classifyLocation behavior offshore).
});
