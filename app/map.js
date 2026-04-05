/**
 * map.js — Leaflet map initialisation and layer setup
 * ----------------------------------------------------
 * Depends on:
 *   - Leaflet (loaded before this script)
 *   - lib/geo-data.js (loaded before this script; exposes window.GeoData)
 */

'use strict';

/* ─── Visible error handler ─────────────────────────────────────
   Shows any JS error directly in the map div so it's visible on
   mobile without needing browser devtools. Remove once stable.
   ────────────────────────────────────────────────────────────── */
function showError(msg) {
  var el = document.getElementById('map');
  el.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:24px';
  el.innerHTML =
    '<div style="background:#3a1020;border:1px solid #e84393;border-radius:8px;' +
    'padding:16px;color:#f88;font-family:monospace;font-size:13px;max-width:320px">' +
    '<strong style="color:#e84393">Map error</strong><br><br>' + msg + '</div>';
}

window.onerror = function (msg, src, line) {
  showError(msg + '<br><br>' + (src || '') + (line ? ':' + line : ''));
  return false;
};

/* ─── Guards ────────────────────────────────────────────────── */
if (typeof L === 'undefined') {
  showError('Leaflet failed to load.<br>Check network connection.');
  throw new Error('Leaflet not loaded');
}

if (typeof window.GeoData === 'undefined') {
  showError('lib/geo-data.js failed to load.<br>Check file path.');
  throw new Error('GeoData not loaded');
}

/* ─── Single reference to GeoData — no re-declaring its names ──
   geo-data.js uses const internally; re-declaring those same names
   here (even with var) causes "already declared" in the browser's
   shared global scope. Use a namespace alias instead.
   ────────────────────────────────────────────────────────────── */
var gd = window.GeoData;


/* ─── Map initialization ────────────────────────────────────── */

var map = L.map('map', {
  center: [37.5407, -77.4360],
  zoom: 11,
  zoomControl: true,
  attributionControl: false,
});

/* ─── Base tile layer (CARTO dark_all — free, no API key) ─────
   Attribution required: OSM contributors + CARTO (shown in legend).
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
