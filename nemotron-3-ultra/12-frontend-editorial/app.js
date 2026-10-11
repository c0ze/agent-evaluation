(function () {
    'use strict';

    const STORAGE_KEY = 'margin-reading-mode';
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const readingModeToggle = document.getElementById('readingModeToggle');
    const subscriptionForm = document.getElementById('subscriptionForm');
    const emailInput = document.getElementById('email');
    const emailFeedback = document.getElementById('email-feedback');

    function initReadingMode() {
        const savedMode = localStorage.getItem(STORAGE_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldEnable = savedMode !== null ? savedMode === 'true' : prefersDark;

        if (shouldEnable) {
            enableReadingMode();
        }

        if (readingModeToggle) {
            readingModeToggle.addEventListener('click', toggleReadingMode);
        }

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (localStorage.getItem(STORAGE_KEY) === null) {
                if (e.matches) {
                    enableReadingMode();
                } else {
                    disableReadingMode();
                }
            }
        });
    }

    function enableReadingMode() {
        document.body.classList.add('reading-mode');
        if (readingModeToggle) {
            readingModeToggle.setAttribute('aria-pressed', 'true');
        }
        localStorage.setItem(STORAGE_KEY, 'true');
    }

    function disableReadingMode() {
        document.body.classList.remove('reading-mode');
        if (readingModeToggle) {
            readingModeToggle.setAttribute('aria-pressed', 'false');
        }
        localStorage.setItem(STORAGE_KEY, 'false');
    }

    function toggleReadingMode() {
        const isEnabled = document.body.classList.contains('reading-mode');
        if (isEnabled) {
            disableReadingMode();
        } else {
            enableReadingMode();
        }
    }

    function validateEmail(email) {
        return EMAIL_REGEX.test(email.trim());
    }

    function showFeedback(message, type) {
        emailFeedback.textContent = message;
        emailFeedback.className = 'form-feedback ' + type;
    }

    function clearFeedback() {
        emailFeedback.textContent = '';
        emailFeedback.className = 'form-feedback';
    }

    function handleEmailInput() {
        const email = emailInput.value.trim();

        if (email === '') {
            clearFeedback();
            emailInput.setAttribute('aria-invalid', 'false');
            return;
        }

        if (validateEmail(email)) {
            emailInput.setAttribute('aria-invalid', 'false');
            showFeedback('Valid email address', 'success');
        } else {
            emailInput.setAttribute('aria-invalid', 'true');
            showFeedback('Please enter a valid email address', 'error');
        }
    }

    function handleFormSubmit(event) {
        event.preventDefault();

        const email = emailInput.value.trim();

        if (!validateEmail(email)) {
            emailInput.setAttribute('aria-invalid', 'true');
            showFeedback('Please enter a valid email address', 'error');
            emailInput.focus();
            return;
        }

        emailInput.setAttribute('aria-invalid', 'false');
        showFeedback('Thanks for subscribing! (Demo — no actual submission)', 'success');
        emailInput.value = '';

        setTimeout(() => {
            clearFeedback();
        }, 5000);
    }

    function initEmailValidation() {
        if (!emailInput || !subscriptionForm) return;

        emailInput.addEventListener('input', handleEmailInput);
        emailInput.addEventListener('blur', handleEmailInput);
        subscriptionForm.addEventListener('submit', handleFormSubmit);
    }

    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;

                const target = document.querySelector(targetId);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    target.focus({ preventScroll: true });
                }
            });
        });
    }

    function initFocusVisible() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-nav');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-nav');
        });
    }

    function init() {
        initReadingMode();
        initEmailValidation();
        initSmoothScroll();
        initFocusVisible();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();