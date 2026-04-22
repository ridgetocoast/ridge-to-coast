// P3 #21 — /v1/plants?region=&type=
// Returns native plants for a region, optionally filtered by type
// TODO: bundle NATIVE_PLANTS from app/lib/geo-data.js at build time

const VALID_TYPES = ['tree', 'shrub', 'herbaceous', 'vine', 'graminoid', 'wildflower'];

export async function handlePlants(params) {
  const region = params.get('region');
  const type = params.get('type');

  if (!region) {
    return Response.json({ error: 'region is required' }, { status: 400 });
  }
  if (type && !VALID_TYPES.includes(type)) {
    return Response.json(
      { error: `type must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  // Stub — replace with NATIVE_PLANTS lookup
  return Response.json({
    region,
    type: type || null,
    plants: [],
    _status: 'not implemented — see P3 issue #21',
  }, { status: 501 });
}
