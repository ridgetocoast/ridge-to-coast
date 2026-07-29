// workers/subscribe.js — /v1/subscribe (newsletter signup, double opt-in)
//
// Routes:
//   POST /v1/subscribe                    accept a signup, send a confirmation
//   GET  /v1/subscribe/confirm?token=     confirm, then redirect to /confirmed.html
//   GET  /v1/subscribe/unsubscribe?token= unsubscribe, then redirect to /unsubscribed.html
//
// Consent model: submitting the form does NOT subscribe anyone. A pending row is
// written and one confirmation email is sent; nothing further goes out until the
// link is clicked. That caps the damage from an abusive signup at a single
// message to an address that did not ask for it.
//
// Abuse controls, cheapest first: a honeypot field, a per-IP hourly rate limit,
// and double opt-in itself. Turnstile is deliberately not used — it would require
// `script-src https://challenges.cloudflare.com`, breaking the repo's no-CDN rule.

import { sendConfirmation } from './mailer.js';

const MAX_SIGNUPS_PER_IP_PER_HOUR = 5;
const MAX_EMAIL_LENGTH = 254;               // RFC 5321 practical maximum
const ZONE_PATTERN = /^(?:[3-9]|1[0-3])[ab]$/;

// Deliberately permissive: the confirmation email is the real validation. An
// address that cannot receive mail simply never confirms.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const JSON_HEADERS = { 'Cache-Control': 'no-store' };

/**
 * The same response for a new signup, a repeat signup, and an address already on
 * the list. Anything else turns the endpoint into an oracle for whether a given
 * address is subscribed.
 */
function acceptedResponse() {
  return Response.json(
    { status: 'pending', message: 'Check your inbox for a confirmation link.' },
    { status: 202, headers: JSON_HEADERS }
  );
}

function errorResponse(status, error) {
  return Response.json({ error }, { status, headers: JSON_HEADERS });
}

function nowISO() {
  return new Date().toISOString();
}

