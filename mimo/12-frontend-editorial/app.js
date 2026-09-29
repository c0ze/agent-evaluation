(function () {
  "use strict";

  /* —— Reading mode —— */
  var body = document.body;
  var toggle = document.getElementById("reading-toggle");
  var toggleState = document.getElementById("reading-toggle-state");

  function setReadingMode(on) {
    body.classList.toggle("reading-mode", on);
    toggle.setAttribute("aria-pressed", on ? "true" : "false");
    toggleState.textContent = on ? "On" : "Off";
    try {
      localStorage.setItem("margin-reading-mode", on ? "1" : "0");
    } catch (e) {
      /* storage may be unavailable */
    }
  }

  var savedReading = null;
  try {
    savedReading = localStorage.getItem("margin-reading-mode");
  } catch (e) {
    savedReading = null;
  }
  setReadingMode(savedReading === "1");

  toggle.addEventListener("click", function () {
    setReadingMode(!body.classList.contains("reading-mode"));
  });

  /* —— Subscribe form (no network; local feedback only) —— */
  var form = document.getElementById("subscribe-form");
  var email = document.getElementById("email");
  var message = document.getElementById("email-message");

  // Pragmatic email shape check: local@domain.tld with no spaces
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function showMessage(text, kind) {
    message.textContent = text;
    message.classList.remove("is-error", "is-success");
    if (kind) {
      message.classList.add(kind);
    }
  }

  function validateEmail(value) {
    var trimmed = value.trim();
    if (!trimmed) {
      return { ok: false, text: "Enter an email address." };
    }
    if (!EMAIL_RE.test(trimmed)) {
      return { ok: false, text: "That does not look like a valid email address." };
    }
    return { ok: true, value: trimmed };
  }

  email.addEventListener("input", function () {
    if (email.getAttribute("aria-invalid") === "true") {
      var check = validateEmail(email.value);
      if (check.ok) {
        email.setAttribute("aria-invalid", "false");
        showMessage("", null);
      }
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var result = validateEmail(email.value);
    if (!result.ok) {
      email.setAttribute("aria-invalid", "true");
      showMessage(result.text, "is-error");
      email.focus();
      return;
    }

    email.setAttribute("aria-invalid", "false");
    showMessage(
      "Thanks — we saved “" + result.value + "” for Issue 14. (Demo only: nothing was sent.)",
      "is-success"
    );
    form.reset();
  });
})();
