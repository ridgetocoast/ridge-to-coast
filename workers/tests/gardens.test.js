// workers/tests/gardens.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestOf, mockFetch } = require('./_helpers.js');

async function call() {
  const { handleGardens } = await import('../gardens.js');
  return handleGardens(requestOf('', '/v1/gardens'));
}

const FAKE_OVERPASS = {
  elements: [
    { type: 'node', id: 1, lat: 37.54, lon: -77.43, tags: { leisure: 'garden', name: 'Maymont Community Garden' } },
    { type: 'way',  id: 2, center: { lat: 39.95, lon: -75.16 }, tags: { landuse: 'allotments', operator: 'Schuylkill Allotments' } },
    { type: 'node', id: 3, lat: 35.78, lon: -78.64, tags: { shop: 'garden_centre', 'plant:native': 'yes', name: 'Niche Gardens' } },
    { type: 'node', id: 4, /* missing lat/lon */ tags: { leisure: 'garden', name: 'Bad Element' } },
    { type: 'node', id: 1, lat: 37.54, lon: -77.43, tags: { leisure: 'garden', name: 'Maymont Community Garden' } }, // dupe
  ],
};

test('gardens: 200 happy path normalizes Overpass elements', async () => {
  const restore = mockFetch(async () => Response.json(FAKE_OVERPASS));
  try {
    const r = await call();
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Cache-Control'), 'public, max-age=86400, s-maxage=86400');
    const body = await r.json();
    assert.equal(body.count, 3); // dupe + missing-coords element dropped
    assert.deepEqual(body.bbox, { south: 24, west: -92.2, north: 49, east: -66.5 });
    body.gardens.forEach(g => {
      assert.match(g.osmId, /^(node|way)-\d+$/);
      assert.equal(typeof g.lat, 'number');
      assert.equal(typeof g.lon, 'number');
      assert.equal(typeof g.name, 'string');
      assert.equal(typeof g.type, 'string');
      assert.equal(typeof g.address, 'string');
    });
    // sorted by name ascending
    const names = body.gardens.map(g => g.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(names, sorted);
  } finally {
    restore();
  }
});

test('gardens: type label maps correctly (allotment / native nursery / plain garden)', async () => {
  const restore = mockFetch(async () => Response.json(FAKE_OVERPASS));
  try {
    const body = await (await call()).json();
    const types = new Set(body.gardens.map(g => g.type));
    assert.ok(types.has('Community garden'));
    assert.ok(types.has('Allotment garden'));
    assert.ok(types.has('Native plant nursery'));
  } finally {
    restore();
  }
});

test('gardens: 502 when Overpass returns non-2xx', async () => {
  const restore = mockFetch(async () => new Response('upstream down', { status: 503 }));
  try {
    const r = await call();
    assert.equal(r.status, 502);
    const body = await r.json();
    assert.match(body.error, /overpass/i);
  } finally {
    restore();
  }
});

test('gardens: 502 when fetch throws', async () => {
  const restore = mockFetch(async () => { throw new Error('network'); });
  try {
    const r = await call();
    assert.equal(r.status, 502);
  } finally {
    restore();
  }
});

test('gardens: address falls back to "Address not listed" when no addr:* tags', async () => {
  const restore = mockFetch(async () => Response.json({
    elements: [{ type: 'node', id: 99, lat: 37, lon: -77, tags: { leisure: 'garden', name: 'Plain' } }],
  }));
  try {
    const body = await (await call()).json();
    assert.equal(body.gardens[0].address, 'Address not listed');
  } finally {
    restore();
  }
});
