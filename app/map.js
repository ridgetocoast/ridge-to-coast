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

/* Shared popup options — autoPan clear of the fixed header (48px) and search bar (56px) */
var POPUP_OPTS = {
  autoPanPaddingTopLeft:     L.point(8, 56),
  autoPanPaddingBottomRight: L.point(8, 64),
};


/* ─── Map initialization ────────────────────────────────────── */

var map = L.map('map', {
  center: [37.5, -78.0],
  zoom: 7,
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
      layer.bindPopup(gd.makeRegionPopup(feature.properties),
        Object.assign({ maxWidth: 260 }, POPUP_OPTS));
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
    layer.bindPopup(gd.makeFallLinePopup(),
      Object.assign({ maxWidth: 260 }, POPUP_OPTS));
  },
});

coastalLayer.addTo(map);
piedmontLayer.addTo(map);
fallLineLayer.addTo(map);


/* ─── City marker layer ─────────────────────────────────────────
   One circleMarker per fall line metro.
   Uses FeatureGroup (not LayerGroup) so bringToFront() is available —
   needed to keep markers above the hardiness zone polygons when that
   layer is enabled.
   ────────────────────────────────────────────────────────────── */

var CITY_MARKER_STYLE = {
  radius:      7,
  fillColor:   '#ffffff',
  color:       '#e84393',
  weight:      2.5,
  opacity:     1,
  fillOpacity: 0.9,
};

var cityMarkersLayer = L.featureGroup();

gd.FALL_LINE_CITIES.forEach(function (city) {
  var marker = L.circleMarker([city.lat, city.lon], CITY_MARKER_STYLE);
  marker.bindPopup(gd.makeMarkerPopup(city),
    Object.assign({ maxWidth: 300 }, POPUP_OPTS));
  marker.bindTooltip(city.name + ', ' + city.state, {
    direction:  'top',
    offset:     L.point(0, -9),
    className:  'city-tooltip',
  });
  marker.on('mouseover', function () {
    this.setStyle({ radius: 9, fillColor: '#e84393', fillOpacity: 1 });
  });
  marker.on('mouseout', function () {
    this.setStyle(CITY_MARKER_STYLE);
  });
  cityMarkersLayer.addLayer(marker);
});

cityMarkersLayer.addTo(map);


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
    fillOpacity: 0.28,   // semi-transparent so Piedmont/Coastal shading shows through
    color:       gd.getZoneColor(zone),
    weight:      0.8,
    opacity:     0.5,
  };
}

function onEachHardinessFeature(feature, layer) {
  var zone = feature.properties.zone || 'unknown';
  layer.bindPopup(gd.makeZonePopup(zone),
    Object.assign({ maxWidth: 280 }, POPUP_OPTS));
  // Permanent label: zone code centered on each polygon, shown at zoom ≥ 9
  layer.bindTooltip(zone, {
    permanent:   true,
    direction:   'center',
    className:   'zone-label',
    interactive: false,
  });
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

      // Add below the fall line so the pink line remains on top;
      // city markers stay above hardiness polygons
      hardinessLayer.addTo(map);
      fallLineLayer.bringToFront();
      if (map.hasLayer(cityMarkersLayer)) cityMarkersLayer.bringToFront();
      updateZoneLabels();

      setHardinessLoading(false);
    })
    .catch(function (err) {
      setHardinessLoading(false);
      console.error('Hardiness layer failed to load:', err);
      // Uncheck the toggle so state matches reality
      document.getElementById('toggle-hardiness').checked = false;
      // Show inline error — alert() is intrusive and blocked in some contexts
      var errEl = document.getElementById('hardiness-error');
      if (errEl) {
        errEl.textContent = 'Could not load zone data.';
        errEl.hidden = false;
      }
    });
}


/* ─── Zone label visibility (shown only at zoom ≥ 9) ───────── */

function updateZoneLabels() {
  var show = map.getZoom() >= 9;
  map.getContainer().classList.toggle('hide-zone-labels', !show);
}

map.on('zoomend', function () {
  if (hardinessLayer && map.hasLayer(hardinessLayer)) {
    updateZoneLabels();
  }
});


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

document.getElementById('toggle-cities').addEventListener('change', function () {
  if (this.checked) {
    map.addLayer(cityMarkersLayer);
  } else {
    map.removeLayer(cityMarkersLayer);
  }
});


/* ─── Legend collapse / expand ──────────────────────────────── */

var legendBody   = document.getElementById('legend-body');
var legendToggle = document.getElementById('legend-toggle');

// Mobile (≤600px): start collapsed to maximise map visibility
if (window.innerWidth <= 600) {
  legendBody.hidden = true;
  legendToggle.setAttribute('aria-expanded', 'false');
  legendToggle.textContent = '\u25B8'; // ▸
}

legendToggle.addEventListener('click', function () {
  var collapsed = legendBody.hidden;
  legendBody.hidden = !collapsed;
  legendToggle.setAttribute('aria-expanded', String(collapsed));
  legendToggle.textContent = collapsed ? '\u25BE' : '\u25B8'; // ▾ or ▸
});


/* ─── Location search ───────────────────────────────────────── */

var searchForm   = document.getElementById('search-form');
var searchInput  = document.getElementById('search-input');
var searchStatus = document.getElementById('search-status');

function showStatus(text) {
  searchStatus.textContent = text;
  searchStatus.hidden = !text;
}

function flyToResult(lat, lon, displayName) {
  map.flyTo([lat, lon], 12, { duration: 1.5 });
  if (!gd.isInCorridor(lat, lon)) {
    showStatus(displayName + ' is outside the DC\u2013Raleigh corridor.');
  } else {
    searchStatus.hidden = true;
  }
}

searchForm.addEventListener('submit', function (e) {
  e.preventDefault();
  var query = searchInput.value.trim();
  if (!query) {
    showStatus('Enter a zip code or city to search.');
    return;
  }
  showStatus('Searching\u2026');
  fetch(gd.buildSearchQuery(query), {
    headers: { 'Accept': 'application/json' }
  })
    .then(function (r) { return r.json(); })
    .then(function (results) {
      if (!results || results.length === 0) {
        showStatus('\u201c' + query + '\u201d not found. Try a city name or zip code.');
        return;
      }
      var r = results[0];
      flyToResult(parseFloat(r.lat), parseFloat(r.lon), r.display_name || query);
    })
    .catch(function () {
      showStatus('Search failed. Check your connection and try again.');
    });
});


/* ─── GPS / geolocation ─────────────────────────────────────── */

document.getElementById('locate-btn').addEventListener('click', function () {
  if (!navigator.geolocation) {
    showStatus('Geolocation is not supported by your browser.');
    return;
  }
  showStatus('Finding your location\u2026');
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      flyToResult(pos.coords.latitude, pos.coords.longitude, 'your location');
    },
    function () {
      showStatus('Could not get your location. Check browser permissions.');
    }
  );
});


/* ─── Initial viewport — fit full fall line corridor ─────────── */
map.fitBounds([
  [32.30, -85.20],   // SW — Columbus GA / Chattahoochee River falls
  [41.40, -73.70],   // NE — Peekskill NY / Hudson Highlands
]);
