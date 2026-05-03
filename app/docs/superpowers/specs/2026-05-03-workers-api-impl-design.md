# Workers API Implementation + Frontend Wiring — Design

**Status:** Draft
**Date:** 2026-05-03
**Scope:** Phase 4 (workers/`/v1/{ecoregion,calendar,plants}` real implementations) + Phase 5 (minimal frontend wiring; Overpass behind a new `/v1/gardens` proxy).

---

## 1. Summary

The Cloudflare Workers API at `workers/` currently serves three stub endpoints that return hardcoded "hello world" payloads. The data those endpoints should expose already exists in `app/lib/geo-data.js` (`NATIVE_PLANTS`, `PLANTING_CALENDAR`, region polygons, watershed polygons, soil/invasive lookups). This work:

1. Extracts a pure shared core at `app/lib/geo-data-core.js` so Workers can import the data and helpers Wrangler will bundle.
2. Replaces the three stub handlers with real implementations.
3. Adds a fourth endpoint, `GET /v1/gardens`, that proxies the Overpass community-gardens query the frontend currently makes directly. Edge-cached for 24 h.
4. Wires the frontend to call `/v1/gardens` instead of `https://overpass-api.de` and updates the CSP accordingly.
5. Reconciles the OpenAPI spec with the data shapes that actually ship.
6. Adds `node --test workers/tests/*` coverage for handler logic.

The frontend popups for ecoregion/calendar/plants stay synchronous and keep using bundled `geo-data.js` data; we do not refactor `map.js` to fetch over the network for data it already has.

---

## 2. Decisions

| # | Question | Decision | Notes |
|---|---|---|---|
| 1 | How do Workers access bundled data? | Extract pure core at `app/lib/geo-data-core.js` (option B). | `geo-data.js` re-exports the core surface; `window.GeoData` and `module.exports` keep their existing shape. |
| 2 | How does `/v1/ecoregion` determine `zone`? | Nearest-CORRIDOR_CITIES lookup (option A). | Matches frontend's current behavior at `map.js:416`. Real point-in-polygon against `hardiness.geojson` is backlogged. |
| 3a | `PLANTING_CALENDAR` shape (no `harvest`/`notes`)? | Drop `harvest` and `notes` from OpenAPI to match data (3a-i). | Future scope: harvest/prune/water/fertilize/transplant guidance — design schema to extend cleanly when that data lands. |
| 3b | `NATIVE_PLANTS.type` enum mismatch? | Update OpenAPI enum to `[tree, shrub, perennial, grass, fern, vine]` to match data (3b-i). | Data is the de facto source of truth; spec was aspirational. |
| 4 | Phase 5 wiring scope? | Minimal wiring + Overpass-via-`/v1/gardens` (option D). | No refactor of `map.js` for ecoregion/calendar/plants; popups stay synchronous. |
| 5 | Where does the shared core live? | `app/lib/geo-data-core.js` (option A). | Co-located with its primary consumer; Workers reach in via relative path. |
| 6 | `/v1/gardens` design? | Fixed-BBOX `GET /v1/gardens` (6a-i), worker normalizes (6b-i), `caches.default` 24 h TTL (6c-i). | Smallest blast radius, biggest cache-hit win, no extra infra. |
| 7 | Worker testing approach? | `node --test workers/tests/*` unit tests (option A). | `wrangler dev` integration tests are backlogged. |
| 8 | `/v1/ecoregion` outside-coverage behavior? | 404 outside the eastern-US BBOX (option A). | A public API should refuse to lie. |

---

## 3. Architecture

Three layers, with a single source of truth for data:

