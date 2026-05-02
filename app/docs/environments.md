# Environments

| Environment | Frontend | API | Deploy trigger |
|---|---|---|---|
| **Production** | [ridgetocoast.com](https://ridgetocoast.com) | [api.ridgetocoast.com](https://api.ridgetocoast.com) | Push to `main` (staged via `versions upload`; promote manually) |
| **Preprod** | `<hash>.ridgetocoast.pages.dev` (PR previews) | [preprod.ridgetocoast.com](https://preprod.ridgetocoast.com) | PR against `main` |
| **Alpha** | `<hash>.ridgetocoast.pages.dev` (manual) | [alpha.ridgetocoast.com](https://alpha.ridgetocoast.com) | `workflow_dispatch` on "Deploy API" → `alpha` |

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
