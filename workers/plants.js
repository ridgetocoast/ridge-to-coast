// workers/plants.js — /v1/plants?region=&type=
import core from '../app/lib/geo-data-core.js';

const VALID_TYPES = ['tree', 'shrub', 'perennial', 'grass', 'fern', 'vine'];

export async function handlePlants(request) {
  try {
    const params = new URL(request.url).searchParams;
    const region = params.get('region');
    const type = params.get('type');

    if (!region) {
      return Response.json({ error: 'region is required' }, { status: 400 });
    }
    if (type !== null && !VALID_TYPES.includes(type)) {
      return Response.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }
    const all = core.NATIVE_PLANTS[region];
    if (!all) {
      return Response.json({ error: 'Unknown region' }, { status: 404 });
    }

    const plants = type ? all.filter(p => p.type === type) : all;
    return Response.json({ region, type: type || null, plants });
  } catch (err) {
    console.error('handlePlants error', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
