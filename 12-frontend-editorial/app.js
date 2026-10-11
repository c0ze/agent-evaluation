/* Margin — Issue 14 “Low Water”
   Reading-mode control, scroll reveals, and demo subscribe form.
   Nothing here talks to a network; the form never submits. */

(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  /* ── Reading mode ──────────────────────────────────────────────────
     A single control that re-inks the whole page: night paper palette,
     112.5% type, airier leading. The choice persists in localStorage
     and is pre-applied by an inline head script to avoid a flash. */

  var STORAGE_KEY = "margin:reading-mode";
  var toggle = document.getElementById("reading-toggle");
  var toggleState = document.getElementById("reading-state");

  function store(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (err) {
      /* private mode or blocked storage — the toggle still works in-session */
    }
  }

  function setReadingMode(on) {
    root.classList.toggle("reading", on);
    if (toggle) {
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (toggleState) {
      toggleState.textContent = on ? "on" : "off";
    }
    store(on ? "on" : "off");
  }

  if (toggle) {
    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      saved = null;
    }
    setReadingMode(saved === "on" || root.classList.contains("reading"));

    toggle.addEventListener("click", function () {
      setReadingMode(!root.classList.contains("reading"));
    });
  }

  /* ── Scroll reveals ────────────────────────────────────────────────
     Elements start hidden only when JS is present (.js class). With no
     IntersectionObserver or with reduced-motion preferred, everything
     is shown immediately. */

  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if ("IntersectionObserver" in window && !reduceMotion) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );
    reveals.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  /* ── Subscribe form (demo) ─────────────────────────────────────────
     Inline validation on blur/submit, live correction once the field has
     been touched, success via a polite live region. preventDefault means
     no data ever leaves the browser. */

  var form = document.getElementById("subscribe-form");
  var email = document.getElementById("email");
  var errorEl = document.getElementById("email-error");
  var statusEl = document.getElementById("form-status");

  if (form && email && errorEl && statusEl) {
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var touched = false;

    var setError = function (message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      email.setAttribute("aria-invalid", "true");
      email.classList.add("is-invalid");
    };

    var clearError = function () {
      errorEl.textContent = "";
      errorEl.hidden = true;
      email.removeAttribute("aria-invalid");
      email.classList.remove("is-invalid");
    };

    var validate = function () {
      var value = email.value.trim();
      if (value === "") {
        setError("Please enter your email address.");
        return false;
      }
      if (!EMAIL_RE.test(value)) {
        setError(
          "That doesn’t look like an email address — please check it " +
            "(for example, name@example.com)."
        );
        return false;
      }
      clearError();
      return true;
    };

    email.addEventListener("blur", function () {
      if (email.value.trim() !== "") {
        touched = true;
        validate();
      }
    });

    email.addEventListener("input", function () {
      statusEl.textContent = "";
      if (touched) {
        validate();
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault(); /* demo only — nothing is sent anywhere */
      statusEl.textContent = "";
      touched = true;

      if (!validate()) {
        email.focus();
        return;
      }

      statusEl.textContent =
        "You’re on the list for Issue 14 — “Low Water.” It will reach you " +
        "when it ships. (Demo only: nothing left your browser.)";
      form.reset();
      touched = false;
      clearError();
    });
  }
})();
