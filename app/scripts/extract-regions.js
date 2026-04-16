/**
 * scripts/extract-regions.js
 * ──────────────────────────
 * Converts EPA Level III Ecoregion GeoJSON into data/regions.geojson,
 * the authoritative region polygon data for Ridge to Coast.
 *
 * This script is the long-term replacement for the hand-drawn polygon
 * constants in lib/geo-data.js.  Running it regenerates the region
 * overlay whenever the underlying ecological boundary data is updated.
 *
 * ── Data source ───────────────────────────────────────────────────────────
 *   US EPA Level III Ecoregions of the Conterminous United States
 *   US_L3CODE / US_L3NAME fields in GeoJSON format.
 *   Public domain, produced by the US Environmental Protection Agency.
 *   https://www.epa.gov/eco-research/level-iii-and-iv-ecoregions-continental-united-states
 *
 * ── Download options ──────────────────────────────────────────────────────
 *
 *   Option A — EPA FTP (shapefile, requires ogr2ogr / GDAL):
 *     curl -sL https://gaftp.epa.gov/EPADataCommons/ORD/Ecoregions/us/us_eco_l3.zip \
 *          -o /tmp/us_eco_l3.zip
 *     unzip /tmp/us_eco_l3.zip -d /tmp/us_eco_l3/
 *     ogr2ogr -f GeoJSON -t_srs EPSG:4326 /tmp/us_eco_l3.geojson \
 *             /tmp/us_eco_l3/us_eco_l3.shp
 *
 *   Option B — EPA ArcGIS REST (direct GeoJSON, paginated, no extra tools):
 *     node scripts/fetch-epa-ecoregions.js  # see companion script
 *
 * ── Usage ─────────────────────────────────────────────────────────────────
 *   node scripts/extract-regions.js /path/to/us_eco_l3.geojson [output]
 *
 *   Default output: data/regions.geojson
 *
 * ── Algorithm ─────────────────────────────────────────────────────────────
 *   1. Load input GeoJSON.
 *   2. Filter features to the corridor BBOX (east of the Mississippi,
 *      south of Quebec, north of Florida Keys).
 *   3. Map each US_L3CODE to one of our 5 region keys.
 *   4. Skip features whose code has no mapping (Great Plains, etc.).
 *   5. Reduce coordinate precision to 3 decimal places (~111 m).
 *   6. Write a FeatureCollection to the output path.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Corridor BBOX (east of Mississippi; south of Quebec; includes FL Keys) ─
const BBOX = { west: -92.0, east: -66.5, south: 24.0, north: 47.5 };

// ── EPA Level III code → Ridge to Coast region key ────────────────────────
//
// Sources:
//   Omernik 1987, revised 2004; EPA Ecoregion descriptions
//   https://www.epa.gov/eco-research/ecoregions-north-america
//
// Codes not listed here (e.g. Great Plains, Ozarks, Great Lakes basin
// north of our BBOX) are silently skipped.
const L3_TO_REGION = {
  // ── Coastal Plain (Atlantic seaboard) ────────────────────────────────────
  '63': 'coastal',   // Middle Atlantic Coastal Plain  (NJ, DE, MD, VA, NC coast)
  '65': 'coastal',   // Southeastern Plains             (SC, GA, AL, MS inland plain)

  // ── New England Coastal Lowland ───────────────────────────────────────────
  '83': 'neCoastal', // Mixed Wood Plains               (NY, CT, RI, MA — NE coast)

  // ── Piedmont (crystalline upland, mid-Atlantic) ───────────────────────────
  '45': 'piedmont',  // Piedmont                        (DE, MD, VA, NC, SC, GA, PA, NJ, NY)
  '64': 'piedmont',  // Northern Piedmont               (NJ, PA — transition zone)
  '59': 'piedmont',  // Atlantic Highlands               (NJ Highlands, NY Piedmont)

  // ── New England Upland (glaciated crystalline upland) ────────────────────
  '58': 'neUpland',  // Northeastern Highlands           (MA, VT, NH, ME uplands)
  '84': 'neUpland',  // Laurentian Mixed Forest Province (NY — Adirondack fringe)

  // ── Blue Ridge ────────────────────────────────────────────────────────────
  '66': 'blueRidge', // Blue Ridge                      (VA, WV, NC, TN, GA, SC)

  // ── Valley and Ridge / Interior Appalachians ──────────────────────────────
  '67': 'valleyRidge',  // Ridge and Valley              (VA, WV, MD, PA, TN, AL, GA)
  '68': 'valleyRidge',  // Southwestern Appalachians     (AL, TN — Coosa & TN valleys)
  '69': 'valleyRidge',  // Central Appalachians          (WV, VA, MD, PA, KY)
  '70': 'valleyRidge',  // Western Allegheny Plateau     (WV, PA, OH)
  '79': 'valleyRidge',  // N Appalachian Plateau+Uplands (NY, PA — Catskills, Poconos)
  '80': 'valleyRidge',  // Northern Allegheny Plateau    (NY, PA — Southern Tier)

  // ── Gulf Coastal Plain (Mississippi Embayment + Gulf states + Florida) ────
  '73': 'gulfCoastal',  // Mississippi Alluvial Plain    (MS, TN, KY — Mississippi R. valley)
  '74': 'gulfCoastal',  // Mississippi Valley Loess      (MS, TN — loess bluffs)
  '75': 'gulfCoastal',  // Southern Coastal Plain        (FL, GA, AL, MS — Gulf coast)
  '76': 'gulfCoastal',  // Southern Florida Coastal Plain (FL south, Keys)

  // ── Great Lakes Basin ────────────────────────────────────────────────────
  '50': 'greatLakes',   // Northern Lakes and Forests    (WI, MI, MN — boreal transition)
  '51': 'greatLakes',   // North Central Hardwood Forests (MN, WI — hardwood north)
  '53': 'greatLakes',   // SE Wisconsin Till Plains      (WI — calcareous till)
  '56': 'greatLakes',   // S Michigan/N Indiana Drift Plains (MI, IN — glacial drift)
  '57': 'greatLakes',   // Huron/Erie Lake Plains        (OH, MI, IN — lake plain)
  '78': 'greatLakes',   // Lakeplain/Erie Lake Plain     (NY, PA, OH — Lake Erie shore)
  '81': 'greatLakes',   // Erie/Ontario Lake Plain       (NY, PA, OH — Great Lakes coast)

  // ── Interior Lowlands / Ohio Valley ──────────────────────────────────────
  '54': 'interiorLowlands',  // Central Corn Belt Plains (IL, IN — prairie till)
  '55': 'interiorLowlands',  // Eastern Corn Belt Plains (OH, IN — glaciated till)
  '71': 'interiorLowlands',  // Interior Plateau         (KY, TN, AL — Bluegrass, Nashville Basin)
  '72': 'interiorLowlands',  // Interior River Lowlands  (IL, MO, KY — Ohio River corridor)
};

// ── Region display names (used in properties.name) ────────────────────────
const REGION_NAMES = {
  coastal:          'Coastal Plain',
  piedmont:         'Piedmont',
  blueRidge:        'Blue Ridge / Appalachian Mountains',
  valleyRidge:      'Valley and Ridge / Great Appalachian Valley',
  gulfCoastal:      'Gulf Coastal Plain',
  neUpland:         'New England Upland',
  neCoastal:        'New England Coastal Lowland',
  greatLakes:       'Great Lakes Basin',
  interiorLowlands: 'Interior Lowlands / Ohio Valley',
};

// ── Helpers ────────────────────────────────────────────────────────────────

const PRECISION = 3; // decimal places — ~111 m at equator

function round(n) {
  return Math.round(n * 1e3) / 1e3;
}

/** Reduce all coordinate values in a geometry to PRECISION decimal places. */
function simplifyGeom(geom) {
  if (!geom) return geom;
  switch (geom.type) {
    case 'Polygon':
      return { type: 'Polygon', coordinates: geom.coordinates.map(ring => ring.map(([x, y]) => [round(x), round(y)])) };
    case 'MultiPolygon':
      return { type: 'MultiPolygon', coordinates: geom.coordinates.map(poly => poly.map(ring => ring.map(([x, y]) => [round(x), round(y)]))) };
    default:
      return geom;
  }
}

