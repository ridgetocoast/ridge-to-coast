// Ridge to Coast API — Cloudflare Workers router
// Routes: /v1/ecoregion, /v1/calendar, /v1/plants

import { handleEcoregion } from './ecoregion.js';
import { handleCalendar } from './calendar.js';
import { handlePlants } from './plants.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    let response;
    if (path.startsWith('/v1/ecoregion')) {
      response = await handleEcoregion(url.searchParams);
    } else if (path.startsWith('/v1/calendar')) {
      response = await handleCalendar(url.searchParams);
    } else if (path.startsWith('/v1/plants')) {
      response = await handlePlants(url.searchParams);
    } else {
      response = Response.json({ error: 'Not found' }, { status: 404 });
    }

    // Attach CORS headers to every response
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  },
};
