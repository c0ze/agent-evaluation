const readingToggle = document.querySelector("#reading-toggle");
const emailAddress = document.querySelector("#email-address");
const emailCheckButton = document.querySelector("#email-check-button");
const emailFeedback = document.querySelector("#email-feedback");

readingToggle.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("is-reading-mode");
  readingToggle.setAttribute("aria-pressed", String(enabled));
});

function setEmailFeedback(message, state) {
  emailFeedback.textContent = message;
  emailFeedback.dataset.state = state;
}

function checkEmailAddress() {
  const value = emailAddress.value.trim();
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

  if (!value) {
    emailAddress.setAttribute("aria-invalid", "true");
    setEmailFeedback("Please enter your email address.", "error");
    emailAddress.focus();
    return;
  }

  if (!emailAddress.validity.valid || !looksLikeEmail) {
    emailAddress.setAttribute("aria-invalid", "true");
    setEmailFeedback("Enter a valid address, such as name@example.jp.", "error");
    emailAddress.focus();
    return;
  }

  emailAddress.removeAttribute("aria-invalid");
  setEmailFeedback("Address checked. No subscription was started, and nothing was sent.", "success");
}

emailCheckButton.addEventListener("click", checkEmailAddress);

emailAddress.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    checkEmailAddress();
  }
});

emailAddress.addEventListener("input", () => {
  emailAddress.removeAttribute("aria-invalid");
  emailFeedback.textContent = "";
  delete emailFeedback.dataset.state;
});
