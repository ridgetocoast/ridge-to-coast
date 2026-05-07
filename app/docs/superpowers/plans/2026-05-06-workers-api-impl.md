# Workers API Impl + Frontend Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three Cloudflare Worker stub endpoints with real implementations backed by data extracted from `app/lib/geo-data.js`, add a fourth `/v1/gardens` Overpass-proxy endpoint, wire the frontend to it, and reconcile OpenAPI to match shipped data shapes.

**Architecture:** Extract a pure shared core (`app/lib/geo-data-core.js`) that both the browser (via `globalThis`) and Workers (via `import core from '../app/lib/geo-data-core.js'`) consume. `geo-data.js` becomes a re-exporter that keeps HTML generators and map-only constants. Workers handlers all take `Request` (uniform signature lets `/v1/gardens` use `caches.default.match(request)`). Frontend popups stay synchronous against bundled data; only the gardens layer becomes a network call.

**Tech Stack:** Cloudflare Workers (ESM, wrangler-bundled), Leaflet 1.9.4 (frontend, vendored), Node `node:test` (unit tests, zero npm), Python Playwright + pytest (E2E), Cloudflare `caches.default` (24 h edge cache).

**Spec:** [`app/docs/superpowers/specs/2026-05-03-workers-api-impl-design.md`](../specs/2026-05-03-workers-api-impl-design.md)

---

## Sequencing & Parallelism

Three sequential phases bracket one parallel-safe block:

```
Phase A — Foundation (sequential, blocks everything)
  T1: Extract geo-data-core.js  ← HARD GATE: 335 unit tests must pass
  T2: Scaffold workers/tests/_helpers.js
  T3: Atomic handler signature refactor + /v1/gardens route + stub

Phase B — Endpoint implementations (parallel-safe; T4–T7 independent)
  T4: /v1/ecoregion impl + tests
  T5: /v1/calendar impl + tests
  T6: /v1/plants impl + tests
  T7: /v1/gardens impl + tests
  T8: Router/CORS index tests (sequential after T7)
  T9: OpenAPI reconciliation (parallel-safe with T4–T8)

Phase C — CI + bundle checkpoint (sequential)
  T10: Add `node --test workers/tests/` to CI
  T11: `wrangler deploy --dry-run --env preview` bundle size check

Phase D — Frontend wiring (sequential, must follow Phase B)
  T12: CSP update (index.html)
  T13: Wire map.js to /v1/gardens; delete normalization helpers; update E2E mock

Phase E — Final verification + PR
  T14: Full test sweep
  T15: Open PR with promote-then-frontend ordering callout
```

**Parallel-safe block:** T4, T5, T6, T7 can be dispatched concurrently to subagents once T3 lands. T9 is independent of all handler work.

**Hard gates (do not proceed past until green):**

| Gate | Command | Pass criteria |
|---|---|---|
| Geo-core extraction | `node --test app/tests/geo.test.js` | 335 tests pass, 0 fail |
| Per-handler tests | `node --test workers/tests/<name>.test.js` | All new tests pass |
| All worker tests | `node --test workers/tests/` | All tests pass |
| E2E gardens still passes | `pytest app/tests/e2e/test_map.py::test_gardens_toggle_loads_and_routes_to_detail` | passes |
| Bundle size | `wrangler deploy --dry-run --env preview` | < 3 MB compressed |

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `app/lib/geo-data-core.js` | Pure data + pure helpers. Zero DOM, Leaflet, fetch, HTML. IIFE-wrapped, dual-format (`globalThis.GeoDataCore` + `module.exports`). Single source of truth for region/calendar/plants/watershed data. |
| `workers/gardens.js` | `/v1/gardens` handler. Builds Overpass QL, POSTs to `https://overpass-api.de/api/interpreter`, normalizes elements, edge-caches via `caches.default` (24 h). |
| `workers/tests/_helpers.js` | `requestOf(queryString)` returning a `Request`; `mockFetch(handler)` swap+restore for `globalThis.fetch`. |
| `workers/tests/ecoregion.test.js` | Validation, BBOX edges, region coverage, watershed null. |
| `workers/tests/calendar.test.js` | Validation, month bounds, known-cell spot checks. |
| `workers/tests/plants.test.js` | Validation, type filter, case sensitivity. |
| `workers/tests/gardens.test.js` | Mock-fetch happy path, normalization, sort, dedupe, 502 on upstream failure, `Cache-Control` header. |
| `workers/tests/index.test.js` | Unknown path → 404, OPTIONS preflight, CORS headers, root `/` lists four endpoints. |

### Modified files

| Path | Change |
|---|---|
| `app/lib/geo-data.js` | Read shared symbols from `geo-data-core.js`; keep HTML generators and map-only constants. Public `window.GeoData` and `module.exports` shapes unchanged (byte-compatible). |
| `app/index.html` | (a) Add `<script src="lib/geo-data-core.js">` before `lib/geo-data.js`. (b) CSP `connect-src`: remove `https://overpass-api.de`; add `https://api.ridgetocoast.com https://preprod.ridgetocoast.com https://alpha.ridgetocoast.com`. |
| `workers/index.js` | Add `/v1/gardens` route; pass `request` (not `url.searchParams`) to all four handlers; root `/` `endpoints` lists all four. |
| `workers/ecoregion.js` | Real implementation per spec §4.1. Signature: `handleEcoregion(request)`. |
| `workers/calendar.js` | Real implementation per spec §4.2. Signature: `handleCalendar(request)`. |
| `workers/plants.js` | Real implementation per spec §4.3. Signature: `handlePlants(request)`. |
| `app/map.js` | Replace Overpass POST with `GET ${API_BASE}/v1/gardens`; delete `buildGardenQuery`, `normalizeGardenElement`, `gardenDisplayName`, `gardenTypeLabel`, `gardenAddress`, `joinAddress` (~80 lines). |
| `app/tests/e2e/test_map.py` | Update `test_gardens_toggle_loads_and_routes_to_detail` to mock the new `/v1/gardens` shape (returns normalized `{gardens: [...]}` not raw Overpass `{elements: [...]}`). |
| `api/openapi.yaml` | Bump to `1.1.0`; add `/gardens`; drop `harvest`/`notes` from `CalendarResponse`; update plant `type` enum to `[tree, shrub, perennial, grass, fern, vine]`; add `404` + `lat`/`lon` echo to `EcoregionResponse`. |
| `.github/workflows/test.yml` | Add `- run: node --test workers/tests/` step after the existing geo.test.js step. |

### Unchanged

`app/data/*.geojson`, `wrangler.toml`, `.github/workflows/deploy-workers.yml`, `.github/workflows/promote-workers.yml`, `infra/`.

---

## Phase A — Foundation

### Task 1: Extract pure core to `app/lib/geo-data-core.js`

**Files:**
- Create: `app/lib/geo-data-core.js`
- Modify: `app/lib/geo-data.js`
- Modify: `app/index.html` (add script tag for core, before geo-data.js)
- Test: `app/tests/geo.test.js` (run, no edits)

**Symbols to MOVE from `geo-data.js` → `geo-data-core.js`** (data + pure helpers):

Constants:
`FALL_LINE_COORDS`, `EAST_COAST_COORDS`, `FALL_LINE_GEOJSON`, `COASTAL_PLAIN_GEOJSON`, `PIEDMONT_GEOJSON`, `BLUE_RIDGE_GEOJSON`, `VALLEY_RIDGE_GEOJSON`, `NE_UPLAND_GEOJSON`, `NE_COASTAL_GEOJSON`, `GREAT_LAKES_GEOJSON`, `INTERIOR_LOWLANDS_GEOJSON`, `GULF_COASTAL_GEOJSON`, `WATERSHEDS_GEOJSON`, `REGION_LABELS`, `BLUE_RIDGE_EAST_ESCARPMENT`, `BLUE_RIDGE_WEST_ESCARPMENT`, `BBOX_NORTH`, `BBOX_SOUTH`, `BBOX_EAST`, `BBOX_WEST`, `BBOX` (the `{NORTH,SOUTH,EAST,WEST}` object), `NATIVE_PLANTS`, `SOIL_TYPES`, `INVASIVE_SPECIES`, `PLANTING_CALENDAR`, `FALLBACK_VIEWS`, `CORRIDOR_CITIES`, `HARDINESS_ZONE_COLORS`, `HARDINESS_ZONE_INFO`, `REGION_INATURALIST_PLACE_IDS`.