```
┌──────────────────────────────────────────────────────────────┐
│ workers/ (Cloudflare Workers, ESM, bundled by wrangler)      │
│   index.js → routes /v1/{ecoregion,calendar,plants,gardens}  │
│   ecoregion.js  calendar.js  plants.js  gardens.js           │
│                            │ imports                         │
└────────────────────────────┼─────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────┐
│ app/lib/geo-data-core.js (NEW — pure data + pure helpers)    │
│   data: NATIVE_PLANTS, PLANTING_CALENDAR, region polygons,   │
│         CORRIDOR_CITIES, WATERSHEDS_GEOJSON, SOIL_TYPES,     │
│         INVASIVE_SPECIES, REGION_LABELS, BBOX_*, FALL_LINE_* │
│   pure fns: pointInPolygon, classifyLocation,                │
│             lookupWatershed, haversineKm, nearestCorridorCity│
│   dual-format: module.exports = {…}; globalThis.GeoDataCore  │
│                            ▲                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │ requires + re-exports
┌────────────────────────────┼─────────────────────────────────┐
│ app/lib/geo-data.js (EXISTING — public surface unchanged)    │
│   - imports everything from geo-data-core.js                 │
│   - keeps HTML generators (makeRegionDetailHTML, etc.)       │
│   - keeps map-only constants (STYLES, MAJOR_RIVERS_GEOJSON,  │
│     NE_FALL_ZONE_*, etc.)                                    │
│   - re-exports the core surface so window.GeoData and        │
│     module.exports.* work exactly as today                   │
└──────────────────────────────────────────────────────────────┘
```

### Invariants

- `app/lib/geo-data.js` public surface (`window.GeoData` and `module.exports`) is byte-compatible with today. All 308 unit tests and all `gd.*` references in `map.js` keep working without edits.
- `app/lib/geo-data-core.js` has no DOM, no Leaflet, no `fetch`, no HTML generators — pure data + pure functions only. This is the property that lets it bundle into a Worker.
- Workers depend on `app/lib/geo-data-core.js` via relative ESM import. Wrangler bundles it; no separate build step.
- `app/data/*.geojson` files are unchanged. They are loaded only by the browser as visual overlays — Workers do not need them.

### Module format

`geo-data-core.js` uses CommonJS at the bottom (`module.exports = {…}`) plus a `globalThis.GeoDataCore` assignment for browser script-tag loading. Wrangler/esbuild handles default-import of CommonJS in the workers (`import core from '../app/lib/geo-data-core.js'`). This matches the existing pattern in `geo-data.js`.

---

## 4. Per-endpoint design

### 4.1 `GET /v1/ecoregion?lat={number}&lon={number}`

**Validation:**

- `lat`, `lon` required, must parse as numbers → 400 otherwise.
- BBOX check: `lat ∈ [24, 49]`, `lon ∈ [-92.2, -66.5]` → 404 with `{error: "Coordinate outside coverage area"}` outside.

**Data flow** (all sync, all from `geo-data-core`):

1. `region = classifyLocation(lat, lon)` → key like `'piedmont'`.
2. `name = REGION_LABELS[region]` → `'Piedmont'`.
3. `zone = nearestCorridorCity(lat, lon).zone || '7b'` (matches frontend logic at `map.js:416`).
4. `watershed = lookupWatershed(lat, lon)` → `{name, ...}` or `null`.
5. `soilSeries = SOIL_TYPES[region]?.series` (string or null).
6. `nativePlants = NATIVE_PLANTS[region].slice(0, 3).map(p => p.name)` — top-3 names; full list lives in `/v1/plants`.
7. `invasives = (INVASIVE_SPECIES[region] ?? []).map(s => s.name)`. (`INVASIVE_SPECIES[region]` is itself an array of `{name, latin, type, threat, note}` — no `.species` indirection.)

**Response (200):**

```json
{
  "lat": 37.54, "lon": -77.43,
  "region": "piedmont", "name": "Piedmont",
  "zone": "7b",
  "soilSeries": "Cecil–Appling clay loam",
  "nativePlants": ["Post Oak", "Winged Elm", "Carolina Silverbell"],
  "invasives": ["Tree of Heaven", "Japanese Honeysuckle"],
  "watershedName": "Upper James River"
}
```

