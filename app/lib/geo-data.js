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

// Pull shared symbols from the core module. In the browser this is loaded via
// the <script src="lib/geo-data-core.js"> tag; in Node tests it is required.
var __core = (typeof require !== 'undefined')
  ? require('./geo-data-core.js')
  : globalThis.GeoDataCore;

if (!__core) {
  throw new Error('geo-data-core.js failed to load — must precede geo-data.js in index.html');
}

var FALL_LINE_COORDS              = __core.FALL_LINE_COORDS;
var EAST_COAST_COORDS             = __core.EAST_COAST_COORDS;
var FALL_LINE_GEOJSON             = __core.FALL_LINE_GEOJSON;
var COASTAL_PLAIN_GEOJSON         = __core.COASTAL_PLAIN_GEOJSON;
var PIEDMONT_GEOJSON              = __core.PIEDMONT_GEOJSON;
var BLUE_RIDGE_GEOJSON            = __core.BLUE_RIDGE_GEOJSON;
var VALLEY_RIDGE_GEOJSON          = __core.VALLEY_RIDGE_GEOJSON;
var NE_UPLAND_GEOJSON             = __core.NE_UPLAND_GEOJSON;
var NE_COASTAL_GEOJSON            = __core.NE_COASTAL_GEOJSON;
var GREAT_LAKES_GEOJSON           = __core.GREAT_LAKES_GEOJSON;
var INTERIOR_LOWLANDS_GEOJSON     = __core.INTERIOR_LOWLANDS_GEOJSON;
var GULF_COASTAL_GEOJSON          = __core.GULF_COASTAL_GEOJSON;
var WATERSHEDS_GEOJSON            = __core.WATERSHEDS_GEOJSON;
var REGION_LABELS                 = __core.REGION_LABELS;
var BLUE_RIDGE_EAST_ESCARPMENT    = __core.BLUE_RIDGE_EAST_ESCARPMENT;
var BLUE_RIDGE_WEST_ESCARPMENT    = __core.BLUE_RIDGE_WEST_ESCARPMENT;
var BBOX_NORTH                    = __core.BBOX_NORTH;
var BBOX_SOUTH                    = __core.BBOX_SOUTH;
var BBOX_EAST                     = __core.BBOX_EAST;
var BBOX_WEST                     = __core.BBOX_WEST;
var NATIVE_PLANTS                 = __core.NATIVE_PLANTS;
var SOIL_TYPES                    = __core.SOIL_TYPES;
var INVASIVE_SPECIES              = __core.INVASIVE_SPECIES;
var PLANTING_CALENDAR             = __core.PLANTING_CALENDAR;
var FALLBACK_VIEWS                = __core.FALLBACK_VIEWS;
var CORRIDOR_CITIES               = __core.CORRIDOR_CITIES;
var HARDINESS_ZONE_COLORS         = __core.HARDINESS_ZONE_COLORS;
var HARDINESS_ZONE_INFO           = __core.HARDINESS_ZONE_INFO;
var REGION_INATURALIST_PLACE_IDS  = __core.REGION_INATURALIST_PLACE_IDS;
var pointInPolygon                = __core.pointInPolygon;
var classifyLocation              = __core.classifyLocation;
var lookupWatershed               = __core.lookupWatershed;
var haversineKm                   = __core.haversineKm;
var pickFallbackView              = __core.pickFallbackView;
var nearestCorridorCity           = __core.nearestCorridorCity;
var minDistanceToFallLine         = __core.minDistanceToFallLine;
var getZoneColor                  = __core.getZoneColor;
var getZoneInfo                   = __core.getZoneInfo;
var isValidUSZipCode              = __core.isValidUSZipCode;
var isInCorridor                  = __core.isInCorridor;
var buildSearchQuery              = __core.buildSearchQuery;



















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
  blueRidge: {
    fillColor:   '#4a7c59',   // Forest green
    fillOpacity: 0.18,
    color:       '#4a7c59',
    weight:      0,
    interactive: true,
  },
  valleyRidge: {
    fillColor:   '#9b7aad',   // Dusty violet — limestone valley character
    fillOpacity: 0.18,
    color:       '#9b7aad',
    weight:      0,
    interactive: true,
  },
  gulfCoastal: {
    fillColor:   '#4682DC',   // Same coastal blue — Gulf is a continuation of Atlantic Coastal Plain
    fillOpacity: 0.18,
    color:       '#4682DC',
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
  // Outline-only variants — used when hardiness zone layer is active so
  // zone fill colors are not obscured by region fill colors.
  coastalOutline: {
    fillOpacity: 0,
    fillColor:   '#4682DC',
    color:       '#4682DC',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  piedmontOutline: {
    fillOpacity: 0,
    fillColor:   '#C88232',
    color:       '#C88232',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  blueRidgeOutline: {
    fillOpacity: 0,
    fillColor:   '#4a7c59',
    color:       '#4a7c59',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  valleyRidgeOutline: {
    fillOpacity: 0,
    fillColor:   '#9b7aad',
    color:       '#9b7aad',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  gulfCoastalOutline: {
    fillOpacity: 0,
    fillColor:   '#4682DC',
    color:       '#4682DC',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  neUpland: {
    fillColor:   '#4a9a8a',   // Muted teal — glaciated northern forest
    fillOpacity: 0.18,
    color:       '#4a9a8a',
    weight:      0,
    interactive: true,
  },
  neCoastal: {
    fillColor:   '#6baed6',   // Soft coastal blue — distinctly lighter than Atlantic coastal
    fillOpacity: 0.18,
    color:       '#6baed6',
    weight:      0,
    interactive: true,
  },
  greatLakes: {
    fillColor:   '#4a7ab5',   // Steel blue — Great Lakes water character
    fillOpacity: 0.18,
    color:       '#4a7ab5',
    weight:      0,
    interactive: true,
  },
  interiorLowlands: {
    fillColor:   '#8a7d4a',   // Muted amber-brown — agricultural heartland
    fillOpacity: 0.18,
    color:       '#8a7d4a',
    weight:      0,
    interactive: true,
  },
  neUplandOutline: {
    fillOpacity: 0,
    fillColor:   '#4a9a8a',
    color:       '#4a9a8a',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  neCoastalOutline: {
    fillOpacity: 0,
    fillColor:   '#6baed6',
    color:       '#6baed6',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  greatLakesOutline: {
    fillOpacity: 0,
    fillColor:   '#4a7ab5',
    color:       '#4a7ab5',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  interiorLowlandsOutline: {
    fillOpacity: 0,
    fillColor:   '#8a7d4a',
    color:       '#8a7d4a',
    weight:      2,
    opacity:     0.65,
    interactive: true,
  },
  // Rivers: invisible lines but wide hit area — tooltip + click still work;
  // the CARTO basemap already renders river lines so the overlay stays hidden.
  rivers: {
    color:       'transparent',
    opacity:     0,
    weight:      12,
    fillOpacity: 0,
    interactive: true,
  },
  riversHover: {
    weight:  12,
    opacity: 0,
  },
};

/**
 * Returns an HTML string listing native plants for a given ecoregion.
 * @param {'piedmont'|'coastal'|'ecotone'} region
 * @returns {string}  HTML fragment — empty string if region not found
 */
function makeNativePlantsSection(region) {
  const plants = NATIVE_PLANTS[region];
  if (!plants || plants.length === 0) return '';
  return (
    '<div class="plant-section">' +
      '<h4 class="plant-section-header">Native plants</h4>' +
      '<ul class="plant-list">' +
        plants.map(function (p) {
          return (
            '<li>' +
              '<span class="plant-name">' + p.name + '</span>' +
              ' <em class="plant-latin">' + p.latin + '</em>' +
              '<span class="plant-note">' + p.note + '</span>' +
            '</li>'
          );
        }).join('') +
      '</ul>' +
    '</div>'
  );
}




/**
 * Returns an HTML string listing invasive species warnings for a given ecoregion.
 * @param {string} region
 * @returns {string}  HTML fragment — empty string if region not found
 */
function makeInvasivesSection(region) {
  const invasives = INVASIVE_SPECIES[region];
  if (!invasives || invasives.length === 0) return '';
  const threatBadge = function (t) {
    var color = t === 'high' ? '#c0392b' : '#e67e22';
    return '<span class="invasive-threat" style="background:' + color + ';color:#fff;font-size:0.65rem;padding:1px 5px;border-radius:3px;margin-left:4px;vertical-align:middle">' + t.toUpperCase() + '</span>';
  };
  return (
    '<div class="invasive-section">' +
      '<h4 class="invasive-section-header">Invasive species — watch &amp; remove</h4>' +
      '<ul class="invasive-list">' +
        invasives.map(function (sp) {
          return (
            '<li>' +
              '<span class="invasive-name">' + sp.name + '</span>' +
              ' <em class="invasive-latin">' + sp.latin + '</em>' +
              threatBadge(sp.threat) +
              '<span class="invasive-note">' + sp.note + '</span>' +
            '</li>'
          );
        }).join('') +
      '</ul>' +
    '</div>'
  );
}

/**
 * Returns an HTML string showing the soil profile for a given ecoregion.
 * @param {'piedmont'|'coastal'|'ecotone'} region
 * @returns {string}  HTML fragment — empty string if region not found
 */
function makeSoilSection(region) {
  const soil = SOIL_TYPES[region];
  if (!soil) return '';
  const row = function (label, value) {
    return (
      '<div class="soil-fact">' +
        '<span class="soil-label">' + label + '</span>' +
        '<span class="soil-value">' + value + '</span>' +
      '</div>'
    );
  };
  return (
    '<div class="soil-section">' +
      '<h4 class="soil-section-header">Soil profile</h4>' +
      '<div class="soil-facts">' +
        row('Series',    soil.series) +
        row('Texture',   soil.texture) +
        row('pH',        soil.pH) +
        row('Drainage',  soil.drainage) +
        row('Amend with', soil.amendments) +
      '</div>' +
    '</div>'
  );
}


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
      makeNativePlantsSection(props.region) +
      makeSoilSection(props.region) +
      makeInvasivesSection(props.region) +
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
      makeNativePlantsSection('ecotone') +
      makeSoilSection('ecotone') +
      '<p style="margin-top:8px; color:#888; font-size:0.75rem;">' +
        'This path is approximate. The true boundary is gradational over several miles.' +
      '</p>' +
    '</div>'
  );
}


/* ─── Detail page HTML generators ────────────────────────────────
   Used by hash routing in map.js to render full-screen detail pages.
   Each function returns a complete <article class="detail-page"> fragment.
   Reuse existing popup data (soil, plants, zone info) in a full-width layout.
   ────────────────────────────────────────────────────────────── */


/**
 * Escape untrusted text before injecting it into HTML strings.
 * Intended for external data such as OpenStreetMap / Overpass properties.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHTML(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns full-page HTML for a region detail view.
 * @param {'piedmont'|'coastal'|'blueRidge'} region
 * @returns {string}
 */
function makeRegionDetailHTML(region) {
  var geojsonMap = {
    piedmont:         PIEDMONT_GEOJSON,
    coastal:          COASTAL_PLAIN_GEOJSON,
    blueRidge:        BLUE_RIDGE_GEOJSON,
    valleyRidge:      VALLEY_RIDGE_GEOJSON,
    gulfCoastal:      GULF_COASTAL_GEOJSON,
    neUpland:         NE_UPLAND_GEOJSON,
    neCoastal:        NE_COASTAL_GEOJSON,
    greatLakes:       GREAT_LAKES_GEOJSON,
    interiorLowlands: INTERIOR_LOWLANDS_GEOJSON,
  };
  var geojson = geojsonMap[region];
  if (!geojson) return '';
  var props = geojson.properties;
  var REGION_COLORS = {
    piedmont:         '#c88232',
    coastal:          '#4682dc',
    gulfCoastal:      '#4682dc',
    blueRidge:        '#4a7c59',
    valleyRidge:      '#9b7aad',
    neUpland:         '#4a9a8a',
    neCoastal:        '#6baed6',
    greatLakes:       '#4a7ab5',
    interiorLowlands: '#8a7d4a',
  };
  var color = REGION_COLORS[region] || '#888888';
  return (
    '<article class="detail-page">' +
      '<div class="detail-region-header" style="border-left:4px solid ' + color + ';padding-left:12px;margin-bottom:0.75rem">' +
        '<h2 class="detail-title" style="margin-bottom:0">' + props.name + '</h2>' +
      '</div>' +
      '<p class="detail-description">' + props.description + '</p>' +
      '<p class="inat-badge">Recent plant observations (90 days): <span id="inat-count">\u2026</span></p>' +
      makeNativePlantsSection(region) +
      makeSoilSection(region) +
      makeInvasivesSection(region) +
    '</article>'
  );
}

/**
 * Returns full-page HTML for the fall line detail view.
 * @returns {string}
 */
function makeFallLineDetailHTML() {
  return (
    '<article class="detail-page">' +
      '<div class="detail-region-header" style="border-left:4px solid #e84393;padding-left:12px;margin-bottom:0.75rem">' +
        '<h2 class="detail-title" style="margin-bottom:0">Atlantic Seaboard Fall Line</h2>' +
      '</div>' +
      '<p class="detail-description">' +
        'The geological boundary where ancient Piedmont crystalline rock meets ' +
        'soft Coastal Plain sediments. Rivers drop over rapids here — the last ' +
        'navigable point from the sea. Washington DC, Richmond VA, Raleigh NC, ' +
        'Columbia SC, and Augusta GA all grew up at or near this boundary.' +
      '</p>' +
      '<p class="detail-description">' +
        'This path is approximate. The true boundary is gradational over several ' +
        'miles, reflecting millennia of erosion at the Piedmont\'s eroded edge.' +
      '</p>' +
      makeNativePlantsSection('ecotone') +
      makeSoilSection('ecotone') +
    '</article>'
  );
}

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/**
 * Returns an HTML string showing the monthly planting calendar for a given hardiness zone.
 * @param {string} zone  e.g. "7b"
 * @returns {string}  HTML fragment — empty string if zone not found
 */
function makeCalendarSection(zone) {
  var data = PLANTING_CALENDAR[zone];
  if (!data) return '';
  var rows = MONTHS.map(function (mon, i) {
    var m     = data[mon] || { startIndoors: [], directSow: [], transplant: [] };
    var label = MONTH_LABELS[i].slice(0, 3);
    var parts = [];
    if (m.startIndoors && m.startIndoors.length)
      parts.push('<span class="cal-label cal-label--indoor">Indoor:</span> ' + m.startIndoors.join(', '));
    if (m.directSow && m.directSow.length)
      parts.push('<span class="cal-label cal-label--sow">Sow:</span> ' + m.directSow.join(', '));
    if (m.transplant && m.transplant.length)
      parts.push('<span class="cal-label cal-label--transplant">Out:</span> ' + m.transplant.join(', '));
    var body = parts.length
      ? parts.map(function (p) { return '<div class="cal-row">' + p + '</div>'; }).join('')
      : '<div class="cal-row cal-row--idle">—</div>';
    return (
      '<div class="cal-month">' +
        '<span class="cal-month-name">' + label + '</span>' +
        '<div class="cal-month-body">' + body + '</div>' +
      '</div>'
    );
  }).join('');
  return (
    '<div class="calendar-section">' +
      '<h4 class="calendar-section-header">Monthly planting calendar</h4>' +
      '<div class="calendar-months">' + rows + '</div>' +
    '</div>'
  );
}

/**
 * Returns full-page HTML for a hardiness zone detail view.
 * @param {string} zone  e.g. "7b"
 * @param {number} [lat] optional latitude for live frost advisory hydration
 * @param {number} [lon] optional longitude for live frost advisory hydration
 * @returns {string}
 */
function makeZoneDetailHTML(zone, lat, lon) {
  var info  = getZoneInfo(zone);
  var color = getZoneColor(zone);
  var hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
  var row = function (label, value) {
    return (
      '<div class="detail-fact">' +
        '<span class="detail-fact-label">' + label + '</span>' +
        '<span class="detail-fact-value">' + value + '</span>' +
      '</div>'
    );
  };
  return (
    '<article class="detail-page">' +
      '<div class="detail-zone-header" style="border-left:4px solid ' + color + '">' +
        '<h2 class="detail-title">Hardiness Zone ' + zone + '</h2>' +
        '<span class="zone-badge detail-zone-badge" style="background:' + color + ';color:#1a1a2e">Zone ' + zone + '</span>' +
      '</div>' +
      '<p class="detail-description">' + info.description + '</p>' +
      '<div class="detail-facts">' +
        row('Min. winter temp', info.tempRange) +
        row('First frost',      info.firstFrost) +
        row('Last frost',       info.lastFrost) +
        row('Growing season',   info.growingSeason) +
        (hasCoords ? row('Plant now?', '<span id="zone-frost-advisory">Checking 7-day forecast…</span>') : '') +
        row('Thrives here',     info.plants) +
      '</div>' +
      makeCalendarSection(zone) +
    '</article>'
  );
}

/**
 * Returns full-page HTML for a city detail view.
 * Looks up city by slug (e.g. "richmond-va", "new-brunswick-nj").
 * @param {string} slug  lowercase-hyphenated "name-state"
 * @returns {string}
 */
function makeCityDetailHTML(slug) {
  var city = null;
  for (var i = 0; i < CORRIDOR_CITIES.length; i++) {
    var c = CORRIDOR_CITIES[i];
    if ((c.name + '-' + c.state).toLowerCase().replace(/\s+/g, '-') === slug) {
      city = c;
      break;
    }
  }
  if (!city) return '';
  var regionLabel = REGION_LABELS[city.region] || city.region;
  var zoneColor   = getZoneColor(city.zone);
  var row = function (label, value) {
    return (
      '<div class="detail-fact">' +
        '<span class="detail-fact-label">' + label + '</span>' +
        '<span class="detail-fact-value">' + value + '</span>' +
      '</div>'
    );
  };
  var REGION_COLORS = { piedmont: '#c88232', coastal: '#4682dc', gulfCoastal: '#4682dc', blueRidge: '#4a7c59', valleyRidge: '#9b7aad' };
  var accentColor = REGION_COLORS[city.region] || '#888888';
  return (
    '<article class="detail-page">' +
      '<div class="detail-region-header" style="border-left:4px solid ' + accentColor + ';padding-left:12px;margin-bottom:0.75rem">' +
        '<h2 class="detail-title" style="margin-bottom:0.25rem">' + city.name + ', ' + city.state + '</h2>' +
        '<p class="detail-river" style="margin:0">' + city.river + '</p>' +
      '</div>' +
      '<p class="detail-description">' + city.note + '</p>' +
      '<div class="detail-facts">' +
        row('Ecoregion', '<span class="region-tag ' + city.region + '">' + regionLabel + '</span>') +
        row('Soil',      city.soil) +
        row('Zone',      '<span class="zone-badge" style="background:' + zoneColor + ';color:#1a1a2e">Zone ' + city.zone + '</span>') +
      '</div>' +
      makeNativePlantsSection(city.region) +
    '</article>'
  );
}

/**
 * Returns full-page detail HTML for an external OpenStreetMap garden feature.
 * All fields are escaped because the source data is untrusted.
 * @param {{ osmId?: string, name?: string, type?: string, address?: string }} props
 * @returns {string}
 */
function makeGardenDetailHTML(props) {
  if (!props || !props.osmId) return '';

  var gardenName = escapeHTML(props.name || 'Community garden');
  var gardenType = escapeHTML(props.type || 'Community garden');
  var gardenAddress = escapeHTML(props.address || 'Address not listed');
  var osmId = escapeHTML(props.osmId);

  var row = function (label, value) {
    return (
      '<div class="detail-fact">' +
        '<span class="detail-fact-label">' + label + '</span>' +
        '<span class="detail-fact-value">' + value + '</span>' +
      '</div>'
    );
  };

  return (
    '<article class="detail-page">' +
      '<div class="detail-region-header" style="border-left:4px solid #2d6a4f;padding-left:12px;margin-bottom:0.75rem">' +
        '<h2 class="detail-title" style="margin-bottom:0.25rem">' + gardenName + '</h2>' +
        '<p class="detail-river" style="margin:0;color:#9fd3b8">OpenStreetMap garden listing</p>' +
      '</div>' +
      '<p class="detail-description">Community growing space or native plant source from OpenStreetMap.</p>' +
      '<div class="detail-facts">' +
        row('Type', gardenType) +
        row('Address', gardenAddress) +
        row('OSM ID', osmId) +
      '</div>' +
    '</article>'
  );
}

/**
 * Classifies a lat/lon point as 'coastal', 'piedmont', or 'blueRidge'
 * by comparing its longitude against the nearest fall line point.
 * Used by the search/location detail page.
 * @param {number} lat
 * @param {number} lon
 * @returns {'coastal'|'piedmont'|'blueRidge'}
 */

function getCurrentPlantingActivities(zone) {
  var monthKeys = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  var monthLabels = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
  var idx = new Date().getMonth();
  var key = monthKeys[idx];
  var monthName = monthLabels[idx];
  var entry = PLANTING_CALENDAR[zone] && PLANTING_CALENDAR[zone][key];
  return {
    startIndoors: (entry && entry.startIndoors) || [],
    directSow:    (entry && entry.directSow)    || [],
    transplant:   (entry && entry.transplant)   || [],
    harvest:      (entry && entry.harvest)      || [],
    monthName:    monthName,
  };
}

function makeSeasonalCardShell(zone, region) { // region forwarded to hydrateSeasonalCard
  var activities = getCurrentPlantingActivities(zone);
  var safeZone = String(zone).replace(/[<>"'&]/g, '');
  var plantItems = [].concat(
    activities.startIndoors.map(function (p) { return p + ' (indoors)'; }),
    activities.directSow.map(function (p) { return p + ' (sow)'; }),
    activities.transplant.map(function (p) { return p + ' (transplant)'; })
  );
  var plantText = plantItems.length
    ? plantItems.join(', ')
    : 'Nothing scheduled for ' + activities.monthName;

  return (
    '<section class="seasonal-card">' +
      '<h3 class="seasonal-title">Growing Season \u00b7 Zone ' + safeZone + '</h3>' +
      '<div class="seasonal-grid">' +
        '<div class="seasonal-panel">' +
          '<span class="seasonal-label">FROST RISK</span>' +
          '<span id="seasonal-frost" class="seasonal-value seasonal-loading">Loading\u2026</span>' +
        '</div>' +
        '<div class="seasonal-panel">' +
          '<span class="seasonal-label">PLANT NOW</span>' +
          '<span class="seasonal-value">' + plantText + '</span>' +
        '</div>' +
        '<div class="seasonal-panel">' +
          '<span class="seasonal-label">IN YOUR REGION</span>' +
          '<span id="seasonal-inat" class="seasonal-value seasonal-loading">Loading\u2026</span>' +
        '</div>' +
        '<div class="seasonal-panel">' +
          '<span class="seasonal-label">RIVERS</span>' +
          '<span id="seasonal-rivers" class="seasonal-value seasonal-loading">Loading\u2026</span>' +
        '</div>' +
      '</div>' +
    '</section>'
  );
}

/**
 * Returns full-page HTML for a location report (search / GPS result).
 * Includes approximate ecoregion, soil, and native plants for the location.
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
function makeLocationReport(lat, lon) {
  var region = classifyLocation(lat, lon);
  var watershed = lookupWatershed(lat, lon);
  var geojsonMap = {
    piedmont:         PIEDMONT_GEOJSON,
    coastal:          COASTAL_PLAIN_GEOJSON,
    blueRidge:        BLUE_RIDGE_GEOJSON,
    valleyRidge:      VALLEY_RIDGE_GEOJSON,
    gulfCoastal:      GULF_COASTAL_GEOJSON,
    neUpland:         NE_UPLAND_GEOJSON,
    neCoastal:        NE_COASTAL_GEOJSON,
    greatLakes:       GREAT_LAKES_GEOJSON,
    interiorLowlands: INTERIOR_LOWLANDS_GEOJSON,
  };
  var geojson = geojsonMap[region];
  var props   = geojson.properties;
  var soil    = SOIL_TYPES[region];
  var regionLabel = REGION_LABELS[region] || props.name;

  // Find nearest city by haversine distance
  var nearest  = CORRIDOR_CITIES[0];
  var minDistKm = haversineKm([lon, lat], [nearest.lon, nearest.lat]);
  for (var i = 1; i < CORRIDOR_CITIES.length; i++) {
    var c = CORRIDOR_CITIES[i];
    var d = haversineKm([lon, lat], [c.lon, c.lat]);
    if (d < minDistKm) { minDistKm = d; nearest = c; }
  }
  var nearestText = nearest.name + ', ' + nearest.state + ' (' + Math.round(minDistKm) + '\u00a0km)';
  var nearestZone = nearest.zone || 'unknown';
  var zoneInfo    = getZoneInfo(nearestZone);
  var zoneSummary = zoneInfo ? zoneInfo.tempRange + '\u2002\u00b7\u2002' + zoneInfo.growingSeason : '';
  var seasonalShell = makeSeasonalCardShell(nearestZone, region);

  var REGION_COLORS = {
    piedmont:         '#c88232',
    coastal:          '#4682dc',
    gulfCoastal:      '#4682dc',
    blueRidge:        '#4a7c59',
    valleyRidge:      '#9b7aad',
    neUpland:         '#4a9a8a',
    neCoastal:        '#6baed6',
    greatLakes:       '#4a7ab5',
    interiorLowlands: '#8a7d4a',
  };
  var accentColor = REGION_COLORS[region] || '#888888';

  return (
    seasonalShell +
    '<article class="detail-page">' +
      '<h2 class="detail-title">Location Report</h2>' +
      '<p class="detail-coords">' +
        lat.toFixed(4) + '\u00b0N\u2002\u00b7\u2002' + Math.abs(lon).toFixed(4) + '\u00b0W' +
      '</p>' +
      '<div class="detail-region-header" style="border-left:4px solid ' + accentColor + ';padding-left:12px;margin-bottom:0.75rem">' +
        '<h3 class="detail-region-name" style="margin:0">' + props.name + '</h3>' +
      '</div>' +
      '<p class="detail-description">' + props.description + '</p>' +
      '<div class="detail-facts">' +
        '<div class="detail-fact">' +
          '<span class="detail-fact-label">Ecoregion</span>' +
          '<span class="detail-fact-value">' + regionLabel + '</span>' +
        '</div>' +
        '<div class="detail-fact">' +
          '<span class="detail-fact-label">Nearest city</span>' +
          '<span class="detail-fact-value">' + nearestText + '</span>' +
        '</div>' +
        '<div class="detail-fact">' +
          '<span class="detail-fact-label">Hardiness zone</span>' +
          '<span class="detail-fact-value">' +
            '<strong>Zone\u00a0' + nearestZone + '</strong>' +
            (zoneSummary ? '\u2002<small class="detail-fact-meta">' + zoneSummary + '</small>' : '') +
            '<br><small class="detail-fact-meta">Approximate \u2014 based on nearest city. Enable the zone layer for map-wide precision.</small>' +
          '</span>' +
        '</div>' +
        '<div class="detail-fact">' +
          '<span class="detail-fact-label">Soil series</span>' +
          '<span class="detail-fact-value">' + soil.series + '</span>' +
        '</div>' +
        '<div class="detail-fact">' +
          '<span class="detail-fact-label">Primary texture</span>' +
          '<span class="detail-fact-value">' + soil.texture + '</span>' +
        '</div>' +
        '<div class="detail-fact">' +
          '<span class="detail-fact-label">Watershed</span>' +
          '<span class="detail-fact-value">' +
            (watershed
              ? watershed.name +
                ' <small class="detail-fact-meta">HUC8 ' + watershed.huc8 +
                ' • ' + watershed.areaKm2.toLocaleString('en-US') + ' km²</small>'
              : '<small class="detail-fact-meta">No precomputed watershed available for this point yet.</small>') +
          '</span>' +
        '</div>' +
      '</div>' +
      makeNativePlantsSection(region) +
      makeSoilSection(region) +
      makeInvasivesSection(region) +
    '</article>'
  );
}


/* ─── Geographic helper utilities (moved to geo-data-core.js) ──── */


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


function makeMarkerPopup(city) {
  var regionLabel  = REGION_LABELS[city.region] || city.region;
  var zoneColor    = getZoneColor(city.zone);
  var row = function (label, value) {
    return (
      '<div class="city-fact">' +
        '<span class="city-fact-label">' + label + '</span>' +
        '<span class="city-fact-value">' + value + '</span>' +
      '</div>'
    );
  };
  return (
    '<div class="popup-content city-popup">' +
      '<div class="city-popup-header">' +
        '<h3>' + city.name + ', ' + city.state + '</h3>' +
        '<span class="city-region-badge ' + city.region + '">' + regionLabel + '</span>' +
      '</div>' +
      '<p class="city-river">' + city.river + '</p>' +
      '<p class="city-note">' + city.note + '</p>' +
      '<div class="city-facts">' +
        row('Soil', city.soil) +
        row('Zone', '<span class="zone-badge" style="background:' + zoneColor + ';color:#1a1a2e">Zone ' + city.zone + '</span>') +
      '</div>' +
    '</div>'
  );
}






/* ─── New England Fall Zone ─────────────────────────────────────
   Separate LineString for the New England mill-city fall zone
   (Augusta ME → Manchester NH → Lowell MA → Pawtucket RI → Waterbury CT).
   Kept separate from FALL_LINE_COORDS so the mid-Atlantic Coastal and
   Piedmont polygons (which close at the current Peekskill terminus) are
   unaffected.  Both lines share the same toggle and style in map.js.
   ────────────────────────────────────────────────────────────── */
const NE_FALL_ZONE_COORDS = [
  [-69.781, 44.311],   // Augusta ME — Kennebec River falls (northern terminus)
  [-71.455, 43.004],   // Manchester NH — Amoskeag Falls (Merrimack River)
  [-71.312, 42.643],   // Lowell MA — Pawtucket Falls (Merrimack River)
  [-71.383, 41.878],   // Pawtucket RI — Blackstone River falls (Slater Mill)
  [-73.050, 41.550],   // Waterbury CT — Naugatuck River falls (bridge to Hudson Valley)
  [-73.920, 41.290],   // Peekskill NY — joins the main fall line
];

const NE_FALL_ZONE_GEOJSON = {
  type: 'Feature',
  properties: {
    name:    'New England Fall Zone',
    section: 'new-england',
  },
  geometry: {
    type:        'LineString',
    coordinates: NE_FALL_ZONE_COORDS,
  },
};


/* ─── Major Appalachian Watershed Rivers ─────────────────────────
   GeoJSON FeatureCollection of 14 major rivers draining the Appalachian
   watershed from the Kennebec (Maine) south to the Savannah (Georgia).
   Coordinates are simplified (~6–10 waypoints per river) for visual
   clarity; not for precise navigation.
   Source: derived from USGS NHD / Natural Earth river data (public domain).
   ────────────────────────────────────────────────────────────── */
const MAJOR_RIVERS_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        slug: 'kennebec', name: 'Kennebec River',
        usgsGaugeId: null,
        length_km: 257, states: 'ME',
        source: 'Moosehead Lake, ME', mouth: 'Atlantic Ocean at Popham Beach, ME',
        note: 'The Kennebec was the lifeline of colonial Maine — fur trade, shipbuilding, and ice harvesting defined its banks. The falls at Augusta mark the head of tidal navigation and the geological fall zone.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-69.870, 45.630], [-69.781, 44.311], [-69.760, 43.980], [-69.810, 43.820],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'merrimack', name: 'Merrimack River',
        usgsGaugeId: null,
        length_km: 180, states: 'NH, MA',
        source: 'Franklin NH (confluence of Pemigewasset and Winnisquam)', mouth: 'Atlantic Ocean at Newburyport, MA',
        note: 'The Merrimack powered America\'s first industrial cities. Lowell\'s Pawtucket Falls drop 32 feet — enough to drive 40 mills — while Amoskeag Falls at Manchester once ran the world\'s largest textile complex.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-71.540, 43.430], [-71.455, 43.004], [-71.312, 42.643],
        [-71.160, 42.710], [-70.873, 42.810],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'connecticut', name: 'Connecticut River',
        usgsGaugeId: null,
        length_km: 655, states: 'NH, VT, MA, CT',
        source: 'Third Connecticut Lake, NH (US-Canada border)', mouth: 'Long Island Sound at Old Saybrook, CT',
        note: 'New England\'s longest river cuts through the Connecticut Valley Lowland — a Mesozoic rift basin filled with sandstone and basalt. The river\'s floodplain produced some of the most fertile farmland in colonial New England.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-71.520, 44.720], [-72.400, 44.050], [-72.650, 43.620],
        [-72.580, 43.050], [-72.530, 42.360], [-72.620, 41.760], [-72.390, 41.280],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'hudson', name: 'Hudson River',
        usgsGaugeId: null,
        length_km: 507, states: 'NY, NJ',
        source: 'Lake Tear of the Clouds, Adirondack Mountains NY', mouth: 'Upper New York Bay / Atlantic Ocean',
        note: 'The Hudson was the axis of westward expansion. The Erie Canal (1825) connected it to the Great Lakes, making New York City the commercial capital of North America. The Peekskill Highlands mark the geological fall zone.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-73.780, 44.050], [-73.730, 43.650], [-73.750, 42.650],
        [-73.960, 41.920], [-73.920, 41.290], [-73.970, 40.700],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'delaware', name: 'Delaware River',
        usgsGaugeId: null,
        length_km: 579, states: 'NY, NJ, PA, DE',
        source: 'Catskill Mountains NY (East and West Branch confluence at Hancock)', mouth: 'Delaware Bay / Atlantic Ocean',
        note: 'Washington crossed the Delaware on Christmas 1776. The Delaware Water Gap cuts through Kittatinny Ridge — the river predates the Appalachian ridges it flows through, carving its gorge as the mountains rose around it.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-74.860, 41.900], [-75.040, 41.370], [-75.190, 40.970],
        [-74.870, 40.570], [-74.770, 40.220], [-75.100, 40.000],
        [-75.570, 39.620], [-75.490, 39.080],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'susquehanna', name: 'Susquehanna River',
        usgsGaugeId: null,
        length_km: 715, states: 'NY, PA, MD',
        source: 'Otsego Lake (Cooperstown NY)', mouth: 'Chesapeake Bay at Havre de Grace, MD',
        note: 'The Susquehanna drains nearly half of the Chesapeake Bay watershed. Its Conowingo Dam (1928) traps millions of tons of sediment that once fed the Bay\'s oyster reefs. The Susquehanna Flats were once the world\'s most productive wild-celery beds.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-75.100, 42.700], [-76.650, 41.600], [-76.010, 40.980],
        [-76.560, 40.430], [-76.080, 39.540],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'potomac', name: 'Potomac River',
        usgsGaugeId: '01646500',
        length_km: 652, states: 'WV, MD, VA, DC',
        source: 'Fairfax Stone, WV (Backbone Mountain)', mouth: 'Chesapeake Bay at Point Lookout, MD',
        note: 'Great Falls of the Potomac drop 76 feet in less than a mile — the most dramatic fall line in the eastern US. George Washington\'s Patowmack Canal (1802) attempted to bypass the falls; today the C&O Canal towpath follows the Maryland shore.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-79.290, 39.200], [-78.800, 39.370], [-77.880, 39.390],
        [-77.245, 39.000], [-77.040, 38.870], [-76.710, 38.660], [-76.540, 38.340],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'shenandoah', name: 'Shenandoah River',
        usgsGaugeId: '01636500',
        length_km: 286, states: 'VA, WV',
        source: 'South Fork: Augusta County VA; North Fork: Rockingham County VA', mouth: 'Potomac River at Harpers Ferry, WV',
        note: 'The Shenandoah Valley — the Great Appalachian Valley — is underlain by limestone that weathers to the rich, well-drained soils that made it the "breadbasket of the Confederacy." At Harpers Ferry it meets the Potomac in a spectacular water gap.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-78.700, 38.140], [-78.430, 38.540], [-78.110, 38.870], [-77.880, 39.390],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'rappahannock', name: 'Rappahannock River',
        usgsGaugeId: '01668000',
        length_km: 273, states: 'VA',
        source: 'Chester Gap, Blue Ridge Mountains VA', mouth: 'Chesapeake Bay (Rappahannock River mouth)',
        note: 'The Rappahannock\'s fall at Fredericksburg was the commercial anchor of colonial Virginia. George Washington\'s childhood home was across the river. The Battle of Fredericksburg (1862) was fought along its banks.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-78.850, 38.280], [-78.200, 38.480], [-77.468, 38.302],
        [-76.900, 38.060], [-76.660, 37.690],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'james', name: 'James River',
        usgsGaugeId: '02037500',
        length_km: 560, states: 'VA',
        source: 'Iron Gate VA (confluence of Jackson and Cowpasture Rivers)', mouth: 'Hampton Roads / Chesapeake Bay',
        note: 'The James was the artery of English America — Jamestown (1607) sat at its tidal mouth. Belle Isle rapids at Richmond mark the fall line; the river powered antebellum tobacco mills and today feeds hydroelectric turbines through the same granite gorge.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-79.700, 37.780], [-79.150, 37.290], [-78.650, 37.540],
        [-77.464, 37.527], [-77.220, 37.300], [-76.590, 37.060],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'new-river', name: 'New River',
        usgsGaugeId: '03184500',
        length_km: 518, states: 'NC, VA, WV',
        source: 'Watauga County NC (confluence of forks near Boone)', mouth: 'Ohio River at Point Pleasant, WV (as the Kanawha)',
        note: 'One of the oldest rivers in North America — the New River predates the Appalachian Mountains and flows through them rather than around them. It becomes the Kanawha after merging with the Gauley at Gauley Bridge WV, draining into the Ohio.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-81.700, 36.590], [-80.570, 37.310], [-80.420, 37.800],
        [-81.180, 38.090], [-81.840, 38.370], [-82.010, 38.520],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'roanoke', name: 'Roanoke River',
        usgsGaugeId: '02080500',
        length_km: 660, states: 'VA, NC',
        source: 'Near Roanoke VA (confluence of Roanoke and Blackwater Rivers)', mouth: 'Albemarle Sound, NC',
        note: 'The Roanoke cuts through the Blue Ridge at the Roanoke Narrows — a critical Atlantic flyway corridor for migratory birds and American shad. Roanoke Rapids NC sits at the fall line where the river drops from the Piedmont to the coastal plain.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-80.060, 37.280], [-79.520, 37.080], [-77.655, 36.462],
        [-77.000, 36.100], [-76.640, 35.900],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'french-broad', name: 'French Broad River',
        usgsGaugeId: '03451500',
        length_km: 298, states: 'NC, TN',
        source: 'Transylvania County NC (near Brevard)', mouth: 'Tennessee River at Knoxville, TN (via confluence with Holston)',
        note: 'One of the few rivers that flow northwest through the Blue Ridge — the French Broad predates the mountain uplift. Its unusual name comes from early English settlers who called land beyond the Blue Ridge "French territory." Near Asheville it drains the largest watershed in the Southern Appalachians.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-82.740, 35.200], [-82.551, 35.579], [-82.900, 35.800],
        [-83.040, 35.960], [-83.120, 36.060], [-83.420, 36.020],
      ]},
    },
    {
      type: 'Feature',
      properties: {
        slug: 'savannah', name: 'Savannah River',
        usgsGaugeId: '02197000',
        length_km: 505, states: 'GA, SC',
        source: 'NE Georgia (confluence of Tugaloo and Seneca Rivers at Lake Hartwell)', mouth: 'Atlantic Ocean at Savannah, GA',
        note: 'The Savannah formed the colonial boundary between British Georgia and the Carolinas. Augusta GA was founded in 1736 by James Oglethorpe at the fall line — the furthest inland point accessible by flatboat from the coast. The river still marks the GA-SC state line.',
      },
      geometry: { type: 'LineString', coordinates: [
        [-83.100, 34.870], [-82.490, 34.250], [-82.020, 33.470],
        [-81.300, 32.720], [-81.020, 32.080],
      ]},
    },
  ],
};

/**
 * Returns full-page detail HTML for a river.
 * @param {string} slug  e.g. "james", "french-broad"
 * @returns {string}
 */
function makeRiverDetailHTML(slug) {
  var river = null;
  for (var i = 0; i < MAJOR_RIVERS_GEOJSON.features.length; i++) {
    if (MAJOR_RIVERS_GEOJSON.features[i].properties.slug === slug) {
      river = MAJOR_RIVERS_GEOJSON.features[i].properties;
      break;
    }
  }
  if (!river) return '';
  var row = function (label, value) {
    return (
      '<div class="detail-fact">' +
        '<span class="detail-fact-label">' + label + '</span>' +
        '<span class="detail-fact-value">' + value + '</span>' +
      '</div>'
    );
  };
  return (
    '<article class="detail-page">' +
      '<div class="detail-region-header" style="border-left:4px solid #4a9eff;padding-left:12px;margin-bottom:0.75rem">' +
        '<h2 class="detail-title" style="margin-bottom:0">' + river.name + '</h2>' +
      '</div>' +
      '<p class="detail-description">' + river.note + '</p>' +
      '<div class="detail-facts">' +
        row('Length',     '~' + river.length_km + ' km') +
        row('States',     river.states) +
        row('Source',     river.source) +
        row('Mouth',      river.mouth) +
        row('Current flow', '<span id="flow-' + river.slug + '">Loading…</span>') +
      '</div>' +
    '</article>'
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



/* ─── Export ─────────────────────────────────────────────────── */
const GeoData = {
  FALL_LINE_COORDS,
  EAST_COAST_COORDS,
  FALL_LINE_GEOJSON,
  COASTAL_PLAIN_GEOJSON,
  PIEDMONT_GEOJSON,
  BLUE_RIDGE_GEOJSON,
  VALLEY_RIDGE_GEOJSON,
  NE_UPLAND_GEOJSON,
  NE_COASTAL_GEOJSON,
  GREAT_LAKES_GEOJSON,
  INTERIOR_LOWLANDS_GEOJSON,
  GULF_COASTAL_GEOJSON,
  WATERSHEDS_GEOJSON,
  REGION_LABELS,
  BLUE_RIDGE_EAST_ESCARPMENT,
  BLUE_RIDGE_WEST_ESCARPMENT,
  STYLES,
  BBOX: { NORTH: BBOX_NORTH, SOUTH: BBOX_SOUTH, EAST: BBOX_EAST, WEST: BBOX_WEST },
  NATIVE_PLANTS,
  makeNativePlantsSection,
  SOIL_TYPES,
  makeSoilSection,
  INVASIVE_SPECIES,
  makeInvasivesSection,
  PLANTING_CALENDAR,
  makeCalendarSection,
  getCurrentPlantingActivities,
  makeSeasonalCardShell,
  makeRegionPopup,
  makeFallLinePopup,
  makeRegionDetailHTML,
  makeFallLineDetailHTML,
  makeZoneDetailHTML,
  makeCityDetailHTML,
  makeGardenDetailHTML,
  classifyLocation,
  lookupWatershed,
  makeLocationReport,
  haversineKm,
  FALLBACK_VIEWS,
  pickFallbackView,
  nearestCorridorCity,
  minDistanceToFallLine,
  HARDINESS_ZONE_COLORS,
  HARDINESS_ZONE_INFO,
  getZoneColor,
  getZoneInfo,
  makeZonePopup,
  CORRIDOR_CITIES,
  makeMarkerPopup,
  isValidUSZipCode,
  isInCorridor,
  buildSearchQuery,
  NE_FALL_ZONE_GEOJSON,
  MAJOR_RIVERS_GEOJSON,
  REGION_INATURALIST_PLACE_IDS,
  makeRiverDetailHTML,
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
