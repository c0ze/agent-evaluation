/* Margin — Issue 14. No dependencies, no network. */

(function () {
  'use strict';

  /* ---------------------------------------------------------------
     1. Reading mode: paper / night
  --------------------------------------------------------------- */

  var root = document.documentElement;
  var STORE_KEY = 'margin-reading-mode';
  var modeButtons = Array.prototype.slice.call(
    document.querySelectorAll('.modes__btn')
  );
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var PALETTE = { paper: '#f2efe6', night: '#131310' };

  function store(mode) {
    try { localStorage.setItem(STORE_KEY, mode); } catch (e) {}
  }
  function stored() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }

  function applyMode(mode, persist) {
    root.setAttribute('data-theme', mode);
    if (themeMeta) themeMeta.setAttribute('content', PALETTE[mode] || PALETTE.paper);
    modeButtons.forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    });
    if (persist) store(mode);
  }

  modeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyMode(btn.dataset.mode, true);
    });
  });

  /* sync with whatever the inline head script decided */
  applyMode(root.getAttribute('data-theme') === 'night' ? 'night' : 'paper', false);

  /* follow the OS only while the reader has not chosen for themselves */
  var os = window.matchMedia('(prefers-color-scheme: dark)');
  var onOsChange = function (e) {
    if (!stored()) applyMode(e.matches ? 'night' : 'paper', false);
  };
  if (os.addEventListener) os.addEventListener('change', onOsChange);
  else if (os.addListener) os.addListener(onOsChange);

  /* ---------------------------------------------------------------
     2. Quiet reveal for long-read sections
  --------------------------------------------------------------- */

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduce && 'IntersectionObserver' in window) {
    var targets = document.querySelectorAll('.cover, .stories, .archive, .subscribe');
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('reveal'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });

    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });

    /* safety net: anything that should already be on screen must never be
       left invisible if the observer stalls */
    setTimeout(function () {
      Array.prototype.forEach.call(targets, function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('is-in');
        }
      });
    }, 2500);
  }

  /* ---------------------------------------------------------------
     3. Subscribe field: inline validation, no submission
  --------------------------------------------------------------- */

  var form = document.getElementById('signup-form');
  if (!form) return;

  var input = document.getElementById('email');
  var error = document.getElementById('email-error');
  var status = document.getElementById('signup-status');
  var done = document.getElementById('signup-done');
  var doneTitle = document.getElementById('signup-done-title');
  var echo = document.getElementById('signup-echo');
  var reset = document.getElementById('signup-reset');

  var EMAIL = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  var touched = false;

  function setError(message) {
    if (message) {
      error.textContent = message;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    } else {
      error.textContent = '';
      error.hidden = true;
      input.removeAttribute('aria-invalid');
    }
  }

  function validate() {
    var value = input.value.trim();
    if (!value) return 'Please enter an email address so we know where to write.';
    if (value.indexOf('@') === -1) return 'That address is missing an “@”.';
    if (/\s/.test(value)) return 'Email addresses cannot contain spaces.';
    if (!EMAIL.test(value)) return 'That does not look like a complete address — try name@example.com.';
    return '';
  }

  function check(silent) {
    var message = validate();
    if (!silent || touched) setError(message);
    return message === '';
  }

  input.addEventListener('blur', function () {
    touched = true;
    check(false);
  });

  input.addEventListener('input', function () {
    if (touched) check(false);
    else if (!error.hidden) setError('');
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    touched = true;

    var ok = check(false);
    if (!ok) {
      status.textContent = 'Not yet — check the address above.';
      input.focus();
      return;
    }

    var value = input.value.trim();
    echo.textContent = value;
    form.hidden = true;
    done.hidden = false;
    status.textContent = 'Address noted. Nothing has been sent or charged.';
    doneTitle.focus();
  });

  if (reset) {
    reset.addEventListener('click', function () {
      done.hidden = true;
      form.hidden = false;
      touched = false;
      setError('');
      status.textContent = '';
      input.value = '';
      input.focus();
    });
  }
})();
