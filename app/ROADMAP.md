# Ridge to Coast — Roadmap & Backlog

## Current State (master as of April 2026)

| Item | Status |
|---|---|
| Rename to Ridge to Coast | ✅ |
| Blue Ridge region (polygon, plants, soil, 6 cities) | ✅ |
| Valley & Ridge region (WV, KY, eastern OH) | ✅ |
| NE Upland / NE Coastal regions (VT, NH, ME, Lake Erie) | ✅ |
| Gulf Coastal Plain (FL, GA coast, AL, MS, Memphis embayment) | ✅ |
| Rivers — invisible interactive layer (tooltip + detail page) | ✅ |
| Hardiness zones — 22 states (was 8) | ✅ |
| Hash routing detail pages (`#detail/region/`, `#detail/zone/`, `#detail/river/`) | ✅ |
| `data/regions.geojson` async fetch architecture (EPA-ready) | ✅ |
| 280 unit tests / 33 suites, 85 E2E tests | ✅ |
| README update | ❌ |
| EPA Level III authoritative region polygons | ❌ |
| Native plant expansion (10+ per region, currently 6) | ❌ |
| Invasive species warnings per region | ❌ |
| Seasonal planting calendar per zone | ❌ |
| City marker expansion (30+ cities, currently 21) | ❌ |

---

## Issue 1 — README update

**Branch:** `docs/readme-update`  
**Label:** `docs`  
**Scope:** `README.md` only — no code changes, no test changes

**Changes needed:**
- Intro: replace "fall line corridor, 8 states" → full eastern corridor, 22 states, 6 regions, 21 cities
- "What it shows" table: add Blue Ridge, Valley & Ridge, NE Upland, NE Coastal, Gulf Coastal, rivers (interactive), detail pages
- Update city marker count: 15 → 21
- Update hardiness: 8 states / zones 5a–9a → 22 states / zones 3b–10a
- Unit tests: 172 / 20 suites → 280 / 33 suites
- E2E tests: 71 → 85; per-file: test_map.py 19→31, test_markers.py 12→14
- Project structure: add `data/regions.geojson`, `scripts/extract-regions.js`, `scripts/generate-regions.js`
- Hardiness pipeline code block: update state list from 8 to 22 states
- Suite table: add suites 21–33

**Suite names 21–33** (from `node --test tests/geo.test.js`):
21. BLUE_RIDGE_GEOJSON structure
22. Blue Ridge ecological data
23. Appalachian city markers
24. Detail page HTML generators
25. classifyLocation and makeLocationReport
26. NE_FALL_ZONE_GEOJSON structure
27. MAJOR_RIVERS_GEOJSON structure
28. makeRiverDetailHTML()
29. VALLEY_RIDGE_GEOJSON structure
30. Valley and Ridge ecological data
31. NE_UPLAND_GEOJSON structure
32. NE_COASTAL_GEOJSON structure
33. Blue Ridge escarpment shared boundaries

**E2E counts per file:**
- `test_map.py` — 31
- `test_search.py` — 12
- `test_legend_toggle.py` — 9
- `test_markers.py` — 14
- `test_visual_rendering.py` — 19

---

## Issue 2 — EPA Level III region data

**Branch:** `data/epa-ecoregions`  
**Label:** `data`  
**Scope:** `data/regions.geojson` (regenerate), `scripts/extract-regions.js`, `scripts/fetch-epa-ecoregions.js`

**Status:** Scripts complete — `data/regions.geojson` remains on improved interim polygons pending network access to `geodata.epa.gov`.

**What:** Replace the interim hand-drawn polygons in `data/regions.geojson` with authoritative EPA Level III ecoregion boundaries.

**Automated pipeline (GitHub Actions — no local setup needed):**

Trigger the workflow from the Actions tab:
> Actions → "Update EPA Level III region data" → Run workflow

The workflow (`update-epa-regions.yml`) fetches the EPA data, regenerates
`data/regions.geojson`, verifies region keys and file size, runs all 280 unit
tests, and opens a PR automatically if the data has changed. Runs quarterly
on a schedule as well.

**Manual pipeline (requires access to geodata.epa.gov):**
```bash
# Step 1 — fetch all EPA L3 features (paginates automatically)
node scripts/fetch-epa-ecoregions.js /tmp/us_eco_l3.geojson

# Step 2 — extract + map to Ridge to Coast region keys
node scripts/extract-regions.js /tmp/us_eco_l3.geojson data/regions.geojson

# Step 3 — verify
node --test tests/geo.test.js   # must pass 280/280
```

**L3 → region mapping** (in `scripts/extract-regions.js`):
- `63, 65, 83` → `coastal`
- `45, 64, 58, 59, 84` → `piedmont`
- `66` → `blueRidge`
- `67–71, 78–81` → `valleyRidge`
- `73–76` → `gulfCoastal`

**Fallback (no network):**
```bash
node scripts/generate-regions.js   # regenerates from inline polygons in lib/geo-data.js
```

---

## Issue 3 — Native plant expansion

**Branch:** `feat/native-plants-expansion`  
**Label:** `enhancement`  
**Scope:** `lib/geo-data.js` (NATIVE_PLANTS object), `tests/geo.test.js` (if count assertions exist)

**What:** Each ecoregion currently has 6 native plant entries. Expand to ≥ 10.

**Regions to expand:** `coastal`, `piedmont`, `ecotone`, `blueRidge`, `valleyRidge`, `gulfCoastal`

**Entry schema** (must match existing):
```javascript
{ name: 'Common Name', latin: 'Genus species', type: 'tree|shrub|perennial|grass|fern|vine', note: '1–2 sentences.' }
```

