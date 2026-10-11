(function () {
  "use strict";

  var body = document.body;

  /* ------------------------------------------------- Reading mode */

  var toggle = document.getElementById("reading-toggle");
  var READING_KEY = "margin-reading-mode";

  function applyReadingMode(on) {
    body.classList.toggle("reading-mode", on);
    toggle.setAttribute("aria-pressed", on ? "true" : "false");
    var label = toggle.querySelector(".reading-label");
    label.textContent = on ? "Exit reading mode" : "Reading mode";
    try {
      if (on) {
        window.localStorage.setItem(READING_KEY, "on");
      } else {
        window.localStorage.removeItem(READING_KEY);
      }
    } catch (e) {
      /* storage unavailable — ignore */
    }
  }

  toggle.addEventListener("click", function () {
    applyReadingMode(!body.classList.contains("reading-mode"));
  });

  var saved = null;
  try {
    saved = window.localStorage.getItem(READING_KEY);
  } catch (e) {
    /* storage unavailable — ignore */
  }
  if (saved === "on") {
    applyReadingMode(true);
  }

  /* ------------------------------------------------- Email validation */

  var form = document.querySelector(".subscribe-form");
  var input = document.getElementById("email");
  var feedback = document.getElementById("email-feedback");

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setFeedback(message, kind) {
    feedback.textContent = message;
    feedback.classList.remove("is-error", "is-success");
    if (kind) {
      feedback.classList.add(kind);
      input.setAttribute("aria-invalid", kind === "is-error" ? "true" : "false");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }

  function validate(value) {
    var trimmed = (value || "").trim();
    if (trimmed === "") {
      return { ok: false, message: "Please enter an email address." };
    }
    if (!EMAIL_RE.test(trimmed)) {
      return {
        ok: false,
        message: "That doesn’t look like an email address yet.",
      };
    }
    return {
      ok: true,
      message: "Thanks — we’ll be in touch. No charge today.",
    };
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var result = validate(input.value);
    if (result.ok) {
      setFeedback(result.message, "is-success");
      input.removeAttribute("aria-invalid");
    } else {
      setFeedback(result.message, "is-error");
      input.focus();
    }
  });

  input.addEventListener("blur", function () {
    if (input.value.trim() !== "") {
      var result = validate(input.value);
      setFeedback(
        result.ok ? "" : result.message,
        result.ok ? null : "is-error"
      );
    }
  });

  input.addEventListener("input", function () {
    if (input.getAttribute("aria-invalid") === "true") {
      var result = validate(input.value);
      if (result.ok) {
        setFeedback("", null);
      }
    }
  });
})();