`watershedName` is `null` if the point is inside coverage but outside any HUC8 polygon. `soilSeries` is `null` if `SOIL_TYPES[region]` lacks a `series` field.

### 4.2 `GET /v1/calendar?zone={string}&month={1..12}`

**Validation:**

- `zone` required string. If not a key in `PLANTING_CALENDAR` → 404.
- `month` required integer in `1..12` → 400 otherwise.

**Data flow:**

1. `monthAbbrev = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][month - 1]`.
2. `entry = PLANTING_CALENDAR[zone][monthAbbrev]` → `{startIndoors, directSow, transplant}`.

**Response (200):**

```json
{
  "zone": "7b", "month": 4, "monthName": "April",
  "startIndoors": ["Tomatoes", "Peppers"],
  "directSow": ["Lettuce", "Peas"],
  "transplant": ["Onions", "Broccoli"]
}
```

No `harvest`/`notes` fields per decision 3a-i. Future scope adds them.

### 4.3 `GET /v1/plants?region={string}&type={string?}`

**Validation:**

- `region` required. If not a key in `NATIVE_PLANTS` → 404.
- `type` optional. Must be one of `tree, shrub, perennial, grass, fern, vine` → 400 otherwise.

**Data flow:**

1. `plants = NATIVE_PLANTS[region]`.
2. If `type` given: `plants = plants.filter(p => p.type === type)`.

**Response (200):**

```json
{
  "region": "piedmont",
  "type": null,
  "plants": [
    {"name": "Post Oak", "latin": "Quercus stellata", "type": "tree", "note": "..."}
  ]
}
```

### 4.4 `GET /v1/gardens` (NEW — Overpass proxy)

**Validation:** none required (no params).

**Data flow:**

1. `cache = caches.default`; `cacheKey = new Request(request.url)` (URL-only key — same key for all callers).
2. `hit = await cache.match(cacheKey)`. If present, return clone (fast path).
3. Build Overpass QL with fixed BBOX (port `buildGardenQuery` from `map.js:766`):
   ```
   [out:json][timeout:25];
   (
     node["leisure"="garden"](BBOX);
     way["landuse"="allotments"](BBOX);
     node["shop"="garden_centre"]["plant:native"="yes"](BBOX);
   );
   out center;
   ```
4. `POST https://overpass-api.de/api/interpreter` with the query as body.
5. On non-2xx or fetch error: return `{error: "Upstream Overpass unavailable"}` with status 502. **Do not** write 502 to cache.
6. Parse JSON, normalize each element via ported `normalizeGardenElement` + `gardenDisplayName` + `gardenTypeLabel` + `gardenAddress` → `[{osmId, lat, lon, name, type, address}]`.
7. Sort by name; dedupe by `osmId`.
8. Build response with `Cache-Control: public, max-age=86400, s-maxage=86400`.
9. `await cache.put(cacheKey, response.clone())`.
10. Return response.

**Response (200):**

```json
{
  "bbox": {"south": 24, "west": -92.2, "north": 49, "east": -66.5},
  "count": 487,
  "gardens": [
    {"osmId": "node-12345", "lat": 37.54, "lon": -77.43,
     "name": "Maymont Community Garden", "type": "garden",
     "address": "1700 Hampton St"}
  ]
}
```

### 4.5 Router (`workers/index.js`)

- Add `/v1/gardens` route alongside the existing three.
- Update root `/` response `endpoints` list to include `'/v1/gardens'`.
- CORS handling unchanged (already correct).

**Handler signature change:** today's handlers take `URLSearchParams` (`handle*(url.searchParams)`). `/v1/gardens` needs the full `Request` to use `caches.default.match(request)` as a cache key. To keep the router uniform, **change all four handlers to take `(request)` and extract `params` themselves** (one line per handler: `const params = new URL(request.url).searchParams;`). The router becomes:

