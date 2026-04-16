# Ridge to Coast

An interactive web map of the **Appalachian watershed corridor** — from the mountain ridge through the Piedmont and the Atlantic Seaboard Fall Line to the Tidewater and the Atlantic Coast. Covers the geological, ecological, and horticultural character of the eastern United States for gardeners, farmers, arborists, and ecological conservation groups.

The map covers the full eastern corridor across **22 states**, from the Blue Ridge highlands and Great Appalachian Valley through the Piedmont, Fall Line, and Atlantic/Gulf Coastal Plains — including **10 ecological regions**, **51 corridor cities**, USDA plant hardiness zones 3b–10a, native plants, and soil profiles from Maine to the Gulf Coast and Great Lakes.

Live at **[loobo07.github.io](https://loobo07.github.io)**

---

## What it shows

| Layer / Feature | Description |
|---|---|
| **Fall Line** | Approximate path of the geological boundary from Peekskill NY / Hudson Highlands (41.3°N) south through Paterson NJ, Trenton NJ, Baltimore MD, DC, Fredericksburg, Richmond, Raleigh, Columbia SC, Augusta GA, Macon GA to Columbus GA (32.5°N). Click for an ecotone popup with native plants and transitional soil profile. |
| **New England Fall Zone** | Separate fall zone from Augusta ME south through Manchester NH, Lowell MA, Pawtucket RI to Waterbury CT — the mill-city fall line that powered the Industrial Revolution. |
| **Coastal Plain (Tidewater)** | East of the mid-Atlantic fall line — flat terrain, sandy/silty sedimentary soils, tidal rivers. Eastern boundary follows the actual US Atlantic coastline (Natural Earth 50m data), including the Outer Banks and Georgia Sea Islands. Click for native plant recommendations and soil profile. |
| **New England Coastal Lowland** | Glacial outwash and marine sediments SE of the New England fall zone — coastal CT, RI, MA, Long Island, and Cape Cod. Same coastal ecology as the mid-Atlantic Tidewater. |
| **Piedmont** | West of the fall line — rolling hills, ancient crystalline bedrock, heavy clay soils. Extends from Maryland through the Virginia and Carolina Piedmont to NW Georgia. |
| **New England Upland** | Glacially scoured crystalline upland NW of the New England fall zone — the equivalent of the Piedmont in CT, MA, NH, VT, and ME. |
| **Blue Ridge / Appalachian Mountains** | Ancient crystalline highlands from South Mountain PA south through the Shenandoah, Black Mountains NC, and Great Smoky Mountains to NW Georgia. Elevations 1,500–6,600 ft, strongly acidic soils, spruce-fir forests and Southern Appalachian endemics. |
| **Valley and Ridge / Great Appalachian Valley** | Parallel limestone ridges and fertile valley floors west of the Blue Ridge — the Shenandoah Valley (VA/WV), Cumberland Valley (MD/PA), Tennessee Valley, and Coosa Valley (AL/GA). Rich Alfisols support world-class orchards and grain farms. |
| **Gulf Coastal Plain** | Southern continuation of the Atlantic Coastal Plain wrapping around the base of the Appalachians — AL/MS fall line, Memphis Embayment, Florida panhandle, and northern Florida peninsula. Tertiary sands and limestone, longleaf pine savannas, cypress swamps. |
| **Great Lakes Basin** | Wisconsin, Michigan, northern Illinois/Indiana/Ohio, and western New York — the glacially sculpted basin holding 21% of Earth's surface fresh water. Calcareous Alfisols from limestone drift, lake-effect snowbelts, and the oak savanna–boreal forest transition. |
| **Interior Lowlands / Ohio Valley** | Central/western Ohio, Indiana, Illinois, Kentucky, and central Tennessee — the Ohio–Tennessee–Cumberland river drainages west of the Appalachian Plateau. Some of the deepest, most fertile Alfisols and Mollisols in North America underlie the Bluegrass horse country, Nashville Basin, and Midwest corn belt. |
| **Major Rivers** | Invisible interactive layer — click any river for a detail page with drainage basin, fall line crossing, and ecological notes. Covers the James, Roanoke, Rappahannock, Potomac, Susquehanna, Delaware, Hudson, Connecticut, Savannah, Altamaha, Chattahoochee, and more. |
| **Detail pages** | Hash-routed pages (`#detail/region/piedmont`, `#detail/zone/7b`, `#detail/river/james`) with full ecological writeups, native plant lists, soil profiles, and city tables. Shareable URLs. |
| **Hardiness Zones** | USDA Plant Hardiness Zones 3b–10a across 22 states, lazy-loaded and cached. Semi-transparent overlay so region shading remains visible beneath. Zone-code labels (e.g. `7b`) appear on each polygon at zoom ≥ 9. |
| **Hardiness popups** | Tap any zone for 5 facts: avg minimum winter temp, first frost date, last frost date, growing season length, and example plants that thrive. |
| **City markers** | 51 corridor cities — fall line, Appalachian, Great Lakes, and Ohio Valley — shown as white circles with a pink border. Click for a popup with: river crossed, founding context (head of navigation history), soil type, and hardiness zone. Hover shows city name tooltip. Toggle in the legend. |
| **Layer toggles** | Show/hide region shading, fall line, city markers, and hardiness zones independently. Regions switch to outline-only when hardiness zones are active to reduce visual overlap. |
| **Location search** | Bottom search bar — enter a zip code or city name to fly the map to that location. GPS "locate me" button also supported. Results outside the corridor get a contextual note. |
| **Collapsible legend** | Toggle button collapses/expands the legend panel. Starts collapsed on mobile (≤600 px) to maximise map visibility; starts expanded on desktop. |

### Why these cities?

Peekskill NY, Paterson NJ, New Brunswick NJ, Philadelphia, DC, Richmond, Raleigh, Columbia SC, and Columbus GA all sit at or near the fall line. Each city was founded at the **head of navigation** — the furthest inland point ships could reach before the river dropped over rapids onto the Piedmont plateau. The fall line explains:

- **Soil type** — Piedmont clay west of the line vs Coastal Plain sand east of it
- **Drainage** — opposite amendments needed for each soil type
- **Plant hardiness** — zones 6a–7b in the DC/Richmond corridor, 7b–8a in Raleigh and the Carolinas
- **Native plant communities** — the ecotone (transition zone) supports unique biodiversity

---

## Stack

| Layer | Technology |
|---|---|
| Map rendering | [Leaflet.js](https://leafletjs.com) 1.9.4 (vendored locally — no CDN) |
| Base tiles | [CARTO](https://carto.com) `dark_all` (free, no API key) |
| Fall line / region data | Hand-crafted GeoJSON based on USGS geological surveys |
| Hardiness zone data | [kgjenkins/ophz](https://github.com/kgjenkins/ophz) (USDA PHZM via PRISM Oregon State), clipped and processed |
| Geocoding | [Nominatim](https://nominatim.openstreetmap.org) (OpenStreetMap) — free, no API key |
| Hosting | GitHub Pages (static, no backend, no build step) |
| Unit tests | Node.js built-in test runner (`node:test`) — zero npm dependencies |
| E2E tests | [Python Playwright](https://playwright.dev/python/) + pytest (85 tests across 5 files) |
| CI | GitHub Actions — unit tests (Node 20 + 22) and E2E (Python 3.12 + Chromium) run in parallel |

---

## Project structure

```
├── index.html               # App shell, CSP meta header, collapsible legend, search bar
├── style.css                # Responsive layout, dark theme, mobile-first
├── map.js                   # Leaflet init, layer logic, legend toggle, search, geolocation
├── lib/
│   ├── geo-data.js          # Pure geographic data and helpers (no Leaflet/DOM dependency)
│   ├── leaflet.js           # Vendored Leaflet 1.9.4
│   ├── leaflet.js.map       # Leaflet source map
│   └── leaflet.css          # Vendored Leaflet CSS
├── data/
│   ├── hardiness.geojson    # Processed USDA hardiness zones — 22 states, zones 3b–10a
│   └── regions.geojson      # Region polygons (7 features) — async-loaded by map.js
├── scripts/
│   ├── process-hardiness.js # CLI: clips raw ophz GeoJSON to corridor bbox, reduces precision
│   ├── extract-coastline.js # CLI: extracts outer Atlantic coast from Natural Earth 50m data
│   ├── extract-regions.js   # CLI: converts EPA Level III ecoregion GeoJSON → data/regions.geojson
│   └── generate-regions.js  # CLI: generates data/regions.geojson from inline polygon constants
├── tests/
│   ├── geo.test.js          # 280 unit tests across 33 suites (Node built-in runner, no npm needed)
│   ├── results/             # TAP output from CI runs
│   └── e2e/
│       ├── conftest.py      # pytest-playwright fixtures; auto-fails on uncaught JS errors
│       ├── test_map.py      # 31 E2E tests (page load, layers, hardiness toggle, mobile)
│       ├── test_search.py   # 12 E2E tests (search bar UI, geocoding, corridor messaging)
│       ├── test_legend_toggle.py  # 9 E2E tests (collapsible legend, mobile/desktop state)
│       ├── test_markers.py  # 14 E2E tests (city markers toggle, popup content, mobile)
│       ├── test_visual_rendering.py  # 19 E2E tests (SVG colors, opacities, hover, toggles)
│       └── requirements.txt # pytest + pytest-playwright
└── .github/
    └── workflows/
        ├── test.yml         # Unit tests — Node 20 and 22, every push and PR
        └── e2e.yml          # E2E tests — Python 3.12 + Chromium, every push and PR
```

---

## Running the tests

### Unit tests (Node.js)

No `npm install` needed. Requires Node.js 18+.

```bash
node --test tests/geo.test.js
```

**280 tests across 33 suites:**

| Suite | What it covers |
|---|---|
| 1 | Fall line GeoJSON structure (Feature type, LineString, coord count, name) |
| 2 | Geographic accuracy — NY–GA belt containment, hemisphere guards, N→S direction, Belle Isle anchor, Great Falls anchor, Falls of Neuse anchor, Trenton NJ anchor, New Brunswick NJ anchor, Paterson NJ anchor, Peekskill NY anchor, Macon GA anchor, Columbus GA anchor |
| 3 | Coastal Plain polygon (closed ring, region tag, east boundary, no west overshoot) |
| 4 | Piedmont polygon (closed ring, region tag, west boundary, no east overshoot) |
| 5 | Region separation (disjoint east/west checks) |
| 6 | STYLES object (color formats, opacity range, hover contrast) |
| 7 | `makeRegionPopup()` (HTML structure, content, CSS classes, per-region variation) |
| 8 | `makeFallLinePopup()` (returns string, mentions Fall Line, Piedmont, Coastal Plain, approximation) |
| 9 | `haversineKm()` (identity, Richmond→DC distance, symmetry) |
| 10 | BBOX constants (DC, Richmond, and Raleigh all inside bounds) |
| 11 | `HARDINESS_ZONE_COLORS` map (coverage, hex format) |
| 12 | `getZoneColor()` (known zones, unknown fallback) |
| 13 | `getZoneInfo()` (all required fields, temp range format, 9a subtropical description) |
| 14 | `makeZonePopup()` (HTML structure, zone badge, frost dates, growing season, plants) |
| 15 | `isValidUSZipCode()` (5-digit pass, invalid reject, edge cases) |
| 16 | `isInCorridor()` — true for Richmond, Raleigh, DC, Philadelphia, New Brunswick NJ, Paterson NJ, Peekskill NY, Columbia SC, Macon GA, Columbus GA; false for Boston MA, Montauk NY, Louisville KY, Jacksonville FL, Miami FL; BBOX boundary inclusive |
| 17 | `buildSearchQuery()` (zip vs city routing, Nominatim URL format, encoding) |
| 18 | `FALL_LINE_CITIES` array + `makeMarkerPopup()` (data structure, required fields, corridor BBOX check, popup HTML — city name, river, soil, zone badge, region badge) |
| 19 | `NATIVE_PLANTS` + `makeNativePlantsSection()` (data structure, latin name format, type validation, Loblolly Pine/Bald Cypress spot checks, HTML output, cross-region isolation, region/fall-line popup integration) |
| 20 | `SOIL_TYPES` + `makeSoilSection()` (data structure, required fields, pH range format, Cecil/Appling Piedmont spot check, Norfolk/Goldsboro Coastal spot check, HTML output, cross-region isolation, region/fall-line popup integration) |
| 21 | `BLUE_RIDGE_GEOJSON` structure (Feature type, Polygon, closed ring, region tag, name) |
| 22 | Blue Ridge ecological data (plants, soil, cities — structure, required fields, content spot checks) |
| 23 | Appalachian city markers (Blue Ridge and Valley & Ridge cities — data structure, BBOX containment, region tag) |
| 24 | Detail page HTML generators (`makeRegionDetailHTML()`, `makeZoneDetailHTML()`, `makeRiverDetailHTML()` — structure, required sections) |
| 25 | `classifyLocation()` and `makeLocationReport()` (region assignment by lat/lon, report structure, all region keys) |
| 26 | `NE_FALL_ZONE_GEOJSON` structure (Feature type, LineString, coord count, Augusta ME → Peekskill NY) |
| 27 | `MAJOR_RIVERS_GEOJSON` structure (FeatureCollection, required properties — name, basin, fallLineCrossing) |
| 28 | `makeRiverDetailHTML()` (returns HTML string, river name, basin, fall line crossing, ecological notes) |
| 29 | `VALLEY_RIDGE_GEOJSON` structure (Feature type, Polygon, closed ring, region tag, name) |
| 30 | Valley and Ridge ecological data (plants, soil, cities — structure, required fields, content spot checks) |
| 31 | `NE_UPLAND_GEOJSON` structure (Feature type, Polygon, closed ring, `piedmont` region tag) |
| 32 | `NE_COASTAL_GEOJSON` structure (Feature type, Polygon, closed ring, `coastal` region tag) |
| 33 | Blue Ridge escarpment shared boundaries (east/west escarpment arrays — shared endpoints between Blue Ridge, Piedmont, and Valley & Ridge polygons) |

### E2E tests (Python Playwright)

Requires Python 3.8+ and internet access to install the browser once.

```bash
pip install -r tests/e2e/requirements.txt
playwright install chromium
python -m http.server 8000 &        # serve the static site locally
python -m pytest tests/e2e/ --base-url http://localhost:8000 -v
```

**85 tests across 5 files:**

| File | Tests | What it covers |
|---|---|---|
| `test_map.py` | 31 | Page load, layer toggles (regions, fall line, hardiness), fetch/cache, all 6 regions, rivers layer, detail page routing, mobile viewport |
| `test_search.py` | 12 | Search bar structure, zip vs city routing, Nominatim calls, corridor detection, GPS button |
| `test_legend_toggle.py` | 9 | Collapse/expand, mobile start state (collapsed), desktop start state (expanded), layer toggles work after expand |
| `test_markers.py` | 14 | City marker DOM presence, legend toggle on/off, popup content (city name, river, zone, region badge), Appalachian city markers, mobile viewport |
| `test_visual_rendering.py` | 19 | SVG fill/stroke colors and opacities for all layers, hover opacity transitions, city marker count, toggle visual effect |

Any uncaught JavaScript error during a test causes automatic failure via the `conftest.py` `page` fixture.

---

## Hardiness zone data pipeline

The raw ophz GeoJSON files (~0.1–1.6 MB per state) are not committed. Run the processing script to regenerate `data/hardiness.geojson`:

```bash
BASE=https://raw.githubusercontent.com/kgjenkins/ophz/refs/heads/master/geojson

# Download all 22 corridor states
for STATE in ME NH VT MA RI CT NY NJ DE MD PA WV VA NC SC GA FL AL MS TN KY OH; do
  curl -sL "$BASE/ophz_${STATE}.geojson" -o /tmp/ophz_${STATE}.geojson
done

# Merge into one file
node -e "
  const fs = require('fs');
  const states = ['ME','NH','VT','MA','RI','CT','NY','NJ','DE','MD','PA','WV','VA','NC','SC','GA','FL','AL','MS','TN','KY','OH'];
  const features = states.flatMap(s =>
    JSON.parse(fs.readFileSync('/tmp/ophz_' + s + '.geojson')).features);
  fs.writeFileSync('/tmp/ophz_merged.geojson',
    JSON.stringify({ type:'FeatureCollection', features }));
  console.log('Total features:', features.length);
"

# Clip to corridor bbox, decimate, reduce precision
node scripts/process-hardiness.js /tmp/ophz_merged.geojson data/hardiness.geojson
```

Result: 5125 features, zones 3b–10a, covering the full eastern corridor from Maine to Florida. GitHub Pages serves gzip automatically.

**Known data gaps:** Washington DC is not a US state so is excluded from state-level ophz files. DC zone polygons from Maryland border to DC proper may have gaps near Rock Creek Park and the Potomac waterfront.

---

## Security

- **Content Security Policy** — enforced via `<meta>` tag (GitHub Pages cannot set HTTP headers). Locks scripts to `'self'`, tiles to CARTO, geocoding to `nominatim.openstreetmap.org`, no eval, no inline scripts.
- **Vendored Leaflet** — `lib/leaflet.js` and `lib/leaflet.css` are copied directly from the npm package. No CDN trust required.
- **No API keys** — CARTO `dark_all` tiles and Nominatim geocoding are free and keyless. All map data is static and same-origin.
- **No backend** — fully static; no server-side code surface.

---

## Data accuracy

The fall line path is **approximate**, derived from published USGS geological maps. The true boundary is gradational — it varies with the underlying bedrock over a zone of several miles. Key verifiable river crossings used as anchors:

| City / Location | River | Coordinates |
|---|---|---|
| Peekskill NY | Hudson (Highlands boundary) | 41.290°N, 73.920°W |
| Paterson NJ | Passaic (Great Falls) | 40.917°N, 74.174°W |
| New Brunswick NJ | Raritan | 40.490°N, 74.445°W |
| Trenton NJ | Delaware | 40.220°N, 74.770°W |
| Philadelphia PA | Schuylkill / Delaware | 40.000°N, 75.100°W |
| Wilmington DE | Brandywine Creek | 39.740°N, 75.540°W |
| Baltimore MD | Jones Falls / Patapsco | 39.270°N, 76.730°W |
| Great Falls, MD/VA | Potomac | 39.000°N, 77.245°W |
| Fredericksburg, VA | Rappahannock | 38.302°N, 77.468°W |
| Richmond, VA | James (Belle Isle) | 37.527°N, 77.464°W |
| Petersburg, VA | Appomattox | 37.222°N, 77.395°W |
| Roanoke Rapids, NC | Roanoke | 36.462°N, 77.655°W |
| Raleigh, NC | Neuse (Falls of Neuse) | 35.897°N, 78.648°W |
| Columbia, SC | Congaree / Saluda | 34.000°N, 81.030°W |
| Augusta, GA | Savannah | 33.470°N, 82.020°W |
| Milledgeville, GA | Oconee | 33.080°N, 83.230°W |
| Macon, GA | Ocmulgee | 32.840°N, 83.630°W |
| Columbus, GA | Chattahoochee | 32.460°N, 84.990°W |

Frost date estimates in the hardiness zone popups are approximations based on USDA zone midpoints — consult your local agricultural extension office for precise planting dates.

Hardiness zone frost dates (first frost, last frost, growing season) are approximate regional averages based on NOAA climate normals for the DC–Raleigh corridor. Actual dates vary by microclimate, elevation, and urban heat island effect.

**Coastal Plain polygon — Atlantic coastline boundary:** The Coastal Plain (Tidewater) shading uses the actual US Atlantic coastline as its eastern boundary, derived from Natural Earth 50m coastline data. The outer (ocean-facing) coast is extracted using an easternmost-point-per-latitude-band algorithm that naturally jumps across bay mouths (Delaware Bay, Chesapeake Bay, Pamlico Sound) without tracing bay interiors. The Outer Banks / Cape Hatteras appear correctly because that feature is a separate segment in the Natural Earth data and contributes the easternmost point in its latitude bands. Source data: Natural Earth 50m Coastline (public domain). Pipeline script: `scripts/extract-coastline.js`.

---

## Coastline data pipeline

The `EAST_COAST_COORDS` array in `lib/geo-data.js` was generated from Natural Earth 50m coastline data. To regenerate it:

```bash
# Download Natural Earth 50m coastline (~1.6 MB):
curl -sL https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_coastline.geojson \
     -o /tmp/ne_50m_coastline.geojson

# Extract the outer Atlantic coast (prints JS array to stdout):
node scripts/extract-coastline.js /tmp/ne_50m_coastline.geojson
```

Copy the output into `lib/geo-data.js` as `EAST_COAST_COORDS`, replacing the existing array.

The algorithm collects all coastline points within the corridor bounding box from all 1428 Natural Earth features, then keeps only the easternmost (highest longitude) point per 0.2° latitude band. Points are sorted N→S and the fall line northern terminus (Peekskill NY) is prepended as the polygon anchor.

---

## Roadmap

- [x] Extend fall line corridor north to Philadelphia PA / Trenton NJ
- [x] Extend fall line corridor south through Columbia SC to Augusta GA
- [x] Extend fall line southwest to Macon GA / Columbus GA (Chattahoochee River falls)
- [x] Extend fall line northeast to Paterson NJ / Peekskill NY (Hudson Highlands)
- [x] Location search (zip code / city) with Nominatim geocoding
- [x] Collapsible legend (mobile-first, starts collapsed)
- [x] Hardiness zone overlay with 5-fact popup cards (frost dates, growing season, plants)
- [x] Expand hardiness zone data to 22 states (zones 3b–10a, Maine to Florida)
- [x] City markers for 25 fall line and Appalachian metros with click context (history, soil type, zone)
- [x] Clip Coastal Plain polygon to the actual US coastline — Natural Earth 50m coastline data; no more ocean overshoot
- [x] Native plant recommendations by ecoregion — 6 plants per region shown in region and fall line click popups
- [x] Playwright E2E tests for visual rendering — SVG attribute assertions for all map layers
- [x] Soil type detail in region popups — USDA soil series, texture class, pH range, drainage class, amendment recommendations
- [x] Rename app to **Ridge to Coast** — expanded scope to full Appalachian watershed corridor
- [x] Blue Ridge region polygon with plants, soil, cities, and detail page
- [x] Valley & Ridge / Great Appalachian Valley region polygon with ecological data
- [x] New England Upland and Coastal Lowland regions (CT, MA, RI, NH, VT, ME, Long Island, Cape Cod)
- [x] Gulf Coastal Plain region (AL, MS, TN Memphis Embayment, FL panhandle and peninsula)
- [x] New England fall zone (Augusta ME → Manchester NH → Lowell MA → Pawtucket RI → Waterbury CT)
- [x] Major rivers interactive layer with detail pages
- [x] Hash-routed detail pages (`#detail/region/`, `#detail/zone/`, `#detail/river/`) with shareable URLs
- [x] `data/regions.geojson` async fetch architecture (EPA Level III ready)
- [ ] EPA Level III authoritative region polygons (replace interim hand-drawn polygons)
- [ ] Expand native plants to 10+ per region (currently 6)
- [ ] Invasive species warnings per region
- [ ] Seasonal planting calendar per hardiness zone
- [x] City marker expansion to 30+ cities — 34 cities
- [ ] Community garden network layer — fall line cities sharing growing knowledge
- [ ] Phase 2: Live data integrations — USDA PLANTS API, iNaturalist observations, NWS frost advisories, watershed delineation, printable location reports
- [ ] Phase 3: Open REST API — `/api/v1/ecoregion`, `/api/v1/calendar`, `/api/v1/plants`, `/api/v1/soil` endpoints via Cloudflare Workers or Vercel Edge Functions (free tier)
- [ ] Phase 4: Mobile PWA, education curriculum, institutional partnerships, sustainable funding (USDA/EPA grants + institutional API subscriptions)
