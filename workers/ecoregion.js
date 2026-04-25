// P3 #19 — /v1/ecoregion?lat=&lon=
// Point-in-polygon lookup: returns ecoregion, zone, soil, plants, invasives
// TODO: implement using geo-data.js constants bundled at build time

export async function handleEcoregion(params) {
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));

  if (isNaN(lat) || isNaN(lon)) {
    return Response.json({ error: 'lat and lon are required' }, { status: 400 });
  }

  // Hello world — replace with point-in-polygon against bundled geo-data constants (P3 #19)
  return Response.json({
    lat,
    lon,
    region: 'piedmont',
    name: 'Piedmont',
    zone: '7b',
    soilSeries: 'Cecil–Appling clay loam',
    nativePlants: ['Eastern Redbud', 'Virginia Bluebells', 'Spicebush'],
    invasives: ['Tree of Heaven', 'Japanese Honeysuckle'],
    watershedName: 'Upper James River',
    _note: 'hello world — static response, real lookup coming in P3 #19',
  });
}