```js
if (path.startsWith('/v1/ecoregion')) response = await handleEcoregion(request);
else if (path.startsWith('/v1/calendar')) response = await handleCalendar(request);
else if (path.startsWith('/v1/plants'))   response = await handlePlants(request);
else if (path.startsWith('/v1/gardens'))  response = await handleGardens(request);
```

Update existing tests that call handlers with `URLSearchParams` to pass a `Request` instead. The `requestOf(queryString)` test helper (§5.3) returns a `Request` whose URL carries the query string.

---

## 5. Errors, OpenAPI, testing

### 5.1 Error handling

| Status | Body | When |
|---|---|---|
| 200 | success payload | normal |
| 400 | `{error: "..."}` | missing/malformed param (non-numeric `lat`/`lon`, `month` out of range, unknown plant `type`) |
| 404 | `{error: "..."}` | coordinate outside coverage, unknown zone, unknown region |
| 502 | `{error: "Upstream Overpass unavailable"}` | `/v1/gardens` only — Overpass returned non-2xx, timed out, or `fetch` threw. Not cached. |
| 500 | `{error: "Internal error"}` | each handler wrapped in `try/catch`; logged via `console.error`; generic body. |

`console.error` writes to `wrangler tail` and Cloudflare observability — sufficient for v1.

### 5.2 OpenAPI updates (`api/openapi.yaml`)

- Bump `info.version` from `1.0.0` → `1.1.0`.
- `/v1/ecoregion`: add `404` response; add `lat`/`lon` echo to `EcoregionResponse` schema.
- `/v1/calendar`: drop `harvest` and `notes` from `CalendarResponse` (3a-i).
- `/v1/plants`: update `type` enum to `[tree, shrub, perennial, grass, fern, vine]` (3b-i, both query parameter and response shape).
- `/v1/gardens` (new): document path, `GardensResponse` schema, 24 h cache, `502` upstream response.

### 5.3 Testing (`workers/tests/*.test.js`)

One test file per handler plus one for the router. CI step added to `.github/workflows/test.yml`: `node --test workers/tests/` after the existing `node --test app/tests/geo.test.js`.

**Coverage targets:**

- `ecoregion.test.js` — happy path (Richmond VA → piedmont, 7b, James watershed); each region key reachable via a known interior point; BBOX edge cases (just inside vs. just outside → 200 / 404); missing/non-numeric params → 400; watershed `null` when point is inside coverage but outside any HUC8 polygon.
- `calendar.test.js` — happy path; unknown zone → 404; month bounds (`0`, `13`, `"abc"`) → 400; spot-check a known cell (zone `7b` April should include `"Tomatoes"` in `startIndoors`).
- `plants.test.js` — happy path; unknown region → 404; type filter narrows results; unknown type → 400; case sensitivity locked.
- `gardens.test.js` — mock `globalThis.fetch` to return canned Overpass JSON; assert normalization (osmId format, sort order, dedupe, missing `lat/lon` skipped); assert `Cache-Control: max-age=86400` header set; mock fetch failure → 502; response has correct `bbox` and `count`. We do not test `caches.default` directly — that is Workers runtime; mocking is more trouble than the value.
- `index.test.js` — unknown path → 404; OPTIONS → CORS preflight 200; CORS headers on every response; root `/` lists all four endpoints.

**Test helpers:** `workers/tests/_helpers.js` exports `requestOf(queryString)` returning a `Request` (e.g., `new Request('https://api.ridgetocoast.com/v1/ecoregion?lat=37.5&lon=-77.4')`), and `mockFetch(handler)` that swaps `globalThis.fetch` and restores in teardown. (Handlers take `Request` per §4.5.)

**Estimated test count:** ~30–40 new unit tests.

---

## 6. Phase 5 — frontend wiring

Per decision 4 (option D): only swap the Overpass call. Bundled data stays in `geo-data-core` and the popups stay synchronous.