function hourSlot(date = new Date()) {
  return date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

/** Hash the client IP so consent can be evidenced without storing the address. */
async function hashIP(ip, salt) {
  const data = new TextEncoder().encode(`${salt || 'ridge-to-coast'}:${ip || 'unknown'}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeEmail(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function normalizeZone(value) {
  if (typeof value !== 'string') return null;
  const zone = value.trim().toLowerCase();
  return ZONE_PATTERN.test(zone) ? zone : null;
}

function siteOrigin(env, request) {
  if (env && env.SITE_ORIGIN) return env.SITE_ORIGIN.replace(/\/$/, '');
  // Fall back to the requesting origin so local dev and preview environments
  // send links that actually resolve.
  return new URL(request.url).origin;
}

function redirectTo(url) {
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
}

/**
 * @returns {Promise<boolean>} true when this IP is over its hourly budget.
 */
async function isRateLimited(db, ipHash) {
  const slot = hourSlot();
  const row = await db
    .prepare('SELECT attempts FROM signup_attempts WHERE ip_hash = ? AND hour_slot = ?')
    .bind(ipHash, slot)
    .first();

  if (row && row.attempts >= MAX_SIGNUPS_PER_IP_PER_HOUR) return true;

  await db
    .prepare(
      `INSERT INTO signup_attempts (ip_hash, hour_slot, attempts) VALUES (?, ?, 1)
       ON CONFLICT (ip_hash, hour_slot) DO UPDATE SET attempts = attempts + 1`
    )
    .bind(ipHash, slot)
    .run();

  return false;
}

async function handleSignup(request, env) {
  if (!env || !env.DB) {
    console.error('subscribe: no D1 binding');
    return errorResponse(503, 'Signup is not available right now.');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'Expected a JSON body.');
  }
  if (!body || typeof body !== 'object') return errorResponse(400, 'Expected a JSON object.');

  // Honeypot. A person never sees this field; a naive bot fills everything.
  // Answer 202 so the bot cannot tell it was caught.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return acceptedResponse();
  }

  if (body.consent !== true) {
    return errorResponse(400, 'Consent is required to join the list.');
  }

  const email = normalizeEmail(body.email);
  if (!email) return errorResponse(400, 'An email address is required.');
  if (email.length > MAX_EMAIL_LENGTH) return errorResponse(400, 'That email address is too long.');
  if (!EMAIL_PATTERN.test(email)) return errorResponse(400, 'That does not look like an email address.');

  const zone = normalizeZone(body.zone);
  const source = typeof body.source === 'string' ? body.source.slice(0, 60) : null;
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 300);
  const ipHash = await hashIP(request.headers.get('cf-connecting-ip'), env.IP_HASH_SALT);

  if (await isRateLimited(env.DB, ipHash)) {
    return errorResponse(429, 'Too many signups from this connection. Try again later.');
  }

  const existing = await env.DB
    .prepare('SELECT id, status FROM subscribers WHERE channel = ? AND address = ?')
    .bind('email', email)
    .first();

  // Already confirmed: say nothing, send nothing. Re-sending a confirmation to a
  // live subscriber is a way to harass them.
  if (existing && existing.status === 'confirmed') {
    return acceptedResponse();
  }

  const confirmToken = crypto.randomUUID().replace(/-/g, '');
  const unsubToken = crypto.randomUUID().replace(/-/g, '');
  const origin = siteOrigin(env, request);
  const confirmUrl = `${origin}/v1/subscribe/confirm?token=${confirmToken}`;
  const unsubUrl = `${origin}/v1/subscribe/unsubscribe?token=${unsubToken}`;

  try {
    if (existing) {
      // Pending or previously unsubscribed: reset to pending with a fresh token,
      // so an old link in an old inbox stops working.
      await env.DB
        .prepare(
          `UPDATE subscribers
              SET status = 'pending', zone = ?, confirm_token = ?, unsub_token = ?,
                  source = ?, ip_hash = ?, user_agent = ?, created_at = ?,
                  confirmed_at = NULL, unsubscribed_at = NULL
            WHERE id = ?`
        )
        .bind(zone, confirmToken, unsubToken, source, ipHash, userAgent, nowISO(), existing.id)
        .run();
    } else {
      await env.DB
        .prepare(
          `INSERT INTO subscribers
             (id, channel, address, status, zone, confirm_token, unsub_token,
              source, ip_hash, user_agent, created_at)
           VALUES (?, 'email', ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(crypto.randomUUID(), email, zone, confirmToken, unsubToken,
              source, ipHash, userAgent, nowISO())
        .run();
    }
  } catch (err) {
    console.error('subscribe: database write failed', err);
    return errorResponse(500, 'Could not record that signup. Try again shortly.');
  }

  try {
    await sendConfirmation({ to: email, confirmUrl, unsubUrl }, env);
  } catch (err) {
    // The row is already pending, so the signup is not lost — but tell the
    // person, because no confirmation link is going to arrive.
    console.error('subscribe: confirmation send failed', err);
    return errorResponse(502, 'Could not send the confirmation email. Try again shortly.');
  }

  return acceptedResponse();
}

async function handleConfirm(request, env) {
  if (!env || !env.DB) return errorResponse(503, 'Confirmation is not available right now.');

  const token = new URL(request.url).searchParams.get('token');
  const origin = siteOrigin(env, request);
  if (!token) return errorResponse(400, 'Missing confirmation token.');

  const row = await env.DB
    .prepare('SELECT id, status FROM subscribers WHERE confirm_token = ?')
    .bind(token)
    .first();

  if (!row) {
    // Also the path for a link used twice: the token is cleared on first use.
    return redirectTo(`${origin}/join.html?confirm=expired`);
  }

  await env.DB
    .prepare(
      `UPDATE subscribers
          SET status = 'confirmed', confirmed_at = ?, confirm_token = NULL,
              unsubscribed_at = NULL
        WHERE id = ?`
    )
    .bind(nowISO(), row.id)
    .run();

  return redirectTo(`${origin}/confirmed.html`);
}

async function handleUnsubscribe(request, env) {
  if (!env || !env.DB) return errorResponse(503, 'Unsubscribe is not available right now.');

  const token = new URL(request.url).searchParams.get('token');
  const origin = siteOrigin(env, request);
  if (!token) return errorResponse(400, 'Missing unsubscribe token.');

  // The unsub token is not cleared, so the link keeps working — clicking it
  // twice must never show an error to someone trying to leave.
  const result = await env.DB
    .prepare(
      `UPDATE subscribers
          SET status = 'unsubscribed', unsubscribed_at = ?, confirm_token = NULL
        WHERE unsub_token = ?`
    )
    .bind(nowISO(), token)
    .run();

  const changed = result && result.meta ? result.meta.changes : 0;
  if (!changed) return redirectTo(`${origin}/unsubscribed.html?state=unknown`);

  return redirectTo(`${origin}/unsubscribed.html`);
}

export async function handleSubscribe(request, env) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '');

  if (path === '/v1/subscribe/confirm') {
    if (request.method !== 'GET') return errorResponse(405, 'Method not allowed.');
    return handleConfirm(request, env);
  }

  if (path === '/v1/subscribe/unsubscribe') {
    // POST is allowed because RFC 8058 one-click unsubscribe posts to the link.
    if (request.method !== 'GET' && request.method !== 'POST') {
      return errorResponse(405, 'Method not allowed.');
    }
    return handleUnsubscribe(request, env);
  }

  if (path === '/v1/subscribe') {
    if (request.method !== 'POST') return errorResponse(405, 'Method not allowed.');
    return handleSignup(request, env);
  }

  return errorResponse(404, 'Not found');
}

export const __test__ = {
  normalizeEmail, normalizeZone, hashIP, hourSlot,
  EMAIL_PATTERN, MAX_SIGNUPS_PER_IP_PER_HOUR,
};
