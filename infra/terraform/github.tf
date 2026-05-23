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
  plaintext_value = cloudflare_account_token.production_deploy.value
}

resource "github_actions_environment_secret" "preview_cf_token" {
  repository      = local.github_repo
  environment     = github_repository_environment.preview.environment
  secret_name     = "CLOUDFLARE_API_TOKEN"
  plaintext_value = cloudflare_account_token.nonprod_deploy.value
}

resource "github_actions_environment_secret" "alpha_cf_token" {
  repository      = local.github_repo
  environment     = github_repository_environment.alpha.environment
  secret_name     = "CLOUDFLARE_API_TOKEN"
  plaintext_value = cloudflare_account_token.nonprod_deploy.value
}

resource "github_actions_environment_secret" "audit_cf_token" {
  repository      = local.github_repo
  environment     = github_repository_environment.audit.environment
  secret_name     = "CLOUDFLARE_API_TOKEN"
  plaintext_value = cloudflare_account_token.audit_readonly.value
}