### 6.1 `app/map.js`

Replace Overpass POST with `/v1/gardens` GET in `ensureGardensLoaded()` (around line 789):

```js
gardensRequest = fetch(API_BASE + '/v1/gardens')
  .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
  .then(data => {
    gardensCache = data.gardens; // already normalized server-side
    gardensIndex = Object.fromEntries(data.gardens.map(g => [g.osmId, g]));
    gardensLayer = buildGardensLayer(data.gardens);
    return gardensCache;
  })
  .finally(() => { gardensRequest = null; });
```

Delete from `map.js`: `buildGardenQuery`, `normalizeGardenElement`, `gardenDisplayName`, `gardenTypeLabel`, `gardenAddress` — these now live in `workers/gardens.js`. Estimate: ~80 lines removed.

### 6.2 `app/index.html` CSP

Update `connect-src` in the meta tag:

- Remove: `https://overpass-api.de`.
- Add: `https://api.ridgetocoast.com https://preprod.ridgetocoast.com https://alpha.ridgetocoast.com`.

All three hosts are needed because the same `index.html` is served from prod, preprod, and alpha Pages environments and `API_BASE` resolves to the matching API host per `map.js:21`.

### 6.3 E2E impact

Existing gardens E2E tests should pass unmodified — they exercise the toggle and the popup, both of which are unchanged at the user-visible layer. Verify locally before pushing.

---

## 7. File plan

### New files

| Path | Purpose |
|---|---|
| `app/lib/geo-data-core.js` | Shared pure data + helpers; dual-format (CommonJS + `globalThis`). |
| `workers/gardens.js` | `/v1/gardens` handler + Overpass query/normalization helpers. |
| `workers/tests/_helpers.js` | `requestOf`, `mockFetch`. |
| `workers/tests/ecoregion.test.js` | |
| `workers/tests/calendar.test.js` | |
| `workers/tests/plants.test.js` | |
| `workers/tests/gardens.test.js` | |
| `workers/tests/index.test.js` | Router/CORS tests. |

### Modified files

| Path | Change |
|---|---|
| `app/lib/geo-data.js` | Move shared constants/fns to `geo-data-core.js`; re-export them. HTML generators and map-only constants stay. |
| `workers/index.js` | Add `/v1/gardens` route; update root response `endpoints` list. |
| `workers/ecoregion.js` | Replace stub with real implementation (§4.1). |
| `workers/calendar.js` | Replace stub with real implementation (§4.2). |
| `workers/plants.js` | Replace stub with real implementation (§4.3). |
| `app/map.js` | Swap Overpass for `/v1/gardens`; delete normalization helpers. |
| `app/index.html` | CSP `connect-src` update (§6.2). |
| `api/openapi.yaml` | Version `1.1.0`; new `/gardens`; schema corrections per 3a-i and 3b-i. |
| `.github/workflows/test.yml` | Add `node --test workers/tests/` step. |

### Unchanged

`app/data/*.geojson`, `wrangler.toml`, `.github/workflows/deploy-workers.yml`, `.github/workflows/promote-workers.yml`, `infra/`.

---

## 8. Deployment & rollout

The existing pipeline handles staged deploy:

1. **PR open** → `deploy-workers.yml` deploys to `preprod.ridgetocoast.com`. Manual smoke test:
   - `https://preprod.ridgetocoast.com/v1/ecoregion?lat=37.54&lon=-77.43` → 200 piedmont.
   - `https://preprod.ridgetocoast.com/v1/calendar?zone=7b&month=4` → 200.
   - `https://preprod.ridgetocoast.com/v1/plants?region=piedmont&type=tree` → 200.
   - `https://preprod.ridgetocoast.com/v1/gardens` → 200, `count > 0`.
   - `https://preprod.ridgetocoast.com/v1/ecoregion?lat=40&lon=-120` → 404 (outside coverage).
