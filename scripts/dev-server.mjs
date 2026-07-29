#!/usr/bin/env node
/**
 * dev-server.mjs — single-origin local development server
 * -------------------------------------------------------
 * Serves app/ statically AND reverse-proxies /v1/* to a local `wrangler dev`.
 *
 * Why a proxy instead of two separate ports: production serves the frontend and
 * the API from different hosts, but the app's CSP (a <meta> tag in index.html,
 * there is no _headers file) only lists the real API hostnames. Fronting both
 * behind one origin means `connect-src 'self'` already covers local API calls,
 * so the production CSP needs no localhost exception and there is no CORS to
 * configure. app/lib/api-base.js returns '' for localhost to match.
 *
 * Dependencies: NONE. Node built-ins only — the repo is zero-npm.
 *
 * Usage:
 *   node scripts/dev-server.mjs                    # proxy /v1 to 127.0.0.1:8787
 *   node scripts/dev-server.mjs --no-api           # static only, /v1 returns 503
 *   node scripts/dev-server.mjs --api=https://alpha.ridgetocoast.com
 */

import { createServer } from 'node:http';
import { createReadStream, realpathSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const APP_ROOT = join(REPO_ROOT, 'app');

const DEFAULT_PORT = 8000;
const DEFAULT_API = 'http://127.0.0.1:8787';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// Hop-by-hop headers must not be forwarded through a proxy (RFC 7230 §6.1).
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
]);

const HELP = `
dev-server.mjs — single-origin local dev server for Ridge to Coast

  --port=<n>    Port to listen on (default ${DEFAULT_PORT})
  --api=<url>   Reverse-proxy target for /v1/* (default ${DEFAULT_API})
  --no-api      Disable the proxy; /v1/* returns 503
  --sw          Serve sw.js (default: 404, so no service worker installs in dev)
  --help        Show this message
`;

function parseArgs(argv) {
  const opts = { port: DEFAULT_PORT, api: DEFAULT_API, serveSW: false, help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--no-api') opts.api = null;
    else if (arg === '--sw') opts.serveSW = true;
    else if (arg.startsWith('--port=')) opts.port = Number(arg.slice(7));
    else if (arg.startsWith('--api=')) opts.api = arg.slice(6);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    throw new Error(`Invalid --port: ${opts.port}`);
  }
  return opts;
}

/**
 * Map a URL pathname to a file inside app/, or null if it cannot be served.
 * Extensionless paths resolve to <name>.html so /about works as well as
 * /about.html — Cloudflare Pages does the same.
 *
 * Traversal is handled by normalize(): on an absolute path it collapses leading
 * `..` at the root, so '/../../etc/passwd' becomes '/etc/passwd' and lands
 * harmlessly inside app/ (then 404s). The startsWith check below is a second
 * line of defence that must not be removed — it is what makes the invariant
 * "the result is always inside APP_ROOT" true by construction rather than by
 * relying on normalize's behaviour.
 */
function resolveStaticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null; // malformed percent-encoding, e.g. '/%'
  }
  if (decoded.includes('\0')) return null;

  const withIndex = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const candidate = resolve(join(APP_ROOT, normalize(withIndex)));
  if (candidate !== APP_ROOT && !candidate.startsWith(APP_ROOT + sep)) return null;
  return candidate;
}

async function firstExistingFile(paths) {
  for (const path of paths) {
    try {
      const stats = await stat(path);
      if (stats.isFile()) return { path, size: stats.size };
    } catch {
      // fall through to the next candidate
    }
  }
  return null;
}

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, status, message) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(message);
}

async function serveStatic(req, res, opts) {
  const { pathname } = new URL(req.url, 'http://localhost');

  // Keep the service worker out of dev by default. A registered SW caches
  // aggressively and makes edits appear not to take effect; the registration in
  // app/map.js already catches its own failure, so a 404 here is harmless.
  if (pathname === '/sw.js' && !opts.serveSW) {
    return sendText(res, 404, 'sw.js is disabled in dev — pass --sw to serve it.\n');
  }

  const base = resolveStaticPath(pathname);
  if (base === null) return sendText(res, 403, 'Forbidden\n');

  const candidates = extname(base) === '' ? [`${base}.html`, join(base, 'index.html')] : [base];
  const found = await firstExistingFile(candidates);
  if (!found) return sendText(res, 404, `Not found: ${pathname}\n`);

  res.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(found.path)] ?? 'application/octet-stream',
    'Content-Length': found.size,
    // Dev only: never cache, so a reload always shows the edit just made.
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') return res.end();

  const stream = createReadStream(found.path);
  stream.on('error', () => { if (!res.headersSent) sendText(res, 500, 'Read error\n'); else res.end(); });
  stream.pipe(res);
}

