# Cloudflare Workers — REST API (workers/)
# Deployed via Wrangler CLI in CI; Terraform manages DNS routing only

# DNS: api.ridgetocoast.com → Worker
resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  value   = "ridgetocoast-api.YOUR_CF_SUBDOMAIN.workers.dev"
  type    = "CNAME"
  proxied = true
}

# Worker route: api.ridgetocoast.com/* → ridgetocoast-api worker
resource "cloudflare_worker_route" "api" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "api.ridgetocoast.com/*"
  script_name = "ridgetocoast-api"
}
