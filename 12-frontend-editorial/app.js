"use strict";

(() => {
  const toggle = document.querySelector(".reading-toggle");
  const readingStatus = document.querySelector("#reading-status");
  const storageKey = "margin-reading-mode";

  const setReadingMode = (enabled, announce = false) => {
    document.body.classList.toggle("reading-mode", enabled);
    toggle.setAttribute("aria-pressed", String(enabled));
    if (announce) {
      readingStatus.textContent = enabled
        ? "Reading mode on. Artwork is hidden and story text is enlarged."
        : "Reading mode off. Editorial layout restored.";
    }
  };

  // File URLs and privacy settings can make storage unavailable.
  try {
    setReadingMode(localStorage.getItem(storageKey) === "on");
  } catch {
    setReadingMode(false);
  }

  toggle.hidden = false;
  toggle.addEventListener("click", () => {
    const enabled = toggle.getAttribute("aria-pressed") !== "true";
    setReadingMode(enabled, true);
    try {
      localStorage.setItem(storageKey, enabled ? "on" : "off");
    } catch {
      // The control still works for this visit without saving a preference.
    }
  });

  const form = document.querySelector(".subscription-form");
  const email = document.querySelector("#email");
  const feedback = document.querySelector("#email-feedback");
  const submitButton = form.querySelector("button[type='submit']");
  let hasSubmitted = false;

  const validationMessage = () => {
    if (email.value.trim() === "") return "Please enter your email address.";
    const value = email.value.trim();
    const domain = value.slice(value.lastIndexOf("@") + 1);
    const validDomain = domain.split(".").every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)
    );
    if (email.validity.typeMismatch || value.length > 254 || !domain.includes(".") || !validDomain) {
      return "Please enter a valid email address, such as you@example.com.";
    }
    return "";
  };

  const showError = (message) => {
    email.setAttribute("aria-invalid", "true");
    feedback.dataset.state = "error";
    feedback.textContent = message;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    hasSubmitted = true;
    email.value = email.value.trim();
    const message = validationMessage();
    if (message) {
      showError(message);
      email.focus();
      return;
    }
    email.removeAttribute("aria-invalid");
    feedback.dataset.state = "success";
    feedback.textContent = "All set — that email looks good. This is a preview; you haven’t been subscribed or charged.";
  });

  email.addEventListener("input", () => {
    if (hasSubmitted && validationMessage()) {
      showError(validationMessage());
      return;
    }
    email.removeAttribute("aria-invalid");
    feedback.textContent = "";
    delete feedback.dataset.state;
  });

  submitButton.disabled = false;
})();
