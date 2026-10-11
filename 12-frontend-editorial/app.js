(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var STORAGE_KEY = "margin-reading-mode";

  function readStored() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function writeStored(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (err) {
      return;
    }
  }

  var toggle = document.querySelector("[data-reading-toggle]");
  var toggleState = document.querySelector("[data-reading-state]");

  function setReadingMode(on) {
    root.setAttribute("data-reading", on ? "on" : "off");
    if (toggle) {
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (toggleState) {
      toggleState.textContent = on ? "On" : "Off";
    }
    writeStored(on ? "on" : "off");
  }

  setReadingMode(readStored() === "on");

  if (toggle) {
    toggle.addEventListener("click", function () {
      setReadingMode(root.getAttribute("data-reading") !== "on");
    });
  }

  var form = document.querySelector("[data-subscribe]");
  var email = document.getElementById("email");
  var feedback = document.querySelector("[data-feedback]");

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var MESSAGES = {
    empty: "Enter an email address so we know where to send the first issue.",
    invalid: "That address is not quite right — check for a missing @ or a typo.",
    success: "Thank you. That address works; confirmation is on its way."
  };

  function showFeedback(state, message) {
    if (!feedback) {
      return;
    }
    feedback.textContent = message;
    feedback.setAttribute("data-state", state);
  }

  function clearFeedback() {
    if (!feedback) {
      return;
    }
    feedback.textContent = "";
    feedback.removeAttribute("data-state");
    if (email) {
      email.setAttribute("aria-invalid", "false");
    }
  }

  function check(force) {
    var value = email.value.trim();

    if (value === "") {
      if (force) {
        showFeedback("error", MESSAGES.empty);
        email.setAttribute("aria-invalid", "true");
      } else {
        clearFeedback();
      }
      return false;
    }

    if (!EMAIL_PATTERN.test(value)) {
      if (force || feedback.getAttribute("data-state") === "error") {
        showFeedback("error", MESSAGES.invalid);
        email.setAttribute("aria-invalid", "true");
      }
      return false;
    }

    if (force || feedback.getAttribute("data-state")) {
      showFeedback("success", MESSAGES.success);
      email.setAttribute("aria-invalid", "false");
    }
    return true;
  }

  if (form && email && feedback) {
    email.addEventListener("blur", function () {
      check(false);
    });

    email.addEventListener("input", function () {
      if (feedback.getAttribute("data-state")) {
        check(false);
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var valid = check(true);
      if (!valid) {
        email.focus();
      }
    });
  }

  var revealables = document.querySelectorAll(".story, .archive__item, .form");

  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    Array.prototype.forEach.call(revealables, function (item) {
      item.classList.add("will-reveal");
      observer.observe(item);
    });
  }

  reduceMotion.addEventListener &&
    reduceMotion.addEventListener("change", function (event) {
      if (event.matches) {
        Array.prototype.forEach.call(revealables, function (item) {
          item.classList.remove("will-reveal");
          item.classList.add("is-revealed");
        });
      }
    });
})();
