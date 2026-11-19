(function () {
  "use strict";

  var root = document.documentElement;
  var toggle = document.getElementById("reading-toggle");
  var toggleLabel = toggle.querySelector(".reading-toggle__text");
  var announcement = document.getElementById("reading-status");
  var reading = false;

  try {
    reading = window.localStorage.getItem("margin-reading") === "on";
  } catch (error) {
    reading = false;
  }

  function applyReadingMode(on, announce, persist) {
    reading = on;
    root.classList.toggle("is-reading", on);
    toggle.setAttribute("aria-pressed", String(on));
    toggle.setAttribute(
      "aria-label",
      on ? "Turn off reading mode" : "Turn on reading mode"
    );
    toggleLabel.textContent = on ? "Exit reading mode" : "Reading mode";

    if (announce && announcement) {
      announcement.textContent = on
        ? "Reading mode on. Decorative artwork hidden and text measure narrowed."
        : "Reading mode off.";
    }

    if (persist) {
      try {
        window.localStorage.setItem("margin-reading", on ? "on" : "off");
      } catch (error) {
        /* Storage may be unavailable; the toggle still works for this visit. */
      }
    }
  }

  applyReadingMode(reading, false, false);

  toggle.addEventListener("click", function () {
    applyReadingMode(!reading, true, true);
  });

  /* ---------- Subscription form ---------- */

  var form = document.getElementById("signup");
  var input = document.getElementById("email");
  var status = document.getElementById("email-status");
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setStatus(message, state) {
    status.textContent = message;
    status.classList.toggle("is-error", state === "error");
    status.classList.toggle("is-success", state === "success");
    input.setAttribute("aria-invalid", state === "error" ? "true" : "false");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var value = input.value.trim();

    if (!value) {
      setStatus("Enter an email address so we know where to send Issue 15.", "error");
      input.focus();
      return;
    }

    if (!emailPattern.test(value)) {
      setStatus("That address looks incomplete — check for a typo and try again.", "error");
      input.focus();
      return;
    }

    setStatus(
      "Thank you — " + value + " is on the list for Issue 15. No payment has been taken.",
      "success"
    );
    form.reset();
  });

  input.addEventListener("input", function () {
    if (status.textContent) {
      setStatus("", "idle");
    }
  });
})();
