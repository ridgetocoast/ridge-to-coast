# Session Handoff

## Current state (2026-05-06)

Brainstorming for **Phase 4 (Workers API impl) + Phase 5 (frontend wiring)** is complete. The design spec is written, self-reviewed, and committed.

- **Spec:** `app/docs/superpowers/specs/2026-05-03-workers-api-impl-design.md`
- **Branch:** `claude/workers-api-impl` (commit `adf344e`, off `main`)
- **Working tree:** spec committed; `CLAUDE.md` and `app/CLAUDE.md` have unstaged edits adding handoff pointers (intentional).
- **Status:** ready for `/superpowers:writing-plans` to produce an implementation plan from the spec.

## Scope summary

Replace the three Workers stub endpoints (`/v1/ecoregion`, `/v1/calendar`, `/v1/plants`) with real implementations backed by data extracted from `app/lib/geo-data.js` into a new shared core. Add a fourth endpoint, `/v1/gardens`, that proxies the Overpass community-gardens query the frontend currently makes directly (24 h edge cache via `caches.default`). Wire `app/map.js` to the new `/v1/gardens` endpoint and update the CSP. Reconcile the OpenAPI spec with the data shapes that actually ship.

Frontend popups for ecoregion/calendar/plants stay synchronous and keep using bundled `geo-data.js` data — no async refactor of `map.js` for those.

## Decisions log (full reasoning in §2 of the spec)

| # | Decision |
|---|---|
| 1 | Shared core extracted to `app/lib/geo-data-core.js`; `geo-data.js` re-exports it so `window.GeoData` and `module.exports` stay byte-compatible. |
| 2 | `/v1/ecoregion` zone uses **nearest-CORRIDOR_CITIES** (matches `map.js:416`). Real point-in-polygon against `hardiness.geojson` is backlogged. |
| 3a | Drop `harvest` and `notes` from OpenAPI `CalendarResponse` to match `PLANTING_CALENDAR` data. Future scope: harvest/prune/water/fertilize/transplant. |
| 3b | Update OpenAPI plant `type` enum to `[tree, shrub, perennial, grass, fern, vine]` to match `NATIVE_PLANTS` data. |
| 4 | Phase 5 wiring is minimal — only swap Overpass for `/v1/gardens`. Don't refactor popups to fetch bundled data over the network. |
| 5 | Shared core lives at `app/lib/geo-data-core.js` (workers reach in via relative path). |
| 6 | `/v1/gardens`: fixed-BBOX `GET`, worker normalizes response, 24 h `caches.default` TTL. |
| 7 | Worker tests via `node --test workers/tests/*`; `wrangler dev` integration tests backlogged. |
| 8 | `/v1/ecoregion` returns 404 outside the eastern-US BBOX (`lat ∈ [24, 49]`, `lon ∈ [-92.2, -66.5]`). |

## Architecture decision: handler signature change

All four worker handlers will take `(request)` (a `Request` object) rather than today's `(params)` (URLSearchParams). This is needed because `/v1/gardens` uses `caches.default.match(request)`. Existing tests will need to swap `URLSearchParams` for `Request`. See spec §4.5.

## File plan (new + modified)

**New files**

- `app/lib/geo-data-core.js` — pure data + helpers, dual-format CommonJS + `globalThis`.
- `workers/gardens.js` — handler + Overpass query + normalization.
- `workers/tests/_helpers.js` — `requestOf(queryString)`, `mockFetch(handler)`.
- `workers/tests/{ecoregion,calendar,plants,gardens,index}.test.js`.

**Modified files**

