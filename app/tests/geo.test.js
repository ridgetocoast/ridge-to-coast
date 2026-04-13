/**
 * tests/geo.test.js
 * -----------------
 * Unit tests for lib/geo-data.js using the Node.js built-in test runner.
 * No npm packages required. Run with:
 *
 *   node --test tests/geo.test.js
 *
 * Results are stored at:
 *   tests/results/latest.txt
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  FALL_LINE_COORDS,
  FALL_LINE_GEOJSON,
  COASTAL_PLAIN_GEOJSON,
  PIEDMONT_GEOJSON,
  BLUE_RIDGE_GEOJSON,
  STYLES,
  BBOX,
  makeRegionPopup,
  makeFallLinePopup,
  makeRegionDetailHTML,
  makeFallLineDetailHTML,
  makeZoneDetailHTML,
  makeCityDetailHTML,
  classifyLocation,
  makeLocationReport,
  haversineKm,
  minDistanceToFallLine,
  HARDINESS_ZONE_COLORS,
  HARDINESS_ZONE_INFO,
  getZoneColor,
  getZoneInfo,
  makeZonePopup,
  FALL_LINE_CITIES,
  makeMarkerPopup,
  NATIVE_PLANTS,
  makeNativePlantsSection,
  SOIL_TYPES,
  makeSoilSection,
  isValidUSZipCode,
  isInCorridor,
  buildSearchQuery,
  NE_FALL_ZONE_GEOJSON,
  MAJOR_RIVERS_GEOJSON,
  makeRiverDetailHTML,
} = require('../lib/geo-data.js');


/* ═══════════════════════════════════════════════════════════════
   SUITE 1 — Fall Line: GeoJSON structure
   ═══════════════════════════════════════════════════════════════ */

