# ONE-SHOT. Adopts pre-existing live resources so the first apply does NOT
# recreate them (spec §7 — zero destroys, Pages recreation = outage).
# DELETE THIS FILE after the first successful apply, then commit the deletion.
#
# Deterministic ids are inlined. DNS record ids are NOT deterministic:
# replace each REPLACE_WITH_*_RECORD_ID with the live id from
#   curl -s -H "Authorization: Bearer $CF_BOOTSTRAP_TOKEN" \
#     "https://api.cloudflare.com/client/v4/zones/77d12978a2a1395b87a12be147f3b5e9/dns_records?name=<fqdn>" \
#     | jq -r '.result[0].id'
# (README documents this.) preprod/alpha are NEW records — no import block.

import {
  to = cloudflare_dns_record.api
  id = "77d12978a2a1395b87a12be147f3b5e9/REPLACE_WITH_API_RECORD_ID"
}

import {
  to = cloudflare_dns_record.www
  id = "77d12978a2a1395b87a12be147f3b5e9/REPLACE_WITH_WWW_RECORD_ID"
}

import {
  to = cloudflare_pages_project.frontend
  id = "c378aeb8ad614074b3a5e541a4788993/ridgetocoast"
}

import {
  to = cloudflare_pages_domain.apex
  id = "c378aeb8ad614074b3a5e541a4788993/ridgetocoast/ridgetocoast.com"
}

import {
  to = cloudflare_pages_domain.www
  id = "c378aeb8ad614074b3a5e541a4788993/ridgetocoast/www.ridgetocoast.com"
}

import {
  to = cloudflare_r2_bucket.layers
  id = "c378aeb8ad614074b3a5e541a4788993/ridgetocoast-layers"
}
