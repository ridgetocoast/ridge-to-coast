// P3 #21 — /v1/plants?region=&type=
// Returns native plants for a region, optionally filtered by type
// TODO: bundle NATIVE_PLANTS from app/lib/geo-data.js at build time

const VALID_TYPES = ['tree', 'shrub', 'herbaceous', 'vine', 'graminoid', 'wildflower'];

export async function handlePlants(request) {
  const params = new URL(request.url).searchParams;
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

  // Hello world — replace with NATIVE_PLANTS lookup (P3 #21)
  return Response.json({
    region,
    type: type || null,
    plants: [
      { name: 'Eastern Redbud', latin: 'Cercis canadensis', type: 'tree', note: 'Early spring bloomer, understory tree' },
      { name: 'Virginia Bluebells', latin: 'Mertensia virginica', type: 'herbaceous', note: 'Spring ephemeral, moist bottomlands' },
      { name: 'Spicebush', latin: 'Lindera benzoin', type: 'shrub', note: 'Host plant for Spicebush Swallowtail' },
    ],
    _note: 'hello world — static response, real lookup coming in P3 #21',
  });
}
