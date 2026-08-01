// workers/tests/subscribe.test.js — /v1/subscribe
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { jsonRequest, fakeD1 } = require('./_helpers.js');

// Worker source is ESM; node:test can't import ESM from a CJS test file without
// --experimental-vm-modules, so we use dynamic import inside async tests.
async function load() {
  return import('../subscribe.js');
}

/**
 * An env with a fake D1 and no mail key, so mailer.js logs the confirmation
 * link instead of calling a provider. Confirmation URLs are captured from the
 * console so the tests can follow them the way a subscriber would.
 */
function makeEnv(overrides = {}) {
  return {
    DB: fakeD1(),
    SITE_ORIGIN: 'https://ridgetocoast.com',
    IP_HASH_SALT: 'test-salt',
    ...overrides,
  };
}

function captureLog() {
  const original = console.log;
  const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  return {
    lines,
    restore() { console.log = original; },
    lastConfirmUrl() {
      const line = [...lines].reverse().find((l) => l.includes('/v1/subscribe/confirm'));
      // http as well as https — local dev links are not TLS.
      const match = line && line.match(/https?:\/\/\S+/);
      return match ? match[0] : null;
    },
  };
}

async function signup(env, body, init) {
  const { handleSubscribe } = await load();
  return handleSubscribe(
    jsonRequest('/v1/subscribe', body, { headers: { 'cf-connecting-ip': '198.51.100.7' }, ...init }),
    env
  );
}

const VALID = { email: 'grower@example.com', consent: true, zone: '7b', source: 'join.html' };

/* ─── Validation ─────────────────────────────────────────────── */

test('subscribe: 400 when the body is not JSON', async () => {
  const res = await signup(makeEnv(), 'not json at all');
  assert.equal(res.status, 400);
});

test('subscribe: 400 when consent is missing or not exactly true', async () => {
  for (const consent of [undefined, false, 'true', 1, null]) {
    const res = await signup(makeEnv(), { email: 'a@b.com', consent });
    assert.equal(res.status, 400, `expected 400 for consent=${JSON.stringify(consent)}`);
  }
});