Pure functions:
`pointInPolygon`, `classifyLocation`, `lookupWatershed`, `haversineKm`, `pickFallbackView`, `nearestCorridorCity`, `minDistanceToFallLine`, `getZoneColor`, `getZoneInfo`, `isValidUSZipCode`, `isInCorridor`, `buildSearchQuery`.

**Symbols to STAY in `geo-data.js`** (HTML generators + map-only):

`STYLES`, `NE_FALL_ZONE_GEOJSON`, `MAJOR_RIVERS_GEOJSON`, `makeNativePlantsSection`, `makeSoilSection`, `makeInvasivesSection`, `makeCalendarSection`, `getCurrentPlantingActivities`, `makeSeasonalCardShell`, `makeRegionPopup`, `makeFallLinePopup`, `makeRegionDetailHTML`, `makeFallLineDetailHTML`, `makeZoneDetailHTML`, `makeCityDetailHTML`, `makeGardenDetailHTML`, `makeLocationReport`, `makeZonePopup`, `makeMarkerPopup`, `makeRiverDetailHTML`.

> If a "stay" symbol depends on a moved symbol, it just reads it via `core.X` after rewiring (see step 1.4).

- [ ] **Step 1.1: Create `app/lib/geo-data-core.js` skeleton**

Create the file with an IIFE wrapper, dual-format export, and a comment block declaring the contract. (Mirroring the existing `geo-data.js` pattern so name collisions can't happen across the two scripts in the browser.)

```js
/**
 * geo-data-core.js — Pure shared data + helpers
 * ----------------------------------------------
 * Dependencies: NONE. No DOM, no Leaflet, no fetch, no HTML.
 *
 * Consumers:
 *   - Browser: loaded as <script> BEFORE lib/geo-data.js. Exposes globalThis.GeoDataCore.
 *   - Node tests / Workers: CommonJS — module.exports = GeoDataCore.
 *
 * geo-data.js reads from this module to keep its public surface byte-compatible.
 *
 * Wrapped in an IIFE so internal const/let do not collide with map.js or geo-data.js
 * top-level lexical bindings.
 */
(function () {
'use strict';

// ── Symbols moved from geo-data.js go here in step 1.2 / 1.3 ──

const GeoDataCore = {
  // populated in step 1.2 / 1.3
};

if (typeof globalThis !== 'undefined') globalThis.GeoDataCore = GeoDataCore;
if (typeof module !== 'undefined') module.exports = GeoDataCore;

}()); // end IIFE
```

- [ ] **Step 1.2: Move data constants**

Cut every constant in the "Constants" list above out of `app/lib/geo-data.js` and paste it inside the IIFE in `geo-data-core.js`. Add each name to the `GeoDataCore` object literal at the bottom.

> Keep the original ordering and comment blocks. Do NOT rename anything. The point of this task is a mechanical move, not a rewrite.

After moving, in `app/lib/geo-data.js`, immediately after the `'use strict';` line at the top of its IIFE, add a single accessor block that pulls every moved name back into the IIFE's local scope (so the un-moved HTML generators and the final `GeoData` export object continue to compile):

```js
'use strict';

// Pull shared symbols from the core module. In the browser this is loaded via
// the <script src="lib/geo-data-core.js"> tag; in Node tests it is required.
var __core = (typeof require !== 'undefined')
  ? require('./geo-data-core.js')
  : globalThis.GeoDataCore;

if (!__core) {
  throw new Error('geo-data-core.js failed to load — must precede geo-data.js in index.html');
}

var FALL_LINE_COORDS              = __core.FALL_LINE_COORDS;
var EAST_COAST_COORDS             = __core.EAST_COAST_COORDS;
var FALL_LINE_GEOJSON             = __core.FALL_LINE_GEOJSON;
var COASTAL_PLAIN_GEOJSON         = __core.COASTAL_PLAIN_GEOJSON;
var PIEDMONT_GEOJSON              = __core.PIEDMONT_GEOJSON;
var BLUE_RIDGE_GEOJSON            = __core.BLUE_RIDGE_GEOJSON;
var VALLEY_RIDGE_GEOJSON          = __core.VALLEY_RIDGE_GEOJSON;
var NE_UPLAND_GEOJSON             = __core.NE_UPLAND_GEOJSON;
var NE_COASTAL_GEOJSON            = __core.NE_COASTAL_GEOJSON;
var GREAT_LAKES_GEOJSON           = __core.GREAT_LAKES_GEOJSON;
var INTERIOR_LOWLANDS_GEOJSON     = __core.INTERIOR_LOWLANDS_GEOJSON;
var GULF_COASTAL_GEOJSON          = __core.GULF_COASTAL_GEOJSON;
var WATERSHEDS_GEOJSON            = __core.WATERSHEDS_GEOJSON;
var REGION_LABELS                 = __core.REGION_LABELS;
var BLUE_RIDGE_EAST_ESCARPMENT    = __core.BLUE_RIDGE_EAST_ESCARPMENT;
var BLUE_RIDGE_WEST_ESCARPMENT    = __core.BLUE_RIDGE_WEST_ESCARPMENT;
var BBOX_NORTH                    = __core.BBOX_NORTH;
var BBOX_SOUTH                    = __core.BBOX_SOUTH;
var BBOX_EAST                     = __core.BBOX_EAST;
var BBOX_WEST                     = __core.BBOX_WEST;
var NATIVE_PLANTS                 = __core.NATIVE_PLANTS;
var SOIL_TYPES                    = __core.SOIL_TYPES;
var INVASIVE_SPECIES              = __core.INVASIVE_SPECIES;
var PLANTING_CALENDAR             = __core.PLANTING_CALENDAR;
var FALLBACK_VIEWS                = __core.FALLBACK_VIEWS;
var CORRIDOR_CITIES               = __core.CORRIDOR_CITIES;
var HARDINESS_ZONE_COLORS         = __core.HARDINESS_ZONE_COLORS;
var HARDINESS_ZONE_INFO           = __core.HARDINESS_ZONE_INFO;
var REGION_INATURALIST_PLACE_IDS  = __core.REGION_INATURALIST_PLACE_IDS;
```

The final `const GeoData = {…}` export object at the bottom of `geo-data.js` stays unchanged — every key it lists is still bound (some now via `__core`, others still locally defined).

- [ ] **Step 1.3: Move pure helpers**

Cut every function in the "Pure functions" list out of `geo-data.js` and paste it into `geo-data-core.js` (still inside the IIFE). Add each name to the `GeoDataCore` object literal.

In `geo-data.js`, append to the accessor block from step 1.2:

```js
var pointInPolygon       = __core.pointInPolygon;
var classifyLocation     = __core.classifyLocation;
var lookupWatershed      = __core.lookupWatershed;
var haversineKm          = __core.haversineKm;
var pickFallbackView     = __core.pickFallbackView;
var nearestCorridorCity  = __core.nearestCorridorCity;
var minDistanceToFallLine = __core.minDistanceToFallLine;
var getZoneColor         = __core.getZoneColor;
var getZoneInfo          = __core.getZoneInfo;
var isValidUSZipCode     = __core.isValidUSZipCode;
var isInCorridor         = __core.isInCorridor;
var buildSearchQuery     = __core.buildSearchQuery;
```

Also update the `BBOX` shorthand object construction in the final export (it stays, but is now built from the pulled-through `BBOX_NORTH/SOUTH/EAST/WEST`):

```js
// Inside the GeoData export object literal — unchanged from today
BBOX: { NORTH: BBOX_NORTH, SOUTH: BBOX_SOUTH, EAST: BBOX_EAST, WEST: BBOX_WEST },
```

- [ ] **Step 1.4: Add `<script>` tag to `app/index.html`**

Find the existing `<script src="lib/geo-data.js"></script>` line. Add a sibling line directly above it:

```html
<script src="lib/geo-data-core.js"></script>
<script src="lib/geo-data.js"></script>
```

Order matters: `geo-data-core.js` must execute first so `globalThis.GeoDataCore` exists when `geo-data.js` runs.

- [ ] **Step 1.5: HARD GATE — run unit tests**

Run: `node --test app/tests/geo.test.js`

Expected output (verbatim count):
```
ℹ tests 335
ℹ pass 335
ℹ fail 0
```

If anything fails, you almost certainly missed pulling a name through (`__core.X` for a moved symbol) or kept a duplicate declaration in both files. Do NOT proceed past this step until 335/335 pass.

- [ ] **Step 1.6: Smoke E2E (optional but recommended)**

Run a quick browser smoke to confirm `geo-data-core.js` loads in the right order and `window.GeoData` looks normal:

```bash
python -m http.server 8000 --directory app &
SERVER_PID=$!
python -m pytest app/tests/e2e/test_map.py::test_gardens_toggle_present --base-url http://localhost:8000 -v
kill $SERVER_PID
```

Expected: `1 passed`. (We pick `test_gardens_toggle_present` because it's fast and exercises both scripts loading.)

- [ ] **Step 1.7: Commit**

```bash
git add app/lib/geo-data-core.js app/lib/geo-data.js app/index.html
git commit -m "refactor(geo-data): extract pure core to geo-data-core.js

Workers can now import bundled data + helpers via relative ESM path.
geo-data.js public surface (window.GeoData, module.exports) is byte-compatible:
all 335 unit tests pass unchanged."
```

---

### Task 2: Scaffold `workers/tests/` with helpers

**Files:**
- Create: `workers/tests/_helpers.js`

- [ ] **Step 2.1: Create the directory and helper module**

```js
// workers/tests/_helpers.js
// Shared helpers for node --test workers/tests/*

'use strict';

/**
 * Build a Request whose URL carries the given query string.
 * Path defaults to /v1/echo since the tests pass it directly to a handler;
 * the router does its own path matching in workers/index.js.
 */
function requestOf(queryString, path = '/v1/echo') {
  const qs = queryString ? (queryString.startsWith('?') ? queryString : '?' + queryString) : '';
  return new Request('https://api.ridgetocoast.com' + path + qs);
}

/**
 * Swap globalThis.fetch with a stub. Returns a restore() fn the caller
 * MUST invoke in the test's afterEach / try-finally to avoid pollution.
 */
function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return function restore() { globalThis.fetch = original; };
}

module.exports = { requestOf, mockFetch };
```

- [ ] **Step 2.2: Self-test the helpers**

```bash
node -e "const {requestOf, mockFetch} = require('./workers/tests/_helpers.js'); const r = requestOf('lat=37.5&lon=-77.4'); console.log(r.url); const restore = mockFetch(async () => new Response('ok')); console.log((await fetch('https://x')).status); restore();"
```

Expected: prints a URL containing `?lat=37.5&lon=-77.4` and `200`.

- [ ] **Step 2.3: Commit**

```bash
git add workers/tests/_helpers.js
git commit -m "test(workers): add _helpers.js with requestOf + mockFetch"
```

---

### Task 3: Atomic handler signature refactor + `/v1/gardens` route + stub

> **Atomic refactor:** this task changes the signature of all four handlers (router + 3 existing + 1 new gardens stub) in a single commit. After this commit the API still serves byte-identical stub responses for the existing three endpoints; `/v1/gardens` returns a small stub JSON. No behavior change visible to callers (other than the new path responding 200 instead of 404).

**Files:**
- Create: `workers/gardens.js` (stub)
- Modify: `workers/index.js`, `workers/ecoregion.js`, `workers/calendar.js`, `workers/plants.js`

- [ ] **Step 3.1: Create gardens stub**

```js
// workers/gardens.js — /v1/gardens (NEW)
// Real implementation arrives in Task 7. This stub exists so the router can
// reference it during the signature refactor without behavior surprises.

export async function handleGardens(request) {
  return Response.json({ stub: true, endpoint: '/v1/gardens' });
}
```

- [ ] **Step 3.2: Flip `workers/index.js` to pass `request`**

Replace the current router body with:

```js
// workers/index.js
import { handleEcoregion } from './ecoregion.js';
import { handleCalendar } from './calendar.js';
import { handlePlants } from './plants.js';
import { handleGardens } from './gardens.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    let response;
    if (path.startsWith('/v1/ecoregion'))    response = await handleEcoregion(request);
    else if (path.startsWith('/v1/calendar')) response = await handleCalendar(request);
    else if (path.startsWith('/v1/plants'))   response = await handlePlants(request);
    else if (path.startsWith('/v1/gardens'))  response = await handleGardens(request);
    else if (path === '/' || path === '') {
      response = Response.json({
        api: 'Ridge to Coast',
        version: '1.1.0',
        status: 'ok',
        docs: 'https://github.com/ridgetocoast/ridge-to-coast/blob/main/api/openapi.yaml',
        endpoints: ['/v1/ecoregion', '/v1/calendar', '/v1/plants', '/v1/gardens'],
      });
    } else {
      response = Response.json({ error: 'Not found' }, { status: 404 });
    }

    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  },
};
```

- [ ] **Step 3.3: Flip the three existing handler signatures (no logic change)**

In each of `workers/ecoregion.js`, `workers/calendar.js`, `workers/plants.js`:

1. Change `export async function handleX(params)` → `export async function handleX(request)`.
2. Add as the first line of the body: `const params = new URL(request.url).searchParams;`.
3. Leave everything else in the function untouched.

Example for `workers/ecoregion.js`:

```js
export async function handleEcoregion(request) {
  const params = new URL(request.url).searchParams;
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));
  // … rest unchanged …
}
```

Apply the identical 1-line insertion in `calendar.js` and `plants.js`. Stub responses remain byte-identical.

- [ ] **Step 3.4: Smoke check via Node**

`wrangler dev` is overkill for a sanity check. Use a quick Node-level smoke that imports the handlers directly:

```bash
node -e "
import('./workers/ecoregion.js').then(async m => {
  const r = await m.handleEcoregion(new Request('https://x/v1/ecoregion?lat=37.5&lon=-77.4'));
  console.log('ecoregion', r.status, await r.json());
});
import('./workers/calendar.js').then(async m => {
  const r = await m.handleCalendar(new Request('https://x/v1/calendar?zone=7b&month=4'));
  console.log('calendar', r.status, await r.json());
});
import('./workers/plants.js').then(async m => {
  const r = await m.handlePlants(new Request('https://x/v1/plants?region=piedmont'));
  console.log('plants', r.status, await r.json());
});
import('./workers/gardens.js').then(async m => {
  const r = await m.handleGardens(new Request('https://x/v1/gardens'));
  console.log('gardens', r.status, await r.json());
});
"
```

Expected: each prints `200` plus the (stubbed) JSON. `ecoregion`, `calendar`, `plants` should still include the original `_note: 'hello world …'` field — proof the refactor was signature-only.

- [ ] **Step 3.5: Commit**

```bash
git add workers/index.js workers/ecoregion.js workers/calendar.js workers/plants.js workers/gardens.js
git commit -m "refactor(workers): handlers take Request; add /v1/gardens stub + route

All four handlers now share signature handleX(request); each pulls
params via new URL(request.url).searchParams. /v1/gardens returns a
stub here so the router shape matches Task 4-7 implementations.
Stub responses for existing endpoints unchanged."
```

---

## Phase B — Endpoint implementations

> **Parallel-safe:** Tasks 4, 5, 6, 7 touch disjoint files (one handler each + one test file each). T9 (OpenAPI) is also independent. T8 (router/CORS test) depends on T7 because it asserts `/v1/gardens` is in the root endpoints list, but the route was already added in T3 so this is just a verification dependency.

### Task 4: `/v1/ecoregion` real implementation

**Files:**
- Modify: `workers/ecoregion.js`
- Create: `workers/tests/ecoregion.test.js`

Per spec §4.1.

- [ ] **Step 4.1: Write failing tests first**

```js
// workers/tests/ecoregion.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestOf } = require('./_helpers.js');

// Worker source is ESM; node:test can't import ESM from a CJS test file
// without --experimental-vm-modules, so we use a dynamic import inside an
// async test. node 20+ supports this.

async function call(qs) {
  const { handleEcoregion } = await import('../ecoregion.js');
  return handleEcoregion(requestOf(qs, '/v1/ecoregion'));
}

test('ecoregion: 400 when lat/lon missing', async () => {
  const r = await call('');
  assert.equal(r.status, 400);
});

test('ecoregion: 400 when lat is non-numeric', async () => {
  const r = await call('lat=abc&lon=-77.4');
  assert.equal(r.status, 400);
});

test('ecoregion: 404 outside coverage BBOX (San Francisco)', async () => {
  const r = await call('lat=37.77&lon=-122.42');
  assert.equal(r.status, 404);
  const body = await r.json();
  assert.match(body.error, /coverage/i);
});

test('ecoregion: 200 for Richmond VA → piedmont, zone 7b, James watershed', async () => {
  const r = await call('lat=37.54&lon=-77.43');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.region, 'piedmont');
  assert.equal(body.name, 'Piedmont');
  assert.equal(body.zone, '7b');
  assert.match(body.watershedName, /James/i);
  assert.equal(body.lat, 37.54);
  assert.equal(body.lon, -77.43);
  assert.ok(Array.isArray(body.nativePlants));
  assert.ok(body.nativePlants.length > 0 && body.nativePlants.length <= 3);
  assert.ok(Array.isArray(body.invasives));
});

test('ecoregion: nativePlants is top-3 names from NATIVE_PLANTS[region]', async () => {
  const r = await call('lat=37.54&lon=-77.43');
  const body = await r.json();
  assert.equal(body.nativePlants.length, 3);
  body.nativePlants.forEach(n => assert.equal(typeof n, 'string'));
});

test('ecoregion: returns null watershedName when point in coverage but outside HUC8', async () => {
  // Pick a point well inside the BBOX but in the ocean off NJ.
  const r = await call('lat=39.5&lon=-73.5');
  if (r.status === 200) {
    const body = await r.json();
    assert.equal(body.watershedName, null);
  }
  // If 404: that's also acceptable (depends on classifyLocation behavior offshore).
});
```

- [ ] **Step 4.2: Run — verify they fail**

Run: `node --test workers/tests/ecoregion.test.js`
Expected: tests fail (handler still returns the stub `_note` payload, so `region: 'piedmont'` happens to pass on the Richmond test, but the BBOX 404 and the "no `_note` field" tests will fail).

- [ ] **Step 4.3: Implement the handler**

Replace the body of `workers/ecoregion.js`:

```js
// workers/ecoregion.js — /v1/ecoregion?lat=&lon=
import core from '../app/lib/geo-data-core.js';

const BBOX = {
  NORTH: 49,
  SOUTH: 24,
  EAST: -66.5,
  WEST: -92.2,
};

export async function handleEcoregion(request) {
  try {
    const params = new URL(request.url).searchParams;
    const lat = parseFloat(params.get('lat'));
    const lon = parseFloat(params.get('lon'));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return Response.json({ error: 'lat and lon are required and must be numeric' }, { status: 400 });
    }

    if (lat < BBOX.SOUTH || lat > BBOX.NORTH || lon < BBOX.WEST || lon > BBOX.EAST) {
      return Response.json({ error: 'Coordinate outside coverage area' }, { status: 404 });
    }

    const region = core.classifyLocation(lat, lon);
    if (!region || !core.REGION_LABELS[region]) {
      return Response.json({ error: 'Coordinate outside coverage area' }, { status: 404 });
    }

    const nearestCity = core.nearestCorridorCity(lat, lon);
    const zone = (nearestCity && nearestCity.zone) || '7b';

    const watershed = core.lookupWatershed(lat, lon);
    const watershedName = watershed && watershed.name ? watershed.name : null;

    const soilEntry = core.SOIL_TYPES[region];
    const soilSeries = soilEntry && soilEntry.series ? soilEntry.series : null;

    const nativePlants = (core.NATIVE_PLANTS[region] || []).slice(0, 3).map(p => p.name);
    const invasives = (core.INVASIVE_SPECIES[region] || []).map(s => s.name);

    return Response.json({
      lat,
      lon,
      region,
      name: core.REGION_LABELS[region],
      zone,
      soilSeries,
      nativePlants,
      invasives,
      watershedName,
    });
  } catch (err) {
    console.error('handleEcoregion error', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 4.4: Run tests — verify pass**

Run: `node --test workers/tests/ecoregion.test.js`
Expected: all tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add workers/ecoregion.js workers/tests/ecoregion.test.js
git commit -m "feat(workers): /v1/ecoregion real implementation

Imports geo-data-core for classifyLocation, REGION_LABELS, NATIVE_PLANTS,
INVASIVE_SPECIES, SOIL_TYPES, nearestCorridorCity, lookupWatershed.
Returns 404 outside the eastern-US BBOX. Zone derived from nearest
CORRIDOR_CITIES match (matches frontend behavior at map.js:416)."
```

---

### Task 5: `/v1/calendar` real implementation

**Files:**
- Modify: `workers/calendar.js`
- Create: `workers/tests/calendar.test.js`

Per spec §4.2.

- [ ] **Step 5.1: Write failing tests first**

```js
// workers/tests/calendar.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestOf } = require('./_helpers.js');

async function call(qs) {
  const { handleCalendar } = await import('../calendar.js');
  return handleCalendar(requestOf(qs, '/v1/calendar'));
}

test('calendar: 400 when zone missing', async () => {
  const r = await call('month=4');
  assert.equal(r.status, 400);
});

test('calendar: 400 when month missing or non-numeric', async () => {
  for (const qs of ['zone=7b', 'zone=7b&month=abc']) {
    const r = await call(qs);
    assert.equal(r.status, 400, `expected 400 for ${qs}`);
  }
});

test('calendar: 400 when month out of range', async () => {
  for (const m of [0, 13, -1]) {
    const r = await call('zone=7b&month=' + m);
    assert.equal(r.status, 400, `expected 400 for month=${m}`);
  }
});

test('calendar: 404 when zone unknown', async () => {
  const r = await call('zone=zz&month=4');
  assert.equal(r.status, 404);
});

test('calendar: 200 for zone=7b month=4 returns startIndoors/directSow/transplant arrays', async () => {
  const r = await call('zone=7b&month=4');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.zone, '7b');
  assert.equal(body.month, 4);
  assert.equal(body.monthName, 'April');
  assert.ok(Array.isArray(body.startIndoors));
  assert.ok(Array.isArray(body.directSow));
  assert.ok(Array.isArray(body.transplant));
  // No harvest / notes per decision 3a-i.
  assert.equal(body.harvest, undefined);
  assert.equal(body.notes, undefined);
});
```

- [ ] **Step 5.2: Run — verify fail**

Run: `node --test workers/tests/calendar.test.js`
Expected: 404-on-unknown-zone test fails (stub accepts any zone). `harvest`/`notes` undefined test also fails (stub returns those).

- [ ] **Step 5.3: Implement the handler**

Replace `workers/calendar.js`:

```js
// workers/calendar.js — /v1/calendar?zone=&month=
import core from '../app/lib/geo-data-core.js';

const MONTH_ABBREV = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_NAME = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export async function handleCalendar(request) {
  try {
    const params = new URL(request.url).searchParams;
    const zone = params.get('zone');
    const monthRaw = params.get('month');
    const month = parseInt(monthRaw, 10);

    if (!zone) {
      return Response.json({ error: 'zone is required' }, { status: 400 });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return Response.json({ error: 'month must be an integer 1–12' }, { status: 400 });
    }
    const zoneCalendar = core.PLANTING_CALENDAR[zone];
    if (!zoneCalendar) {
      return Response.json({ error: 'Unknown hardiness zone' }, { status: 404 });
    }

    const entry = zoneCalendar[MONTH_ABBREV[month - 1]] || {};
    return Response.json({
      zone,
      month,
      monthName: MONTH_NAME[month - 1],
      startIndoors: entry.startIndoors || [],
      directSow:   entry.directSow   || [],
      transplant:  entry.transplant  || [],
    });
  } catch (err) {
    console.error('handleCalendar error', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 5.4: Run tests — verify pass**

Run: `node --test workers/tests/calendar.test.js`
Expected: all tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add workers/calendar.js workers/tests/calendar.test.js
git commit -m "feat(workers): /v1/calendar real implementation

Reads PLANTING_CALENDAR from geo-data-core. 400 for missing/invalid
zone or month, 404 for unknown zone. Drops harvest/notes per
spec decision 3a-i (data does not carry those fields)."
```

---

### Task 6: `/v1/plants` real implementation

**Files:**
- Modify: `workers/plants.js`
- Create: `workers/tests/plants.test.js`

Per spec §4.3.

- [ ] **Step 6.1: Write failing tests first**

```js
// workers/tests/plants.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestOf } = require('./_helpers.js');

async function call(qs) {
  const { handlePlants } = await import('../plants.js');
  return handlePlants(requestOf(qs, '/v1/plants'));
}

test('plants: 400 when region missing', async () => {
  const r = await call('');
  assert.equal(r.status, 400);
});

test('plants: 404 when region unknown', async () => {
  const r = await call('region=neverland');
  assert.equal(r.status, 404);
});

test('plants: 400 when type is not in the allowed enum', async () => {
  const r = await call('region=piedmont&type=mushroom');
  assert.equal(r.status, 400);
});

test('plants: 400 for legacy enum value "herbaceous" (no longer accepted)', async () => {
  const r = await call('region=piedmont&type=herbaceous');
  assert.equal(r.status, 400);
});

test('plants: 200 with full list for known region', async () => {
  const r = await call('region=piedmont');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.region, 'piedmont');
  assert.equal(body.type, null);
  assert.ok(Array.isArray(body.plants));
  assert.ok(body.plants.length > 0);
  body.plants.forEach(p => {
    assert.equal(typeof p.name, 'string');
    assert.equal(typeof p.latin, 'string');
    assert.equal(typeof p.type, 'string');
  });
});

test('plants: 200 with type filter narrows results', async () => {
  const all = await (await call('region=piedmont')).json();
  const trees = await (await call('region=piedmont&type=tree')).json();
  assert.ok(trees.plants.length > 0);
  assert.ok(trees.plants.length <= all.plants.length);
  trees.plants.forEach(p => assert.equal(p.type, 'tree'));
  assert.equal(trees.type, 'tree');
});

test('plants: type matching is case-sensitive (TREE rejected)', async () => {
  const r = await call('region=piedmont&type=TREE');
  assert.equal(r.status, 400);
});
```

- [ ] **Step 6.2: Run — verify fail**

Run: `node --test workers/tests/plants.test.js`
Expected: tests fail because the stub uses the legacy enum (`herbaceous`, `vine`, `graminoid`, `wildflower`).

- [ ] **Step 6.3: Implement the handler**

Replace `workers/plants.js`:

```js
// workers/plants.js — /v1/plants?region=&type=
import core from '../app/lib/geo-data-core.js';

const VALID_TYPES = ['tree', 'shrub', 'perennial', 'grass', 'fern', 'vine'];

export async function handlePlants(request) {
  try {
    const params = new URL(request.url).searchParams;
    const region = params.get('region');
    const type = params.get('type');

    if (!region) {
      return Response.json({ error: 'region is required' }, { status: 400 });
    }
    if (type !== null && !VALID_TYPES.includes(type)) {
      return Response.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }
    const all = core.NATIVE_PLANTS[region];
    if (!all) {
      return Response.json({ error: 'Unknown region' }, { status: 404 });
    }

    const plants = type ? all.filter(p => p.type === type) : all;
    return Response.json({ region, type: type || null, plants });
  } catch (err) {
    console.error('handlePlants error', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 6.4: Run tests — verify pass**

Run: `node --test workers/tests/plants.test.js`
Expected: all tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add workers/plants.js workers/tests/plants.test.js
git commit -m "feat(workers): /v1/plants real implementation

Reads NATIVE_PLANTS from geo-data-core. 400 for missing region or
invalid type; 404 for unknown region. Type enum aligned to
shipped data per spec decision 3b-i:
[tree, shrub, perennial, grass, fern, vine]."
```

---

### Task 7: `/v1/gardens` real implementation

**Files:**
- Modify: `workers/gardens.js` (replace stub)
- Create: `workers/tests/gardens.test.js`

Per spec §4.4. The handler ports `buildGardenQuery`, `normalizeGardenElement`, `gardenDisplayName`, `gardenTypeLabel`, `gardenAddress` from `app/map.js:681-783`. (Those will be deleted from `map.js` in Task 13.)

- [ ] **Step 7.1: Write failing tests first**

```js
// workers/tests/gardens.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestOf, mockFetch } = require('./_helpers.js');

async function call() {
  const { handleGardens } = await import('../gardens.js');
  return handleGardens(requestOf('', '/v1/gardens'));
}

const FAKE_OVERPASS = {
  elements: [
    { type: 'node', id: 1, lat: 37.54, lon: -77.43, tags: { leisure: 'garden', name: 'Maymont Community Garden' } },
    { type: 'way',  id: 2, center: { lat: 39.95, lon: -75.16 }, tags: { landuse: 'allotments', operator: 'Schuylkill Allotments' } },
    { type: 'node', id: 3, lat: 35.78, lon: -78.64, tags: { shop: 'garden_centre', 'plant:native': 'yes', name: 'Niche Gardens' } },
    { type: 'node', id: 4, /* missing lat/lon */ tags: { leisure: 'garden', name: 'Bad Element' } },
    { type: 'node', id: 1, lat: 37.54, lon: -77.43, tags: { leisure: 'garden', name: 'Maymont Community Garden' } }, // dupe
  ],
};

test('gardens: 200 happy path normalizes Overpass elements', async () => {
  const restore = mockFetch(async () => Response.json(FAKE_OVERPASS));
  try {
    const r = await call();
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Cache-Control'), 'public, max-age=86400, s-maxage=86400');
    const body = await r.json();
    assert.equal(body.count, 3); // dupe + missing-coords element dropped
    assert.deepEqual(body.bbox, { south: 24, west: -92.2, north: 49, east: -66.5 });
    body.gardens.forEach(g => {
      assert.match(g.osmId, /^(node|way)-\d+$/);
      assert.equal(typeof g.lat, 'number');
      assert.equal(typeof g.lon, 'number');
      assert.equal(typeof g.name, 'string');
      assert.equal(typeof g.type, 'string');
      assert.equal(typeof g.address, 'string');
    });
    // sorted by name ascending
    const names = body.gardens.map(g => g.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    assert.deepEqual(names, sorted);
  } finally {
    restore();
  }
});

test('gardens: type label maps correctly (allotment / native nursery / plain garden)', async () => {
  const restore = mockFetch(async () => Response.json(FAKE_OVERPASS));
  try {
    const body = await (await call()).json();
    const types = new Set(body.gardens.map(g => g.type));
    assert.ok(types.has('Community garden'));
    assert.ok(types.has('Allotment garden'));
    assert.ok(types.has('Native plant nursery'));
  } finally {
    restore();
  }
});

test('gardens: 502 when Overpass returns non-2xx', async () => {
  const restore = mockFetch(async () => new Response('upstream down', { status: 503 }));
  try {
    const r = await call();
    assert.equal(r.status, 502);
    const body = await r.json();
    assert.match(body.error, /overpass/i);
  } finally {
    restore();
  }
});

test('gardens: 502 when fetch throws', async () => {
  const restore = mockFetch(async () => { throw new Error('network'); });
  try {
    const r = await call();
    assert.equal(r.status, 502);
  } finally {
    restore();
  }
});

test('gardens: address falls back to "Address not listed" when no addr:* tags', async () => {
  const restore = mockFetch(async () => Response.json({
    elements: [{ type: 'node', id: 99, lat: 37, lon: -77, tags: { leisure: 'garden', name: 'Plain' } }],
  }));
  try {
    const body = await (await call()).json();
    assert.equal(body.gardens[0].address, 'Address not listed');
  } finally {
    restore();
  }
});
```

> Note: we do not test `caches.default` directly. That is Workers runtime; in `node --test` `caches` is undefined and the handler must guard against that (see implementation).

- [ ] **Step 7.2: Run — verify fail**

Run: `node --test workers/tests/gardens.test.js`
Expected: tests fail because gardens.js is still the Task 3 stub.

- [ ] **Step 7.3: Implement the handler**

Replace `workers/gardens.js`:

```js
// workers/gardens.js — /v1/gardens (Overpass proxy + 24 h edge cache)
import core from '../app/lib/geo-data-core.js';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=86400, s-maxage=86400',
};

function buildGardenQuery() {
  const bbox = [
    core.BBOX_SOUTH.toFixed(4),
    core.BBOX_WEST.toFixed(4),
    core.BBOX_NORTH.toFixed(4),
    core.BBOX_EAST.toFixed(4),
  ].join(',');
  return (
    '[out:json][timeout:25];' +
    '(' +
      `node["leisure"="garden"](${bbox});` +
      `way["landuse"="allotments"](${bbox});` +
      `node["shop"="garden_centre"]["plant:native"="yes"](${bbox});` +
    ');' +
    'out center;'
  );
}

function gardenTypeLabel(tags) {
  if (tags.shop === 'garden_centre' && tags['plant:native'] === 'yes') return 'Native plant nursery';
  if (tags.landuse === 'allotments') return 'Allotment garden';
  return 'Community garden';
}

function gardenDisplayName(tags) {
  if (tags.name) return tags.name;
  if (tags.operator) return tags.operator;
  return gardenTypeLabel(tags);
}

function joinAddress(parts) { return parts.filter(Boolean).join(', '); }

function gardenAddress(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const locality = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || tags['addr:hamlet'] || '';
  const region   = tags['addr:state']    || '';
  const postcode = tags['addr:postcode'] || '';
  return joinAddress([street, locality, joinAddress([region, postcode])]) || 'Address not listed';
}

function normalizeElement(element) {
  const tags = element.tags || {};
  const lat = typeof element.lat === 'number'
    ? element.lat
    : (element.center && typeof element.center.lat === 'number' ? element.center.lat : null);
  const lon = typeof element.lon === 'number'
    ? element.lon
    : (element.center && typeof element.center.lon === 'number' ? element.center.lon : null);
  if (lat == null || lon == null) return null;
  return {
    osmId: `${element.type}-${element.id}`,
    lat, lon,
    name: gardenDisplayName(tags),
    type: gardenTypeLabel(tags),
    address: gardenAddress(tags),
  };
}

async function fetchAndNormalize() {
  const upstream = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'text/plain;charset=UTF-8' },
    body: buildGardenQuery(),
  });
  if (!upstream.ok) {
    throw new Error('Overpass HTTP ' + upstream.status);
  }
  const data = await upstream.json();
  const elements = Array.isArray(data && data.elements) ? data.elements : [];
  const seen = Object.create(null);
  const gardens = [];
  for (const el of elements) {
    const g = normalizeElement(el);
    if (!g || seen[g.osmId]) continue;
    seen[g.osmId] = true;
    gardens.push(g);
  }
  gardens.sort((a, b) => a.name.localeCompare(b.name));
  return {
    bbox: { south: core.BBOX_SOUTH, west: core.BBOX_WEST, north: core.BBOX_NORTH, east: core.BBOX_EAST },
    count: gardens.length,
    gardens,
  };
}

export async function handleGardens(request) {
  // caches.default is only present at the Cloudflare runtime, not in node:test.
  const hasCache = typeof caches !== 'undefined' && caches.default;
  const cacheKey = new Request(request.url);

  if (hasCache) {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  }

  let payload;
  try {
    payload = await fetchAndNormalize();
  } catch (err) {
    console.error('handleGardens upstream error', err);
    return Response.json({ error: 'Upstream Overpass unavailable' }, { status: 502 });
  }

  const response = Response.json(payload, { headers: CACHE_HEADERS });

  if (hasCache) {
    // ctx.waitUntil would be ideal but the router does not pass ctx through.
    // The cache.put promise is short-lived; await directly. Failures are non-fatal.
    try { await caches.default.put(cacheKey, response.clone()); } catch (_e) { /* ignore */ }
  }
  return response;
}
```

- [ ] **Step 7.4: Run tests — verify pass**

Run: `node --test workers/tests/gardens.test.js`
Expected: all tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add workers/gardens.js workers/tests/gardens.test.js
git commit -m "feat(workers): /v1/gardens Overpass proxy with 24h edge cache

Ports buildGardenQuery + normalizeGardenElement helpers from app/map.js
(those will be removed in the frontend wiring task). 502 on upstream
failure (not cached). caches.default guarded for node:test runs."
```

---

### Task 8: Router / CORS / index tests

**Files:**
- Create: `workers/tests/index.test.js`

- [ ] **Step 8.1: Write tests**

```js
// workers/tests/index.test.js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

async function dispatch(method, path) {
  const mod = await import('../index.js');
  const handler = mod.default;
  return handler.fetch(new Request('https://api.ridgetocoast.com' + path, { method }));
}

test('router: GET / returns api info with all four endpoints', async () => {
  const r = await dispatch('GET', '/');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.api, 'Ridge to Coast');
  assert.deepEqual(body.endpoints.sort(), ['/v1/calendar', '/v1/ecoregion', '/v1/gardens', '/v1/plants']);
});

test('router: GET /unknown returns 404', async () => {
  const r = await dispatch('GET', '/nope');
  assert.equal(r.status, 404);
});

test('router: OPTIONS preflight returns 200 with CORS headers', async () => {
  const r = await dispatch('OPTIONS', '/v1/ecoregion');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(r.headers.get('Access-Control-Allow-Methods'), /GET/);
});

test('router: every response carries CORS headers (sample /v1/calendar 400)', async () => {
  const r = await dispatch('GET', '/v1/calendar?zone=7b'); // missing month → 400
  assert.equal(r.status, 400);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*');
});
```

- [ ] **Step 8.2: Run — expect pass**

Run: `node --test workers/tests/index.test.js`
Expected: all 4 tests pass.

- [ ] **Step 8.3: Run the full worker test suite**

Run: `node --test workers/tests/`
Expected: every test from T4-T8 passes; estimate ~25-35 tests total.

- [ ] **Step 8.4: Commit**

```bash
git add workers/tests/index.test.js
git commit -m "test(workers): router / CORS / endpoints-list coverage"
```

---

### Task 9: Reconcile `api/openapi.yaml` to v1.1.0

**Files:**
- Modify: `api/openapi.yaml`

Per spec §5.2. Independent of T4-T8 — can run in parallel.

- [ ] **Step 9.1: Bump version and add `lat`/`lon` echo to EcoregionResponse**

Edit `api/openapi.yaml`:

1. Change `version: 1.0.0` → `version: 1.1.0`.
2. In `EcoregionResponse.properties`, add:
   ```yaml
   lat: { type: number, example: 37.54 }
   lon: { type: number, example: -77.43 }
   ```
3. Under `/ecoregion.get.responses`, add:
   ```yaml
   '404':
     $ref: '#/components/responses/NotFound'
   ```

- [ ] **Step 9.2: Drop `harvest` and `notes` from CalendarResponse**

In `CalendarResponse.properties`, delete the `harvest:` and `notes:` lines.

- [ ] **Step 9.3: Update plant `type` enum**

Two places need the same enum:

1. `/plants.get.parameters[name=type].schema.enum`: replace `[tree, shrub, herbaceous, vine, graminoid, wildflower]` with `[tree, shrub, perennial, grass, fern, vine]`.
2. `PlantsResponse.properties.plants.items.properties.type`: keep `{type: string}` (no enum needed since the response can mirror the data exactly).

- [ ] **Step 9.4: Add `/gardens` path and `GardensResponse` schema**

Append under `paths:`:

```yaml
  /gardens:
    get:
      summary: Community gardens, allotments, and native plant nurseries in the corridor
      operationId: getGardens
      description: |
        Cached for 24 hours via Cloudflare's edge cache. Data sourced from
        OpenStreetMap via the Overpass API. BBOX is fixed (eastern US corridor).
      responses:
        '200':
          description: Garden listings (normalized)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GardensResponse'
        '502':
          description: Upstream Overpass API unavailable
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Error' }
```

Append under `components.schemas:`:

```yaml
    GardensResponse:
      type: object
      properties:
        bbox:
          type: object
          properties:
            south: { type: number }
            west:  { type: number }
            north: { type: number }
            east:  { type: number }
        count: { type: integer, example: 487 }
        gardens:
          type: array
          items:
            type: object
            properties:
              osmId:   { type: string, example: 'node-12345' }
              lat:     { type: number, example: 37.54 }
              lon:     { type: number, example: -77.43 }
              name:    { type: string, example: 'Maymont Community Garden' }
              type:    { type: string, example: 'Community garden' }
              address: { type: string, example: '1700 Hampton St' }
```

- [ ] **Step 9.5: Validate YAML**

```bash
python -c "import yaml; yaml.safe_load(open('api/openapi.yaml'))" && echo "yaml OK"
```

Expected: `yaml OK`.

- [ ] **Step 9.6: Commit**

```bash
git add api/openapi.yaml
git commit -m "docs(api): openapi 1.1.0 — add /gardens, fix calendar/plants schemas

- Bump version 1.0.0 → 1.1.0
- /ecoregion: add 404, lat/lon echo
- /calendar: drop harvest/notes (data does not carry them)
- /plants: type enum aligned to shipped data [tree,shrub,perennial,grass,fern,vine]
- /gardens: new path + GardensResponse schema"
```

---

## Phase C — CI + bundle checkpoint

### Task 10: Add `node --test workers/tests/` to CI

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 10.1: Edit the unit job**

Add a step after the existing geo.test.js step:

```yaml
      - run: node --test app/tests/geo.test.js
      - run: node --test workers/tests/
```

- [ ] **Step 10.2: Sanity check locally**

```bash
node --test app/tests/geo.test.js && node --test workers/tests/ && echo "ALL GREEN"
```

Expected: `ALL GREEN`.

- [ ] **Step 10.3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: run worker unit tests on every push and PR"
```

---

### Task 11: Bundle-size checkpoint

**Files:** none modified.

- [ ] **Step 11.1: Run wrangler dry-run**

```bash
npx wrangler@latest deploy --dry-run --env preview
```

Expected: prints "Total Upload" with both raw and gzip sizes. Pass criteria: gzip size **< 3 MB** (Cloudflare free-tier worker limit).

If the bundle exceeds 3 MB:
- Inspect `wrangler` output for the largest chunks.
- Likely culprit: `WATERSHEDS_GEOJSON` or `*_GEOJSON` region polygons being bundled at full resolution. If so, document in the spec's risk section and consider moving polygons to a Worker-fetched R2 asset (out of scope for this PR — open a follow-up issue).

- [ ] **Step 11.2: No commit needed** — this is a checkpoint, not a code change. If the bundle is > 3 MB STOP and consult before continuing to frontend wiring.

---

## Phase D — Frontend wiring

### Task 12: CSP update

**Files:**
- Modify: `app/index.html`

Per spec §6.2.

- [ ] **Step 12.1: Edit the CSP `<meta>` tag**

In `app/index.html`, find the existing CSP meta line and update `connect-src`:

- Remove: `https://overpass-api.de`.
- Add (space-separated): `https://api.ridgetocoast.com https://preprod.ridgetocoast.com https://alpha.ridgetocoast.com`.

Final `connect-src` directive should be:
```
connect-src 'self' https://nominatim.openstreetmap.org https://api.weather.gov https://api.inaturalist.org https://waterservices.usgs.gov https://api.ridgetocoast.com https://preprod.ridgetocoast.com https://alpha.ridgetocoast.com;
```

- [ ] **Step 12.2: Commit (do NOT push yet — paired with Task 13)**

```bash
git add app/index.html
git commit -m "csp: swap overpass-api.de for the three Workers API hosts"
```

---

### Task 13: Wire `app/map.js` to `/v1/gardens`; delete normalization helpers; update E2E mock

**Files:**
- Modify: `app/map.js`
- Modify: `app/tests/e2e/test_map.py`

Per spec §6.1 and §6.3. Combined into one task because the E2E mock target changes in lockstep with the fetch URL.

- [ ] **Step 13.1: Replace the `ensureGardensLoaded` body in `app/map.js`**

Find `function ensureGardensLoaded()` (around line 785). Replace its body with:

```js
function ensureGardensLoaded() {
  if (gardensCache) return Promise.resolve(gardensCache);
  if (gardensRequest) return gardensRequest;

  gardensRequest = fetch(API_BASE + '/v1/gardens')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' loading /v1/gardens');
      }
      return response.json();
    })
    .then(function (data) {
      var gardens = (data && Array.isArray(data.gardens)) ? data.gardens : [];
      var nextIndex = Object.create(null);
      gardens.forEach(function (g) { nextIndex[g.osmId] = g; });
      gardensCache = gardens;
      gardensIndex = nextIndex;
      gardensLayer = buildGardensLayer(gardens);
      return gardens;
    })
    .finally(function () { gardensRequest = null; });

  return gardensRequest;
}
```

- [ ] **Step 13.2: Delete the obsolete helpers from `app/map.js`**

Delete the entire blocks for these top-level functions in `app/map.js` (lines ~681-783):

- `gardenTypeLabel(tags)`
- `gardenDisplayName(tags)`
- `joinAddress(parts)`
- `gardenAddress(tags)`
- `normalizeGardenElement(element)`
- `buildGardenQuery()`

Leave `buildGardensLayer(gardens)` in place — it builds Leaflet markers, which is map-only.

- [ ] **Step 13.3: Update the E2E mock in `app/tests/e2e/test_map.py`**

Open `app/tests/e2e/test_map.py` and locate `test_gardens_toggle_loads_and_routes_to_detail` (around line 285).

Change the route mock:
- Old route: `https://overpass-api.de/api/interpreter`
- New route: `**/v1/gardens` (Playwright glob — matches preprod / alpha / api hosts)

Change the mocked response shape from raw Overpass `{elements: [...]}` to the new normalized shape `{bbox: {...}, count: N, gardens: [...]}`. Convert the existing fixture elements:

```python
# Replace the existing route + body. Example new payload:
mocked = {
    "bbox": {"south": 24, "west": -92.2, "north": 49, "east": -66.5},
    "count": 1,
    "gardens": [
        {
            "osmId": "node-101",
            "lat": 37.54,
            "lon": -77.43,
            "name": "Test Community Garden",
            "type": "Community garden",
            "address": "Address not listed",
        }
    ],
}

page.route("**/v1/gardens", lambda route: route.fulfill(
    status=200,
    content_type="application/json",
    body=json.dumps(mocked),
))
```

> Read the existing test body around line 285-330 and adapt the existing fixture rather than replacing wholesale. The fixture's garden id `node-101` is referenced later in the same test for the detail-route assertion — keep ids stable.

- [ ] **Step 13.4: Run tests — verify pass**

```bash
node --test app/tests/geo.test.js                                              # 335 pass
node --test workers/tests/                                                     # all pass
python -m http.server 8000 --directory app &
SERVER_PID=$!
python -m pytest app/tests/e2e/test_map.py -v --base-url http://localhost:8000
kill $SERVER_PID
```

Expected: all unit tests pass, all E2E tests in `test_map.py` pass.

- [ ] **Step 13.5: Commit**

```bash
git add app/map.js app/tests/e2e/test_map.py
git commit -m "feat(frontend): wire gardens layer to /v1/gardens

Replaces direct Overpass POST in ensureGardensLoaded() with a single
GET to API_BASE + /v1/gardens. Server-side normalization eliminates
gardenDisplayName/gardenTypeLabel/gardenAddress/normalizeGardenElement/
buildGardenQuery from map.js (~80 lines removed).

E2E gardens test updated to mock the new endpoint shape."
```

---

## Phase E — Final verification + PR

### Task 14: Full sweep

**Files:** none modified.

- [ ] **Step 14.1: Run every test layer**

```bash
node --test app/tests/geo.test.js          # expect 335 pass
node --test app/tests/pipeline.test.js     # existing — must still pass
node --test workers/tests/                 # expect ~25-35 pass
python -m http.server 8000 --directory app &
SERVER_PID=$!
python -m pytest app/tests/e2e/ --base-url http://localhost:8000 -v
kill $SERVER_PID
npx wrangler@latest deploy --dry-run --env preview   # bundle < 3 MB
```

All must pass. If any fail, fix at the source — do not skip or `--no-verify`.

- [ ] **Step 14.2: Update `docs/session-handoff.md` with merged status**

Replace the "Next session — start here" section with a brief "Merged YYYY-MM-DD; see PR #N" stub. (The handoff doc itself can be deleted in a follow-up cleanup.)

- [ ] **Step 14.3: Commit**

```bash
git add docs/session-handoff.md
git commit -m "docs: mark workers-api-impl handoff merged"
```

---

### Task 15: Open the PR

- [ ] **Step 15.1: Push the branch and open the PR**

```bash
git push -u origin claude/workers-api-impl
gh pr create --base main --title "feat: Workers API impl + frontend wiring (Phase 4 + 5)" --body "$(cat <<'EOF'
## Summary

- Replaces three Workers stub endpoints (`/v1/ecoregion`, `/v1/calendar`, `/v1/plants`) with real implementations backed by `app/lib/geo-data-core.js` (extracted shared core).
- Adds `/v1/gardens`, an Overpass proxy with a 24 h `caches.default` edge cache.
- Wires the frontend gardens layer to `/v1/gardens`; removes ~80 lines of normalization helpers from `map.js`.
- Reconciles `api/openapi.yaml` to v1.1.0 against shipped data shapes.
- Adds `node --test workers/tests/` to CI (~25-35 new tests).

Spec: `app/docs/superpowers/specs/2026-05-03-workers-api-impl-design.md`
Plan: `app/docs/superpowers/plans/2026-05-06-workers-api-impl.md`

## ⚠ Required deploy ordering: promote-then-frontend

Frontend Pages goes live the moment this PR merges, but the Workers API stays on the **old** version until the **promote-workers.yml** workflow is run. The new frontend will hit `api.ridgetocoast.com/v1/gardens`, which the old Worker does not serve, so the gardens layer will break in the gap.

**Required steps after merge (single owner, single sitting):**

1. Merge this PR.
2. **Immediately** run Actions → "Promote / Rollback Workers API" → `promote` + `production`.
3. Wait for both `deploy-pages.yml` and the promote run to complete.
4. Verify `https://ridgetocoast.com` shows a working gardens layer.

If Step 2 is delayed, gardens layer toggling will fail until promote completes (other layers and popups continue to work).

## Test plan

- [ ] CI: `node --test app/tests/geo.test.js` — 335/335 pass
- [ ] CI: `node --test workers/tests/` — all pass
- [ ] CI: `pytest app/tests/e2e/` — all pass (gardens layer test mocked against `/v1/gardens`)
- [ ] Reviewer: hit preprod URLs:
  - `https://preprod.ridgetocoast.com/v1/ecoregion?lat=37.54&lon=-77.43` → 200, region=piedmont, zone=7b
  - `https://preprod.ridgetocoast.com/v1/calendar?zone=7b&month=4` → 200
  - `https://preprod.ridgetocoast.com/v1/plants?region=piedmont&type=tree` → 200
  - `https://preprod.ridgetocoast.com/v1/gardens` → 200 with `count > 0`
  - `https://preprod.ridgetocoast.com/v1/ecoregion?lat=40&lon=-120` → 404 (outside coverage)
- [ ] Reviewer: confirm `wrangler deploy --dry-run` bundle size < 3 MB compressed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

The PR description's "promote-then-frontend" callout is the load-bearing piece. **Do not** merge without first assigning a single owner who will run promote within minutes of merge.

---

## Self-review notes

- **Spec §3 (Architecture)** → Task 1 covers the full geo-data-core extraction with explicit symbol-by-symbol move list and the 335-test hard gate.
- **Spec §4.1 (ecoregion)** → Task 4 (handler + 7 tests covering all listed validation, 404, happy path, watershed null).
- **Spec §4.2 (calendar)** → Task 5 (handler + 5 tests; explicitly verifies `harvest`/`notes` undefined per 3a-i).
- **Spec §4.3 (plants)** → Task 6 (handler + 7 tests including legacy-enum rejection per 3b-i).
- **Spec §4.4 (gardens)** → Task 7 (handler + 5 tests; mock-fetch for happy path, type labels, 502 on non-2xx, 502 on throw, address fallback).
- **Spec §4.5 (router signature change)** → Task 3, atomic across router + 4 handlers + new gardens stub in one commit.
- **Spec §5.1 (errors)** → Each handler's try/catch returning 500 is explicit in T4-T7 implementations.
- **Spec §5.2 (OpenAPI)** → Task 9 covers all listed schema changes plus `/gardens` addition.
- **Spec §5.3 (testing)** → Tasks 4-8 deliver the four endpoint test files + index.test.js + `_helpers.js`. CI step in T10.
- **Spec §6.1, §6.2 (frontend wiring + CSP)** → Tasks 12 + 13.
- **Spec §6.3 (E2E impact)** → Task 13.3 updates the E2E gardens-toggle mock to the new shape.
- **Spec §8 (deploy ordering)** → PR description in Task 15 calls it out; documented as load-bearing.
- **Spec §10 (risks)** → Bundle size checkpoint in T11; tests-pass gate in T1; CSP three-host coverage in T12; promote ordering in T15.
