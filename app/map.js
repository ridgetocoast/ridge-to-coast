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
var detailRenderToken = 0;
var lastInteractiveLayerClickAt = 0;
var gardensCache = null;
var gardensIndex = Object.create(null);
var gardensLayer = null;
var gardensRequest = null;
var watershedHighlightLayer = null;

function markInteractiveLayerClick() {
  lastInteractiveLayerClickAt = Date.now();
}

function escapeHTML(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


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

function clearWatershedHighlight() {
  if (watershedHighlightLayer) {
    map.removeLayer(watershedHighlightLayer);
    watershedHighlightLayer = null;
  }
}

function highlightWatershedForLocation(lat, lon) {
  var watershed = gd.lookupWatershed(lat, lon);
  clearWatershedHighlight();
  if (!watershed || !watershed.feature) return;
  watershedHighlightLayer = L.geoJSON(watershed.feature, {
    style: {
      color: '#f4d35e',
      weight: 3,
      opacity: 0.95,
      fillColor: '#f4d35e',
      fillOpacity: 0.12,
      interactive: false,
    },
  }).addTo(map);
  watershedHighlightLayer.bringToFront();
}

function formatDateYYYYMMDD(date) {
  return date.toISOString().slice(0, 10);
}

function setInatBadgeText(text, token) {
  if (token !== detailRenderToken || !location.hash.startsWith('#detail/region/')) return;
  var badgeEl = document.getElementById('inat-count');
  if (badgeEl) badgeEl.textContent = text;
}

function populateRegionObservationBadge(region, token) {
  var placeId = gd.REGION_INATURALIST_PLACE_IDS[region];
  if (!placeId) {
    setInatBadgeText('Observation data unavailable', token);
    return;
  }

  var ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

  var params = new URLSearchParams({
    place_id: String(placeId),
    taxon_id: '47126',
    d1: formatDateYYYYMMDD(ninetyDaysAgo),
    quality_grade: 'research',
    per_page: '0',
  });

  fetch('https://api.inaturalist.org/v1/observations?' + params.toString())
    .then(function (response) {
      if (!response.ok) throw new Error('iNaturalist request failed');
      return response.json();
    })
    .then(function (data) {
      if (!data || typeof data.total_results !== 'number') {
        throw new Error('iNaturalist payload missing total_results');
      }
      setInatBadgeText(String(data.total_results), token);
    })
    .catch(function () {
      setInatBadgeText('Observation data unavailable', token);
    });
}

function findRiverBySlug(slug) {
  for (var i = 0; i < gd.MAJOR_RIVERS_GEOJSON.features.length; i++) {
    var river = gd.MAJOR_RIVERS_GEOJSON.features[i].properties;
    if (river.slug === slug) return river;
  }
  return null;
}

function setRiverFlowText(slug, text, token) {
  if (token !== detailRenderToken || location.hash !== '#detail/river/' + slug) return;
  var flowEl = document.getElementById('flow-' + slug);
  if (flowEl) flowEl.textContent = text;
}

function classifyRiverFlow(dischargeCfs) {
  if (dischargeCfs < 500) return 'Low flow';
  if (dischargeCfs < 5000) return 'Moderate flow';
  if (dischargeCfs < 20000) return 'Elevated flow';
  return 'Very high flow';
}

function extractDischargeCfs(data) {
  if (!data || !data.value || !Array.isArray(data.value.timeSeries) || !data.value.timeSeries.length) {
    return null;
  }
  var series = data.value.timeSeries[0];
  var values = series && Array.isArray(series.values) ? series.values : null;
  if (!values || !values.length || !Array.isArray(values[0].value) || !values[0].value.length) {
    return null;
  }
  var rawValue = values[0].value[0] && values[0].value[0].value;
  var dischargeCfs = Number(rawValue);
  return isFinite(dischargeCfs) ? dischargeCfs : null;
}

function populateRiverFlow(slug, token) {
  var river = findRiverBySlug(slug);
  if (!river || !river.usgsGaugeId) {
    setRiverFlowText(slug, 'Flow data unavailable', token);
    return;
  }

  var params = new URLSearchParams({
    format: 'json',
    sites: river.usgsGaugeId,
    parameterCd: '00060',
  });

  fetch('https://waterservices.usgs.gov/nwis/iv/?' + params.toString())
    .then(function (response) {
      if (!response.ok) throw new Error('USGS request failed');
      return response.json();
    })
    .then(function (data) {
      var dischargeCfs = extractDischargeCfs(data);
      if (dischargeCfs === null) throw new Error('USGS payload missing discharge');
      var flowText = Math.round(dischargeCfs).toLocaleString('en-US') +
        ' cfs - ' + classifyRiverFlow(dischargeCfs);
      setRiverFlowText(slug, flowText, token);
    })
    .catch(function () {
      setRiverFlowText(slug, 'Flow data unavailable', token);
    });
}

function formatCoordForHash(value) {
  return Number(value).toFixed(4);
}

function parseZoneRoute(parts) {
  var zone = parts[2];
  var lat = parseFloat(parts[3]);
  var lon = parseFloat(parts[4]);
  if (!zone) return null;
  return {
    zone: zone,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
  };
}

function describePlantingWindow(periods) {
  var overnightPeriods = periods.filter(function (period) {
    return period && typeof period.temperature === 'number' && period.isDaytime === false;
  }).slice(0, 7);

  if (!overnightPeriods.length) return '';

  var riskyPeriod = null;
  for (var i = 0; i < overnightPeriods.length; i++) {
    var period = overnightPeriods[i];
    var forecastText = ((period.shortForecast || '') + ' ' + (period.detailedForecast || '')).toLowerCase();
    if (period.temperature <= 36 || forecastText.indexOf('frost') !== -1 || forecastText.indexOf('freeze') !== -1) {
      riskyPeriod = period;
      break;
    }
  }

  if (riskyPeriod) {
    return 'Plant now? Hold off. ' + riskyPeriod.name + ' could dip to about ' +
      riskyPeriod.temperature + '\u00b0F.';
  }

  var coolestNight = overnightPeriods.reduce(function (coolest, period) {
    return !coolest || period.temperature < coolest.temperature ? period : coolest;
  }, null);

  return 'Plant now? Probably yes. No forecast overnight lows below 36\u00b0F in the next 7 days' +
    (coolestNight ? ' (coolest night about ' + coolestNight.temperature + '\u00b0F).' : '.');
}

function hydrateZoneFrostAdvisory(lat, lon, token, expectedHash) {
  fetch('https://api.weather.gov/points/' + lat + ',' + lon)
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' loading NWS point metadata');
      return response.json();
    })
    .then(function (payload) {
      var forecastUrl = payload && payload.properties && payload.properties.forecast;
      if (!forecastUrl) throw new Error('NWS point response missing forecast URL');
      return fetch(forecastUrl);
    })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' loading NWS forecast');
      return response.json();
    })
    .then(function (payload) {
      if (token !== detailRenderToken || location.hash !== expectedHash) return;
      var advisoryEl = document.getElementById('zone-frost-advisory');
      if (!advisoryEl) return;
      var periods = payload && payload.properties && Array.isArray(payload.properties.periods)
        ? payload.properties.periods
        : [];
      advisoryEl.textContent = periods.length ? describePlantingWindow(periods) : 'Forecast unavailable.';
    })
    .catch(function () {
      if (token !== detailRenderToken || location.hash !== expectedHash) return;
      var advisoryEl = document.getElementById('zone-frost-advisory');
      if (advisoryEl) advisoryEl.textContent = 'Forecast unavailable.';
    });
}