**Acceptance criteria:**
- Each region ≥ 10 entries (add 4+ to each)
- No duplicate latin names within a region
- `type` is one of: tree, shrub, perennial, grass, fern, vine
- All 280 unit tests pass

**Sources:** USDA PLANTS Database (plants.usda.gov), Lady Bird Johnson Wildflower Center (wildflower.org)

---

## Issue 4 — City marker expansion

**Branch:** `feat/city-markers-expansion`  
**Label:** `enhancement`  
**Scope:** `lib/geo-data.js` (FALL_LINE_CITIES array)

**What:** Expand from 21 to 30+ city markers.

**Entry schema** (must match existing):
```javascript
{ name, state, lat, lon, river, region, soil, zone, note }
// region: 'coastal' | 'piedmont' | 'blueRidge' | 'valleyRidge' | 'gulfCoastal'
```

**Candidate cities:**
| City | State | lat | lon | region |
|---|---|---|---|---|
| Mobile | AL | 30.694 | -88.040 | gulfCoastal |
| Savannah | GA | 32.080 | -81.100 | coastal |
| Hartford | CT | 41.763 | -72.685 | piedmont |
| Providence | RI | 41.824 | -71.413 | coastal |
| Portland | ME | 43.661 | -70.255 | coastal |
| Harrisburg | PA | 40.273 | -76.884 | piedmont |
| Frederick | MD | 39.414 | -77.411 | piedmont |
| Morgantown | WV | 39.629 | -79.956 | valleyRidge |
| Knoxville | TN | 35.961 | -83.921 | valleyRidge |

**Acceptance criteria:**
- `FALL_LINE_CITIES.length >= 30`
- All fields present and within BBOX (lat 24–47.5°N, lon -92 to -66.5°W)
- All 280 unit + 85 E2E tests pass (`test_markers.py` checks count matches data)

---

## Issue 5 — Invasive species warnings

**Branch:** `feat/invasive-species`  
**Label:** `enhancement`  
**Scope:** `lib/geo-data.js`, `tests/geo.test.js` (new suite), `tests/e2e/test_map.py` (1 test)

**What:** Add invasive species section to region popups and detail pages.

**Data structure:**
```javascript
const INVASIVE_SPECIES = {
  coastal:     [{ name, latin, type, threat: 'high|medium', note }],
  piedmont:    [...],
  blueRidge:   [...],
  valleyRidge: [...],
  gulfCoastal: [...],
  ecotone:     [...],
};
```

**Key invasives:**
- All regions: Kudzu (*Pueraria montana*), Japanese Honeysuckle (*Lonicera japonica*)
- Piedmont/Blue Ridge: Tree of Heaven (*Ailanthus altissima*), Chinese Wisteria
- Coastal: Common Reed (*Phragmites australis*), Chinese Privet (*Ligustrum sinense*)
- Gulf: Water Hyacinth (*Eichhornia crassipes*), Cogon Grass (*Imperata cylindrica*)
- Valley & Ridge: Autumn Olive (*Elaeagnus umbellata*), Multiflora Rose (*Rosa multiflora*)

**Acceptance criteria:**
- `INVASIVE_SPECIES` with all 6 region keys, ≥ 3 entries each
- `makeInvasivesSection(region)` returns HTML string
- Section appears in `makeRegionDetailHTML()` and `makeRegionPopup()` output
- New unit test suite; 1 new E2E test

---

## Issue 6 — Seasonal planting calendar

**Branch:** `feat/planting-calendar`  
**Label:** `enhancement`  
**Scope:** `lib/geo-data.js`, `style.css`, `tests/geo.test.js`, `tests/e2e/test_map.py`

**What:** Static per-zone monthly planting calendar shown on zone detail pages.

**Data structure:**
```javascript
const PLANTING_CALENDAR = {
  '6b': {
    jan: { startIndoors: ['Onions', 'Leeks'], directSow: [], transplant: [] },
    feb: { startIndoors: ['Peppers', 'Eggplant', 'Tomatoes'], directSow: ['Spinach'], transplant: [] },
    // ... all 12 months
  },
  // zones 5a–10a
};
```

**Acceptance criteria:**
- All zones in `data/hardiness.geojson` covered (zones 3b–10a)
- Each zone has all 12 months with ≥ 1 activity per month
- `makeZoneDetailHTML(zone)` includes calendar section
- New unit test suite; 1–2 new E2E tests

**Sources:** Old Farmer's Almanac (by zone), USDA PHZM zone definitions

---

## Architecture notes for future agents

```
lib/geo-data.js       — all data constants + HTML builder functions (no Leaflet/DOM)
map.js                — Leaflet init + layer logic; fetches data/regions.geojson and
                        data/hardiness.geojson async
data/regions.geojson  — 7-feature FeatureCollection (region polygons); load via:
                        node scripts/generate-regions.js  (interim, from inline polygons)
                        node scripts/extract-regions.js /path/us_eco_l3.geojson  (EPA)
scripts/process-hardiness.js   — clips ophz GeoJSON to corridor BBOX
scripts/extract-coastline.js   — extracts Atlantic coast from Natural Earth 50m
scripts/extract-regions.js     — EPA Level III → data/regions.geojson
scripts/generate-regions.js    — inline polygons → data/regions.geojson (interim)

Test commands:
  node --test tests/geo.test.js                                  # 280 unit tests
  python3 -m http.server 8765 &
  python3 -m pytest tests/e2e/ --base-url http://localhost:8765  # 85 E2E tests
```
