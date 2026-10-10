/* ==========================================================================
   MARGIN — Issue 14, Low Water
   1. Reading mode (colour + large text), remembered per browser.
   2. Fit the display title to the column, whatever serif the device has.
   3. The ruler: tick marks travel with the page; the water level falls as you read.
   4. Email field with inline validation and a success state. Nothing is sent.
   No dependencies, no network.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var STORAGE_KEY = "margin:reading-mode";

  /* ---- Safe storage (can throw in private windows or when blocked) ------- */
  function readSaved() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) || {} : {};
    } catch (e) {
      return {};
    }
  }
  function writeSaved(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* the mode still works for this visit; it just will not be remembered */
    }
  }

  /* ---- 1. Reading mode: applied immediately, before first paint ---------- */
  var darkQuery = null;
  try {
    darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  } catch (e) {
    darkQuery = null;
  }

  var saved = readSaved();
  var hasSavedTone = saved.tone === "paper" || saved.tone === "night";
  var state = {
    tone: hasSavedTone ? saved.tone : darkQuery && darkQuery.matches ? "night" : "paper",
    size: saved.size === "large" ? "large" : "normal"
  };

  root.classList.add("js");

  function applyState() {
    root.setAttribute("data-theme", state.tone);
    root.setAttribute("data-size", state.size);
  }
  applyState();

  // Follow the system setting until the reader makes an explicit choice.
  if (darkQuery && !hasSavedTone) {
    var onSystemChange = function (e) {
      if (hasSavedTone) return;
      state.tone = e.matches ? "night" : "paper";
      applyState();
      syncControls();
    };
    if (darkQuery.addEventListener) darkQuery.addEventListener("change", onSystemChange);
    else if (darkQuery.addListener) darkQuery.addListener(onSystemChange);
  }

  var toneInputs = [];
  var sizeButton = null;
  var statusEl = null;

  function syncControls() {
    toneInputs.forEach(function (input) {
      input.checked = input.value === state.tone;
    });
    if (sizeButton) sizeButton.setAttribute("aria-pressed", state.size === "large" ? "true" : "false");
  }

  function announce(message) {
    if (!statusEl) return;
    // Clear first so repeating the same message is still announced.
    statusEl.textContent = "";
    window.setTimeout(function () {
      statusEl.textContent = message;
    }, 30);
  }

  function initReadingMode() {
    toneInputs = Array.prototype.slice.call(document.querySelectorAll('input[name="tone"]'));
    sizeButton = document.getElementById("size-toggle");
    statusEl = document.getElementById("rm-status");
    syncControls();

    toneInputs.forEach(function (input) {
      input.addEventListener("change", function () {
        if (!input.checked) return;
        state.tone = input.value;
        hasSavedTone = true;
        applyState();
        writeSaved(state);
        announce(state.tone === "night" ? "Night reading mode on." : "Paper reading mode on.");
      });
    });

    if (sizeButton) {
      sizeButton.addEventListener("click", function () {
        state.size = state.size === "large" ? "normal" : "large";
        applyState();
        syncControls();
        writeSaved(state);
        announce(state.size === "large" ? "Large text on." : "Large text off.");
        fitDisplay();
      });
    }
  }

  /* ---- 2. Fit the display title ------------------------------------------ */
  // The CSS size suits a typical serif. On phones the widest line is scaled to fill the
  // column (up or down); elsewhere it is only ever scaled down, so a wider fallback serif
  // never makes "Water" overflow.
  function fitDisplay() {
    var title = document.querySelector(".title");
    var heading = title && title.querySelector(".display");
    if (!heading) return;

    title.style.removeProperty("--fit");
    var available = title.clientWidth;
    var widest = 0;
    Array.prototype.forEach.call(heading.querySelectorAll(".display__line"), function (line) {
      widest = Math.max(widest, line.getBoundingClientRect().width);
    });
    if (!widest || !available) return;

    var maxScale = window.innerWidth < 720 ? 1.6 : 1;
    var scale = Math.min(maxScale, (available / widest) * 0.985);
    if (Math.abs(scale - 1) > 0.01) title.style.setProperty("--fit", scale.toFixed(4));
  }

  /* ---- 3. The ruler ------------------------------------------------------- */
  var ticking = false;
  function updateRuler() {
    ticking = false;
    var y = window.pageYOffset || root.scrollTop || 0;
    var max = Math.max(1, root.scrollHeight - window.innerHeight);
    var progress = Math.min(1, Math.max(0, y / max));
    root.style.setProperty("--p", progress.toFixed(4));
    root.style.setProperty("--scroll-neg", -(y % 100) + "px");
  }
  function requestRuler() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateRuler);
  }

  /* ---- 4. Email field ----------------------------------------------------- */
  // Local part: no spaces, no quotes or brackets, no leading/trailing/double dots.
  // Domain: dot-separated labels, at least one dot, final label 2+ characters.
  var EMAIL_PATTERN = /^[^\s@"(),:;<>\[\]\\.]+(?:\.[^\s@"(),:;<>\[\]\\.]+)*@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}\p{N}]{2,}$/u;

  function checkEmail(raw) {
    var value = raw.trim();
    if (!value) {
      return { ok: false, message: "Enter your email address to subscribe." };
    }
    if (/\s/.test(value)) {
      return { ok: false, message: "Remove the spaces from your email address." };
    }
    var at = value.indexOf("@");
    if (at === -1) {
      return { ok: false, message: "Your address needs an @, like name@example.com." };
    }
    if (at !== value.lastIndexOf("@")) {
      return { ok: false, message: "Use only one @ in your email address." };
    }
    if (at === 0) {
      return { ok: false, message: "Add the part before the @, like name@example.com." };
    }
    var domain = value.slice(at + 1);
    if (!domain) {
      return { ok: false, message: "Add a domain after the @, like name@example.com." };
    }
    if (domain.indexOf(".") === -1) {
      return { ok: false, message: "The part after the @ needs a dot, like example.com." };
    }
    if (value.length > 254 || !EMAIL_PATTERN.test(value)) {
      return { ok: false, message: "That doesn’t look like a valid email address. Check for typos." };
    }
    return { ok: true, message: "" };
  }

  function initForm() {
    var form = document.getElementById("sub-form");
    var field = document.getElementById("email-field");
    var input = document.getElementById("email");
    var feedback = document.getElementById("email-feedback");
    var success = document.getElementById("sub-success");
    var successEmail = document.getElementById("success-email");
    var reset = document.getElementById("sub-reset");
    if (!form || !field || !input || !feedback || !success) return;

    // With JavaScript we own the messages, so switch the browser's own bubbles off.
    form.setAttribute("novalidate", "");

    var touched = false;
    var lastMessage = null;

    function show(kind, message) {
      // kind: "error" | "ok" | null
      if (message === lastMessage && kind === field.getAttribute("data-state")) return;
      lastMessage = message;
      feedback.textContent = "";
      feedback.className = "feedback";
      if (!kind) {
        field.removeAttribute("data-state");
        input.removeAttribute("aria-invalid");
        return;
      }
      field.setAttribute("data-state", kind);
      if (kind === "error") input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");

      var icon = document.createElement("span");
      icon.className = "feedback__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = kind === "error" ? "!" : "✓";
      var text = document.createElement("span");
      text.textContent = message;
      if (kind === "ok") feedback.classList.add("feedback--ok");
      feedback.appendChild(icon);
      feedback.appendChild(text);
    }

    function validate(announceValid) {
      var result = checkEmail(input.value);
      if (result.ok) {
        show(announceValid ? "ok" : null, announceValid ? "That looks like a valid address." : "");
      } else {
        show("error", result.message);
      }
      return result.ok;
    }

    // Validate when leaving the field (if something was typed), then live as it is corrected.
    input.addEventListener("blur", function () {
      if (input.value.trim() !== "") {
        touched = true;
        validate(true);
      }
    });
    input.addEventListener("input", function () {
      if (touched) validate(true);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      touched = true;
      if (!validate(false)) {
        input.focus();
        return;
      }
      // Preview only: show the address back to the reader, send nothing.
      successEmail.textContent = input.value.trim();
      form.hidden = true;
      success.hidden = false;
      success.focus();
    });

    if (reset) {
      reset.addEventListener("click", function () {
        input.value = "";
        touched = false;
        lastMessage = null;
        show(null, "");
        success.hidden = true;
        form.hidden = false;
        input.focus();
      });
    }
  }

  /* ---- Boot --------------------------------------------------------------- */
  function boot() {
    initReadingMode();
    initForm();
    fitDisplay();
    updateRuler();

    window.addEventListener("scroll", requestRuler, { passive: true });
    window.addEventListener("resize", function () {
      fitDisplay();
      requestRuler();
    });
    if (window.ResizeObserver) {
      var title = document.querySelector(".title");
      var lastWidth = title ? title.clientWidth : 0;
      if (title) {
        // Width only: fitting changes the title's height, which must not re-trigger itself.
        new ResizeObserver(function () {
          if (title.clientWidth === lastWidth) return;
          lastWidth = title.clientWidth;
          fitDisplay();
        }).observe(title);
      }
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitDisplay);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