/** Return true if any vertex of the geometry falls inside the BBOX. */
function intersectsBbox(geom) {
  if (!geom) return false;
  const coordArrays = geom.type === 'Polygon'
    ? geom.coordinates
    : geom.type === 'MultiPolygon'
      ? geom.coordinates.flat()
      : [];
  for (const ring of coordArrays) {
    for (const [x, y] of ring) {
      if (x >= BBOX.west && x <= BBOX.east && y >= BBOX.south && y <= BBOX.north) return true;
    }
  }
  return false;
}

// ── Main ───────────────────────────────────────────────────────────────────

const inputPath  = process.argv[2];
const outputPath = process.argv[3] || path.join(__dirname, '..', 'data', 'regions.geojson');

if (!inputPath) {
  console.error('Usage: node scripts/extract-regions.js <us_eco_l3.geojson> [output]');
  console.error('');
  console.error('See script header for download instructions.');
  process.exit(1);
}

const raw  = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const features = raw.features || raw;

console.error('Input features:', features.length);

const counts   = {};
const skipped  = new Set();
const output   = [];

for (const feat of features) {
  const props  = feat.properties || {};
  // EPA uses US_L3CODE (string) — may also appear as NA_L3CODE or L3_KEY
  const code   = String(props.US_L3CODE || props.NA_L3CODE || props.L3_CODE || '').trim();
  const region = L3_TO_REGION[code];

  if (!region) {
    if (code) skipped.add(code);
    continue;
  }
  if (!intersectsBbox(feat.geometry)) continue;

  counts[region] = (counts[region] || 0) + 1;

  output.push({
    type:       'Feature',
    properties: {
      region,
      name:    REGION_NAMES[region],
      l3code:  code,
      l3name:  props.US_L3NAME || props.NA_L3NAME || '',
    },
    geometry: simplifyGeom(feat.geometry),
  });
}

console.error('Kept features by region:', counts);
console.error('Skipped L3 codes (no mapping):', [...skipped].sort().join(', '));
console.error('Total output features:', output.length);

const geojson = {
  type:     'FeatureCollection',
  _meta: {
    source:    'EPA Level III Ecoregions of the Conterminous United States',
    generated: new Date().toISOString().slice(0, 10),
    bbox:      BBOX,
    features:  output.length,
    regions:   Object.keys(counts),
  },
  features: output,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(geojson));

const kb = (fs.statSync(outputPath).size / 1024).toFixed(1);
console.error(`Written: ${outputPath} (${kb} KB, ${output.length} features)`);
