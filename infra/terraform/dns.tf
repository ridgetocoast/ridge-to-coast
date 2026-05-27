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
