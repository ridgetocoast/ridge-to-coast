/**
 * join.js — newsletter signup
 * ----------------------------
 * Depends on lib/api-base.js (window.API_BASE) and lib/prefs.js (window.Prefs),
 * both loaded before this script.
 *
 * The form is submitted with fetch(), never a native POST — the page's CSP sets
 * `form-action 'none'`, which is deliberate: it means a script injection cannot
 * repoint the form at another origin.
 */
'use strict';

(function () {
  if (typeof window.API_BASE === 'undefined') {
    throw new Error('lib/api-base.js failed to load');
  }

  var form       = document.getElementById('join-form');
  var emailInput = document.getElementById('email');
  var zoneInput  = document.getElementById('zone');
  var consent    = document.getElementById('consent');
  var honeypot   = document.getElementById('website');
  var submitBtn  = document.getElementById('submit-btn');
  var errorBox   = document.getElementById('form-error');
  var okBox      = document.getElementById('form-ok');

  // Pre-fill the zone from the reader's saved settings — one less thing to
  // answer. Never pre-fills the email: that is not ours to guess.
  if (typeof window.Prefs !== 'undefined') {
    var savedZone = window.Prefs.get('zone');
    if (savedZone) zoneInput.value = savedZone;
  }

  /**
   * Deliberately permissive. The server validates properly and the confirmation
   * email is the real test — an address that cannot receive mail never confirms.
   * This only catches obvious typos before a round trip.
   */
  function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    okBox.hidden = true;
  }

  function showSuccess(message) {
    okBox.textContent = message;
    okBox.hidden = false;
    errorBox.hidden = true;
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Sending…' : 'Send me the confirmation link';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    errorBox.hidden = true;
    okBox.hidden = true;

    var email = emailInput.value.trim();

    if (!email) {
      showError('Enter your email address.');
      emailInput.focus();
      return;
    }
    if (!looksLikeEmail(email)) {
      showError('That does not look like an email address. Check it and try again.');
      emailInput.focus();
      return;
    }
    if (!consent.checked) {
      showError('Tick the box to confirm you want the monthly note.');
      consent.focus();
      return;
    }

    setBusy(true);

    fetch(window.API_BASE + '/v1/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        zone: zoneInput.value || null,
        consent: true,
        website: honeypot.value,   // honeypot; a real person leaves this empty
        source: 'join.html',
      }),
    })
      .then(function (response) {
        if (response.status === 202) return response.json().catch(function () { return {}; });
        return response.json()
          .catch(function () { return {}; })
          .then(function (body) {
            throw new Error(body.error || 'Signup failed (' + response.status + ')');
          });
      })
      .then(function () {
        form.hidden = true;
        showSuccess(
          'Check your inbox. We have sent a confirmation link to ' + email +
          ' — you are on the list once you click it.'
        );
        okBox.focus && okBox.focus();

        // Remember the zone locally so the map and this form agree next time.
        if (typeof window.Prefs !== 'undefined' && zoneInput.value) {
          window.Prefs.set('zone', zoneInput.value);
        }
      })
      .catch(function (err) {
        setBusy(false);
        showError(
          err && err.message && err.message !== 'Failed to fetch'
            ? err.message
            : 'Could not reach the server. Check your connection and try again.'
        );
      });
  });
}());