/**
 * Rewrite a redirect that points at the proxied API so it points at this server
 * instead. Anything not on the API origin (or not a valid absolute URL) is
 * returned untouched — a relative Location is already correct.
 *
 * @param {string} location    the upstream Location header
 * @param {string} apiOrigin   e.g. 'http://127.0.0.1:8787'
 * @param {string} hostHeader  this server's Host, e.g. 'localhost:8000'
 */
function rewriteLocation(location, apiOrigin, hostHeader) {
  if (!hostHeader) return location;
  let url;
  try {
    url = new URL(location);
  } catch {
    return location; // relative — already resolves against this origin
  }
  if (url.origin !== apiOrigin) return location;
  return `http://${hostHeader}${url.pathname}${url.search}${url.hash}`;
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function proxyToAPI(req, res, opts) {
  if (!opts.api) {
    return sendJSON(res, 503, {
      error: 'API proxy disabled',
      detail: 'dev-server.mjs was started with --no-api.',
    });
  }

  const target = new URL(req.url, opts.api);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(name.toLowerCase()) && value !== undefined) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: await readBody(req),
      redirect: 'manual',
    });
  } catch (err) {
    return sendJSON(res, 502, {
      error: 'API unreachable',
      target: target.origin,
      detail: String(err && err.cause ? err.cause.message : err),
      hint: `Start the API with:  npx wrangler dev --env dev --port ${target.port || 8787}`,
    });
  }

  const outHeaders = {};
  for (const [name, value] of upstream.headers) {
    if (!HOP_BY_HOP.has(name.toLowerCase()) && name.toLowerCase() !== 'content-encoding') {
      outHeaders[name] = value;
    }
  }
  // fetch() has already decoded the body, so the upstream Content-Encoding and
  // Content-Length no longer describe what we are about to write.
  delete outHeaders['content-length'];

  // Point redirects back at this server. The Worker builds absolute URLs from
  // its own request origin, so /v1/subscribe/confirm would otherwise send the
  // browser to the wrangler port, which serves no static files. Production is
  // unaffected: those environments set SITE_ORIGIN explicitly.
  const location = outHeaders.location ?? outHeaders.Location;
  if (location) {
    const rewritten = rewriteLocation(location, target.origin, req.headers.host);
    delete outHeaders.location;
    delete outHeaders.Location;
    outHeaders.Location = rewritten;
  }

  res.writeHead(upstream.status, outHeaders);
  if (!upstream.body) return res.end();
  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.end(buffer);
}

function createDevServer(opts) {
  return createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    const handler = pathname === '/v1' || pathname.startsWith('/v1/') ? proxyToAPI : serveStatic;
    handler(req, res, opts).catch((err) => {
      console.error(`[dev-server] ${req.method} ${req.url} failed:`, err);
      if (!res.headersSent) sendText(res, 500, 'Internal dev-server error\n');
      else res.end();
    });
  });
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error(HELP);
    process.exit(2);
  }

  if (opts.help) {
    console.log(HELP);
    return;
  }

  const server = createDevServer(opts);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[dev-server] port ${opts.port} is already in use.`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(opts.port, '127.0.0.1', () => {
    console.log(`[dev-server] app/    → http://localhost:${opts.port}`);
    console.log(`[dev-server] /v1/*   → ${opts.api ?? 'disabled (--no-api)'}`);
    console.log(`[dev-server] sw.js   → ${opts.serveSW ? 'served' : 'disabled (pass --sw to enable)'}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}

// Only run when executed directly, so tests can import the helpers.
//
// Both sides must be realpath'd. import.meta.url is already resolved through
// symlinks but process.argv[1] is not, so on macOS — where /tmp is a symlink to
// /private/tmp — a plain comparison silently fails and the server never starts.
function isMain() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  main();
}

export { createDevServer, parseArgs, resolveStaticPath, rewriteLocation, APP_ROOT };
