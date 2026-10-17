/**
 * MARGIN — Issue 14: Low Water (Autumn 2026)
 * Local editorial interactions: Reading mode controls, survey plate log,
 * excerpt drawer, and client-side subscription email validation.
 */

(function () {
  "use strict";

  const root = document.documentElement;
  const announcer = document.getElementById("reading-mode-announcer");

  function announce(message) {
    if (!announcer) return;
    announcer.textContent = "";
    window.requestAnimationFrame(() => {
      announcer.textContent = message;
    });
  }

  function savePreference(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_) {
      // Ignore storage errors in restricted environments
    }
  }

  function loadPreference(key, fallback) {
    try {
      const val = window.localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch (_) {
      return fallback;
    }
  }

  /* ========================================================================
     1. Reading Mode Controls (Surface Theme, Type Scale, Quiet Margin)
     ======================================================================== */
  const themeButtons = Array.from(document.querySelectorAll("[data-theme-value]"));
  const scaleToggle = document.getElementById("scale-toggle");
  const focusToggle = document.getElementById("focus-toggle");

  const themeLabels = {
    paper: "Paper (uncoated warm stock)",
    ledger: "Ledger (archival sepia surface)",
    nocturne: "Nocturne (low-light dark ink)"
  };

  function applyTheme(themeName, shouldAnnounce) {
    const validTheme = themeLabels[themeName] ? themeName : "paper";
    root.setAttribute("data-theme", validTheme);

    themeButtons.forEach((btn) => {
      const isMatch = btn.getAttribute("data-theme-value") === validTheme;
      btn.setAttribute("aria-pressed", isMatch ? "true" : "false");
    });

    savePreference("margin_theme", validTheme);
    if (shouldAnnounce) {
      announce("Reading surface set to " + themeLabels[validTheme] + ".");
    }
  }

  function applyScale(scaleMode, shouldAnnounce) {
    const isLarge = scaleMode === "large";
    root.setAttribute("data-scale", isLarge ? "large" : "standard");
    if (scaleToggle) {
      scaleToggle.setAttribute("aria-pressed", isLarge ? "true" : "false");
    }
    savePreference("margin_scale", isLarge ? "large" : "standard");
    if (shouldAnnounce) {
      announce(isLarge ? "Large reading type enabled." : "Standard reading type restored.");
    }
  }

  function applyFocus(focusMode, shouldAnnounce) {
    const isFocused = focusMode === "on";
    root.setAttribute("data-focus", isFocused ? "on" : "off");
    if (focusToggle) {
      focusToggle.setAttribute("aria-pressed", isFocused ? "true" : "false");
    }
    savePreference("margin_focus", isFocused ? "on" : "off");
    if (shouldAnnounce) {
      announce(
        isFocused
          ? "Quiet Margin enabled: marginalia dimmed for uninterrupted reading."
          : "Quiet Margin disabled: full marginalia restored."
      );
    }
  }

  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTheme = btn.getAttribute("data-theme-value");
      applyTheme(targetTheme, true);
    });
  });

  if (scaleToggle) {
    scaleToggle.addEventListener("click", () => {
      const nextScale = root.getAttribute("data-scale") === "large" ? "standard" : "large";
      applyScale(nextScale, true);
    });
  }

  if (focusToggle) {
    focusToggle.addEventListener("click", () => {
      const nextFocus = root.getAttribute("data-focus") === "on" ? "off" : "on";
      applyFocus(nextFocus, true);
    });
  }

  // Restore saved preferences on load
  applyTheme(loadPreference("margin_theme", "paper"), false);
  applyScale(loadPreference("margin_scale", "standard"), false);
  applyFocus(loadPreference("margin_focus", "off"), false);

  /* ========================================================================
     2. Cover Story Opening Folio Excerpt Toggle
     ======================================================================== */
  const excerptToggle = document.getElementById("excerpt-toggle");
  const excerptToggleLabel = document.getElementById("excerpt-toggle-label");
  const coverExcerpt = document.getElementById("cover-excerpt");

  if (excerptToggle && coverExcerpt) {
    excerptToggle.addEventListener("click", () => {
      const isExpanded = excerptToggle.getAttribute("aria-expanded") === "true";
      const nextState = !isExpanded;
      excerptToggle.setAttribute("aria-expanded", nextState ? "true" : "false");
      coverExcerpt.hidden = !nextState;
      if (excerptToggleLabel) {
        excerptToggleLabel.textContent = nextState
          ? "Close Opening Folio (p. 12)"
          : "Read Opening Folio (p. 12)";
      }
    });
  }

  /* ========================================================================
     3. Interactive Bathymetric Survey Plate (Artifact Callouts)
     ======================================================================== */
  const artifactData = {
    "01": {
      tabId: "tab-01",
      coord: "SPECIMEN 01 · ELEV. −1.45m · GRID 35°39′N",
      note: "Zinc-bound account book from K. Sato Hardware (1978). Penciled tallies for galvanized pipe and kerosene remain legible beneath river clay."
    },
    "02": {
      tabId: "tab-02",
      coord: "SPECIMEN 02 · ELEV. −2.30m · ABOLISHED WARD IV",
      note: "Stamped concrete boundary marker and kerbstone alignment from a street grid submerged during the 1964 channel widening."
    },
    "03": {
      tabId: "tab-03",
      coord: "SPECIMEN 03 · ELEV. −3.25m · EDDY SCOUR POCKET",
      note: "Unopened gross of tin-lined crown bottle caps sorted by forty years of winter current beside the third bridge pier."
    }
  };

  const artifactTabs = Array.from(document.querySelectorAll("[data-artifact-btn]"));
  const artifactNodes = Array.from(document.querySelectorAll("[data-artifact]"));
  const artifactPanel = document.getElementById("artifact-panel");
  const artifactCoord = document.getElementById("artifact-coord");
  const artifactNote = document.getElementById("artifact-note");

  function selectArtifact(id) {
    const entry = artifactData[id];
    if (!entry) return;

    artifactTabs.forEach((tab) => {
      const active = tab.getAttribute("data-artifact-btn") === id;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    artifactNodes.forEach((node) => {
      const active = node.getAttribute("data-artifact") === id;
      node.classList.toggle("is-active", active);
    });

    if (artifactPanel) {
      artifactPanel.setAttribute("aria-labelledby", entry.tabId);
    }
    if (artifactCoord) {
      artifactCoord.textContent = entry.coord;
    }
    if (artifactNote) {
      artifactNote.textContent = entry.note;
    }
  }

  artifactTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      selectArtifact(tab.getAttribute("data-artifact-btn"));
    });

    tab.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const dir = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (index + dir + artifactTabs.length) % artifactTabs.length;
        const nextTab = artifactTabs[nextIndex];
        nextTab.focus();
        selectArtifact(nextTab.getAttribute("data-artifact-btn"));
      }
    });
  });

  artifactNodes.forEach((node) => {
    node.addEventListener("click", () => {
      selectArtifact(node.getAttribute("data-artifact"));
    });
  });

  /* ========================================================================
     4. Subscription Email Validation & Inline Feedback (No Remote Submission)
     ======================================================================== */
  const subForm = document.getElementById("subscription-form");
  const emailInput = document.getElementById("subscriber-email");
  const feedbackBox = document.getElementById("email-feedback");

  function validateEmail(rawValue) {
    const value = rawValue.trim();

    if (!value) {
      return {
        valid: false,
        message: "Please enter an email address to reserve Issue 14."
      };
    }

    if (value.includes(" ")) {
      return {
        valid: false,
        message: "Email addresses cannot contain spaces. Please check your entry."
      };
    }

    const parts = value.split("@");
    if (parts.length !== 2 || !parts[0]) {
      return {
        valid: false,
        message: "Please include an ‘@’ symbol followed by a valid domain (for example, reader@domain.jp)."
      };
    }

    const domain = parts[1];
    if (!domain || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
      return {
        valid: false,
        message: "Please enter a complete domain name after ‘@’ (for example, domain.jp or example.com)."
      };
    }

    const domainSegments = domain.split(".");
    const tld = domainSegments[domainSegments.length - 1];
    if (tld.length < 2) {
      return {
        valid: false,
        message: "The domain extension looks incomplete. Please check the characters after the final period."
      };
    }

    return { valid: true, normalized: value };
  }

  function clearFeedback() {
    if (!feedbackBox || !emailInput) return;
    feedbackBox.hidden = true;
    feedbackBox.className = "sub-form__feedback";
    feedbackBox.textContent = "";
    emailInput.setAttribute("aria-invalid", "false");
  }

  function renderError(message) {
    if (!feedbackBox || !emailInput) return;
    emailInput.setAttribute("aria-invalid", "true");
    feedbackBox.hidden = false;
    feedbackBox.className = "sub-form__feedback sub-form__feedback--error";
    feedbackBox.textContent = message;
  }

  function renderSuccess(email) {
    if (!feedbackBox || !emailInput) return;
    emailInput.setAttribute("aria-invalid", "false");
    feedbackBox.hidden = false;
    feedbackBox.className = "sub-form__feedback sub-form__feedback--success";
    feedbackBox.innerHTML = "";

    const title = document.createElement("strong");
    title.textContent = "Dispatch reserved for " + email + ".";

    const detail = document.createElement("p");
    detail.style.margin = "0.35rem 0 0";
    detail.textContent =
      "Issue 14 (Low Water, Autumn 2026) — Print + Digital at ¥2,400 per issue, cancel anytime. Your digital reading pass and postal confirmation link are ready.";

    const actions = document.createElement("div");
    actions.className = "feedback-actions";

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "feedback-reset-btn";
    resetBtn.textContent = "Use a different email address";
    resetBtn.addEventListener("click", () => {
      clearFeedback();
      emailInput.focus();
      emailInput.select();
    });

    actions.appendChild(resetBtn);
    feedbackBox.appendChild(title);
    feedbackBox.appendChild(detail);
    feedbackBox.appendChild(actions);
  }

  if (subForm && emailInput) {
    emailInput.addEventListener("input", () => {
      if (emailInput.getAttribute("aria-invalid") === "true") {
        clearFeedback();
      }
    });

    subForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const result = validateEmail(emailInput.value);

      if (!result.valid) {
        renderError(result.message);
        emailInput.focus();
        return;
      }

      renderSuccess(result.normalized);
    });
  }
})();
