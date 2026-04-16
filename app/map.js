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


/* ─── Hash routing — detail pages ───────────────────────────── */

var mapViewEl    = document.getElementById('map-view');
var detailViewEl = document.getElementById('detail-view');
var detailContentEl = document.getElementById('detail-content');

function showMapView() {
  detailViewEl.hidden = true;
  mapViewEl.hidden = false;
}

function showDetailView(html) {
  detailContentEl.innerHTML = html;
  detailViewEl.hidden = false;
  mapViewEl.hidden = true;
  window.scrollTo(0, 0);
}

/**
 * Parse location.hash and render the appropriate view.
 * Hash format: #detail/<type>/<key>
 *   type = region | zone | city | fallline | location
 *   key  = region name | zone code | city-slug | lat/lon
 */
function navigate(hash) {
  if (!hash || hash === '#' || hash === '') {
    showMapView();
    return;
  }
  var parts = hash.replace(/^#/, '').split('/');
  if (parts[0] !== 'detail') {
    showMapView();
    return;
  }
  var type = parts[1];
  var html = '';
  if (type === 'region') {
    html = gd.makeRegionDetailHTML(parts[2]);
  } else if (type === 'zone') {
    html = gd.makeZoneDetailHTML(parts[2]);
  } else if (type === 'city') {
    html = gd.makeCityDetailHTML(parts[2]);
  } else if (type === 'fallline') {
    html = gd.makeFallLineDetailHTML();
  } else if (type === 'river') {
    html = gd.makeRiverDetailHTML(parts[2]);
  } else if (type === 'location') {
    var lat = parseFloat(parts[2]);
    var lon = parseFloat(parts[3]);
    if (!isNaN(lat) && !isNaN(lon)) {
      html = gd.makeLocationReport(lat, lon);
    }
  }
  if (html) {
    showDetailView(html);
  } else {
    showMapView();
  }
}

window.addEventListener('hashchange', function () { navigate(location.hash); });

document.getElementById('back-btn').addEventListener('click', function () {
  if (window.history.length > 1) {
    history.back();
  } else {
    location.hash = '';
  }
});


/* ─── Map initialization ────────────────────────────────────── */

var map = L.map('map', {
  center: [38.9, -77.0],
  zoom: 8,
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

/**
 * Return the Leaflet style object for a region feature.
 * Uses the outline variant when hardiness zones are active so zone fill
 * colors are not obscured by region shading.
 * @param {string}  region  - feature.properties.region key
 * @param {boolean} outline - true when zone overlay is active
 */
function regionStyle(region, outline) {
  if (outline) {
    return gd.STYLES[region + 'Outline'] || gd.STYLES.coastalOutline;
  }
  return gd.STYLES[region] || gd.STYLES.coastal;
}

/** Leaflet GeoJSON layer for all region polygons, populated by loadRegions(). */
var regionsLayer = null;

/**
 * Build the single combined Leaflet GeoJSON layer from the regions
 * FeatureCollection.  Each feature's style is driven by its region key.
 */
function buildRegionsLayer(geojson) {
  return L.geoJSON(geojson, {
    style: function (feature) {
      return regionStyle(feature.properties.region, hardinessActive);
    },
    onEachFeature: function (feature, layer) {
      var region = feature.properties.region;
      layer.on('click', function () {
        location.hash = '#detail/region/' + region;
      });
      layer.on('mouseover', function () {
        this.setStyle({ fillOpacity: gd.STYLES.regionHover.fillOpacity });
        this.getElement() && (this.getElement().style.cursor = 'pointer');
      });
      layer.on('mouseout', function () {
        this.setStyle({ fillOpacity: regionStyle(region, hardinessActive).fillOpacity });
      });
    },
  });
}

/**
 * Fetch data/regions.geojson and add the region layer to the map.
 * Sets map.getContainer().dataset.regionsLoaded = 'true' on success
 * so E2E tests can wait for the async load before interacting.
 */
function loadRegions() {
  fetch('data/regions.geojson')
    .then(function (r) { return r.json(); })
    .then(function (geojson) {
      regionsLayer = buildRegionsLayer(geojson);
      regionsLayer.addTo(map);
      riversLayer.bringToFront();
      if (map.hasLayer(fallLineLayer)) fallLineLayer.bringToFront();
      if (map.hasLayer(cityMarkersLayer)) cityMarkersLayer.bringToFront();
      setRegionMode(hardinessActive);
      map.getContainer().dataset.regionsLoaded = 'true';
    })
    .catch(function (err) {
      console.warn('regions.geojson load failed:', err);
      map.getContainer().dataset.regionsLoaded = 'error';
    });
}

var fallLineFeatureCollection = {
  type: 'FeatureCollection',
  features: [gd.FALL_LINE_GEOJSON, gd.NE_FALL_ZONE_GEOJSON],
};

var fallLineLayer = L.geoJSON(fallLineFeatureCollection, {
  style: gd.STYLES.fallLine,
  onEachFeature: function (feature, layer) {
    layer.on('click', function () {
      location.hash = '#detail/fallline';
    });
    layer.on('mouseover', function () {
      this.getElement() && (this.getElement().style.cursor = 'pointer');
    });
  },
});

/* ─── Rivers layer ──────────────────────────────────────────────
   Major Appalachian watershed rivers — lazy-built, shown by default.
   ────────────────────────────────────────────────────────────── */

var riversLayer = L.geoJSON(gd.MAJOR_RIVERS_GEOJSON, {
  style: gd.STYLES.rivers,
  onEachFeature: function (feature, layer) {
    var slug = feature.properties.slug;
    var name = feature.properties.name;
    layer.on('click', function () {
      location.hash = '#detail/river/' + slug;
    });
    layer.on('mouseover', function () {
      this.setStyle(gd.STYLES.riversHover);
      this.getElement() && (this.getElement().style.cursor = 'pointer');
    });
    layer.on('mouseout', function () {
      this.setStyle(gd.STYLES.rivers);
    });
    layer.bindTooltip(name, {
      direction: 'center',
      className: 'city-tooltip',
      sticky:    true,
    });
  },
});

// Add static layers first; loadRegions() inserts region fill below these.
riversLayer.addTo(map);
fallLineLayer.addTo(map);

// Async: fetch data/regions.geojson and build region overlay.
// Rivers + fall line are brought to front inside loadRegions() after regions load.
loadRegions();


/* ─── City marker layer ─────────────────────────────────────────
   One circleMarker per fall line / Appalachian metro.
   Uses FeatureGroup (not LayerGroup) so bringToFront() is available.
   ────────────────────────────────────────────────────────────── */

var CITY_MARKER_STYLE = {
  radius:      4,
  fillColor:   '#ffffff',
  color:       '#e84393',
  weight:      2,
  opacity:     1,
  fillOpacity: 0.9,
};

var cityMarkersLayer = L.featureGroup();

gd.CORRIDOR_CITIES.forEach(function (city) {
  var marker = L.circleMarker([city.lat, city.lon], CITY_MARKER_STYLE);
  var slug = (city.name + '-' + city.state).toLowerCase().replace(/\s+/g, '-');
  marker.on('click', function () {
    location.hash = '#detail/city/' + slug;
  });
  marker.bindTooltip(city.name + ', ' + city.state, {
    direction:  'top',
    offset:     L.point(0, -9),
    className:  'city-tooltip',
  });
  marker.on('mouseover', function () {
    this.setStyle({ radius: 6, fillColor: '#e84393', fillOpacity: 1 });
    this.getElement() && (this.getElement().style.cursor = 'pointer');
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
var hardinessActive = false;  // true while the zone layer is visible

/**
 * Toggle region layers between fill mode (default) and outline-only mode.
 * Outline mode is used when hardiness zones are active so zone fill colors
 * are not visually obscured by the region fill.
 * @param {boolean} outlineOnly
 */
function setRegionMode(outlineOnly) {
  if (!regionsLayer) return;
  regionsLayer.eachLayer(function (layer) {
    var region = layer.feature && layer.feature.properties && layer.feature.properties.region;
    if (!region) return;
    layer.setStyle(regionStyle(region, outlineOnly));
  });
}

var hardinessSpinner = document.getElementById('hardiness-spinner');
var hardinessLegend  = document.getElementById('hardiness-legend');
var hardinessHint    = document.getElementById('hardiness-hint');

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
    fillOpacity: 0.28,
    color:       gd.getZoneColor(zone),
    weight:      0.8,
    opacity:     0.5,
  };
}

function onEachHardinessFeature(feature, layer) {
  var zone = feature.properties.zone || 'unknown';
  layer.on('click', function () {
    location.hash = '#detail/zone/' + zone;
  });
  layer.on('mouseover', function () {
    this.getElement() && (this.getElement().style.cursor = 'pointer');
  });
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
      document.getElementById('toggle-hardiness').checked = false;
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
  if (!regionsLayer) return;
  if (this.checked) {
    regionsLayer.addTo(map);
    setRegionMode(hardinessActive);
    riversLayer.bringToFront();
    if (map.hasLayer(fallLineLayer)) fallLineLayer.bringToFront();
    if (map.hasLayer(cityMarkersLayer)) cityMarkersLayer.bringToFront();
  } else {
    map.removeLayer(regionsLayer);
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
  hardinessActive = this.checked;
  // Switch region shading: outlines when zones are active, fills when not.
  setRegionMode(hardinessActive);
  if (hardinessHint) hardinessHint.hidden = !hardinessActive;
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
    showStatus(displayName + ' is outside the current map coverage area.');
  } else {
    searchStatus.hidden = true;
    // Navigate to the location report detail page
    location.hash = '#detail/location/' + lat.toFixed(6) + '/' + lon.toFixed(6);
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
  [32.30, -85.40],   // SW — NW Georgia / Chattanooga area
  [44.40, -69.70],   // NE — Augusta ME (Kennebec River falls)
]);

// Run router on initial load (handles direct-load to /#detail/...)
navigate(location.hash);