test('subscribe: 400 when the email is missing or malformed', async () => {
  for (const email of ['', '   ', 'not-an-email', 'a@b', 'a b@c.com', '@example.com']) {
    const res = await signup(makeEnv(), { email, consent: true });
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(email)}`);
  }
});

test('subscribe: 400 when the email exceeds the RFC length limit', async () => {
  const res = await signup(makeEnv(), { email: 'a'.repeat(250) + '@example.com', consent: true });
  assert.equal(res.status, 400);
});

test('subscribe: 405 for a GET on the signup endpoint', async () => {
  const { handleSubscribe } = await load();
  const res = await handleSubscribe(new Request('https://api.ridgetocoast.com/v1/subscribe'), makeEnv());
  assert.equal(res.status, 405);
});

test('subscribe: 503 when no database is bound', async () => {
  const res = await signup({ SITE_ORIGIN: 'https://ridgetocoast.com' }, VALID);
  assert.equal(res.status, 503);
});

/* ─── The happy path ─────────────────────────────────────────── */

test('subscribe: a valid signup writes a pending row and answers 202', async () => {
  const env = makeEnv();
  const log = captureLog();
  try {
    const res = await signup(env, VALID);
    assert.equal(res.status, 202);

    const body = await res.json();
    assert.equal(body.status, 'pending');

    const row = env.DB._find('grower@example.com');
    assert.ok(row, 'a subscriber row should exist');
    assert.equal(row.status, 'pending', 'submitting the form must NOT subscribe anyone');
    assert.equal(row.zone, '7b');
    assert.equal(row.source, 'join.html');
    assert.ok(row.confirm_token, 'a confirmation token is issued');
    assert.ok(row.unsub_token, 'an unsubscribe token is issued');
  } finally {
    log.restore();
  }
});

test('subscribe: the email is lowercased and trimmed before storage', async () => {
  const env = makeEnv();
  const log = captureLog();
  try {
    await signup(env, { ...VALID, email: '  Grower@Example.COM  ' });
    assert.ok(env.DB._find('grower@example.com'), 'stored address should be normalised');
  } finally {
    log.restore();
  }
});

test('subscribe: an invalid zone is dropped rather than rejecting the signup', async () => {
  const env = makeEnv();
  const log = captureLog();
  try {
    const res = await signup(env, { ...VALID, zone: '99z' });
    assert.equal(res.status, 202);
    assert.equal(env.DB._find('grower@example.com').zone, null);
  } finally {
    log.restore();
  }
});

test('subscribe: the raw IP is never stored, only a hash', async () => {
  const env = makeEnv();
  const log = captureLog();
  try {
    await signup(env, VALID);
    const row = env.DB._find('grower@example.com');
    assert.ok(row.ip_hash, 'a consent hash is recorded');
    assert.ok(!row.ip_hash.includes('198.51.100.7'), 'the raw IP must not appear');
    assert.match(row.ip_hash, /^[0-9a-f]{64}$/, 'expected a SHA-256 hex digest');
  } finally {
    log.restore();
  }
});

test('subscribe: the same IP hashes differently under a different salt', async () => {
  const { __test__ } = await load();
  const a = await __test__.hashIP('198.51.100.7', 'salt-a');
  const b = await __test__.hashIP('198.51.100.7', 'salt-b');
  assert.notEqual(a, b);
});

/* ─── Enumeration resistance ─────────────────────────────────── */

test('subscribe: an already-confirmed address gets the same 202 and no new mail', async () => {
  const env = makeEnv();
  const log = captureLog();
  try {
    await signup(env, VALID);
    const row = env.DB._find('grower@example.com');
    row.status = 'confirmed';
    row.confirm_token = null;

    const before = log.lines.length;
    const res = await signup(env, VALID);

    assert.equal(res.status, 202, 'the response must not reveal existing membership');
    assert.equal(env.DB._find('grower@example.com').status, 'confirmed', 'still confirmed');
    assert.equal(
      log.lines.slice(before).filter((l) => l.includes('/v1/subscribe/confirm')).length,
      0,
      're-sending confirmation to a live subscriber is a harassment vector'
    );
  } finally {
    log.restore();
  }
});

test('subscribe: a repeat pending signup reissues the token and invalidates the old link', async () => {
  const env = makeEnv();
  const log = captureLog();
  try {
    await signup(env, VALID);
    const firstToken = env.DB._find('grower@example.com').confirm_token;

    await signup(env, VALID);
    const secondToken = env.DB._find('grower@example.com').confirm_token;

    assert.notEqual(firstToken, secondToken, 'a fresh token must be issued');
    assert.equal(env.DB._subscribers.length, 1, 'no duplicate row');
  } finally {
    log.restore();
  }
});

/* ─── Abuse controls ─────────────────────────────────────────── */

test('subscribe: a filled honeypot is answered 202 but writes nothing', async () => {
  const env = makeEnv();
  const res = await signup(env, { ...VALID, website: 'http://spam.example' });

  assert.equal(res.status, 202, 'the bot must not learn it was caught');
  assert.equal(env.DB._subscribers.length, 0, 'nothing should be stored');
});

test('subscribe: an empty honeypot is treated as a real person', async () => {
  const env = makeEnv();
  const log = captureLog();
  try {
    const res = await signup(env, { ...VALID, website: '' });
    assert.equal(res.status, 202);
    assert.equal(env.DB._subscribers.length, 1);
  } finally {
    log.restore();
  }
});

test('subscribe: signups from one IP are rate limited', async () => {
  const { __test__ } = await load();
  const env = makeEnv();
  const log = captureLog();
  try {
    const limit = __test__.MAX_SIGNUPS_PER_IP_PER_HOUR;
    for (let i = 0; i < limit; i++) {
      const res = await signup(env, { ...VALID, email: `person${i}@example.com` });
      assert.equal(res.status, 202, `signup ${i + 1} should be accepted`);
    }
    const blocked = await signup(env, { ...VALID, email: 'one-too-many@example.com' });
    assert.equal(blocked.status, 429);
    assert.ok(!env.DB._find('one-too-many@example.com'), 'the blocked signup writes nothing');
  } finally {
    log.restore();
  }
});

/* ─── Confirm ────────────────────────────────────────────────── */

test('subscribe: following the confirmation link confirms and redirects', async () => {
  const { handleSubscribe } = await load();
  const env = makeEnv();
  const log = captureLog();
  try {
    await signup(env, VALID);
    const token = env.DB._find('grower@example.com').confirm_token;

    const res = await handleSubscribe(
      new Request(`https://api.ridgetocoast.com/v1/subscribe/confirm?token=${token}`),
      env
    );

    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), 'https://ridgetocoast.com/confirmed.html');

    const row = env.DB._find('grower@example.com');
    assert.equal(row.status, 'confirmed');
    assert.ok(row.confirmed_at, 'the confirmation time is recorded');
    assert.equal(row.confirm_token, null, 'the token is single-use');
  } finally {
    log.restore();
  }
});

