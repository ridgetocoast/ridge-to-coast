# Ridge to Coast — Roadmap

## Phase 1 — Complete ✅
> 9 regions · 51 cities · 22 states · 308 unit tests

| Feature | PR |
|---|---|
| Rename to Ridge to Coast | [#1](../../pull/1) |
| Blue Ridge, Valley & Ridge, NE Upland, NE Coastal, Gulf Coastal regions | [#1](../../pull/1) |
| Great Lakes Basin + Interior Lowlands regions | [#9](../../pull/9) |
| Rivers — invisible interactive layer (tooltip + detail pages) | [#1](../../pull/1) |
| Hardiness zones — 22 states, zones 3b–10a | [#1](../../pull/1) |
| Hash routing detail pages (`#detail/region/`, `#detail/zone/`, `#detail/river/`) | [#1](../../pull/1) |
| `data/regions.geojson` async fetch (EPA pipeline ready) | [#1](../../pull/1) |
| Native plants 10–12 per region (6 types) | [#7](../../pull/7) |
| Invasive species warnings per region | [#10](../../pull/10) |
| Seasonal planting calendar per zone | [#10](../../pull/10) |
| 51 corridor cities | [#9](../../pull/9) |
| NE Upland / NE Coastal / Gulf legend entries | [#9](../../pull/9) |
| EPA Level III pipeline (GitHub Actions, daily) | [#6](../../pull/6) |
| README update | [#4](../../pull/4) |

### EPA region data source

EPA Level III Ecoregion data is **actively maintained** (last updated May 2025).
The pipeline script (`scripts/fetch-epa-ecoregions.js`) was updated to the
current ArcGIS endpoint. Trigger via Actions → "Update EPA Level III region data".

| Source | URL | Notes |
|---|---|---|
| ArcGIS REST (script) | `geodata.epa.gov/arcgis/rest/services/ORD/USEPA_Ecoregions_Level_III_and_IV/MapServer/2` | Paginated GeoJSON; reachable from GitHub Actions |
| HTTPS zip | `gaftp.epa.gov/EPADataCommons/ORD/Ecoregions/us/us_eco_l3_state.zip` | Shapefile; needs ogr2ogr to convert |
| S3 browser | `dmap-prod-oms-edc.s3.us-east-1.amazonaws.com/index.html#ORD/Ecoregions/` | Manual browse + download |
| CEC (NA) | `cec.org/north-american-environmental-atlas/terrestrial-ecoregions-level-iii/` | Same data + Canada + Mexico |

**Note on CEJST** (`screening-tools.com/climate-economic-justice-screening-tool`):
This is a *different dataset* — census-tract environmental justice scores, not
ecoregion polygons. It could become a future overlay layer (#future), but does
not replace the ecoregion pipeline. Its status under the current administration
is uncertain.

---

## Phase 2 — Living Data
*Free public APIs and OpenStreetMap. No backend required.*

| Issue | Feature |
|---|---|
| [#11](../../issues/11) | "Plant now?" frost advisory via NWS API |
| [#12](../../issues/12) | Location report page (`#detail/location/lat/lon`) |
| [#13](../../issues/13) | USGS streamflow on river detail pages |
| [#14](../../issues/14) | Community gardens layer (OpenStreetMap) |
| [#15](../../issues/15) | iNaturalist observation badge per region |
| [#16](../../issues/16) | Watershed delineation on map click |
| [#17](../../issues/17) | PWA service worker (offline access) |

---

## Phase 3 — REST API
*Cloudflare Workers. Start with the spec (#18) before any endpoint work.*

| Issue | Feature |
|---|---|
| [#18](../../issues/18) | OpenAPI spec (`api/openapi.yaml`) |
| [#19](../../issues/19) | `GET /api/v1/ecoregion?lat=&lon=` |
| [#20](../../issues/20) | `GET /api/v1/calendar?zone=&month=` |
| [#21](../../issues/21) | `GET /api/v1/plants?region=&type=` |
| [#22](../../issues/22) | Embeddable region widget (`widget.html`) |

---

## Phase 4 — Platform

| Issue | Feature |
|---|---|
| [#23](../../issues/23) | PWA install + GPS field mode |
| [#24](../../issues/24) | Watershed steward education module |
| [#25](../../issues/25) | Custom org layer (`?layer=` GeoJSON param) |
| [#26](../../issues/26) | Grant targets (USDA · EPA · NSF) |

---

## Dev reference
```bash
node --test tests/geo.test.js
python3 -m http.server 8765 &
python3 -m pytest tests/e2e/ --base-url http://localhost:8765
```
