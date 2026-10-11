/* Margin — Issue 14: Low Water
   Two small interactive instruments:
   1. a reading-mode toggle (persisted, no reload)
   2. a letter-signup field with inline validation (nothing is sent anywhere)
*/

(function () {
  "use strict";

  /* ---------- 1. Reading mode ---------- */

  var STORAGE_KEY = "margin-reading-mode";
  var toggle = document.getElementById("reading-toggle");
  var toggleState = document.getElementById("reading-toggle-state");

  function applyReadingMode(on) {
    document.body.classList.toggle("reading", on);
    toggle.setAttribute("aria-pressed", String(on));
    toggleState.textContent = on ? "on" : "off";
  }

  function savedPreference() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "on";
    } catch (err) {
      return false; // storage unavailable; default to off
    }
  }

  if (toggle && toggleState) {
    applyReadingMode(savedPreference());

    toggle.addEventListener("click", function () {
      var on = !document.body.classList.contains("reading");
      applyReadingMode(on);
      try {
        window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
      } catch (err) {
        /* persistence is a nicety, not a requirement */
      }
    });
  }

  /* ---------- 2. Letter signup with inline validation ---------- */

  var form = document.getElementById("letter-form");
  var input = document.getElementById("email");
  var feedback = document.getElementById("email-feedback");

  if (!form || !input || !feedback) return;

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setFeedback(message, kind) {
    feedback.textContent = message;
    feedback.classList.remove("is-error", "is-success");
    if (kind) feedback.classList.add(kind);
  }

  function clearError() {
    input.removeAttribute("aria-invalid");
    if (feedback.classList.contains("is-error")) setFeedback("", null);
  }

  input.addEventListener("input", clearError);

  form.addEventListener("submit", function (event) {
    event.preventDefault(); // nothing is ever submitted anywhere

    var value = input.value.trim();

    if (value === "") {
      input.setAttribute("aria-invalid", "true");
      setFeedback("An address, please — the letter needs somewhere to go.", "is-error");
      input.focus();
      return;
    }

    if (!EMAIL_PATTERN.test(value)) {
      input.setAttribute("aria-invalid", "true");
      setFeedback("That doesn’t read like an email address. Check for a typo?", "is-error");
      input.focus();
      return;
    }

    input.removeAttribute("aria-invalid");
    setFeedback("Noted. The next letter surfaces with Issue 15, Winter 2026.", "is-success");
    form.reset();
  });
})();
