/* Margin — Issue 14 · Low Water
   Reading-mode control, gentle reveals, and a local-only
   reservation form. No network requests anywhere. */

(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var STORAGE_KEY = "margin.reading-mode";
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      /* Storage unavailable — the toggle still works for this visit. */
    }
  }

  /* ---- Reading mode ---- */

  var modeToggle = document.getElementById("reading-toggle");
  var modeStatus = document.getElementById("mode-status");

  function applyReadingMode(on) {
    root.classList.toggle("reading-mode", on);
    if (modeToggle) {
      modeToggle.setAttribute("aria-pressed", on ? "true" : "false");
      var label = modeToggle.querySelector(".mode-label");
      if (label) {
        label.textContent = on ? "Reading mode \u00B7 on" : "Reading mode";
      }
    }
    if (modeStatus) {
      modeStatus.textContent = on
        ? "Reading mode on. Type is larger and spacing is calmer."
        : "Reading mode off. Standard layout restored.";
    }
  }

  if (safeGet(STORAGE_KEY) === "on") {
    applyReadingMode(true);
  }

  if (modeToggle) {
    modeToggle.addEventListener("click", function () {
      var on = !root.classList.contains("reading-mode");
      applyReadingMode(on);
      safeSet(STORAGE_KEY, on ? "on" : "off");
    });
  }

  /* ---- Gentle reveals ---- */

  var revealItems = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealItems.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
    );
    revealItems.forEach(function (el) {
      io.observe(el);
    });

    /* Safety net: if an observer never reports (headless, print,
       embedded views), fade everything in after a beat. */
    window.setTimeout(function () {
      revealItems.forEach(function (el) {
        el.classList.add("is-in");
      });
    }, 2500);
  }

  /* ---- Reservation form (inline validation, nothing is submitted) ---- */

  var form = document.getElementById("reserve-form");
  var emailInput = document.getElementById("email");
  var feedback = document.getElementById("form-feedback");
  var submitBtn = document.getElementById("reserve-submit");
  var EMAIL = /^[^\s@]+@[^\s@]+[.][^\s@]{2,}$/;

  if (!form || !emailInput || !feedback) {
    return;
  }

  function showMessage(state, text) {
    feedback.className = "form-feedback" + (state ? " " + state : "");
    feedback.textContent = text;
    emailInput.setAttribute("aria-invalid", state === "error" ? "true" : "false");
  }

  function validateValue(value) {
    if (value === "") {
      showMessage("error", "Add an email address so we know where to write.");
      return false;
    }
    if (!EMAIL.test(value)) {
      showMessage("error", "That address looks unfinished \u2014 check the part after the @.");
      return false;
    }
    return true;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var value = emailInput.value.trim();
    if (!validateValue(value)) {
      emailInput.focus();
      return;
    }
    showMessage(
      "ok",
      "Reserved \u2014 Issue 14 will ship to " + value + ". Nothing was sent from this page, and you can cancel anytime."
    );
    emailInput.readOnly = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Reserved";
    }
  });

  emailInput.addEventListener("input", function () {
    if (emailInput.readOnly) {
      return;
    }
    if (feedback.classList.contains("error")) {
      var value = emailInput.value.trim();
      if (EMAIL.test(value)) {
        showMessage("", "Looks like a complete address \u2014 reserve it.");
      } else if (value === "") {
        showMessage("", "");
      }
    }
  });

  emailInput.addEventListener("blur", function () {
    if (emailInput.readOnly) {
      return;
    }
    var value = emailInput.value.trim();
    if (value !== "") {
      validateValue(value);
    }
  });
})();
