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


/* ─── Fall line and region layers ───────────────────────────── */

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


/* ─── Plant Hardiness Zone layer (lazy-loaded) ──────────────────
   The GeoJSON is ~1.3MB raw / ~300KB gzip on the wire.
   Only fetched when the user first enables the toggle.
   Cached in memory so toggling off/on does not re-fetch.
   ────────────────────────────────────────────────────────────── */

var hardinessCache  = null;   // parsed GeoJSON, set on first successful fetch
var hardinessLayer  = null;   // Leaflet layer, built once from cache

var hardinessSpinner = document.getElementById('hardiness-spinner');
var hardinessLegend  = document.getElementById('hardiness-legend');

function setHardinessLoading(loading) {
  hardinessSpinner.hidden = !loading;
}

function buildHardinessLegend(zones) {
  var swatchContainer = hardinessLegend.querySelector('.zone-swatches');
  swatchContainer.innerHTML = '';
  zones.sort().forEach(function (zone) {
    var color = gd.getZoneColor(zone);
    var item = document.createElement('div');
    item.className = 'legend-item zone-item';
    item.innerHTML =
      '<span class="swatch" style="background:' + color + ';border-color:' + color + '88"></span>' +
      '<span>Zone ' + zone + '</span>';
    swatchContainer.appendChild(item);
  });
  hardinessLegend.hidden = false;
}

function styleHardinessFeature(feature) {
  var zone = feature.properties.zone || 'unknown';
  return {
    fillColor:   gd.getZoneColor(zone),
    fillOpacity: 0.50,
    color:       '#ffffff',
    weight:      0.4,
    opacity:     0.4,
  };
}

function onEachHardinessFeature(feature, layer) {
  var zone = feature.properties.zone || 'unknown';
  layer.bindPopup(gd.makeZonePopup(zone), { maxWidth: 260 });
}

function loadAndShowHardinessLayer() {
  // Already cached — just add to map
  if (hardinessCache) {
    map.addLayer(hardinessLayer);
    return;
  }

  setHardinessLoading(true);

  fetch('data/hardiness.geojson')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' loading hardiness.geojson');
      }
      return response.json();
    })
    .then(function (data) {
      hardinessCache = data;

      hardinessLayer = L.geoJSON(data, {
        style:          styleHardinessFeature,
        onEachFeature:  onEachHardinessFeature,
      });

      // Build legend from zones present in the data
      var zones = data._meta && data._meta.zones
        ? data._meta.zones
        : [...new Set(data.features.map(function (f) { return f.properties.zone; }))];
      buildHardinessLegend(zones);

      // Add below the fall line so the pink line remains on top
      hardinessLayer.addTo(map);
      fallLineLayer.bringToFront();

      setHardinessLoading(false);
    })
    .catch(function (err) {
      setHardinessLoading(false);
      console.error('Hardiness layer failed to load:', err);
      // Uncheck the toggle so state matches reality
      document.getElementById('toggle-hardiness').checked = false;
      alert('Plant hardiness data could not be loaded.\n' + err.message);
    });
}


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

document.getElementById('toggle-hardiness').addEventListener('change', function () {
  if (this.checked) {
    loadAndShowHardinessLayer();
  } else {
    if (hardinessLayer) map.removeLayer(hardinessLayer);
    hardinessLegend.hidden = true;
  }
});


/* ─── Initial viewport ──────────────────────────────────────── */
map.fitBounds([
  [37.42, -77.60],
  [37.65, -77.25],
]);
