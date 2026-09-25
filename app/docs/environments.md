# Environments

| Environment | Frontend | API | Deploy trigger |
|---|---|---|---|
| **Production** | [ridgetocoast.com](https://ridgetocoast.com) | [api.ridgetocoast.com](https://api.ridgetocoast.com) | Push to `main` (staged via `versions upload`; promote manually) |
| **Preprod** | `<hash>.ridgetocoast.pages.dev` (PR previews) | [preprod.ridgetocoast.com](https://preprod.ridgetocoast.com) | PR against `main` via the `preview`-environment deploy token |
| **Alpha** | `<hash>.ridgetocoast.pages.dev` (manual) | [alpha.ridgetocoast.com](https://alpha.ridgetocoast.com) | `workflow_dispatch` on "Deploy API" → `alpha` |

## Deploy flow

### Shipping to production

1. Open a PR → `deploy-workers-preview.yml` deploys the API to `preprod.ridgetocoast.com` with the `preview`-environment Cloudflare token
2. Verify on preprod
3. Merge PR to `main` → `deploy-workers.yml` stages the new Workers version (not live yet)
4. Actions → **Promote / Rollback Workers API** → `promote` + `production` → goes live
5. If broken: same workflow → `rollback` + `production` → instant revert

### Alpha

Manual only. Actions → **Deploy API** → `workflow_dispatch` → `environment: alpha`.

## GitHub environment secrets

Each GitHub Environment exposes a single secret named `CLOUDFLARE_API_TOKEN`; GitHub resolves the per-environment value at run time (Terraform-managed, see `infra/terraform/tokens.tf` and `infra/terraform/github.tf`):

| GH Environment | `CLOUDFLARE_API_TOKEN` source | Purpose |
|---|---|---|
| `production` | `production-deploy` token (Workers Scripts/Routes Write + Pages Write) | Production staging/promote/rollback + Pages deploy |
| `preview` | `nonprod-deploy` token (Workers Scripts/Routes Write) | PR preview deploys to `preprod.ridgetocoast.com` (both `deploy-workers.yml`'s `deploy-preview` job and `deploy-workers-preview.yml` share this token) |
| `alpha` | `nonprod-deploy` token (same value as `preview`) | Manual alpha deploys |
| `audit` | `audit-readonly` token (read-only + zone-scoped DNS Read) | Config drift auditing |

Tokens are account-owned and auto-rotate every 90 days with a 7-day overlap. The Cloudflare account id is read from `wrangler.toml`'s top-level `account_id` (inherited by all named environments) — it is not a secret.

## DNS

`api`, `preprod` and `alpha` are **CNAME** records (not A records) pointing at `ridgetocoast-api.loboedwin01.workers.dev`, proxied through Cloudflare — see `infra/terraform/dns.tf`. That target does not resolve to a deployed script, but it is inert: the Worker route intercepts every request before origin resolution. `www` is a proxied CNAME to the apex.

## IP access

`preprod.ridgetocoast.com` and `alpha.ridgetocoast.com` are restricted to allowlisted IPs via Cloudflare Zero Trust Access. Configure in: Cloudflare dashboard → Zero Trust → Access → Applications.

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `test.yml` | Every push + PR | Node 20/22 unit tests + Python Playwright E2E |
| `deploy-pages.yml` | Push to `main` (`app/**`) | Deploys frontend to Cloudflare Pages |
| `deploy-workers-preview.yml` | PR against `main` (`workers/**`, shared Worker geo core) | Deploys PR source to preprod with a fixed Wrangler config and preview-only token |
| `deploy-workers.yml` | Push to `main` or manual dispatch (`workers/**`, shared Worker geo core, `wrangler.toml`) | Stages production version; deploys preview/alpha manually |
| `promote-workers.yml` | Manual (`workflow_dispatch`) | Promotes staged version live or rolls back |
| `update-epa-regions.yml` | Manual (`workflow_dispatch`) | Fetches fresh EPA ecoregion data and commits `regions.geojson` |