/**
 * Parse location.hash and render the appropriate view.
 * Hash format: #detail/<type>/<key>
 *   type = region | zone | city | fallline | river | location | garden
 *   key  = region name | zone code | city-slug | lat/lon
 */
function navigate(hash) {
  detailRenderToken += 1;
  var renderToken = detailRenderToken;
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
  var zoneRoute = null;
  if (type !== 'location') {
    clearWatershedHighlight();
  }
  if (type === 'region') {
    html = gd.makeRegionDetailHTML(parts[2]);
  } else if (type === 'zone') {
    zoneRoute = parseZoneRoute(parts);
    if (zoneRoute) {
      html = gd.makeZoneDetailHTML(zoneRoute.zone, zoneRoute.lat, zoneRoute.lon);
    }
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
      highlightWatershedForLocation(lat, lon);
      html = gd.makeLocationReport(lat, lon);
    } else {
      clearWatershedHighlight();
    }
  } else if (type === 'garden') {
    clearWatershedHighlight();
    var osmId = decodeURIComponent(parts[2] || '');
    if (osmId && gardensIndex[osmId]) {
      html = gd.makeGardenDetailHTML(gardensIndex[osmId]);
    } else if (osmId) {
      showDetailView(
        '<article class="detail-page">' +
          '<div class="detail-region-header" style="border-left:4px solid #2d6a4f;padding-left:12px;margin-bottom:0.75rem">' +
            '<h2 class="detail-title" style="margin-bottom:0">Loading garden details...</h2>' +
          '</div>' +
          '<p class="detail-description">Looking up this OpenStreetMap listing.</p>' +
        '</article>'
      );
      ensureGardensLoaded().then(function () {
        if (renderToken !== detailRenderToken || location.hash !== hash) return;
        var garden = gardensIndex[osmId];
        if (garden) {
          showDetailView(gd.makeGardenDetailHTML(garden));
        } else {
          showMapView();
        }
      }).catch(function () {
        if (renderToken !== detailRenderToken || location.hash !== hash) return;
        showMapView();
      });
      return;
    }
  }
  if (html) {
    showDetailView(html);
    if (type === 'region') {
      populateRegionObservationBadge(parts[2], renderToken);
    } else if (type === 'river') {
      populateRiverFlow(parts[2], renderToken);
    } else if (type === 'zone' && zoneRoute && zoneRoute.lat !== null && zoneRoute.lon !== null) {
      hydrateZoneFrostAdvisory(zoneRoute.lat, zoneRoute.lon, renderToken, hash);
    }
  } else {
    clearWatershedHighlight();
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
window.ridgeMap = map;

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
        markInteractiveLayerClick();
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
      markInteractiveLayerClick();
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
      markInteractiveLayerClick();
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
    markInteractiveLayerClick();
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


/* ─── Community gardens / native nurseries layer ───────────────
   Backed by OpenStreetMap via Overpass. Loaded lazily on demand and cached
   in memory so the toggle does not re-fetch after the first successful load.
   ────────────────────────────────────────────────────────────── */

var GARDEN_MARKER_STYLE = {
  radius:      6,
  fillColor:   '#2d6a4f',
  color:       '#b7e4c7',
  weight:      1.5,
  opacity:     0.95,
  fillOpacity: 0.9,
};

function gardenTypeLabel(tags) {
  if (tags.shop === 'garden_centre' && tags['plant:native'] === 'yes') {
    return 'Native plant nursery';
  }
  if (tags.landuse === 'allotments') {
    return 'Allotment garden';
  }
  return 'Community garden';
}

function gardenDisplayName(tags) {
  if (tags.name) return tags.name;
  if (tags.operator) return tags.operator;
  return gardenTypeLabel(tags);
}

function joinAddress(parts) {
  return parts.filter(function (part) { return part; }).join(', ');
}

function gardenAddress(tags) {
  var streetLine = [tags['addr:housenumber'], tags['addr:street']]
    .filter(function (part) { return part; })
    .join(' ');
  var locality = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || tags['addr:hamlet'] || '';
  var region = tags['addr:state'] || '';
  var postcode = tags['addr:postcode'] || '';
  return joinAddress([streetLine, locality, joinAddress([region, postcode])]) || 'Address not listed';
}

function normalizeGardenElement(element) {
  var tags = element.tags || {};
  var lat = typeof element.lat === 'number'
    ? element.lat
    : element.center && typeof element.center.lat === 'number'
      ? element.center.lat
      : null;
  var lon = typeof element.lon === 'number'
    ? element.lon
    : element.center && typeof element.center.lon === 'number'
      ? element.center.lon
      : null;

  if (lat == null || lon == null) return null;

  return {
    osmId: element.type + '-' + element.id,
    lat: lat,
    lon: lon,
    name: gardenDisplayName(tags),
    type: gardenTypeLabel(tags),
    address: gardenAddress(tags),
  };
}

function buildGardensLayer(gardens) {
  var layer = L.featureGroup();

  gardens.forEach(function (garden) {
    var marker = L.circleMarker([garden.lat, garden.lon], GARDEN_MARKER_STYLE);

    marker.on('click', function () {
      markInteractiveLayerClick();
      location.hash = '#detail/garden/' + encodeURIComponent(garden.osmId);
    });
    marker.on('mouseover', function () {
      this.setStyle({ radius: 7, fillOpacity: 1 });
      this.getElement() && (this.getElement().style.cursor = 'pointer');
    });
    marker.on('mouseout', function () {
      this.setStyle(GARDEN_MARKER_STYLE);
    });
    marker.bindTooltip(escapeHTML(garden.name), {
      direction: 'top',
      offset: L.point(0, -10),
      className: 'city-tooltip',
    });

    layer.addLayer(marker);
  });

  return layer;
}

function buildGardenQuery() {
  var bbox = [
    gd.BBOX.SOUTH.toFixed(4),
    gd.BBOX.WEST.toFixed(4),
    gd.BBOX.NORTH.toFixed(4),
    gd.BBOX.EAST.toFixed(4)
  ].join(',');

  return (
    '[out:json][timeout:25];' +
    '(' +
      'node["leisure"="garden"](' + bbox + ');' +
      'way["landuse"="allotments"](' + bbox + ');' +
      'node["shop"="garden_centre"]["plant:native"="yes"](' + bbox + ');' +
    ');' +
    'out center;'
  );
}

function ensureGardensLoaded() {
  if (gardensCache) return Promise.resolve(gardensCache);
  if (gardensRequest) return gardensRequest;

  gardensRequest = fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'text/plain;charset=UTF-8',
    },
    body: buildGardenQuery(),
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' loading Overpass garden data');
      }
      return response.json();
    })
    .then(function (data) {
      var gardens = [];
      var nextIndex = Object.create(null);
      var elements = data && Array.isArray(data.elements) ? data.elements : [];

      elements.forEach(function (element) {
        var garden = normalizeGardenElement(element);
        if (!garden || nextIndex[garden.osmId]) return;
        nextIndex[garden.osmId] = garden;
        gardens.push(garden);
      });

      gardens.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });

      gardensCache = gardens;
      gardensIndex = nextIndex;
      gardensLayer = buildGardensLayer(gardens);
      return gardens;
    })
    .finally(function () {
      gardensRequest = null;
    });

  return gardensRequest;
}

