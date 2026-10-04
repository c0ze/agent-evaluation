/* ===========================================================
   Margin — Issue 14
   Small, dependency-free behaviors for the landing page.
   - Reading-mode switcher (Paper / Sepia / Ink)
   - Inline email validation + simulated submit feedback
   =========================================================== */

(function () {
  'use strict';

  var VALID_THEMES = ['paper', 'sepia', 'ink'];
  var STORAGE_KEY  = 'margin-theme';
  // Conservative email pattern: good enough for a client-side hint,
  // never a substitute for proper server-side validation.
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ---------- Reading mode ---------- */
  var body          = document.body;
  var themeButtons  = document.querySelectorAll('[data-theme-target]');

  function setTheme(theme, opts) {
    if (VALID_THEMES.indexOf(theme) === -1) return;
    body.setAttribute('data-theme', theme);
    for (var i = 0; i < themeButtons.length; i++) {
      var btn   = themeButtons[i];
      var isOn  = btn.getAttribute('data-theme-target') === theme;
      btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    }
    if (!opts || !opts.silent) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* ignore */ }
    }
  }

  for (var i = 0; i < themeButtons.length; i++) {
    themeButtons[i].addEventListener('click', function (ev) {
      var target = ev.currentTarget.getAttribute('data-theme-target');
      setTheme(target);
    });
  }

  // Restore a previously chosen reading mode, if any.
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && VALID_THEMES.indexOf(saved) !== -1) {
      setTheme(saved, { silent: true });
    }
  } catch (e) { /* ignore */ }

  /* ---------- Subscription form ---------- */
  var form     = document.getElementById('subForm');
  var input    = document.getElementById('email');
  var feedback = document.getElementById('emailFeedback');
  var wrapper  = input ? input.closest('.sub-input') : null;
  var submit   = form ? form.querySelector('.sub-submit') : null;

  function setFeedback(state, message) {
    if (!feedback) return;
    feedback.classList.remove('is-success', 'is-error');
    if (state) feedback.classList.add('is-' + state);
    feedback.textContent = message || '';
  }

  function setValidity(message, invalid) {
    if (!input) return;
    if (invalid) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
    if (wrapper) {
      if (invalid) wrapper.classList.add('is-error');
      else wrapper.classList.remove('is-error');
    }
    if (message) setFeedback(invalid ? 'error' : 'success', message);
  }

  if (input) {
    input.addEventListener('input', function () {
      var value = input.value.trim();
      if (value === '') {
        setFeedback(null, '');
        input.removeAttribute('aria-invalid');
        if (wrapper) wrapper.classList.remove('is-error');
        return;
      }
      if (EMAIL_RE.test(value)) {
        setValidity('Looks good — we will be in touch.', false);
      } else {
        setValidity('That address does not look quite right.', true);
      }
    });

    input.addEventListener('blur', function () {
      var value = input.value.trim();
      if (value !== '' && !EMAIL_RE.test(value)) {
        setValidity('That address does not look quite right.', true);
      }
    });
  }

  if (form && input && submit) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var value = input.value.trim();

      if (value === '') {
        setValidity('Please enter an email address.', true);
        input.focus();
        return;
      }
      if (!EMAIL_RE.test(value)) {
        setValidity('That address does not look quite right.', true);
        input.focus();
        return;
      }

      // Simulated success — no network call is made.
      setFeedback('success',
        'Thank you. A confirmation will be sent to ' + value + '.');
      input.setAttribute('readonly', 'readonly');
      submit.setAttribute('disabled', 'disabled');
      submit.textContent = 'Subscribed';
      submit.setAttribute('aria-label', 'Subscription recorded');
      if (wrapper) wrapper.classList.remove('is-error');
    });
  }

})();