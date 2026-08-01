// workers/tests/wrangler-config.test.js — guards on wrangler.toml
//
// These exist because a bad binding here fails at deploy time in CI, not at
// test time, and it breaks the preview deploy for every open pull request —
// not just the one that introduced it.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAW = fs.readFileSync(path.join(__dirname, '..', '..', 'wrangler.toml'), 'utf8');

// Strip whole-line comments before parsing. wrangler.toml documents the shape of
// a d1_databases block in a comment, and a naive scan would read that example as
// live config. (No TOML parser here — the repo is zero-npm.)
const CONFIG = RAW.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');

const DEPLOYED_ENVS = ['production', 'preview', 'alpha'];

test('wrangler: no placeholder ids are committed', () => {
  // Cloudflare rejects the upload with
  //   "binding DB of type d1 must have a valid `database_id`" (code 10021)
  // so a placeholder breaks deploys everywhere — including every unrelated PR,
  // because deploy-workers-preview.yml deploys the Worker on each one.
  const placeholders = CONFIG.match(/REPLACE_WITH_\w+/g) || [];
  assert.deepEqual(
    placeholders, [],
    `wrangler.toml still has placeholders: ${placeholders.join(', ')}. ` +
    'Either fill in the real ids or remove the block until the resource exists.'
  );
});

test('wrangler: every declared d1 binding has a plausible database id', () => {
  const blocks = CONFIG.match(/\[\[env\.\w+\.d1_databases\]\][\s\S]*?(?=\n\[|\n*$)/g) || [];

  for (const block of blocks) {
    const env = block.match(/\[\[env\.(\w+)\.d1_databases\]\]/)[1];
    const id = (block.match(/database_id\s*=\s*"([^"]*)"/) || [])[1];

    assert.ok(id, `env.${env} d1 binding has no database_id`);

    if (env === 'dev') {
      // --local never contacts the API, so a literal marker is fine and is
      // clearer than a fake uuid.
      assert.equal(id, 'local-development-only');
    } else {
      assert.match(
        id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        `env.${env} database_id must be a real Cloudflare uuid, got "${id}"`
      );
    }
  }
});

test('wrangler: local dev keeps its D1 binding', () => {
  // scripts/dev.sh applies the schema against this binding; losing it would
  // silently break the whole local newsletter flow.
  assert.match(CONFIG, /\[\[env\.dev\.d1_databases\]\]/, 'env.dev must bind DB');
});

test('wrangler: deployed environments declare SITE_ORIGIN', () => {
  // Without it, subscribe.js falls back to the request origin, so confirmation
  // links would point at whatever host the request arrived on.
  for (const env of DEPLOYED_ENVS) {
    const block = CONFIG.match(new RegExp(`\\[env\\.${env}\\][\\s\\S]*?(?=\\n\\[|\\n*$)`));
    assert.ok(block, `no [env.${env}] block`);
    assert.match(block[0], /SITE_ORIGIN\s*=\s*"https:\/\//, `env.${env} must set an https SITE_ORIGIN`);
  }
});

test('wrangler: dev deliberately does NOT set SITE_ORIGIN', () => {
  // Leaving it unset is what makes local confirmation links point back at the
  // dev server rather than a deployed host.
  const devBlock = CONFIG.match(/\[env\.dev\][\s\S]*?(?=\n\[\[|\n*$)/)[0];
  assert.ok(!/SITE_ORIGIN/.test(devBlock), 'env.dev must leave SITE_ORIGIN unset');
});

test('wrangler: no secrets are committed', () => {
  for (const name of ['NEWSLETTER_API_KEY', 'IP_HASH_SALT']) {
    assert.ok(
      !new RegExp(`^\\s*${name}\\s*=`, 'm').test(CONFIG),
      `${name} is a secret — use \`wrangler secret put\`, never wrangler.toml`
    );
  }
});

test('wrangler: dev has no routes, so it can never be deployed to a hostname', () => {
  const devBlock = CONFIG.match(/\[env\.dev\][\s\S]*?(?=\n\[\[|\n*$)/)[0];
  assert.ok(!/routes\s*=/.test(devBlock), 'env.dev must not declare routes');
});
