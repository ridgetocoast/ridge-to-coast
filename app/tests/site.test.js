// app/tests/site.test.js — cross-page consistency for the static content pages
//
// There is no build step and no template engine, so the shared header and footer
// are duplicated into every page. This suite is what stops them drifting apart:
// it asserts the blocks are byte-identical everywhere, that the security policy
// is uniform, and that the service worker's file lists stay in step with what
// actually exists on disk.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP_DIR = path.join(__dirname, '..');

// Every page that carries the shared site chrome. index.html is the map, which
// has its own header and is deliberately excluded.
const CONTENT_PAGES = [
  'about.html',
  'guides.html',
  'join.html',
  'preferences.html',
  'privacy.html',
  'confirmed.html',
  'unsubscribed.html',
];

const read = (name) => fs.readFileSync(path.join(APP_DIR, name), 'utf8');

function extractBlock(html, marker) {
  const start = html.indexOf(`<!-- SITE-CHROME:${marker}:START`);
  const endMarker = `<!-- SITE-CHROME:${marker}:END -->`;
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1) return null;
  return html.slice(start, end + endMarker.length);
}

function cspOf(html) {
  const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  return match ? match[1] : null;
}

/* ─── The pages exist ────────────────────────────────────────── */

test('site: every content page exists', () => {
  for (const page of CONTENT_PAGES) {
    assert.ok(fs.existsSync(path.join(APP_DIR, page)), `${page} is missing`);
  }
});

/* ─── Shared chrome is byte-identical ────────────────────────── */

test('site: the header block is byte-identical on every page', () => {
  const reference = extractBlock(read(CONTENT_PAGES[0]), 'HEADER');
  assert.ok(reference, `${CONTENT_PAGES[0]} has no header block`);

  for (const page of CONTENT_PAGES.slice(1)) {
    const block = extractBlock(read(page), 'HEADER');
    assert.ok(block, `${page} has no header block`);
    assert.equal(block, reference, `${page} header has drifted from ${CONTENT_PAGES[0]}`);
  }
});

test('site: the footer block is byte-identical on every page', () => {
  const reference = extractBlock(read(CONTENT_PAGES[0]), 'FOOTER');
  assert.ok(reference, `${CONTENT_PAGES[0]} has no footer block`);

  for (const page of CONTENT_PAGES.slice(1)) {
    const block = extractBlock(read(page), 'FOOTER');
    assert.ok(block, `${page} has no footer block`);
    assert.equal(block, reference, `${page} footer has drifted from ${CONTENT_PAGES[0]}`);
  }
});

test('site: the nav links to every content page that has a nav entry', () => {
  const header = extractBlock(read('about.html'), 'HEADER');
  for (const href of ['index.html', 'about.html', 'guides.html', 'join.html', 'preferences.html']) {
    assert.ok(header.includes(`href="${href}"`), `nav is missing a link to ${href}`);
  }
});

