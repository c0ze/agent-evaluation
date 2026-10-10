/* ==========================================================================
   Margin — behaviour
   Two features, both local: a reading-mode switch that reflows the page into a
   single measure, and an email field that validates inline and never submits.
   No network calls, no dependencies, no storage of anything but one preference.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;
  var STORAGE_KEY = 'margin:reading-mode';

  /* --- Reading mode ---------------------------------------------------- */

  var toggle = document.getElementById('reading-toggle');
  var bar = document.getElementById('reading-bar');
  var exit = document.getElementById('reading-exit');
  var status = document.getElementById('mode-status');

  function readingOn() {
    return root.getAttribute('data-reading') === 'on';
  }

  function setReading(on, announce) {
    root.setAttribute('data-reading', on ? 'on' : 'off');
    if (toggle) {
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      toggle.setAttribute('aria-label', on ? 'Reading mode is on. Turn it off.' : 'Reading mode is off. Turn it on.');
    }
    if (bar) {
      bar.hidden = !on;
    }

    try {
      if (on) {
        window.localStorage.setItem(STORAGE_KEY, 'on');
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      /* Private browsing or storage disabled: the toggle still works. */
    }

    if (announce && status) {
      status.textContent = on
        ? 'Reading mode on. One column, wider leading.'
        : 'Reading mode off. Back to the editorial layout.';
    }
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      setReading(!readingOn(), true);
    });
  }

  if (exit) {
    exit.addEventListener('click', function () {
      setReading(false, true);
      if (toggle) { toggle.focus(); }
    });
  }

  /* Escape is the keyboard way out of a mode you are stuck in. */
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && readingOn()) {
      setReading(false, true);
      if (toggle) { toggle.focus(); }
    }
  });

  /* Restore the saved preference without announcing it on load. */
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === 'on') {
      setReading(true, false);
    } else {
      setReading(false, false);
    }
  } catch (err) {
    setReading(false, false);
  }

  /* --- Contents navigation: mark the section you are actually in -------- */

  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('.contents-nav__link')
  );
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute('href');
      return id && id.charAt(0) === '#' ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  function clearCurrent() {
    navLinks.forEach(function (link) {
      link.removeAttribute('aria-current');
    });
  }

  function setCurrent(id) {
    clearCurrent();
    navLinks.forEach(function (link) {
      if (link.getAttribute('href') === '#' + id) {
        link.setAttribute('aria-current', 'true');
      }
    });
  }

  if ('IntersectionObserver' in window && sections.length) {
    var seen = new Map();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        seen.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      var bestId = null;
      var bestRatio = 0;
      seen.forEach(function (ratio, id) {
        if (ratio > bestRatio) { bestRatio = ratio; bestId = id; }
      });
      if (bestId && bestRatio > 0.05) { setCurrent(bestId); }
    }, {
      rootMargin: '-15% 0px -55% 0px',
      threshold: [0, 0.15, 0.4, 0.75, 1]
    });

    sections.forEach(function (section) { observer.observe(section); });

    navLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        var id = link.getAttribute('href').slice(1);
        setCurrent(id);
      });
    });
  }

  /* --- Email field: inline validation, no submission -------------------- */

  var form = document.getElementById('signup');
  var input = document.getElementById('email');
  var feedback = document.getElementById('email-feedback');
  var submit = document.getElementById('signup-submit');

  /* Deliberately permissive: one @, a dot in the domain, no spaces. */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function say(state, message) {
    if (!feedback) { return; }
    feedback.setAttribute('data-state', state);
    feedback.innerHTML = message;
  }

  function clear() {
    if (feedback) {
      feedback.removeAttribute('data-state');
      feedback.textContent = '';
    }
    if (input) { input.removeAttribute('aria-invalid'); }
  }

  function fail(message) {
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
    say('error', message);
  }

  function succeed(value) {
    if (input) {
      input.removeAttribute('aria-invalid');
      input.setAttribute('readonly', 'readonly');
    }
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Added to the list';
    }
    say(
      'success',
      '<strong>Thank you.</strong> ' + value + ' is on the list for Issue 15. ' +
      'Nothing was actually sent — this form does not transmit.'
    );
  }

  if (form && input) {
    /* Clear a previous verdict as soon as the address is edited. */
    input.addEventListener('input', function () {
      if (feedback && feedback.getAttribute('data-state') === 'error') { clear(); }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault(); // Nothing leaves this page. Ever.

      var value = (input.value || '').trim();

      if (!value) {
        fail('An email address is needed before we can start the subscription.');
        return;
      }
      if (/\s/.test(value)) {
        fail('That address contains a space. Check for a stray keystroke.');
        return;
      }
      if (!EMAIL.test(value)) {
        fail('That address looks incomplete — it needs something before the @ and a domain after it.');
        return;
      }

      succeed(value);
    });

    /* Native constraint UI would fire before ours, so suppress it. */
    input.addEventListener('invalid', function (event) {
      event.preventDefault();
    });
  }

  /* --- Colophon year --------------------------------------------------- */

  var year = document.getElementById('year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
}());
