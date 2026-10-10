(function () {
  "use strict";

  var root = document.documentElement;
  var MODE_KEY = "margin-reading-mode";
  var VALID_MODES = ["paper", "sepia", "ink"];

  /* ---------- Reading-mode control ---------- */
  var modeButtons = document.querySelectorAll("[data-mode]");

  function applyMode(mode, persist) {
    if (VALID_MODES.indexOf(mode) === -1) mode = "paper";
    root.setAttribute("data-reading-mode", mode);
    modeButtons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-mode") === mode ? "true" : "false");
    });
    if (persist) {
      try { localStorage.setItem(MODE_KEY, mode); } catch (e) { /* private mode: ignore */ }
    }
  }

  modeButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyMode(btn.getAttribute("data-mode"), true);
    });
  });

  // Restore saved preference; default to paper. Honor OS dark mode only when
  // the reader has never chosen (progressive enhancement, no surprise flips).
  var saved = null;
  try { saved = localStorage.getItem(MODE_KEY); } catch (e) { /* ignore */ }
  if (saved) {
    applyMode(saved, false);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    applyMode("ink", false);
  } else {
    applyMode("paper", false);
  }

  /* ---------- Email validation (no submission) ---------- */
  var form = document.getElementById("subscribe-form");
  if (!form) return;
  var email = document.getElementById("email");
  var feedback = document.getElementById("email-feedback");
  var fieldRow = form.querySelector(".field-row");

  function setState(state, message) {
    feedback.textContent = message;
    feedback.classList.remove("error", "success");
    fieldRow.classList.remove("invalid", "valid");
    email.removeAttribute("aria-invalid");
    if (state === "error") {
      feedback.classList.add("error");
      fieldRow.classList.add("invalid");
      email.setAttribute("aria-invalid", "true");
    } else if (state === "success") {
      feedback.classList.add("success");
      fieldRow.classList.add("valid");
    }
  }

  function validate(value) {
    var v = value.trim();
    if (!v) return { ok: false, msg: "Please enter your email address." };
    // Practical RFC-5322 subset: no spaces, one @, dot in domain, TLD of 2+.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      return { ok: false, msg: "That email doesn't look complete — check for a typo (e.g. you@example.com)." };
    }
    if (v.length > 254) return { ok: false, msg: "That email is too long — please use a shorter address." };
    return { ok: true, msg: "" };
  }

  var touched = false;
  email.addEventListener("input", function () {
    if (!touched) return;
    var r = validate(email.value);
    if (r.ok) setState("neutral", "");
    else setState("error", r.msg);
  });
  email.addEventListener("blur", function () {
    if (email.value.trim() === "" && !touched) return;
    touched = true;
    var r = validate(email.value);
    if (!r.ok) setState("error", r.msg);
  });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault(); // demo only: never submits anywhere
    touched = true;
    var r = validate(email.value);
    if (!r.ok) {
      setState("error", r.msg);
      email.focus();
      return;
    }
    setState("success", "Thank you — a checkout link for Issue 14 (¥2,400, cancel anytime) is on its way to " + email.value.trim() + ".");
    form.reset();
    touched = false;
  });
})();
