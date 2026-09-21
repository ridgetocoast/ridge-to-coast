/**
 * tests/sw.test.js
 * ────────────────
 * Guards the service worker precache list against the two failure modes that
 * actually shipped:
 *
 *   1. A <script> or <link> that index.html loads is MISSING from PRECACHE_URLS.
 *      This broke offline loading: sw.js precached geo-data.js but not
 *      geo-data-core.js, which index.html loads first and which geo-data.js
 *      throws without ("geo-data-core.js failed to load").
 *
 *   2. A PRECACHE_URLS entry points at a file that no longer exists.
 *      cache.addAll() is atomic — one 404 rejects the whole install, so the
 *      service worker silently stops working. A stale entry for
 *      data/planting-calendar.js sat in the list after index.html dropped it.
 *
 * Run with:
 *   node --test app/tests/sw.test.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('fs');
const path = require('path');

const APP   = path.join(__dirname, '..');
const SW    = path.join(APP, 'sw.js');
const INDEX = path.join(APP, 'index.html');

// Pull the PRECACHE_URLS array out of sw.js without executing it — sw.js
// references `self`, which does not exist in Node.
function getPrecacheUrls() {
  const src   = fs.readFileSync(SW, 'utf8');
  const start = src.indexOf('var PRECACHE_URLS = [');
  assert.ok(start !== -1, 'sw.js must declare PRECACHE_URLS');
  const end   = src.indexOf('];', start) + 2;
  const block = src.slice(start, end);
  // eslint-disable-next-line no-new-func
  return new Function(`${block}; return PRECACHE_URLS;`)();
}

// Map a root-relative precache URL to a path on disk under app/.
function toDiskPath(url) {
  if (url === '/') return INDEX;
  return path.join(APP, url.replace(/^\//, ''));
}

// Local (non-absolute, non-protocol-relative) asset refs from index.html.
function localAssetRefs() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const refs = [];
  const patterns = [
    /<script[^>]+src=["']([^"']+)["']/g,
    /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const ref = m[1];
      if (!/^(https?:)?\/\//.test(ref) && !ref.startsWith('data:')) refs.push(ref);
    }
  }
  return refs;
}

describe('service worker precache list', () => {
  const precache = getPrecacheUrls();

  it('declares a non-empty PRECACHE_URLS', () => {
    assert.ok(Array.isArray(precache) && precache.length > 0);
  });

  it('has no duplicate entries', () => {
    assert.equal(new Set(precache).size, precache.length);
  });

  it('precaches every local script and stylesheet index.html loads', () => {
    const missing = localAssetRefs()
      .map((ref) => '/' + ref.replace(/^\.?\//, ''))
      .filter((url) => !precache.includes(url));

    assert.deepEqual(
      missing, [],
      `index.html loads these but sw.js does not precache them: ${missing.join(', ')}. ` +
      'Offline load will break for any of them the app cannot start without.'
    );
  });

  it('every precached path exists on disk (cache.addAll is atomic)', () => {
    const dead = precache.filter((url) => !fs.existsSync(toDiskPath(url)));
    assert.deepEqual(
      dead, [],
      `PRECACHE_URLS references files that do not exist: ${dead.join(', ')}. ` +
      'A single 404 rejects cache.addAll() and the service worker never installs.'
    );
  });

  it('precaches geo-data-core.js, which geo-data.js hard-throws without', () => {
    assert.ok(
      precache.includes('/lib/geo-data-core.js'),
      'geo-data.js:34 throws if geo-data-core.js has not loaded first'
    );
  });

  it('bumps CACHE_NAME past v1 so clients holding the broken v1 list evict it', () => {
    const src = fs.readFileSync(SW, 'utf8');
    const m = src.match(/var CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
    assert.ok(m, 'sw.js must declare CACHE_NAME');
    assert.notEqual(m[1], 'ridge-to-coast-v1', 'CACHE_NAME must be bumped when PRECACHE_URLS changes');
  });
});
