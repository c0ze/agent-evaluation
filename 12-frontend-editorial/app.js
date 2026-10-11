/**
 * MARGIN — Quarterly Journal of Overlooked Places
 * Issue 14: Low Water (Autumn 2026)
 * Interactive Editorial Client Script
 * Zero dependencies, no network requests.
 */

(function () {
  'use strict';

  // =========================================================================
  // STORAGE & PREFERENCES UTILITIES
  // =========================================================================
  const STORAGE_KEYS = {
    THEME: 'margin_editorial_theme',
    VIEW: 'margin_editorial_view',
    SCALE: 'margin_editorial_scale'
  };

  function getStorageItem(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setStorageItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // Safe fallback if local storage is restricted
    }
  }

  // =========================================================================
  // 1. THEME (PAPER TONE) CONTROLLER
  // =========================================================================
  const themeButtons = document.querySelectorAll('[data-theme-val]');
  const htmlRoot = document.documentElement;

  function applyTheme(themeName) {
    const validThemes = ['paper', 'night', 'contrast'];
    const activeTheme = validThemes.includes(themeName) ? themeName : 'paper';
    
    htmlRoot.setAttribute('data-theme', activeTheme);
    setStorageItem(STORAGE_KEYS.THEME, activeTheme);

    themeButtons.forEach(btn => {
      const isMatch = btn.getAttribute('data-theme-val') === activeTheme;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });
  }

  themeButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const targetTheme = this.getAttribute('data-theme-val');
      applyTheme(targetTheme);
    });
  });

  // =========================================================================
  // 2. VIEW MODE (EDITORIAL VS. READING FOCUS) CONTROLLER
  // =========================================================================
  const btnViewEditorial = document.getElementById('btn-view-editorial');
  const btnViewFocus = document.getElementById('btn-view-focus');
  const btnOpenReader = document.getElementById('btn-open-reader');
  const btnExitFocus = document.getElementById('btn-exit-focus');
  const btnReturnOverview = document.getElementById('btn-return-overview');
  const focusReadingView = document.getElementById('focus-reading-view');
  const progressBar = document.getElementById('reading-progress-bar');

  let scrollPositionMemory = 0;

  function applyViewMode(mode, shouldScrollToContent = false) {
    const isFocus = mode === 'focus';
    const targetMode = isFocus ? 'focus' : 'editorial';

    htmlRoot.setAttribute('data-view', targetMode);
    setStorageItem(STORAGE_KEYS.VIEW, targetMode);

    if (btnViewEditorial) {
      btnViewEditorial.classList.toggle('active', !isFocus);
      btnViewEditorial.setAttribute('aria-pressed', !isFocus ? 'true' : 'false');
    }
    if (btnViewFocus) {
      btnViewFocus.classList.toggle('active', isFocus);
      btnViewFocus.setAttribute('aria-pressed', isFocus ? 'true' : 'false');
    }

    if (focusReadingView) {
      focusReadingView.hidden = !isFocus;
      focusReadingView.setAttribute('aria-hidden', !isFocus ? 'true' : 'false');
    }

    if (isFocus) {
      scrollPositionMemory = window.scrollY;
      if (shouldScrollToContent && focusReadingView) {
        focusReadingView.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      if (shouldScrollToContent) {
        window.scrollTo({ top: scrollPositionMemory, behavior: 'smooth' });
      }
    }

    updateReadingProgress();
  }

  if (btnViewEditorial) {
    btnViewEditorial.addEventListener('click', () => applyViewMode('editorial', false));
  }

  if (btnViewFocus) {
    btnViewFocus.addEventListener('click', () => applyViewMode('focus', true));
  }

  if (btnOpenReader) {
    btnOpenReader.addEventListener('click', () => applyViewMode('focus', true));
  }

  if (btnExitFocus) {
    btnExitFocus.addEventListener('click', () => applyViewMode('editorial', true));
  }

  if (btnReturnOverview) {
    btnReturnOverview.addEventListener('click', () => applyViewMode('editorial', true));
  }

  // Reading progress tracker
  function updateReadingProgress() {
    if (!progressBar) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    if (docHeight > 0) {
      const percentage = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100));
      progressBar.style.width = `${percentage}%`;
    } else {
      progressBar.style.width = '0%';
    }
  }

  window.addEventListener('scroll', updateReadingProgress, { passive: true });

  // =========================================================================
  // 3. TYPE SCALE CONTROLLER
  // =========================================================================
  const btnFontSmaller = document.getElementById('btn-font-smaller');
  const btnFontReset = document.getElementById('btn-font-reset');
  const btnFontLarger = document.getElementById('btn-font-larger');
  const fontScaleIndicator = document.getElementById('font-scale-indicator');

  let currentScaleFactor = parseFloat(getStorageItem(STORAGE_KEYS.SCALE, '1'));
  if (isNaN(currentScaleFactor) || currentScaleFactor < 0.85 || currentScaleFactor > 1.35) {
    currentScaleFactor = 1;
  }

  function applyTypeScale(factor) {
    currentScaleFactor = Math.round(factor * 100) / 100;
    htmlRoot.style.setProperty('--font-scale-factor', currentScaleFactor.toString());
    setStorageItem(STORAGE_KEYS.SCALE, currentScaleFactor.toString());

    if (fontScaleIndicator) {
      fontScaleIndicator.textContent = `${Math.round(currentScaleFactor * 100)}%`;
    }
  }

  if (btnFontSmaller) {
    btnFontSmaller.addEventListener('click', () => {
      if (currentScaleFactor > 0.85) {
        applyTypeScale(currentScaleFactor - 0.08);
      }
    });
  }

  if (btnFontLarger) {
    btnFontLarger.addEventListener('click', () => {
      if (currentScaleFactor < 1.35) {
        applyTypeScale(currentScaleFactor + 0.08);
      }
    });
  }

  if (btnFontReset) {
    btnFontReset.addEventListener('click', () => {
      applyTypeScale(1);
    });
  }

  // =========================================================================
  // 4. FUNCTIONAL EMAIL FIELD WITH INLINE VALIDATION & SUCCESS FEEDBACK
  // =========================================================================
  const dispatchForm = document.getElementById('dispatch-form');
  const emailInput = document.getElementById('dispatch-email');
  const validationMsg = document.getElementById('email-validation-msg');
  const successCard = document.getElementById('dispatch-success-card');
  const confirmedEmailDisplay = document.getElementById('confirmed-email-display');
  const btnResetDispatch = document.getElementById('btn-reset-dispatch');

  // RFC 5322 compliant regex for clean client validation
  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  function validateEmailString(email) {
    const trimmed = email.trim();
    if (!trimmed) {
      return { isValid: false, message: 'Please enter your email address to join the dispatch.' };
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      return { isValid: false, message: 'Please enter a valid email address (e.g., reader@domain.org).' };
    }
    return { isValid: true, message: '' };
  }

  function displayValidationError(message) {
    if (!validationMsg || !emailInput) return;
    emailInput.classList.add('is-invalid');
    emailInput.setAttribute('aria-invalid', 'true');
    validationMsg.className = 'validation-message error';
    validationMsg.textContent = message;
  }

  function clearValidationError() {
    if (!validationMsg || !emailInput) return;
    emailInput.classList.remove('is-invalid');
    emailInput.removeAttribute('aria-invalid');
    validationMsg.className = 'validation-message neutral';
    validationMsg.textContent = '';
  }

  if (emailInput) {
    // Clear validation error dynamically while the user fixes their input
    emailInput.addEventListener('input', () => {
      if (emailInput.classList.contains('is-invalid')) {
        const result = validateEmailString(emailInput.value);
        if (result.isValid) {
          clearValidationError();
        }
      }
    });

    // Validate on blur if content exists
    emailInput.addEventListener('blur', () => {
      if (emailInput.value.trim().length > 0) {
        const result = validateEmailString(emailInput.value);
        if (!result.isValid) {
          displayValidationError(result.message);
        } else {
          clearValidationError();
        }
      }
    });
  }

  if (dispatchForm) {
    dispatchForm.addEventListener('submit', (e) => {
      e.preventDefault(); // strictly client-side; no actual network submission
      
      const rawValue = emailInput ? emailInput.value : '';
      const validation = validateEmailString(rawValue);

      if (!validation.isValid) {
        displayValidationError(validation.message);
        if (emailInput) emailInput.focus();
        return;
      }

      // Valid case: show inline success confirmation
      clearValidationError();
      const sanitizedEmail = rawValue.trim();

      if (dispatchForm) dispatchForm.hidden = true;
      if (successCard) {
        successCard.hidden = false;
        if (confirmedEmailDisplay) confirmedEmailDisplay.textContent = sanitizedEmail;
        successCard.focus();
      }
    });
  }

  if (btnResetDispatch) {
    btnResetDispatch.addEventListener('click', () => {
      if (successCard) successCard.hidden = true;
      if (dispatchForm) {
        dispatchForm.hidden = false;
        if (emailInput) {
          emailInput.value = '';
          clearValidationError();
          emailInput.focus();
        }
      }
    });
  }

  // =========================================================================
  // 5. INTERACTIVE SUPPORTING STORIES & EXCERPT DRAWER
  // =========================================================================
  const excerptDrawer = document.getElementById('excerpt-drawer');
  const drawerTitle = document.getElementById('drawer-title');
  const drawerContent = document.getElementById('drawer-content');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const previewButtons = document.querySelectorAll('[data-preview]');

  const STORY_EXCERPTS = {
    'night-bus': {
      title: 'Night Bus Atlas — Tomás Iriarte',
      content: `
        <p><em>“The daytime bus network is built like a wheel with spoke after spoke converging on bank towers. But after 01:30, the wheel shatters into an eccentric oval.”</em></p>
        <p>Iriarte spent six months riding Route N-04 and Route N-11 through the outer perimeter ring roads. Here, between 02:00 and 04:30, the passengers are not commuters racing against clocks; they are the custodial staff of forty hospitals, commercial bakery shifts, and sorting-center loaders. Their conversations create an oral atlas of back-alleys, service entrances, and loading bays unknown to daylight city maps.</p>
        <p><strong>Field Notes:</strong> The map included in Issue 14 details 14 nocturnal routes, transfer nodes at 24-hour freight depots, and the peculiar acoustics of double-decker coaches rattling through empty underpasses.</p>
      `
    },
    'concrete-orchards': {
      title: 'Concrete Orchards — Meera Das',
      content: `
        <p><em>“Roots do not care if a bond defaulted in Geneva or if a court placed an injunction on Floor 24. They only ask for six hours of morning sun and four centimeters of drainage.”</em></p>
        <p>In 2021, the developer of the 38-story Meridian Core abruptly abandoned construction. When rainwater collected on the vast unglazed floor slabs, neighborhood residents began carrying up discarded citrus saplings in plastic buckets. Three years later, Floors 12 through 16 host four hundred productive lemon and fig trees.</p>
        <p><strong>Field Notes:</strong> Das interviews the informal collective of caretakers who engineered a gravity-fed rainwater irrigation system using unfinished electrical conduits and salvage pvc pipes.</p>
      `
    },
    'empty-pools': {
      title: 'A Language for Empty Pools — Hana Mori',
      content: `
        <p><em>“Without water, a pool ceases to be an invitation to buoyancy and becomes an unyielding architectural diagram of containment.”</em></p>
        <p>Hana Mori’s visual survey examines eight municipal public baths across Kanagawa and Shizuoka that were retired between 2018 and 2024. In the absence of water, the ceramic tile grids, depth warning stamps, and brass scum-gutters reveal an obsessive choreography designed to regulate the human body.</p>
        <p><strong>Field Notes:</strong> Includes 32 duotone photographic plates printed on uncoated Munken paper, highlighting tile erosion patterns, calcified mineral lines, and the quiet beauty of drained municipal chambers.</p>
      `
    }
  };

  previewButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const storyKey = this.getAttribute('data-preview');
      const data = STORY_EXCERPTS[storyKey];
      if (!data || !excerptDrawer) return;

      if (drawerTitle) drawerTitle.textContent = data.title;
      if (drawerContent) drawerContent.innerHTML = data.content;

      excerptDrawer.hidden = false;
      excerptDrawer.setAttribute('aria-hidden', 'false');
      excerptDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (btnCloseDrawer) btnCloseDrawer.focus();
    });
  });

  if (btnCloseDrawer) {
    btnCloseDrawer.addEventListener('click', () => {
      if (excerptDrawer) {
        excerptDrawer.hidden = true;
        excerptDrawer.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // =========================================================================
  // 6. ARCHIVE INSPECTION MODAL / DRAWER
  // =========================================================================
  const archiveInspectButtons = document.querySelectorAll('[data-issue]');

  const ARCHIVE_DATA = {
    '13': {
      title: 'Issue 13: After the Last Train (Summer 2026)',
      content: `
        <p><strong>Theme:</strong> Rail sidings, quiet terminals, and night marshaling yards.</p>
        <p><strong>Contents:</strong> Field essays on the maintenance mechanics of diesel shunting engines, photographic folios of decommissioned signal boxes in Hokkaido, and a study of wildflower colonization along disused railway embankments.</p>
        <p><strong>Colophon:</strong> 136 pages, munken print white 80gsm, 42 duotone plates. Warehouse stock: 64 physical copies remaining; digital edition included with Issue 14 subscription.</p>
      `
    },
    '12': {
      title: 'Issue 12: Borrowed Ground (Spring 2026)',
      content: `
        <p><strong>Theme:</strong> Allotments, informal boundary stones, and temporary land tenure.</p>
        <p><strong>Contents:</strong> Investigative reportage into urban agriculture cultivated beneath high-voltage pylon corridors; the legal archaeology of disputed common lands; photographic surveys of squatter gardens in outer London.</p>
        <p><strong>Colophon:</strong> 140 pages, 3 foldout garden surveys. Warehouse stock: 18 copies remaining.</p>
      `
    },
    '11': {
      title: 'Issue 11: The Weather Indoors (Winter 2025)',
      content: `
        <p><strong>Theme:</strong> Microclimates inside abandoned atriums, cooling towers, and sealed greenhouses.</p>
        <p><strong>Contents:</strong> Thermal imaging surveys of closed botanical pavilions; the architectural history of passive ventilation shafts; interviews with former power station operators on artificial fog phenomena.</p>
        <p><strong>Colophon:</strong> 128 pages. Print edition sold out; available as high-resolution digital facsimile.</p>
      `
    }
  };

  archiveInspectButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const issueKey = this.getAttribute('data-issue');
      const data = ARCHIVE_DATA[issueKey];
      if (!data || !excerptDrawer) return;

      if (drawerTitle) drawerTitle.textContent = data.title;
      if (drawerContent) drawerContent.innerHTML = data.content;

      excerptDrawer.hidden = false;
      excerptDrawer.setAttribute('aria-hidden', 'false');
      excerptDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (btnCloseDrawer) btnCloseDrawer.focus();
    });
  });

  // Global Escape key dismiss for drawers
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && excerptDrawer && !excerptDrawer.hidden) {
      excerptDrawer.hidden = true;
      excerptDrawer.setAttribute('aria-hidden', 'true');
    }
  });

  // =========================================================================
  // 7. SUBSCRIPTION ACTION FEEDBACK (Simulated client-side transaction)
  // =========================================================================
  const btnSubscribe = document.getElementById('btn-subscribe');
  const btnSingleIssue = document.getElementById('btn-single-issue');
  const subStatus = document.getElementById('sub-status');

  if (btnSubscribe && subStatus) {
    btnSubscribe.addEventListener('click', () => {
      subStatus.className = 'sub-confirmation-status is-active';
      subStatus.textContent = '✓ Issue 14 enrolled in subscription queue (¥2,400 / issue). Worldwide dispatch confirmed. Cancel anytime.';
      setTimeout(() => {
        subStatus.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    });
  }

  if (btnSingleIssue && subStatus) {
    btnSingleIssue.addEventListener('click', () => {
      subStatus.className = 'sub-confirmation-status is-active';
      subStatus.textContent = '✓ Issue 14 single edition selected (¥2,800). Packaging in unbleached mailer confirmed.';
      setTimeout(() => {
        subStatus.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    });
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================
  const initialTheme = getStorageItem(STORAGE_KEYS.THEME, 'paper');
  const initialView = getStorageItem(STORAGE_KEYS.VIEW, 'editorial');

  applyTheme(initialTheme);
  applyViewMode(initialView, false);
  applyTypeScale(currentScaleFactor);

})();
