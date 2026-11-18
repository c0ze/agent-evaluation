const root = document.documentElement;
const modeButton = document.querySelector('#reading-mode');
const modeKey = 'margin-reading-mode';

function setReadingMode(enabled) {
  root.dataset.reading = enabled ? 'on' : 'off';
  modeButton.setAttribute('aria-pressed', String(enabled));
  document.querySelector('meta[name="theme-color"]').content = enabled ? '#21241f' : '#f7f4eb';
}

try {
  setReadingMode(localStorage.getItem(modeKey) === 'on');
} catch {
  setReadingMode(false);
}

modeButton.addEventListener('click', () => {
  setReadingMode(root.dataset.reading !== 'on');
  try {
    localStorage.setItem(modeKey, root.dataset.reading);
  } catch {
    // File previews and private sessions can restrict preference storage.
  }
});

const form = document.querySelector('#subscription-form');
const email = document.querySelector('#email');
const feedback = document.querySelector('#email-feedback');
const formHint = feedback.textContent;

function showFeedback(state, message) {
  email.setAttribute('aria-invalid', String(state === 'error'));
  feedback.dataset.state = state;
  feedback.textContent = message;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  email.value = email.value.trim();
  if (!email.validity.valid) {
    const message = email.validity.valueMissing
      ? 'Enter your email address.'
      : 'Enter a valid email address, such as reader@example.com.';
    showFeedback('error', message);
    email.focus();
    return;
  }
  showFeedback('success', 'Email accepted. Thanks for trying the subscription preview.');
});

email.addEventListener('input', () => {
  if (feedback.dataset.state && feedback.dataset.state !== 'idle') {
    showFeedback('idle', formHint);
  }
});
