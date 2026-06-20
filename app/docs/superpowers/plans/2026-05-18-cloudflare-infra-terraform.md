# Cloudflare Infra as Code — Terraform Foundation (Sub-project 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `infra/terraform/` the authoritative producer of 3 auto-rotating least-privilege Cloudflare CI tokens, the 5 GitHub Environments + their `CLOUDFLARE_API_TOKEN` secret, and managed DNS/TLS/account-DNS config — so `terraform plan` becomes the config-drift gate.

**Architecture:** Three `cloudflare_account_token` resources (account-owned, 90-day `time_rotating` with 7-day create-before-destroy overlap) get their `value` pushed by the `integrations/github` provider into per-environment `CLOUDFLARE_API_TOKEN` secrets. DNS records, Total TLS, and account DNS settings become managed resources adopted from the live account via one-shot `import {}` blocks (zero destroys). State moves to a mandatory R2 S3-compatible backend with native lockfile. A new `infra.yml` workflow runs fmt/validate on PRs, a weekly drift `plan` + targeted rotation `apply`, and a manual full apply.

**Tech Stack:** Terraform ≥1.11; providers `cloudflare/cloudflare ~> 5`, `integrations/github ~> 6`, `hashicorp/time ~> 0.12`; Cloudflare R2 (S3-compatible) state backend; GitHub Actions.

---

## Spec

Authoritative spec: `app/docs/superpowers/specs/2026-05-18-cloudflare-infra-terraform-design.md`. Where this plan and the spec disagree, the spec wins — except for the three **verified provider-schema corrections** below, which supersede the spec's "to be confirmed" placeholders.

### Verified provider facts (confirmed against upstream v5/v6 docs — use these verbatim)

