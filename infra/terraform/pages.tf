# Cloudflare Pages — frontend (app/)
resource "cloudflare_pages_project" "frontend" {
  account_id        = var.cloudflare_account_id
  name              = "ridgetocoast"
  production_branch = "main"

  source {
    type = "github"
    config {
      owner                         = "ridgetocoast"
      repo_name                     = "ridge-to-coast"
      production_branch             = "main"
      pr_comments_enabled           = true
      deployments_enabled           = true
      preview_deployment_setting    = "custom"
      preview_branch_includes       = ["feature/*", "claude/*"]
      preview_branch_excludes       = []
    }
  }

  build_config {
    build_command   = ""
    destination_dir = "app"
    root_dir        = ""
  }
}

# Custom domain: ridgetocoast.com → Pages
resource "cloudflare_pages_domain" "apex" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.frontend.name
  domain       = "ridgetocoast.com"
}

resource "cloudflare_pages_domain" "www" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.frontend.name
  domain       = "www.ridgetocoast.com"
}

# DNS: www → apex redirect
resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  value   = "ridgetocoast.com"
  type    = "CNAME"
  proxied = true
}
