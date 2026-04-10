/**
 * geo-data.js — Pure geographic data and helper functions
 * --------------------------------------------------------
 * This file has ZERO dependencies (no Leaflet, no DOM).
 * It is shared between:
 *   - The browser (loaded as a <script> tag; exposes window.GeoData)
 *   - Node.js unit tests (loaded via require(); exports GeoData)
 *
 * Nothing in here may reference `L`, `document`, `window`, or `fetch`.
 *
 * Wrapped in an IIFE so internal const/let declarations stay scoped
 * to this file and do not leak into the browser's global scope —
 * preventing "already declared" conflicts with map.js.
 */

(function () {
'use strict';

/* ─── Fall Line coordinates ─────────────────────────────────────
   The Atlantic Seaboard Fall Line from the Washington DC area south
   through Richmond, VA and on to the Raleigh, NC metro area.
   Runs roughly NNE–SSW, tracing the boundary between ancient
   crystalline Piedmont bedrock and soft Coastal Plain sediments.

   Key anchors (river crossings):
     Potomac at Great Falls  ≈ 39.000°N, 77.245°W
     Rappahannock at Fredericksburg ≈ 38.302°N, 77.468°W
     James at Belle Isle, Richmond ≈ 37.527°N, 77.464°W
     Appomattox at Petersburg ≈ 37.222°N, 77.395°W
     Roanoke at Roanoke Rapids ≈ 36.462°N, 77.655°W
     Neuse at Falls of Neuse, Raleigh ≈ 35.897°N, 78.648°W

   GeoJSON coordinate order: [longitude, latitude]
   Source: derived from USGS geological survey maps of the
           Atlantic Coastal Plain / Piedmont boundary.
   ────────────────────────────────────────────────────────────── */
const FALL_LINE_COORDS = [
  // === Maryland (north of DC) ===
  [-76.000, 39.720],   // MD/PA border — northern terminus of the fall line
  [-76.080, 39.540],   // Susquehanna River / Havre de Grace
  [-76.340, 39.520],   // Bel Air / Bush River
  [-76.440, 39.440],   // Gunpowder Falls
  [-76.620, 39.330],   // Baltimore / Jones Falls
  [-76.730, 39.270],   // Elkridge / Patapsco River
  [-76.900, 39.090],   // Laurel / Patuxent River falls
  // === Washington DC / Potomac ===
  [-77.245, 39.000],   // Great Falls of the Potomac (Mather Gorge rapids)
  [-77.170, 38.905],   // Little Falls / Georgetown — head of Potomac tidal zone
  [-77.130, 38.870],   // Arlington / Rosslyn
  [-77.150, 38.830],   // Alexandria area
  // === Northern Virginia ===
  [-77.220, 38.770],   // Franconia / Springfield
  [-77.290, 38.700],   // Prince William / Fairfax border
  [-77.360, 38.600],   // Quantico / Triangle
  [-77.420, 38.490],   // Stafford County
  // === Fredericksburg ===
  [-77.468, 38.302],   // Fredericksburg — Rappahannock River falls
  [-77.460, 38.150],   // Caroline County
  [-77.455, 38.000],   // Southern Caroline County
  [-77.450, 37.830],   // Northern Hanover / Ashland approaches
  // === Richmond area ===
  [-77.445, 37.680],   // Northern Hanover County
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
  [-77.442, 37.350],   // Colonial Heights
  // === Petersburg / Southside Virginia ===
  [-77.395, 37.222],   // Petersburg — Appomattox River falls
  [-77.420, 37.100],   // Dinwiddie / Sussex County
  [-77.480, 36.950],   // Emporia approaches
  [-77.537, 36.686],   // Emporia — Meherrin River
  // === North Carolina fall line ===
  [-77.655, 36.462],   // Roanoke Rapids — Roanoke River falls
  [-77.760, 36.280],   // Warren County, NC
  [-77.960, 36.150],   // Vance / Franklin County
  [-78.150, 36.050],   // Granville County
  [-78.400, 35.950],   // Durham County western edge
  [-78.570, 35.900],   // Durham — Eno / Flat Rivers area
  [-78.648, 35.897],   // Falls of Neuse — Raleigh anchor
  [-78.720, 35.820],   // South Raleigh / Wake County
  [-78.820, 35.700],   // Southwest Wake County
  // === Southern North Carolina ===
  [-78.870, 35.560],   // Fuquay-Varina / Harnett County
  [-78.870, 35.390],   // Cape Fear River near Lillington
  [-79.170, 35.350],   // Western Harnett / Lee County
  [-79.450, 35.170],   // Moore County / Southern Pines
  [-79.780, 34.930],   // Rockingham / Pee Dee River falls
  [-79.460, 34.770],   // Laurinburg / Scotland County
  [-79.010, 34.620],   // Lumberton / Lumber River
  [-78.700, 34.270],   // Whiteville / Columbus County
  [-78.350, 33.900],   // Brunswick County / NC–SC border — southern terminus
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
   Two polygons covering the DC → Richmond → Raleigh corridor,
   split at the fall line. They share the fall line as their
   common boundary.

   Bounding box: ~35.40–39.20°N, ~76.70–79.20°W
   ────────────────────────────────────────────────────────────── */

// BBOX: corridor bounding box — used by isInCorridor() for search relevance
const BBOX_NORTH =  39.200;   // north of DC (includes Maryland suburbs)
const BBOX_SOUTH =  35.400;   // south of Raleigh
const BBOX_EAST  = -76.700;   // east of DC / Chesapeake Bay approaches
const BBOX_WEST  = -79.200;   // west of Raleigh Piedmont

// REGION: full-state extent — used for Coastal Plain & Piedmont polygon bounds
const REGION_NORTH =  39.720;  // MD / PA border
const REGION_SOUTH =  33.900;  // NC / SC border
const REGION_EAST  = -75.200;  // Outer Banks / Eastern Shore
const REGION_WEST  = -84.300;  // VA / TN-KY border (Appalachians)

const fallLineReversed = [...FALL_LINE_COORDS].reverse();

const COASTAL_PLAIN_GEOJSON = {
  type: 'Feature',
  properties: {
    region: 'coastal',
    name: 'Coastal Plain (Tidewater)',
    description:
      'East of the fall line. Flat terrain underlain by soft sedimentary ' +
      'deposits — sandy soils with fast drainage and low water retention. ' +
      'Rivers are tidal and navigable to the sea. Stretches from the Maryland ' +
      'Eastern Shore through the Virginia Tidewater to coastal North Carolina.',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [REGION_EAST, REGION_NORTH],  // NE corner (Eastern Shore / MD-PA border lat)
      [REGION_EAST, REGION_SOUTH],  // SE corner (Outer Banks / NC-SC border lat)
      ...fallLineReversed,          // south→north along fall line (west boundary)
      [REGION_EAST, REGION_NORTH],  // close polygon
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
      'bedrock (granite, gneiss, schist). Heavy clay soils with poor drainage. ' +
      'Rivers run fast over rapids at the fall line. Extends from the Maryland ' +
      'Piedmont through central Virginia to the North Carolina Piedmont Triad ' +
      'and Sandhills, bounded by the Blue Ridge and Appalachians to the west.',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [REGION_WEST, REGION_NORTH],  // NW corner (Appalachians / MD-PA border lat)
      ...FALL_LINE_COORDS,          // north→south along fall line (east boundary)
      [REGION_WEST, REGION_SOUTH],  // SW corner (Appalachians / NC-SC border lat)
      [REGION_WEST, REGION_NORTH],  // close polygon
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
        'The geological boundary where ancient Piedmont crystalline rock meets ' +
        'soft Coastal Plain sediments. Rivers drop over rapids here — the last ' +
        'navigable point from the sea. Washington DC, Richmond VA, and Raleigh NC ' +
        'all grew up at or near this boundary.' +
      '</p>' +
      '<p style="margin-top:6px; color:#888; font-size:0.75rem;">' +
        'This path is approximate. The true boundary is gradational over several miles.' +
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


/* ─── Plant Hardiness Zone helpers ──────────────────────────────
   Zone colors follow the USDA standard palette.
   Virginia spans approximately zones 5b–8b.
   Each zone = 10°F range; a/b half-zones = 5°F each.
   ────────────────────────────────────────────────────────────── */

const HARDINESS_ZONE_COLORS = {
  '5a': '#afd2e8', '5b': '#90bedd',
  '6a': '#72a9d2', '6b': '#5595c8',
  '7a': '#7ec87a', '7b': '#5aaf56',
  '8a': '#f5d63c', '8b': '#f5a800',
  '9a': '#f07800', '9b': '#e05000',
};

const HARDINESS_ZONE_INFO = {
  '5a': {
    tempRange:     '-20°F to -15°F (-29°C to -26°C)',
    description:   'Cool continental climate. Cold winters limit many broadleaf evergreens.',
    firstFrost:    'early October',
    lastFrost:     'early May',
    growingSeason: '~155 days',
    plants:        'forsythia, peonies, most hardy roses, crabapple, lilac',
  },
  '5b': {
    tempRange:     '-15°F to -10°F (-26°C to -23°C)',
    description:   'Cool continental climate. Long growing season with cold winters.',
    firstFrost:    'mid-October',
    lastFrost:     'late April',
    growingSeason: '~170 days',
    plants:        'forsythia, peonies, most roses, crabapple, Eastern redbud',
  },
  '6a': {
    tempRange:     '-10°F to -5°F (-23°C to -21°C)',
    description:   'Moderate climate. Suitable for a wide range of trees and shrubs.',
    firstFrost:    'late October',
    lastFrost:     'mid-April',
    growingSeason: '~180 days',
    plants:        'dogwood, azalea, boxwood, ornamental grasses, most roses',
  },
  '6b': {
    tempRange:     '-5°F to 0°F (-21°C to -18°C)',
    description:   'Moderate climate. Typical of the northern Virginia Piedmont and DC suburbs.',
    firstFrost:    'early November',
    lastFrost:     'early April',
    growingSeason: '~195 days',
    plants:        'dogwood, azalea, boxwood, crepe myrtle (marginal), American holly',
  },
  '7a': {
    tempRange:     '0°F to 5°F (-18°C to -15°C)',
    description:   'Mild winters. DC metro area and northern Virginia fall line corridor.',
    firstFrost:    'early–mid November',
    lastFrost:     'late March',
    growingSeason: '~210 days',
    plants:        'crepe myrtle, camellia (marginal), gardenia (marginal), Encore azaleas',
  },
  '7b': {
    tempRange:     '5°F to 10°F (-15°C to -12°C)',
    description:   'Mild winters. Richmond VA city and the fall line corridor through central Virginia and into Raleigh NC.',
    firstFrost:    'mid–late November',
    lastFrost:     'mid-March',
    growingSeason: '~220 days',
    plants:        'southern magnolia, camellia, gardenia, crepe myrtle, nandina',
  },
  '8a': {
    tempRange:     '10°F to 15°F (-12°C to -9°C)',
    description:   'Warm winters. Eastern Coastal Plain, Tidewater, and the Raleigh NC area. Broadleaf evergreens thrive.',
    firstFrost:    'late November',
    lastFrost:     'early–mid March',
    growingSeason: '~235 days',
    plants:        'fig, tea olive (osmanthus), live oak, pittosporum, loropetalum',
  },
  '8b': {
    tempRange:     '15°F to 20°F (-9°C to -7°C)',
    description:   'Very mild winters. Coastal Virginia near Hampton Roads.',
    firstFrost:    'early December',
    lastFrost:     'late February',
    growingSeason: '~250 days',
    plants:        'loquat, large crepe myrtle, sabal palm (marginal), gardenias freely',
  },
};

/**
 * Returns the fill color for a USDA hardiness zone string (e.g. "7b").
 * Falls back to a neutral grey for unknown zones.
 * @param {string} zone
 * @returns {string} CSS color
 */
function getZoneColor(zone) {
  return HARDINESS_ZONE_COLORS[zone] || '#cccccc';
}

/**
 * Returns display info for a zone.
 * @param {string} zone
 * @returns {{ tempRange: string, description: string, firstFrost: string, lastFrost: string, growingSeason: string, plants: string }}
 */
function getZoneInfo(zone) {
  return HARDINESS_ZONE_INFO[zone] || {
    tempRange:     'Unknown',
    description:   'No data available for this zone.',
    firstFrost:    'unknown',
    lastFrost:     'unknown',
    growingSeason: 'unknown',
    plants:        'unknown',
  };
}

/**
 * Returns an HTML string for a hardiness zone popup with five zone facts.
 * @param {string} zone  e.g. "7b"
 * @returns {string}
 */
function makeZonePopup(zone) {
  const info  = getZoneInfo(zone);
  const color = getZoneColor(zone);
  const row = function (label, value) {
    return (
      '<div class="zone-fact">' +
        '<span class="zone-fact-label">' + label + '</span>' +
        '<span class="zone-fact-value">' + value + '</span>' +
      '</div>'
    );
  };
  return (
    '<div class="popup-content">' +
      '<div class="zone-popup-header" style="border-left:3px solid ' + color + '">' +
        '<h3>Zone ' + zone + '</h3>' +
        '<span class="zone-badge" style="background:' + color + ';color:#1a1a2e">Zone ' + zone + '</span>' +
      '</div>' +
      '<p class="zone-desc">' + info.description + '</p>' +
      '<div class="zone-facts">' +
        row('Min. winter temp', info.tempRange) +
        row('First frost',      info.firstFrost) +
        row('Last frost',       info.lastFrost) +
        row('Growing season',   info.growingSeason) +
        row('Thrives here',     info.plants) +
      '</div>' +
    '</div>'
  );
}


/* ─── Location search helpers ────────────────────────────────────
   Pure functions used by map.js for the location search feature.
   All are dependency-free so they can be unit-tested in Node.js.
   ────────────────────────────────────────────────────────────── */

/**
 * Returns true if the input is a valid US 5-digit zip code.
 * Trims surrounding whitespace before checking.
 * @param {string} input
 * @returns {boolean}
 */
function isValidUSZipCode(input) {
  return /^\d{5}$/.test(String(input).trim());
}

/**
 * Returns true if the given coordinates fall within the
 * DC–Richmond–Raleigh corridor bounding box.
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
function isInCorridor(lat, lon) {
  return lat >= BBOX_SOUTH && lat <= BBOX_NORTH &&
         lon >= BBOX_WEST  && lon <= BBOX_EAST;
}

/**
 * Builds a Nominatim (OpenStreetMap) geocoding URL for the given input.
 * Zip codes use the postalcode= parameter; everything else uses q=.
 * Always restricts to US results and requests a single JSON result.
 * @param {string} input  Zip code or city/place name
 * @returns {string}      Nominatim search URL
 */
function buildSearchQuery(input) {
  var q    = String(input).trim();
  var base = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us';
  if (isValidUSZipCode(q)) {
    return base + '&postalcode=' + encodeURIComponent(q);
  }
  return base + '&q=' + encodeURIComponent(q);
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
  HARDINESS_ZONE_COLORS,
  HARDINESS_ZONE_INFO,
  getZoneColor,
  getZoneInfo,
  makeZonePopup,
  isValidUSZipCode,
  isInCorridor,
  buildSearchQuery,
};

// Browser: attach to window so map.js can access it
if (typeof window !== 'undefined') {
  window.GeoData = GeoData;
}

// Node.js: CommonJS export for unit tests (no build step required)
if (typeof module !== 'undefined') {
  module.exports = GeoData;
}

}()); // end IIFE
