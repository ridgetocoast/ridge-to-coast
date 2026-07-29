# Environments

| Environment | Frontend | API | Deploy trigger |
|---|---|---|---|
| **Local** | `http://localhost:8000` | `http://localhost:8000/v1/*` (proxied) | `./scripts/dev.sh` |
| **Production** | [ridgetocoast.com](https://ridgetocoast.com) | [api.ridgetocoast.com](https://api.ridgetocoast.com) | Push to `main` (staged via `versions upload`; promote manually) |
| **Preprod** | `<hash>.ridgetocoast.pages.dev` (PR previews) | [preprod.ridgetocoast.com](https://preprod.ridgetocoast.com) | PR against `main` |
| **Alpha** | `<hash>.ridgetocoast.pages.dev` (manual) | [alpha.ridgetocoast.com](https://alpha.ridgetocoast.com) | `workflow_dispatch` on "Deploy API" → `alpha` |

## Local development

```bash
./scripts/dev.sh              # frontend + local Workers API + local D1
./scripts/dev.sh --no-api     # frontend only
```

`scripts/dev-server.mjs` serves `app/` and reverse-proxies `/v1/*` to
`wrangler dev` on `127.0.0.1:8787`, so **the frontend and API share one origin**
in development. That matters for two reasons:

- The CSP lives in a `<meta>` tag (there is no `_headers` file). Same-origin API
  calls are already covered by `connect-src 'self'`, so no localhost entry has to
  be added to the production policy.
- No CORS preflight, matching the way `caches.default` behaves in the real Worker.

`app/lib/api-base.js` returns `''` for `localhost`/`127.0.0.1`, which makes
`API_BASE + '/v1/...'` a root-relative URL that the proxy picks up. Before this,
localhost fell through to `preprod.ridgetocoast.com` — a remote host behind the
Zero Trust IP allowlist below, so local full-stack testing was not possible.

Two dev-only behaviours worth knowing:

- **`sw.js` returns 404** unless you pass `--sw`. A registered service worker
  caches aggressively and makes edits look like they did not apply.
- **Everything is sent `Cache-Control: no-store`**, so a plain reload always shows
  the current file.

Wrangler is run through `npx`, which caches it outside the repo — the zero-npm
rule (no `package.json`, no `node_modules/`) still holds. `wrangler dev --local`
keeps its D1 SQLite store in `.wrangler/`, which is gitignored.

## Deploy flow

### Shipping to production

1. Open a PR → `deploy-workers.yml` deploys the API to `preprod.ridgetocoast.com` automatically
2. Verify on preprod
3. Merge PR to `main` → `deploy-workers.yml` stages the new Workers version (not live yet)
4. Actions → **Promote / Rollback Workers API** → `promote` + `production` → goes live
5. If broken: same workflow → `rollback` + `production` → instant revert

### Alpha

Manual only. Actions → **Deploy API** → `workflow_dispatch` → `environment: alpha`.

## DNS

Both `preprod` and `alpha` A records point to `192.0.2.1` (placeholder) with Cloudflare proxy enabled. The Worker route intercepts all requests before they reach the origin.

## IP access

`preprod.ridgetocoast.com` and `alpha.ridgetocoast.com` are restricted to allowlisted IPs via Cloudflare Zero Trust Access. Configure in: Cloudflare dashboard → Zero Trust → Access → Applications.

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `test.yml` | Every push + PR | Node 20/22 unit tests + Python Playwright E2E |
| `deploy-pages.yml` | Push to `main` (`app/**`) | Deploys frontend to Cloudflare Pages |
| `deploy-workers.yml` | Push to `main` or PR (`workers/**`, `wrangler.toml`) | Stages production version; deploys preview/alpha directly |
| `promote-workers.yml` | Manual (`workflow_dispatch`) | Promotes staged version live or rolls back |
| `update-epa-regions.yml` | Manual (`workflow_dispatch`) | Fetches fresh EPA ecoregion data and commits `regions.geojson` |