describe('Fall Line GeoJSON structure', () => {
  it('is a GeoJSON Feature', () => {
    assert.equal(FALL_LINE_GEOJSON.type, 'Feature');
  });

  it('has a LineString geometry', () => {
    assert.equal(FALL_LINE_GEOJSON.geometry.type, 'LineString');
  });

  it('has at least 10 coordinate pairs', () => {
    assert.ok(
      FALL_LINE_GEOJSON.geometry.coordinates.length >= 10,
      `expected ≥10 points, got ${FALL_LINE_GEOJSON.geometry.coordinates.length}`
    );
  });

  it('every coordinate is a [longitude, latitude] pair of numbers', () => {
    for (const coord of FALL_LINE_GEOJSON.geometry.coordinates) {
      assert.equal(coord.length, 2, 'each coordinate must have exactly 2 values');
      assert.ok(typeof coord[0] === 'number', `longitude ${coord[0]} is not a number`);
      assert.ok(typeof coord[1] === 'number', `latitude ${coord[1]} is not a number`);
    }
  });

  it('has a name property', () => {
    assert.ok(
      typeof FALL_LINE_GEOJSON.properties.name === 'string' &&
      FALL_LINE_GEOJSON.properties.name.length > 0
    );
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 2 — Fall Line: geographic accuracy
   ═══════════════════════════════════════════════════════════════ */

describe('Fall Line geographic accuracy', () => {
  it('all points are within the Atlantic Seaboard fall line belt (Peekskill NY to Columbus GA)', () => {
    // Fall line spans Peekskill NY (41.29°N) to Columbus GA (32.46°N)
    for (const [lon, lat] of FALL_LINE_COORDS) {
      assert.ok(lon >= -85.5 && lon <= -73.5,
        `longitude ${lon} is outside the eastern US range [-85.5, -73.5]`);
      assert.ok(lat >= 32.0 && lat <= 41.5,
        `latitude ${lat} is outside the NY–GA range [32.0, 41.5]`);
    }
  });

  it('all longitudes are west of 0° (i.e., negative)', () => {
    for (const [lon] of FALL_LINE_COORDS) {
      assert.ok(lon < 0, `longitude ${lon} should be negative (western hemisphere)`);
    }
  });

  it('all latitudes are north of 0° (i.e., positive)', () => {
    for (const [, lat] of FALL_LINE_COORDS) {
      assert.ok(lat > 0, `latitude ${lat} should be positive (northern hemisphere)`);
    }
  });

  it('coordinates are not accidentally swapped (lat/lon transposition guard)', () => {
    // Richmond VA longitudes should be around -77, not +37
    // Richmond VA latitudes should be around 37, not -77
    for (const [lon, lat] of FALL_LINE_COORDS) {
      assert.ok(lon < -70,  `longitude ${lon} looks like a latitude — possible swap`);
      assert.ok(lat > 30,   `latitude ${lat} looks like a longitude — possible swap`);
    }
  });

  it('runs generally north to south (first point is north of last point)', () => {
    const firstLat = FALL_LINE_COORDS[0][1];
    const lastLat  = FALL_LINE_COORDS[FALL_LINE_COORDS.length - 1][1];
    assert.ok(
      firstLat > lastLat,
      `expected first lat (${firstLat}) > last lat (${lastLat}) — line should go N→S`
    );
  });

  it('passes within 2 km of the Belle Isle rapids (primary anchor point)', () => {
    // Belle Isle rapids: ~37.527°N, 77.467°W — where the James River
    // physically crosses the fall line. This is the most verifiable point.
    const BELLE_ISLE = [-77.467, 37.527];
    const dist = minDistanceToFallLine(BELLE_ISLE);
    assert.ok(
      dist <= 2.0,
      `nearest fall line point is ${dist.toFixed(2)} km from Belle Isle — expected ≤ 2 km`
    );
  });

  it('has at least one point in the City of Richmond latitude range (37.48–37.56)', () => {
    const cityPoints = FALL_LINE_COORDS.filter(([, lat]) => lat >= 37.48 && lat <= 37.56);
    assert.ok(
      cityPoints.length > 0,
      'fall line should have at least one point within the City of Richmond latitude range'
    );
  });

  it('passes within 5 km of Great Falls of the Potomac (DC anchor)', () => {
    // Great Falls rapids: ~39.000°N, 77.245°W — the Potomac fall line crossing
    const GREAT_FALLS = [-77.245, 39.000];
    const dist = minDistanceToFallLine(GREAT_FALLS);
    assert.ok(dist <= 5.0,
      `nearest fall line point is ${dist.toFixed(2)} km from Great Falls — expected ≤ 5 km`);
  });

  it('passes within 5 km of Falls of Neuse (Raleigh anchor)', () => {
    // Falls of Neuse: ~35.897°N, 78.648°W — where the Neuse River crosses the fall line
    const FALLS_OF_NEUSE = [-78.648, 35.897];
    const dist = minDistanceToFallLine(FALLS_OF_NEUSE);
    assert.ok(dist <= 5.0,
      `nearest fall line point is ${dist.toFixed(2)} km from Falls of Neuse — expected ≤ 5 km`);
  });

  it('passes within 10 km of Delaware River at Trenton NJ', () => {
    // Trenton NJ: ~40.220°N, 74.770°W — where the Delaware River crosses the fall line
    const TRENTON = [-74.770, 40.220];
    const dist = minDistanceToFallLine(TRENTON);
    assert.ok(dist <= 10.0,
      `nearest fall line point is ${dist.toFixed(2)} km from Trenton — expected ≤ 10 km`);
  });

  it('passes within 10 km of Raritan River at New Brunswick NJ', () => {
    // New Brunswick NJ: ~40.490°N, 74.445°W — Raritan River fall line crossing
    const NEW_BRUNSWICK = [-74.445, 40.490];
    const dist = minDistanceToFallLine(NEW_BRUNSWICK);
    assert.ok(dist <= 10.0,
      `nearest fall line point is ${dist.toFixed(2)} km from New Brunswick — expected ≤ 10 km`);
  });

  it('passes within 10 km of Great Falls of the Passaic at Paterson NJ', () => {
    // Paterson NJ: ~40.917°N, 74.174°W — Hamilton's industrial city, Passaic falls
    const PATERSON = [-74.174, 40.917];
    const dist = minDistanceToFallLine(PATERSON);
    assert.ok(dist <= 10.0,
      `nearest fall line point is ${dist.toFixed(2)} km from Paterson — expected ≤ 10 km`);
  });

  it('passes within 10 km of Peekskill NY (Hudson Highlands — northern terminus)', () => {
    // Peekskill NY: ~41.290°N, 73.920°W — Hudson Highlands boundary
    const PEEKSKILL = [-73.920, 41.290];
    const dist = minDistanceToFallLine(PEEKSKILL);
    assert.ok(dist <= 10.0,
      `nearest fall line point is ${dist.toFixed(2)} km from Peekskill — expected ≤ 10 km`);
  });

  it('passes within 10 km of Savannah River at Augusta GA', () => {
    // Augusta GA: ~33.470°N, 82.020°W — where the Savannah River crosses the fall line
    const AUGUSTA = [-82.020, 33.470];
    const dist = minDistanceToFallLine(AUGUSTA);
    assert.ok(dist <= 10.0,
      `nearest fall line point is ${dist.toFixed(2)} km from Augusta GA — expected ≤ 10 km`);
  });

  it('passes within 10 km of Ocmulgee River at Macon GA', () => {
    // Macon GA: ~32.840°N, 83.630°W — where the Ocmulgee River crosses the fall line
    const MACON = [-83.630, 32.840];
    const dist = minDistanceToFallLine(MACON);
    assert.ok(dist <= 10.0,
      `nearest fall line point is ${dist.toFixed(2)} km from Macon GA — expected ≤ 10 km`);
  });

  it('passes within 10 km of Chattahoochee River at Columbus GA (southern terminus)', () => {
    // Columbus GA: ~32.460°N, 84.990°W — the southernmost fall line anchor
    const COLUMBUS = [-84.990, 32.460];
    const dist = minDistanceToFallLine(COLUMBUS);
    assert.ok(dist <= 10.0,
      `nearest fall line point is ${dist.toFixed(2)} km from Columbus GA — expected ≤ 10 km`);
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 3 — Coastal Plain GeoJSON
   ═══════════════════════════════════════════════════════════════ */

describe('Coastal Plain polygon', () => {
  const ring = COASTAL_PLAIN_GEOJSON.geometry.coordinates[0];

  it('is a GeoJSON Feature', () => {
    assert.equal(COASTAL_PLAIN_GEOJSON.type, 'Feature');
  });

  it('has a Polygon geometry', () => {
    assert.equal(COASTAL_PLAIN_GEOJSON.geometry.type, 'Polygon');
  });

  it('polygon ring is closed (first coordinate equals last)', () => {
    const first = ring[0];
    const last  = ring[ring.length - 1];
    assert.deepEqual(first, last, 'polygon ring must be closed (first === last coordinate)');
  });

  it('region property is "coastal"', () => {
    assert.equal(COASTAL_PLAIN_GEOJSON.properties.region, 'coastal');
  });

  it('has a non-empty name', () => {
    assert.ok(COASTAL_PLAIN_GEOJSON.properties.name.length > 0);
  });

  it('has a non-empty description', () => {
    assert.ok(COASTAL_PLAIN_GEOJSON.properties.description.length > 0);
  });

  it('eastern boundary reaches at least the mid-Atlantic coast (~-73°W)', () => {
    const maxLon = Math.max(...ring.map(([lon]) => lon));
    assert.ok(
      maxLon >= -74.0,
      `coastal polygon eastern boundary should reach at least -74°W, max lon was ${maxLon}`
    );
  });

  it('does not extend west of the fall line', () => {
    // The westernmost longitude should not exceed the fall line's westernmost point
    const fallLineMinLon = Math.min(...FALL_LINE_COORDS.map(([lon]) => lon));
    const polygonMinLon  = Math.min(...ring.map(([lon]) => lon));
    assert.ok(
      polygonMinLon >= fallLineMinLon - 0.001,
      `coastal polygon extends too far west (${polygonMinLon}); fall line min lon is ${fallLineMinLon}`
    );
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 4 — Piedmont GeoJSON
   ═══════════════════════════════════════════════════════════════ */

describe('Piedmont polygon', () => {
  const ring = PIEDMONT_GEOJSON.geometry.coordinates[0];

  it('is a GeoJSON Feature', () => {
    assert.equal(PIEDMONT_GEOJSON.type, 'Feature');
  });

  it('has a Polygon geometry', () => {
    assert.equal(PIEDMONT_GEOJSON.geometry.type, 'Polygon');
  });

  it('polygon ring is closed (first coordinate equals last)', () => {
    const first = ring[0];
    const last  = ring[ring.length - 1];
    assert.deepEqual(first, last, 'polygon ring must be closed (first === last coordinate)');
  });

  it('region property is "piedmont"', () => {
    assert.equal(PIEDMONT_GEOJSON.properties.region, 'piedmont');
  });

  it('has a non-empty name', () => {
    assert.ok(PIEDMONT_GEOJSON.properties.name.length > 0);
  });

  it('western boundary reaches the metro west edge', () => {
    const minLon = Math.min(...ring.map(([lon]) => lon));
    assert.ok(
      minLon <= BBOX.WEST,
      `piedmont polygon should reach BBOX west (${BBOX.WEST}), min lon was ${minLon}`
    );
  });

  it('does not extend east of the fall line', () => {
    const fallLineMaxLon = Math.max(...FALL_LINE_COORDS.map(([lon]) => lon));
    const polygonMaxLon  = Math.max(...ring.map(([lon]) => lon));
    assert.ok(
      polygonMaxLon <= fallLineMaxLon + 0.001,
      `piedmont polygon extends too far east (${polygonMaxLon}); fall line max lon is ${fallLineMaxLon}`
    );
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 5 — Regions do not overlap (disjoint check)
   ═══════════════════════════════════════════════════════════════ */

describe('Region separation', () => {
  it('coastal and piedmont regions have different names', () => {
    assert.notEqual(
      COASTAL_PLAIN_GEOJSON.properties.name,
      PIEDMONT_GEOJSON.properties.name
    );
  });

  it('coastal and piedmont have different region codes', () => {
    assert.notEqual(
      COASTAL_PLAIN_GEOJSON.properties.region,
      PIEDMONT_GEOJSON.properties.region
    );
  });

  it('coastal is east of piedmont (coastal max-lon > piedmont max-lon)', () => {
    const coastalRing  = COASTAL_PLAIN_GEOJSON.geometry.coordinates[0];
    const piedmontRing = PIEDMONT_GEOJSON.geometry.coordinates[0];
    const coastalMaxLon  = Math.max(...coastalRing.map(([lon]) => lon));
    const piedmontMaxLon = Math.max(...piedmontRing.map(([lon]) => lon));
    assert.ok(
      coastalMaxLon > piedmontMaxLon,
      `coastal max lon (${coastalMaxLon}) should be > piedmont max lon (${piedmontMaxLon})`
    );
  });

  it('piedmont is west of coastal (piedmont min-lon < coastal min-lon)', () => {
    const coastalRing  = COASTAL_PLAIN_GEOJSON.geometry.coordinates[0];
    const piedmontRing = PIEDMONT_GEOJSON.geometry.coordinates[0];
    const coastalMinLon  = Math.min(...coastalRing.map(([lon]) => lon));
    const piedmontMinLon = Math.min(...piedmontRing.map(([lon]) => lon));
    assert.ok(
      piedmontMinLon < coastalMinLon,
      `piedmont min lon (${piedmontMinLon}) should be < coastal min lon (${coastalMinLon})`
    );
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 6 — Styles
   ═══════════════════════════════════════════════════════════════ */

describe('STYLES object', () => {
  it('has keys: coastal, piedmont, blueRidge, fallLine, regionHover, rivers, riversHover', () => {
    for (const key of ['coastal', 'piedmont', 'blueRidge', 'fallLine', 'regionHover', 'rivers', 'riversHover']) {
      assert.ok(key in STYLES, `STYLES missing key: ${key}`);
    }
  });

  it('coastal fillColor is a CSS hex color', () => {
    assert.match(STYLES.coastal.fillColor, /^#[0-9A-Fa-f]{6}$/);
  });

  it('piedmont fillColor is a CSS hex color', () => {
    assert.match(STYLES.piedmont.fillColor, /^#[0-9A-Fa-f]{6}$/);
  });

  it('fall line color is a CSS hex color', () => {
    assert.match(STYLES.fallLine.color, /^#[0-9A-Fa-f]{6}$/);
  });

  it('fillOpacity values are between 0 and 1', () => {
    for (const key of ['coastal', 'piedmont', 'regionHover']) {
      const val = STYLES[key].fillOpacity;
      assert.ok(val >= 0 && val <= 1, `${key}.fillOpacity ${val} is not in [0,1]`);
    }
  });

  it('hover fillOpacity is greater than default fill opacity (coastal)', () => {
    assert.ok(
      STYLES.regionHover.fillOpacity > STYLES.coastal.fillOpacity,
      'hover opacity should be higher than default to give visual feedback'
    );
  });

  it('fall line weight is a positive number', () => {
    assert.ok(typeof STYLES.fallLine.weight === 'number' && STYLES.fallLine.weight > 0);
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 7 — Popup generators
   ═══════════════════════════════════════════════════════════════ */

describe('makeRegionPopup()', () => {
  const coastalProps  = COASTAL_PLAIN_GEOJSON.properties;
  const piedmontProps = PIEDMONT_GEOJSON.properties;

  it('returns a string', () => {
    assert.equal(typeof makeRegionPopup(coastalProps), 'string');
  });

  it('contains the region name', () => {
    const html = makeRegionPopup(coastalProps);
    assert.ok(html.includes(coastalProps.name), 'popup should contain the region name');
  });

  it('contains the region description', () => {
    const html = makeRegionPopup(coastalProps);
    assert.ok(html.includes(coastalProps.description.slice(0, 30)),
      'popup should contain the region description');
  });

  it('contains the correct CSS class for coastal region', () => {
    const html = makeRegionPopup(coastalProps);
    assert.ok(html.includes('class="region-tag coastal"'),
      'coastal popup should have region-tag coastal class');
  });

  it('contains the correct CSS class for piedmont region', () => {
    const html = makeRegionPopup(piedmontProps);
    assert.ok(html.includes('class="region-tag piedmont"'),
      'piedmont popup should have region-tag piedmont class');
  });

  it('wraps content in popup-content div', () => {
    const html = makeRegionPopup(coastalProps);
    assert.ok(html.includes('class="popup-content"'));
  });

  it('produces different output for different regions', () => {
    const coastal  = makeRegionPopup(coastalProps);
    const piedmont = makeRegionPopup(piedmontProps);
    assert.notEqual(coastal, piedmont);
  });
});

describe('makeFallLinePopup()', () => {
  it('returns a string', () => {
    assert.equal(typeof makeFallLinePopup(), 'string');
  });

  it('mentions "Fall Line" in the heading', () => {
    const html = makeFallLinePopup();
    assert.ok(html.toLowerCase().includes('fall line'), 'popup should mention "fall line"');
  });

  it('mentions "Piedmont"', () => {
    assert.ok(makeFallLinePopup().includes('Piedmont'));
  });

  it('mentions "Coastal Plain" or "Coastal"', () => {
    const html = makeFallLinePopup();
    assert.ok(html.includes('Coastal Plain') || html.includes('Coastal'));
  });

  it('includes an approximation disclaimer', () => {
    const html = makeFallLinePopup();
    assert.ok(
      html.toLowerCase().includes('approximate'),
      'popup should note that the path is approximate'
    );
  });

  it('wraps content in popup-content div', () => {
    assert.ok(makeFallLinePopup().includes('class="popup-content"'));
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 8 — haversineKm utility
   ═══════════════════════════════════════════════════════════════ */

describe('haversineKm()', () => {
  it('returns 0 for identical points', () => {
    const p = [-77.46, 37.53];
    assert.ok(haversineKm(p, p) < 0.001, 'distance from a point to itself should be ~0');
  });

  it('Richmond → Washington DC is approximately 150–175 km (straight line)', () => {
    const richmond     = [-77.436, 37.541];
    const washingtonDC = [-77.036, 38.907];
    const dist = haversineKm(richmond, washingtonDC);
    // Straight-line haversine is ~155–156 km; road distance is ~170 km.
    // Test verifies the function is in the right order of magnitude.
    assert.ok(dist >= 145 && dist <= 180,
      `Richmond to DC straight line should be ~155 km, got ${dist.toFixed(1)} km`);
  });

  it('is symmetric (A→B equals B→A)', () => {
    const a = [-77.46, 37.53];
    const b = [-77.25, 37.65];
    assert.ok(
      Math.abs(haversineKm(a, b) - haversineKm(b, a)) < 0.001,
      'haversine should be symmetric'
    );
  });

  it('returns a positive number for distinct points', () => {
    const dist = haversineKm([-77.46, 37.53], [-77.25, 37.65]);
    assert.ok(dist > 0);
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 9 — BBOX sanity
   ═══════════════════════════════════════════════════════════════ */

describe('BBOX constants', () => {
  it('NORTH > SOUTH', () => {
    assert.ok(BBOX.NORTH > BBOX.SOUTH);
  });

  it('EAST > WEST (less negative = more east)', () => {
    assert.ok(BBOX.EAST > BBOX.WEST);
  });

  it('all values are within continental US range', () => {
    assert.ok(BBOX.NORTH > 24 && BBOX.NORTH < 50);
    assert.ok(BBOX.SOUTH > 24 && BBOX.SOUTH < 50);
    assert.ok(BBOX.EAST > -130 && BBOX.EAST < -60);
    assert.ok(BBOX.WEST > -130 && BBOX.WEST < -60);
  });

  it('Richmond, VA coordinates are inside the BBOX', () => {
    const RICHMOND = { lat: 37.5407, lon: -77.4360 };
    assert.ok(RICHMOND.lat >= BBOX.SOUTH && RICHMOND.lat <= BBOX.NORTH,
      'Richmond latitude should be inside BBOX');
    assert.ok(RICHMOND.lon >= BBOX.WEST && RICHMOND.lon <= BBOX.EAST,
      'Richmond longitude should be inside BBOX');
  });

  it('Washington DC coordinates are inside the BBOX', () => {
    const DC = { lat: 38.9072, lon: -77.0369 };
    assert.ok(DC.lat >= BBOX.SOUTH && DC.lat <= BBOX.NORTH,
      'Washington DC latitude should be inside BBOX');
    assert.ok(DC.lon >= BBOX.WEST && DC.lon <= BBOX.EAST,
      'Washington DC longitude should be inside BBOX');
  });

  it('Raleigh, NC coordinates are inside the BBOX', () => {
    const RALEIGH = { lat: 35.7796, lon: -78.6382 };
    assert.ok(RALEIGH.lat >= BBOX.SOUTH && RALEIGH.lat <= BBOX.NORTH,
      'Raleigh latitude should be inside BBOX');
    assert.ok(RALEIGH.lon >= BBOX.WEST && RALEIGH.lon <= BBOX.EAST,
      'Raleigh longitude should be inside BBOX');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 11 — Hardiness zone color mapping
   ═══════════════════════════════════════════════════════════════ */

describe('HARDINESS_ZONE_COLORS', () => {
  it('covers all zones present in the full corridor (5a through 9a)', () => {
    const corridorZones = ['5a','5b','6a','6b','7a','7b','8a','8b','9a'];
    for (const zone of corridorZones) {
      assert.ok(zone in HARDINESS_ZONE_COLORS,
        `HARDINESS_ZONE_COLORS should include zone ${zone}`);
    }
  });

  it('all colors are valid CSS hex values', () => {
    for (const [zone, color] of Object.entries(HARDINESS_ZONE_COLORS)) {
      assert.match(color, /^#[0-9A-Fa-f]{6}$/,
        `Zone ${zone} color "${color}" is not a valid 6-char hex color`);
    }
  });

  it('warmer zones (8b) have a warmer/yellower color than cooler zones (5a)', () => {
    // Parse hex to RGB and check that 8b has more red than 5a
    function hexToRgb(hex) {
      return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
      };
    }
    const cool = hexToRgb(HARDINESS_ZONE_COLORS['5a']);
    const warm = hexToRgb(HARDINESS_ZONE_COLORS['8b']);
    // Warm zones should have higher red channel than cool zones
    assert.ok(warm.r > cool.r,
      'Zone 8b should have more red than zone 5a (warmer visual temperature)');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 12 — getZoneColor()
   ═══════════════════════════════════════════════════════════════ */

describe('getZoneColor()', () => {
  it('returns correct color for zone 7b (Richmond fall line zone)', () => {
    const color = getZoneColor('7b');
    assert.equal(color, HARDINESS_ZONE_COLORS['7b']);
  });

  it('returns a valid hex color for all corridor zones (5a–9a)', () => {
    const corridorZones = ['5a','5b','6a','6b','7a','7b','8a','8b','9a'];
    for (const zone of corridorZones) {
      assert.match(getZoneColor(zone), /^#[0-9A-Fa-f]{6}$/,
        `getZoneColor('${zone}') should return a hex color`);
    }
  });

  it('returns a fallback grey for unknown zones', () => {
    const fallback = getZoneColor('99z');
    assert.match(fallback, /^#[0-9A-Fa-f]{6}$/,
      'should return a valid hex color even for unknown zones');
  });

  it('returns different colors for different zones', () => {
    assert.notEqual(getZoneColor('6a'), getZoneColor('8b'),
      'different zones should have different colors');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 13 — getZoneInfo()
   ═══════════════════════════════════════════════════════════════ */

describe('getZoneInfo()', () => {
  it('returns an object with tempRange and description', () => {
    const info = getZoneInfo('7b');
    assert.ok(typeof info.tempRange === 'string' && info.tempRange.length > 0);
    assert.ok(typeof info.description === 'string' && info.description.length > 0);
  });

  it('tempRange for zone 7b mentions Richmond or fall line', () => {
    // Zone 7b is the primary Richmond zone — description should reference it
    const info = getZoneInfo('7b');
    assert.ok(
      info.description.toLowerCase().includes('richmond') ||
      info.description.toLowerCase().includes('fall line'),
      'Zone 7b description should mention Richmond or the fall line'
    );
  });

  it('returns a safe fallback for unknown zones', () => {
    const info = getZoneInfo('99z');
    assert.ok(typeof info.tempRange === 'string');
    assert.ok(typeof info.description === 'string');
  });

  it('all corridor zone infos contain a degree symbol in tempRange (5a–9a)', () => {
    const corridorZones = ['5a','5b','6a','6b','7a','7b','8a','8b','9a'];
    for (const zone of corridorZones) {
      const info = getZoneInfo(zone);
      assert.ok(info.tempRange.includes('°'),
        `Zone ${zone} tempRange should contain a degree symbol`);
    }
  });

  it('zone 9a description references coastal SC/GA climate', () => {
    const info = getZoneInfo('9a');
    assert.ok(
      info.description.toLowerCase().includes('coastal') ||
      info.description.toLowerCase().includes('georgia') ||
      info.description.toLowerCase().includes('subtropical'),
      'Zone 9a description should reference the coastal/subtropical climate'
    );
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 14 — makeZonePopup()
   ═══════════════════════════════════════════════════════════════ */

describe('makeZonePopup()', () => {
  it('returns a string', () => {
    assert.equal(typeof makeZonePopup('7b'), 'string');
  });

  it('contains the zone identifier', () => {
    assert.ok(makeZonePopup('7b').includes('7b'));
  });

  it('contains the word Zone', () => {
    assert.ok(makeZonePopup('7b').toLowerCase().includes('zone'));
  });

  it('wraps content in popup-content div', () => {
    assert.ok(makeZonePopup('7b').includes('class="popup-content"'));
  });

  it('produces different output for different zones', () => {
    assert.notEqual(makeZonePopup('6a'), makeZonePopup('8b'));
  });

  it('includes temperature range', () => {
    const html = makeZonePopup('7b');
    assert.ok(html.includes('°'), 'popup should include temperature with degree symbol');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 15 — isValidUSZipCode()
   ═══════════════════════════════════════════════════════════════ */

describe('isValidUSZipCode()', () => {
  it('returns true for a valid 5-digit zip (Richmond 23219)', () => {
    assert.equal(isValidUSZipCode('23219'), true);
  });

  it('returns true for a valid 5-digit zip (Raleigh 27601)', () => {
    assert.equal(isValidUSZipCode('27601'), true);
  });

  it('returns true for a valid 5-digit zip (DC 20001)', () => {
    assert.equal(isValidUSZipCode('20001'), true);
  });

  it('returns false for a 4-digit string', () => {
    assert.equal(isValidUSZipCode('1234'), false);
  });

  it('returns false for a 6-digit string', () => {
    assert.equal(isValidUSZipCode('123456'), false);
  });

  it('returns false for letters', () => {
    assert.equal(isValidUSZipCode('abcde'), false);
  });

  it('returns false for mixed alphanumeric', () => {
    assert.equal(isValidUSZipCode('2321a'), false);
  });

  it('returns false for zip+4 format', () => {
    assert.equal(isValidUSZipCode('23219-1234'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isValidUSZipCode(''), false);
  });

  it('trims leading/trailing whitespace before checking', () => {
    assert.equal(isValidUSZipCode('  23219  '), true);
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 16 — isInCorridor()
   ═══════════════════════════════════════════════════════════════ */

describe('isInCorridor()', () => {
  it('returns true for Richmond, VA (37.54, -77.44)', () => {
    assert.equal(isInCorridor(37.54, -77.44), true);
  });

  it('returns true for Raleigh, NC (35.78, -78.64)', () => {
    assert.equal(isInCorridor(35.78, -78.64), true);
  });

  it('returns true for Washington, DC (38.90, -77.04)', () => {
    assert.equal(isInCorridor(38.90, -77.04), true);
  });

  it('returns true for Fredericksburg, VA (38.30, -77.47)', () => {
    assert.equal(isInCorridor(38.30, -77.47), true);
  });

  it('returns true for Philadelphia, PA (39.95, -75.16)', () => {
    assert.equal(isInCorridor(39.95, -75.16), true);
  });

  it('returns true for New Brunswick, NJ (40.49, -74.45)', () => {
    assert.equal(isInCorridor(40.49, -74.45), true);
  });

  it('returns true for Paterson, NJ (40.92, -74.17)', () => {
    assert.equal(isInCorridor(40.92, -74.17), true);
  });

  it('returns true for Peekskill, NY (41.29, -73.92)', () => {
    assert.equal(isInCorridor(41.29, -73.92), true);
  });

  it('returns true for Columbia, SC (34.00, -81.03)', () => {
    assert.equal(isInCorridor(34.00, -81.03), true);
  });

  it('returns true for Augusta, GA (33.47, -82.02)', () => {
    assert.equal(isInCorridor(33.47, -82.02), true);
  });

  it('returns true for Macon, GA (32.84, -83.63)', () => {
    assert.equal(isInCorridor(32.84, -83.63), true);
  });

  it('returns true for Columbus, GA (32.46, -84.99)', () => {
    assert.equal(isInCorridor(32.46, -84.99), true);
  });

  it('returns true for Boston, MA (42.36, -71.06) — within expanded NE corridor', () => {
    assert.equal(isInCorridor(42.36, -71.06), true);
  });

  it('returns false for Bar Harbor, ME (44.38, -68.20) — east of corridor (beyond -69.5°W)', () => {
    assert.equal(isInCorridor(44.38, -68.20), false);
  });

  it('returns false for Louisville, KY (38.25, -85.76) — west of corridor', () => {
    assert.equal(isInCorridor(38.25, -85.76), false);
  });

  it('returns false for Jacksonville, FL (30.33, -81.66) — south of corridor', () => {
    assert.equal(isInCorridor(30.33, -81.66), false);
  });

  it('returns false for Miami, FL (25.77, -80.19) — south of corridor', () => {
    assert.equal(isInCorridor(25.77, -80.19), false);
  });

  it('uses BBOX.NORTH/SOUTH/EAST/WEST boundaries (inclusive)', () => {
    // Exactly on the boundary should be inside
    assert.equal(isInCorridor(BBOX.NORTH, BBOX.EAST), true);
    assert.equal(isInCorridor(BBOX.SOUTH, BBOX.WEST), true);
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 17 — buildSearchQuery()
   ═══════════════════════════════════════════════════════════════ */

describe('buildSearchQuery()', () => {
  it('returns a string for a zip code input', () => {
    assert.equal(typeof buildSearchQuery('23219'), 'string');
  });

  it('returns a string for a city name input', () => {
    assert.equal(typeof buildSearchQuery('Richmond VA'), 'string');
  });

  it('zip code uses postalcode= parameter', () => {
    const url = buildSearchQuery('23219');
    assert.ok(url.includes('postalcode=23219'), `expected postalcode=23219 in: ${url}`);
  });

  it('city name uses q= parameter', () => {
    const url = buildSearchQuery('Richmond VA');
    assert.ok(url.includes('q='), `expected q= parameter in: ${url}`);
  });

  it('always targets Nominatim domain', () => {
    const zip  = buildSearchQuery('23219');
    const city = buildSearchQuery('Raleigh NC');
    assert.ok(zip.includes('nominatim.openstreetmap.org'), 'zip URL should use Nominatim');
    assert.ok(city.includes('nominatim.openstreetmap.org'), 'city URL should use Nominatim');
  });

  it('always requests JSON format', () => {
    assert.ok(buildSearchQuery('23219').includes('format=json'));
    assert.ok(buildSearchQuery('Raleigh NC').includes('format=json'));
  });

  it('always limits to 1 result', () => {
    assert.ok(buildSearchQuery('23219').includes('limit=1'));
    assert.ok(buildSearchQuery('Raleigh NC').includes('limit=1'));
  });

  it('always restricts to US (countrycodes=us)', () => {
    assert.ok(buildSearchQuery('23219').includes('countrycodes=us'));
    assert.ok(buildSearchQuery('Raleigh NC').includes('countrycodes=us'));
  });

  it('encodes special characters in city names', () => {
    const url = buildSearchQuery('Washington, DC');
    assert.ok(!url.includes(' '), 'URL should not contain raw spaces');
  });

  it('trims whitespace from input before building URL', () => {
    const url = buildSearchQuery('  23219  ');
    assert.ok(url.includes('postalcode=23219'), 'should trim whitespace before checking zip');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 18 — FALL_LINE_CITIES and makeMarkerPopup()
   ═══════════════════════════════════════════════════════════════ */

describe('FALL_LINE_CITIES and makeMarkerPopup()', () => {
  it('FALL_LINE_CITIES is an array', () => {
    assert.ok(Array.isArray(FALL_LINE_CITIES));
  });

  it('has at least 12 cities', () => {
    assert.ok(
      FALL_LINE_CITIES.length >= 12,
      `expected ≥12 cities, got ${FALL_LINE_CITIES.length}`
    );
  });

  it('each city has all required fields', () => {
    const required = ['name', 'state', 'lat', 'lon', 'river', 'note', 'soil', 'region', 'zone'];
    for (const city of FALL_LINE_CITIES) {
      for (const field of required) {
        assert.ok(
          city[field] !== undefined && city[field] !== '',
          `${city.name} missing required field: ${field}`
        );
      }
    }
  });

  it('all city latitudes are within the eastern US (including New England)', () => {
    for (const city of FALL_LINE_CITIES) {
      assert.ok(
        city.lat >= 32.0 && city.lat <= 45.0,
        `${city.name} lat ${city.lat} outside [32, 45]`
      );
    }
  });

  it('all city longitudes are within the eastern US', () => {
    for (const city of FALL_LINE_CITIES) {
      assert.ok(
        city.lon >= -86.0 && city.lon <= -69.0,
        `${city.name} lon ${city.lon} outside [-86, -69]`
      );
    }
  });

  it('all city regions are valid ecoregion keys', () => {
    const valid = new Set(['piedmont', 'coastal', 'blueRidge']);
    for (const city of FALL_LINE_CITIES) {
      assert.ok(
        valid.has(city.region),
        `${city.name} has invalid region: ${city.region}`
      );
    }
  });

  it('all cities are within the corridor BBOX', () => {
    for (const city of FALL_LINE_CITIES) {
      assert.ok(
        isInCorridor(city.lat, city.lon),
        `${city.name} (${city.lat}, ${city.lon}) is outside the corridor BBOX`
      );
    }
  });

  it('Richmond is present with correct data', () => {
    const richmond = FALL_LINE_CITIES.find(c => c.name === 'Richmond');
    assert.ok(richmond, 'Richmond not found in FALL_LINE_CITIES');
    assert.strictEqual(richmond.state, 'VA');
    assert.strictEqual(richmond.zone, '7b');
    assert.strictEqual(richmond.region, 'piedmont');
    assert.ok(richmond.river.includes('James'), 'Richmond river should be the James');
  });

  it('Columbus GA is present and is piedmont zone 8b', () => {
    const columbus = FALL_LINE_CITIES.find(c => c.name === 'Columbus' && c.state === 'GA');
    assert.ok(columbus, 'Columbus GA not found');
    assert.strictEqual(columbus.zone, '8b');
    assert.strictEqual(columbus.region, 'piedmont');
  });

  it('Peekskill NY is present in the city list', () => {
    const peekskill = FALL_LINE_CITIES.find(c => c.name === 'Peekskill');
    assert.ok(peekskill, 'Peekskill not found');
    assert.strictEqual(peekskill.state, 'NY');
  });

  it('Augusta ME is the northernmost city (New England expansion)', () => {
    const augusta = FALL_LINE_CITIES.find(c => c.name === 'Augusta' && c.state === 'ME');
    assert.ok(augusta, 'Augusta ME not found');
    const maxLat = Math.max(...FALL_LINE_CITIES.map(c => c.lat));
    assert.strictEqual(augusta.lat, maxLat, 'Augusta ME should have the highest latitude');
  });

  it('makeMarkerPopup() returns a non-empty string', () => {
    const city = FALL_LINE_CITIES.find(c => c.name === 'Richmond');
    const html = makeMarkerPopup(city);
    assert.strictEqual(typeof html, 'string');
    assert.ok(html.length > 0);
  });

  it('popup contains city name and state', () => {
    const city = FALL_LINE_CITIES.find(c => c.name === 'Richmond');
    const html = makeMarkerPopup(city);
    assert.ok(html.includes('Richmond'), 'popup missing city name');
    assert.ok(html.includes('VA'), 'popup missing state');
  });

  it('popup contains river name', () => {
    const city = FALL_LINE_CITIES.find(c => c.name === 'Richmond');
    const html = makeMarkerPopup(city);
    assert.ok(html.includes('James River'), 'popup missing river name');
  });

  it('popup contains soil info', () => {
    const city = FALL_LINE_CITIES.find(c => c.name === 'Richmond');
    const html = makeMarkerPopup(city);
    assert.ok(html.includes('Cecil'), 'popup missing soil series');
  });

  it('popup contains zone badge', () => {
    const city = FALL_LINE_CITIES.find(c => c.name === 'Richmond');
    const html = makeMarkerPopup(city);
    assert.ok(html.includes('7b'), 'popup missing zone');
    assert.ok(html.includes('zone-badge'), 'popup missing zone-badge class');
  });

  it('popup contains region badge with correct class', () => {
    const richmond = FALL_LINE_CITIES.find(c => c.name === 'Richmond');
    const htmlR = makeMarkerPopup(richmond);
    assert.ok(htmlR.includes('city-region-badge piedmont'), 'Richmond popup missing piedmont badge');

    const dc = FALL_LINE_CITIES.find(c => c.name === 'Washington');
    const htmlDC = makeMarkerPopup(dc);
    assert.ok(htmlDC.includes('city-region-badge coastal'), 'DC popup missing coastal badge');
  });

  it('popup contains founding note text', () => {
    const city = FALL_LINE_CITIES.find(c => c.name === 'Richmond');
    const html = makeMarkerPopup(city);
    assert.ok(html.includes('Belle Isle') || html.includes('James'), 'popup missing founding note');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 19 — NATIVE_PLANTS and makeNativePlantsSection()
   ═══════════════════════════════════════════════════════════════ */

describe('NATIVE_PLANTS and makeNativePlantsSection()', () => {
  it('NATIVE_PLANTS has keys: piedmont, coastal, ecotone', () => {
    for (const key of ['piedmont', 'coastal', 'ecotone']) {
      assert.ok(key in NATIVE_PLANTS, `NATIVE_PLANTS missing key: ${key}`);
    }
  });

  it('each ecoregion list is a non-empty array', () => {
    for (const key of ['piedmont', 'coastal', 'ecotone']) {
      assert.ok(Array.isArray(NATIVE_PLANTS[key]), `${key} should be an array`);
      assert.ok(NATIVE_PLANTS[key].length > 0, `${key} plants list should not be empty`);
    }
  });

  it('every plant entry has required string fields: name, latin, type, note', () => {
    for (const [region, plants] of Object.entries(NATIVE_PLANTS)) {
      for (const plant of plants) {
        for (const field of ['name', 'latin', 'type', 'note']) {
          assert.ok(
            typeof plant[field] === 'string' && plant[field].length > 0,
            `${region} plant "${plant.name || '?'}" missing field: ${field}`
          );
        }
      }
    }
  });

  it('all latin names contain a space (genus + species format)', () => {
    for (const [region, plants] of Object.entries(NATIVE_PLANTS)) {
      for (const plant of plants) {
        assert.ok(
          plant.latin.includes(' '),
          `${region} plant "${plant.name}" latin name "${plant.latin}" should be genus species`
        );
      }
    }
  });

  it('type field is one of the expected values', () => {
    const valid = new Set(['tree', 'shrub', 'perennial', 'grass', 'fern']);
    for (const [region, plants] of Object.entries(NATIVE_PLANTS)) {
      for (const plant of plants) {
        assert.ok(
          valid.has(plant.type),
          `${region} plant "${plant.name}" has unexpected type "${plant.type}"`
        );
      }
    }
  });

  it('piedmont list includes a tree (expected dominant canopy species)', () => {
    const trees = NATIVE_PLANTS.piedmont.filter(p => p.type === 'tree');
    assert.ok(trees.length > 0, 'Piedmont should have at least one tree entry');
  });

  it('coastal list includes Loblolly Pine (dominant Coastal Plain tree)', () => {
    const loblolly = NATIVE_PLANTS.coastal.find(p => p.latin === 'Pinus taeda');
    assert.ok(loblolly, 'Coastal Plain list should include Loblolly Pine (Pinus taeda)');
  });

  it('coastal list includes Bald Cypress (iconic tidal swamp tree)', () => {
    const cypress = NATIVE_PLANTS.coastal.find(p => p.latin === 'Taxodium distichum');
    assert.ok(cypress, 'Coastal Plain list should include Bald Cypress (Taxodium distichum)');
  });

  it('makeNativePlantsSection() returns a non-empty string for each region', () => {
    for (const region of ['piedmont', 'coastal', 'ecotone']) {
      const html = makeNativePlantsSection(region);
      assert.ok(typeof html === 'string' && html.length > 0,
        `makeNativePlantsSection("${region}") should return a non-empty string`);
    }
  });

  it('makeNativePlantsSection() returns empty string for unknown region', () => {
    assert.equal(makeNativePlantsSection('unknown'), '');
    assert.equal(makeNativePlantsSection(''), '');
  });

  it('makeNativePlantsSection("piedmont") contains plant names and latin names', () => {
    const html = makeNativePlantsSection('piedmont');
    assert.ok(html.includes('class="plant-name"'), 'missing plant-name class');
    assert.ok(html.includes('class="plant-latin"'), 'missing plant-latin class');
    const firstPlant = NATIVE_PLANTS.piedmont[0];
    assert.ok(html.includes(firstPlant.name), `missing plant name "${firstPlant.name}"`);
    assert.ok(html.includes(firstPlant.latin), `missing latin name "${firstPlant.latin}"`);
  });

  it('makeNativePlantsSection() wraps output in plant-section div', () => {
    const html = makeNativePlantsSection('coastal');
    assert.ok(html.includes('class="plant-section"'), 'missing plant-section wrapper');
    assert.ok(html.includes('class="plant-section-header"'), 'missing plant-section-header');
    assert.ok(html.includes('class="plant-list"'), 'missing plant-list');
  });

  it('makeRegionPopup() output includes plant-section for both regions', () => {
    const coastalHtml  = makeRegionPopup(COASTAL_PLAIN_GEOJSON.properties);
    const piedmontHtml = makeRegionPopup(PIEDMONT_GEOJSON.properties);
    assert.ok(coastalHtml.includes('class="plant-section"'),
      'Coastal Plain popup should include native plants section');
    assert.ok(piedmontHtml.includes('class="plant-section"'),
      'Piedmont popup should include native plants section');
  });

  it('makeFallLinePopup() output includes ecotone plants section', () => {
    const html = makeFallLinePopup();
    assert.ok(html.includes('class="plant-section"'),
      'Fall line popup should include ecotone native plants section');
    const witchHazel = NATIVE_PLANTS.ecotone.find(p => p.latin === 'Hamamelis virginiana');
    assert.ok(witchHazel && html.includes(witchHazel.name),
      'Fall line popup should include Witch-Hazel');
  });

  it('region popups include plants from correct ecoregion (not cross-contaminated)', () => {
    const coastalHtml  = makeRegionPopup(COASTAL_PLAIN_GEOJSON.properties);
    const piedmontHtml = makeRegionPopup(PIEDMONT_GEOJSON.properties);
    const loblolly = NATIVE_PLANTS.coastal.find(p => p.latin === 'Pinus taeda');
    const postOak  = NATIVE_PLANTS.piedmont.find(p => p.name === 'Post Oak');
    assert.ok(coastalHtml.includes(loblolly.name),
      'Coastal Plain popup should contain Loblolly Pine');
    assert.ok(!piedmontHtml.includes(loblolly.name),
      'Piedmont popup should NOT contain Loblolly Pine');
    assert.ok(piedmontHtml.includes(postOak.name),
      'Piedmont popup should contain Post Oak');
    assert.ok(!coastalHtml.includes(postOak.name),
      'Coastal Plain popup should NOT contain Post Oak');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 20 — SOIL_TYPES and makeSoilSection()
   ═══════════════════════════════════════════════════════════════ */

describe('SOIL_TYPES and makeSoilSection()', () => {
  it('SOIL_TYPES has keys: piedmont, coastal, ecotone', () => {
    for (const key of ['piedmont', 'coastal', 'ecotone']) {
      assert.ok(key in SOIL_TYPES, `SOIL_TYPES missing key: ${key}`);
    }
  });

  it('every soil entry has required string fields: series, texture, pH, drainage, amendments', () => {
    for (const [region, soil] of Object.entries(SOIL_TYPES)) {
      for (const field of ['series', 'texture', 'pH', 'drainage', 'amendments']) {
        assert.ok(
          typeof soil[field] === 'string' && soil[field].length > 0,
          `${region} soil entry missing field: ${field}`
        );
      }
    }
  });

  it('pH fields contain a range separator (dash or en-dash)', () => {
    for (const [region, soil] of Object.entries(SOIL_TYPES)) {
      assert.ok(
        soil.pH.includes('–') || soil.pH.includes('-'),
        `${region} pH should express a range, got: ${soil.pH}`
      );
    }
  });

  it('piedmont soil is clay-based (series mentions Cecil or Appling)', () => {
    const series = SOIL_TYPES.piedmont.series.toLowerCase();
    assert.ok(
      series.includes('cecil') || series.includes('appling'),
      `Piedmont series should mention Cecil or Appling, got: ${SOIL_TYPES.piedmont.series}`
    );
  });

  it('coastal soil is sandy-based (series mentions Norfolk or Goldsboro)', () => {
    const series = SOIL_TYPES.coastal.series.toLowerCase();
    assert.ok(
      series.includes('norfolk') || series.includes('goldsboro'),
      `Coastal series should mention Norfolk or Goldsboro, got: ${SOIL_TYPES.coastal.series}`
    );
  });

  it('makeSoilSection() returns non-empty string for all three regions', () => {
    for (const region of ['piedmont', 'coastal', 'ecotone']) {
      const html = makeSoilSection(region);
      assert.ok(typeof html === 'string' && html.length > 0,
        `makeSoilSection("${region}") should return non-empty string`);
    }
  });

  it('makeSoilSection() returns empty string for unknown region', () => {
    assert.equal(makeSoilSection('unknown'), '');
    assert.equal(makeSoilSection(''), '');
  });

  it('makeSoilSection() wraps output in soil-section with soil-facts', () => {
    const html = makeSoilSection('piedmont');
    assert.ok(html.includes('class="soil-section"'), 'missing soil-section wrapper');
    assert.ok(html.includes('class="soil-section-header"'), 'missing soil-section-header');
    assert.ok(html.includes('class="soil-facts"'), 'missing soil-facts container');
    assert.ok(html.includes('class="soil-fact"'), 'missing soil-fact rows');
  });

  it('makeSoilSection() includes all five field labels', () => {
    const html = makeSoilSection('coastal');
    for (const label of ['Series', 'Texture', 'pH', 'Drainage', 'Amend with']) {
      assert.ok(html.includes(label), `soil section missing label: ${label}`);
    }
  });

  it('makeSoilSection("piedmont") contains Cecil in series output', () => {
    const html = makeSoilSection('piedmont');
    assert.ok(html.includes('Cecil'), 'Piedmont soil section should mention Cecil');
  });

  it('makeSoilSection("coastal") contains Norfolk in series output', () => {
    const html = makeSoilSection('coastal');
    assert.ok(html.includes('Norfolk'), 'Coastal soil section should mention Norfolk');
  });

  it('makeRegionPopup() includes soil-section for both regions', () => {
    const coastalHtml  = makeRegionPopup(COASTAL_PLAIN_GEOJSON.properties);
    const piedmontHtml = makeRegionPopup(PIEDMONT_GEOJSON.properties);
    assert.ok(coastalHtml.includes('class="soil-section"'),
      'Coastal Plain popup should include soil section');
    assert.ok(piedmontHtml.includes('class="soil-section"'),
      'Piedmont popup should include soil section');
  });

  it('makeFallLinePopup() includes ecotone soil section', () => {
    const html = makeFallLinePopup();
    assert.ok(html.includes('class="soil-section"'),
      'Fall line popup should include ecotone soil section');
    assert.ok(html.includes(SOIL_TYPES.ecotone.series),
      'Fall line popup should include ecotone series name');
  });

  it('region soil sections contain correct series (not cross-contaminated)', () => {
    const coastalHtml  = makeRegionPopup(COASTAL_PLAIN_GEOJSON.properties);
    const piedmontHtml = makeRegionPopup(PIEDMONT_GEOJSON.properties);
    assert.ok(coastalHtml.includes('Norfolk'),
      'Coastal Plain popup should contain Norfolk soil series');
    assert.ok(!piedmontHtml.includes('Norfolk'),
      'Piedmont popup should NOT contain Norfolk soil series');
    assert.ok(piedmontHtml.includes('Cecil'),
      'Piedmont popup should contain Cecil soil series');
    assert.ok(!coastalHtml.includes('Cecil'),
      'Coastal Plain popup should NOT contain Cecil soil series');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 21 — BLUE_RIDGE_GEOJSON structure
   ═══════════════════════════════════════════════════════════════ */

describe('BLUE_RIDGE_GEOJSON structure', () => {
  it('is a GeoJSON Feature', () => {
    assert.equal(BLUE_RIDGE_GEOJSON.type, 'Feature');
  });

  it('has a Polygon geometry', () => {
    assert.equal(BLUE_RIDGE_GEOJSON.geometry.type, 'Polygon');
  });

  it('ring has at least 10 coordinate pairs', () => {
    const ring = BLUE_RIDGE_GEOJSON.geometry.coordinates[0];
    assert.ok(ring.length >= 10, `expected ≥10 points, got ${ring.length}`);
  });

  it('ring is closed (first point equals last point)', () => {
    const ring = BLUE_RIDGE_GEOJSON.geometry.coordinates[0];
    const first = ring[0];
    const last  = ring[ring.length - 1];
    assert.deepEqual(first, last, 'first and last ring points must be identical');
  });

  it('all ring coordinates are valid [lon, lat] pairs in Appalachian bounds', () => {
    const ring = BLUE_RIDGE_GEOJSON.geometry.coordinates[0];
    for (const coord of ring) {
      assert.equal(coord.length, 2, 'each coordinate must have 2 values');
      assert.ok(coord[0] < -77 && coord[0] > -86, `lon ${coord[0]} out of Appalachian range`);
      assert.ok(coord[1] > 34 && coord[1] < 40,   `lat ${coord[1]} out of Appalachian range`);
    }
  });

  it('properties.region is "blueRidge"', () => {
    assert.equal(BLUE_RIDGE_GEOJSON.properties.region, 'blueRidge');
  });

  it('properties.name contains "Blue Ridge"', () => {
    assert.ok(BLUE_RIDGE_GEOJSON.properties.name.includes('Blue Ridge'),
      'name should contain "Blue Ridge"');
  });

  it('properties.description is at least 80 characters', () => {
    assert.ok(BLUE_RIDGE_GEOJSON.properties.description.length >= 80,
      'description too short');
  });

  it('STYLES.blueRidge has fillColor, fillOpacity, weight, interactive', () => {
    const s = STYLES.blueRidge;
    assert.ok(s, 'STYLES.blueRidge must exist');
    assert.ok(typeof s.fillColor === 'string', 'fillColor should be a string');
    assert.equal(s.fillOpacity, 0.18);
    assert.equal(s.weight, 0);
    assert.equal(s.interactive, true);
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 22 — Blue Ridge ecological data
   ═══════════════════════════════════════════════════════════════ */

describe('Blue Ridge ecological data', () => {
  it('NATIVE_PLANTS.blueRidge is an array with at least 4 entries', () => {
    assert.ok(Array.isArray(NATIVE_PLANTS.blueRidge), 'blueRidge plants should be an array');
    assert.ok(NATIVE_PLANTS.blueRidge.length >= 4,
      `expected ≥4 plants, got ${NATIVE_PLANTS.blueRidge.length}`);
  });

  it('each Blue Ridge plant has name, latin, type, note fields', () => {
    for (const p of NATIVE_PLANTS.blueRidge) {
      assert.ok(typeof p.name  === 'string' && p.name.length  > 0, 'plant must have name');
      assert.ok(typeof p.latin === 'string' && p.latin.length > 0, 'plant must have latin');
      assert.ok(typeof p.type  === 'string' && p.type.length  > 0, 'plant must have type');
      assert.ok(typeof p.note  === 'string' && p.note.length  > 0, 'plant must have note');
    }
  });

  it('Fraser Fir is in the Blue Ridge plant list', () => {
    const fir = NATIVE_PLANTS.blueRidge.find(p => p.name === 'Fraser Fir');
    assert.ok(fir, 'Fraser Fir not found in blueRidge plants');
    assert.ok(fir.latin.includes('Abies'), 'Fraser Fir latin should start with Abies');
  });

  it('SOIL_TYPES.blueRidge has all 5 required fields', () => {
    const s = SOIL_TYPES.blueRidge;
    assert.ok(s, 'SOIL_TYPES.blueRidge must exist');
    for (const field of ['series', 'texture', 'pH', 'drainage', 'amendments']) {
      assert.ok(typeof s[field] === 'string' && s[field].length > 0,
        `blueRidge soil must have '${field}'`);
    }
  });

  it('SOIL_TYPES.blueRidge.series contains "Ramsey"', () => {
    assert.ok(SOIL_TYPES.blueRidge.series.includes('Ramsey'),
      'Blue Ridge soil series should include Ramsey');
  });

  it('makeNativePlantsSection("blueRidge") returns non-empty HTML', () => {
    const html = makeNativePlantsSection('blueRidge');
    assert.ok(html.length > 50, 'blueRidge plant section should be non-trivial HTML');
    assert.ok(html.includes('Fraser Fir'), 'should include Fraser Fir');
  });

  it('makeSoilSection("blueRidge") returns non-empty HTML', () => {
    const html = makeSoilSection('blueRidge');
    assert.ok(html.length > 50, 'blueRidge soil section should be non-trivial HTML');
    assert.ok(html.includes('Ramsey'), 'should include Ramsey series');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 23 — Appalachian city markers
   ═══════════════════════════════════════════════════════════════ */

describe('Appalachian city markers', () => {
  it('total city count is at least 20 (original 15 + 6 Appalachian)', () => {
    assert.ok(FALL_LINE_CITIES.length >= 20,
      `expected ≥20 cities, got ${FALL_LINE_CITIES.length}`);
  });

  it('Asheville NC is present with correct data', () => {
    const city = FALL_LINE_CITIES.find(c => c.name === 'Asheville');
    assert.ok(city, 'Asheville not found');
    assert.equal(city.state, 'NC');
    assert.equal(city.region, 'blueRidge');
    assert.ok(city.river.includes('French Broad'), 'river should be French Broad');
  });

  it('Chattanooga TN is present with correct data', () => {
    const city = FALL_LINE_CITIES.find(c => c.name === 'Chattanooga');
    assert.ok(city, 'Chattanooga not found');
    assert.equal(city.state, 'TN');
    assert.equal(city.region, 'blueRidge');
    assert.ok(city.river.includes('Tennessee'), 'river should be Tennessee');
  });

  it('all new Appalachian cities are within the expanded BBOX', () => {
    const appalachian = ['Charlottesville', 'Staunton', 'Roanoke', 'Asheville', 'Greenville', 'Chattanooga'];
    for (const name of appalachian) {
      const city = FALL_LINE_CITIES.find(c => c.name === name);
      assert.ok(city, `${name} not found in FALL_LINE_CITIES`);
      assert.ok(isInCorridor(city.lat, city.lon),
        `${name} (${city.lat}, ${city.lon}) is outside the corridor BBOX`);
    }
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 24 — Detail page HTML generators
   ═══════════════════════════════════════════════════════════════ */

describe('Detail page HTML generators', () => {
  it('makeRegionDetailHTML("piedmont") returns article with title and plants', () => {
    const html = makeRegionDetailHTML('piedmont');
    assert.ok(html.includes('<article'), 'should return an article element');
    assert.ok(html.includes('Piedmont'), 'should include region name');
    assert.ok(html.includes('plant-section'), 'should include plant section');
    assert.ok(html.includes('soil-section'), 'should include soil section');
  });

  it('makeRegionDetailHTML("piedmont") includes Piedmont orange color accent', () => {
    const html = makeRegionDetailHTML('piedmont');
    assert.ok(html.includes('#c88232'), 'Piedmont detail should have orange accent');
    assert.ok(html.includes('border-left'), 'should have a left-border accent');
  });

  it('makeRegionDetailHTML("coastal") includes coastal blue color accent', () => {
    const html = makeRegionDetailHTML('coastal');
    assert.ok(html.includes('#4682dc'), 'Coastal detail should have blue accent');
  });

  it('makeRegionDetailHTML("blueRidge") includes forest green color accent', () => {
    const html = makeRegionDetailHTML('blueRidge');
    assert.ok(html.includes('#4a7c59'), 'Blue Ridge detail should have green accent');
  });

  it('makeRegionDetailHTML("coastal") includes Coastal Plain content', () => {
    const html = makeRegionDetailHTML('coastal');
    assert.ok(html.includes('Coastal Plain'), 'should include Coastal Plain');
    assert.ok(html.includes('Loblolly'), 'should include Loblolly Pine');
  });

  it('makeRegionDetailHTML("blueRidge") includes Blue Ridge content', () => {
    const html = makeRegionDetailHTML('blueRidge');
    assert.ok(html.includes('Blue Ridge'), 'should include Blue Ridge');
    assert.ok(html.includes('Fraser Fir'), 'should include Fraser Fir');
    assert.ok(html.includes('Ramsey'), 'should include Ramsey soil series');
  });

  it('makeRegionDetailHTML() returns empty string for unknown region', () => {
    const html = makeRegionDetailHTML('unknown-region');
    assert.equal(html, '', 'unknown region should return empty string');
  });

  it('makeFallLineDetailHTML() returns article with fall line content', () => {
    const html = makeFallLineDetailHTML();
    assert.ok(html.includes('<article'), 'should return an article element');
    assert.ok(html.includes('Fall Line'), 'should include Fall Line title');
    assert.ok(html.includes('ecotone') || html.includes('Witch-Hazel'),
      'should include ecotone plant data');
  });

  it('makeZoneDetailHTML("7b") returns article with zone data', () => {
    const html = makeZoneDetailHTML('7b');
    assert.ok(html.includes('<article'), 'should return an article element');
    assert.ok(html.includes('Zone 7b'), 'should include zone identifier');
    assert.ok(html.includes('frost'), 'should include frost information');
  });

  it('makeZoneDetailHTML uses correct zone color in inline style', () => {
    const html = makeZoneDetailHTML('7b');
    const color = getZoneColor('7b');
    assert.ok(html.includes(color), 'should include the zone color');
  });

  it('makeCityDetailHTML("richmond-va") returns Richmond article', () => {
    const html = makeCityDetailHTML('richmond-va');
    assert.ok(html.includes('<article'), 'should return an article element');
    assert.ok(html.includes('Richmond'), 'should include city name');
    assert.ok(html.includes('James River'), 'should include James River');
    assert.ok(html.includes('Zone 7b'), 'should include hardiness zone');
  });

  it('makeCityDetailHTML("asheville-nc") returns Asheville article', () => {
    const html = makeCityDetailHTML('asheville-nc');
    assert.ok(html.includes('Asheville'), 'should include city name');
    assert.ok(html.includes('French Broad'), 'should include river name');
    assert.ok(html.includes('Blue Ridge'), 'should include Blue Ridge region label');
  });

  it('makeCityDetailHTML includes native plants for the city region', () => {
    // Richmond is piedmont — should show Post Oak or similar piedmont plants
    const richmond = makeCityDetailHTML('richmond-va');
    assert.ok(richmond.includes('plant-section'), 'Richmond detail should include plant section');
    // Asheville is blueRidge — should show Fraser Fir or similar Blue Ridge plants
    const asheville = makeCityDetailHTML('asheville-nc');
    assert.ok(asheville.includes('Fraser Fir'), 'Asheville detail should include Fraser Fir (blueRidge plant)');
  });

  it('makeCityDetailHTML includes region color accent (border-left)', () => {
    const richmond = makeCityDetailHTML('richmond-va');
    assert.ok(richmond.includes('#c88232'), 'Piedmont city should have orange accent');
    const asheville = makeCityDetailHTML('asheville-nc');
    assert.ok(asheville.includes('#4a7c59'), 'Blue Ridge city should have green accent');
  });

  it('makeCityDetailHTML() returns empty string for unknown slug', () => {
    const html = makeCityDetailHTML('nowhere-xx');
    assert.equal(html, '', 'unknown slug should return empty string');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 25 — classifyLocation and makeLocationReport
   ═══════════════════════════════════════════════════════════════ */

describe('classifyLocation and makeLocationReport', () => {
  it('classifies Virginia Beach as coastal (east of fall line)', () => {
    // Virginia Beach: 36.85°N, -75.98°W — well east of fall line (~-77.8°W at this lat)
    assert.equal(classifyLocation(36.85, -75.98), 'coastal');
  });

  it('classifies Charlottesville VA as piedmont (clearly west of fall line)', () => {
    // Charlottesville: 38.03°N, -78.48°W — fall line near 38°N is ~-77.5°W
    assert.equal(classifyLocation(38.03, -78.48), 'piedmont');
  });

  it('classifies Asheville NC as blueRidge (far west of fall line)', () => {
    // Asheville: 35.58°N, -82.55°W — far west of fall line (~-79.3°W at this lat)
    assert.equal(classifyLocation(35.58, -82.55), 'blueRidge');
  });

  it('makeLocationReport returns an article element', () => {
    const html = makeLocationReport(38.03, -78.48);
    assert.ok(html.includes('<article'), 'should return an article element');
    assert.ok(html.includes('Location Report'), 'should include report header');
  });

  it('makeLocationReport includes soil and plant sections', () => {
    const html = makeLocationReport(38.03, -78.48);
    assert.ok(html.includes('plant-section'), 'should include plant section');
    assert.ok(html.includes('soil-section'), 'should include soil section');
  });

  it('makeLocationReport for coastal location includes Norfolk soil', () => {
    const html = makeLocationReport(36.85, -75.98);
    assert.ok(html.includes('Norfolk'), 'coastal report should include Norfolk soil series');
  });

  it('makeLocationReport for Blue Ridge location includes Ramsey soil', () => {
    const html = makeLocationReport(35.58, -82.55);
    assert.ok(html.includes('Ramsey'), 'Blue Ridge report should include Ramsey soil series');
  });

  it('makeLocationReport includes nearest city', () => {
    // Charlottesville VA — nearest city should be Charlottesville itself
    const html = makeLocationReport(38.03, -78.48);
    assert.ok(html.includes('Nearest city'), 'report should include nearest city label');
    assert.ok(html.includes('km'), 'report should include distance in km');
  });

  it('makeLocationReport nearest city for Richmond area is Richmond', () => {
    // Coordinates very close to Richmond VA (37.527, -77.464)
    const html = makeLocationReport(37.53, -77.46);
    assert.ok(html.includes('Richmond'), 'nearest city near Richmond should be Richmond');
  });

  it('makeLocationReport includes region color accent', () => {
    const piedmontHtml = makeLocationReport(38.03, -78.48);
    assert.ok(piedmontHtml.includes('#c88232'), 'Piedmont location report should have orange accent');
    const coastalHtml  = makeLocationReport(36.85, -75.98);
    assert.ok(coastalHtml.includes('#4682dc'), 'Coastal location report should have blue accent');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 26 — NE_FALL_ZONE_GEOJSON structure
   ═══════════════════════════════════════════════════════════════ */

describe('NE_FALL_ZONE_GEOJSON structure', () => {
  it('is a GeoJSON Feature', () => {
    assert.equal(NE_FALL_ZONE_GEOJSON.type, 'Feature');
  });

  it('has a LineString geometry', () => {
    assert.equal(NE_FALL_ZONE_GEOJSON.geometry.type, 'LineString');
  });

  it('has at least 4 coordinate pairs', () => {
    assert.ok(
      NE_FALL_ZONE_GEOJSON.geometry.coordinates.length >= 4,
      `expected ≥4 points, got ${NE_FALL_ZONE_GEOJSON.geometry.coordinates.length}`
    );
  });

  it('all coordinates are [lon, lat] pairs with valid ranges', () => {
    for (const [lon, lat] of NE_FALL_ZONE_GEOJSON.geometry.coordinates) {
      assert.ok(lon >= -80 && lon <= -68, `lon ${lon} out of NE range`);
      assert.ok(lat >= 40 && lat <= 46, `lat ${lat} out of NE range`);
    }
  });

  it('northern terminus is north of 44°N (Augusta ME area)', () => {
    const lats = NE_FALL_ZONE_GEOJSON.geometry.coordinates.map(([, lat]) => lat);
    assert.ok(Math.max(...lats) >= 44.0, 'NE fall zone should extend to at least 44°N');
  });

  it('southern terminus connects near Peekskill NY (~41.3°N, ~-73.9°W)', () => {
    const coords = NE_FALL_ZONE_GEOJSON.geometry.coordinates;
    const last = coords[coords.length - 1];
    assert.ok(last[1] >= 41.0 && last[1] <= 42.0, `southern end lat ${last[1]} expected ~41.3`);
    assert.ok(last[0] >= -75 && last[0] <= -72, `southern end lon ${last[0]} expected ~-73.9`);
  });

  it('has a section property', () => {
    assert.ok('section' in NE_FALL_ZONE_GEOJSON.properties, 'should have a section property');
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 27 — MAJOR_RIVERS_GEOJSON structure
   ═══════════════════════════════════════════════════════════════ */

describe('MAJOR_RIVERS_GEOJSON structure', () => {
  it('is a GeoJSON FeatureCollection', () => {
    assert.equal(MAJOR_RIVERS_GEOJSON.type, 'FeatureCollection');
  });

  it('has at least 10 river features', () => {
    assert.ok(
      MAJOR_RIVERS_GEOJSON.features.length >= 10,
      `expected ≥10 rivers, got ${MAJOR_RIVERS_GEOJSON.features.length}`
    );
  });

  it('each feature is a GeoJSON Feature with a LineString geometry', () => {
    for (const f of MAJOR_RIVERS_GEOJSON.features) {
      assert.equal(f.type, 'Feature', `river ${f.properties?.name} type should be Feature`);
      assert.equal(f.geometry.type, 'LineString', `river ${f.properties?.name} geometry should be LineString`);
    }
  });

  it('each feature has required properties: name, slug, length_km, states, source, mouth, note', () => {
    const requiredProps = ['name', 'slug', 'length_km', 'states', 'source', 'mouth', 'note'];
    for (const f of MAJOR_RIVERS_GEOJSON.features) {
      for (const prop of requiredProps) {
        assert.ok(prop in f.properties, `River ${f.properties?.name} missing property: ${prop}`);
      }
    }
  });

  it('each river has at least 4 coordinate pairs', () => {
    for (const f of MAJOR_RIVERS_GEOJSON.features) {
      assert.ok(
        f.geometry.coordinates.length >= 4,
        `river ${f.properties.name} has only ${f.geometry.coordinates.length} points`
      );
    }
  });

  it('each river slug is lowercase with no spaces', () => {
    for (const f of MAJOR_RIVERS_GEOJSON.features) {
      const slug = f.properties.slug;
      assert.match(slug, /^[a-z0-9-]+$/, `slug "${slug}" should be lowercase kebab-case`);
    }
  });

  it('all slugs are unique', () => {
    const slugs = MAJOR_RIVERS_GEOJSON.features.map(f => f.properties.slug);
    const unique = new Set(slugs);
    assert.equal(unique.size, slugs.length, 'all river slugs should be unique');
  });

  it('includes the James River (Richmond VA)', () => {
    const names = MAJOR_RIVERS_GEOJSON.features.map(f => f.properties.name);
    assert.ok(names.some(n => n.includes('James')), 'should include the James River');
  });

  it('includes the Merrimack River (Lowell MA)', () => {
    const names = MAJOR_RIVERS_GEOJSON.features.map(f => f.properties.name);
    assert.ok(names.some(n => n.includes('Merrimack')), 'should include the Merrimack River');
  });

  it('all coordinates are within eastern US bounds', () => {
    for (const f of MAJOR_RIVERS_GEOJSON.features) {
      for (const [lon, lat] of f.geometry.coordinates) {
        assert.ok(lon >= -90 && lon <= -65, `river ${f.properties.name} lon ${lon} out of bounds`);
        assert.ok(lat >= 30 && lat <= 48, `river ${f.properties.name} lat ${lat} out of bounds`);
      }
    }
  });
});


/* ═══════════════════════════════════════════════════════════════
   SUITE 28 — makeRiverDetailHTML()
   ═══════════════════════════════════════════════════════════════ */

describe('makeRiverDetailHTML()', () => {
  it('returns an article HTML string for a known river slug', () => {
    const html = makeRiverDetailHTML('james');
    assert.ok(typeof html === 'string' && html.length > 0, 'should return a non-empty string');
    assert.ok(html.includes('<article'), 'should return an article element');
  });

  it('includes the river name in the output', () => {
    const html = makeRiverDetailHTML('james');
    assert.ok(html.includes('James'), 'should include "James" in the river detail HTML');
  });

  it('includes the length_km value', () => {
    const html = makeRiverDetailHTML('james');
    assert.ok(html.includes('km') || html.includes('Length'), 'should include length info');
  });

  it('includes the states the river flows through', () => {
    const html = makeRiverDetailHTML('james');
    assert.ok(html.includes('Virginia') || html.includes('VA'), 'James River detail should mention Virginia');
  });

  it('returns a "not found" string for an unknown slug', () => {
    const html = makeRiverDetailHTML('unknown-river-xyz');
    assert.ok(html.includes('not found') || html.includes('Unknown') || html === '', 'unknown slug should return fallback');
  });

  it('works for the Merrimack River', () => {
    const html = makeRiverDetailHTML('merrimack');
    assert.ok(html.includes('Merrimack'), 'should include "Merrimack" for that slug');
  });

  it('includes the note/description text', () => {
    const html = makeRiverDetailHTML('james');
    assert.ok(html.length > 200, 'detail page should have substantial content');
  });
});
