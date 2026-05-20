# Cloudflare Infra as Code — Terraform Foundation (Sub-project 1) — Design

**Status:** Draft
**Date:** 2026-05-18
**Scope:** `infra/terraform/` becomes the source of truth for Cloudflare account config and the producer of scoped, auto-rotating CI tokens distributed to GitHub Environments. This is **Sub-project 1 of 2**. Sub-project 2 — the orchestrated release/smoke pipeline that *consumes* these tokens — is a separate spec and is explicitly out of scope here.

---

## 1. Summary

Today the deploy pipeline authenticates with a single broad `CLOUDFLARE_API_TOKEN` repo secret (plus a recently-added `CLOUDFLARE_PREVIEW_API_TOKEN` and a redundant `CLOUDFLARE_ACCOUNT_ID`), all created by hand in the Cloudflare dashboard, never rotated, and powerful enough to touch every environment. Cloudflare DNS/routes/Pages/TLS config drifts silently from intent because nothing reconciles it. The `infra/terraform/` directory already exists (provider `~> 5`, manages R2/DNS/Pages, R2 state backend stubbed but unused).

This sub-project makes `infra/terraform/` the authoritative producer of:

1. Three least-privilege **`cloudflare_account_token`** resources (production-deploy, nonprod-deploy, audit-readonly), each auto-rotating on a 90-day cycle with a 7-day no-gap overlap.
2. The **GitHub Environments** (`production`, `preview`, `alpha`, `audit`, `infra`) and the `CLOUDFLARE_API_TOKEN` environment secret in each, pushed directly by the `integrations/github` provider.
3. **DNS / Total TLS / account-DNS-settings** as managed resources, so `terraform plan` is the config-drift detector.

`terraform plan -detailed-exitcode` replaces the bespoke drift script for everything Terraform owns. Worker *script* deploys remain Wrangler-driven; Terraform owns routing, DNS, TLS, tokens, and the GitHub secret surface only.

---

