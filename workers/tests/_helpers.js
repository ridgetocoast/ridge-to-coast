// workers/tests/_helpers.js
// Shared helpers for node --test workers/tests/*

'use strict';

/**
 * Build a Request whose URL carries the given query string.
 * Path defaults to /v1/echo since the tests pass it directly to a handler;
 * the router does its own path matching in workers/index.js.
 */
function requestOf(queryString, path = '/v1/echo') {
  const qs = queryString ? (queryString.startsWith('?') ? queryString : '?' + queryString) : '';
  return new Request('https://api.ridgetocoast.com' + path + qs);
}

/**
 * Swap globalThis.fetch with a stub. Returns a restore() fn the caller
 * MUST invoke in the test's afterEach / try-finally to avoid pollution.
 */
function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return function restore() { globalThis.fetch = original; };
}

/**
 * Build a JSON request, for the /v1/subscribe tests.
 */
function jsonRequest(path, body, init = {}) {
  return new Request('https://api.ridgetocoast.com' + path, {
    method: init.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/**
 * A minimal in-memory stand-in for a D1 binding.
 *
 * It does not parse SQL. It matches the handful of statements
 * workers/subscribe.js issues and applies the equivalent operation to plain
 * collections, which keeps those tests about the handler's behaviour rather
 * than about SQLite. Add a branch here if subscribe.js grows a new statement —
 * an unrecognised statement throws rather than silently passing.
 */
function fakeD1() {
  const subscribers = [];
  const attempts = new Map(); // `${ipHash}|${slot}` -> count

  function prepare(sql) {
    let bound = [];
    const api = {
      bind(...args) { bound = args; return api; },

      async first() {
        if (sql.includes('FROM signup_attempts')) {
          const [ipHash, slot] = bound;
          const count = attempts.get(`${ipHash}|${slot}`);
          return count === undefined ? null : { attempts: count };
        }
        if (sql.includes('WHERE channel = ? AND address = ?')) {
          const [channel, address] = bound;
          return subscribers.find((s) => s.channel === channel && s.address === address) || null;
        }
        if (sql.includes('WHERE confirm_token = ?')) {
          const [token] = bound;
          return subscribers.find((s) => s.confirm_token === token) || null;
        }
        throw new Error('fakeD1: unhandled first() for SQL: ' + sql);
      },

      async run() {
        if (sql.includes('INSERT INTO signup_attempts')) {
          const [ipHash, slot] = bound;
          const key = `${ipHash}|${slot}`;
          attempts.set(key, (attempts.get(key) || 0) + 1);
          return { meta: { changes: 1 } };
        }

        if (sql.includes('INSERT INTO subscribers')) {
          const [id, address, zone, confirmToken, unsubToken, source, ipHash, userAgent, createdAt] = bound;
          subscribers.push({
            id, channel: 'email', address, status: 'pending', zone,
            confirm_token: confirmToken, unsub_token: unsubToken,
            source, ip_hash: ipHash, user_agent: userAgent,
            created_at: createdAt, confirmed_at: null, unsubscribed_at: null,
          });
          return { meta: { changes: 1 } };
        }

        if (sql.includes("SET status = 'pending'")) {
          const [zone, confirmToken, unsubToken, source, ipHash, userAgent, createdAt, id] = bound;
          const row = subscribers.find((s) => s.id === id);
          if (!row) return { meta: { changes: 0 } };
          Object.assign(row, {
            status: 'pending', zone, confirm_token: confirmToken, unsub_token: unsubToken,
            source, ip_hash: ipHash, user_agent: userAgent, created_at: createdAt,
            confirmed_at: null, unsubscribed_at: null,
          });
          return { meta: { changes: 1 } };
        }

        if (sql.includes("SET status = 'confirmed'")) {
          const [confirmedAt, id] = bound;
          const row = subscribers.find((s) => s.id === id);
          if (!row) return { meta: { changes: 0 } };
          Object.assign(row, {
            status: 'confirmed', confirmed_at: confirmedAt,
            confirm_token: null, unsubscribed_at: null,
          });
          return { meta: { changes: 1 } };
        }

        if (sql.includes("SET status = 'unsubscribed'")) {
          const [unsubscribedAt, token] = bound;
          const row = subscribers.find((s) => s.unsub_token === token);
          if (!row) return { meta: { changes: 0 } };
          Object.assign(row, {
            status: 'unsubscribed', unsubscribed_at: unsubscribedAt, confirm_token: null,
          });
          return { meta: { changes: 1 } };
        }

        throw new Error('fakeD1: unhandled run() for SQL: ' + sql);
      },
    };
    return api;
  }

  return {
    prepare,
    _subscribers: subscribers,
    _attempts: attempts,
    _find: (address) => subscribers.find((s) => s.address === address),
  };
}

module.exports = { requestOf, mockFetch, jsonRequest, fakeD1 };
