# Account-owned CI tokens (Decision 2) with 90-day rotation and a
# non-optional 7-day create-before-destroy overlap (spec §4).

# ---- Permission groups, resolved by name (Decision 4 — never hardcode hex) ----
# Data source confirmed against cloudflare ~> 5:
# cloudflare_account_api_token_permission_groups_list (name/scope URL-encoded).

locals {
  acct_scope = "com.cloudflare.api.account"
  zone_scope = "com.cloudflare.api.account.zone"

  res_account = jsonencode({ "${local.acct_scope}.${var.cloudflare_account_id}" = "*" })
  res_zone    = jsonencode({ "${local.zone_scope}.${var.cloudflare_zone_id}" = "*" }) # zone-scoped resource; used by audit_readonly for DNS Read
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

# not_before = original tokens_start (intentionally pinned — after rotation #N this lives months in the past, which Cloudflare accepts: a "not valid before <past time>" token is always valid). expires_on = 90-day boundary + 7-day overlap.
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

  policies = [
    {
      effect = "allow"
      permission_groups = [
        { id = local.pg_workers_routes_read },
        { id = local.pg_workers_scripts_read },
        { id = local.pg_pages_read },
      ]
      resources = local.res_account
    },
    {
      # DNS Read is zone-category — must be paired with a zone-scoped resource.
      effect            = "allow"
      permission_groups = [{ id = local.pg_dns_read }]
      resources         = local.res_zone
    },
  ]

  lifecycle {
    create_before_destroy = true
    replace_triggered_by  = [time_rotating.tokens]
  }
}
