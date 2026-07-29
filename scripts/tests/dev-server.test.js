// scripts/tests/dev-server.test.js — local dev server argument parsing and path safety
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// dev-server.mjs is ESM; node:test cannot `require` it from a CJS file, so we
// use a dynamic import inside async tests — the same pattern as workers/tests/.
async function load() {
  return import('../dev-server.mjs');
}

test('dev-server: default options', async () => {
  const { parseArgs } = await load();
  const opts = parseArgs([]);
  assert.equal(opts.port, 8000);
  assert.equal(opts.api, 'http://127.0.0.1:8787');
  assert.equal(opts.serveSW, false);
});

test('dev-server: --no-api disables the proxy', async () => {
  const { parseArgs } = await load();
  assert.equal(parseArgs(['--no-api']).api, null);
});

test('dev-server: --port and --api override the defaults', async () => {
  const { parseArgs } = await load();
  const opts = parseArgs(['--port=9999', '--api=https://alpha.ridgetocoast.com']);
  assert.equal(opts.port, 9999);
  assert.equal(opts.api, 'https://alpha.ridgetocoast.com');
});

test('dev-server: --sw opts back into serving the service worker', async () => {
  const { parseArgs } = await load();
  assert.equal(parseArgs(['--sw']).serveSW, true);
});

test('dev-server: invalid port is rejected', async () => {
  const { parseArgs } = await load();
  for (const bad of ['--port=0', '--port=70000', '--port=abc', '--port=-1']) {
    assert.throws(() => parseArgs([bad]), /Invalid --port/, `expected ${bad} to be rejected`);
  }
});

test('dev-server: unknown arguments are rejected', async () => {
  const { parseArgs } = await load();
  assert.throws(() => parseArgs(['--nope']), /Unknown argument/);
});

test('dev-server: paths resolve inside app/', async () => {
  const { resolveStaticPath, APP_ROOT } = await load();
  assert.equal(resolveStaticPath('/'), path.join(APP_ROOT, 'index.html'));
  assert.equal(resolveStaticPath('/style.css'), path.join(APP_ROOT, 'style.css'));
  assert.equal(resolveStaticPath('/lib/api-base.js'), path.join(APP_ROOT, 'lib', 'api-base.js'));
});

test('dev-server: directory traversal never escapes app/', async () => {
  const { resolveStaticPath, APP_ROOT } = await load();
  const attempts = [
    '/../wrangler.toml',
    '/../../etc/passwd',
    '/lib/../../workers/index.js',
    '/%2e%2e/wrangler.toml',        // percent-encoded ..
    '/..%2fwrangler.toml',
    '/../app-evil/secret.txt',      // sibling dir sharing the root's name prefix
    '/./../../.git/config',
  ];
  for (const attempt of attempts) {
    const resolved = resolveStaticPath(attempt);
    // Either refused outright, or clamped to somewhere inside app/ (which then
    // 404s). What must never happen is a path outside APP_ROOT.
    if (resolved !== null) {
      assert.ok(
        resolved.startsWith(APP_ROOT + path.sep),
        `${attempt} resolved outside app/: ${resolved}`
      );
    }
  }
});

test('dev-server: malformed percent-encoding is refused, not thrown', async () => {
  const { resolveStaticPath } = await load();
  for (const bad of ['/%', '/%zz', '/lib/%E0%A4%A.js']) {
    assert.equal(resolveStaticPath(bad), null, `expected ${bad} to be refused`);
  }
});

test('dev-server: null bytes are refused', async () => {
  const { resolveStaticPath } = await load();
  assert.equal(resolveStaticPath('/style.css\0.png'), null);
  assert.equal(resolveStaticPath('/%00'), null);
});
