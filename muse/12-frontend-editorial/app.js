// Margin — functional controls, no network. Reading mode + email validation.
(function () {
  "use strict";

  // --- Reading-mode control (segmented Paper / Sepia / Ink) ---
  var buttons = Array.prototype.slice.call(
    document.querySelectorAll(".reading-buttons button[data-mode]")
  );

  function setMode(mode, moveFocus) {
    var valid = ["paper", "sepia", "ink"];
    if (valid.indexOf(mode) === -1) mode = "paper";
    document.body.setAttribute("data-reading-mode", mode);
    buttons.forEach(function (btn) {
      var active = btn.getAttribute("data-mode") === mode;
      btn.setAttribute("aria-checked", active ? "true" : "false");
      btn.tabIndex = active ? 0 : -1;
      if (active && moveFocus) btn.focus();
    });
    try { localStorage.setItem("margin-reading-mode", mode); } catch (e) { /* private mode */ }
  }

  buttons.forEach(function (btn, i) {
    btn.addEventListener("click", function () { setMode(btn.getAttribute("data-mode")); });
    btn.addEventListener("keydown", function (ev) {
      var next = null;
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") next = buttons[(i + 1) % buttons.length];
      if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") next = buttons[(i - 1 + buttons.length) % buttons.length];
      if (next) { ev.preventDefault(); setMode(next.getAttribute("data-mode"), true); }
    });
  });

  var stored = null;
  try { stored = localStorage.getItem("margin-reading-mode"); } catch (e) { /* ignore */ }
  if (stored) setMode(stored);

  // --- Email field: inline validation + success, no submission ---
  var form = document.getElementById("subscribe-form");
  var email = document.getElementById("email");
  var feedback = document.getElementById("email-feedback");

  function showMessage(kind, text) {
    feedback.textContent = text;
    feedback.className = "feedback " + kind;
  }

  function validate(value) {
    var v = value.trim();
    if (!v) return "Please enter your email address.";
    // Practical RFC-5322 subset: local@domain.tld, no spaces, one @, dot in domain.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "That email doesn't look complete — try name@example.com.";
    if (v.length > 254) return "That email is too long — check for a typo.";
    return "";
  }

  email.addEventListener("input", function () {
    if (feedback.className.indexOf("error") !== -1) {
      var err = validate(email.value);
      if (!err) { showMessage("", ""); email.removeAttribute("aria-invalid"); }
      else { email.setAttribute("aria-invalid", "true"); }
    }
  });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault(); // demo only: never submits
    var err = validate(email.value);
    if (err) {
      showMessage("error", err);
      email.setAttribute("aria-invalid", "true");
      email.focus();
      return;
    }
    email.removeAttribute("aria-invalid");
    showMessage("success", "You're on the list — Issue 14 confirmation sent to " + email.value.trim() + ".");
    form.reset();
  });
})();
