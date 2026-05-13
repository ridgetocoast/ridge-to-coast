// workers/gardens.js — /v1/gardens (Overpass proxy + 24 h edge cache)
import core from '../app/lib/geo-data-core.js';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=86400, s-maxage=86400',
};

function buildGardenQuery() {
  const bbox = [
    core.BBOX_SOUTH.toFixed(4),
    core.BBOX_WEST.toFixed(4),
    core.BBOX_NORTH.toFixed(4),
    core.BBOX_EAST.toFixed(4),
  ].join(',');
  return (
    '[out:json][timeout:25];' +
    '(' +
      `node["leisure"="garden"](${bbox});` +
      `way["landuse"="allotments"](${bbox});` +
      `node["shop"="garden_centre"]["plant:native"="yes"](${bbox});` +
    ');' +
    'out center;'
  );
}

function gardenTypeLabel(tags) {
  if (tags.shop === 'garden_centre' && tags['plant:native'] === 'yes') return 'Native plant nursery';
  if (tags.landuse === 'allotments') return 'Allotment garden';
  return 'Community garden';
}

function gardenDisplayName(tags) {
  if (tags.name) return tags.name;
  if (tags.operator) return tags.operator;
  return gardenTypeLabel(tags);
}

function joinAddress(parts) { return parts.filter(Boolean).join(', '); }

function gardenAddress(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const locality = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || tags['addr:hamlet'] || '';
  const region   = tags['addr:state']    || '';
  const postcode = tags['addr:postcode'] || '';
  return joinAddress([street, locality, joinAddress([region, postcode])]) || 'Address not listed';
}

function normalizeElement(element) {
  const tags = element.tags || {};
  const lat = typeof element.lat === 'number'
    ? element.lat
    : (element.center && typeof element.center.lat === 'number' ? element.center.lat : null);
  const lon = typeof element.lon === 'number'
    ? element.lon
    : (element.center && typeof element.center.lon === 'number' ? element.center.lon : null);
  if (lat == null || lon == null) return null;
  return {
    osmId: `${element.type}-${element.id}`,
    lat, lon,
    name: gardenDisplayName(tags),
    type: gardenTypeLabel(tags),
    address: gardenAddress(tags),
  };
}

async function fetchAndNormalize() {
  const upstream = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'text/plain;charset=UTF-8' },
    body: buildGardenQuery(),
  });
  if (!upstream.ok) {
    throw new Error('Overpass HTTP ' + upstream.status);
  }
  const data = await upstream.json();
  const elements = Array.isArray(data && data.elements) ? data.elements : [];
  const seen = Object.create(null);
  const gardens = [];
  for (const el of elements) {
    const g = normalizeElement(el);
    if (!g || seen[g.osmId]) continue;
    seen[g.osmId] = true;
    gardens.push(g);
  }
  gardens.sort((a, b) => a.name.localeCompare(b.name));
  return {
    bbox: { south: core.BBOX_SOUTH, west: core.BBOX_WEST, north: core.BBOX_NORTH, east: core.BBOX_EAST },
    count: gardens.length,
    gardens,
  };
}

export async function handleGardens(request) {
  // caches.default is only present at the Cloudflare runtime, not in node:test.
  const hasCache = typeof caches !== 'undefined' && caches.default;
  const cacheKey = new Request(request.url);

  if (hasCache) {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  }

  let payload;
  try {
    payload = await fetchAndNormalize();
  } catch (err) {
    console.error('handleGardens upstream error', err);
    return Response.json({ error: 'Upstream Overpass unavailable' }, { status: 502 });
  }

  const response = Response.json(payload, { headers: CACHE_HEADERS });

  if (hasCache) {
    // ctx.waitUntil would be ideal but the router does not pass ctx through.
    // The cache.put promise is short-lived; await directly. Failures are non-fatal.
    try { await caches.default.put(cacheKey, response.clone()); } catch (_e) { /* ignore */ }
  }
  return response;
}
