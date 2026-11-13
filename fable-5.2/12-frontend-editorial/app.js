/*
 * Margin — Issue 14
 *
 * Three small behaviours, no dependencies, no network:
 *   1. Reading mode (Paper / Night), remembered between visits.
 *   2. The gauge marker in the margin, which tracks how far down you've read.
 *   3. The subscription email field: inline validation and a success state.
 *      Nothing is submitted or stored anywhere.
 *
 * The file is loaded synchronously in <head> so that step 1 can set the mode
 * before the first paint. Everything that touches the body waits for the DOM.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  /* ------------------------------------------------------------------ *
   * 1. Reading mode
   * ------------------------------------------------------------------ */

  var MODE_KEY = 'margin.reading-mode';
  var MODES = ['paper', 'night'];
  var THEME_COLOR = { paper: '#f0eadd', night: '#15140f' };
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function savedMode() {
    try {
      var value = window.localStorage.getItem(MODE_KEY);
      return MODES.indexOf(value) !== -1 ? value : null;
    } catch (err) {
      return null; // storage blocked (private mode, file:// in some browsers)
    }
  }

  function saveMode(mode) {
    try {
      window.localStorage.setItem(MODE_KEY, mode);
    } catch (err) {
      /* The choice still applies for this visit. */
    }
  }

  function systemMode() {
    return darkQuery && darkQuery.matches ? 'night' : 'paper';
  }

  function applyMode(mode) {
    root.setAttribute('data-mode', mode);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[mode]);

    var radios = document.querySelectorAll('input[name="reading-mode"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].checked = radios[i].value === mode;
    }
  }

  // Before first paint: a saved choice wins, otherwise follow the system.
  applyMode(savedMode() || systemMode());

  function initMode() {
    applyMode(root.getAttribute('data-mode')); // sync the radios now they exist

    var radios = document.querySelectorAll('input[name="reading-mode"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', function (event) {
        if (!event.target.checked) return;
        applyMode(event.target.value);
        saveMode(event.target.value);
      });
    }

    // Keep following the system setting until the reader makes a choice.
    if (darkQuery) {
      var onSystemChange = function () {
        if (!savedMode()) applyMode(systemMode());
      };
      if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSystemChange);
      else if (darkQuery.addListener) darkQuery.addListener(onSystemChange);
    }
  }

  /* ------------------------------------------------------------------ *
   * 2. Gauge marker
   * ------------------------------------------------------------------ */

  function initGauge() {
    var ticking = false;

    function update() {
      ticking = false;
      var scrollable = root.scrollHeight - window.innerHeight;
      var progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      progress = Math.min(1, Math.max(0, progress));
      root.style.setProperty('--read', progress.toFixed(4));
    }

    function request() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  }

  /* ------------------------------------------------------------------ *
   * 3. Subscription email
   * ------------------------------------------------------------------ */

  // Deliberately modest: one @, something before it, a dotted domain after it,
  // no spaces. Real deliverability can only be confirmed by sending mail.
  var EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

  function checkEmail(raw) {
    var value = raw.trim();

    if (!value) {
      return 'Enter your email address.';
    }
    if (/\s/.test(value)) {
      return 'Email addresses can’t contain spaces.';
    }
    if (value.indexOf('@') === -1) {
      return 'That address is missing an @ — for example, name@example.com.';
    }
    if (value.indexOf('@') !== value.lastIndexOf('@')) {
      return 'That address has more than one @.';
    }
    if (value.indexOf('@') === 0) {
      return 'Add the part before the @.';
    }
    if (value.length > 254 || !EMAIL_SHAPE.test(value)) {
      return 'Finish the part after the @ — for example, name@example.com.';
    }
    return '';
  }

  function initSignup() {
    var form = document.getElementById('signup');
    if (!form) return;

    var input = document.getElementById('email');
    var error = document.getElementById('email-error');
    var fields = document.getElementById('signup-fields');
    var done = document.getElementById('signup-done');
    var address = document.getElementById('signup-address');
    var reset = document.getElementById('signup-reset');
    var hasComplained = false; // only correct people after they've had a go

    form.setAttribute('novalidate', ''); // our messages replace the browser's bubbles

    function showError(message) {
      error.textContent = message;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'email-error email-hint');
      input.removeAttribute('data-valid');
      hasComplained = true;
    }

    function clearError() {
      error.hidden = true;
      error.textContent = '';
      input.removeAttribute('aria-invalid');
      input.setAttribute('aria-describedby', 'email-hint');
    }

    function validate() {
      var message = checkEmail(input.value);
      if (message) {
        showError(message);
        return false;
      }
      clearError();
      input.setAttribute('data-valid', 'true');
      return true;
    }

    // Leaving the field with something typed: check it.
    input.addEventListener('blur', function () {
      if (input.value.trim()) validate();
    });

    // Once an error has been shown, re-check on every keystroke so it clears
    // the moment the address is fixed. Before that, stay quiet while typing.
    input.addEventListener('input', function () {
      if (hasComplained) validate();
      else input.removeAttribute('data-valid');
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault(); // never leaves the page

      if (!validate()) {
        input.focus(); // the error is announced as the field's description
        return;
      }

      address.textContent = input.value.trim();
      fields.hidden = true;
      done.hidden = false;
      done.focus(); // moves focus to the confirmation so it is read out
    });

    reset.addEventListener('click', function () {
      done.hidden = true;
      fields.hidden = false;
      form.reset();
      clearError();
      input.removeAttribute('data-valid');
      hasComplained = false;
      input.focus();
    });
  }

  /* ------------------------------------------------------------------ */

  function init() {
    initMode();
    initGauge();
    initSignup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
