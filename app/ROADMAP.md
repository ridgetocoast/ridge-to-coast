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
| 308 unit tests / 37 suites, 85 E2E tests | ✅ |
| README update | ✅ |
| EPA Level III authoritative region polygons | ❌ |
| Native plant expansion (10+ per region) | ✅ |
| Invasive species warnings per region | ✅ |
| Seasonal planting calendar per zone | ✅ |
| City marker expansion (51 corridor cities) | ✅ |
| NE Upland / NE Coastal legend entries | ✅ |
| Great Lakes Basin region | ✅ |
| Interior Lowlands / Ohio Valley region | ✅ |

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
`data/regions.geojson`, verifies all 9 region keys and file size, runs all 308 unit
tests, and opens a PR automatically if the data has changed. Runs quarterly
on a schedule as well.

**Manual pipeline (requires access to geodata.epa.gov):**
```bash
# Step 1 — fetch all EPA L3 features (paginates automatically)
node scripts/fetch-epa-ecoregions.js /tmp/us_eco_l3.geojson

# Step 2 — extract + map to Ridge to Coast region keys
node scripts/extract-regions.js /tmp/us_eco_l3.geojson data/regions.geojson

# Step 3 — verify
node --test tests/geo.test.js   # must pass 308/308
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

## Issue 7 — NE Upland / NE Coastal legend entries

**Branch:** `feat/ne-legend-entries`  
**Label:** `enhancement`  
**Scope:** `map.js` (legend config), `style.css` (legend colors), `tests/e2e/test_legend_toggle.py`

**What:** NE Upland and NE Coastal regions render as shaded polygons on the map but have no named rows in the legend toggle panel. Add legend entries so users can identify and toggle these two regions independently.

**Context:** The EPA pipeline (Issue 2) replaces polygon *boundaries* only — it does not add or remove legend entries. The legend region keys (`blueRidge`, `valleyRidge`, `gulfCoastal`, `piedmont`, `coastal`) are Ridge to Coast labels mapped from EPA L3 codes, not EPA labels. NE Upland and NE Coastal are separate Ridge to Coast region keys (`neUpland`, `neCoastal`) that need the same legend treatment regardless of polygon source.

**Changes needed:**
- In `map.js`: add `neUpland` and `neCoastal` to the region layer/legend config with display names "NE Upland" and "NE Coastal"
- In `style.css`: assign distinct fill colors (currently they fall back to a default) — suggest muted teal for NE Upland, muted blue-green for NE Coastal
- In `tests/e2e/test_legend_toggle.py`: add toggle tests for the two new legend rows

**Acceptance criteria:**
- Legend panel shows entries for "NE Upland" and "NE Coastal" with matching swatch colors
- Clicking each legend entry toggles the respective polygon layer on/off
- All existing 280 unit + 85 E2E tests still pass; new E2E tests added for the two new toggle rows

---

## Issue 8 — Western Expansion: Great Lakes & Interior Lowlands

**Branch:** `feat/western-expansion`  
**Label:** `enhancement`  
**Scope:** `lib/geo-data.js`, `data/regions.geojson`, `scripts/extract-regions.js`, `scripts/generate-regions.js`, `tests/geo.test.js`, `map.js` (legend), `style.css`

### Why

The Appalachian Mountains are a continental divide: rivers drain either east to the Atlantic (already mapped) or west into the Ohio, Tennessee, and Cumberland rivers — which all flow to the Mississippi. The current map covers only the Atlantic slope. Adding the western watershed completes the corridor and captures the full range of states east of the Mississippi River.

### Two new region keys

| Key | Display name | Core states |
|---|---|---|
| `greatLakes` | Great Lakes Basin | WI, MI, northern IL/IN/OH, MN east of Mississippi |
| `interiorLowlands` | Interior Lowlands / Ohio Valley | central & western OH, IN, IL east of Mississippi, KY, central TN |

### Geographic boundaries

**`greatLakes`** — the Great Lakes drainage basin south of the Canadian border:
- West boundary: Mississippi River from Prairie du Chien WI (~43.0°N, -91.2°W) north to the WI/MN border, then east to Lake Superior
- North boundary: US–Canada border along Lake Superior, Lake Huron, Lake Erie, Lake Ontario
- South boundary: southern limit of the last glaciation (roughly the Valparaiso/Shelbyville moraines at ~41°N in Indiana/Ohio, ~42°N in Illinois)
- East boundary: connects to `neUpland` at the Niagara Frontier / western New York; `valleyRidge` at the Appalachian Plateau escarpment in northwestern Pennsylvania

**`interiorLowlands`** — the Ohio-Tennessee-Cumberland drainage west of the Appalachian Plateau:
- West boundary: Mississippi River (~-89.5°W at Missouri–Illinois line, south to Memphis)
- East boundary: Appalachian Plateau western escarpment (~-82°W in Ohio, ~-84°W in Kentucky)
- North boundary: southern limit of glaciation / `greatLakes` southern edge (~41°N)
- South boundary: connects to `gulfCoastal` at the Memphis embayment (~35°N) and Gulf Coastal foothills

### EPA Level III → region mapping (for `scripts/extract-regions.js`)

| EPA L3 Code | L3 Name | → Ridge to Coast key |
|---|---|---|
| 50 | Northern Lakes and Forests | `greatLakes` |
| 51 | North Central Hardwood Forests | `greatLakes` |
| 53 | Southeastern Wisconsin Till Plains | `greatLakes` |
| 56 | Southern Michigan/Northern Indiana Drift Plains | `greatLakes` |
| 57 | Huron/Erie Lake Plains | `greatLakes` |
| 83 | Eastern Great Lakes and Hudson Lowlands | `greatLakes` |
| 54 | Central Corn Belt Plains | `interiorLowlands` |
| 55 | Eastern Corn Belt Plains | `interiorLowlands` |
| 70 | Interior River Valleys and Hills | `interiorLowlands` |
| 71 | Interior Plateau | `interiorLowlands` |
| 72 | Interior River Lowlands | `interiorLowlands` |

### Data required in `lib/geo-data.js`

Add for each new region key (matching existing structure):

1. **GeoJSON polygon constant** — e.g. `GREAT_LAKES_GEOJSON`, `INTERIOR_LOWLANDS_GEOJSON`  
   - `properties`: `{ region, name, states, climate, description, area_sq_mi }`

2. **`NATIVE_PLANTS[key]`** — ≥ 10 entries, balanced types (tree × 3, perennial × 3, shrub × 2, grass × 1, fern × 1, vine × 1)

   Key natives for `greatLakes`: Sugar Maple, Paper Birch, White Pine, Bur Oak, Wild Bergamot, Prairie Blazing Star, Buttonbush, Highbush Blueberry, Blue-Eyed Grass, Ostrich Fern, Virginia Wild Rye, Wild Grape  
   Key natives for `interiorLowlands`: Tulip Poplar, Sycamore, Shagbark Hickory, Redbud, Wild Blue Phlox, Pale Purple Coneflower, Spicebush, Wild Ginger, Prairie Dropseed, Maidenhair Fern, Trumpet Vine

3. **`SOIL_TYPES[key]`** — soil profile object  

   `greatLakes` soils: Poygan–Hochheim–Kewaunee (Inceptisols / Alfisols from glacial till and lake sediments); silty clay loam to sandy loam; pH 6.5–7.5; well to moderately drained; rich in calcium from limestone drift; minimal amendment on most sites  
   `interiorLowlands` soils: Miami–Crosby–Cincinnati (Alfisols / Mollisols in prairie zones); silt loam to silty clay loam; pH 6.0–7.5; variable drainage — well drained on uplands, poorly drained in glaciated till plains; historically some of the most fertile soils in North America

4. **`REGION_LABELS[key]`** — display names as above

### Candidate cities

**`greatLakes`:**
| City | State | lat | lon |
|---|---|---|---|
| Chicago | IL | 41.881 | -87.627 |
| Milwaukee | WI | 43.044 | -87.910 |
| Detroit | MI | 42.331 | -83.046 |
| Cleveland | OH | 41.499 | -81.694 |
| Toledo | OH | 41.664 | -83.555 |
| Green Bay | WI | 44.519 | -88.020 |
| Ann Arbor | MI | 42.281 | -83.748 |
| Buffalo | NY | 42.886 | -78.879 |
| Marquette | MI | 46.543 | -87.395 |

**`interiorLowlands`:**
| City | State | lat | lon |
|---|---|---|---|
| Columbus | OH | 39.961 | -82.998 |
| Indianapolis | IN | 39.768 | -86.158 |
| Louisville | KY | 38.252 | -85.759 |
| Nashville | TN | 36.165 | -86.784 |
| Cincinnati | OH | 39.103 | -84.512 |
| Lexington | KY | 38.040 | -84.503 |
| Springfield | IL | 39.781 | -89.650 |
| Evansville | IN | 37.971 | -87.571 |

### Acceptance criteria

- 2 new GeoJSON polygon constants in `lib/geo-data.js`
- `NATIVE_PLANTS`, `SOIL_TYPES`, `REGION_LABELS` entries for both keys
- `data/regions.geojson` regenerated with 9 features total (7 existing + 2 new)
- `scripts/extract-regions.js` updated with L3 → `greatLakes` / `interiorLowlands` mappings
- `scripts/generate-regions.js` updated with new inline polygons
- `map.js` / `style.css` legend entries added (muted steel-blue for `greatLakes`, muted amber-green for `interiorLowlands`)
- `CORRIDOR_CITIES` entries added for candidate cities above with full schema
- All existing unit tests pass + new suites for the two new regions (structure, plants, soil)
- 85 E2E tests still pass

### Implementation order

1. Polygon constants + GeoJSON in `lib/geo-data.js`
2. Regenerate `data/regions.geojson`
3. Add native plants and soil profiles
4. Add city entries to `FALL_LINE_CITIES`
5. Update `scripts/extract-regions.js` with new L3 codes
6. Update legend in `map.js` + colors in `style.css`
7. Update unit tests (city BBOX, region key allowlist) + add new suites
8. Update ROADMAP status table and README

---

## Architecture notes for future agents

```
lib/geo-data.js       — all data constants + HTML builder functions (no Leaflet/DOM)
map.js                — Leaflet init + layer logic; fetches data/regions.geojson and
                        data/hardiness.geojson async
data/regions.geojson  — 9-feature FeatureCollection (region polygons); load via:
                        node scripts/generate-regions.js  (interim, from inline polygons)
                        node scripts/extract-regions.js /path/us_eco_l3.geojson  (EPA)
scripts/process-hardiness.js   — clips ophz GeoJSON to corridor BBOX
scripts/extract-coastline.js   — extracts Atlantic coast from Natural Earth 50m
scripts/extract-regions.js     — EPA Level III → data/regions.geojson
scripts/generate-regions.js    — inline polygons → data/regions.geojson (interim)

Test commands:
  node --test tests/geo.test.js                                  # 308 unit tests
  python3 -m http.server 8765 &
  python3 -m pytest tests/e2e/ --base-url http://localhost:8765  # 85 E2E tests
```
