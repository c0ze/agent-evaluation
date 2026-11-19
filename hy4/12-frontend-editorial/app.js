/* Margin — Issue 14: reading mode + inline email validation.
   Everything is local: no network, no storage beyond a single UI preference. */

(function () {
  "use strict";

  /* --- Reading mode ------------------------------------------------------ */
  var STORAGE_KEY = "margin-reading-mode";
  var toggle = document.getElementById("reading-toggle");
  var stateLabel = toggle ? toggle.querySelector(".rm-toggle__state") : null;

  function storedPreference() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null; // storage may be unavailable (private mode, file://)
    }
  }

  function savePreference(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* Preference simply does not persist; the toggle still works. */
    }
  }

  function applyReadingMode(on) {
    document.body.setAttribute("data-reading", on ? "on" : "off");
    if (toggle) toggle.setAttribute("aria-pressed", on ? "true" : "false");
    if (stateLabel) stateLabel.textContent = on ? "On" : "Off";
  }

  // Start from the saved preference; default is off.
  applyReadingMode(storedPreference() === "on");

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = toggle.getAttribute("aria-pressed") !== "true";
      applyReadingMode(next);
      savePreference(next ? "on" : "off");
    });
  }

  /* --- Email field ------------------------------------------------------- */
  var form = document.getElementById("signup-form");
  var email = document.getElementById("email");
  var status = document.getElementById("email-status");

  // Deliberately permissive: one @, a dot in the domain, no whitespace.
  // The server (which does not exist here) would be the real authority.
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message;
    if (kind) {
      status.setAttribute("data-kind", kind);
    } else {
      status.removeAttribute("data-kind");
    }
  }

  function clearError() {
    if (email) email.removeAttribute("aria-invalid");
    if (status && status.getAttribute("data-kind") === "error") {
      setStatus("", null);
    }
  }

  if (email) {
    email.addEventListener("input", clearError);
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault(); // preview only — no submission, no network

      var value = email ? email.value.trim() : "";

      if (value === "") {
        email.setAttribute("aria-invalid", "true");
        setStatus("Please enter an email address so we can reach you.", "error");
        email.focus();
        return;
      }

      if (!EMAIL_RE.test(value)) {
        email.setAttribute("aria-invalid", "true");
        setStatus("That address doesn’t look right — check for a typo.", "error");
        email.focus();
        return;
      }

      email.removeAttribute("aria-invalid");
      setStatus("Noted — we’ll be in touch about the next issue. (Preview only; nothing was sent.)", "success");
      email.value = "";
    });
  }
})();