test('subscribe: a reused or unknown confirmation token redirects to an expired notice', async () => {
  const { handleSubscribe } = await load();
  const env = makeEnv();
  const log = captureLog();
  try {
    await signup(env, VALID);
    const token = env.DB._find('grower@example.com').confirm_token;

    await handleSubscribe(new Request(`https://api.ridgetocoast.com/v1/subscribe/confirm?token=${token}`), env);
    const second = await handleSubscribe(
      new Request(`https://api.ridgetocoast.com/v1/subscribe/confirm?token=${token}`), env
    );

    assert.equal(second.status, 302);
    assert.match(second.headers.get('Location'), /join\.html\?confirm=expired$/);
  } finally {
    log.restore();
  }
});

test('subscribe: confirm without a token is a 400', async () => {
  const { handleSubscribe } = await load();
  const res = await handleSubscribe(
    new Request('https://api.ridgetocoast.com/v1/subscribe/confirm'), makeEnv()
  );
  assert.equal(res.status, 400);
});

/* ─── Unsubscribe ────────────────────────────────────────────── */

test('subscribe: the unsubscribe link removes a confirmed subscriber', async () => {
  const { handleSubscribe } = await load();
  const env = makeEnv();
  const log = captureLog();
  try {
    await signup(env, VALID);
    const row = env.DB._find('grower@example.com');
    row.status = 'confirmed';

    const res = await handleSubscribe(
      new Request(`https://api.ridgetocoast.com/v1/subscribe/unsubscribe?token=${row.unsub_token}`),
      env
    );

    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Location'), 'https://ridgetocoast.com/unsubscribed.html');
    assert.equal(env.DB._find('grower@example.com').status, 'unsubscribed');
    assert.ok(env.DB._find('grower@example.com').unsubscribed_at);
  } finally {
    log.restore();
  }
});

test('subscribe: the unsubscribe link keeps working when clicked twice', async () => {
  // Someone trying to leave must never be shown an error.
  const { handleSubscribe } = await load();
  const env = makeEnv();
  const log = captureLog();
  try {
    await signup(env, VALID);
    const token = env.DB._find('grower@example.com').unsub_token;
    const url = `https://api.ridgetocoast.com/v1/subscribe/unsubscribe?token=${token}`;

    const first = await handleSubscribe(new Request(url), env);
    const second = await handleSubscribe(new Request(url), env);

    assert.equal(first.headers.get('Location'), 'https://ridgetocoast.com/unsubscribed.html');
    assert.equal(second.headers.get('Location'), 'https://ridgetocoast.com/unsubscribed.html');
  } finally {
    log.restore();
  }
});

test('subscribe: one-click unsubscribe accepts POST (RFC 8058)', async () => {
  const { handleSubscribe } = await load();
  const env = makeEnv();
  const log = captureLog();
  try {
    await signup(env, VALID);
    const token = env.DB._find('grower@example.com').unsub_token;

    const res = await handleSubscribe(
      new Request(`https://api.ridgetocoast.com/v1/subscribe/unsubscribe?token=${token}`, { method: 'POST' }),
      env
    );
    assert.equal(res.status, 302);
    assert.equal(env.DB._find('grower@example.com').status, 'unsubscribed');
  } finally {
    log.restore();
  }
});

