# Richmond Fall Line Map

An interactive web map of Richmond, VA showing the **Atlantic Seaboard Fall Line** — the geological boundary that divides the Coastal Plain (Tidewater) to the east from the Piedmont to the west.

Live at **[loobo07.github.io](https://loobo07.github.io)**

---

## What it shows

- **Fall Line** — the approximate path of the geological boundary running NNE–SSW through the Richmond metro area, anchored to the James River rapids at Belle Isle
- **Coastal Plain (Tidewater)** — east of the fall line; flat terrain, soft sedimentary rock, tidal rivers navigable by ship
- **Piedmont** — west of the fall line; rolling hills, ancient crystalline bedrock, fast-flowing rivers
- **Layer toggles** — show/hide region shading and the fall line independently
- **Click/tap popups** — tap any region or the fall line for historical context

Richmond was founded *at* the fall line because it was the furthest inland point ships could navigate. The James River rapids mark exactly where the river drops off the Piedmont plateau.

---

## Stack

| Layer | Technology |
|---|---|
| Map rendering | [Leaflet.js](https://leafletjs.com) 1.9.4 |
| Base tiles | [CARTO](https://carto.com) dark_all (free, no API key) |
| Geographic data | Hand-crafted GeoJSON based on USGS geological surveys |
| Hosting | GitHub Pages (static, no backend) |

---

## Project structure

```
├── index.html          # App shell and security headers
├── style.css           # Responsive layout, dark theme, mobile-first
├── map.js              # Leaflet initialisation and layer logic
├── lib/
│   └── geo-data.js     # Pure geographic data and helpers (no Leaflet/DOM)
├── tests/
│   ├── geo.test.js     # 59 unit tests (Node built-in runner, no npm needed)
│   └── results/
│       └── latest.txt  # Most recent test run output
└── .github/
    └── workflows/
        └── test.yml    # CI: runs tests on Node 20 and 22 for every push and PR
```

---

## Running the tests

No npm install needed. Requires Node.js 18+.

```bash
node --test tests/geo.test.js
```

Tests cover GeoJSON structure, geographic accuracy (fall line anchor at Belle Isle, bounding box containment, N→S direction, coordinate transposition guard), polygon closure, region separation, styles, popup generators, and the Haversine distance utility.

---

## Data accuracy

The fall line path is **approximate**, derived from published USGS geological maps. The true boundary is gradational — it varies with the underlying bedrock and has no single sharp edge. The James River rapids at Belle Isle (~37.527°N, 77.467°W) are the most geographically verifiable reference point and are used to anchor the line.

---

## Roadmap

- [ ] Add Playwright E2E tests for visual rendering (tracked in [issue #2](https://github.com/loobo07/loobo07.github.io/issues/2))
- [ ] Restore CSP with correctly computed SRI hashes for Leaflet
- [ ] Add Richmond neighborhood boundary overlays (GeoJSON from city open data)
- [ ] Block-level Coastal Plain / Piedmont classification using parcel data
