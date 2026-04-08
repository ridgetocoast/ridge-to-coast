/**
 * scripts/process-hardiness.js
 * ----------------------------
 * Clips the full USDA hardiness GeoJSON to the Richmond metro bounding box
 * and reduces coordinate precision to 4 decimal places (~11m accuracy).
 * Typically reduces file size by 60-70%.
 *
 * Usage:
 *   node scripts/process-hardiness.js <input.geojson> [output.geojson]
 *
 * If no output path given, writes to data/hardiness.geojson (default).
 *
 * The input file can be from:
 *   - Open Plant Hardiness Zones: https://github.com/kgjenkins/ophz
 *   - USDA ArcGIS Hub: https://usda-plant-hardiness-zone-map-usdaars.hub.arcgis.com/
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// Richmond metro bounding box — matches BBOX in geo-data.js
const BBOX = {
  west:  -77.70,
  east:  -77.25,
  south:  37.35,
  north:  37.76,
};

// Expand slightly so zone polygons crossing the edge aren't clipped mid-feature
const BUFFER = 0.05;

const inputPath  = process.argv[2];
const outputPath = process.argv[3] || path.join(__dirname, '..', 'data', 'hardiness.geojson');

if (!inputPath) {
  console.error('Usage: node scripts/process-hardiness.js <input.geojson> [output.geojson]');
  process.exit(1);
}

console.log('Reading:', inputPath);
const raw  = fs.readFileSync(inputPath, 'utf8');
const data = JSON.parse(raw);

console.log('Total features:', data.features.length);

// ── Round coordinate precision ─────────────────────────────────────────────
function roundCoord(n, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(n * factor) / factor;
}

function roundCoords(coords, precision) {
  if (typeof coords[0] === 'number') {
    return [roundCoord(coords[0], precision), roundCoord(coords[1], precision)];
  }
  return coords.map(function (c) { return roundCoords(c, precision); });
}

// ── Bounding box intersection check ───────────────────────────────────────
function coordsIntersectsBbox(coords, bbox) {
  // Flatten all coordinate pairs and check if any fall within bbox
  function check(c) {
    if (typeof c[0] === 'number') {
      return c[0] >= bbox.west  && c[0] <= bbox.east &&
             c[1] >= bbox.south && c[1] <= bbox.north;
    }
    return c.some(check);
  }
  return check(coords);
}

function featureIntersectsBbox(feature, bbox) {
  if (!feature.geometry || !feature.geometry.coordinates) return false;
  return coordsIntersectsBbox(feature.geometry.coordinates, bbox);
}

// ── Normalise zone property ────────────────────────────────────────────────
// Different sources use different property names. Normalise to `zone`.
function normaliseProperties(props) {
  const zone = props.zone || props.Zone || props.PHZone || props.phzone ||
               props.ZONE || props.gridcode || props.GRIDCODE || null;
  return { zone: zone ? String(zone).trim() : 'unknown' };
}

// ── Process ────────────────────────────────────────────────────────────────
const expandedBbox = {
  west:  BBOX.west  - BUFFER,
  east:  BBOX.east  + BUFFER,
  south: BBOX.south - BUFFER,
  north: BBOX.north + BUFFER,
};

const clipped = data.features
  .filter(function (f) { return featureIntersectsBbox(f, expandedBbox); })
  .map(function (f) {
    return {
      type: 'Feature',
      properties: normaliseProperties(f.properties),
      geometry: {
        type: f.geometry.type,
        coordinates: roundCoords(f.geometry.coordinates, 4),
      },
    };
  });

console.log('Features after bbox clip:', clipped.length);

// ── Unique zones present ───────────────────────────────────────────────────
const zones = [...new Set(clipped.map(function (f) { return f.properties.zone; }))].sort();
console.log('Zones present:', zones.join(', '));

const output = {
  type: 'FeatureCollection',
  features: clipped,
  _meta: {
    source:    'USDA Plant Hardiness Zone Map',
    processed: new Date().toISOString().split('T')[0],
    bbox:      BBOX,
    zones:     zones,
  },
};

const json = JSON.stringify(output);
fs.writeFileSync(outputPath, json, 'utf8');

const inKB  = Math.round(Buffer.byteLength(raw,  'utf8') / 1024);
const outKB = Math.round(Buffer.byteLength(json, 'utf8') / 1024);
console.log('Input size: ', inKB,  'KB');
console.log('Output size:', outKB, 'KB');
console.log('Reduction:  ', Math.round((1 - outKB / inKB) * 100) + '%');
console.log('Written to:', outputPath);