test('subscribe: an unknown unsubscribe token still lands on a calm page', async () => {
  const { handleSubscribe } = await load();
  const res = await handleSubscribe(
    new Request('https://api.ridgetocoast.com/v1/subscribe/unsubscribe?token=nope'), makeEnv()
  );
  assert.equal(res.status, 302);
  assert.match(res.headers.get('Location'), /unsubscribed\.html\?state=unknown$/);
});

test('subscribe: an unsubscribed address can rejoin', async () => {
  const { handleSubscribe } = await load();
  const env = makeEnv();
  const log = captureLog();
  try {
    await signup(env, VALID);
    const token = env.DB._find('grower@example.com').unsub_token;
    await handleSubscribe(new Request(`https://api.ridgetocoast.com/v1/subscribe/unsubscribe?token=${token}`), env);
    assert.equal(env.DB._find('grower@example.com').status, 'unsubscribed');

    await signup(env, VALID);
    const row = env.DB._find('grower@example.com');
    assert.equal(row.status, 'pending', 'rejoining starts the double opt-in again');
    assert.equal(row.unsubscribed_at, null);
  } finally {
    log.restore();
  }
});

/* ─── Link construction ──────────────────────────────────────── */

test('subscribe: links use SITE_ORIGIN when set', async () => {
  const env = makeEnv({ SITE_ORIGIN: 'https://alpha.ridgetocoast.com' });
  const log = captureLog();
  try {
    await signup(env, VALID);
    assert.match(log.lastConfirmUrl(), /^https:\/\/alpha\.ridgetocoast\.com\/v1\/subscribe\/confirm\?token=/);
  } finally {
    log.restore();
  }
});

test('subscribe: links fall back to the request origin in local dev', async () => {
  const { handleSubscribe } = await load();
  const env = makeEnv({ SITE_ORIGIN: undefined });
  const log = captureLog();
  try {
    await handleSubscribe(
      new Request('http://localhost:8000/v1/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID),
      }),
      env
    );
    assert.match(log.lastConfirmUrl(), /^http:\/\/localhost:8000\/v1\/subscribe\/confirm\?token=/);
  } finally {
    log.restore();
  }
});

/* ─── Mail failures ──────────────────────────────────────────── */

test('subscribe: a provider failure answers 502 and leaves the row pending', async () => {
  const env = makeEnv({ NEWSLETTER_API_KEY: 'test-key' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('provider exploded', { status: 500 });
  try {
    const res = await signup(env, VALID);
    assert.equal(res.status, 502);
    assert.equal(env.DB._find('grower@example.com').status, 'pending',
      'the signup is recorded even though the mail failed');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('subscribe: a successful provider send answers 202', async () => {
  const env = makeEnv({ NEWSLETTER_API_KEY: 'test-key' });
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ id: 'msg_1' });
  };
  try {
    const res = await signup(env, VALID);
    assert.equal(res.status, 202);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /api\.resend\.com/);

    const sent = JSON.parse(calls[0].init.body);
    assert.deepEqual(sent.to, ['grower@example.com']);
    assert.ok(sent.headers['List-Unsubscribe'], 'one-click unsubscribe header is required');
    assert.ok(sent.text.includes('/v1/subscribe/confirm'), 'plain-text part carries the link');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/* ─── Routing ────────────────────────────────────────────────── */

test('subscribe: an unknown path under /v1/subscribe is a 404', async () => {
  const { handleSubscribe } = await load();
  const res = await handleSubscribe(
    new Request('https://api.ridgetocoast.com/v1/subscribe/nonsense'), makeEnv()
  );
  assert.equal(res.status, 404);
});

test('subscribe: a trailing slash resolves to the same route', async () => {
  const { handleSubscribe } = await load();
  const res = await handleSubscribe(
    new Request('https://api.ridgetocoast.com/v1/subscribe/'), makeEnv()
  );
  assert.equal(res.status, 405, 'GET on the signup route, not a 404');
});
