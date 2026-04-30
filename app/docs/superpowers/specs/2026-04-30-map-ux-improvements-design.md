# Map UX Improvements Design

**Date:** 2026-04-30

## Problem

Four friction points in the current map experience:

1. **Hardiness overlay is slow** — toggling hardiness zones triggers a 3.8MB fetch on first use, causing a visible spinner delay.
2. **Region polygons are inaccurate** — the daily EPA pipeline has been failing, leaving `regions.geojson` stale. Daily automation is overkill; EPA ecoregion boundaries change once per decade at most.
3. **Default view is overwhelming** — the map opens on the full eastern US at zoom 8 centered on DC. The corridor's depth is not immediately apparent.
4. **Mobile drag opens info page** — dragging to pan on mobile can accidentally trigger `navigate()` when the drag starts over an interactive layer (city, region, river).

---

## Architecture

All changes are confined to three files:
- `app/map.js` — initial view, pre-fetch, drag guard
- `app/tests/geo.test.js` — new tests for all changes
- `.github/workflows/update-epa-regions.yml` — remove schedule cron

A one-time manual pipeline run generates the known-good `app/data/regions.geojson` baseline committed directly to main.

---

## Feature 1: Smart Initial View

On map init, call `navigator.geolocation.getCurrentPosition()` with a **3-second timeout** before setting the default view.

**If geolocation succeeds:** find the nearest corridor city using the existing `haversineKm()` function from `geo-data.js`, then `map.flyTo([city.lat, city.lon], 10)`.

**If geolocation times out or is denied:** pick randomly from 4 curated corridor windows and call `map.setView()`:

| Window | Center | Zoom | Regions in frame |
|---|---|---|---|
| Mid-Atlantic | [39.5, -77.8] | 7 | Piedmont, Fall Line, Coastal Plain, Blue Ridge |
| Virginia/Carolinas | [36.5, -79.5] | 7 | All 5 core regions |
| Georgia/Tennessee | [34.5, -84.5] | 7 | Valley & Ridge, Blue Ridge, Gulf Coastal, Piedmont |
| Great Lakes/Ohio | [42.0, -83.5] | 7 | Great Lakes, Interior Lowlands |

No permission prompt, no UI change. The map simply opens somewhere meaningful.

**Implementation:** Replace the hardcoded `center: [38.9, -77.0], zoom: 8` in map init with a `initMapView()` function that wraps the geolocation call. The map is initialized with a neutral center/zoom first, then `flyTo`/`setView` is called once the location is resolved or the timeout fires.

**Tests:** unit-test `initMapView` logic in `geo.test.js` — verify fallback windows are valid (center within BBOX, zoom 7), verify nearest-city lookup returns a city from `CORRIDOR_CITIES`.

---

## Feature 2: Hardiness Overlay Pre-fetch

After map init completes, immediately call `prefetchHardiness()` — a fire-and-forget `fetch('data/hardiness.geojson')` that parses the JSON and stores it in the existing hardiness cache variable (`hardinessCache`).

When the user later toggles the checkbox, the cache is already populated and the layer renders immediately. If the background fetch hasn't completed (slow connection), the existing spinner behavior is preserved as fallback.

**Implementation:** One function added to `map.js`, called once at the bottom of the init block. No change to toggle logic.

**Tests:** verify `prefetchHardiness` populates the cache variable; verify the toggle handler skips the fetch if cache is already populated.

---

## Feature 3: Mobile Drag Guard

Add two Leaflet map event listeners immediately after map init:

```js
map.on('movestart', function () { map._dragging = true; });
map.on('moveend',   function () { setTimeout(function () { map._dragging = false; }, 200); });
```

Add a guard at the top of every click/tap handler that calls `navigate()`:

```js
if (map._dragging) return;
```

Affected handlers: city marker click, region polygon click, fall line click, river click.

The 200ms timeout covers the gap between `moveend` and the synthetic click event that mobile browsers fire after a drag.

**Tests:** simulate `movestart` → click → verify `navigate()` not called; simulate click without prior move → verify `navigate()` is called.

---

## Feature 4: Region Pipeline → Manual Only

**`update-epa-regions.yml`:** remove the `schedule:` block entirely. Keep `workflow_dispatch:` so it can be triggered manually when EPA publishes a new ecoregion edition.

**One-time baseline fix:** run the pipeline locally to generate a known-good `regions.geojson` and commit it directly to main. This becomes the stable baseline.

```bash
node app/scripts/fetch-epa-ecoregions.js
node app/scripts/extract-regions.js /tmp/us_eco_l3.geojson app/data/regions.geojson
node --test app/tests/geo.test.js
git add app/data/regions.geojson .github/workflows/update-epa-regions.yml
git commit -m "fix: stable regions.geojson baseline + manual-only EPA pipeline"
```

**Tests:** existing `geo.test.js` region tests validate the committed `regions.geojson` schema on every push — no new tests needed here.

---

## Test Plan

| Change | Test type | What to verify |
|---|---|---|
| Smart initial view | Unit | Fallback windows have valid center/zoom; nearest-city lookup returns a `CORRIDOR_CITIES` entry |
| Hardiness pre-fetch | Unit | Cache populated after `prefetchHardiness()`; toggle skips fetch when cache hit |
| Drag guard | Unit | `navigate()` not called after `movestart`; called normally without prior move |
| Region pipeline | Existing | `geo.test.js` region suite passes against committed `regions.geojson` |

All tests: `node --test app/tests/geo.test.js` — must pass with 0 failures.