## 2. Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Overall scope | Decompose into 2 sub-projects; this spec is infra only. Pipeline is a later spec consuming this one's outputs. |
| 2 | Token primitive | `cloudflare_account_token` (account-owned), not `cloudflare_api_token` (user-owned) — survives operator change, account-scoped. |
| 3 | Token granularity | 3 tokens: `production-deploy`, `nonprod-deploy` (preview+alpha), `audit-readonly`. Prod isolated; non-prod may share where Cloudflare can't scope a route per-subdomain. |
| 4 | Permission-group IDs | Resolved via the provider's account permission-groups data source, never hardcoded hex IDs. |
| 5 | Secret distribution | `integrations/github` provider writes `github_actions_environment_secret` directly on apply. Fully IaC, no manual copy. |
| 6 | One secret name | All environments expose `CLOUDFLARE_API_TOKEN`; GitHub resolves the per-environment value at run time. Retires `CLOUDFLARE_PREVIEW_API_TOKEN`. |
| 7 | Account id | Not a secret. Read from `wrangler.toml` (already plaintext). `CLOUDFLARE_ACCOUNT_ID` secret dropped. |
| 8 | Rotation cadence | 90-day `time_rotating`, 7-day create-before-destroy overlap so CI never sees an expired token mid-rotation. |
| 9 | Apply model | Scheduled weekly `plan` (red on drift) + targeted auto-`apply` limited to token/secret/time resources. DNS/TLS/Pages/account changes are manual `workflow_dispatch` apply only. |
| 10 | State backend | R2 (S3-compatible) is now **mandatory** — token values live in state. `use_lockfile = true` (native, no DynamoDB). |
| 11 | Adoption of live resources | `import {}` blocks (TF ≥1.5) adopt pre-existing DNS/Pages/R2. First real plan must show **zero destroys** of these. |
| 12 | Total TLS authority | `certificate_authority = "google"`, `enabled = true`. Per-hostname certs; no wildcard. |
| 13 | Bootstrap creds | CF bootstrap token + GitHub PAT/App + R2 S3 keys created manually once, never TF-managed, manual ~annual rotation. |
| 14 | Reviewer gates | None (solo maintainer). `production`/`infra` environments restricted to branch `main`; that branch rule + the manual-apply path are the guard. |
| 15 | Audit script | `terraform plan` is now the config-drift gate. Re-scoping `audit-cloudflare-config.mjs` to runtime-only facts is Sub-project 2's task; untouched and not deleted here. |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ infra/terraform/  (Terraform ≥1.11, providers: cloudflare ~>5,  │
│                    integrations/github ~>6, hashicorp/time ~>0.12)│
│                                                                  │
│  bootstrap creds (manual, never TF-managed):                     │
│    CF bootstrap token · GitHub PAT/App · R2 S3 access keys       │
│                          │                                       │
│                          ▼                                       │
│  cloudflare_account_token ×3  ──┐   time_rotating (90d)          │
│  cloudflare_dns_record ×4       │   cloudflare_total_tls          │
│  cloudflare_account_dns_settings│   cloudflare_pages_* · r2_*     │
│                                 ▼                                 │
│  github_repository_environment ×5                                │
│  github_actions_environment_secret  (CLOUDFLARE_API_TOKEN)       │
└──────────────────────────────┬──────────────────────────────────┘
                               │  CONTRACT = GH Environment secret names
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ Sub-project 2 (later, separate spec): release/smoke pipeline.    │
│ Pure consumer. Reads CLOUDFLARE_API_TOKEN per environment.       │
└─────────────────────────────────────────────────────────────────┘
```

**File layout** (`infra/terraform/`):

| File | State | Purpose |
|---|---|---|
| `main.tf` | modify | Providers (`cloudflare`, `integrations/github`, `hashicorp/time`); R2 backend uncommented + `use_lockfile = true`; variables (bootstrap CF token, GitHub token, R2 S3 keys) |
| `tokens.tf` | new | 3 `cloudflare_account_token` + `time_rotating` + permission-group data sources |
| `github.tf` | new | 5 `github_repository_environment` + `github_actions_environment_secret` |
| `dns.tf` | new (absorbs DNS from `workers.tf`/`pages.tf`) | `cloudflare_dns_record` (api/www/preprod/alpha) + `cloudflare_account_dns_settings` |
| `tls.tf` | new | `cloudflare_total_tls` |
| `imports.tf` | new, **deleted after first successful apply** | `import {}` blocks adopting pre-existing live resources |
| `pages.tf`, `r2.tf`, `workers.tf` | keep/trim | Pages project/domains, R2 buckets, Worker route (DNS extracted to `dns.tf`) |
| `terraform.tfvars.example` | update | Bootstrap CF token, GitHub PAT, R2 S3 keys; account/zone ids stay |
| `README.md` | new | Bootstrap runbook, rotation behavior, "plan is the drift gate", manual annual bootstrap-cred rotation |

---

## 4. Tokens & rotation (no-gap guarantee)

Three account-owned tokens. Permission groups are resolved by name through the provider's account permission-groups data source (exact data-source name to be confirmed in the implementation plan against `cloudflare ~> 5`) — never hardcoded hex IDs.

| Token | Permission groups | → GH env |
|---|---|---|
| `production-deploy` | Workers Scripts:Edit · Workers Routes:Edit · Pages:Edit | `production` |
| `nonprod-deploy` | Workers Scripts:Edit · Workers Routes:Edit | `preview`, `alpha` |
| `audit-readonly` | DNS:Read · Workers Routes:Read · Workers Scripts:Read · Pages:Read | `audit` |

Schema basis (verified from `cloudflare/terraform-provider-cloudflare` v5 docs): `cloudflare_account_token` requires `account_id`, `name`, `policies[] = { effect, permission_groups[] = { id }, resources }`; optional `condition.request_ip.{in,not_in}`, `expires_on`, `not_before`, `status`; exports sensitive `value`.

**Rotation mechanics:**

- One `time_rotating` resource, `rotation_days = 90`.
- Each token sets `not_before = time_static(now)` and `expires_on = timeadd(rotation_rfc3339, "168h")` — i.e. the 90-day boundary **plus a 7-day overlap**.
- `lifecycle { create_before_destroy = true }` on each token: at the boundary the new token is created (new `value`), the `github_actions_environment_secret` updates to the new value, and only then is the old token destroyed. CI never reads an expired or absent secret.
- `replace_triggered_by = [time_rotating.tokens]` forces recreation exactly at the boundary; between boundaries `time_rotating` is inert so plans are clean.

**Hard requirement:** the 7-day overlap is not optional. A destroy-before-create or zero-overlap configuration is a spec violation — it strands CI mid-rotation.

---

## 5. GitHub Environments & secret distribution

`integrations/github` provider (authenticated by the bootstrap GitHub PAT/App):

- **`github_repository_environment` ×5**: `production`, `preview`, `alpha`, `audit`, `infra`.
  - `production` and `infra`: deployment branch policy restricted to `main` (custom branch policy, pattern `main`). No required reviewers (solo).
  - `preview`, `alpha`, `audit`: no branch restriction.
- **`github_actions_environment_secret`**: one secret name `CLOUDFLARE_API_TOKEN`, value per environment:

| GH Environment | `CLOUDFLARE_API_TOKEN` value |
|---|---|
| `production` | `production-deploy` token `value` |
| `preview` | `nonprod-deploy` token `value` |
| `alpha` | `nonprod-deploy` token `value` |
| `audit` | `audit-readonly` token `value` |

The `infra` environment additionally holds the three **bootstrap** creds (CF bootstrap token, GitHub PAT/App, R2 S3 keys) for the scheduled workflow — these are entered by hand into that environment, **not** written by Terraform (Terraform cannot bootstrap its own root of trust).

---

## 6. Bootstrap root-of-trust (the irreducible chicken/egg)

Three credentials are created **manually, once**, and are never Terraform-managed:

1. **CF bootstrap token** — Account *API Tokens:Edit* plus the edit scopes of everything TF manages (DNS, Pages, Workers, R2, Account DNS Settings).
2. **GitHub PAT/App** — repo Administration + Actions Secrets read/write.
3. **R2 S3 access key/secret** — for the state backend.

They live in gitignored `terraform.tfvars` for the local operator and in the protected `infra` GitHub Environment for the scheduled workflow. The CF bootstrap token cannot rotate itself (it is the key that makes keys); the README mandates a documented manual ~annual rotation of all three, explicitly outside the automated 90-day cycle.

---

## 7. DNS / TLS / account resources + import strategy

- **`cloudflare_dns_record`**: keep `api`, `www`; add proxied `preprod` and `alpha` records mirroring the `api` record's pattern so their Worker routes resolve. (Exact `content` target for `preprod`/`alpha` mirrors the live `api` record — confirmed against the zone during implementation.)
- **`cloudflare_total_tls`**: `zone_id`, `enabled = true`, `certificate_authority = "google"` — per-hostname certs for `api`/`preprod`/`alpha`, no wildcard. Schema: required `zone_id`, `enabled`; optional `certificate_authority ∈ {google, lets_encrypt, ssl_com}`.
- **`cloudflare_account_dns_settings`**: pin a known-good baseline — `enforce_dns_only = false`, `zone_defaults.nameservers.type = "cloudflare.standard"`, `zone_defaults.zone_mode = "standard"`. A drift baseline above the zone; low churn.
- **Import (adopt, never recreate) — hard requirement:** the live `api`/`www` DNS records, the Pages project + apex/www domains, and the R2 `layers` bucket already exist (state was never persisted to R2). `imports.tf` carries `import {}` blocks (TF ≥1.5) so the first apply adopts them. The first real `terraform plan` **must show zero destroys** of DNS/Pages/R2 resources. Any destroy (Pages recreation = site outage) halts the rollout until the import is corrected. The README lists each resource's import-id source.

---

## 8. `.github/workflows/infra.yml`

| Trigger | Job |
|---|---|
| PR touching `infra/terraform/**` | `terraform fmt -check` + `terraform validate`. No credentials. (Pre-merge live `plan` deliberately excluded — would need a non-branch-restricted read environment + a 4th bootstrap cred; YAGNI for solo.) |
| Schedule (weekly cron), `infra` env | (a) `terraform plan -detailed-exitcode` — exit 2 (drift) fails the run red = the drift notification. (b) Targeted rotation apply: `terraform apply` scoped via `-target` to `time_rotating.tokens`, `cloudflare_account_token.*`, `github_actions_environment_secret.*` only. Inert except at the 90-day boundary; never touches DNS/TLS/Pages/account. |
| `workflow_dispatch` (`action: plan\|apply`), `infra` env | Full `terraform plan` or `apply` — the human-triggered path for DNS/TLS/account/import changes after reading the plan. |

`concurrency` group + R2 `use_lockfile` prevent overlapping or torn applies.

---

## 9. Verification & first-apply protocol

No unit tests (Terraform). CI gates: `terraform fmt -check`, `terraform validate` (optional `tflint` as a CI-only Go binary, not a repo dependency).

**First-apply runbook (documented in `infra/terraform/README.md`):**

1. Manually create: R2 `ridgetocoast-tfstate` bucket, R2 S3 access key/secret, CF bootstrap token, GitHub PAT/App.
2. Populate gitignored `terraform.tfvars` and the `infra` GitHub Environment with those creds.
3. `terraform init -migrate-state` (local → R2 backend).
4. `terraform plan` — **human-reviewed; assert zero destroys of DNS/Pages/R2**. Stop if any appear.
5. `terraform apply`.
6. Confirm every GitHub Environment and its `CLOUDFLARE_API_TOKEN` secret exists.
7. Smoke a preview deploy to prove CI still authenticates with the new token.
8. Delete `imports.tf` and commit (imports are one-shot).

**Rollback:** the create-before-destroy + 7-day overlap (§4) is the rotation safety net. For a bad apply, revert the commit and re-apply; the previous token remains valid through the overlap window.

---

## 10. Documentation changes

- **New** `infra/terraform/README.md`: bootstrap runbook, rotation behavior, "plan is the drift gate", manual ~annual bootstrap-cred rotation, per-resource import-id sources.
- **`CLAUDE.md`** (root): rewrite "GitHub Secrets Required" to the environment-scoped model; add an `infra/` row to the architecture table; note Terraform owns CF config and `plan` is the drift gate.
- **`docs/session-handoff.md`**: record this spec, the §11 interface contract, and that Sub-project 2 is the consumer.

---

## 11. Interface contract → Sub-project 2 (the pipeline)

Sub-project 2 may assume, and must align with, exactly this:

- GitHub Environments exist: `production` (branch policy = `main`), `preview`, `alpha`, `audit` — each exposing secret `CLOUDFLARE_API_TOKEN`.
- Cloudflare account id is read from `wrangler.toml`, **not** a secret.
- Repo-level `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_PREVIEW_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID` are **deleted by this sub-project's apply**. The pipeline PR that switches workflows to environment-scoped secrets must merge in lockstep with this sub-project's apply. **This ordering coupling is the top integration risk** — surfaced here so Sub-project 2's plan sequences around it.
- Re-scoping `scripts/audit-cloudflare-config.mjs` to runtime-only facts (deployed Worker version, Pages deployment health) is Sub-project 2's task.

---

## 12. Out of scope (YAGNI)

Terraform Cloud; DynamoDB state lock (native R2 lockfile used); required-reviewer gates (solo); pre-merge live `plan`; Worker *script* deploys (stay Wrangler-driven — TF owns routing/DNS/TLS/config/tokens only); the release/smoke pipeline (Sub-project 2); auditing runtime facts (Sub-project 2).

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| First apply plans a destroy of the live Pages project / DNS | Mandatory human-reviewed plan gate (§9 step 4); `import {}` blocks; hard "zero destroys" rule |
| Token rotation strands CI mid-cycle | Create-before-destroy + 7-day overlap (§4), stated as non-optional |
| tfstate now holds secret token values | R2 backend mandatory before any token resource is applied (§3, Decision 10) |
| Bootstrap creds compromised | Least-scope where possible; documented manual ~annual rotation; bootstrap creds isolated to the branch-restricted `infra` environment |
| Secrets migration desyncs from the pipeline | §11 lockstep ordering called out as the top integration risk for Sub-project 2 |
| Provider v5 schema details (permission-group data source name, exact DNS `content` targets) | Verified resource schemas from upstream v5 docs; remaining specifics flagged for confirmation in the implementation plan |
