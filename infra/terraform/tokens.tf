# Account-owned CI tokens (Decision 2) with 90-day rotation and a
# non-optional 7-day create-before-destroy overlap (spec §4).

# ---- Permission groups, resolved by name (Decision 4 — never hardcode hex) ----
# Data source confirmed against cloudflare ~> 5:
# cloudflare_account_api_token_permission_groups_list (name/scope URL-encoded).

locals {
  acct_scope = "com.cloudflare.api.account"
  zone_scope = "com.cloudflare.api.account.zone"

  res_account = jsonencode({ "com.cloudflare.api.account.${var.cloudflare_account_id}" = "*" })
  res_zone    = jsonencode({ "com.cloudflare.api.account.zone.${var.cloudflare_zone_id}" = "*" })
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
      { id = data.cloudflare_account_api_token_permission_groups_list.workers_scripts_write.result[0].id },
      { id = data.cloudflare_account_api_token_permission_groups_list.workers_routes_write.result[0].id },
      { id = data.cloudflare_account_api_token_permission_groups_list.pages_write.result[0].id },
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
      { id = data.cloudflare_account_api_token_permission_groups_list.workers_scripts_write.result[0].id },
      { id = data.cloudflare_account_api_token_permission_groups_list.workers_routes_write.result[0].id },
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
      { id = data.cloudflare_account_api_token_permission_groups_list.dns_read.result[0].id },
      { id = data.cloudflare_account_api_token_permission_groups_list.workers_routes_read.result[0].id },
      { id = data.cloudflare_account_api_token_permission_groups_list.workers_scripts_read.result[0].id },
      { id = data.cloudflare_account_api_token_permission_groups_list.pages_read.result[0].id },
    ]
    resources = local.res_account
  }]

  lifecycle {
    create_before_destroy = true
    replace_triggered_by  = [time_rotating.tokens]
  }
}
