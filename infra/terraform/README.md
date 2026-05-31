# infra/terraform — Cloudflare Infrastructure as Code

Terraform is the source of truth for Cloudflare account config (DNS, Total TLS,
account DNS settings), the 3 rotating CI tokens, and the 5 GitHub Environments +
their `CLOUDFLARE_API_TOKEN` secret. **`terraform plan` is the config-drift
gate** — a non-empty plan on the weekly run means live config drifted from
intent. Worker *script* deploys stay Wrangler-driven; Terraform owns
routing/DNS/TLS/config/tokens only.

## Bootstrap root-of-trust (manual, never TF-managed — spec §6)

Three credentials are created **by hand, once**, and rotated manually ~annually
(outside the automated 90-day token cycle — they are the keys that make keys):

1. **CF bootstrap token** — Account *API Tokens:Edit* + Edit scope of every
   TF-managed resource (DNS, Pages, Workers, R2, Account DNS Settings).
2. **GitHub PAT/App** — repo Administration RW + Actions Secrets RW + Environments RW.
3. **R2 S3 access key/secret** — for the state backend.

They live in gitignored `terraform.tfvars` (local operator) **and** in the
branch-restricted `infra` GitHub Environment (scheduled workflow) — entered by
hand, never written by Terraform.

## First-apply runbook (spec §9)

1. Manually create: R2 `ridgetocoast-tfstate` bucket; an R2 S3 access
   key/secret; the CF bootstrap token; the GitHub PAT/App.
2. Populate gitignored `terraform.tfvars` (see `terraform.tfvars.example`) and
   the `infra` GitHub Environment with those creds.
3. Resolve the two non-deterministic DNS import ids in `imports.tf`:
   ```bash
   for fqdn in api.ridgetocoast.com www.ridgetocoast.com; do
     curl -s -H "Authorization: Bearer $CF_BOOTSTRAP_TOKEN" \
       "https://api.cloudflare.com/client/v4/zones/77d12978a2a1395b87a12be147f3b5e9/dns_records?name=$fqdn" \
       | jq -r --arg f "$fqdn" '.result[0].id + "  <- " + $f'
   done
   ```
   Replace `REPLACE_WITH_API_RECORD_ID` / `REPLACE_WITH_WWW_RECORD_ID` in
   `imports.tf` with the returned ids.
4. Init the R2 backend (local → R2):
   ```bash
   terraform init -migrate-state \
     -backend-config="access_key=$R2_ACCESS_KEY_ID" \
     -backend-config="secret_key=$R2_SECRET_ACCESS_KEY"
   ```
5. `terraform plan` — **human-reviewed. Assert ZERO destroys of DNS / Pages /
   R2.** Any destroy (Pages recreation = site outage) halts the rollout until
   the import is corrected.
6. `terraform apply`.
7. Confirm every GitHub Environment (`production`, `preview`, `alpha`, `audit`,
   `infra`) and its `CLOUDFLARE_API_TOKEN` secret exists (the `infra` env's
   secret is the bootstrap set, entered by hand — not TF-written).
8. Smoke a preview deploy to prove CI authenticates with the new token.
9. **Delete `imports.tf` and commit** — imports are one-shot.

## Token rotation (no-gap guarantee — spec §4)

One `time_rotating` (90 days). Each token: `not_before` = creation instant,
`expires_on` = 90-day boundary **+ 168h (7-day overlap)**.
`lifecycle { create_before_destroy = true, replace_triggered_by =
[time_rotating.tokens] }` — at the boundary the new token is created, the
`CLOUDFLARE_API_TOKEN` secret updates to the new value, *then* the old token is
destroyed. CI never reads an expired/absent secret. Between boundaries
`time_rotating` is inert so plans stay clean. **The 7-day overlap is not
optional** — a zero-overlap config strands CI mid-rotation.

## Per-resource import-id sources (imports.tf)

| Resource | Import id | Source |
|---|---|---|
| `cloudflare_dns_record.api` | `<zone_id>/<record_id>` | `curl` above (non-deterministic) |
| `cloudflare_dns_record.www` | `<zone_id>/<record_id>` | `curl` above (non-deterministic) |
| `cloudflare_pages_project.frontend` | `<account_id>/ridgetocoast` | deterministic |
| `cloudflare_pages_domain.apex` | `<account_id>/ridgetocoast/ridgetocoast.com` | deterministic |
| `cloudflare_pages_domain.www` | `<account_id>/ridgetocoast/www.ridgetocoast.com` | deterministic |
| `cloudflare_r2_bucket.layers` | `<account_id>/ridgetocoast-layers` | deterministic |

`preprod`/`alpha` DNS records and all token/GitHub resources are **new** — no
import. The `ridgetocoast-tfstate` R2 bucket is manual and not a TF resource.

## Drift gate & rotation cadence (spec §8)

- **PR** touching `infra/terraform/**`: `terraform fmt -check` + `validate`. No creds.
- **Weekly** (`infra` env): `terraform plan -detailed-exitcode` — exit 2 (drift)
  fails the run red = the drift alert. Then a `-target`-scoped apply limited to
  `time_rotating.tokens`, `cloudflare_account_token.*`,
  `github_actions_environment_secret.*` (inert except at the 90-day boundary).
- **Manual** `workflow_dispatch` (`plan`|`apply`, `infra` env): full plan/apply
  — the human path for DNS/TLS/account/import changes after reading the plan.

## Manual ~annual bootstrap-cred rotation

The CF bootstrap token, GitHub PAT/App, and R2 S3 keys are NOT in the 90-day
cycle. Rotate by hand ~annually: create the replacement, update
`terraform.tfvars` and the `infra` GitHub Environment, verify a manual
`workflow_dispatch` plan succeeds, then revoke the old credential.
