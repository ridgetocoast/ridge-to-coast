/**
 * scripts/generate-regions.js
 * ────────────────────────────
 * Interim generator: exports the inline polygon constants from
 * lib/geo-data.js into data/regions.geojson.
 *
 * This produces a working data file immediately so map.js can load
 * regions via fetch instead of using hardcoded constants.  The geometry
 * is identical to what the map currently renders — no regression in
 * visual output.
 *
 * Once EPA Level III data is available, replace this file by running:
 *   node scripts/extract-regions.js /path/to/us_eco_l3.geojson
 *
 * Usage:
 *   node scripts/generate-regions.js [output]
 *   Default output: data/regions.geojson
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Load geo-data.js in Node (mock the browser globals it needs) ──────────
global.window     = {};
global.document   = {};   // some guard checks use typeof document

const geoDataSrc = fs.readFileSync(
  path.join(__dirname, '..', 'lib', 'geo-data.js'),
  'utf8'
);

// The file is a browser IIFE that sets window.GeoData — eval it here.
// eslint-disable-next-line no-eval
eval(geoDataSrc);   // sets global.window.GeoData

const gd = global.window.GeoData;

if (!gd) {
  console.error('ERROR: lib/geo-data.js did not populate window.GeoData');
  process.exit(1);
}

// ── Collect all region polygon GeoJSON features ───────────────────────────
const sources = [
  gd.COASTAL_PLAIN_GEOJSON,
  gd.GULF_COASTAL_GEOJSON,
  gd.PIEDMONT_GEOJSON,
  gd.NE_UPLAND_GEOJSON,
  gd.NE_COASTAL_GEOJSON,
  gd.VALLEY_RIDGE_GEOJSON,
  gd.BLUE_RIDGE_GEOJSON,
];

const features = sources.map(function (f) {
  return {
    type:       'Feature',
    properties: {
      region: f.properties.region,
      name:   f.properties.name,
      source: 'inline',
    },
    geometry: f.geometry,
  };
});

const outputPath = process.argv[2] || path.join(__dirname, '..', 'data', 'regions.geojson');

const geojson = {
  type:  'FeatureCollection',
  _meta: {
    source:    'inline — lib/geo-data.js polygon constants (interim)',
    note:      'Replace with EPA Level III data: node scripts/extract-regions.js',
    generated: new Date().toISOString().slice(0, 10),
    features:  features.length,
    regions:   [...new Set(features.map(function (f) { return f.properties.region; }))],
  },
  features: features,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

const kb = (fs.statSync(outputPath).size / 1024).toFixed(1);
console.log(
  'Written: ' + outputPath + '\n' +
  features.length + ' region features — ' + kb + ' KB\n' +
  'Regions: ' + geojson._meta.regions.join(', ')
);
