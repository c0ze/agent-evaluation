(function () {
  "use strict";

  const STORAGE_KEY = "margin-reading-mode";
  const VALID_MODES = new Set(["paper", "quiet", "night"]);
  const MODE_DESCRIPTIONS = {
    paper: "Paper reading mode active: archival uncoated paper contrast.",
    quiet: "Quiet reading mode active: warm sepia ground with larger, calmer typography.",
    night: "Night reading mode active: dark slate ground with warm ink for low light."
  };

  /* ------------------------------------------------------------------------
     Reading-mode control
     ------------------------------------------------------------------------ */

  const root = document.documentElement;
  const modeButtons = Array.from(document.querySelectorAll(".reading-btn[data-mode]"));
  const modeAnnouncer = document.getElementById("mode-announcer");

  function readStoredMode() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return VALID_MODES.has(saved) ? saved : "paper";
    } catch (_err) {
      return "paper";
    }
  }

  function writeStoredMode(mode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch (_err) {
      // Storage may be unavailable in restricted contexts; ignore safely.
    }
  }

  function applyReadingMode(mode, announce) {
    const nextMode = VALID_MODES.has(mode) ? mode : "paper";
    root.dataset.readingMode = nextMode;

    modeButtons.forEach((button) => {
      const isActive = button.dataset.mode === nextMode;
      button.setAttribute("aria-pressed", String(isActive));
    });

    if (announce && modeAnnouncer) {
      modeAnnouncer.textContent = "";
      window.requestAnimationFrame(() => {
        modeAnnouncer.textContent = MODE_DESCRIPTIONS[nextMode];
      });
    }
  }

  applyReadingMode(readStoredMode(), false);

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const chosenMode = button.dataset.mode;
      if (!VALID_MODES.has(chosenMode)) {
        return;
      }
      writeStoredMode(chosenMode);
      applyReadingMode(chosenMode, true);
    });
  });

  /* ------------------------------------------------------------------------
     Subscription email field: inline validation & local preview feedback
     ------------------------------------------------------------------------ */

  const form = document.getElementById("subscribe-form");
  const emailInput = document.getElementById("subscriber-email");
  const feedback = document.getElementById("form-feedback");

  if (!form || !emailInput || !feedback) {
    return;
  }

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function clearFeedback() {
    feedback.hidden = true;
    feedback.className = "form-feedback";
    feedback.textContent = "";
  }

  function showError(message) {
    emailInput.setAttribute("aria-invalid", "true");
    feedback.hidden = false;
    feedback.className = "form-feedback is-error";
    feedback.textContent = message;
  }

  function showSuccess(address) {
    emailInput.setAttribute("aria-invalid", "false");
    feedback.hidden = false;
    feedback.className = "form-feedback is-success";
    feedback.textContent = "";

    const heading = document.createElement("span");
    heading.className = "feedback-heading";
    heading.textContent = "Issue 14 reserved (local preview)";

    const body = document.createElement("p");
    body.textContent =
      "We prepared a print + digital reservation for " +
      address +
      " at ¥2,400 per issue (cancel anytime). No address was submitted or stored remotely.";

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "feedback-reset";
    resetBtn.textContent = "Use another address";
    resetBtn.addEventListener("click", () => {
      form.reset();
      emailInput.setAttribute("aria-invalid", "false");
      clearFeedback();
      emailInput.focus();
    });

    feedback.appendChild(heading);
    feedback.appendChild(body);
    feedback.appendChild(resetBtn);
  }

  function validateEmailValue(rawValue) {
    const trimmed = rawValue.trim();

    if (!trimmed) {
      return {
        valid: false,
        message: "Enter an email address to reserve Issue 14."
      };
    }

    if (!EMAIL_PATTERN.test(trimmed)) {
      return {
        valid: false,
        message: "Enter a complete email address (for example, reader@example.com)."
      };
    }

    return {
      valid: true,
      value: trimmed
    };
  }

  emailInput.addEventListener("input", () => {
    if (emailInput.getAttribute("aria-invalid") === "true") {
      const check = validateEmailValue(emailInput.value);
      if (check.valid) {
        emailInput.setAttribute("aria-invalid", "false");
        clearFeedback();
      }
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const result = validateEmailValue(emailInput.value);
    if (!result.valid) {
      showError(result.message);
      emailInput.focus();
      return;
    }

    emailInput.value = result.value;
    showSuccess(result.value);
  });
})();
