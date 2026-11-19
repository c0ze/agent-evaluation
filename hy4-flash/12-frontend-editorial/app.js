/* Margin — reading mode and inline email validation. No network, no submission. */

(function () {
  "use strict";

  var toggle = document.getElementById("readingToggle");
  var toggleText = document.getElementById("readingToggleText");
  var form = document.getElementById("subscribeForm");
  var input = document.getElementById("email");
  var status = document.getElementById("emailStatus");
  var row = input ? input.parentElement : null;

  if (!toggle || !form || !input || !status) return;

  /* --- Reading mode --- */
  toggle.addEventListener("click", function () {
    var on = document.body.classList.toggle("reading-mode");
    toggle.setAttribute("aria-pressed", String(on));
    toggleText.textContent = on ? "Reading mode on" : "Reading mode";
  });

  /* --- Email validation --- */
  // Deliberately modest: a single @, a dot in the domain, no whitespace,
  // and no consecutive dots. Enough for inline feedback without rejecting
  // unusual but valid addresses.
  function isValidEmail(value) {
    var v = value.trim();
    if (/\s/.test(v) || /\.\./.test(v)) return false;
    var parts = v.split("@");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    if (parts[1].indexOf(".") === -1) return false;
    if (parts[1].startsWith(".") || parts[1].endsWith(".")) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function show(message, kind) {
    status.textContent = message;
    status.className = "field__status" + (kind ? " is-" + kind : "");
  }

  function clear() {
    show("", "");
    input.removeAttribute("aria-invalid");
    if (row) row.classList.remove("is-invalid");
  }

  input.addEventListener("input", function () {
    // Once the user starts correcting an error, drop the error styling.
    if (input.getAttribute("aria-invalid") === "true") clear();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault(); // nothing is ever sent
    var value = input.value.trim();

    if (!value) {
      input.setAttribute("aria-invalid", "true");
      if (row) row.classList.add("is-invalid");
      show("Please enter an email address.", "error");
      input.focus();
      return;
    }

    if (!isValidEmail(value)) {
      input.setAttribute("aria-invalid", "true");
      if (row) row.classList.add("is-invalid");
      show("That address doesn't look right. Try name@example.com.", "error");
      input.focus();
      return;
    }

    clear();
    show("Thank you — you're on the list. Watch for Issue 14.", "success");
  });
})();
