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
