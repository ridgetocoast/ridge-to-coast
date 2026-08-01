/**
 * preferences.js — the settings page
 * -----------------------------------
 * Depends on lib/prefs.js (window.Prefs), loaded before this script.
 * Every control writes straight through to local storage; there is no Save
 * button because there is nothing to submit anywhere.
 */
'use strict';

(function () {
  if (typeof window.Prefs === 'undefined') {
    throw new Error('lib/prefs.js failed to load');
  }

  var prefs = window.Prefs;

  var form          = document.getElementById('prefs-form');
  var jsonBox       = document.getElementById('prefs-json');
  var savedNotice   = document.getElementById('saved-notice');
  var jsonError     = document.getElementById('json-error');
  var jsonOk        = document.getElementById('json-ok');
  var homeSummary   = document.getElementById('home-summary');
  var clearHomeBtn  = document.getElementById('clear-home');
  var applyJsonBtn  = document.getElementById('apply-json');
  var resetBtn      = document.getElementById('reset-all');
  var storageWarn   = document.getElementById('storage-warning');

  var savedTimer = null;

  if (prefs.isMemoryFallback) storageWarn.hidden = false;

  function flash(el, message) {
    if (message) el.textContent = message;
    el.hidden = false;
    if (el === savedNotice) {
      window.clearTimeout(savedTimer);
      savedTimer = window.setTimeout(function () { el.hidden = true; }, 1800);
    }
  }

  function describeHome(home) {
    if (!home) return 'Not set.';
    var coords = home.lat.toFixed(4) + ', ' + home.lon.toFixed(4);
    return home.label ? home.label + ' (' + coords + ')' : coords;
  }

  /** Push stored values into the controls. */
  function render() {
    var all = prefs.all();

    var controls = form.querySelectorAll('[data-pref]');
    for (var i = 0; i < controls.length; i++) {
      var control = controls[i];
      var value = prefs.get(control.getAttribute('data-pref'));
      if (control.type === 'checkbox') {
        control.checked = value === true;
      } else {
        control.value = value === null || value === undefined ? '' : String(value);
      }
    }

    homeSummary.textContent = describeHome(all.home);
    clearHomeBtn.disabled = !all.home;
    jsonBox.value = prefs.toJSON();
  }

  form.addEventListener('change', function (event) {
    var control = event.target.closest('[data-pref]');
    if (!control) return;

    var path = control.getAttribute('data-pref');
    var value = control.type === 'checkbox'
      ? control.checked
      : (control.value === '' ? null : control.value);

    // prefs.set notifies subscribers, and render() is subscribed — so the JSON
    // box and the home summary refresh without doing it again here.
    prefs.set(path, value);
    flash(savedNotice);
  });

  clearHomeBtn.addEventListener('click', function () {
    prefs.set('home', null);
    render();
    flash(savedNotice, 'Home location cleared.');
  });

  applyJsonBtn.addEventListener('click', function () {
    jsonError.hidden = true;
    jsonOk.hidden = true;

    if (prefs.fromJSON(jsonBox.value)) {
      render();
      flash(jsonOk, 'Settings applied.');
    } else {
      flash(jsonError, 'That is not a valid settings object. Check the JSON and try again.');
    }
  });

  resetBtn.addEventListener('click', function () {
    var confirmed = window.confirm(
      'Erase all saved settings in this browser? The map will go back to its defaults.'
    );
    if (!confirmed) return;
    prefs.reset();
    render();
    flash(jsonOk, 'All settings erased.');
  });

  // Another tab changed the settings — keep this page honest.
  prefs.subscribe(render);

  render();
}());
