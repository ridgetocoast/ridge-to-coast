/**
 * map.js — Leaflet map initialisation and layer setup
 * ----------------------------------------------------
 * Depends on:
 *   - Leaflet (loaded before this script)
 *   - lib/geo-data.js (loaded before this script; exposes window.GeoData)
 *
 * All pure data and helpers live in lib/geo-data.js so they can be
 * unit-tested in Node without a browser or Leaflet mock.
 */

'use strict';

const {
  FALL_LINE_GEOJSON,
  COASTAL_PLAIN_GEOJSON,
  PIEDMONT_GEOJSON,
  STYLES,
  makeRegionPopup,
  makeFallLinePopup,
} = window.GeoData;


/* ─── Map initialization ────────────────────────────────────── */

const map = L.map('map', {
  center: [37.5407, -77.4360],   // Downtown Richmond, VA
  zoom: 11,
  zoomControl: true,
  attributionControl: false,     // custom attribution in our legend panel
});

/* ─── Base tile layer (CARTO Dark Matter — free, no API key) ─────
   Policy: CARTO tiles are free for low-traffic / personal use.
   Attribution required: OSM contributors + CARTO (shown in legend panel).
   ──────────────────────────────────────────────────────────────── */
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_matter_all/{z}/{x}/{y}{r}.png', {
  subdomains: ['a', 'b', 'c', 'd'],
  maxZoom: 19,
  detectRetina: true,
}).addTo(map);


/* ─── Layer builders ────────────────────────────────────────── */

function buildRegionLayer(geojson) {
  const style = STYLES[geojson.properties.region];
  return L.geoJSON(geojson, {
    style,
    onEachFeature(feature, layer) {
      layer.bindPopup(makeRegionPopup(feature.properties), { maxWidth: 260 });
      layer.on('mouseover', function () {
        this.setStyle({ fillOpacity: STYLES.regionHover.fillOpacity });
      });
      layer.on('mouseout', function () {
        this.setStyle({ fillOpacity: style.fillOpacity });
      });
    },
  });
}

const coastalLayer  = buildRegionLayer(COASTAL_PLAIN_GEOJSON);
const piedmontLayer = buildRegionLayer(PIEDMONT_GEOJSON);

const fallLineLayer = L.geoJSON(FALL_LINE_GEOJSON, {
  style: STYLES.fallLine,
  onEachFeature(feature, layer) {
    layer.bindPopup(makeFallLinePopup(), { maxWidth: 260 });
  },
});

// Add to map — regions first so fall line renders on top
coastalLayer.addTo(map);
piedmontLayer.addTo(map);
fallLineLayer.addTo(map);


/* ─── Layer toggle controls ─────────────────────────────────── */

document.getElementById('toggle-regions').addEventListener('change', function () {
  if (this.checked) {
    map.addLayer(coastalLayer);
    map.addLayer(piedmontLayer);
  } else {
    map.removeLayer(coastalLayer);
    map.removeLayer(piedmontLayer);
  }
});

document.getElementById('toggle-fallline').addEventListener('change', function () {
  if (this.checked) {
    map.addLayer(fallLineLayer);
  } else {
    map.removeLayer(fallLineLayer);
  }
});


/* ─── Initial viewport ──────────────────────────────────────── */
map.fitBounds([
  [37.42, -77.60],   // SW — western Henrico / Chesterfield
  [37.65, -77.25],   // NE — eastern Henrico / New Kent border
]);
