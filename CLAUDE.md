# Ridge to Coast — Agent Instructions

Interactive ecological map of the eastern US corridor (Ridge to Coast). Helps residents understand their land and act on it — planting windows, frost risk, native plants, streamflow.

---

## Architecture

| Layer | Tech | Path |
|---|---|---|
| Frontend | Leaflet 1.9.4, zero npm | `app/` |
| API | Cloudflare Workers | `workers/` |
| Data | GeoJSON (EPA ecoregions, USDA hardiness) | `app/data/` |
| Geo helpers | Pure JS, no DOM/Leaflet dependency | `app/lib/geo-data.js` |
| Unit tests | Node built-in `node:test`, zero npm | `app/tests/geo.test.js` |
| E2E tests | Python Playwright + pytest | `app/tests/e2e/` |
| Infra | Terraform (Cloudflare, GitHub, time providers) | `infra/terraform/` |

---

## Environments

| Env | Frontend | API | Deploy trigger |
|---|---|---|---|
| Production | `ridgetocoast.com` | `api.ridgetocoast.com` | Push to `main` → stage → manual promote |
| Preprod | `*.ridgetocoast.pages.dev` | `preprod.ridgetocoast.com` | PR against `main` |
| Alpha | manual | `alpha.ridgetocoast.com` | `workflow_dispatch` |

**Deploy flow:**
1. Push to `main` → `deploy-workers.yml` runs `wrangler versions upload --env production` (staged, not live)
2. Verify on `preprod.ridgetocoast.com`
3. Actions → **Promote / Rollback Workers API** → `promote` + `production` → goes live
4. Rollback: same workflow → `rollback` + `production`

---

## Key Commands

```bash
# Local full stack — app/ on :8000, /v1/* proxied to wrangler dev on :8787.
# Single origin, so CSP connect-src 'self' covers the API and there is no CORS.
./scripts/dev.sh
./scripts/dev.sh --no-api        # frontend only

# Unit tests (335 tests, 0 npm)
node --test app/tests/geo.test.js

# Workers unit tests
node --test workers/tests/

# E2E tests (requires server + Playwright)
node scripts/dev-server.mjs --port=8000 --no-api &
python -m pytest app/tests/e2e/ --base-url http://localhost:8000 -v

# Regenerate region data (manual — EPA API)
# Actions → "Update EPA Ecoregions" → Run workflow

# Deploy Workers to alpha manually
# Actions → "Deploy API" → workflow_dispatch → environment: alpha
```

---

## Multi-Agent Model Assignments

| Role | Model | GitHub label |
|---|---|---|
| Planner / researcher | `claude-haiku-4-5-20251001` | `agent:plan` |
| Architect / senior review | `claude-opus-4-7` | `agent:architect` |
| Hard implementation | `claude-opus-4-7` | `agent:implement-hard` |
| Standard implementation | `claude-sonnet-4-6` | `agent:implement` |
| Design / docs | `claude-sonnet-4-6` | `agent:design` |

No Anthropic API key. Multi-agent runs locally via Claude Code CLI. AWS Bedrock is the upgrade path.

---

## Conventions

- **Zero npm** — no package.json, no node_modules, ever. Node built-ins only.
- **No CDN** — Leaflet vendored at `app/lib/`. All assets same-origin.
- **`haversineKm([lon, lat], [lon, lat])`** — longitude-first (GeoJSON convention).
- **`API_BASE`** in `map.js` — use for all Workers API calls. Do not hardcode `api.ridgetocoast.com`.
- **Workers handlers** take `(request)` not `(params)` — needed for `caches.default` in fetch handlers.
- **Worktrees** — always branch off `main`; use `/tmp/<feature-name>` worktree.
- **Tests first** — unit test new geo helpers in `geo.test.js` before wiring into `map.js`.
- **Commit granularity** — one logical change per commit; don't batch unrelated changes.

---

## GitHub Secrets — environment-scoped (Terraform-managed)

`infra/terraform/` is the source of truth for Cloudflare config and CI tokens.
`terraform plan` is the config-drift gate (weekly `infra.yml` run; red = drift).

Each GitHub Environment exposes a single secret `CLOUDFLARE_API_TOKEN`; GitHub
resolves the per-environment value at run time:

| GH Environment | `CLOUDFLARE_API_TOKEN` source (Terraform) | Branch policy |
|---|---|---|
| `production` | `production-deploy` token (Workers+Pages write) | `main` only |
| `preview` | `nonprod-deploy` token (Workers write) | none |
| `alpha` | `nonprod-deploy` token (Workers write) | none |
| `audit` | `audit-readonly` token (read-only) | none |
| `infra` | bootstrap creds, entered by hand (CF bootstrap token, GitHub PAT, R2 S3 keys) | `main` only |

Tokens are account-owned and auto-rotate every 90 days with a 7-day overlap.
The Cloudflare account id is read from `wrangler.toml` (not a secret). The old
repo-level `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_PREVIEW_API_TOKEN`, and
`CLOUDFLARE_ACCOUNT_ID` are retired by the Terraform apply — the workflows that
still reference them must migrate to the environment-scoped secret in lockstep
(pipeline sub-project). See `infra/terraform/README.md`.

---

## MVP Status

- [x] Ecological map — 10 regions, 51 cities, fall line, rivers, hardiness zones
- [x] Seasonal Intelligence Card — NWS frost, iNaturalist observations, USGS streamflow
- [x] Smart initial view — geolocation → nearest city, fallback corridor windows
- [x] Hardiness pre-fetch — cache on load, no spinner on toggle
- [x] Mobile drag guard — no accidental navigation on pan
- [x] Cloudflare Pages + ridgetocoast.com
- [x] Dev/prod split — preprod + alpha envs, blue-green production deploy
- [ ] Workers API — `/v1/ecoregion`, `/v1/calendar`, `/v1/plants`, `/v1/gardens` (currently stubs)
- [ ] Frontend wired to Workers API via `API_BASE`
