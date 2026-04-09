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

// DC–Richmond–Raleigh corridor bounding box — matches BBOX in geo-data.js
const BBOX = {
  west:  -79.20,
  east:  -76.70,
  south:  35.40,
  north:  39.20,
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

// ── Strip coordinates outside bbox ────────────────────────────────────────
// Removes consecutive duplicate points that arise after rounding.
function dedupe(ring) {
  return ring.filter(function (pt, i) {
    if (i === 0) return true;
    return pt[0] !== ring[i - 1][0] || pt[1] !== ring[i - 1][1];
  });
}

// Simple stride-based decimation for dense rings.
// Keeps every Nth point; always keeps first and last.
function decimate(ring, stride) {
  if (ring.length <= stride * 2) return ring;
  const result = [];
  for (var i = 0; i < ring.length; i++) {
    if (i === 0 || i === ring.length - 1 || i % stride === 0) {
      result.push(ring[i]);
    }
  }
  return result;
}

// Keep only rings (or sub-polygons) that have any point inside the expanded bbox.
// For each kept ring, filter out runs of points far outside the bbox to reduce size,
// while preserving the ring's winding and closure.
function stripRing(ring, bbox) {
  // Round first, then dedupe
  const rounded = dedupe(ring.map(function (pt) {
    return [roundCoord(pt[0], 3), roundCoord(pt[1], 3)];
  }));
  // Keep if any point is within expanded bbox (already checked at feature level,
  // but we also drop sub-rings of multipolygons that are entirely outside)
  const inside = rounded.some(function (pt) {
    return pt[0] >= bbox.west && pt[0] <= bbox.east &&
           pt[1] >= bbox.south && pt[1] <= bbox.north;
  });
  if (!inside) return null;
  // Decimate dense rings (>200 pts) — zone boundaries are smooth at this scale
  const decimated = rounded.length > 200 ? decimate(rounded, 4) : rounded;
  // Ensure ring is closed
  const last = decimated[decimated.length - 1];
  const first = decimated[0];
  if (last[0] !== first[0] || last[1] !== first[1]) decimated.push(first);
  return decimated.length >= 4 ? decimated : null;  // degenerate ring
}

function stripCoords(coords, type, bbox) {
  if (type === 'Polygon') {
    const rings = coords.map(function (r) { return stripRing(r, bbox); }).filter(Boolean);
    return rings.length ? rings : null;
  }
  if (type === 'MultiPolygon') {
    const polys = coords.map(function (poly) {
      const rings = poly.map(function (r) { return stripRing(r, bbox); }).filter(Boolean);
      return rings.length ? rings : null;
    }).filter(Boolean);
    return polys.length ? polys : null;
  }
  return null;
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
    const coords = stripCoords(f.geometry.coordinates, f.geometry.type, expandedBbox);
    if (!coords) return null;
    return {
      type: 'Feature',
      properties: normaliseProperties(f.properties),
      geometry: { type: f.geometry.type, coordinates: coords },
    };
  })
  .filter(Boolean);

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