function showGardensLayer() {
  ensureGardensLoaded()
    .then(function () {
      if (!document.getElementById('toggle-gardens').checked || !gardensLayer) return;
      gardensLayer.addTo(map);
      gardensLayer.bringToFront();
    })
    .catch(function () {
      document.getElementById('toggle-gardens').checked = false;
    });
}


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
  layer.on('click', function (event) {
    markInteractiveLayerClick();
    var lat = event && event.latlng ? formatCoordForHash(event.latlng.lat) : null;
    var lon = event && event.latlng ? formatCoordForHash(event.latlng.lng) : null;
    location.hash = lat !== null && lon !== null
      ? '#detail/zone/' + zone + '/' + lat + '/' + lon
      : '#detail/zone/' + zone;
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

document.getElementById('toggle-gardens').addEventListener('change', function () {
  if (this.checked) {
    showGardensLayer();
  } else if (gardensLayer) {
    map.removeLayer(gardensLayer);
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

map.on('click', function (e) {
  if (Date.now() - lastInteractiveLayerClickAt < 250) {
    return;
  }
  location.hash = '#detail/location/' + e.latlng.lat.toFixed(4) + '/' + e.latlng.lng.toFixed(4);
});


/* ─── Initial viewport — fit full fall line corridor ─────────── */
map.fitBounds([
  [32.30, -85.40],   // SW — NW Georgia / Chattanooga area
  [44.40, -69.70],   // NE — Augusta ME (Kennebec River falls)
]);

// Run router on initial load (handles direct-load to /#detail/...)
navigate(location.hash);

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('Service worker registration failed:', err);
    });
  });
}
