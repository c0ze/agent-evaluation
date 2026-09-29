/* Margin — Issue 14. Reading-mode control and subscription form.
   No network requests: the form validates and confirms locally only. */
(function () {
  "use strict";

  var root = document.documentElement;
  var KEY_THEME = "margin:theme";
  var KEY_SIZE = "margin:size";

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  /* ---------- Reading mode ---------- */
  var themeInputs = document.querySelectorAll('input[name="theme"]');
  var sizeToggle = document.getElementById("size-toggle");

  function applyTheme(theme, persist) {
    root.dataset.theme = theme;
    themeInputs.forEach(function (input) { input.checked = input.value === theme; });
    if (persist) store(KEY_THEME, theme);
  }

  function applySize(size, persist) {
    root.dataset.size = size;
    sizeToggle.setAttribute("aria-pressed", String(size === "large"));
    if (persist) store(KEY_SIZE, size);
  }

  // Sync controls with whatever the head script decided.
  applyTheme(root.dataset.theme === "night" ? "night" : "paper", false);
  applySize(root.dataset.size === "large" ? "large" : "regular", false);

  themeInputs.forEach(function (input) {
    input.addEventListener("change", function () {
      if (input.checked) applyTheme(input.value, true);
    });
  });

  sizeToggle.addEventListener("click", function () {
    applySize(root.dataset.size === "large" ? "regular" : "large", true);
  });

  // Follow the system setting until the reader makes an explicit choice.
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onSystemChange = function (event) {
      if (!read(KEY_THEME)) applyTheme(event.matches ? "night" : "paper", false);
    };
    if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }

  /* ---------- Subscription form ---------- */
  var form = document.getElementById("signup");
  var input = document.getElementById("email");
  var error = document.getElementById("email-error");
  var status = document.getElementById("signup-status");
  var attempted = false;

  // Deliberately simple: something@something.tld, no spaces.
  var EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

  function problem(value) {
    if (!value) return "Enter an email address to subscribe.";
    if (value.indexOf("@") === -1) return "Add an “@” — for example, reader@example.com.";
    if (!EMAIL.test(value)) return "That address looks incomplete. Check the part after the “@”.";
    return "";
  }

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
    input.setAttribute("aria-invalid", "true");
  }

  function clearError() {
    error.textContent = "";
    error.hidden = true;
    input.removeAttribute("aria-invalid");
  }

  // Re-check as the reader types, but only after a first attempt or blur,
  // so we never scold someone mid-word.
  input.addEventListener("input", function () {
    status.textContent = "";
    if (!attempted) return;
    var message = problem(input.value.trim());
    if (message) showError(message); else clearError();
  });

  input.addEventListener("blur", function () {
    var value = input.value.trim();
    if (!value) return;
    attempted = true;
    var message = problem(value);
    if (message) showError(message); else clearError();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault(); // nothing leaves the page
    attempted = true;
    var value = input.value.trim();
    var message = problem(value);

    if (message) {
      status.textContent = "";
      showError(message);
      input.focus();
      return;
    }

    clearError();
    status.textContent = "Thank you — your subscription link would go to " + value + ". This is a preview, so nothing was sent.";
    form.reset();
    attempted = false;
  });
})();
