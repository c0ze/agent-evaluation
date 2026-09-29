"use strict";

(() => {
  const readingToggle = document.querySelector(".reading-toggle");
  const readingState = document.querySelector(".reading-state");
  const preferenceKey = "margin-reading-mode";

  function setReadingMode(enabled) {
    document.documentElement.classList.toggle("reading-mode", enabled);
    readingToggle.setAttribute("aria-pressed", String(enabled));
    readingState.textContent = enabled ? "On" : "Off";
  }

  // Storage can be unavailable for file URLs or in private browsing.
  try {
    setReadingMode(localStorage.getItem(preferenceKey) === "on");
  } catch {
    setReadingMode(false);
  }

  readingToggle.hidden = false;
  readingToggle.addEventListener("click", () => {
    const enabled = readingToggle.getAttribute("aria-pressed") !== "true";
    setReadingMode(enabled);
    try {
      localStorage.setItem(preferenceKey, enabled ? "on" : "off");
    } catch {
      // The control still works for this visit without persistent storage.
    }
  });

  const form = document.querySelector("#subscribe-form");
  const email = document.querySelector("#email");
  const feedback = document.querySelector("#email-feedback");
  const submitButton = form.querySelector('button[type="submit"]');

  function showFeedback(message, state) {
    feedback.textContent = message;
    feedback.dataset.state = state;
    email.setAttribute("aria-invalid", String(state === "error"));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    email.value = email.value.trim();

    if (!email.value) {
      showFeedback("Enter your email address to continue.", "error");
      email.focus();
      return;
    }

    // Native email validation plus a dotted domain gives useful demo feedback.
    if (!email.validity.valid || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      showFeedback("Enter a complete email address, like name@example.com.", "error");
      email.focus();
      return;
    }

    showFeedback("Thank you! Your email is valid. This preview hasn’t sent or saved it.", "success");
    email.value = "";
  });

  email.addEventListener("input", () => {
    if (feedback.textContent) {
      feedback.textContent = "";
      delete feedback.dataset.state;
      email.removeAttribute("aria-invalid");
    }
  });

  // Enable the preview only once its no-submission handler is attached.
  form.noValidate = true;
  email.disabled = false;
  submitButton.disabled = false;
})();
