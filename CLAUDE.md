# Ridge to Coast — Monorepo

## Current Session Handoff

- The current plan snapshot lives in `docs/session-handoff.md`.
- The repo is stable at the live map stage; next work should follow the Phase 3 platform roadmap.
- Keep the zero-dependency frontend rules intact when changing anything in `app/`.

**Live site:** https://ridgetocoast.com  
**API:** https://api.ridgetocoast.com  
**Org:** https://github.com/ridgetocoast

## Repo Layout

| Directory | Contents |
|-----------|---------|
| `app/` | Frontend — Leaflet map, static site (Cloudflare Pages) |
| `workers/` | REST API — Cloudflare Workers (P3 endpoints) |
| `api/` | OpenAPI spec (`openapi.yaml`) |
| `infra/terraform/` | Cloudflare infrastructure as code |
| `.github/workflows/` | CI/CD: tests, Pages deploy, Workers deploy, EPA pipeline |

## Multi-Agent Roles

| Role | Model | Label |
|------|-------|-------|
| Planner | `claude-haiku-4-5-20251001` | `agent:plan` |
| Architect | `claude-opus-4-7` | `agent:architect` |
| Senior Engineer | `claude-opus-4-7` | `agent:implement-hard` |
| Engineer | `claude-sonnet-4-6` | `agent:implement` |
| Designer | `claude-sonnet-4-6` | `agent:design` |

Role prompts: `app/.claude/agents/`  
Worktree branch naming: `claude/issue-{number}-{slug}`

## Frontend (`app/`)

See `app/CLAUDE.md` for full frontend conventions:
- Zero npm dependencies for core app
- CSP locked in `app/index.html` meta tag
- Tests: `node --test app/tests/geo.test.js` (308 unit) + `pytest app/tests/e2e/` (85 E2E)

## Workers (`workers/`)

- Entry point: `workers/index.js` — routes to individual handlers
- Each handler exports `async function handle*(params) → Response`
- CORS headers applied at the router level
- No npm dependencies — Workers runtime only
- Deploy: `wrangler deploy --env production`

## Infrastructure (`infra/terraform/`)

- Provider: Cloudflare (`cloudflare/cloudflare ~> 4.0`)
- Required vars: `cloudflare_account_id`, `cloudflare_zone_id`
- Required env: `CLOUDFLARE_API_TOKEN`
- `pages.tf` — Cloudflare Pages project + custom domain
- `workers.tf` — DNS routing for `api.ridgetocoast.com`
- `r2.tf` — Object storage for P4 institutional layers

## GitHub Secrets Required

| Secret | Used by |
|--------|--------|
| `CLOUDFLARE_API_TOKEN` | Pages deploy, Workers deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Pages deploy, Workers deploy |

## Deployment

- **Frontend:** push to `main` with changes in `app/` → auto-deploys to Cloudflare Pages
- **Workers:** push to `main` with changes in `workers/` → auto-deploys via Wrangler
- **Infra changes:** run `terraform apply` locally (state will move to R2 once bucket is set up)
