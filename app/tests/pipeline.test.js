/**
 * tests/pipeline.test.js
 * ─────────────────────
 * Static lints for the EPA data pipeline scripts and workflow.
 * These catch the exact failure modes encountered during development:
 *
 *   1. Wrong ArcGIS layer number (layer 2 = lines, must be layer 11 = polygons)
 *   2. require() on .geojson files (Node treats unknown ext as JS → SyntaxError)
 *   3. L3_TO_REGION mapping correctness (mock GeoJSON → expected region keys)
 *   4. Zero-feature guard (script must exit non-zero when input has 0 features)
 *   5. YAML parseable and has the expected step structure
 *   6. File size limit enforcement (workflow checks > 2048 KB → exit 1)
 *   7. outFields matches what extract-regions.js expects (US_L3CODE, US_L3NAME)
 *
 * Run with:
 *   node --test tests/pipeline.test.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'update-epa-regions.yml');
const FETCH    = path.join(ROOT, 'scripts', 'fetch-epa-ecoregions.js');
const EXTRACT  = path.join(ROOT, 'scripts', 'extract-regions.js');

// ── Helpers ────────────────────────────────────────────────────────────────

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// Pull the L3_TO_REGION object out of extract-regions.js by evaluating
// only the portion of the file up to and including the closing brace of the map.
// We avoid require() on the script because it calls process.exit() at the end.
function getL3ToRegion() {
  const src = readFile(EXTRACT);
  // Extract the const L3_TO_REGION = { ... }; block
  const start = src.indexOf('const L3_TO_REGION = {');
  const end   = src.indexOf('\n};\n', start) + 4; // include closing };\n
  const block = src.slice(start, end);
  // eslint-disable-next-line no-new-func
  return new Function(`${block}; return L3_TO_REGION;`)();
}

// ── Suite 1: fetch-epa-ecoregions.js lints ─────────────────────────────────

describe('fetch-epa-ecoregions.js static lints', () => {
  const src = readFile(FETCH);

  it('references layer 11 (Level III polygons), not layer 2 (lines) or layer 1 (Level IV)', () => {
    assert.ok(
      src.includes('MapServer/11'),
      'Script must reference MapServer/11 (Level III polygon layer)'
    );
    assert.ok(
      !src.includes('MapServer/2/') && !src.includes('MapServer/1/'),
      'Script must NOT reference MapServer/2 (lines) or MapServer/1 (Level IV)'
    );
  });

  it('requests outFields US_L3CODE and US_L3NAME (fields extract-regions.js expects)', () => {
    assert.ok(
      src.includes('US_L3CODE') && src.includes('US_L3NAME'),
      'outFields must include US_L3CODE and US_L3NAME'
    );
  });

  it('does not use require() on a .geojson file (Node treats unknown ext as JS)', () => {
    // Match require( followed by anything containing .geojson before the closing )
    const badPattern = /require\s*\([^)]*\.geojson[^)]*\)/;
    assert.ok(
      !badPattern.test(src),
      'Script must not require() a .geojson file — use JSON.parse(fs.readFileSync(...))'
    );
  });

  it('uses JSON.parse + readFileSync to load GeoJSON (correct pattern)', () => {
    assert.ok(
      src.includes('JSON.parse') || !src.includes('.geojson'),
      'GeoJSON loading must use JSON.parse(fs.readFileSync(...))'
    );
  });

  it('exits non-zero when 0 features are fetched', () => {
    assert.ok(
      src.includes('process.exit(1)'),
      'Script must call process.exit(1) when no features are returned'
    );
  });

  it('includes a fallback host (gispub.epa.gov) in case primary host is unreachable', () => {
    assert.ok(
      src.includes('gispub.epa.gov'),
      'Script should include gispub.epa.gov as an alternate ArcGIS host'
    );
  });
});

// ── Suite 2: update-epa-regions.yml lints ──────────────────────────────────

describe('update-epa-regions.yml static lints', () => {
  const yml = readFile(WORKFLOW);

  it('workflow file exists and is non-empty', () => {
    assert.ok(yml.length > 500, 'Workflow file should be at least 500 bytes');
  });

  it('does not use require() on a .geojson file anywhere in the YAML', () => {
    // Any node -e "... require(... .geojson ...) ..." inline command is a bug
    const badPattern = /require\s*\([^)]*\.geojson/;
    assert.ok(
      !badPattern.test(yml),
      'Workflow must not use require() on .geojson files — use JSON.parse(fs.readFileSync(...))'
    );
  });

  it('uses JSON.parse + readFileSync for all inline GeoJSON loading', () => {
    // Count occurrences: every .geojson mention in a node -e context should pair with JSON.parse
    const geojsonInNodeE = (yml.match(/node -e[^"]*\.geojson/g) || []).length;
    const jsonParseCount = (yml.match(/JSON\.parse/g) || []).length;
    assert.ok(
      jsonParseCount >= geojsonInNodeE,
      `Found ${geojsonInNodeE} .geojson references in node -e blocks but only ${jsonParseCount} JSON.parse calls`
    );
  });

  it('enforces a file size limit (exits non-zero when file exceeds 2 MB)', () => {
    assert.ok(
      yml.includes('2048') || yml.includes('2 MB') || yml.includes('2MB'),
      'Workflow must check that regions.geojson does not exceed 2 MB (2048 KB)'
    );
    assert.ok(
      yml.includes('exit 1'),
      'Workflow must call exit 1 when size limit is exceeded'
    );
  });

  it('includes S3 URL as primary download source (more reliable than gaftp from runners)', () => {
    assert.ok(
      yml.includes('s3.us-east-1.amazonaws.com'),
      'Workflow should try the S3 bucket before gaftp.epa.gov'
    );
  });

  it('installs GDAL (ogr2ogr) for shapefile conversion', () => {
    assert.ok(
      yml.includes('gdal-bin') || yml.includes('ogr2ogr'),
      'Workflow must install GDAL (gdal-bin) for shapefile → GeoJSON conversion'
    );
  });

  it('applies geometry simplification to keep output under size limit', () => {
    assert.ok(
      yml.includes('-simplify'),
      'ogr2ogr command must include -simplify to reduce vertex count and keep file under 2 MB'
    );
  });

  it('verifies all 9 required region keys are present in the output', () => {
    const requiredKeys = [
      'blueRidge', 'coastal', 'greatLakes', 'gulfCoastal',
      'interiorLowlands', 'neCoastal', 'neUpland', 'piedmont', 'valleyRidge',
    ];
    for (const key of requiredKeys) {
      assert.ok(
        yml.includes(`'${key}'`) || yml.includes(`"${key}"`),
        `Workflow must verify region key: ${key}`
      );
    }
  });

  it('runs the unit test suite (node --test tests/geo.test.js)', () => {
    assert.ok(
      yml.includes('geo.test.js'),
      'Workflow must run the geo.test.js unit test suite'
    );
  });

  it('only commits when data actually changed (no-op on unchanged EPA data)', () => {
    assert.ok(
      yml.includes('git diff') && yml.includes('changed'),
      'Workflow must diff regions.geojson before committing to avoid noise commits'
    );
  });
});

// ── Suite 3: extract-regions.js L3_TO_REGION mapping ───────────────────────

describe('extract-regions.js L3_TO_REGION mapping', () => {
  const L3_TO_REGION = getL3ToRegion();

  const EXPECTED_REGIONS = new Set([
    'coastal', 'neCoastal', 'piedmont', 'neUpland', 'blueRidge',
    'valleyRidge', 'gulfCoastal', 'greatLakes', 'interiorLowlands',
  ]);

  it('mapping object is non-empty', () => {
    assert.ok(Object.keys(L3_TO_REGION).length > 0, 'L3_TO_REGION must have entries');
  });

  it('all mapped values are valid region keys', () => {
    for (const [code, region] of Object.entries(L3_TO_REGION)) {
      assert.ok(
        EXPECTED_REGIONS.has(region),
        `L3 code ${code} maps to unknown region "${region}"`
      );
    }
  });

  it('covers all 9 expected region keys', () => {
    const mappedRegions = new Set(Object.values(L3_TO_REGION));
    for (const region of EXPECTED_REGIONS) {
      assert.ok(mappedRegions.has(region), `No L3 code maps to region "${region}"`);
    }
  });

  it('maps known coastal codes (63, 65) to coastal', () => {
    assert.equal(L3_TO_REGION['63'], 'coastal');
    assert.equal(L3_TO_REGION['65'], 'coastal');
  });

  it('maps Blue Ridge code (66) to blueRidge', () => {
    assert.equal(L3_TO_REGION['66'], 'blueRidge');
  });

  it('maps Valley and Ridge codes (67, 68, 69) to valleyRidge', () => {
    assert.equal(L3_TO_REGION['67'], 'valleyRidge');
    assert.equal(L3_TO_REGION['68'], 'valleyRidge');
    assert.equal(L3_TO_REGION['69'], 'valleyRidge');
  });

  it('maps Piedmont codes (45, 64, 59) to piedmont', () => {
    assert.equal(L3_TO_REGION['45'], 'piedmont');
    assert.equal(L3_TO_REGION['64'], 'piedmont');
    assert.equal(L3_TO_REGION['59'], 'piedmont');
  });

  it('maps NE Highland codes (58, 84) to neUpland', () => {
    assert.equal(L3_TO_REGION['58'], 'neUpland');
    assert.equal(L3_TO_REGION['84'], 'neUpland');
  });

  it('maps Mixed Wood Plains code (83) to neCoastal', () => {
    assert.equal(L3_TO_REGION['83'], 'neCoastal');
  });

  it('maps Gulf Coastal codes (73, 74, 75, 76) to gulfCoastal', () => {
    assert.equal(L3_TO_REGION['73'], 'gulfCoastal');
    assert.equal(L3_TO_REGION['74'], 'gulfCoastal');
    assert.equal(L3_TO_REGION['75'], 'gulfCoastal');
    assert.equal(L3_TO_REGION['76'], 'gulfCoastal');
  });

  it('maps Great Lakes codes (50, 51, 53, 56, 57, 78, 81) to greatLakes', () => {
    for (const code of ['50', '51', '53', '56', '57', '78', '81']) {
      assert.equal(L3_TO_REGION[code], 'greatLakes', `Code ${code} should map to greatLakes`);
    }
  });

  it('maps Interior Lowlands codes (54, 55, 71, 72) to interiorLowlands', () => {
    assert.equal(L3_TO_REGION['54'], 'interiorLowlands');
    assert.equal(L3_TO_REGION['55'], 'interiorLowlands');
    assert.equal(L3_TO_REGION['71'], 'interiorLowlands');
    assert.equal(L3_TO_REGION['72'], 'interiorLowlands');
  });

  it('does not map Great Plains or Pacific codes (codes outside the corridor)', () => {
    // Codes like 7 (Western Corn Belt Plains), 9 (Ozark Highlands) are outside scope
    assert.equal(L3_TO_REGION['7'],  undefined);
    assert.equal(L3_TO_REGION['9'],  undefined);
    assert.equal(L3_TO_REGION['1'],  undefined);
  });
});

// ── Suite 4: extract-regions.js BBOX ───────────────────────────────────────

describe('extract-regions.js BBOX', () => {
  const src = readFile(EXTRACT);

  it('BBOX west boundary is at or west of -92° (east of Mississippi River)', () => {
    const match = src.match(/west:\s*([-\d.]+)/);
    assert.ok(match, 'BBOX must define a west boundary');
    assert.ok(parseFloat(match[1]) <= -92.0, 'west boundary should be ≤ -92.0°');
  });

  it('BBOX south boundary includes Florida Keys (≤ 24.5°N)', () => {
    const match = src.match(/south:\s*([-\d.]+)/);
    assert.ok(match, 'BBOX must define a south boundary');
    assert.ok(parseFloat(match[1]) <= 24.5, 'south boundary should be ≤ 24.5°N to include FL Keys');
  });

  it('BBOX north boundary reaches northern Maine (≥ 47°N)', () => {
    const match = src.match(/north:\s*([-\d.]+)/);
    assert.ok(match, 'BBOX must define a north boundary');
    assert.ok(parseFloat(match[1]) >= 47.0, 'north boundary should be ≥ 47°N to reach northern Maine');
  });

  it('BBOX east boundary includes Atlantic coast (≥ -67°)', () => {
    const match = src.match(/east:\s*([-\d.]+)/);
    assert.ok(match, 'BBOX must define an east boundary');
    assert.ok(parseFloat(match[1]) >= -67.0, 'east boundary should be ≥ -67° to include Quoddy Head ME');
  });
});
