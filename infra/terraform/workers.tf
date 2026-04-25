# Cloudflare Workers — REST API (workers/)
# Scripts are deployed via Wrangler CLI in CI; Terraform manages DNS routing only.

# DNS: api.ridgetocoast.com → Worker (proxied)
resource "cloudflare_dns_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  content = "ridgetocoast-api.loboedwin01.workers.dev"
  type    = "CNAME"
  ttl     = 1
  proxied = true
}

# Route: api.ridgetocoast.com/* → ridgetocoast-api worker script
# Uncomment after first `wrangler deploy` — the Worker must exist before the route can be created
# resource "cloudflare_workers_route" "api" {
#   zone_id = var.cloudflare_zone_id
#   pattern = "api.ridgetocoast.com/*"
#   script  = "ridgetocoast-api"
# }
