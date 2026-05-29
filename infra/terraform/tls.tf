# Total TLS: per-hostname certs for api/preprod/alpha (no wildcard).
# Decision 12 — Google CA. Schema confirmed cloudflare ~> 5.
resource "cloudflare_total_tls" "ridgetocoast" {
  zone_id               = var.cloudflare_zone_id
  enabled               = true
  certificate_authority = "google"
}
