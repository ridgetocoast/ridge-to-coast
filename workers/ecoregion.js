// P3 #19 — /v1/ecoregion?lat=&lon=
// Point-in-polygon lookup: returns ecoregion, zone, soil, plants, invasives
// TODO: implement using geo-data.js constants bundled at build time

export async function handleEcoregion(params) {
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));

  if (isNaN(lat) || isNaN(lon)) {
    return Response.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  // Stub — replace with point-in-polygon against bundled geo-data constants
  return Response.json({
    region: null,
    name: null,
    zone: null,
    soilSeries: null,
    nativePlants: [],
    invasives: [],
    watershedName: null,
    _status: 'not implemented — see P3 issue #19',
  }, { status: 501 });
}