- `app/lib/geo-data.js` — re-export the core surface, keep HTML generators and map-only constants.
- `workers/index.js` — add `/v1/gardens` route; pass `request` to handlers.
- `workers/{ecoregion,calendar,plants}.js` — replace stubs with real implementations.
- `app/map.js` — swap Overpass for `${API_BASE}/v1/gardens`; delete `buildGardenQuery`, `normalizeGardenElement`, `gardenDisplayName`, `gardenTypeLabel`, `gardenAddress` (~80 lines removed).
- `app/index.html` — CSP `connect-src`: remove `https://overpass-api.de`; add `https://api.ridgetocoast.com https://preprod.ridgetocoast.com https://alpha.ridgetocoast.com`.
- `api/openapi.yaml` — bump to `1.1.0`; add `/gardens`; schema corrections per 3a-i and 3b-i.
- `.github/workflows/test.yml` — add `node --test workers/tests/`.

**Unchanged:** `app/data/*.geojson`, `wrangler.toml`, deploy/promote workflows, `infra/`.

## Critical: deploy ordering note

Frontend Pages goes live on merge; Workers stay on the old version until the **promote-workers.yml** workflow is run. The new frontend will hit `api.ridgetocoast.com/v1/gardens`, which the **old** Worker doesn't serve, so the gardens layer breaks during the gap.

**Required ordering after merging:**

1. Merge to `main`.
2. Immediately run "Promote / Rollback Workers API" to ship the new Worker version.
3. Wait for both `deploy-pages.yml` and the promote run to complete.
4. Verify `https://ridgetocoast.com` shows a working gardens layer.

The PR description must call this out. Alternative: split into two PRs — Workers first (promote, verify), then frontend wiring + CSP.

## Status: implemented (2026-05-16)

Plan: `app/docs/superpowers/plans/2026-05-06-workers-api-impl.md`. All 15 tasks complete on branch `claude/workers-api-impl`; ready for PR.

Final test sweep:
- `node --test app/tests/geo.test.js` → 335 pass (test count was 335, not 308 as guessed)
- `node --test workers/tests/*.test.js` → 27 pass
- `pytest app/tests/e2e/test_map.py` → 42 pass (gardens-layer test now mocks `/v1/gardens`)
- `wrangler deploy --dry-run --env preview` → 42.41 KiB gzip (well under 3 MB limit)

Note: `app/tests/pipeline.test.js` fails identically on `main` — pre-existing bug, not gated by CI (test.yml only runs `geo.test.js`).

## Reminder for merger

**Promote-then-frontend ordering** is load-bearing for the gardens layer:

1. Merge PR.
2. Immediately run Actions → "Promote / Rollback Workers API" → `promote` + `production`.
3. Confirm `https://ridgetocoast.com` gardens layer works.

If promote is delayed, the new frontend's `/v1/gardens` call hits the old Worker (which doesn't serve that route) until promote completes.

---

## Next: Cloudflare Infra as Code — Terraform (Sub-project 1)

- **Spec:** `app/docs/superpowers/specs/2026-05-18-cloudflare-infra-terraform-design.md`
- **Plan:** `app/docs/superpowers/plans/2026-05-18-cloudflare-infra-terraform.md`
- **Scope:** `infra/terraform/` becomes the authoritative producer of 3 rotating
  CI tokens, 5 GitHub Environments + `CLOUDFLARE_API_TOKEN`, and managed
  DNS/TLS/account config. `terraform plan` is the drift gate.

### §11 interface contract for Sub-project 2 (the release/smoke pipeline)

Sub-project 2 may assume, and must align with, exactly this:

- GitHub Environments exist: `production` (branch policy = `main`), `preview`,
  `alpha`, `audit` — each exposing secret `CLOUDFLARE_API_TOKEN`.
- Cloudflare account id is read from `wrangler.toml`, **not** a secret.
- Repo-level `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_PREVIEW_API_TOKEN`, and
  `CLOUDFLARE_ACCOUNT_ID` are **deleted by Sub-project 1's apply**. The pipeline
  PR that switches workflows to environment-scoped secrets must merge in
  lockstep with that apply. **This ordering coupling is the top integration
  risk.**
- Re-scoping `scripts/audit-cloudflare-config.mjs` to runtime-only facts is
  Sub-project 2's task (untouched here).
