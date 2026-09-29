"use strict";

const readingToggle = document.querySelector(".reading-toggle");
const toggleState = readingToggle.querySelector(".toggle-state");

readingToggle.hidden = false;
readingToggle.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("reading-mode");
  readingToggle.setAttribute("aria-pressed", String(enabled));
  toggleState.textContent = enabled ? "On" : "Off";
});

const form = document.querySelector("#subscribe-form");
const email = document.querySelector("#email");
const feedback = document.querySelector("#email-feedback");

function showFeedback(message, state) {
  feedback.textContent = message;
  feedback.dataset.state = state;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  email.value = email.value.trim();

  if (email.value === "") {
    email.setAttribute("aria-invalid", "true");
    showFeedback("Please enter your email address.", "error");
    email.focus();
    return;
  }

  // Native email validity plus a complete domain catches common mistypes.
  const hasCompleteDomain = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email.value);
  if (!email.validity.valid || !hasCompleteDomain) {
    email.setAttribute("aria-invalid", "true");
    showFeedback("Please enter a valid email, such as you@example.com.", "error");
    email.focus();
    return;
  }

  email.removeAttribute("aria-invalid");
  showFeedback("Thank you — your email is valid. This local preview has not created a subscription or sent your address.", "success");
});

email.addEventListener("input", () => {
  if (feedback.textContent) {
    email.removeAttribute("aria-invalid");
    feedback.textContent = "";
    delete feedback.dataset.state;
  }
});

// Keep the preview inert if JavaScript is unavailable or fails to load.
form.querySelector("button[type='submit']").disabled = false;
