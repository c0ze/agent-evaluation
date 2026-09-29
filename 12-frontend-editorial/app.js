(function () {
  var root = document.documentElement;
  var storageKey = "margin-reading-mode";

  function storedReading() {
    try {
      return localStorage.getItem(storageKey) === "on";
    } catch (err) {
      return false;
    }
  }

  if (storedReading()) root.classList.add("is-reading");

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function remember(on) {
    try {
      localStorage.setItem(storageKey, on ? "on" : "off");
    } catch (err) {
      /* Private or file contexts may block storage; the control still works. */
    }
  }

  function emailProblem(value) {
    var v = value.trim();
    var incomplete = "That address looks incomplete. Use the form name@domain.com.";
    var at;
    var local;
    var domain;
    var labels;
    var i;
    var label;
    var localOk = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
    var labelOk = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

    if (!v) return "Enter an email address to subscribe.";
    if (v.length > 254 || /\s/.test(v)) return incomplete;

    at = v.indexOf("@");
    if (at < 1 || at !== v.lastIndexOf("@")) return incomplete;

    local = v.slice(0, at);
    domain = v.slice(at + 1);
    if (local.length > 64 || !localOk.test(local)) return incomplete;
    if (local.charAt(0) === "." || local.charAt(local.length - 1) === "." || local.indexOf("..") !== -1) {
      return incomplete;
    }

    labels = domain.split(".");
    if (labels.length < 2) return incomplete;
    for (i = 0; i < labels.length; i += 1) {
      label = labels[i];
      if (!labelOk.test(label)) return incomplete;
    }
    if (labels[labels.length - 1].length < 2) return incomplete;

    return "";
  }

  ready(function () {
    var toggle = document.querySelector(".reading-toggle");
    var status = document.getElementById("reading-status");
    var form = document.getElementById("subscribe-form");
    var email = document.getElementById("email");
    var feedback = document.getElementById("email-feedback");

    function setReading(on, announce) {
      root.classList.toggle("is-reading", on);
      if (toggle) {
        toggle.setAttribute("aria-pressed", on ? "true" : "false");
        toggle.textContent = on ? "Exit reading" : "Reading mode";
      }
      remember(on);
      if (announce && status) {
        status.textContent = "";
        window.requestAnimationFrame(function () {
          status.textContent = on ? "Reading mode on." : "Reading mode off.";
        });
      }
    }

    function setFeedback(message, state) {
      feedback.dataset.state = state || "";
      if (feedback.textContent === message) {
        feedback.textContent = "";
        window.requestAnimationFrame(function () {
          feedback.textContent = message;
        });
        return;
      }
      feedback.textContent = message;
    }

    function clearFeedback() {
      feedback.dataset.state = "";
      feedback.textContent = "";
    }

    setReading(root.classList.contains("is-reading"), false);

    if (toggle) {
      toggle.addEventListener("click", function () {
        setReading(!root.classList.contains("is-reading"), true);
      });
    }

    if (!form || !email || !feedback) return;

    email.addEventListener("input", function () {
      var problem = emailProblem(email.value);
      if (feedback.dataset.state === "success") {
        clearFeedback();
        email.removeAttribute("aria-invalid");
        return;
      }
      if (feedback.dataset.state === "error" && !problem) {
        email.removeAttribute("aria-invalid");
        clearFeedback();
      }
    });

    email.addEventListener("blur", function () {
      var problem = emailProblem(email.value);
      if (!email.value.trim() || !problem) return;
      email.setAttribute("aria-invalid", "true");
      setFeedback(problem, "error");
    });

    form.addEventListener("submit", function (event) {
      var problem;
      var value;
      event.preventDefault();
      value = email.value.trim();
      problem = emailProblem(value);
      if (problem) {
        email.setAttribute("aria-invalid", "true");
        setFeedback(problem, "error");
        email.focus();
        return;
      }
      email.value = value;
      email.setAttribute("aria-invalid", "false");
      setFeedback("Confirmed for " + value + ". Nothing was sent from this page.", "success");
    });
  });
})();
