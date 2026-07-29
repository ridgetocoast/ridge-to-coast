// app/tests/prefs.test.js — device-local preferences
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  defaults, mergeDefaults, migrate, validHome, validZone, validUnits,
  getPath, setPath, memoryStorage, createPrefs, STORAGE_KEY, LAYER_KEYS,
} = require('../lib/prefs.js');

/** A localStorage-shaped fake, so these tests need no browser and no jsdom. */
function fakeStorage(initial) {
  const map = Object.assign(Object.create(null), initial || {});
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
    _dump: () => map,
  };
}

/* ─── Pure logic ─────────────────────────────────────────────── */

test('prefs: defaults match the checkbox defaults in index.html', () => {
  const d = defaults();
  assert.equal(d.layers.regions, true);
  assert.equal(d.layers.fallline, true);
  assert.equal(d.layers.cities, true);
  assert.equal(d.layers.hardiness, false);
  assert.equal(d.layers.gardens, false);
  assert.equal(d.home, null);
  assert.equal(d.units, 'F');
  assert.equal(d.legendCollapsed, null, 'null means no choice made yet');
});

test('prefs: defaults() returns a fresh object each call', () => {
  const a = defaults();
  a.layers.regions = false;
  assert.equal(defaults().layers.regions, true, 'defaults must not be shared state');
});

test('prefs: mergeDefaults keeps known values and fills the rest', () => {
  const merged = mergeDefaults({ layers: { hardiness: true }, units: 'C' });
  assert.equal(merged.layers.hardiness, true);
  assert.equal(merged.layers.regions, true, 'unspecified layers keep their default');
  assert.equal(merged.units, 'C');
});

test('prefs: mergeDefaults drops unknown keys', () => {
  const merged = mergeDefaults({ evil: 'payload', layers: { nope: true } });
  assert.equal(merged.evil, undefined);
  assert.equal(merged.layers.nope, undefined);
  assert.deepEqual(Object.keys(merged.layers).sort(), [...LAYER_KEYS].sort());
});

test('prefs: mergeDefaults coerces non-boolean layer values to the default', () => {
  const merged = mergeDefaults({ layers: { hardiness: 'true', regions: 1, cities: null } });
  assert.equal(merged.layers.hardiness, false, 'string "true" is not a boolean');
  assert.equal(merged.layers.regions, true);
  assert.equal(merged.layers.cities, true);
});

test('prefs: mergeDefaults survives junk input', () => {
  for (const junk of [null, undefined, 'string', 42, []]) {
    assert.deepEqual(mergeDefaults(junk), defaults(), `failed for ${JSON.stringify(junk)}`);
  }
});