2. **Merge to `main`** → `deploy-workers.yml` runs `wrangler versions upload --env production` (staged, **not live**); `deploy-pages.yml` deploys frontend.
3. **Manual gate** → run "Promote / Rollback Workers API" workflow → routes 100% traffic to the new version on `api.ridgetocoast.com`.
4. **Rollback** → same workflow with previous version ID.

### Order-of-operations: promote-then-frontend

The frontend Pages deploy goes live as soon as `main` merges, but the Workers API stays on the old version until promoted. For the window between merge and promote, the new frontend hits `api.ridgetocoast.com/v1/gardens`, which the **old** Worker does not serve — gardens layer fails to load.

**Required ordering:**

1. Merge to `main`.
2. **Immediately** run the promote workflow to ship the new Worker version to `api.ridgetocoast.com`.
3. Wait for both `deploy-pages.yml` and the promote run to complete.
4. Confirm `https://ridgetocoast.com` shows working gardens layer.

This ordering is a human-in-the-loop concern; the pipeline does not enforce it. The PR description must call it out explicitly. If the promote step is delayed, gardens-layer toggling breaks during the gap (other layers and popups continue to work).

Alternative if a longer gap is acceptable: split into two PRs — first PR ships the Workers (router + four handlers + tests + OpenAPI), promote, then a follow-up PR ships the frontend wiring + CSP change. That eliminates the window at the cost of an extra PR.

---

## 9. Out of scope / future work

- **Real point-in-polygon hardiness lookup** against `data/hardiness.geojson` (decision 2 backlog item). Worth doing once a user reports a wrong zone in a region without a corridor city.
- **Calendar enrichment:** `harvest`, `notes`, plus the broader vision of `prune`, `water`, `fertilize`, `transplant` per-month-per-zone guidance. Schema design should keep the existing `{startIndoors, directSow, transplant}` keys and add new optional arrays alongside. That makes adding fields backward-compatible.
- **`wrangler dev` integration tests** (decision 7 backlog item). Useful once we have more handlers or middleware.
- **Proxy NWS / iNaturalist / USGS through Workers** (decision 4 option B). Worth doing only if we need centralized caching or want to drop those origins from the CSP. Today's direct calls work and are documented in `app/CLAUDE.md`.
- **Per-bbox or per-radius `/v1/gardens` variants** (decision 6 options 6a-ii / 6a-iii). Adds caller flexibility but breaks the simple full-set caching model.

---

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Wrangler bundle size grows beyond 3 MB compressed (free tier) | Low | Worker fails to deploy | The bundled core is mostly JS data (NATIVE_PLANTS, PLANTING_CALENDAR, CORRIDOR_CITIES, region polygons, watersheds, soils, invasives). Estimated <500 KB minified. Verify `wrangler deploy --dry-run` output during PR review. |
| `geo-data-core.js` extraction breaks unit tests | Medium | CI red on PR | Re-export every name through `geo-data.js` so its public surface is byte-compatible. Run `node --test app/tests/geo.test.js` locally before pushing. |
| CSP change blocks legitimate origin in preprod or alpha | Medium | Gardens layer fails on non-prod environments | Allow all three hostnames in `connect-src`. Verify each environment manually after merge. |
| Promote-then-frontend ordering missed | Medium | Gardens layer broken on prod for minutes/hours | Call out in PR description; assign a single owner to merge + promote in one sitting. Consider two-PR split. |
| Overpass schema drift breaks `normalizeGardenElement` | Low | `/v1/gardens` returns malformed entries | Worker tests cover known-good Overpass JSON shapes; `address`/`type`/`name` all defensively coerce missing tags to empty strings. |
| `caches.default` 24 h TTL hides Overpass outages from monitoring | Low | Stale data persists | Acceptable trade-off; gardens data changes rarely. Manual cache purge available via Cloudflare dashboard if needed. |

---

## 11. Open questions

None at design time. All clarifying questions resolved (see §2).
