/**
 * scripts/fetch-epa-ecoregions.js
 * ────────────────────────────────
 * Downloads all EPA Level III Ecoregion features from the public ArcGIS
 * REST API and writes them to /tmp/us_eco_l3.geojson, ready for
 * scripts/extract-regions.js to process into data/regions.geojson.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────
 *   node scripts/fetch-epa-ecoregions.js [output]
 *
 *   Default output: /tmp/us_eco_l3.geojson
 *
 * ── Full pipeline ─────────────────────────────────────────────────────────
 *   node scripts/fetch-epa-ecoregions.js
 *   node scripts/extract-regions.js /tmp/us_eco_l3.geojson data/regions.geojson
 *
 * ── Data source ───────────────────────────────────────────────────────────
 *   US EPA Level III Ecoregions of the Conterminous United States
 *   Last updated by EPA: May 2025. Public domain, no API key required.
 *
 *   Primary (ArcGIS REST, paginated GeoJSON — this script):
 *     https://geodata.epa.gov/arcgis/rest/services/ORD/USEPA_Ecoregions_Level_III_and_IV/MapServer/2
 *
 *   Alternative A (HTTPS zip, requires ogr2ogr/GDAL to convert shapefile):
 *     curl -sL https://gaftp.epa.gov/EPADataCommons/ORD/Ecoregions/us/us_eco_l3_state.zip \
 *          -o /tmp/us_eco_l3.zip && unzip /tmp/us_eco_l3.zip -d /tmp/us_eco_l3/
 *     ogr2ogr -f GeoJSON -t_srs EPSG:4326 /tmp/us_eco_l3.geojson /tmp/us_eco_l3/us_eco_l3_state.shp
 *
 *   Alternative B (S3 file browser, no API needed):
 *     https://dmap-prod-oms-edc.s3.us-east-1.amazonaws.com/index.html#ORD/Ecoregions/
 *
 *   CEC (same data + Canada + Mexico):
 *     https://www.cec.org/north-american-environmental-atlas/terrestrial-ecoregions-level-iii/
 *
 * ── Network requirement ───────────────────────────────────────────────────
 *   Requires outbound HTTPS to geodata.epa.gov.
 *   GitHub Actions runners reach it; local environments may be blocked (403).
 *   If blocked locally, use Alternative A above or:
 *     node scripts/generate-regions.js
 *
 * ── How it works ──────────────────────────────────────────────────────────
 *   The ArcGIS REST API paginates results (default max 1000 per page).
 *   This script walks all pages using resultOffset until the server
 *   signals the last page (exceededTransferLimit: false or fewer features
 *   than the page size).  All features are merged into a single
 *   FeatureCollection and written to disk.
 */

'use strict';

const fs      = require('fs');
const https   = require('https');
const path    = require('path');
const { URL } = require('url');

const OUTPUT  = process.argv[2] || '/tmp/us_eco_l3.geojson';
const BASE    = 'https://geodata.epa.gov/arcgis/rest/services/ORD/USEPA_Ecoregions_Level_III_and_IV/MapServer/2/query';
const PAGE    = 1000;   // features per request (server max is typically 1000)

/** Fetch one page of GeoJSON and return the parsed object. */
function fetchPage(offset) {
  const url = new URL(BASE);
  url.searchParams.set('where',            '1=1');
  url.searchParams.set('outFields',        'US_L3CODE,US_L3NAME');
  url.searchParams.set('f',                'geojson');
  url.searchParams.set('resultOffset',     String(offset));
  url.searchParams.set('resultRecordCount', String(PAGE));

  return new Promise((resolve, reject) => {
    const req = https.get(url.toString(), (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for offset ${offset}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          reject(new Error(`JSON parse error at offset ${offset}: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30_000, () => {
      req.destroy(new Error(`Timeout fetching offset ${offset}`));
    });
  });
}

async function main() {
  const allFeatures = [];
  let offset = 0;
  let page   = 1;

  process.stderr.write('Fetching EPA Level III Ecoregions from ArcGIS REST API...\n');

  for (;;) {
    process.stderr.write(`  Page ${page} (offset ${offset})...`);
    let data;
    try {
      data = await fetchPage(offset);
    } catch (err) {
      process.stderr.write('\n');
      console.error(`\nFetch error: ${err.message}`);
      console.error('\nIf geodata.epa.gov is unreachable, use the interim generator:');
      console.error('  node scripts/generate-regions.js');
      process.exit(1);
    }

    const features = data.features || [];
    process.stderr.write(` ${features.length} features\n`);
    allFeatures.push(...features);

    // ArcGIS signals "more pages" via exceededTransferLimit: true
    if (!data.exceededTransferLimit || features.length < PAGE) break;

    offset += PAGE;
    page++;
  }

  process.stderr.write(`\nTotal features fetched: ${allFeatures.length}\n`);

  const geojson = {
    type:     'FeatureCollection',
    _meta: {
      source:    'EPA ArcGIS REST — USEPA_Ecoregions_Level_III_and_IV/MapServer/2',
      fetched:   new Date().toISOString().slice(0, 10),
      features:  allFeatures.length,
    },
    features: allFeatures,
  };

  fs.mkdirSync(path.dirname(path.resolve(OUTPUT)), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(geojson));

  const kb = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
  process.stderr.write(`Written: ${OUTPUT} (${kb} KB)\n`);
  process.stderr.write('\nNext step:\n');
  process.stderr.write(`  node scripts/extract-regions.js ${OUTPUT} data/regions.geojson\n`);
}

main();
