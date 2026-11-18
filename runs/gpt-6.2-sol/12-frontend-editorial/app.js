const readingToggle = document.querySelector('.reading-toggle');
const readingPreference = 'margin-reading-mode';

function setReadingMode(enabled) {
  document.body.classList.toggle('reading-mode', enabled);
  readingToggle.setAttribute('aria-pressed', String(enabled));
}

try {
  setReadingMode(localStorage.getItem(readingPreference) === 'on');
} catch {
  // Some browsers restrict storage for local files.
}

readingToggle.addEventListener('click', () => {
  const enabled = readingToggle.getAttribute('aria-pressed') === 'false';
  setReadingMode(enabled);

  try {
    localStorage.setItem(readingPreference, enabled ? 'on' : 'off');
  } catch {
    // Reading mode can still be used for this visit.
  }
});

readingToggle.hidden = false;

const form = document.querySelector('.subscription-form');
const email = document.querySelector('#email');
const feedback = document.querySelector('#email-feedback');
const defaultFeedback = feedback.textContent;

function showFeedback(message, state) {
  feedback.textContent = message;
  feedback.dataset.state = state;
  if (state === 'error') {
    email.setAttribute('aria-invalid', 'true');
  } else {
    email.removeAttribute('aria-invalid');
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  if (email.validity.valueMissing) {
    showFeedback('Enter your email address.', 'error');
    email.focus();
    return;
  }

  if (!email.validity.valid) {
    showFeedback('Enter a valid email address, such as name@example.com.', 'error');
    email.focus();
    return;
  }

  showFeedback('Email address looks good. This preview hasn’t sent or saved it.', 'success');
});

email.addEventListener('input', () => {
  if (feedback.dataset.state) {
    showFeedback(defaultFeedback, '');
  }
});

form.noValidate = true;
form.hidden = false;