test('site: every internal link resolves to a file that exists', () => {
  for (const page of CONTENT_PAGES.concat('index.html')) {
    const html = read(page);
    const hrefs = [...html.matchAll(/href="([^"#:]+\.html)(?:#[^"]*)?"/g)].map((m) => m[1]);
    for (const href of new Set(hrefs)) {
      assert.ok(
        fs.existsSync(path.join(APP_DIR, href)),
        `${page} links to ${href}, which does not exist`
      );
    }
  }
});

/* ─── Security policy ────────────────────────────────────────── */

test('site: every content page carries the same CSP', () => {
  const reference = cspOf(read(CONTENT_PAGES[0]));
  assert.ok(reference, `${CONTENT_PAGES[0]} has no CSP meta tag`);

  for (const page of CONTENT_PAGES.slice(1)) {
    assert.equal(cspOf(read(page)), reference, `${page} CSP has drifted`);
  }
});

test('site: the content CSP blocks inline script and inline style', () => {
  const csp = cspOf(read('about.html'));
  assert.ok(!csp.includes("'unsafe-inline'"), 'content pages must not allow unsafe-inline');
  assert.ok(!csp.includes("'unsafe-eval'"), 'content pages must not allow unsafe-eval');
  assert.ok(csp.includes("default-src 'none'"), 'CSP must default to none');
  assert.ok(csp.includes("form-action 'none'"),
    'forms submit via fetch(), so native submission stays blocked');
});

test('site: content pages carry no inline style attributes', () => {
  // style-src 'self' without 'unsafe-inline' blocks style attributes too, so an
  // inline style would silently do nothing.
  for (const page of CONTENT_PAGES) {
    const html = read(page);
    assert.ok(!/\sstyle="/.test(html), `${page} has an inline style attribute, which its CSP blocks`);
  }
});

test('site: content pages load no cross-origin resources', () => {
  // The repo vendors everything; a CDN reference would be blocked by the CSP
  // and is a mistake worth catching at test time.
  for (const page of CONTENT_PAGES) {
    const html = read(page);
    const external = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(external, [], `${page} references external resources: ${external.join(', ')}`);
  }
});

/* ─── Page-level requirements ────────────────────────────────── */

test('site: every content page has a unique title and a description', () => {
  const titles = new Set();
  for (const page of CONTENT_PAGES) {
    const html = read(page);
    const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
    assert.ok(title, `${page} has no <title>`);
    assert.ok(title.includes('Ridge to Coast'), `${page} title should carry the site name`);
    assert.ok(!titles.has(title), `${page} reuses the title "${title}"`);
    titles.add(title);

    assert.ok(/<meta name="description" content="[^"]{20,}"/.test(html),
      `${page} has no useful meta description`);
  }
});

test('site: every content page declares its place on the transect', () => {
  const places = new Set(['about', 'guides', 'join', 'preferences', 'legal']);
  for (const page of CONTENT_PAGES) {
    const place = (read(page).match(/<body data-place="([^"]+)"/) || [])[1];
    assert.ok(place, `${page} has no data-place on <body>`);
    assert.ok(places.has(place), `${page} has an unknown data-place "${place}"`);
  }
});

test('site: every content page has a skip link pointing at its main landmark', () => {
  for (const page of CONTENT_PAGES) {
    const html = read(page);
    assert.ok(html.includes('class="skip-link" href="#main"'), `${page} has no skip link`);
    assert.ok(/<main id="main"/.test(html), `${page} has no <main id="main">`);
  }
});

test('site: every content page loads site.css and not the map stylesheet', () => {
  // style.css sets `overflow: hidden` on body for the map viewport; a content
  // page that loaded it could not scroll.
  for (const page of CONTENT_PAGES) {
    const html = read(page);
    assert.ok(html.includes('href="site.css"'), `${page} does not load site.css`);
    assert.ok(!html.includes('href="style.css"'), `${page} must not load the map stylesheet`);
  }
});

test('site: the map page links out to the content pages', () => {
  const html = read('index.html');
  for (const href of ['about.html', 'guides.html', 'join.html', 'preferences.html']) {
    assert.ok(html.includes(`href="${href}"`), `index.html has no link to ${href}`);
  }
});

/* ─── Service worker stays in step ───────────────────────────── */

test('site: every precached path exists on disk', () => {
  const sw = read('sw.js');
  const list = sw.match(/var PRECACHE_URLS = \[([\s\S]*?)\];/)[1];
  const paths = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);

  for (const p of paths) {
    if (p === '/') continue; // served as index.html
    assert.ok(
      fs.existsSync(path.join(APP_DIR, p.replace(/^\//, ''))),
      `sw.js precaches ${p}, which does not exist`
    );
  }
});

test('site: every content page is precached', () => {
  const sw = read('sw.js');
  for (const page of ['about.html', 'guides.html', 'join.html', 'preferences.html', 'privacy.html']) {
    assert.ok(sw.includes(`'/${page}'`), `sw.js does not precache ${page}`);
  }
});

test('site: only the homepage may overwrite the offline fallback', () => {
  // Regression guard: the navigate handler used to write every navigation into
  // the '/' cache slot, so visiting /about.html replaced the cached homepage.
  const sw = read('sw.js');
  assert.ok(/function isFallbackDocument/.test(sw), 'sw.js has no isFallbackDocument guard');
  assert.ok(
    /isFallbackDocument\(requestUrl\)[\s\S]{0,120}cache\.put\(OFFLINE_FALLBACK_URL/.test(sw),
    'the offline fallback must only be written behind isFallbackDocument()'
  );
});

/* ─── Defaults agree across files ────────────────────────────── */

test('site: prefs layer defaults match the checkboxes in index.html', () => {
  // The two are independent sources of truth; if they disagree, the map would
  // visibly change state on first load.
  const { defaults } = require('../lib/prefs.js');
  const html = read('index.html');
  const layerDefaults = defaults().layers;

  const toggles = {
    regions: 'toggle-regions',
    fallline: 'toggle-fallline',
    cities: 'toggle-cities',
    hardiness: 'toggle-hardiness',
    gardens: 'toggle-gardens',
  };

  for (const [key, id] of Object.entries(toggles)) {
    const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
    assert.ok(tag, `index.html has no checkbox #${id}`);
    const checkedInHtml = / checked/.test(tag[0]);
    assert.equal(
      checkedInHtml, layerDefaults[key],
      `#${id} checked=${checkedInHtml} but prefs default is ${layerDefaults[key]}`
    );
  }
});

test('site: index.html loads the shared libs before map.js', () => {
  const html = read('index.html');
  const order = ['lib/api-base.js', 'lib/prefs.js', 'lib/geo-data.js', 'map.js']
    .map((src) => html.indexOf(`src="${src}"`));

  for (let i = 0; i < order.length; i++) {
    assert.ok(order[i] !== -1, `index.html does not load ${order[i]}`);
    if (i > 0) {
      assert.ok(order[i] > order[i - 1], 'scripts must load in dependency order');
    }
  }
});
