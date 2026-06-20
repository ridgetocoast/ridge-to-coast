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
