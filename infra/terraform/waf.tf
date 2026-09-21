# WAF / bot-protection exemptions for the API hostnames.
#
# WHY THIS EXISTS
# ---------------
# Every hostname in the zone was answering 403 with `cf-mitigated: challenge`,
# including api.ridgetocoast.com, while the Pages origin (ridgetocoast.pages.dev)
# served 200. A managed challenge cannot be solved by fetch()/XHR, so any
# browser call to the Workers API got an HTML challenge page instead of JSON —
# which breaks the gardens layer, the only frontend feature wired to the API.
#
# The apex and www deliberately keep their protection: they are human-facing and
# a challenge there is harmless. Only the API hostnames are exempted.
#
# IMPORTANT — WHAT THIS CAN AND CANNOT SKIP
# -----------------------------------------
# The `skip` action covers managed rulesets, the legacy security products, and
# Super Bot Fight Mode (the http_request_sbfm phase).
#
# It does NOT cover plain **Bot Fight Mode**, the free-plan toggle under
# Security > Bots. That feature has no per-hostname exemption and is not in the
# `products` enum (bic, hot, rateLimit, securityLevel, uaBlock, waf,
# zoneLockdown). If Bot Fight Mode is what is challenging the API, this rule
# will not help — it must be turned off in the dashboard, with Super Bot Fight
# Mode or a managed ruleset used in its place so this skip rule can govern it.
#
# Confirm which one is active at:
#   Cloudflare dashboard > ridgetocoast.com > Security > Bots

resource "cloudflare_ruleset" "api_skip_bot_protection" {
  zone_id     = var.cloudflare_zone_id
  name        = "API bot-protection exemptions"
  description = "Let programmatic clients reach the Workers API without a challenge."
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [
    {
      ref         = "skip_bot_protection_for_api_hosts"
      description = "Skip challenge/WAF for the Workers API hostnames (fetch cannot solve a challenge)"
      expression  = "(http.host in {\"api.ridgetocoast.com\" \"preprod.ridgetocoast.com\" \"alpha.ridgetocoast.com\"})"
      action      = "skip"
      enabled     = true

      action_parameters = {
        # Managed rulesets, rate limiting, and Super Bot Fight Mode.
        phases = [
          "http_request_firewall_managed",
          "http_request_sbfm",
          "http_ratelimit",
        ]
        # Legacy security products. `securityLevel` is the one that issues the
        # challenge when the zone's Security Level is medium/high.
        products = [
          "waf",
          "securityLevel",
          "uaBlock",
          "bic",
          "hot",
          "zoneLockdown",
          "rateLimit",
        ]
      }

      logging = {
        enabled = true
      }
    },
  ]
}
