/**
 * map.js — Leaflet map initialisation and layer setup
 * ----------------------------------------------------
 * Depends on:
 *   - lib/leaflet.js  (vendored, loaded before this script)
 *   - lib/geo-data.js (loaded before this script; exposes window.GeoData)
 */

'use strict';

/* ─── Guards ────────────────────────────────────────────────── */
if (typeof L === 'undefined') {
  throw new Error('Leaflet (lib/leaflet.js) failed to load');
}
if (typeof window.GeoData === 'undefined') {
  throw new Error('lib/geo-data.js failed to load');
}

var gd = window.GeoData;


/* ─── Map initialization ────────────────────────────────────── */

var map = L.map('map', {
  center: [37.5407, -77.4360],
  zoom: 11,
  zoomControl: true,
  attributionControl: false,
});

/* ─── Base tile layer (CARTO dark_all — free, no API key) ─────
   Attribution: OSM contributors + CARTO (shown in legend panel).
   ────────────────────────────────────────────────────────────── */
var tileScale = L.Browser.retina ? '@2x' : '';
L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}' + tileScale + '.png',
  { subdomains: ['a', 'b', 'c', 'd'], maxZoom: 20 }
).addTo(map);


/* ─── Layer builders ────────────────────────────────────────── */

function buildRegionLayer(geojson) {
  var style = gd.STYLES[geojson.properties.region];
  return L.geoJSON(geojson, {
    style: style,
    onEachFeature: function (feature, layer) {
      layer.bindPopup(gd.makeRegionPopup(feature.properties), { maxWidth: 260 });
      layer.on('mouseover', function () {
        this.setStyle({ fillOpacity: gd.STYLES.regionHover.fillOpacity });
      });
      layer.on('mouseout', function () {
        this.setStyle({ fillOpacity: style.fillOpacity });
      });
    },
  });
}

var coastalLayer  = buildRegionLayer(gd.COASTAL_PLAIN_GEOJSON);
var piedmontLayer = buildRegionLayer(gd.PIEDMONT_GEOJSON);

var fallLineLayer = L.geoJSON(gd.FALL_LINE_GEOJSON, {
  style: gd.STYLES.fallLine,
  onEachFeature: function (feature, layer) {
    layer.bindPopup(gd.makeFallLinePopup(), { maxWidth: 260 });
  },
});

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
  [37.42, -77.60],
  [37.65, -77.25],
]);
