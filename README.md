# Ridge to Coast

An interactive web map of the **Appalachian watershed corridor** — from the mountain ridge through the Piedmont and the Atlantic Seaboard Fall Line to the Tidewater and the Atlantic Coast. Covers the geological, ecological, and horticultural character of the eastern United States for gardeners, farmers, arborists, and ecological conservation groups.

The map covers the full eastern corridor across **22 states**, from the Blue Ridge highlands and Great Appalachian Valley through the Piedmont, Fall Line, and Atlantic/Gulf Coastal Plains — including **10 ecological regions**, **51 corridor cities**, USDA plant hardiness zones 3b–10a, native plants, and soil profiles from Maine to the Gulf Coast and Great Lakes.

Live at **[ridgetocoast.com](https://ridgetocoast.com)**

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
| **Seasonal Intelligence Card** | Live growing season data for any location: NWS frost risk, planting window from USDA hardiness zone calendar, recent iNaturalist plant observations, and nearest USGS river gauge flow. |
| **Detail pages** | Hash-routed pages (`#detail/region/piedmont`, `#detail/zone/7b`, `#detail/river/james`) with full ecological writeups, native plant lists, soil profiles, and city tables. Shareable URLs. |
| **Hardiness Zones** | USDA Plant Hardiness Zones 3b–10a across 22 states, lazy-loaded and cached. Semi-transparent overlay so region shading remains visible beneath. Zone-code labels (e.g. `7b`) appear on each polygon at zoom ≥ 9. |
| **City markers** | 51 corridor cities — fall line, Appalachian, Great Lakes, and Ohio Valley — shown as white circles with a pink border. Click for a popup with: river crossed, founding context (head of navigation history), soil type, and hardiness zone. Hover shows city name tooltip. Toggle in the legend. |
| **Location search** | Bottom search bar — enter a zip code or city name to fly the map to that location. GPS "locate me" button also supported. Results outside the corridor get a contextual note. |

---

## Stack

| Layer | Technology |
|---|---|
| Map rendering | [Leaflet.js](https://leafletjs.com) 1.9.4 (vendored locally — no CDN) |
| Base tiles | [CARTO](https://carto.com) `dark_all` (free, no API key) |
| Fall line / region data | Hand-crafted GeoJSON based on USGS geological surveys |
| Hardiness zone data | [kgjenkins/ophz](https://github.com/kgjenkins/ophz) (USDA PHZM via PRISM Oregon State), clipped and processed |
| Geocoding | [Nominatim](https://nominatim.openstreetmap.org) (OpenStreetMap) — free, no API key |
| Live data | NWS api.weather.gov · iNaturalist API v1 · USGS Water Services |
| Frontend hosting | [Cloudflare Pages](https://pages.cloudflare.com) — auto-deploys from `app/` on push to `main` |
| API (P3) | [Cloudflare Workers](https://workers.cloudflare.com) — `api.ridgetocoast.com` (prod) · `preprod.ridgetocoast.com` (preview) · `alpha.ridgetocoast.com` (alpha) — see `workers/` and `app/docs/environments.md` |
| Unit tests | Node.js built-in test runner (`node:test`) — zero npm dependencies |
| E2E tests | [Python Playwright](https://playwright.dev/python/) + pytest |
| CI | GitHub Actions — unit tests (Node 20 + 22) and E2E (Python 3.12 + Chromium) run in parallel |

---

## Repository layout

```
ridge-to-coast/
├── app/                          # Frontend — Leaflet map (deployed to Cloudflare Pages)
│   ├── index.html                # App shell, CSP meta header, collapsible legend, search bar
│   ├── style.css                 # Responsive layout, dark theme, mobile-first
│   ├── map.js                    # Leaflet init, layer logic, legend toggle, search, live data hydration
│   ├── lib/
│   │   ├── geo-data.js           # Pure geographic data and helpers (no Leaflet/DOM dependency)
│   │   ├── leaflet.js            # Vendored Leaflet 1.9.4
│   │   └── leaflet.css           # Vendored Leaflet CSS
│   ├── data/
│   │   ├── hardiness.geojson     # Processed USDA hardiness zones — 22 states, zones 3b–10a
│   │   └── regions.geojson       # Region polygons (9 features) — async-loaded by map.js
│   ├── scripts/
│   │   ├── process-hardiness.js  # CLI: clips raw ophz GeoJSON to corridor bbox, reduces precision
│   │   ├── extract-coastline.js  # CLI: extracts outer Atlantic coast from Natural Earth 50m data
│   │   ├── fetch-epa-ecoregions.js  # CLI: fetches EPA Level III ecoregion data via ArcGIS REST API
│   │   └── extract-regions.js    # CLI: converts EPA Level III ecoregion GeoJSON → data/regions.geojson
│   ├── docs/
│   │   └── superpowers/specs/    # Architectural specs (multi-agent workflow artifacts)
│   └── tests/
│       ├── geo.test.js           # 327 unit tests across 39 suites (Node built-in runner, no npm needed)
│       ├── results/              # TAP output from CI runs
│       └── e2e/                  # Python Playwright E2E tests
├── workers/                      # Cloudflare Workers — P3 REST API stubs
│   ├── index.js                  # Router with CORS headers
│   ├── ecoregion.js              # /v1/ecoregion handler
│   ├── calendar.js               # /v1/calendar handler
│   └── plants.js                 # /v1/plants handler
├── api/
│   └── openapi.yaml              # OpenAPI 3.1 spec for api.ridgetocoast.com
├── infra/
│   └── terraform/                # Cloudflare Pages, DNS, Workers, R2 (IaC)
├── .github/
│   └── workflows/
│       ├── test.yml              # Unit tests — Node 20 and 22, every push and PR
│       ├── deploy-pages.yml      # Deploy frontend to Cloudflare Pages on push to main
│       ├── deploy-workers.yml    # Stage/deploy Workers — prod stages via versions upload, preview/alpha deploy directly
│       ├── promote-workers.yml   # Manual promote (goes live) or rollback for any environment
│       └── update-epa-regions.yml  # Manual EPA data fetch — commits updated regions.geojson to main
├── CLAUDE.md                     # Agent roles, model assignments, project conventions
└── wrangler.toml                 # Cloudflare Workers deploy config
```

---

## Running the tests

### Unit tests (Node.js)

No `npm install` needed. Requires Node.js 18+.

```bash
node --test app/tests/geo.test.js
```

**327 tests across 39 suites** — see `app/tests/geo.test.js` for full suite listing.

### E2E tests (Python Playwright)

Requires Python 3.8+ and internet access to install the browser once.

```bash
pip install -r app/tests/e2e/requirements.txt
playwright install chromium
python -m http.server 8000 &
python -m pytest app/tests/e2e/ --base-url http://localhost:8000 -v
```

---

## Hardiness zone data pipeline

The raw ophz GeoJSON files (~0.1–1.6 MB per state) are not committed. Run the processing script to regenerate `app/data/hardiness.geojson`:

```bash
BASE=https://raw.githubusercontent.com/kgjenkins/ophz/refs/heads/master/geojson

for STATE in ME NH VT MA RI CT NY NJ DE MD PA WV VA NC SC GA FL AL MS TN KY OH; do
  curl -sL "$BASE/ophz_${STATE}.geojson" -o /tmp/ophz_${STATE}.geojson
done

node -e "
  const fs = require('fs');
  const states = ['ME','NH','VT','MA','RI','CT','NY','NJ','DE','MD','PA','WV','VA','NC','SC','GA','FL','AL','MS','TN','KY','OH'];
  const features = states.flatMap(s =>
    JSON.parse(fs.readFileSync('/tmp/ophz_' + s + '.geojson')).features);
  fs.writeFileSync('/tmp/ophz_merged.geojson',
    JSON.stringify({ type:'FeatureCollection', features }));
  console.log('Total features:', features.length);
"

node app/scripts/process-hardiness.js /tmp/ophz_merged.geojson app/data/hardiness.geojson
```

Result: 5125 features, zones 3b–10a, covering the full eastern corridor from Maine to Florida.

**Known data gaps:** Washington DC is not a US state so is excluded from state-level ophz files. DC zone polygons from Maryland border to DC proper may have gaps near Rock Creek Park and the Potomac waterfront.

---

## Region data pipeline

`app/data/regions.geojson` uses EPA Level III Ecoregion boundaries, updated daily by GitHub Actions.

```bash
node app/scripts/fetch-epa-ecoregions.js
node app/scripts/extract-regions.js /tmp/us_eco_l3.geojson app/data/regions.geojson
node --test app/tests/geo.test.js
```

**Manual only:** `.github/workflows/update-epa-regions.yml` is triggered via **Actions → "Update EPA Ecoregions" → Run workflow**. EPA ecoregion boundaries change ~once per decade; on-demand is sufficient.

ArcGIS endpoint: `geodata.epa.gov/arcgis/rest/services/ORD/USEPA_Ecoregions_Level_III_and_IV/MapServer/2`

---

## Security

- **Content Security Policy** — enforced via `<meta>` tag in `app/index.html` and Cloudflare Pages `_headers` file. Locks scripts to `'self'`, tiles to CARTO, live data to NWS/iNat/USGS, no eval, no inline scripts.
- **Vendored Leaflet** — `app/lib/leaflet.js` and `app/lib/leaflet.css` are copied directly from the npm package. No CDN trust required.
- **No API keys** — CARTO tiles, Nominatim geocoding, NWS, iNaturalist, and USGS Water Services are all free and keyless.
- **No backend** — fully static frontend; the Workers API (`workers/`) is stub-only pending P3.

---

## Data accuracy

The fall line path is **approximate**, derived from published USGS geological maps. Key verifiable river crossings used as anchors:

| City / Location | River | Coordinates |
|---|---|---|
| Peekskill NY | Hudson (Highlands boundary) | 41.290°N, 73.920°W |
| Paterson NJ | Passaic (Great Falls) | 40.917°N, 74.174°W |
| Trenton NJ | Delaware | 40.220°N, 74.770°W |
| Philadelphia PA | Schuylkill / Delaware | 40.000°N, 75.100°W |
| Great Falls, MD/VA | Potomac | 39.000°N, 77.245°W |
| Richmond, VA | James (Belle Isle) | 37.527°N, 77.464°W |
| Raleigh, NC | Neuse (Falls of Neuse) | 35.897°N, 78.648°W |
| Columbia, SC | Congaree / Saluda | 34.000°N, 81.030°W |
| Augusta, GA | Savannah | 33.470°N, 82.020°W |
| Columbus, GA | Chattahoochee | 32.460°N, 84.990°W |

---

## Roadmap

- [x] Fall line corridor — Peekskill NY to Columbus GA
- [x] Location search (zip code / city) with Nominatim geocoding
- [x] Hardiness zone overlay with 5-fact popup cards
- [x] Expand hardiness zone data to 22 states (zones 3b–10a)
- [x] 51 corridor city markers across all 9 regions
- [x] Native plant recommendations by ecoregion
- [x] Soil type detail in region popups
- [x] Major rivers interactive layer with detail pages
- [x] Hash-routed detail pages with shareable URLs
- [x] Great Lakes Basin and Interior Lowlands / Ohio Valley regions
- [x] Invasive species warnings per region (10 regions, threat badges)
- [x] Seasonal planting calendar per hardiness zone (14 zones × 12 months)
- [x] EPA Level III authoritative region polygons with daily update pipeline
- [x] Move to Cloudflare Pages + ridgetocoast.com domain
- [x] Phase 2: Live data integrations — NWS frost risk, USGS streamflow, iNaturalist observations, location report pages
- [ ] Phase 3: Open REST API — `/api/v1/ecoregion`, `/api/v1/calendar`, `/api/v1/plants` via Cloudflare Workers (see `workers/` and `api/openapi.yaml`)
- [ ] Phase 4: Mobile PWA, watershed education module, custom org layers
