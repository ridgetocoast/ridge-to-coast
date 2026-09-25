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
# App unit tests (379 tests: geo + pipeline + sw) — glob form; a bare dir arg
# fails on Node 22+, and the glob picks up new test files automatically
node --test app/tests/*.test.js

# Workers unit tests (29 tests)
node --test workers/tests/*.test.js

# E2E tests (96 tests). One-time setup:
#   uv venv .venv --python 3.12
#   uv pip install --python .venv/bin/python -r app/tests/e2e/requirements.txt
#   .venv/bin/playwright install chromium
# Note --directory app: without it every page.goto("/") 404s. --base-url is
# mandatory too; there is no addopts default.
python3 -m http.server 8000 --directory app &
.venv/bin/python -m pytest app/tests/e2e/ --base-url http://localhost:8000 -v

# Smoke-test a deployed environment (also runs in CI after every live deploy)
./scripts/smoke-api.sh https://api.ridgetocoast.com

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
- **Remotes** — `upstream` = `ridgetocoast/ridge-to-coast` (issues and PRs live here);
  `origin` = personal fork with issues **disabled**. A bare `gh issue list` resolves
  to the fork and returns empty instead of erroring — always pass `--repo`.
- **Worktrees** — branch off `upstream/main`, not local `main` (which lags behind);
  use `/tmp/<feature-name>` worktree.
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
The Cloudflare account id is read from `wrangler.toml` (not a secret).

**Migration complete.** Every Cloudflare-touching workflow now references only
`secrets.CLOUDFLARE_API_TOKEN` under an explicit `environment:`. The old
repo-level `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_PREVIEW_API_TOKEN`, and
`CLOUDFLARE_ACCOUNT_ID` are retired and must not be reintroduced — a workflow
referencing them will silently resolve to an empty string. See
`infra/terraform/README.md`.

> **The `infra` environment's four secrets are not set.** `CLOUDFLARE_BOOTSTRAP_TOKEN`,
> `GH_INFRA_TOKEN`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are entered by
> hand — Terraform cannot issue the credential it needs to authenticate itself.
> Until they are, the weekly drift gate cannot run and no `terraform apply` has
> succeeded (`imports.tf` still holds unfilled placeholders). The first-apply
> runbook is in `infra/terraform/README.md` §"First-apply runbook".

---

## MVP Status

- [x] Ecological map — 10 regions, 51 cities, fall line, rivers, hardiness zones
- [x] Seasonal Intelligence Card — NWS frost, iNaturalist observations, USGS streamflow
- [x] Smart initial view — geolocation → nearest city, fallback corridor windows
- [x] Hardiness pre-fetch — cache on load, no spinner on toggle
- [x] Mobile drag guard — no accidental navigation on pan
- [x] Cloudflare Pages + ridgetocoast.com
- [x] Dev/prod split — preprod + alpha envs, blue-green production deploy
- [x] Workers API — `/v1/ecoregion`, `/v1/calendar`, `/v1/plants`, `/v1/gardens` implemented
- [ ] Frontend wired to Workers API via `API_BASE` — gardens done (`map.js`); ecoregion/calendar/plants still read bundled data

### Release gates (added 2026-09-20)

- [x] Deploys gate on a green suite — `test.yml` is `workflow_call`; deploy jobs `needs:` it
- [x] Post-deploy smoke checks — `scripts/smoke-api.sh` on preview/alpha/promote/rollback
- [x] `pull_request_target` preview deploy gated to OWNER/MEMBER/COLLABORATOR
- [x] Config audit wired to the `audit` environment (`audit-config.yml`, weekly)
- [ ] **Cloudflare bot challenge on `api.ridgetocoast.com`** — cause unconfirmed. The
  zone is on the **Free plan**: if Bot Fight Mode is the source, no WAF rule can
  exempt a hostname and it must be switched off. `waf.tf` helps only if the cause
  is Security Level or managed rules. Diagnostic: T1/T2 runbook, RB-01 Step 2
- [ ] **Terraform `infra` secrets** — must be entered by hand before the drift gate runs

---

## Agent skills

### Issue tracker

GitHub Issues on `ridgetocoast/ridge-to-coast` — always pass `--repo`, the
`origin` fork has issues disabled. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, default names. Distinct from the `agent:*` routing
labels above. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at the repo root. See
`docs/agents/domain.md`.
