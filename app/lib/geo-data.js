/**
 * geo-data.js — Pure geographic data and helper functions
 * --------------------------------------------------------
 * This file has ZERO dependencies (no Leaflet, no DOM).
 * It is shared between:
 *   - The browser (loaded as a <script> tag; exposes window.GeoData)
 *   - Node.js unit tests (loaded via require(); exports GeoData)
 *
 * Nothing in here may reference `L`, `document`, `window`, or `fetch`.
 */

'use strict';

/* ─── Fall Line coordinates ─────────────────────────────────────
   The Atlantic Seaboard Fall Line through the greater Richmond metro area.
   Runs roughly NNE–SSW, passing through the James River rapids.

   Key anchor: Belle Isle rapids ≈ 37.527°N, 77.467°W
   This is where the James River physically crosses the fall line —
   the most geographically verifiable point in the city.

   GeoJSON coordinate order: [longitude, latitude]
   Source: derived from USGS geological survey maps of the
           Atlantic Coastal Plain / Piedmont boundary in Virginia.
   ────────────────────────────────────────────────────────────── */
const FALL_LINE_COORDS = [
  [-77.440, 37.760],   // Northern extent — northern Hanover County
  [-77.442, 37.720],   // Ashland / Hanover area
  [-77.445, 37.680],   // Northern Henrico
  [-77.448, 37.650],   // Chamberlayne corridor
  [-77.455, 37.610],   // Near Laurel / Staples Mill
  [-77.460, 37.575],   // North Richmond
  [-77.462, 37.555],   // Near Lombardy / Brook Road
  [-77.463, 37.540],   // Northern downtown / Jackson Ward
  [-77.464, 37.527],   // James River rapids — Belle Isle (primary anchor)
  [-77.463, 37.512],   // Manchester / south bank
  [-77.460, 37.495],   // Southern Richmond / Chesterfield line
  [-77.455, 37.465],   // Northern Chesterfield
  [-77.450, 37.430],   // Central Chesterfield
  [-77.445, 37.390],   // Southern Chesterfield
  [-77.442, 37.350],   // Southern extent — near Colonial Heights
];

const FALL_LINE_GEOJSON = {
  type: 'Feature',
  properties: {
    name: 'Atlantic Seaboard Fall Line',
    note: 'Approximate — based on published USGS geological surveys',
  },
  geometry: {
    type: 'LineString',
    coordinates: FALL_LINE_COORDS,
  },
};


/* ─── Region polygons ───────────────────────────────────────────
   Two polygons covering the Richmond metro bounding box, split at
   the fall line. They share the fall line as their common boundary.

   Metro bounding box: ~37.35–37.76°N, ~77.25–77.70°W
   ────────────────────────────────────────────────────────────── */

// GeoJSON polygons must close: first coordinate repeated as last
const BBOX_NORTH =  37.760;
const BBOX_SOUTH =  37.350;
const BBOX_EAST  = -77.250;  // less-negative = east in N. America
const BBOX_WEST  = -77.700;

const fallLineReversed = [...FALL_LINE_COORDS].reverse();

const COASTAL_PLAIN_GEOJSON = {
  type: 'Feature',
  properties: {
    region: 'coastal',
    name: 'Coastal Plain (Tidewater)',
    description:
      'East of the fall line. Flat terrain underlain by soft sedimentary ' +
      'deposits. Rivers are tidal and navigable. Historically settled by ' +
      'the Powhatan Confederacy and early English colonists.',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [BBOX_EAST, BBOX_NORTH],    // NE corner
      ...fallLineReversed,        // south→north along fall line (east boundary)
      [BBOX_EAST, BBOX_SOUTH],    // SE corner
      [BBOX_EAST, BBOX_NORTH],    // close polygon
    ]],
  },
};