test('prefs: validHome accepts real coordinates and rejects the rest', () => {
  assert.deepEqual(validHome({ lat: 37.5, lon: -77.4, label: 'Richmond' }),
    { lat: 37.5, lon: -77.4, label: 'Richmond' });
  assert.deepEqual(validHome({ lat: 0, lon: 0 }), { lat: 0, lon: 0, label: '' });

  for (const bad of [
    null, undefined, 'x', 42,
    { lat: 91, lon: 0 }, { lat: -91, lon: 0 },
    { lat: 0, lon: 181 }, { lat: 0, lon: -181 },
    { lat: NaN, lon: 0 }, { lat: Infinity, lon: 0 },
    { lat: '37.5', lon: -77.4 },
    { lon: -77.4 }, { lat: 37.5 },
  ]) {
    assert.equal(validHome(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('prefs: validHome truncates an over-long label', () => {
  const home = validHome({ lat: 1, lon: 2, label: 'x'.repeat(500) });
  assert.equal(home.label.length, 120);
});

test('prefs: validZone accepts real USDA zones only', () => {
  for (const zone of ['3b', '7a', '7b', '10a', '13b']) {
    assert.equal(validZone(zone), zone, `expected ${zone} to be valid`);
  }
  assert.equal(validZone('7B'), '7b', 'zone is normalised to lower case');
  assert.equal(validZone('  7b  '), '7b', 'surrounding whitespace is trimmed');

  for (const bad of ['2a', '14a', '7c', '7', 'zz', '', null, 42, {}]) {
    assert.equal(validZone(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('prefs: validUnits falls back to Fahrenheit for anything unexpected', () => {
  assert.equal(validUnits('C'), 'C');
  assert.equal(validUnits('F'), 'F');
  for (const bad of ['c', 'K', '', null, undefined, 1]) {
    assert.equal(validUnits(bad), 'F', `expected F for ${JSON.stringify(bad)}`);
  }
});

test('prefs: migrate stamps the current schema version', () => {
  assert.equal(migrate({ units: 'C' }).version, 1);
  assert.equal(migrate(null), null);
});

test('prefs: getPath and setPath walk dotted paths', () => {
  const obj = { layers: { hardiness: false } };
  assert.equal(getPath(obj, 'layers.hardiness'), false);
  assert.equal(getPath(obj, 'layers.missing'), undefined);
  assert.equal(getPath(obj, 'nope.deeper.still'), undefined, 'must not throw on a missing branch');

  setPath(obj, 'layers.hardiness', true);
  assert.equal(obj.layers.hardiness, true);
  setPath(obj, 'a.b.c', 1);
  assert.equal(obj.a.b.c, 1, 'missing intermediate objects are created');
});

/* ─── The store ──────────────────────────────────────────────── */

test('prefs: a fresh store reads defaults', () => {
  const prefs = createPrefs(fakeStorage());
  assert.deepEqual(prefs.all(), defaults());
});

test('prefs: set persists through storage', () => {
  const storage = fakeStorage();
  const prefs = createPrefs(storage);
  prefs.set('layers.hardiness', true);

  const persisted = JSON.parse(storage._dump()[STORAGE_KEY]);
  assert.equal(persisted.layers.hardiness, true);

  // A second store over the same storage sees it — this is the reload path.
  assert.equal(createPrefs(storage).get('layers.hardiness'), true);
});

test('prefs: all() returns a copy, so callers cannot mutate the store', () => {
  const prefs = createPrefs(fakeStorage());
  const snapshot = prefs.all();
  snapshot.layers.hardiness = true;
  assert.equal(prefs.get('layers.hardiness'), false, 'the store must be unaffected');
});

test('prefs: setAll merges rather than replaces', () => {
  const prefs = createPrefs(fakeStorage());
  prefs.set('layers.hardiness', true);
  prefs.setAll({ units: 'C', layers: { gardens: true } });

  assert.equal(prefs.get('units'), 'C');
  assert.equal(prefs.get('layers.gardens'), true);
  assert.equal(prefs.get('layers.hardiness'), true, 'an unmentioned layer keeps its value');
});

test('prefs: an invalid value written through set is rejected on the way in', () => {
  const prefs = createPrefs(fakeStorage());
  prefs.set('zone', 'not-a-zone');
  assert.equal(prefs.get('zone'), null);
  prefs.set('home', { lat: 999, lon: 0 });
  assert.equal(prefs.get('home'), null);
});

test('prefs: reset clears storage and returns to defaults', () => {
  const storage = fakeStorage();
  const prefs = createPrefs(storage);
  prefs.set('units', 'C');
  prefs.reset();

  assert.deepEqual(prefs.all(), defaults());
  assert.equal(storage._dump()[STORAGE_KEY], undefined, 'the key is removed, not blanked');
});

test('prefs: corrupt stored JSON falls back to defaults instead of throwing', () => {
  const prefs = createPrefs(fakeStorage({ [STORAGE_KEY]: '{not json' }));
  assert.deepEqual(prefs.all(), defaults());
});

test('prefs: a hand-edited store with a hostile shape is sanitised', () => {
  const prefs = createPrefs(fakeStorage({
    [STORAGE_KEY]: JSON.stringify({ layers: 'not-an-object', zone: '99z', units: 'K', home: 'nope' }),
  }));
  assert.deepEqual(prefs.all(), defaults());
});

test('prefs: legendCollapsed distinguishes "no choice" from "explicitly expanded"', () => {
  // The map collapses the legend on small viewports only when no choice has been
  // made. Defaulting to false would suppress that heuristic permanently.
  const prefs = createPrefs(fakeStorage());
  assert.equal(prefs.get('legendCollapsed'), null);

  prefs.set('legendCollapsed', false);
  assert.equal(prefs.get('legendCollapsed'), false, 'an explicit false must be kept');

  prefs.set('legendCollapsed', true);
  assert.equal(prefs.get('legendCollapsed'), true);
});

test('prefs: a non-boolean legendCollapsed falls back to no-choice', () => {
  const prefs = createPrefs(fakeStorage({
    ['r2c.prefs.v1']: JSON.stringify({ legendCollapsed: 'yes' }),
  }));
  assert.equal(prefs.get('legendCollapsed'), null);
});

test('prefs: subscribers are notified on set and reset', () => {
  const prefs = createPrefs(fakeStorage());
  const seen = [];
  prefs.subscribe((next) => seen.push(next.units));

  prefs.set('units', 'C');
  prefs.reset();
  assert.deepEqual(seen, ['C', 'F']);
});

test('prefs: unsubscribe stops delivery', () => {
  const prefs = createPrefs(fakeStorage());
  let calls = 0;
  const off = prefs.subscribe(() => { calls += 1; });
  prefs.set('units', 'C');
  off();
  prefs.set('units', 'F');
  assert.equal(calls, 1);
});

test('prefs: a throwing subscriber does not stop the others', () => {
  const prefs = createPrefs(fakeStorage());
  let reached = false;
  prefs.subscribe(() => { throw new Error('bad listener'); });
  prefs.subscribe(() => { reached = true; });

  assert.doesNotThrow(() => prefs.set('units', 'C'));
  assert.equal(reached, true);
});

test('prefs: refresh re-reads storage and notifies (the cross-tab path)', () => {
  const storage = fakeStorage();
  const prefs = createPrefs(storage);
  prefs.all(); // prime the cache

  // Simulate another tab writing.
  storage.setItem(STORAGE_KEY, JSON.stringify({ units: 'C' }));
  let notified = false;
  prefs.subscribe(() => { notified = true; });

  assert.equal(prefs.refresh().units, 'C');
  assert.equal(notified, true);
});

test('prefs: a write failure does not throw and the session keeps the value', () => {
  // Safari private mode throws on setItem; the page must keep working.
  const throwingStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => {},
  };
  const prefs = createPrefs(throwingStorage);

  assert.doesNotThrow(() => prefs.set('units', 'C'));
  assert.equal(prefs.get('units'), 'C', 'the in-memory cache still holds it');
});

test('prefs: memoryStorage behaves like localStorage and is flagged', () => {
  const prefs = createPrefs(memoryStorage());
  prefs.set('units', 'C');
  assert.equal(prefs.get('units'), 'C');
  assert.equal(prefs.isMemoryFallback, true);
});

test('prefs: toJSON round-trips through fromJSON', () => {
  const source = createPrefs(fakeStorage());
  source.setAll({ units: 'C', zone: '7b', layers: { hardiness: true } });

  const target = createPrefs(fakeStorage());
  assert.equal(target.fromJSON(source.toJSON()), true);
  assert.deepEqual(target.all(), source.all());
});

test('prefs: fromJSON rejects junk without changing anything', () => {
  const prefs = createPrefs(fakeStorage());
  prefs.set('units', 'C');

  for (const junk of ['{not json', '[]', 'null', '"a string"', '42']) {
    assert.equal(prefs.fromJSON(junk), false, `expected rejection for ${junk}`);
  }
  assert.equal(prefs.get('units'), 'C', 'a rejected import must not clobber the store');
});
