// Ridge to Coast API — Cloudflare Workers router
// Routes: /v1/ecoregion, /v1/calendar, /v1/plants, /v1/gardens, /v1/subscribe

import { handleEcoregion } from './ecoregion.js';
import { handleCalendar } from './calendar.js';
import { handlePlants } from './plants.js';
import { handleGardens } from './gardens.js';
import { handleSubscribe } from './subscribe.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  // `env` carries the D1 binding that /v1/subscribe needs. The four read-only
  // handlers keep their (request) signature — they depend on caches.default
  // rather than on bindings, so nothing about them changes.
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    let response;
    if (path.startsWith('/v1/ecoregion'))     response = await handleEcoregion(request);
    else if (path.startsWith('/v1/calendar'))  response = await handleCalendar(request);
    else if (path.startsWith('/v1/plants'))    response = await handlePlants(request);
    else if (path.startsWith('/v1/gardens'))   response = await handleGardens(request);
    else if (path.startsWith('/v1/subscribe')) response = await handleSubscribe(request, env);
    else if (path === '/' || path === '') {
      response = Response.json({
        api: 'Ridge to Coast',
        version: '1.2.0',
        status: 'ok',
        docs: 'https://github.com/ridgetocoast/ridge-to-coast/blob/main/api/openapi.yaml',
        endpoints: ['/v1/ecoregion', '/v1/calendar', '/v1/plants', '/v1/gardens', '/v1/subscribe'],
      });
    } else {
      response = Response.json({ error: 'Not found' }, { status: 404 });
    }

    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  },
};
