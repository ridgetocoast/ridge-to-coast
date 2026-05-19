# Ridge to Coast — Frontend Guide

## Project Overview

**Ridge to Coast** is a fully-static Leaflet map app helping people in the eastern US understand the land they live on — ecological regions, hardiness zones, growing seasons, rivers, and what's happening in nature right now.

- **Live site:** https://ridgetocoast.com (Cloudflare Pages)
- **Stack:** Leaflet 1.9.4 (vendored), CARTO tiles, Nominatim geocoding
- **Zero npm dependencies** for core app — no build step, no bundler
- **Tests:** 335 unit tests (`node --test tests/geo.test.js`), E2E tests (`pytest tests/e2e/`)

---

## Multi-Agent Development Roles

| Role | Model | When to use | Trigger label |
|------|-------|-------------|--------------|
| **Planner** | `claude-haiku-4-5-20251001` | Analyze issue, write plan only — no code | `agent:plan` |
| **Architect** | `claude-opus-4-7` | Design components, interfaces, data flow | `agent:architect` |
| **Senior Engineer** | `claude-opus-4-7` | Complex features, data pipelines, CSP changes | `agent:implement-hard` |
| **Engineer** | `claude-sonnet-4-6` | Standard feature work, bug fixes, data additions | `agent:implement` |
| **Designer** | `claude-sonnet-4-6` | CSS, responsive layout, UI components | `agent:design` |

**Branch naming:** `claude/issue-{number}-{short-slug}`

---

## Critical Architecture Rules

### Zero npm dependencies (core app)
`lib/geo-data.js`, `map.js`, `index.html`, `style.css` must have **zero npm dependencies**. No `import` from npm. No `require()` from npm. Leaflet is vendored in `lib/`.

### Content Security Policy
CSP is enforced via `<meta http-equiv="Content-Security-Policy">` in `index.html` AND via `_headers` for Cloudflare Pages. Never add external script/style sources without updating both. Approved external `connect-src` sources:
- `https://a.basemaps.cartocdn.com` (CARTO tiles)
- `https://nominatim.openstreetmap.org` (geocoding)
- `https://api.weather.gov` (NWS frost advisories)
- `https://api.inaturalist.org` (iNaturalist observations)
- `https://waterservices.usgs.gov` (USGS streamflow)
- `https://api.ridgetocoast.com` (production Workers API)
- `https://preprod.ridgetocoast.com` (preprod Workers API)
- `https://alpha.ridgetocoast.com` (alpha Workers API)

### API_BASE routing
`map.js` declares `API_BASE` as an IIFE near the top of the file:
```js
var API_BASE = (function () {
  var h = window.location.hostname;
  if (h === 'ridgetocoast.com' || h === 'www.ridgetocoast.com') return 'https://api.ridgetocoast.com';
  if (h === 'alpha.ridgetocoast.com') return 'https://alpha.ridgetocoast.com';
  return 'https://preprod.ridgetocoast.com';
}());
```
All Workers API calls use `${API_BASE}/v1/...`. Never hardcode `api.ridgetocoast.com`.

### Shared geo-data.js pattern
`lib/geo-data.js` is used by both the browser (via `window.GeoData`) and Node.js tests (via `module.exports`). It must contain **zero DOM, Leaflet, or fetch calls at module load time** — only pure data and sync/async functions.

### Test file is the source of truth for data shape
Before changing any data structure in `geo-data.js`, check `tests/geo.test.js` to understand the expected shape.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/geo-data.js` | All geographic data, HTML generators, API fetch functions |
| `map.js` | Leaflet map init, layer management, hash routing, search |
| `index.html` | App shell, CSP meta tag, legend markup |
| `style.css` | Dark theme, responsive layout |
| `data/hardiness.geojson` | USDA hardiness zones, 5125 features (3.9 MB) |
| `data/regions.geojson` | EPA Level III ecoregions, auto-updated |
| `tests/geo.test.js` | 335 unit tests — run with `node --test tests/geo.test.js` |
| `tests/e2e/` | Playwright E2E tests — run with `pytest tests/e2e/` |

---

## Data Sources

- **Fall Line:** Hand-crafted from published USGS surveys — do not modify coordinates without source citation
- **EPA Level III Ecoregions:** Fetched via S3/FTP zip + ogr2ogr shapefile conversion (`.github/workflows/update-epa-regions.yml`)
- **Hardiness Zones:** From kgjenkins/ophz (USDA PHZM), processed by `scripts/process-hardiness.js`
- **Corridor Cities:** 51 manually curated entries in `CORRIDOR_CITIES` array
- **Planting Calendar:** 14 hardiness zones × 12 months in `PLANTING_CALENDAR`

---

## GitHub Actions

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | Every push/PR | Unit tests (Node 20 + 22) |
| `e2e.yml` | Every push/PR | E2E tests (Chromium) |
| `deploy-pages.yml` | Push to `main` (app/ changes) | Deploy frontend to Cloudflare Pages |
| `deploy-workers.yml` | Push to `main` / PR / `workflow_dispatch` | Stage or deploy Workers API |
| `promote-workers.yml` | `workflow_dispatch` | Promote staged version to production or rollback |
| `update-epa-regions.yml` | `workflow_dispatch` | EPA L3 data pipeline |
