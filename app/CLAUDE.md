# Ridge to Coast — Claude Code Guide

## Project Overview

**Ridge to Coast** is a fully-static GitHub Pages map app helping people in the eastern US understand the land they live on — ecological regions, hardiness zones, growing seasons, rivers, and what's happening in nature right now.

- **Live site:** https://loobo07.github.io
- **Stack:** Leaflet 1.9.4 (vendored), CARTO tiles, Nominatim geocoding, GitHub Pages
- **Zero npm dependencies** for core app — no build step, no bundler
- **Tests:** 308 unit tests (`node --test tests/geo.test.js`), 85 E2E tests (`pytest tests/e2e/`)

---

## Multi-Agent Development Roles

When working in this repo, use the role that matches the task:

| Role | Model | When to use | Trigger label |
|------|-------|-------------|--------------|
| **Planner** | `claude-haiku-4-5-20251001` | Analyze an issue, find reusable code, write implementation plan only — no code | `agent:plan` |
| **Architect** | `claude-opus-4-7` | Design components, interfaces, data flow; write spec to `docs/superpowers/specs/` | `agent:architect` |
| **Senior Engineer** | `claude-opus-4-7` | Complex features, data pipelines, architecture changes, CSP changes | `agent:implement-hard` |
| **Engineer** | `claude-sonnet-4-6` | Standard feature work, bug fixes, data additions | `agent:implement` |
| **Designer** | `claude-sonnet-4-6` | CSS, responsive layout, UI components | `agent:design` |

**Role prompt files:** `.claude/agents/planner.md`, `.claude/agents/architect.md`, `.claude/agents/engineer.md`

### Local Worktree Workflow

```bash
# Create isolated worktree per issue
git worktree add ../ridge-issue-N -b claude/issue-N-{slug}

# Open Claude Code in the worktree with appropriate model
cd ../ridge-issue-N
claude  # then /model to set model per role

# Run tests before opening PR (must pass)
node --test tests/geo.test.js

# Open PR
gh pr create --title "..." --body "Closes #N"
```

**Branch naming:** `claude/issue-{number}-{short-slug}`

---

## Critical Architecture Rules

### Zero npm dependencies (core app)
`lib/geo-data.js`, `map.js`, `index.html`, `style.css` must have **zero npm dependencies**. No `import` from npm. No `require()` from npm. Leaflet is vendored in `lib/`.

### Content Security Policy
CSP is in `index.html` as a `<meta http-equiv="Content-Security-Policy">` tag (GitHub Pages doesn't support HTTP headers). Never add external script/style sources without updating this tag. Approved external `connect-src` sources:
- `https://a.basemaps.cartocdn.com` (CARTO tiles)
- `https://nominatim.openstreetmap.org` (geocoding)
- `https://api.weather.gov` (NWS frost advisories)
- `https://api.inaturalist.org` (iNaturalist observations)
- `https://waterservices.usgs.gov` (USGS streamflow)

### Shared geo-data.js pattern
`lib/geo-data.js` is used by both the browser (via `window.GeoData`) and Node.js tests (via `module.exports`). It must contain **zero DOM, Leaflet, or fetch calls at module load time** — only pure data and sync/async functions. New API fetch functions go here; they are called lazily from `map.js`.

### Test file is the source of truth for data shape
Before changing any data structure in `geo-data.js`, check `tests/geo.test.js` to understand the expected shape. Tests document invariants that aren't obvious from code.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/geo-data.js` | All geographic data, HTML generators, API fetch functions (~4000 lines) |
| `map.js` | Leaflet map init, layer management, hash routing, search (~554 lines) |
| `index.html` | App shell, CSP meta tag, legend markup (~166 lines) |
| `style.css` | Dark theme, responsive layout (~973 lines) |
| `data/hardiness.geojson` | USDA hardiness zones, 5125 features (3.9 MB) |
| `data/regions.geojson` | EPA Level III ecoregions, auto-updated daily |
| `tests/geo.test.js` | 308 unit tests — run with `node --test tests/geo.test.js` |
| `tests/e2e/` | 85 Playwright E2E tests — run with `pytest tests/e2e/` |

### Where to add new code in geo-data.js

- New geographic data constants: after existing region definitions (~line 620)
- New HTML generator functions: after existing generators, before exports (~line 3988)
- New API fetch functions: just before the exports block (~line 3988)
- New exports: add to the `GeoData` object at the bottom (~line 4049)

---

## Data Sources

- **Fall Line:** Hand-crafted from published USGS surveys — do not modify coordinates without source citation
- **EPA Level III Ecoregions:** Auto-fetched daily via `.github/workflows/update-epa-regions.yml` → `data/regions.geojson`
- **Hardiness Zones:** From kgjenkins/ophz (USDA PHZM), processed by `scripts/process-hardiness.js`
- **Corridor Cities:** 51 manually curated entries in `CORRIDOR_CITIES` array (`geo-data.js:3033`)
- **Planting Calendar:** 14 hardiness zones × 12 months in `PLANTING_CALENDAR` (`geo-data.js:1664`)

---

## GitHub Actions

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | Every push/PR | Unit tests (Node 20 + 22) |
| `e2e.yml` | Every push/PR | E2E tests (Chromium) |
| `update-epa-regions.yml` | Daily 05:00 EST | EPA L3 data pipeline |
| `agent-pipeline.yml` | `agent:*` issue labels | Multi-agent pipeline (Bedrock pending) |

---

## Roadmap

See `ROADMAP.md` for phased feature plan. Current focus: **Growing Season MVP** — Seasonal Intelligence Card with NWS frost risk, planting windows, iNaturalist observations, USGS streamflow.

Design spec: `docs/superpowers/specs/2026-04-20-multi-agent-growing-season-design.md`