1. **Permission-groups data source** (spec §4 left this "to be confirmed"): the resource is
   `cloudflare_account_api_token_permission_groups_list`.
   Schema: `account_id` (String, required), `name` (String, optional, **URL-encoded**), `scope` (String, optional, **URL-encoded**), `max_items` (Number, optional, default 1000).
   Read-only `result` (Attributes List), each element `{ id (String), name (String), scopes (List of String) }`.
   Filtering by `name` returns the matching group(s) (substring match — see Task 2's `one(...)` exact-name pattern for safe consumption); the raw provider attribute is `result[0].id`.

2. **`cloudflare_account_token`** (resource) confirmed schema:
   Required: `account_id` (String), `name` (String), `policies` (Attributes List) where each policy = `{ effect = "allow"|"deny", permission_groups = [{ id = <string> }], resources = <JSON string> }`.
   Optional: `condition.request_ip.{in,not_in}` (List of String), `expires_on` (String, RFC3339), `not_before` (String, RFC3339), `status` ("active"|"disabled"|"expired").
   Read-only: `id`, `value` (String, **Sensitive**), `issued_on`, `last_used_on`, `modified_on`.
   Import id form: `<account_id>/<token_id>`.

3. **`cloudflare_dns_record` v5 breaking change**: `name` now requires the **full FQDN** (not the `api` short form the current `workers.tf`/`pages.tf` use). All DNS records in this plan use FQDNs (`api.ridgetocoast.com`, `www.ridgetocoast.com`, `preprod.ridgetocoast.com`, `alpha.ridgetocoast.com`). Import id form: `<zone_id>/<record_id>`.

4. **`cloudflare_total_tls`**: Required `zone_id` (String), `enabled` (Bool). Optional `certificate_authority` ∈ {`google`,`lets_encrypt`,`ssl_com`}. Import id form: `<zone_id>`.

5. **`cloudflare_account_dns_settings`**: Optional `account_id`, `enforce_dns_only` (Bool), `zone_defaults` (Attributes). `zone_defaults.zone_mode` ∈ {`standard`,`cdn_only`,`dns_only`}; `zone_defaults.nameservers.type` ∈ {`cloudflare.standard`,`cloudflare.standard.random`,`custom.account`,`custom.tenant`}. Import id form: `<account_id>`.

6. **`github_repository_environment`**: Required `repository`, `environment`. Block `deployment_branch_policy { protected_branches (bool, required), custom_branch_policies (bool, required) }`. A `main`-only custom pattern requires `custom_branch_policies = true` **plus** a companion `github_repository_environment_deployment_policy { repository, environment, branch_pattern = "main" }`. Import id form: `<repo>:<environment>`.

7. **`github_actions_environment_secret`**: Required `repository`, `environment`, `secret_name`, `value`.

8. **`time_rotating`**: `rotation_days` (Number); exports `rotation_rfc3339` and `rfc3339`. **`time_static`**: no required args; exports `rfc3339`. `timeadd(<rfc3339>, "168h")` adds the 7-day overlap.

### Known constraints / decisions locked by this plan

- **Backends cannot interpolate `var.*`.** The currently-commented backend block in `main.tf` uses `${var.cloudflare_account_id}` and would fail. The account id (`c378aeb8ad614074b3a5e541a4788993`, not secret per Decision 7) is hardcoded in the backend `endpoints.s3` literal.
- **R2 + Terraform ≥1.11 S3 backend** requires `use_lockfile = true` (Decision 10) **and** `skip_s3_checksum = true` + `skip_requesting_account_id = true` (R2 rejects the AWS SDK default integrity checksums and the STS account-id probe). These are added alongside the spec's `skip_*`/`force_path_style` set.
- **DNS record IDs are not deterministic.** `import {}` ids for `api`/`www`/`preprod`/`alpha` are `<zone_id>/<record_id>`; `<record_id>` must be fetched from the live zone at first-apply time. `imports.tf` carries clearly-marked `REPLACE_WITH_<name>_RECORD_ID` tokens and the README documents the exact `curl` to resolve them. Deterministic ids (Pages project/domains, R2 bucket, Total TLS, account DNS settings) are filled in literally.
- **Worker route ownership note (flagged, not resolved here):** `wrangler.toml` declares `routes` per env and `wrangler deploy/versions` reasserts them on every Worker deploy. The spec's file table assigns the Worker route to `workers.tf`, but its §7 hard import list enumerates **only** DNS/Pages/R2. To honor "zero destroys / no outage" this plan keeps the existing `cloudflare_workers_route` block in `workers.tf` **commented exactly as it is today** and adds a `## TODO(subproject-2)` note: reconciling Wrangler-vs-Terraform route ownership belongs to the pipeline sub-project. No route resource is created or imported here. This is a deliberate scope boundary, called out for the final review.

---

## File Structure

| File | State | Responsibility |
|---|---|---|
| `infra/terraform/main.tf` | modify | `terraform{}` (required_version ≥1.11, 3 providers); R2 backend uncommented + lockfile + R2 skip flags; provider configs; bootstrap variables |
| `infra/terraform/tokens.tf` | new | permission-group data sources, `time_static`/`time_rotating`, 3 `cloudflare_account_token` |
| `infra/terraform/github.tf` | new | 5 `github_repository_environment`, 2 `github_repository_environment_deployment_policy` (production+infra → `main`), 4 `github_actions_environment_secret` |
| `infra/terraform/dns.tf` | new | `cloudflare_dns_record` ×4 (api/www/preprod/alpha) + `cloudflare_account_dns_settings` (DNS absorbed out of `workers.tf`/`pages.tf`) |
| `infra/terraform/tls.tf` | new | `cloudflare_total_tls` |
| `infra/terraform/imports.tf` | new (**deleted after first apply**) | `import {}` blocks adopting live DNS/Pages/R2 |
| `infra/terraform/workers.tf` | trim | DNS removed (→ `dns.tf`); commented Worker-route block + subproject-2 TODO retained |
| `infra/terraform/pages.tf` | trim | DNS (`www`) removed (→ `dns.tf`); Pages project + apex/www domains kept |
| `infra/terraform/r2.tf` | modify | `ridgetocoast-layers` kept; `ridgetocoast-tfstate` bucket comment clarified (created manually, never TF-managed) |
| `infra/terraform/terraform.tfvars.example` | rewrite | bootstrap CF token, GitHub token, R2 S3 access key/secret; account/zone ids retained |
| `infra/terraform/.gitignore` | modify | ensure `*.tfvars` (not just `terraform.tfvars`) ignored |
| `infra/terraform/README.md` | new | bootstrap runbook, rotation behavior, "plan is the drift gate", manual ~annual bootstrap rotation, per-resource import-id sources + DNS-id `curl` |
| `.github/workflows/infra.yml` | new | PR fmt/validate; weekly drift plan + targeted rotation apply; manual full plan/apply |
| `CLAUDE.md` (root) | modify | rewrite "GitHub Secrets Required" → environment-scoped; add `infra/` architecture row; note TF owns CF config + plan-is-drift-gate |
| `docs/session-handoff.md` | modify | record this spec, §11 interface contract, Sub-project 2 is the consumer |

**Constants used across tasks (do not vary):**
- account id: `c378aeb8ad614074b3a5e541a4788993`
- zone id (`ridgetocoast.com`): `77d12978a2a1395b87a12be147f3b5e9`
- GitHub repo: owner `ridgetocoast`, name `ridge-to-coast` (full `ridgetocoast/ridge-to-coast`). The `pages.tf` GitHub-source `owner = "loobo07"` is a separate Cloudflare-Pages-to-GitHub connection that reflects the live Pages source and is intentionally left alone (changing it would force a Pages recreation = outage).
- Worker `*.workers.dev` target (current live `api` record content): `ridgetocoast-api.loboedwin01.workers.dev`
- R2 state bucket: `ridgetocoast-tfstate`; state key `terraform.tfstate`

---

## Verification model (Terraform — no unit tests)

There is no test runner. The per-task verification rhythm is:

1. `terraform fmt` (writes canonical formatting) then `terraform fmt -check` (must exit 0).
2. `terraform validate` — requires provider schemas. Run `cd infra/terraform && terraform init -backend=false -input=false` once per session (downloads providers, no creds, no state), then `terraform validate -no-color` (must print `Success!`).
3. Commit.

If the `terraform` binary is unavailable in the execution environment, the implementer must (a) state that explicitly in its status, (b) still run `terraform fmt`/`validate` is impossible so instead do a careful manual HCL syntax + cross-file reference review, and (c) rely on the CI `infra.yml` job as the real gate. Do **not** fabricate a passing `validate` you did not run. `terraform plan`/`apply` is **never** run from this plan — it needs live bootstrap creds and is the human first-apply runbook (spec §9).

---

### Task 1: Providers, backend, and bootstrap variables (`main.tf`)

**Files:**
- Modify: `infra/terraform/main.tf` (full rewrite)

- [ ] **Step 1: Rewrite `infra/terraform/main.tf`**

```hcl
terraform {
  required_version = ">= 1.11"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.12"
    }
  }

  # R2 (S3-compatible) backend. Mandatory: tfstate holds sensitive token values
  # (Decision 10). Native lockfile (use_lockfile) replaces DynamoDB — needs
  # Terraform >= 1.11. Backends cannot interpolate var.*, so the account id
  # (not secret, Decision 7) is the literal below; R2 access key/secret are
  # supplied at init via `-backend-config` / AWS_* env (see README).
  backend "s3" {
    bucket = "ridgetocoast-tfstate"
    key    = "terraform.tfstate"
    region = "auto"

    endpoints = {
      s3 = "https://c378aeb8ad614074b3a5e541a4788993.r2.cloudflarestorage.com"
    }

    use_lockfile                = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    force_path_style            = true
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_bootstrap_token
}

provider "github" {
  owner = "ridgetocoast"
  token = var.github_token
}

provider "time" {}

# ---- Non-secret ids (safe to commit; Decision 7) ----

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID — not sensitive, safe to commit"
  type        = string
  default     = "c378aeb8ad614074b3a5e541a4788993"
}

variable "cloudflare_zone_id" {
  description = "Zone ID for ridgetocoast.com — not sensitive, safe to commit"
  type        = string
  default     = "77d12978a2a1395b87a12be147f3b5e9"
}

# ---- Bootstrap root-of-trust (manual, never TF-managed; spec §6) ----

variable "cloudflare_bootstrap_token" {
  description = "CF bootstrap token: Account API Tokens:Edit + edit scopes of all TF-managed resources (DNS, Pages, Workers, R2, Account DNS Settings). Manually created, ~annual manual rotation."
  type        = string
  sensitive   = true
}

variable "github_token" {
  description = "GitHub PAT/App token: repo Administration + Actions Secrets read/write. Manually created, ~annual manual rotation."
  type        = string
  sensitive   = true
}

variable "r2_access_key_id" {
  description = "R2 S3 access key id for the state backend. Manually created. Passed to `terraform init` via -backend-config or AWS_ACCESS_KEY_ID."
  type        = string
  sensitive   = true
  default     = ""
}

variable "r2_secret_access_key" {
  description = "R2 S3 secret access key for the state backend. Manually created. Passed to `terraform init` via -backend-config or AWS_SECRET_ACCESS_KEY."
  type        = string
  sensitive   = true
  default     = ""
}
```

- [ ] **Step 2: Verify formatting**

Run: `cd infra/terraform && terraform fmt && terraform fmt -check`
Expected: exit 0, no diff output.

- [ ] **Step 3: Commit**

```bash
git add infra/terraform/main.tf
git commit -m "infra(tf): 3 providers, R2 backend + lockfile, bootstrap vars"
```

---

### Task 2: Tokens & no-gap rotation (`tokens.tf`)

**Files:**
- Create: `infra/terraform/tokens.tf`

Permission-group → token mapping (spec §4). `resources` is the JSON map `{ "com.cloudflare.api.account.<acct_id>" = "*" }` for account-scoped Workers/Pages groups, and `{ "com.cloudflare.api.account.zone.<zone_id>" = "*" }` for zone-scoped DNS groups. Group names are passed **URL-encoded** to the data source `name` filter.

| Token | Permission groups (name → scope) | → GH env |
|---|---|---|
| `production-deploy` | Workers Scripts Write, Workers Routes Write, Pages Write | `production` |
| `nonprod-deploy` | Workers Scripts Write, Workers Routes Write | `preview`, `alpha` |
| `audit-readonly` | DNS Read, Workers Routes Read, Workers Scripts Read, Pages Read | `audit` |

- [ ] **Step 1: Create `infra/terraform/tokens.tf`**

```hcl
# Account-owned CI tokens (Decision 2) with 90-day rotation and a
# non-optional 7-day create-before-destroy overlap (spec §4).

# ---- Permission groups, resolved by name (Decision 4 — never hardcode hex) ----
# Data source confirmed against cloudflare ~> 5:
# cloudflare_account_api_token_permission_groups_list (name/scope URL-encoded).

locals {
  acct_scope = "com.cloudflare.api.account"
  zone_scope = "com.cloudflare.api.account.zone"

  res_account = jsonencode({ "${local.acct_scope}.${var.cloudflare_account_id}" = "*" })
  res_zone    = jsonencode({ "${local.zone_scope}.${var.cloudflare_zone_id}" = "*" })
}

data "cloudflare_account_api_token_permission_groups_list" "workers_scripts_write" {
  account_id = var.cloudflare_account_id
  name       = "Workers%20Scripts%20Write"
}

data "cloudflare_account_api_token_permission_groups_list" "workers_routes_write" {
  account_id = var.cloudflare_account_id
  name       = "Workers%20Routes%20Write"
}

data "cloudflare_account_api_token_permission_groups_list" "pages_write" {
  account_id = var.cloudflare_account_id
  name       = "Pages%20Write"
}

data "cloudflare_account_api_token_permission_groups_list" "workers_scripts_read" {
  account_id = var.cloudflare_account_id
  name       = "Workers%20Scripts%20Read"
}

data "cloudflare_account_api_token_permission_groups_list" "workers_routes_read" {
  account_id = var.cloudflare_account_id
  name       = "Workers%20Routes%20Read"
}

data "cloudflare_account_api_token_permission_groups_list" "pages_read" {
  account_id = var.cloudflare_account_id
  name       = "Pages%20Read"
}

data "cloudflare_account_api_token_permission_groups_list" "dns_read" {
  account_id = var.cloudflare_account_id
  name       = "DNS%20Read"
}

# Exact-name match per permission group. The data source name filter is substring-based,
# so `result[0].id` can silently pick the wrong group (e.g. "DNS Read" vs "DNS Firewall Read").
# `one(filter)` returns the single id or errors at plan time on 0/multiple matches.
locals {
  pg_workers_scripts_write = one([for g in data.cloudflare_account_api_token_permission_groups_list.workers_scripts_write.result : g.id if g.name == "Workers Scripts Write"])
  pg_workers_routes_write  = one([for g in data.cloudflare_account_api_token_permission_groups_list.workers_routes_write.result : g.id if g.name == "Workers Routes Write"])
  pg_pages_write           = one([for g in data.cloudflare_account_api_token_permission_groups_list.pages_write.result : g.id if g.name == "Pages Write"])
  pg_workers_scripts_read  = one([for g in data.cloudflare_account_api_token_permission_groups_list.workers_scripts_read.result : g.id if g.name == "Workers Scripts Read"])
  pg_workers_routes_read   = one([for g in data.cloudflare_account_api_token_permission_groups_list.workers_routes_read.result : g.id if g.name == "Workers Routes Read"])
  pg_pages_read            = one([for g in data.cloudflare_account_api_token_permission_groups_list.pages_read.result : g.id if g.name == "Pages Read"])
  pg_dns_read              = one([for g in data.cloudflare_account_api_token_permission_groups_list.dns_read.result : g.id if g.name == "DNS Read"])
}

# ---- Rotation clock (spec §4) ----
resource "time_static" "tokens_start" {}

resource "time_rotating" "tokens" {
  rfc3339       = time_static.tokens_start.rfc3339
  rotation_days = 90
}

# not_before = creation instant; expires_on = 90-day boundary + 7-day overlap.
locals {
  token_not_before = time_static.tokens_start.rfc3339
  token_expires_on = timeadd(time_rotating.tokens.rotation_rfc3339, "168h")
}

# ---- production-deploy → GH env `production` ----
resource "cloudflare_account_token" "production_deploy" {
  account_id = var.cloudflare_account_id
  name       = "production-deploy"
  not_before = local.token_not_before
  expires_on = local.token_expires_on

  policies = [{
    effect = "allow"
    permission_groups = [
      { id = local.pg_workers_scripts_write },
      { id = local.pg_workers_routes_write },
      { id = local.pg_pages_write },
    ]
    resources = local.res_account
  }]

  lifecycle {
    create_before_destroy = true
    replace_triggered_by  = [time_rotating.tokens]
  }
}

# ---- nonprod-deploy → GH envs `preview`, `alpha` ----
resource "cloudflare_account_token" "nonprod_deploy" {
  account_id = var.cloudflare_account_id
  name       = "nonprod-deploy"
  not_before = local.token_not_before
  expires_on = local.token_expires_on

  policies = [{
    effect = "allow"
    permission_groups = [
      { id = local.pg_workers_scripts_write },
      { id = local.pg_workers_routes_write },
    ]
    resources = local.res_account
  }]

  lifecycle {
    create_before_destroy = true
    replace_triggered_by  = [time_rotating.tokens]
  }
}

# ---- audit-readonly → GH env `audit` ----
resource "cloudflare_account_token" "audit_readonly" {
  account_id = var.cloudflare_account_id
  name       = "audit-readonly"
  not_before = local.token_not_before
  expires_on = local.token_expires_on

  policies = [{
    effect = "allow"
    permission_groups = [
      { id = local.pg_dns_read },
      { id = local.pg_workers_routes_read },
      { id = local.pg_workers_scripts_read },
      { id = local.pg_pages_read },
    ]
    resources = local.res_account
  }]

  lifecycle {
    create_before_destroy = true
    replace_triggered_by  = [time_rotating.tokens]
  }
}
```

- [ ] **Step 2: Verify formatting & validate**

Run: `cd infra/terraform && terraform fmt && terraform fmt -check && terraform validate -no-color`
Expected: `terraform fmt -check` exit 0; `terraform validate` prints `Success! The configuration is valid.` (If `terraform` binary unavailable, state so and do a manual HCL + cross-reference review instead — see Verification model.)

- [ ] **Step 3: Commit**

```bash
git add infra/terraform/tokens.tf
git commit -m "infra(tf): 3 account tokens with 90d rotation + 7d overlap"
```

---

### Task 3: GitHub Environments & secret distribution (`github.tf`)

**Files:**
- Create: `infra/terraform/github.tf`

Spec §5: 5 environments. `production` + `infra` restricted to branch `main` (custom branch policy). `preview`/`alpha`/`audit` unrestricted. Secret `CLOUDFLARE_API_TOKEN` per env per the §5 value table. The `infra` env holds bootstrap creds entered **by hand** — Terraform does **not** write a secret into `infra`.

- [ ] **Step 1: Create `infra/terraform/github.tf`**

```hcl
# GitHub Environments + per-environment CLOUDFLARE_API_TOKEN (spec §5).
# integrations/github provider authenticated by the bootstrap GitHub token.

locals {
  github_repo = "ridge-to-coast"
}

# ---- production: branch-restricted to main ----
resource "github_repository_environment" "production" {
  repository  = local.github_repo
  environment = "production"

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_repository_environment_deployment_policy" "production_main" {
  repository     = local.github_repo
  environment    = github_repository_environment.production.environment
  branch_pattern = "main"
}

# ---- infra: branch-restricted to main; bootstrap creds entered by hand ----
resource "github_repository_environment" "infra" {
  repository  = local.github_repo
  environment = "infra"

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_repository_environment_deployment_policy" "infra_main" {
  repository     = local.github_repo
  environment    = github_repository_environment.infra.environment
  branch_pattern = "main"
}

# ---- preview / alpha / audit: no branch restriction ----
resource "github_repository_environment" "preview" {
  repository  = local.github_repo
  environment = "preview"
}

resource "github_repository_environment" "alpha" {
  repository  = local.github_repo
  environment = "alpha"
}

resource "github_repository_environment" "audit" {
  repository  = local.github_repo
  environment = "audit"
}

# ---- One secret name, value per environment (spec §5 table) ----
resource "github_actions_environment_secret" "production_cf_token" {
  repository      = local.github_repo
  environment     = github_repository_environment.production.environment
  secret_name     = "CLOUDFLARE_API_TOKEN"
  value       = cloudflare_account_token.production_deploy.value
}

resource "github_actions_environment_secret" "preview_cf_token" {
  repository  = local.github_repo
  environment = github_repository_environment.preview.environment
  secret_name = "CLOUDFLARE_API_TOKEN"
  value       = cloudflare_account_token.nonprod_deploy.value
}

resource "github_actions_environment_secret" "alpha_cf_token" {
  repository  = local.github_repo
  environment = github_repository_environment.alpha.environment
  secret_name = "CLOUDFLARE_API_TOKEN"
  value       = cloudflare_account_token.nonprod_deploy.value
}

resource "github_actions_environment_secret" "audit_cf_token" {
  repository  = local.github_repo
  environment = github_repository_environment.audit.environment
  secret_name = "CLOUDFLARE_API_TOKEN"
  value       = cloudflare_account_token.audit_readonly.value
}
```

- [ ] **Step 2: Verify formatting & validate**

Run: `cd infra/terraform && terraform fmt && terraform fmt -check && terraform validate -no-color`
Expected: `fmt -check` exit 0; `validate` prints `Success!`. (Binary-unavailable fallback per Verification model.)

- [ ] **Step 3: Commit**

```bash
git add infra/terraform/github.tf
git commit -m "infra(tf): 5 GitHub environments + per-env CLOUDFLARE_API_TOKEN"
```

---

### Task 4: DNS records + account DNS settings (`dns.tf`); trim `workers.tf`/`pages.tf`

**Files:**
- Create: `infra/terraform/dns.tf`
- Modify: `infra/terraform/workers.tf` (remove `cloudflare_dns_record.api`; keep commented route block + add subproject-2 TODO)
- Modify: `infra/terraform/pages.tf` (remove `cloudflare_dns_record.www`; keep Pages project + domains)

Spec §7: keep `api`/`www`; add proxied `preprod`/`alpha` mirroring `api`'s pattern (CNAME → the Worker `*.workers.dev` target so their Worker routes resolve). Account DNS settings pin a known-good baseline.

- [ ] **Step 1: Create `infra/terraform/dns.tf`**

```hcl
# DNS extracted here out of workers.tf/pages.tf (spec §7).
# cloudflare ~> 5: `name` is the FULL FQDN (v5 breaking change).
# preprod/alpha mirror the live `api` record so their Worker routes resolve.

resource "cloudflare_dns_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api.ridgetocoast.com"
  content = "ridgetocoast-api.loboedwin01.workers.dev"
  type    = "CNAME"
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www.ridgetocoast.com"
  content = "ridgetocoast.com"
  type    = "CNAME"
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "preprod" {
  zone_id = var.cloudflare_zone_id
  name    = "preprod.ridgetocoast.com"
  content = "ridgetocoast-api.loboedwin01.workers.dev"
  type    = "CNAME"
  ttl     = 1
  proxied = true
}

resource "cloudflare_dns_record" "alpha" {
  zone_id = var.cloudflare_zone_id
  name    = "alpha.ridgetocoast.com"
  content = "ridgetocoast-api.loboedwin01.workers.dev"
  type    = "CNAME"
  ttl     = 1
  proxied = true
}

# Account-level DNS drift baseline (spec §7). Low churn.
resource "cloudflare_account_dns_settings" "baseline" {
  account_id       = var.cloudflare_account_id
  enforce_dns_only = false

  zone_defaults = {
    zone_mode = "standard"
    nameservers = {
      type = "cloudflare.standard"
    }
  }
}
```

- [ ] **Step 2: Replace `infra/terraform/workers.tf` entirely with**

```hcl
# Cloudflare Workers — REST API (workers/)
# Scripts are deployed via Wrangler CLI in CI. DNS for api.ridgetocoast.com
# is managed in dns.tf (extracted per spec §7).

# TODO(subproject-2): Worker-route ownership. wrangler.toml [env.*] `routes`
# reasserts api/preprod/alpha routes on every Wrangler deploy. The spec's §7
# hard import list covers only DNS/Pages/R2, not the Worker route, and a
# Pages/route recreation is an outage. Reconciling Wrangler-vs-Terraform route
# ownership is the pipeline sub-project's task. Until then the route below
# stays Wrangler-managed (commented here, intentionally not TF-imported).
# resource "cloudflare_workers_route" "api" {
#   zone_id = var.cloudflare_zone_id
#   pattern = "api.ridgetocoast.com/*"
#   script  = "ridgetocoast-api"
# }
```

- [ ] **Step 3: Replace `infra/terraform/pages.tf` entirely with**

```hcl
# Cloudflare Pages — frontend (app/). DNS (www) managed in dns.tf (spec §7).
resource "cloudflare_pages_project" "frontend" {
  account_id        = var.cloudflare_account_id
  name              = "ridgetocoast"
  production_branch = "main"

  source = {
    type = "github"
    config = {
      owner                          = "loobo07"
      repo_name                      = "ridge-to-coast"
      production_branch              = "main"
      pr_comments_enabled            = true
      production_deployments_enabled = true
      preview_deployment_setting     = "custom"
      preview_branch_includes        = ["feature/*", "claude/*"]
    }
  }

  build_config = {
    build_command   = ""
    destination_dir = "app"
    root_dir        = ""
  }
}

resource "cloudflare_pages_domain" "apex" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.frontend.name
  name         = "ridgetocoast.com"
}

resource "cloudflare_pages_domain" "www" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.frontend.name
  name         = "www.ridgetocoast.com"
}
```

- [ ] **Step 4: Verify formatting & validate**

Run: `cd infra/terraform && terraform fmt && terraform fmt -check && terraform validate -no-color`
Expected: `fmt -check` exit 0; `validate` prints `Success!`. (Binary-unavailable fallback per Verification model.)

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/dns.tf infra/terraform/workers.tf infra/terraform/pages.tf
git commit -m "infra(tf): extract DNS to dns.tf, add preprod/alpha + account DNS baseline"
```

---

### Task 5: Total TLS (`tls.tf`)

**Files:**
- Create: `infra/terraform/tls.tf`

Spec §7 + Decision 12: per-hostname certs via Google CA, no wildcard.

- [ ] **Step 1: Create `infra/terraform/tls.tf`**

```hcl
# Total TLS: per-hostname certs for api/preprod/alpha (no wildcard).
# Decision 12 — Google CA. Schema confirmed cloudflare ~> 5.
resource "cloudflare_total_tls" "ridgetocoast" {
  zone_id               = var.cloudflare_zone_id
  enabled               = true
  certificate_authority = "google"
}
```

- [ ] **Step 2: Verify formatting & validate**

Run: `cd infra/terraform && terraform fmt && terraform fmt -check && terraform validate -no-color`
Expected: `fmt -check` exit 0; `validate` prints `Success!`. (Binary-unavailable fallback per Verification model.)

- [ ] **Step 3: Commit**

```bash
git add infra/terraform/tls.tf
git commit -m "infra(tf): Total TLS, Google CA, per-hostname"
```

---

### Task 6: Import blocks for live DNS/Pages/R2 (`imports.tf`)

**Files:**
- Create: `infra/terraform/imports.tf`

Spec §7 hard requirement: live `api`/`www` DNS, Pages project + apex/www domains, R2 `layers` bucket already exist (state never persisted). `import {}` (TF ≥1.5) adopts them — first real plan **must show zero destroys**. Deterministic ids are filled literally; DNS `<record_id>`s are non-deterministic and carry `REPLACE_WITH_*` tokens resolved at first-apply (README documents the `curl`). `preprod`/`alpha` are **new** records (no import — they don't exist yet). The R2 `tfstate` bucket is created manually and is **not** a TF resource, so no import.

- [ ] **Step 1: Create `infra/terraform/imports.tf`**

```hcl
# ONE-SHOT. Adopts pre-existing live resources so the first apply does NOT
# recreate them (spec §7 — zero destroys, Pages recreation = outage).
# DELETE THIS FILE after the first successful apply, then commit the deletion.
#
# Deterministic ids are inlined. DNS record ids are NOT deterministic:
# replace each REPLACE_WITH_*_RECORD_ID with the live id from
#   curl -s -H "Authorization: Bearer $CF_BOOTSTRAP_TOKEN" \
#     "https://api.cloudflare.com/client/v4/zones/77d12978a2a1395b87a12be147f3b5e9/dns_records?name=<fqdn>" \
#     | jq -r '.result[0].id'
# (README documents this.) preprod/alpha are NEW records — no import block.

import {
  to = cloudflare_dns_record.api
  id = "77d12978a2a1395b87a12be147f3b5e9/REPLACE_WITH_API_RECORD_ID"
}

import {
  to = cloudflare_dns_record.www
  id = "77d12978a2a1395b87a12be147f3b5e9/REPLACE_WITH_WWW_RECORD_ID"
}

import {
  to = cloudflare_pages_project.frontend
  id = "c378aeb8ad614074b3a5e541a4788993/ridgetocoast"
}

import {
  to = cloudflare_pages_domain.apex
  id = "c378aeb8ad614074b3a5e541a4788993/ridgetocoast/ridgetocoast.com"
}

import {
  to = cloudflare_pages_domain.www
  id = "c378aeb8ad614074b3a5e541a4788993/ridgetocoast/www.ridgetocoast.com"
}

import {
  to = cloudflare_r2_bucket.layers
  id = "c378aeb8ad614074b3a5e541a4788993/ridgetocoast-layers"
}
```

- [ ] **Step 2: Verify formatting**

Run: `cd infra/terraform && terraform fmt && terraform fmt -check`
Expected: exit 0. (`terraform validate` does not resolve import ids — formatting + manual cross-check of every `to =` target against an existing resource address is the gate here.)

- [ ] **Step 3: Commit**

```bash
git add infra/terraform/imports.tf
git commit -m "infra(tf): one-shot import blocks for live DNS/Pages/R2"
```

---

### Task 7: r2.tf clarification + tfvars.example + .gitignore

**Files:**
- Modify: `infra/terraform/r2.tf`
- Modify: `infra/terraform/terraform.tfvars.example` (full rewrite)
- Modify: `infra/terraform/.gitignore`

- [ ] **Step 1: Replace `infra/terraform/r2.tf` entirely with**

```hcl
# Cloudflare R2 — object storage.
# `layers`: P4 institutional custom GeoJSON uploads (issue #25). Adopted via
# imports.tf (already exists live).
resource "cloudflare_r2_bucket" "layers" {
  account_id = var.cloudflare_account_id
  name       = "ridgetocoast-layers"
  location   = "ENAM"
}

# The `ridgetocoast-tfstate` bucket backing the S3 state backend is created
# MANUALLY, once, during bootstrap (spec §6/§9) and is deliberately NOT a
# Terraform resource — Terraform cannot manage the bucket that stores its own
# state (chicken/egg). See README "First-apply runbook".
```

- [ ] **Step 2: Replace `infra/terraform/terraform.tfvars.example` entirely with**

```hcl
# Copy to terraform.tfvars and fill in. terraform.tfvars is gitignored —
# never commit it. These three are the bootstrap root-of-trust (spec §6):
# created manually once in the Cloudflare/GitHub dashboards, never
# TF-managed, manual ~annual rotation.
#
#   cloudflare_bootstrap_token → dash.cloudflare.com/profile/api-tokens
#       Scopes: Account API Tokens:Edit, plus Edit for DNS, Pages, Workers
#       Scripts, Workers Routes, R2, Account DNS Settings.
#   github_token → github.com/settings/tokens (fine-grained PAT for
#       loobo07/ridge-to-coast): Administration RW + Secrets RW + Environments RW.
#   r2_access_key_id / r2_secret_access_key → Cloudflare dash → R2 →
#       Manage R2 API Tokens (S3 Auth). Used by the state backend; pass to
#       `terraform init -backend-config=...` or via AWS_ACCESS_KEY_ID /
#       AWS_SECRET_ACCESS_KEY (see README).
#
# Account/zone ids are not secrets (Decision 7) and default in main.tf;
# override here only if they change.

cloudflare_bootstrap_token = "your_cf_bootstrap_token_here"
github_token               = "your_github_pat_here"
r2_access_key_id           = "your_r2_access_key_id_here"
r2_secret_access_key       = "your_r2_secret_access_key_here"

# cloudflare_account_id = "c378aeb8ad614074b3a5e541a4788993"
# cloudflare_zone_id    = "77d12978a2a1395b87a12be147f3b5e9"
```

- [ ] **Step 3: Update `infra/terraform/.gitignore`** — change the credentials line so any tfvars (not just `terraform.tfvars`) is ignored while keeping the example tracked.

Replace:
```
# Credentials — never commit
terraform.tfvars
```
with:
```
# Credentials — never commit (example file is intentionally tracked)
*.tfvars
!terraform.tfvars.example
```

- [ ] **Step 4: Verify formatting & tracked-file sanity**

Run: `cd infra/terraform && terraform fmt && terraform fmt -check && git check-ignore -q terraform.tfvars && git check-ignore -v terraform.tfvars.example; echo "example ignored exit=$?"`
Expected: `fmt -check` exit 0; `git check-ignore terraform.tfvars` succeeds (ignored); `terraform.tfvars.example` is **not** ignored so the `git check-ignore -v` fails and prints `example ignored exit=1`.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/r2.tf infra/terraform/terraform.tfvars.example infra/terraform/.gitignore
git commit -m "infra(tf): clarify tfstate bucket is manual; bootstrap tfvars + gitignore"
```

---

### Task 8: `infra/terraform/README.md` (bootstrap runbook)

**Files:**
- Create: `infra/terraform/README.md`

Spec §10 + §9 + §6. Must contain: bootstrap runbook, rotation behavior, "plan is the drift gate", manual ~annual bootstrap rotation, per-resource import-id sources incl. the DNS-id `curl`.

- [ ] **Step 1: Create `infra/terraform/README.md`**

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add infra/terraform/README.md
git commit -m "infra(tf): bootstrap runbook + rotation/drift/import docs"
```

---

### Task 9: `.github/workflows/infra.yml`

**Files:**
- Create: `.github/workflows/infra.yml`

Spec §8: three triggers. PR job needs no creds. Weekly + manual jobs use the `infra` environment (bootstrap creds as env secrets, entered by hand). `concurrency` group + R2 `use_lockfile` prevent torn applies.

- [ ] **Step 1: Create `.github/workflows/infra.yml`**

```yaml
name: Terraform Infra

on:
  pull_request:
    branches: [main]
    paths:
      - 'infra/terraform/**'
  schedule:
    - cron: '17 6 * * 1' # weekly Mon 06:17 UTC — drift gate + rotation apply
  workflow_dispatch:
    inputs:
      action:
        description: 'plan or apply (full, human-reviewed path)'
        required: true
        default: 'plan'
        type: choice
        options: [plan, apply]

permissions:
  contents: read

concurrency:
  group: terraform-infra
  cancel-in-progress: false

defaults:
  run:
    working-directory: infra/terraform

jobs:
  # PR: fmt + validate only. No credentials, no backend.
  validate:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "~> 1.11"
      - run: terraform fmt -check -recursive
      - run: terraform init -backend=false -input=false
      - run: terraform validate -no-color

  # Weekly: drift detection (red on drift) + targeted rotation apply.
  drift-and-rotate:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    environment: infra
    env:
      TF_VAR_cloudflare_bootstrap_token: ${{ secrets.CLOUDFLARE_BOOTSTRAP_TOKEN }}
      TF_VAR_github_token: ${{ secrets.GH_INFRA_TOKEN }}
      AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "~> 1.11"
      - run: terraform init -input=false
      - name: Drift gate (exit 2 = drift = red)
        run: terraform plan -detailed-exitcode -no-color -input=false
      - name: Targeted rotation apply (inert except at the 90-day boundary)
        if: success()
        run: |
          terraform apply -auto-approve -no-color -input=false \
            -target=time_rotating.tokens \
            -target=cloudflare_account_token.production_deploy \
            -target=cloudflare_account_token.nonprod_deploy \
            -target=cloudflare_account_token.audit_readonly \
            -target=github_actions_environment_secret.production_cf_token \
            -target=github_actions_environment_secret.preview_cf_token \
            -target=github_actions_environment_secret.alpha_cf_token \
            -target=github_actions_environment_secret.audit_cf_token

  # Manual: full plan/apply — human-reviewed DNS/TLS/account/import path.
  manual:
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    environment: infra
    env:
      TF_VAR_cloudflare_bootstrap_token: ${{ secrets.CLOUDFLARE_BOOTSTRAP_TOKEN }}
      TF_VAR_github_token: ${{ secrets.GH_INFRA_TOKEN }}
      AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "~> 1.11"
      - run: terraform init -input=false
      - name: terraform ${{ inputs.action }}
        run: |
          if [ "${{ inputs.action }}" = "apply" ]; then
            terraform apply -auto-approve -no-color -input=false
          else
            terraform plan -no-color -input=false
          fi
```

- [ ] **Step 2: Verify workflow YAML parses**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/infra.yml')); print('yaml ok')"`
Expected: `yaml ok`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/infra.yml
git commit -m "ci: infra.yml — PR fmt/validate, weekly drift+rotation, manual apply"
```

---

### Task 10: Documentation — `CLAUDE.md` + `docs/session-handoff.md`

**Files:**
- Modify: `CLAUDE.md` (root) — rewrite "GitHub Secrets Required"; add `infra/` architecture row; note plan-is-drift-gate
- Modify: `docs/session-handoff.md` — record this spec, §11 contract, Sub-project 2 is consumer

- [ ] **Step 1: In root `CLAUDE.md`, add an `infra/` row to the Architecture table.** After the table row for `Geo helpers` (the `app/lib/geo-data.js` row), the table currently ends with the E2E tests row. Add immediately after the E2E tests row, before the closing `---`:

```markdown
| Infra | Terraform (Cloudflare, GitHub, time providers) | `infra/terraform/` |
```

- [ ] **Step 2: In root `CLAUDE.md`, replace the entire "## GitHub Secrets Required" section** (the heading, the table, and its rows) with:

```markdown
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
```

- [ ] **Step 3: Append a section to `docs/session-handoff.md`** at the end of the file:

```markdown

---

## Next: Cloudflare Infra as Code — Terraform (Sub-project 1)

- **Spec:** `app/docs/superpowers/specs/2026-05-18-cloudflare-infra-terraform-design.md`
- **Plan:** `app/docs/superpowers/plans/2026-05-18-cloudflare-infra-terraform.md`
- **Scope:** `infra/terraform/` becomes the authoritative producer of 3 rotating
  CI tokens, 5 GitHub Environments + `CLOUDFLARE_API_TOKEN`, and managed
  DNS/TLS/account config. `terraform plan` is the drift gate.

### §11 interface contract for Sub-project 2 (the release/smoke pipeline)

Sub-project 2 may assume, and must align with, exactly this:

- GitHub Environments exist: `production` (branch policy = `main`), `preview`,
  `alpha`, `audit` — each exposing secret `CLOUDFLARE_API_TOKEN`.
- Cloudflare account id is read from `wrangler.toml`, **not** a secret.
- Repo-level `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_PREVIEW_API_TOKEN`, and
  `CLOUDFLARE_ACCOUNT_ID` are **deleted by Sub-project 1's apply**. The pipeline
  PR that switches workflows to environment-scoped secrets must merge in
  lockstep with that apply. **This ordering coupling is the top integration
  risk.**
- Re-scoping `scripts/audit-cloudflare-config.mjs` to runtime-only facts is
  Sub-project 2's task (untouched here).
```

- [ ] **Step 4: Verify the edits landed**

Run: `grep -n "environment-scoped" CLAUDE.md && grep -n "Sub-project 1" docs/session-handoff.md && grep -n "| Infra |" CLAUDE.md`
Expected: matching lines printed for all three greps.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/session-handoff.md
git commit -m "docs: environment-scoped secrets model + infra handoff + §11 contract"
```

---

## Self-Review (completed during planning)

**Spec coverage** — every spec section maps to a task:
- §3 file layout → Tasks 1–9 (every file row covered; `versions.tf` folded into `main.tf` per the spec's "Providers | main.tf | modify").
- §4 tokens & no-gap rotation → Task 2 (data source name corrected to the verified `cloudflare_account_api_token_permission_groups_list`; 7-day overlap via `timeadd(...,"168h")`; `create_before_destroy` + `replace_triggered_by`).
- §5 GitHub envs & secret table → Task 3 (5 envs; production+infra `main`-restricted via deployment policy; 4 TF-written secrets; `infra` secret hand-entered).
- §6 bootstrap root-of-trust → Task 1 vars + Task 8 README.
- §7 DNS/TLS/account + import → Tasks 4, 5, 6 (FQDN names per v5; preprod/alpha new; account DNS baseline; deterministic imports inlined, DNS ids tokenised).
- §8 infra.yml three triggers → Task 9.
- §9 first-apply protocol → Task 8 README runbook.
- §10 doc changes → Tasks 8 + 10.
- §11 interface contract → Task 10 (session-handoff).
- §12 YAGNI / §13 risks → respected (no TF Cloud, native lockfile, no reviewer gates, no pre-merge live plan, Worker script stays Wrangler; Worker-route ownership explicitly flagged not silently expanded).

**Placeholder scan:** No "TBD/TODO-implement" placeholders. The only deliberate tokens are `REPLACE_WITH_*_RECORD_ID` in `imports.tf` — non-deterministic by nature, resolved by the documented `curl` in the first-apply runbook (spec §7/§9 explicitly defer these to implementation/runbook time). The `TODO(subproject-2)` comment in `workers.tf` is a deliberate, spec-aligned scope boundary, not an unfinished step.

**Type/name consistency:** Resource addresses are stable across tasks — `cloudflare_account_token.{production_deploy,nonprod_deploy,audit_readonly}`, `github_repository_environment.{production,preview,alpha,audit,infra}`, `github_actions_environment_secret.{production,preview,alpha,audit}_cf_token`, `cloudflare_dns_record.{api,www,preprod,alpha}` — referenced identically in `tokens.tf`/`github.tf`/`imports.tf`/`infra.yml`/README.

**Open risks surfaced (not silently resolved):**
1. **Worker-route ownership** (`workers.tf` TODO) — Wrangler vs Terraform; deferred to Sub-project 2; route left Wrangler-managed and uncommented-as-before to avoid an outage. Flag for final review.
2. **`github_actions_environment_secret` attribute name** — code uses `value` (the current canonical form per the `integrations/github ~> 6` provider docs). The provider also still accepts `plaintext_value` (deprecated) and `encrypted_value` (deprecated, prefer `value_encrypted`); we use `value` for forward-compatibility.
3. **`cloudflare_account_dns_settings` `zone_defaults` shape** — written as a single nested attribute object per the v5 docs; if the installed provider expects a block, the implementer adjusts and notes it.
```
