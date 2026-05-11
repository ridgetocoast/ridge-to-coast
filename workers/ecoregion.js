// workers/ecoregion.js — /v1/ecoregion?lat=&lon=
import core from '../app/lib/geo-data-core.js';

const BBOX = {
  NORTH: 49,
  SOUTH: 24,
  EAST: -66.5,
  WEST: -92.2,
};

export async function handleEcoregion(request) {
  try {
    const params = new URL(request.url).searchParams;
    const lat = parseFloat(params.get('lat'));
    const lon = parseFloat(params.get('lon'));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return Response.json({ error: 'lat and lon are required and must be numeric' }, { status: 400 });
    }

    if (lat < BBOX.SOUTH || lat > BBOX.NORTH || lon < BBOX.WEST || lon > BBOX.EAST) {
      return Response.json({ error: 'Coordinate outside coverage area' }, { status: 404 });
    }

    const region = core.classifyLocation(lat, lon);
    if (!region || !core.REGION_LABELS[region]) {
      return Response.json({ error: 'Coordinate outside coverage area' }, { status: 404 });
    }

    const nearestCity = core.nearestCorridorCity(lat, lon);
    const zone = (nearestCity && nearestCity.zone) || '7b';

    const watershed = core.lookupWatershed(lat, lon);
    const watershedName = watershed && watershed.name ? watershed.name : null;

    const soilEntry = core.SOIL_TYPES[region];
    const soilSeries = soilEntry && soilEntry.series ? soilEntry.series : null;

    const nativePlants = (core.NATIVE_PLANTS[region] || []).slice(0, 3).map(p => p.name);
    const invasives = (core.INVASIVE_SPECIES[region] || []).map(s => s.name);

    return Response.json({
      lat,
      lon,
      region,
      name: core.REGION_LABELS[region],
      zone,
      soilSeries,
      nativePlants,
      invasives,
      watershedName,
    });
  } catch (err) {
    console.error('handleEcoregion error', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
