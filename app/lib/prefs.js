/**
 * prefs.js — device-local user preferences
 * -----------------------------------------
 * Dependencies: NONE. No DOM beyond localStorage, no Leaflet, no fetch.
 *
 * Everything here stays on the reader's own device. There are no accounts and
 * nothing is ever sent to a server — see app/privacy.html.
 *
 * Consumers:
 *   - Browser: loaded as <script>. Exposes window.Prefs (bound to localStorage)
 *     and window.PrefsCore (the pure logic + createPrefs factory).
 *   - Node tests: CommonJS — module.exports = PrefsCore, so createPrefs() can be
 *     driven with a fake storage and no jsdom.
 *
 * Wrapped in an IIFE so internal const/let do not collide with map.js or
 * geo-data.js top-level lexical bindings.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'r2c.prefs.v1';
  var SCHEMA_VERSION = 1;

  // Mirrors the checkbox defaults in index.html. Changing one means changing
  // both — app/tests/site.test.js asserts they agree.
  function defaults() {
    return {
      version: SCHEMA_VERSION,
      layers: {
        regions: true,
        fallline: true,
        cities: true,
        hardiness: false,
        gardens: false,
      },
      home: null,             // { lat, lon, label }
      zone: null,             // '7b'
      units: 'F',             // 'F' | 'C'
      legendCollapsed: false,
    };
  }

  var LAYER_KEYS = ['regions', 'fallline', 'cities', 'hardiness', 'gardens'];
  var ZONE_PATTERN = /^(?:[3-9]|1[0-3])[ab]$/;

  /* ─── Validation ──────────────────────────────────────────────
     Every value that comes back out of storage is untrusted: a user can edit
     localStorage by hand, and an old build may have written a shape we no
     longer use. Anything that fails validation falls back to its default
     rather than propagating a bad value into the map. */

  function isBool(v) { return v === true || v === false; }
  function isFiniteNumber(v) { return typeof v === 'number' && isFinite(v); }

  function validHome(v) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'object') return null;
    if (!isFiniteNumber(v.lat) || v.lat < -90 || v.lat > 90) return null;
    if (!isFiniteNumber(v.lon) || v.lon < -180 || v.lon > 180) return null;
    var label = typeof v.label === 'string' ? v.label.slice(0, 120) : '';
    return { lat: v.lat, lon: v.lon, label: label };
  }

  function validZone(v) {
    if (typeof v !== 'string') return null;
    var zone = v.trim().toLowerCase();
    return ZONE_PATTERN.test(zone) ? zone : null;
  }

  function validUnits(v) { return v === 'C' ? 'C' : 'F'; }

  /**
   * Fold whatever was in storage onto a fresh set of defaults, dropping unknown
   * keys and coercing bad values. Pure — safe to unit test directly.
   */
  function mergeDefaults(stored) {
    var out = defaults();
    if (!stored || typeof stored !== 'object') return out;

    if (stored.layers && typeof stored.layers === 'object') {
      for (var i = 0; i < LAYER_KEYS.length; i++) {
        var key = LAYER_KEYS[i];
        if (isBool(stored.layers[key])) out.layers[key] = stored.layers[key];
      }
    }
    out.home = validHome(stored.home);
    out.zone = validZone(stored.zone);
    if (stored.units !== undefined) out.units = validUnits(stored.units);
    if (isBool(stored.legendCollapsed)) out.legendCollapsed = stored.legendCollapsed;
    return out;
  }

  /**
   * Bring an older stored shape up to the current schema. Currently a no-op
   * beyond stamping the version, because v1 is the first schema — the seam
   * exists so a future change has an obvious place to live.
   */
  function migrate(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var migrated = raw;
    // future: if (migrated.version === 1) { ...; migrated.version = 2; }
    migrated.version = SCHEMA_VERSION;
    return migrated;
  }

  /* ─── Path access ─────────────────────────────────────────── */

  function getPath(obj, path) {
    var parts = String(path).split('.');
    var node = obj;
    for (var i = 0; i < parts.length; i++) {
      if (node === null || typeof node !== 'object') return undefined;
      node = node[parts[i]];
    }
    return node;
  }

  function setPath(obj, path, value) {
    var parts = String(path).split('.');
    var node = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var part = parts[i];
      if (node[part] === null || typeof node[part] !== 'object') node[part] = {};
      node = node[part];
    }
    node[parts[parts.length - 1]] = value;
    return obj;
  }

  /* ─── Storage ─────────────────────────────────────────────── */

  /**
   * A storage that behaves like localStorage but never throws and never
   * persists. Used when localStorage is unavailable — Safari private browsing
   * throws on write, and some embedded webviews block it entirely. Settings
   * then last for the session instead of breaking the page.
   */
  function memoryStorage() {
    var map = Object.create(null);
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
      setItem: function (k, v) { map[k] = String(v); },
      removeItem: function (k) { delete map[k]; },
      isMemoryFallback: true,
    };
  }

  function detectStorage() {
    try {
      var probe = '__r2c_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (_e) {
      return memoryStorage();
    }
  }

  /* ─── Factory ─────────────────────────────────────────────── */

  /**
   * @param {object} storage — anything with getItem/setItem/removeItem.
   * @returns the Prefs API bound to that storage.
   */
  function createPrefs(storage) {
    var listeners = [];
    var cache = null;

    function read() {
      if (cache) return cache;
      var raw = null;
      try {
        var text = storage.getItem(STORAGE_KEY);
        raw = text ? JSON.parse(text) : null;
      } catch (_e) {
        raw = null; // corrupt JSON — fall back to defaults rather than throwing
      }
      cache = mergeDefaults(migrate(raw));
      return cache;
    }

    function write(next) {
      cache = next;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (_e) {
        // Quota exceeded or storage disabled mid-session. The in-memory cache
        // still holds the value, so the current session behaves normally.
      }
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](next); } catch (_e) { /* a bad listener must not break the rest */ }
      }
    }

    return {
      STORAGE_KEY: STORAGE_KEY,

      all: function () { return JSON.parse(JSON.stringify(read())); },

      get: function (path) { return getPath(read(), path); },

      /** Set one value by dotted path, e.g. set('layers.hardiness', true). */
      set: function (path, value) {
        var next = JSON.parse(JSON.stringify(read()));
        setPath(next, path, value);
        write(mergeDefaults(next));
        return this.all();
      },

      /** Merge a partial object, e.g. setAll({ units: 'C', zone: '7b' }). */
      setAll: function (partial) {
        var current = JSON.parse(JSON.stringify(read()));
        var merged = Object.assign({}, current, partial || {});
        if (partial && partial.layers) {
          merged.layers = Object.assign({}, current.layers, partial.layers);
        }
        write(mergeDefaults(merged));
        return this.all();
      },

      reset: function () {
        try { storage.removeItem(STORAGE_KEY); } catch (_e) { /* nothing to undo */ }
        cache = null;
        var fresh = read();
        for (var i = 0; i < listeners.length; i++) {
          try { listeners[i](fresh); } catch (_e) { /* ignore */ }
        }
        return this.all();
      },

      subscribe: function (fn) {
        if (typeof fn !== 'function') return function () {};
        listeners.push(fn);
        return function unsubscribe() {
          var idx = listeners.indexOf(fn);
          if (idx !== -1) listeners.splice(idx, 1);
        };
      },

      /**
       * Drop the cache so the next read re-parses storage (another tab wrote),
       * then notify listeners — the whole point of calling this is that the
       * values may have changed underneath us.
       */
      refresh: function () {
        cache = null;
        var fresh = read();
        for (var i = 0; i < listeners.length; i++) {
          try { listeners[i](fresh); } catch (_e) { /* ignore */ }
        }
        return this.all();
      },

      toJSON: function () { return JSON.stringify(read(), null, 2); },

      /** @returns {boolean} whether the import was accepted. */
      fromJSON: function (text) {
        var parsed;
        try { parsed = JSON.parse(text); } catch (_e) { return false; }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
        write(mergeDefaults(migrate(parsed)));
        return true;
      },

      isMemoryFallback: !!storage.isMemoryFallback,
    };
  }

  var PrefsCore = {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    LAYER_KEYS: LAYER_KEYS,
    defaults: defaults,
    mergeDefaults: mergeDefaults,
    migrate: migrate,
    validHome: validHome,
    validZone: validZone,
    validUnits: validUnits,
    getPath: getPath,
    setPath: setPath,
    memoryStorage: memoryStorage,
    createPrefs: createPrefs,
  };

  if (typeof window !== 'undefined') {
    window.PrefsCore = PrefsCore;
    window.Prefs = createPrefs(detectStorage());

    // Another tab changed the settings — drop the cache and tell listeners.
    window.addEventListener('storage', function (event) {
      if (event.key === STORAGE_KEY) window.Prefs.refresh();
    });
  }

  if (typeof module !== 'undefined') {
    module.exports = PrefsCore;
  }
}());