const PIEDMONT_GEOJSON = {
  type: 'Feature',
  properties: {
    region: 'piedmont',
    name: 'Piedmont',
    description:
      'West of the fall line. Rolling hills underlain by ancient crystalline ' +
      'bedrock (granite, gneiss, schist). Rivers run fast over rapids. ' +
      'Richmond was founded here at the head of navigation.',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [BBOX_WEST, BBOX_NORTH],    // NW corner
      ...FALL_LINE_COORDS,        // north→south along fall line (east boundary)
      [BBOX_WEST, BBOX_SOUTH],    // SW corner
      [BBOX_WEST, BBOX_NORTH],    // close polygon
    ]],
  },
};


/* ─── Map styles ────────────────────────────────────────────── */
const STYLES = {
  coastal: {
    fillColor:   '#4682DC',
    fillOpacity: 0.18,
    color:       '#4682DC',
    weight:      0,
    interactive: true,
  },
  piedmont: {
    fillColor:   '#C88232',
    fillOpacity: 0.18,
    color:       '#C88232',
    weight:      0,
    interactive: true,
  },
  fallLine: {
    color:       '#e84393',
    weight:      3,
    opacity:     0.9,
    dashArray:   null,
    interactive: true,
  },
  regionHover: {
    fillOpacity: 0.32,
  },
};


/* ─── Popup content generators ──────────────────────────────── */

/**
 * Returns an HTML string for a region feature popup.
 * @param {{ region: string, name: string, description: string }} props
 * @returns {string}
 */
function makeRegionPopup(props) {
  // No innerHTML or user-controlled strings — props come from our own GeoJSON.
  return (
    '<div class="popup-content">' +
      '<h3>' + props.name + '</h3>' +
      '<p>' + props.description + '</p>' +
      '<span class="region-tag ' + props.region + '">' + props.name + '</span>' +
    '</div>'
  );
}

/**
 * Returns an HTML string for the fall line popup.
 * @returns {string}
 */
function makeFallLinePopup() {
  return (
    '<div class="popup-content">' +
      '<h3>Atlantic Seaboard Fall Line</h3>' +
      '<p>' +
        'The geological boundary between the ancient crystalline rocks of the ' +
        'Piedmont and the soft sedimentary deposits of the Coastal Plain. ' +
        'Richmond was founded here because it was the furthest inland point ' +
        'ships could navigate — the rapids mark where the river drops off the plateau.' +
      '</p>' +
      '<p style="margin-top:6px; color:#888; font-size:0.75rem;">' +
        'This path is approximate. The true boundary is gradational.' +
      '</p>' +
    '</div>'
  );
}


/* ─── Geographic helper utilities ───────────────────────────── */

/**
 * Haversine distance in kilometers between two [lon, lat] points.
 * Used internally to verify the fall line anchor point in tests.
 * @param {[number, number]} a  [longitude, latitude]
 * @param {[number, number]} b  [longitude, latitude]
 * @returns {number} distance in km
 */
function haversineKm(a, b) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const c =
    sinLat * sinLat +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

/**
 * Returns the minimum distance in km from any fall line point to a target.
 * @param {[number, number]} target  [longitude, latitude]
 * @returns {number} minimum distance in km
 */
function minDistanceToFallLine(target) {
  return Math.min(
    ...FALL_LINE_COORDS.map((coord) => haversineKm(coord, target))
  );
}


/* ─── Export ─────────────────────────────────────────────────── */
const GeoData = {
  FALL_LINE_COORDS,
  FALL_LINE_GEOJSON,
  COASTAL_PLAIN_GEOJSON,
  PIEDMONT_GEOJSON,
  STYLES,
  BBOX: { NORTH: BBOX_NORTH, SOUTH: BBOX_SOUTH, EAST: BBOX_EAST, WEST: BBOX_WEST },
  makeRegionPopup,
  makeFallLinePopup,
  haversineKm,
  minDistanceToFallLine,
};

// Browser: attach to window so map.js and index.html can access it
if (typeof window !== 'undefined') {
  window.GeoData = GeoData;
}

// Node.js: CommonJS export for unit tests (no build step required)
if (typeof module !== 'undefined') {
  module.exports = GeoData;
}
