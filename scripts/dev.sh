#!/usr/bin/env bash
#
# dev.sh — run the full Ridge to Coast stack locally on one origin.
#
#   http://localhost:8000        frontend (app/)
#   http://localhost:8000/v1/*   proxied to `wrangler dev` on 127.0.0.1:8787
#
# Wrangler is fetched by npx into its own cache. Nothing is installed into the
# repo, so the zero-npm rule (no package.json, no node_modules) still holds.
#
# Usage:
#   ./scripts/dev.sh              frontend + local API
#   ./scripts/dev.sh --no-api     frontend only (no wrangler, no D1)
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRANGLER_VERSION="4"
APP_PORT="${APP_PORT:-8000}"
API_PORT="${API_PORT:-8787}"
D1_BINDING="DB"
SCHEMA_FILE="$REPO_ROOT/infra/d1/schema.sql"

WITH_API=1
for arg in "$@"; do
  case "$arg" in
    --no-api) WITH_API=0 ;;
    -h|--help)
      sed -n '3,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

API_PID=""
cleanup() {
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd "$REPO_ROOT"

if [[ "$WITH_API" -eq 1 ]]; then
  # Apply the D1 schema to the local SQLite store. Safe to repeat: the schema
  # uses CREATE TABLE IF NOT EXISTS.
  if [[ -f "$SCHEMA_FILE" ]]; then
    echo "[dev] applying D1 schema to the local store..."
    npx --yes "wrangler@$WRANGLER_VERSION" d1 execute "$D1_BINDING" \
      --env dev --local --file "$SCHEMA_FILE" >/dev/null
  fi

  # Braces are required: a bare $API_PORT followed by the multibyte ellipsis is
  # parsed as part of the variable name, which `set -u` then rejects.
  echo "[dev] starting wrangler dev on 127.0.0.1:${API_PORT}..."
  npx --yes "wrangler@$WRANGLER_VERSION" dev \
    --env dev --local --ip 127.0.0.1 --port "$API_PORT" &
  API_PID=$!

  # Give workerd a moment to bind before the proxy starts forwarding to it.
  # If it is not up yet the dev server returns a 502 with a hint, not a crash.
  sleep 2
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "[dev] wrangler exited during startup — see the output above." >&2
    exit 1
  fi

  # Not exec: the EXIT trap has to survive so wrangler is killed with us.
  node "$REPO_ROOT/scripts/dev-server.mjs" \
    --port="$APP_PORT" --api="http://127.0.0.1:$API_PORT"
else
  node "$REPO_ROOT/scripts/dev-server.mjs" --port="$APP_PORT" --no-api
fi
