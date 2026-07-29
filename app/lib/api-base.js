/**
 * api-base.js — resolves which Workers API to talk to
 * ----------------------------------------------------
 * Dependencies: NONE. No DOM APIs beyond window.location, no Leaflet, no fetch.
 *
 * Consumers:
 *   - Browser: loaded as <script> BEFORE map.js and before any page script that
 *     calls the API. Exposes window.API_BASE and window.ApiBase.
 *   - Node tests: CommonJS — module.exports = ApiBase.
 *
 * Lives here rather than inside map.js so the content pages (join.html and
 * friends) can reach the API without pulling in Leaflet and the whole map.
 *
 * Wrapped in an IIFE so internal const/let do not collide with map.js or
 * geo-data.js top-level lexical bindings.
 */
(function () {
  'use strict';

  var PRODUCTION_API = 'https://api.ridgetocoast.com';
  var ALPHA_API      = 'https://alpha.ridgetocoast.com';
  var PREPROD_API    = 'https://preprod.ridgetocoast.com';

  var LOCAL_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'];

  /**
   * @param {string} hostname — window.location.hostname
   * @returns {string} API origin, or '' meaning "same origin, use a relative URL"
   *
   * Local hostnames return '' because scripts/dev-server.mjs proxies /v1/* to a
   * local `wrangler dev`. Same-origin requests keep the page's own CSP
   * `connect-src 'self'` sufficient — no localhost entry in the meta tag, and no
   * CORS preflight. Callers concatenate (API_BASE + '/v1/...'), so '' yields a
   * root-relative path.
   */
  function resolveApiBase(hostname) {
    var host = String(hostname == null ? '' : hostname).toLowerCase();
    if (host === 'ridgetocoast.com' || host === 'www.ridgetocoast.com') return PRODUCTION_API;
    if (host === 'alpha.ridgetocoast.com') return ALPHA_API;
    if (LOCAL_HOSTNAMES.indexOf(host) !== -1) return '';
    return PREPROD_API;
  }

  var ApiBase = {
    resolveApiBase: resolveApiBase,
    PRODUCTION_API: PRODUCTION_API,
    ALPHA_API: ALPHA_API,
    PREPROD_API: PREPROD_API,
  };

  if (typeof window !== 'undefined') {
    window.ApiBase = ApiBase;
    window.API_BASE = resolveApiBase(window.location.hostname);
  }

  if (typeof module !== 'undefined') {
    module.exports = ApiBase;
  }
}());
