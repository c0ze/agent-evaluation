/**
 * MARGIN — Quarterly Journal of Overlooked Places
 * Client-side Editorial Interactions
 * - Theme & Reading Mode Switcher (Local Storage persisted)
 * - Accessible Inline Email Validation & Dispatch Registration
 * - Subscription Tier Selection & Interactive Receipt
 * - Archive Stock Reservation
 */

(function () {
  'use strict';

  // --- 1. Reading Mode & Theming Controls ---
  const STORAGE_KEY_THEME = 'margin_theme_preference';
  const STORAGE_KEY_SCALE = 'margin_scale_preference';

  const themeButtons = document.querySelectorAll('[data-theme-set]');
  const scaleButtons = document.querySelectorAll('[data-scale-set]');
  const htmlRoot = document.documentElement;

  // Safe localStorage helper
  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeStorageSet(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      // Ignored in private/sandboxed contexts
    }
  }

  function applyTheme(themeName) {
    if (!['newsprint', 'dark', 'linen'].includes(themeName)) {
      themeName = 'newsprint';
    }
    htmlRoot.setAttribute('data-theme', themeName);
    safeStorageSet(STORAGE_KEY_THEME, themeName);

    themeButtons.forEach(btn => {
      const isMatch = btn.getAttribute('data-theme-set') === themeName;
      btn.classList.toggle('is-active', isMatch);
      btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });
  }

  function applyScale(scaleName) {
    if (!['standard', 'large'].includes(scaleName)) {
      scaleName = 'standard';
    }
    htmlRoot.setAttribute('data-type-scale', scaleName);
    safeStorageSet(STORAGE_KEY_SCALE, scaleName);

    scaleButtons.forEach(btn => {
      const isMatch = btn.getAttribute('data-scale-set') === scaleName;
      btn.classList.toggle('is-active', isMatch);
      btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });
  }

  // Initialize saved preferences or system defaults
  const savedTheme = safeStorageGet(STORAGE_KEY_THEME);
  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // If user prefers dark mode and has no explicit choice yet
    applyTheme('dark');
  } else {
    applyTheme('newsprint');
  }

  const savedScale = safeStorageGet(STORAGE_KEY_SCALE);
  if (savedScale) {
    applyScale(savedScale);
  } else {
    applyScale('standard');
  }

  // Attach button event listeners
  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTheme = btn.getAttribute('data-theme-set');
      applyTheme(targetTheme);
    });
  });

  scaleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetScale = btn.getAttribute('data-scale-set');
      applyScale(targetScale);
    });
  });

  // --- 2. Functional Email Field with Inline Validation & Success Feedback ---
  const dispatchForm = document.getElementById('dispatch-form');
  const emailInput = document.getElementById('subscriber-email');
  const feedbackContainer = document.getElementById('email-feedback');
  const submitButton = document.getElementById('btn-submit-email');

  // Common typo dictionary for domain auto-suggestions
  const TYPO_MAP = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'yaho.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'prton.me': 'proton.me',
    'prtonmail.com': 'protonmail.com'
  };

  // Standard robust email regex conforming to HTML5 spec
  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  function validateEmailValue(val) {
    val = (val || '').trim();
    if (!val) {
      return { isValid: false, reason: 'empty', message: 'Please provide an email address to receive the dispatch.' };
    }
    if (!EMAIL_REGEX.test(val)) {
      return { isValid: false, reason: 'format', message: 'Please enter a valid email address (e.g., reader@domain.org).' };
    }

    const domain = val.split('@')[1].toLowerCase();
    if (TYPO_MAP[domain]) {
      const correctedDomain = TYPO_MAP[domain];
      const suggestedEmail = val.split('@')[0] + '@' + correctedDomain;
      return { 
        isValid: true, 
        hasSuggestion: true, 
        suggestion: suggestedEmail, 
        message: `Did you mean ${suggestedEmail}?`
      };
    }

    return { isValid: true };
  }

  function displayError(message, suggestion) {
    emailInput.setAttribute('aria-invalid', 'true');
    feedbackContainer.innerHTML = '';

    const errorDiv = document.createElement('div');
    errorDiv.className = 'feedback-msg error';

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    errorDiv.appendChild(msgSpan);

    if (suggestion) {
      const suggestionBtn = document.createElement('button');
      suggestionBtn.type = 'button';
      suggestionBtn.className = 'suggestion-prompt';
      suggestionBtn.textContent = `Click to apply: ${suggestion}`;
      suggestionBtn.addEventListener('click', () => {
        emailInput.value = suggestion;
        displayError('', null);
        validateAndShowFeedback(false);
        emailInput.focus();
      });
      errorDiv.appendChild(suggestionBtn);
    }

    feedbackContainer.appendChild(errorDiv);
  }

  function displaySuccess(registeredEmail) {
    emailInput.setAttribute('aria-invalid', 'false');
    emailInput.disabled = true;
    if (submitButton) submitButton.disabled = true;

    feedbackContainer.innerHTML = '';

    const successDiv = document.createElement('div');
    successDiv.className = 'feedback-msg success';

    const headSpan = document.createElement('strong');
    headSpan.textContent = '✓ Dispatch Registered for Issue 14 (Autumn 2026)';
    successDiv.appendChild(headSpan);

    const detailSpan = document.createElement('span');
    detailSpan.textContent = `An initial field transmission has been queued for ${registeredEmail}. Dispatches arrive on the 1st and 15th of each month. No algorithmic tracking.`;
    successDiv.appendChild(detailSpan);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'reset-link';
    resetBtn.textContent = 'Register a different reader address →';
    resetBtn.addEventListener('click', () => {
      emailInput.disabled = false;
      if (submitButton) submitButton.disabled = false;
      emailInput.value = '';
      emailInput.removeAttribute('aria-invalid');
      feedbackContainer.innerHTML = '';
      emailInput.focus();
    });
    successDiv.appendChild(resetBtn);

    feedbackContainer.appendChild(successDiv);
  }

  function clearFeedback() {
    emailInput.removeAttribute('aria-invalid');
    feedbackContainer.innerHTML = '';
  }

  function validateAndShowFeedback(isSubmitting) {
    const val = emailInput.value;
    const result = validateEmailValue(val);

    if (!result.isValid) {
      if (isSubmitting || val.length > 3) {
        displayError(result.message);
      }
      return false;
    } else {
      if (result.hasSuggestion) {
        displayError(result.message, result.suggestion);
        return true;
      }
      clearFeedback();
      return true;
    }
  }

  if (emailInput && dispatchForm) {
    // Validate on blur
    emailInput.addEventListener('blur', () => {
      if (emailInput.value.trim().length > 0) {
        validateAndShowFeedback(false);
      }
    });

    // Clear error as user corrects it
    emailInput.addEventListener('input', () => {
      if (emailInput.getAttribute('aria-invalid') === 'true') {
        const result = validateEmailValue(emailInput.value);
        if (result.isValid && !result.hasSuggestion) {
          clearFeedback();
        }
      }
    });

    // Form submit interception
    dispatchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = emailInput.value.trim();
      const result = validateEmailValue(val);

      if (!result.isValid) {
        displayError(result.message);
        emailInput.focus();
      } else {
        displaySuccess(val);
      }
    });
  }

  // --- 3. Functional Subscription Offer Interaction ---
  const btnSubscribe = document.getElementById('btn-subscribe');
  const subFeedback = document.getElementById('subscription-feedback');
  const subRadioOptions = document.querySelectorAll('input[name="sub-tier"]');

  if (btnSubscribe && subFeedback) {
    // Update button text on tier change
    subRadioOptions.forEach(radio => {
      radio.addEventListener('change', () => {
        const isAnnual = radio.value === 'annual';
        const buttonTextEl = btnSubscribe.querySelector('.btn-text');
        if (buttonTextEl) {
          buttonTextEl.textContent = isAnnual 
            ? 'Begin Annual Fellowship (¥9,600 / yr)' 
            : 'Begin Subscription at ¥2,400';
        }
      });
    });

    btnSubscribe.addEventListener('click', () => {
      const selectedTier = document.querySelector('input[name="sub-tier"]:checked');
      const isAnnual = selectedTier && selectedTier.value === 'annual';

      subFeedback.className = 'subscription-feedback is-visible';
      subFeedback.innerHTML = `
        <strong>✓ Order Staged: ${isAnnual ? 'Four-Issue Annual Fellowship (¥9,600 / yr)' : 'Quarterly Rolling Edition (¥2,400)'}</strong><br>
        Your subscription begins with <em>Issue 14: Low Water</em>. 160-page tactile volume on Munken Lynx stock will dispatch via surface mail. Billed on release; modify or cancel anytime without penalties.
      `;
      btnSubscribe.setAttribute('aria-expanded', 'true');
    });
  }

  // --- 4. Archive Stock Requests ---
  const archiveButtons = document.querySelectorAll('[data-archive-order]');
  archiveButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const issueNum = btn.getAttribute('data-archive-order');
      const originalText = btn.textContent;
      btn.textContent = `✓ Reserved No. ${issueNum}`;
      btn.disabled = true;
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-outline');

      setTimeout(() => {
        btn.textContent = `Issue ${issueNum} Reserved`;
      }, 1500);
    });
  });

})();
