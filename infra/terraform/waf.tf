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
# IMPORTANT — THIS ZONE IS ON THE CLOUDFLARE FREE PLAN
# ----------------------------------------------------
# That constrains what this rule can do, and it may not address the live
# outage at all. Read before assuming this file is the fix.
#
# What a `skip` rule CAN do here: skip managed rules, rate limiting, and the
# legacy security products — most usefully `securityLevel`, which is what
# issues a challenge when the zone's Security Level is raised (and challenges
# every visitor when it is set to "I'm Under Attack"). Free includes 5 WAF
# custom rules with the Skip action, so this rule fits.
#
# What it CANNOT do: exempt **Bot Fight Mode**, the free-plan toggle. Per
# Cloudflare's docs, "You cannot bypass or skip Bot Fight Mode using WAF
# custom rules or Page Rules" — it runs outside the Ruleset Engine, so no rule
# reaches it. If Bot Fight Mode is the cause, the only fix is turning it off;
# this file does nothing for that case.
#
# Super Bot Fight Mode (the http_request_sbfm phase) IS skippable, but it
# requires Pro or above and does not exist on this zone — deliberately left
# out of `phases` below rather than carried as a no-op.
#
# The cause has not been confirmed yet. Diagnostic and decision table:
#   docs/runbooks — RB-01, Step 2

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
        # Managed rulesets and rate limiting. http_request_sbfm is omitted on
        # purpose: Super Bot Fight Mode is Pro-and-above and absent here.
        phases = [
          "http_request_firewall_managed",
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
