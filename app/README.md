# Fall Line to Coast

An interactive web map of the **Atlantic Seaboard Fall Line** corridor — the geological boundary dividing the Piedmont (crystalline bedrock, rolling hills) from the Coastal Plain (Tidewater, sedimentary, flat) along the eastern United States.

The map currently covers three fall line metro areas: **Washington DC · Richmond VA · Raleigh NC**

Live at **[loobo07.github.io](https://loobo07.github.io)**

---

## What it shows

| Layer | Description |
|---|---|
| **Fall Line** | Approximate path of the geological boundary from Great Falls/DC (39.2°N) through Fredericksburg, Richmond, Petersburg, Emporia VA, Roanoke Rapids NC, and Falls of Neuse to south Raleigh (35.4°N) |
| **Coastal Plain (Tidewater)** | East of the fall line — flat terrain, sandy/silty sedimentary soils, tidal rivers navigable to the sea |
| **Piedmont** | West of the fall line — rolling hills, ancient crystalline bedrock, heavy clay soils, fast-flowing rivers with rapids at the fall line |
| **Hardiness Zones** | USDA Plant Hardiness Zones 5b–8a for the corridor, lazy-loaded from processed GeoJSON (lazy fetch, cached in memory) |
| **Click/tap popups** | Tap any region, the fall line, or a hardiness zone for geological and climate context |
| **Layer toggles** | Show/hide region shading, fall line, and hardiness zones independently |

### Why these cities?

Washington DC, Richmond VA, and Raleigh NC all sit at or near the fall line. Each city was founded at the head of navigation — the furthest inland point ships could reach before the river dropped over rapids onto the Piedmont plateau. The fall line explains:

- **Soil type** — Piedmont clay west of the line vs Coastal Plain sand east of it
- **Drainage** — opposite amendments needed for each soil type
- **Plant hardiness** — zones 6a–7b in the DC/Richmond corridor, 7b–8a in Raleigh
- **Native plant communities** — the ecotone (transition zone) supports unique biodiversity

---

## Stack

| Layer | Technology |
|---|---|
| Map rendering | [Leaflet.js](https://leafletjs.com) 1.9.4 (vendored locally — no CDN) |
| Base tiles | [CARTO](https://carto.com) `dark_all` (free, no API key) |
| Fall line / region data | Hand-crafted GeoJSON based on USGS geological surveys |
| Hardiness zone data | [kgjenkins/ophz](https://github.com/kgjenkins/ophz) (USDA PHZM via PRISM Oregon State), clipped and processed |
| Hosting | GitHub Pages (static, no backend, no build step) |
| Unit tests | Node.js built-in test runner (`node:test`) — zero npm dependencies |
| E2E tests | [Python Playwright](https://playwright.dev/python/) + pytest |
| CI | GitHub Actions — unit tests (Node 20 + 22) and E2E (Python 3.12 + Chromium) run in parallel |

---

## Project structure

```
├── index.html               # App shell, CSP meta header, layer toggles, legend
├── style.css                # Responsive layout, dark theme, mobile-first
├── map.js                   # Leaflet initialisation, layer logic, lazy hardiness loader
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
│   ├── geo.test.js          # 80 unit tests (Node built-in runner, no npm needed)
│   ├── results/             # TAP output from CI runs
│   └── e2e/
│       ├── conftest.py      # pytest-playwright fixtures; auto-fails on uncaught JS errors
│       ├── test_map.py      # 19 E2E tests (page load, layers, hardiness toggle, mobile)
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

**80 tests across 14 suites:**

| Suite | What it covers |
|---|---|
| 1 | Fall line GeoJSON structure (Feature type, LineString, coord count, name) |
| 2 | Geographic accuracy — corridor bbox containment, hemisphere guards, N→S direction, Belle Isle anchor, Great Falls anchor, Falls of Neuse anchor |
| 3 | Coastal Plain polygon (closed ring, region tag, east boundary, no west overshoot) |
| 4 | Piedmont polygon (closed ring, region tag, west boundary, no east overshoot) |
| 5 | Region separation (disjoint east/west checks) |
| 6 | STYLES object (color formats, opacity range, hover contrast) |
| 7 | `makeRegionPopup()` and `makeFallLinePopup()` (HTML structure, content) |
| 8 | `haversineKm()` (identity, Richmond→DC distance, symmetry) |
| 9 | BBOX constants (DC, Richmond, and Raleigh all inside bounds) |
| 11–14 | Hardiness zones (color map, `getZoneColor`, `getZoneInfo`, `makeZonePopup`) |

### E2E tests (Python Playwright)

Requires Python 3.8+ and internet access to install the browser once.

```bash
pip install -r tests/e2e/requirements.txt
playwright install chromium
python -m http.server 8000 &        # serve the static site locally
python -m pytest tests/e2e/ --base-url http://localhost:8000 -v
```

**19 tests across 4 suites:**

| Suite | What it covers |
|---|---|
| Page load | Title correct, `#map` visible, legend visible, all 3 toggles present, no uncaught JS errors |
| Layer rendering | SVG paths in overlay pane, region toggle removes/restores paths, fall line toggle |
| Hardiness toggle | Default off, fetch returns HTTP 200, legend populates, paths added, hide on uncheck, second toggle uses cache (no re-fetch) |
| Mobile (375×667) | Map fills screen, legend visible, subtitle hidden per CSS |

Any uncaught JavaScript error during a test causes automatic failure via the `conftest.py` `page` fixture.

---

## Hardiness zone data pipeline

The raw ophz GeoJSON files (~1–1.6 MB per state) are not committed. Run the processing script to regenerate `data/hardiness.geojson`:

```bash
# Download source files
curl -L https://raw.githubusercontent.com/kgjenkins/ophz/refs/heads/master/geojson/ophz_VA.geojson -o /tmp/ophz_VA.geojson
curl -L https://raw.githubusercontent.com/kgjenkins/ophz/refs/heads/master/geojson/ophz_NC.geojson -o /tmp/ophz_NC.geojson
curl -L https://raw.githubusercontent.com/kgjenkins/ophz/refs/heads/master/geojson/ophz_MD.geojson -o /tmp/ophz_MD.geojson

# Merge states
node -e "
  const fs = require('fs');
  const merged = { type:'FeatureCollection', features: [
    ...JSON.parse(fs.readFileSync('/tmp/ophz_VA.geojson')).features,
    ...JSON.parse(fs.readFileSync('/tmp/ophz_NC.geojson')).features,
    ...JSON.parse(fs.readFileSync('/tmp/ophz_MD.geojson')).features,
  ]};
  fs.writeFileSync('/tmp/ophz_merged.geojson', JSON.stringify(merged));
  console.log('Features:', merged.features.length);
"

# Process (clips to corridor bbox, reduces coordinate precision, deduplicates)
node scripts/process-hardiness.js /tmp/ophz_merged.geojson data/hardiness.geojson
```

Result: 155 features, zones 5b–8a, ~253 KB (91% reduction from 2.8 MB source).

---

## Security

- **Content Security Policy** — enforced via `<meta>` tag (GitHub Pages cannot set HTTP headers). Locks scripts to `'self'`, tiles to CARTO, no eval, no inline scripts.
- **Vendored Leaflet** — `lib/leaflet.js` and `lib/leaflet.css` are copied directly from the npm package. No CDN trust required.
- **No API keys** — CARTO `dark_all` tiles are free and keyless. All data is static and same-origin.
- **No backend** — fully static; no server-side code surface.

---

## Data accuracy

The fall line path is **approximate**, derived from published USGS geological maps. The true boundary is gradational — it varies with the underlying bedrock over a zone of several miles. Key verifiable river crossings used as anchors:

| City | River | Coordinates |
|---|---|---|
| Great Falls, MD/VA | Potomac | 39.000°N, 77.245°W |
| Fredericksburg, VA | Rappahannock | 38.302°N, 77.468°W |
| Richmond, VA | James (Belle Isle) | 37.527°N, 77.464°W |
| Petersburg, VA | Appomattox | 37.222°N, 77.395°W |
| Roanoke Rapids, NC | Roanoke | 36.462°N, 77.655°W |
| Raleigh, NC | Neuse (Falls of Neuse) | 35.897°N, 78.648°W |

---

## Roadmap

- [ ] City markers for DC, Richmond, and Raleigh with click context (history, soil type, zone)
- [ ] Soil type detail layer (Piedmont clay vs Coastal Plain sand sub-types)
- [ ] Native plant recommendations by ecoregion (Piedmont / Coastal Plain / fall line ecotone)
- [ ] Planting calendar integration — last/first frost dates per fall line metro
- [ ] Expand fall line corridor north (Philadelphia, Trenton) and south (Columbia SC, Augusta GA)
- [ ] Playwright E2E tests for visual rendering ([issue #2](https://github.com/loobo07/loobo07.github.io/issues/2))
- [ ] Community garden network layer — fall line cities sharing growing knowledge
