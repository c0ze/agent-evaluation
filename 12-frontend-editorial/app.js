/* Margin — Issue 14
   1. Reading-mode control (paper / night), persisted per browser.
   2. Email field with inline validation and success feedback. No submission. */

(function () {
  'use strict';

  /* ---------- 1. Reading mode ---------- */
  var STORAGE_KEY = 'margin:reading-mode';
  var root = document.documentElement;
  var toggle = document.querySelector('[data-mode-toggle]');
  var label = document.querySelector('[data-mode-label]');
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  function readStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v === 'night' || v === 'paper' ? v : null;
    } catch (e) {
      return null; // private mode / storage disabled
    }
  }

  function prefersNight() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function apply(mode, persist) {
    root.setAttribute('data-mode', mode);
    if (label) label.textContent = mode === 'night' ? 'Paper reading' : 'Night reading';
    if (toggle) toggle.setAttribute('aria-pressed', String(mode === 'night'));
    if (themeMeta) themeMeta.setAttribute('content', mode === 'night' ? '#131311' : '#f4f1e9');
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* ignore */ }
    }
  }

  apply(readStored() || (prefersNight() ? 'night' : 'paper'), false);

  if (toggle) {
    toggle.addEventListener('click', function () {
      apply(root.getAttribute('data-mode') === 'night' ? 'paper' : 'night', true);
    });
  }

  // Follow the OS only while the reader hasn't chosen a mode.
  if (window.matchMedia && !readStored()) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function (e) { if (!readStored()) apply(e.matches ? 'night' : 'paper', false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /* ---------- 2. Email field ---------- */
  var form = document.querySelector('[data-form]');
  if (!form) return;

  var input = form.querySelector('#email');
  var error = form.querySelector('#email-error');
  var hint = form.querySelector('#email-hint');
  var panel = document.querySelector('[data-success]');
  var echo = document.querySelector('[data-success-email]');

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    if (hint) hint.hidden = true;
  }

  function clearError() {
    error.textContent = '';
    error.hidden = true;
    input.removeAttribute('aria-invalid');
    if (hint) hint.hidden = false;
  }

  function validate(value) {
    var v = value.trim();
    if (!v) return 'Please enter an email address.';
    if (v.indexOf('@') === -1) return 'This address needs an @ — try you@example.com.';
    if (/\s/.test(v)) return 'An address can’t contain spaces.';
    var parts = v.split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return 'Check the part before or after the @.';
    if (parts[1].indexOf('.') === -1) return 'The domain looks incomplete — try example.com.';
    if (!/^[^\s@]+\.[^\s@]{2,}$/.test(parts[1])) return 'The domain looks incomplete — try example.com.';
    return '';
  }

  // Clear a visible error as soon as the address becomes acceptable.
  input.addEventListener('input', function () {
    if (!error.hidden && !validate(input.value)) clearError();
  });

  input.addEventListener('blur', function () {
    var problem = validate(input.value);
    if (input.value.trim() && problem) showError(problem);
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault(); // nothing is sent

    var problem = validate(input.value);
    if (problem) {
      showError(problem);
      input.focus();
      return;
    }

    clearError();
    if (echo) echo.textContent = input.value.trim();

    form.hidden = true;
    panel.hidden = false;
    panel.focus();
  });
})();
