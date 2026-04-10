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
  STYLES,
  BBOX,
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
  it('all points are within the Atlantic Seaboard fall line belt (PA to GA)', () => {
    // Fall line spans Trenton NJ (40.22°N) to Augusta GA (33.47°N)
    for (const [lon, lat] of FALL_LINE_COORDS) {
      assert.ok(lon >= -85.0 && lon <= -74.0,
        `longitude ${lon} is outside the eastern US range [-85, -74]`);
      assert.ok(lat >= 33.0 && lat <= 41.0,
        `latitude ${lat} is outside the PA–GA range [33.0, 41.0]`);
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

  it('passes within 10 km of Delaware River at Trenton NJ (northern anchor)', () => {
    // Trenton NJ: ~40.220°N, 74.770°W — where the Delaware River crosses the fall line
    const TRENTON = [-74.770, 40.220];
    const dist = minDistanceToFallLine(TRENTON);
    assert.ok(dist <= 10.0,
      `nearest fall line point is ${dist.toFixed(2)} km from Trenton — expected ≤ 10 km`);
  });

  it('passes within 10 km of Savannah River at Augusta GA (southern anchor)', () => {
    // Augusta GA: ~33.470°N, 82.020°W — where the Savannah River crosses the fall line
    const AUGUSTA = [-82.020, 33.470];
    const dist = minDistanceToFallLine(AUGUSTA);
    assert.ok(dist <= 10.0,
      `nearest fall line point is ${dist.toFixed(2)} km from Augusta GA — expected ≤ 10 km`);
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

  it('eastern boundary reaches the metro east edge', () => {
    const maxLon = Math.max(...ring.map(([lon]) => lon));
    assert.ok(
      maxLon >= BBOX.EAST,
      `coastal polygon should reach BBOX east (${BBOX.EAST}), max lon was ${maxLon}`
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
  it('has keys: coastal, piedmont, fallLine, regionHover', () => {
    for (const key of ['coastal', 'piedmont', 'fallLine', 'regionHover']) {
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
  it('covers all zones relevant to Virginia (5a through 8b)', () => {
    const virginiaZones = ['5a','5b','6a','6b','7a','7b','8a','8b'];
    for (const zone of virginiaZones) {
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

  it('returns a valid hex color for all Virginia zones', () => {
    const virginiaZones = ['5a','5b','6a','6b','7a','7b','8a','8b'];
    for (const zone of virginiaZones) {
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

  it('all Virginia zone infos contain a degree symbol in tempRange', () => {
    const virginiaZones = ['5a','5b','6a','6b','7a','7b','8a','8b'];
    for (const zone of virginiaZones) {
      const info = getZoneInfo(zone);
      assert.ok(info.tempRange.includes('°'),
        `Zone ${zone} tempRange should contain a degree symbol`);
    }
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

  it('returns true for Columbia, SC (34.00, -81.03)', () => {
    assert.equal(isInCorridor(34.00, -81.03), true);
  });

  it('returns true for Augusta, GA (33.47, -82.02)', () => {
    assert.equal(isInCorridor(33.47, -82.02), true);
  });

  it('returns false for New York City (40.71, -74.01) — north of corridor', () => {
    assert.equal(isInCorridor(40.71, -74.01), false);
  });

  it('returns false for Louisville, KY (38.25, -85.76) — west of corridor', () => {
    assert.equal(isInCorridor(38.25, -85.76), false);
  });

  it('returns false for Miami, FL (25.77, -80.19) — south of corridor', () => {
    assert.equal(isInCorridor(25.77, -80.19), false);
  });

  it('returns false for Atlanta, GA (33.75, -84.39) — south and west', () => {
    assert.equal(isInCorridor(33.75, -84.39), false);
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
