(function () {
  "use strict";

  /* ---------- reading-mode control ---------- */
  var root = document.documentElement;
  var modeButtons = Array.prototype.slice.call(
    document.querySelectorAll(".reading-mode button")
  );
  var MODE_KEY = "margin-reading-mode";
  var MODES = ["day", "dusk", "sepia"];

  function applyMode(mode, persist) {
    if (MODES.indexOf(mode) === -1) { mode = "day"; }
    root.setAttribute("data-mode", mode);
    if (persist) {
      try { window.localStorage.setItem(MODE_KEY, mode); } catch (err) { /* storage unavailable */ }
    }
    modeButtons.forEach(function (button) {
      var selected = button.getAttribute("data-set-mode") === mode;
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  var stored = null;
  try { stored = window.localStorage.getItem(MODE_KEY); } catch (err) { stored = null; }
  applyMode(stored || root.getAttribute("data-mode") || "day", false);

  modeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      applyMode(button.getAttribute("data-set-mode"), true);
    });
  });

  /* ---------- subscribe form: inline validation, no submission ---------- */
  var form = document.getElementById("subscribe-form");
  var email = document.getElementById("email");
  var msg = document.getElementById("form-msg");
  var success = document.getElementById("form-success");
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (form && email && msg && success) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = email.value.trim();
      if (!EMAIL_PATTERN.test(value)) {
        msg.textContent = value
          ? "That address doesn’t look complete — check it and try again."
          : "Enter your email address to subscribe.";
        email.focus();
        return;
      }
      document.getElementById("success-email").textContent = value;
      form.hidden = true;
      success.hidden = false;
      success.focus();
    });

    email.addEventListener("input", function () {
      if (msg.textContent) { msg.textContent = ""; }
    });
  }
})();
