/* ==========================================================================
   Margin — Issue 14, Low Water
   Three small behaviours, no dependencies, no network:
     1. the reading-mode control (Paper / Dusk / Night)
     2. the subscription email field, with inline validation
     3. marking the section currently in view in the page navigation
   Everything degrades: without this script the page still reads correctly.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ------------------------------------------------------------------------
     1. Reading mode
     ------------------------------------------------------------------------ */
  var MODES = { paper: 'Paper', dusk: 'Dusk', night: 'Night' };
  var THEME_COLOR = { paper: '#f4f0e8', dusk: '#e6dcc8', night: '#171614' };
  var STORAGE_KEY = 'margin:mode';

  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var modeInputs = Array.prototype.slice.call(document.querySelectorAll('input[name="mode"]'));
  var modeNote = document.getElementById('mode-note');
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  function readStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function writeStored(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* private mode, blocked storage */ }
  }
  function systemMode() {
    return darkQuery && darkQuery.matches ? 'night' : 'paper';
  }

  function applyMode(mode, announce) {
    if (!MODES[mode]) { mode = 'paper'; }
    root.setAttribute('data-mode', mode);
    modeInputs.forEach(function (input) { input.checked = (input.value === mode); });
    if (themeMeta) { themeMeta.setAttribute('content', THEME_COLOR[mode]); }
    if (announce && modeNote) { modeNote.textContent = 'Reading mode set to ' + MODES[mode] + '.'; }
  }

  var stored = readStored();
  applyMode(MODES[stored] ? stored : systemMode(), false);

  modeInputs.forEach(function (input) {
    input.addEventListener('change', function () {
      if (!input.checked) { return; }
      applyMode(input.value, true);
      writeStored(input.value);
    });
  });

  /* Until the reader chooses, follow the operating system's scheme live. */
  if (darkQuery) {
    var followSystem = function () {
      if (!MODES[readStored()]) { applyMode(systemMode(), false); }
    };
    if (darkQuery.addEventListener) { darkQuery.addEventListener('change', followSystem); }
    else if (darkQuery.addListener) { darkQuery.addListener(followSystem); }
  }

  /* ------------------------------------------------------------------------
     2. Subscription field — validation and feedback, never a submission
     ------------------------------------------------------------------------ */
  var form = document.getElementById('subscribe-form');
  if (form) {
    var emailInput = form.querySelector('#email');
    var message = form.querySelector('#email-msg');
    var field = form.querySelector('.field');
    var submitButton = form.querySelector('.button');
    var resetButton = document.getElementById('email-reset');

    /* Deliberately plain: something@something.tld, no spaces. */
    var EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function validate(raw) {
      var value = raw.trim();
      if (!value) { return 'Enter an email address to subscribe.'; }
      if (value.indexOf('@') === -1) { return 'That address needs an @ — for example, you@example.org.'; }
      if (!EMAIL_SHAPE.test(value)) { return 'That doesn’t look like a complete address. Check the part after the @.'; }
      return '';
    }

    function showError(text) {
      emailInput.setAttribute('aria-invalid', 'true');
      field.classList.add('field--invalid');
      message.className = 'field__msg field__msg--error';
      message.textContent = text;
    }

    function clearError() {
      emailInput.removeAttribute('aria-invalid');
      field.classList.remove('field--invalid');
      if (message.classList.contains('field__msg--error')) {
        message.className = 'field__msg';
        message.textContent = '';
      }
    }

    function showSuccess(address) {
      form.setAttribute('data-state', 'done');
      submitButton.disabled = true;
      message.className = 'field__msg field__msg--ok';
      message.textContent = '';
      /* Built from text nodes so the address is never interpreted as markup. */
      message.appendChild(document.createTextNode('Thank you. Issue 14, '));
      var title = document.createElement('strong');
      title.textContent = 'Low Water';
      message.appendChild(title);
      message.appendChild(document.createTextNode(
        ', will be the first to reach ' + address + '. This is a demonstration page: nothing was sent or stored.'
      ));
      resetButton.hidden = false;
      message.focus();
    }

    /* Errors clear as soon as the address becomes valid; they never appear mid-typing. */
    emailInput.addEventListener('input', function () {
      if (emailInput.getAttribute('aria-invalid') === 'true' && !validate(emailInput.value)) {
        clearError();
      }
    });

    /* Leaving a filled field that is wrong says so, before the reader reaches the button. */
    emailInput.addEventListener('blur', function () {
      if (!emailInput.value.trim()) { return; }
      var error = validate(emailInput.value);
      if (error) { showError(error); }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var error = validate(emailInput.value);
      if (error) {
        showError(error);
        emailInput.focus();
        return;
      }
      clearError();
      showSuccess(emailInput.value.trim());
    });

    resetButton.addEventListener('click', function () {
      form.removeAttribute('data-state');
      submitButton.disabled = false;
      message.className = 'field__msg';
      message.textContent = '';
      emailInput.value = '';
      resetButton.hidden = true;
      emailInput.focus();
    });
  }

  /* ------------------------------------------------------------------------
     3. Which section is under the reader — marked in the page navigation
     ------------------------------------------------------------------------ */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.sections a[href^="#"]'));
  if ('IntersectionObserver' in window && navLinks.length) {
    var linkById = {};
    navLinks.forEach(function (link) { linkById[link.getAttribute('href').slice(1)] = link; });

    var ratios = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        ratios[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
      });
      var current = null, best = 0;
      Object.keys(ratios).forEach(function (id) {
        if (ratios[id] > best) { best = ratios[id]; current = id; }
      });
      navLinks.forEach(function (link) {
        if (current && link === linkById[current]) { link.setAttribute('aria-current', 'location'); }
        else { link.removeAttribute('aria-current'); }
      });
    }, { rootMargin: '-15% 0px -45% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });

    Object.keys(linkById).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) { observer.observe(section); }
    });
  }
})();
