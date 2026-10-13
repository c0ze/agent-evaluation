// Margin — reading mode + subscribe form. No network, no submission.
(function () {
  "use strict";

  /* Reading mode -------------------------------------------------- */
  var toggle = document.getElementById("readingToggle");
  var stateEl = toggle ? toggle.querySelector(".reading-toggle-state") : null;
  var STORAGE_KEY = "margin-reading-mode";

  function applyReading(on, persist) {
    document.documentElement.classList.toggle("reading", on);
    if (toggle) toggle.setAttribute("aria-pressed", String(on));
    if (stateEl) stateEl.textContent = on ? "On" : "Off";
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, on ? "1" : "0"); } catch (e) { /* private mode */ }
    }
  }

  var initial = false;
  try { initial = localStorage.getItem(STORAGE_KEY) === "1"; } catch (e) { initial = false; }
  if (toggle) {
    applyReading(initial, false);
    toggle.addEventListener("click", function () {
      applyReading(!document.documentElement.classList.contains("reading"), true);
    });
  }

  /* Subscribe form — local validation only ------------------------ */
  var form = document.getElementById("subscribeForm");
  var email = document.getElementById("email");
  var feedback = document.getElementById("emailFeedback");
  if (!form || !email || !feedback) return;

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setFeedback(kind, message) {
    feedback.dataset.kind = kind || "";
    feedback.textContent = message || "";
    email.setAttribute("aria-invalid", kind === "error" ? "true" : "false");
  }

  function validate(showSuccess) {
    var value = email.value.trim();
    if (!value) {
      setFeedback("error", "Please enter your email address — for example, you@example.com.");
      return false;
    }
    if (!EMAIL_RE.test(value)) {
      setFeedback("error", "That email doesn\u2019t look complete. Check for an @ and a domain, like you@example.com.");
      return false;
    }
    if (showSuccess) {
      setFeedback("success", "Thank you — " + value + " is on the list for Issue 14, Low Water. Print + digital, \u00A52,400 per issue, cancel anytime. (Demo only: nothing was sent.)");
    } else {
      setFeedback("", "");
    }
    return true;
  }

  email.addEventListener("blur", function () {
    if (email.value.trim()) validate(false);
  });
  email.addEventListener("input", function () {
    // Clear stale errors as the reader corrects the address.
    if (feedback.dataset.kind === "error" && EMAIL_RE.test(email.value.trim())) setFeedback("", "");
    if (feedback.dataset.kind === "success") setFeedback("", "");
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault(); // No actual submission — validate inline only.
    if (!validate(true)) { email.focus(); return; }
    form.querySelector(".submit-btn").textContent = "Subscribed \u2713 — Issue 14 reserved";
  });
})();
