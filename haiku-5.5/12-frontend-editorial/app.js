(() => {
  'use strict';

  const READING_KEY = 'margin-reading-mode';
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const root = document.documentElement;
  const readingToggle = document.getElementById('reading-toggle');
  const announcer = document.getElementById('announcer');
  const form = document.getElementById('subscribe-form');
  const email = document.getElementById('email');
  const errorText = document.getElementById('email-error');
  const successText = document.getElementById('email-success');

  let submitted = false;

  function readStoredMode() {
    try {
      return window.localStorage.getItem(READING_KEY) === 'on';
    } catch (error) {
      return false;
    }
  }

  function storeMode(on) {
    try {
      window.localStorage.setItem(READING_KEY, on ? 'on' : 'off');
    } catch (error) {
      // Storage is blocked; the choice then lasts only for this page view.
    }
  }

  function applyReadingMode(on) {
    root.classList.toggle('reading-mode', on);
    readingToggle.setAttribute('aria-pressed', String(on));
  }

  readingToggle.addEventListener('click', () => {
    const on = !root.classList.contains('reading-mode');
    applyReadingMode(on);
    storeMode(on);
    announcer.textContent = on ? 'Reading mode on.' : 'Reading mode off.';
  });

  applyReadingMode(readStoredMode());

  function validate(value) {
    const address = value.trim();

    if (address === '') {
      return 'Enter an email address to subscribe.';
    }

    if (address.length > 254 || !EMAIL_PATTERN.test(address)) {
      return 'Check the address. It should look like name@example.com.';
    }

    return '';
  }

  function showError(message) {
    email.setAttribute('aria-invalid', 'true');
    errorText.textContent = message;
    errorText.hidden = false;
    successText.hidden = true;
  }

  function clearError() {
    email.removeAttribute('aria-invalid');
    errorText.textContent = '';
    errorText.hidden = true;
  }

  function check() {
    const message = validate(email.value);

    if (message) {
      showError(message);
      return false;
    }

    clearError();
    return true;
  }

  email.addEventListener('blur', () => {
    if (submitted || email.value.trim() !== '') {
      check();
    }
  });

  email.addEventListener('input', () => {
    successText.hidden = true;

    if (submitted || !errorText.hidden) {
      check();
    }
  });

  form.addEventListener('submit', (event) => {
    // Nothing is sent: the form is a preview, so the default submission is cancelled.
    event.preventDefault();
    submitted = true;

    if (!check()) {
      email.focus();
      return;
    }

    successText.textContent = 'Thank you. That address looks right. This preview does not send email, so nothing has been submitted.';
    successText.hidden = false;
  });
})();
