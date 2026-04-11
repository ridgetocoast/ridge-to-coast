/**
 * scripts/extract-coastline.js
 * ----------------------------
 * Extracts a simplified, outer-coast-only US East Coast polygon boundary
 * from Natural Earth 50m coastline data.
 *
 * The output is a JavaScript array of [lon, lat] coordinates suitable for
 * pasting directly into lib/geo-data.js as EAST_COAST_COORDS.
 *
 * Algorithm: Collect ALL coastline points across ALL features that fall
 * within the corridor bounding box. For each 0.2° latitude band, keep
 * only the easternmost (highest longitude) point. This naturally selects
 * the ocean-facing coast and jumps across bay mouths (Delaware Bay,
 * Chesapeake Bay, Pamlico Sound) without needing explicit bay-detection
 * logic. Small separate features (like the NC Outer Banks / Cape Hatteras)
 * are automatically included because they contribute the easternmost points
 * in their latitude bands. Points are sorted N→S and the fall line
 * N terminus is prepended as the polygon's starting anchor.
 *
 * Usage:
 *   # Download Natural Earth 50m coastline (~1.6 MB):
 *   curl -sL https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_coastline.geojson \
 *        -o /tmp/ne_50m_coastline.geojson
 *
 *   node scripts/extract-coastline.js /tmp/ne_50m_coastline.geojson
 *
 * Output: a JS array literal printed to stdout — copy it into geo-data.js
 * as EAST_COAST_COORDS.
 *
 * Source:
 *   Natural Earth 50m Coastline — https://www.naturalearthdata.com/
 *   Public Domain.
 */

'use strict';

const fs = require('fs');

// ── Corridor bbox ──────────────────────────────────────────────────────────
// Slightly wider than REGION_* to capture all coast features
const COAST_BBOX = {
  west:  -82.0,
  east:  -73.5,
  south:  32.2,   // just below REGION_SOUTH (32.3) to capture the southern limit
  north:  41.5,
};

// Band resolution: 0.2° latitude → ~22 km — visually smooth at zoom 4-10
const BAND_DEG = 0.2;

// Fall line northern terminus — first vertex of the output polygon,
// must match the first point of FALL_LINE_COORDS in geo-data.js exactly.
const FALL_LINE_N_TERMINUS = [-73.920, 41.290];

// ── Helpers ────────────────────────────────────────────────────────────────

function inBbox(lon, lat) {
  return lon >= COAST_BBOX.west  && lon <= COAST_BBOX.east &&
         lat >= COAST_BBOX.south && lat <= COAST_BBOX.north;
}

function roundCoord(n, decimals) {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ── Load ───────────────────────────────────────────────────────────────────

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/extract-coastline.js <ne_50m_coastline.geojson>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
console.error('Features in file:', data.features.length);

// ── Collect all in-bbox points from EVERY feature ─────────────────────────
// Using all features (not just the largest segment) ensures that separately
// encoded features like the NC Outer Banks / Cape Hatteras are included.

const allPts = [];
for (const feature of data.features) {
  const geom  = feature.geometry;
  const lines = geom.type === 'LineString'
    ? [geom.coordinates]
    : geom.type === 'MultiLineString' ? geom.coordinates : [];
  for (const line of lines) {
    for (const [lon, lat] of line) {
      if (inBbox(lon, lat)) allPts.push([lon, lat]);
    }
  }
}
console.error('In-bbox points (all features):', allPts.length);

// ── Easternmost point per latitude band ───────────────────────────────────
// Keeping only the easternmost (highest longitude) point in each BAND_DEG
// strip selects the ocean-facing coast and naturally jumps across bays.

const bands = {};
for (const [lon, lat] of allPts) {
  const key = Math.floor(lat / BAND_DEG) * BAND_DEG;
  if (!bands[key] || lon > bands[key][0]) {
    bands[key] = [lon, lat];
  }
}

// Sort N→S (descending latitude)
const coastPts = Object.entries(bands)
  .sort((a, b) => Number(b[0]) - Number(a[0]))
  .map(([, pt]) => pt);

console.error('Coast points after band filter:', coastPts.length);
console.error(
  'Lat range:', coastPts[coastPts.length - 1][1].toFixed(3),
  '→', coastPts[0][1].toFixed(3)
);
console.error(
  'Lon range:', Math.min(...coastPts.map(p => p[0])).toFixed(3),
  '→', Math.max(...coastPts.map(p => p[0])).toFixed(3)
);

// ── Build output array ─────────────────────────────────────────────────────
// Prepend the exact fall line N terminus as the polygon anchor so the
// Coastal Plain polygon closes perfectly when the fall line is appended.

const output = [
  FALL_LINE_N_TERMINUS,
  ...coastPts
    // Skip any point nearly identical to the terminus anchor to avoid duplication
    .filter(([lon, lat]) =>
      !(Math.abs(lon - FALL_LINE_N_TERMINUS[0]) < 0.05 &&
        Math.abs(lat - FALL_LINE_N_TERMINUS[1]) < 0.1))
    .map(([lon, lat]) => [roundCoord(lon, 3), roundCoord(lat, 3)]),
];

console.error('Final output points:', output.length);

// ── Print JS array ─────────────────────────────────────────────────────────

console.log('const EAST_COAST_COORDS = [');
console.log('  // US Atlantic coastline, N\u2192S, outer (ocean-facing) coast.');
console.log('  // Bay mouths (Delaware Bay, Chesapeake Bay, Pamlico Sound) are');
console.log('  // jumped by keeping the easternmost point per 0.2\u00b0 latitude band.');
console.log('  // Source: Natural Earth 50m Coastline (public domain).');
console.log('  // Generated: node scripts/extract-coastline.js ne_50m_coastline.geojson');
console.log('  // First point = fall line N terminus (Peekskill NY) for polygon closure.');
for (let i = 0; i < output.length; i++) {
  const [lon, lat] = output[i];
  const comma = i < output.length - 1 ? ',' : '';
  console.log(`  [${lon.toFixed(3)}, ${lat.toFixed(3)}]${comma}`);
}
console.log('];');
