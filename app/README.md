# Fall Line to Coast

An interactive web map of the **Atlantic Seaboard Fall Line** — the geological boundary dividing the Piedmont (crystalline bedrock, rolling hills) from the Coastal Plain (Tidewater, sedimentary, flat) along the eastern United States.

The map covers the full fall line corridor from **Philadelphia PA / Trenton NJ** south through Washington DC, Richmond VA, and Raleigh NC to **Augusta GA**, including the Piedmont and Coastal Plain regions of VA, NC, MD, PA, and SC.

Live at **[loobo07.github.io](https://loobo07.github.io)**

---

## What it shows

| Layer / Feature | Description |
|---|---|
| **Fall Line** | Approximate path of the geological boundary from Peekskill NY / Hudson Highlands (41.3°N) south through Paterson NJ (Great Falls of the Passaic), New Brunswick NJ (Raritan River), Trenton NJ, Baltimore MD, DC, Fredericksburg, Richmond, Raleigh, Columbia SC, Augusta GA, Macon GA to Columbus GA (32.5°N) |
| **Coastal Plain (Tidewater)** | East of the fall line — flat terrain, sandy/silty sedimentary soils, tidal rivers navigable to the sea |
| **Piedmont** | West of the fall line — rolling hills, ancient crystalline bedrock, heavy clay soils, fast-flowing rivers with rapids at the fall line |
| **Hardiness Zones** | USDA Plant Hardiness Zones 5a–9a across 8 fall-line states (PA NJ DE MD VA NC SC GA), lazy-loaded and cached. Semi-transparent overlay (28% opacity) so region shading remains visible beneath. Zone-code labels (e.g. `7b`) appear on each polygon at zoom ≥ 9. |
| **Hardiness popups** | Tap any zone for 5 facts: avg minimum winter temp, first frost date, last frost date, growing season length, and example plants that thrive |
| **City markers** | 15 fall line metros (Peekskill NY → Columbus GA) shown as white circles with a pink border. Click for a popup with: river crossed, founding context (head of navigation history), soil type, and hardiness zone. Hover shows city name tooltip. Toggle in the legend. |
| **Layer toggles** | Show/hide region shading, fall line, city markers, and hardiness zones independently |
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
| E2E tests | [Python Playwright](https://playwright.dev/python/) + pytest |
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
│   └── hardiness.geojson    # Processed USDA hardiness zones — VA + NC + MD clipped to corridor
├── scripts/
│   └── process-hardiness.js # CLI: clips raw ophz GeoJSON to corridor bbox, reduces precision
├── tests/
│   ├── geo.test.js          # 143 unit tests across 18 suites (Node built-in runner, no npm needed)
│   ├── results/             # TAP output from CI runs
│   └── e2e/
│       ├── conftest.py      # pytest-playwright fixtures; auto-fails on uncaught JS errors
│       ├── test_map.py      # 19 E2E tests (page load, layers, hardiness toggle, mobile)
│       ├── test_search.py   # 12 E2E tests (search bar UI, geocoding, corridor messaging)
│       ├── test_legend_toggle.py  # 9 E2E tests (collapsible legend, mobile/desktop state)
│       ├── test_markers.py  # 12 E2E tests (city markers toggle, popup content, mobile)
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

**143 tests across 18 suites:**

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

### E2E tests (Python Playwright)

Requires Python 3.8+ and internet access to install the browser once.

```bash
pip install -r tests/e2e/requirements.txt
playwright install chromium
python -m http.server 8000 &        # serve the static site locally
python -m pytest tests/e2e/ --base-url http://localhost:8000 -v
```

**52 tests across 4 files:**

| File | Tests | What it covers |
|---|---|---|
| `test_map.py` | 19 | Page load, layer toggles (regions, fall line, hardiness), fetch/cache, mobile viewport |
| `test_search.py` | 12 | Search bar structure, zip vs city routing, Nominatim calls, corridor detection, GPS button |
| `test_legend_toggle.py` | 9 | Collapse/expand, mobile start state (collapsed), desktop start state (expanded), layer toggles work after expand |
| `test_markers.py` | 12 | City marker DOM presence, legend toggle on/off, popup content (city name, river, zone, region badge), mobile viewport |

Any uncaught JavaScript error during a test causes automatic failure via the `conftest.py` `page` fixture.

---

## Hardiness zone data pipeline

The raw ophz GeoJSON files (~0.1–1.6 MB per state) are not committed. Run the processing script to regenerate `data/hardiness.geojson`:

```bash
BASE=https://raw.githubusercontent.com/kgjenkins/ophz/refs/heads/master/geojson

# Download all fall-line states
for STATE in PA NJ DE MD VA NC SC GA; do
  curl -sL "$BASE/ophz_${STATE}.geojson" -o /tmp/ophz_${STATE}.geojson
done

# Merge into one file
node -e "
  const fs = require('fs');
  const states = ['PA','NJ','DE','MD','VA','NC','SC','GA'];
  const features = states.flatMap(s =>
    JSON.parse(fs.readFileSync('/tmp/ophz_' + s + '.geojson')).features);
  fs.writeFileSync('/tmp/ophz_merged.geojson',
    JSON.stringify({ type:'FeatureCollection', features }));
  console.log('Total features:', features.length);
"

# Clip to corridor bbox, decimate, reduce precision
node scripts/process-hardiness.js /tmp/ophz_merged.geojson data/hardiness.geojson
```

Result: 1429 features, zones 5a–9a, ~1169 KB raw / ~261 KB gzip (79% raw reduction from 5.3 MB source). GitHub Pages serves gzip automatically.

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

---

## Roadmap

- [x] Extend fall line corridor north to Philadelphia PA / Trenton NJ
- [x] Extend fall line corridor south through Columbia SC to Augusta GA
- [x] Extend fall line southwest to Macon GA / Columbus GA (Chattahoochee River falls)
- [x] Extend fall line northeast to Paterson NJ / Peekskill NY (Hudson Highlands)
- [x] Location search (zip code / city) with Nominatim geocoding
- [x] Collapsible legend (mobile-first, starts collapsed)
- [x] Hardiness zone overlay with 5-fact popup cards (frost dates, growing season, plants)
- [x] Add GA, PA, NJ, NY, SC hardiness data to pipeline (expand `data/hardiness.geojson` to all 8 fall-line states: PA NJ DE MD VA NC SC GA, zones 5a–9a)
- [x] City markers for major fall line metros with click context (history, soil type, zone)
- [ ] Soil type detail layer (Piedmont clay vs Coastal Plain sand sub-types)
- [ ] Native plant recommendations by ecoregion (Piedmont / Coastal Plain / fall line ecotone)
- [ ] Playwright E2E tests for visual rendering ([issue #2](https://github.com/loobo07/loobo07.github.io/issues/2))
- [ ] Community garden network layer — fall line cities sharing growing knowledge
