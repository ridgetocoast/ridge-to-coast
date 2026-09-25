#!/usr/bin/env bash
#
# smoke-api.sh — post-deploy verification for the Workers API.
#
# Checks that every route answers 200 with JSON. This exists because the
# production API sat behind a Cloudflare bot challenge (403, text/html,
# cf-mitigated: challenge) and nothing noticed: no deploy workflow verified
# anything after shipping. A challenge page is HTML, so the content-type
# assertion below is the check that catches it.
#
# Usage:
#   scripts/smoke-api.sh https://api.ridgetocoast.com
#
# Exit codes: 0 all good · 1 a route failed
set -uo pipefail

BASE="${1:?usage: smoke-api.sh <base-url>}"
BASE="${BASE%/}"
FAILED=0

# Routes that must return 200 + JSON for the deploy to be considered good.
ROUTES=(
  "/"
  "/v1/ecoregion?lat=37.54&lon=-77.43"
  "/v1/calendar?zone=7b&month=4"
  "/v1/plants?region=piedmont"
)

check() {
  local path="$1" tolerate_502="${2:-no}"
  local url="${BASE}${path}"
  local body status ctype

  body=$(curl -sS --max-time 25 -o /tmp/smoke-body -w '%{http_code}\t%{content_type}' "$url" 2>/dev/null) || {
    echo "FAIL  ${path} — request failed (network/DNS/TLS)"
    FAILED=1; return
  }
  status="${body%%$'\t'*}"
  ctype="${body##*$'\t'}"

  if [ "$status" = "403" ] && grep -qi "cloudflare\|challenge" /tmp/smoke-body 2>/dev/null; then
    echo "FAIL  ${path} — 403 Cloudflare challenge. The API hostname is behind"
    echo "      bot protection; fetch() cannot solve a challenge. Add a WAF skip"
    echo "      rule for this hostname (see infra/terraform/waf.tf)."
    FAILED=1; return
  fi

  if [ "$tolerate_502" = "tolerate-502" ] && [ "$status" = "502" ]; then
    echo "WARN  ${path} — 502 from upstream (external dependency), tolerated"
    return
  fi

  if [ "$status" != "200" ]; then
    echo "FAIL  ${path} — expected 200, got ${status}"
    head -c 200 /tmp/smoke-body 2>/dev/null | sed 's/^/      /'
    FAILED=1; return
  fi

  case "$ctype" in
    application/json*) ;;
    *)
      echo "FAIL  ${path} — expected JSON, got content-type '${ctype}'"
      FAILED=1; return
      ;;
  esac

  echo "ok    ${path}"
}

echo "Smoke-testing ${BASE}"
for r in "${ROUTES[@]}"; do check "$r"; done
# /v1/gardens proxies Overpass, which is externally flaky. A 502 is an upstream
# problem, not a bad deploy — but an HTML challenge response still fails.
check "/v1/gardens" tolerate-502

if [ "$FAILED" -ne 0 ]; then
  echo "Smoke test FAILED for ${BASE}"
  exit 1
fi
echo "All routes healthy."
