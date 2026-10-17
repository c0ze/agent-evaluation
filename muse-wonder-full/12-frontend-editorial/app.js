/* Margin — reading mode + local email validation. No network, no submission. */
(function () {
  "use strict";

  /* Reading mode toggle */
  var root = document.documentElement;
  var toggle = document.getElementById("reading-toggle");
  var stateLabel = toggle ? toggle.querySelector(".toggle-state") : null;
  var KEY = "margin-reading-mode";

  function setReading(on, announce) {
    root.dataset.reading = on ? "on" : "off";
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(on));
      if (stateLabel) stateLabel.textContent = on ? "On" : "Off";
      toggle.setAttribute("aria-label", on ? "Reading mode on. Turn reading mode off" : "Reading mode off. Turn reading mode on");
    }
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* file:// or private mode */ }
    if (announce) {
      var live = document.getElementById("reading-hint");
      if (live) live.textContent = on
        ? "Reading mode is on. Article text is larger, the measure is narrower, and decoration is quieted."
        : "Reading mode is off.";
    }
  }

  if (toggle) {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    setReading(saved === "on", false);
    toggle.addEventListener("click", function () {
      setReading(root.dataset.reading !== "on", true);
    });
  }

  /* Email validation — inline only, never submits */
  var form = document.getElementById("subscribe-form");
  var email = document.getElementById("email");
  var status = document.getElementById("form-status");
  if (!form || !email || !status) return;

  // Practical check: local@domain.tld, no spaces, no leading/trailing/consecutive dots.
  function validate(value) {
    var v = value.trim();
    if (!v) return "Please enter your email address.";
    if (/\s/.test(v)) return "That email has a space in it — please check and try again.";
    if (!/^[^\s@.][^\s@]*@[^\s@]+\.[^\s@]{2,}$/.test(v) || v.indexOf("..") !== -1 || /@\./.test(v) || /\.$/.test(v))
      return "That doesn’t look like a complete email — for example, you@example.com.";
    return "";
  }

  function showError(msg) {
    email.setAttribute("aria-invalid", "true");
    status.textContent = msg;
    status.className = "form-status is-error";
  }
  function clearError() {
    email.removeAttribute("aria-invalid");
    if (status.classList.contains("is-error")) { status.textContent = ""; status.className = "form-status"; }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var msg = validate(email.value);
    if (msg) { showError(msg); email.focus(); return; }
    email.removeAttribute("aria-invalid");
    status.textContent = "✓ Reserved locally — thanks. Issue 14, Low Water (¥2,400, print + digital, cancel anytime) would go to " + email.value.trim() + ". Nothing was sent from this demo page.";
    status.className = "form-status is-success";
  });

  email.addEventListener("blur", function () {
    if (!email.value.trim()) { clearError(); return; }
    var msg = validate(email.value);
    if (msg) showError(msg); else clearError();
  });
  email.addEventListener("input", function () {
    if (status.classList.contains("is-success")) { status.textContent = ""; status.className = "form-status"; }
    if (email.getAttribute("aria-invalid") === "true" && !validate(email.value)) clearError();
  });
})();
