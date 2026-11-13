(() => {
  const STORAGE_KEY = 'margin-reading-mode';
  const root = document.documentElement;
  const toggleBtn = document.getElementById('reading-mode-toggle');
  const toggleState = document.getElementById('reading-mode-state');
  const liveStatus = document.getElementById('reading-mode-status');

  function readSavedMode() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'active';
    } catch {
      return false;
    }
  }

  function saveMode(active) {
    try {
      window.localStorage.setItem(STORAGE_KEY, active ? 'active' : 'off');
    } catch {
      // Ignore storage errors in restricted contexts such as file:// origins.
    }
  }

  function applyReadingMode(active, announce) {
    root.dataset.readingMode = active ? 'active' : 'off';
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    if (toggleState) {
      toggleState.textContent = active ? 'On' : 'Off';
    }
    if (announce && liveStatus) {
      liveStatus.textContent = active
        ? 'Reading mode enabled: focused single-column layout with enlarged prose and decorative plate hidden.'
        : 'Reading mode disabled: restored editorial broadsheet layout.';
    }
  }

  const initialReadingMode = readSavedMode();
  applyReadingMode(initialReadingMode, false);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const nextActive = root.dataset.readingMode !== 'active';
      applyReadingMode(nextActive, true);
      saveMode(nextActive);
    });
  }

  // Inline email validation & local preview confirmation (no network submission)
  const form = document.getElementById('subscribe-form');
  const emailInput = document.getElementById('subscriber-email');
  const feedback = document.getElementById('email-feedback');

  function isValidEmail(value) {
    if (!value || /\s/.test(value)) {
      return false;
    }
    const parts = value.split('@');
    if (parts.length !== 2) {
      return false;
    }
    const [local, domain] = parts;
    if (!local || !domain || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
      return false;
    }
    if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
      return false;
    }
    const domainLabels = domain.split('.');
    if (domainLabels.length < 2) {
      return false;
    }
    const tld = domainLabels[domainLabels.length - 1];
    if (tld.length < 2 || !/^[a-zA-Z0-9-]+$/.test(tld)) {
      return false;
    }
    return domainLabels.every((label) => label.length > 0 && /^[a-zA-Z0-9-]+$/.test(label));
  }

  function showError(message) {
    if (!emailInput || !feedback) {
      return;
    }
    emailInput.setAttribute('aria-invalid', 'true');
    feedback.className = 'form-feedback is-error';
    feedback.textContent = message;
  }

  function showSuccess(email) {
    if (!emailInput || !feedback) {
      return;
    }
    emailInput.setAttribute('aria-invalid', 'false');
    feedback.className = 'form-feedback is-success';
    feedback.replaceChildren();

    const lead = document.createTextNode('Preview confirmed for ');
    const strongEmail = document.createElement('strong');
    strongEmail.textContent = email;
    const tail = document.createTextNode(
      ' — Margin Issue 14 (Low Water), print + digital at ¥2,400 per issue, cancel anytime. No data was transmitted.'
    );
    feedback.append(lead, strongEmail, tail);
  }

  function clearFeedback() {
    if (!emailInput || !feedback) {
      return;
    }
    emailInput.setAttribute('aria-invalid', 'false');
    feedback.className = 'form-feedback';
    feedback.textContent = '';
  }

  if (form && emailInput && feedback) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const rawValue = emailInput.value.trim();

      if (!rawValue) {
        showError('Please enter an email address before continuing.');
        emailInput.focus();
        return;
      }

      if (!isValidEmail(rawValue)) {
        showError('That does not look like a valid email address (for example, reader@example.com).');
        emailInput.focus();
        return;
      }

      emailInput.value = rawValue;
      showSuccess(rawValue);
    });

    emailInput.addEventListener('input', () => {
      if (emailInput.getAttribute('aria-invalid') === 'true') {
        const current = emailInput.value.trim();
        if (current && isValidEmail(current)) {
          clearFeedback();
        }
      } else if (feedback.classList.contains('is-success')) {
        clearFeedback();
      }
    });
  }
})();
