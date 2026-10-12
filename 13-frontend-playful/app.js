/* Moss — a gentle plant-care companion.
   Plain HTML/CSS/JS only. Data comes from local PLANTS.json,
   with an embedded copy as a fallback so the page also works from file:// */

(function () {
  "use strict";

  var FALLBACK_DATA = {
    plants: [
      { id: "fern", name: "Frida", species: "Boston fern", location: "Bathroom", task: "Water", due: "2 days overdue", urgency: 4, light: "Low, indirect", history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"] },
      { id: "pothos", name: "Orbit", species: "Golden pothos", location: "Bookshelf", task: "Rotate", due: "Today", urgency: 2, light: "Medium, indirect", history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"] },
      { id: "cactus", name: "Dot", species: "Bunny ears cactus", location: "South window", task: "Check soil", due: "Today", urgency: 1, light: "Bright, direct", history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"] },
      { id: "calathea", name: "Drama", species: "Calathea orbifolia", location: "Bedroom", task: "Mist", due: "Tomorrow", urgency: 0, light: "Medium, filtered", history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"] }
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };

  var DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var TOAST_MS = 6000;

  /* ---------- state ---------- */
  var plants = [];
  var week = FALLBACK_DATA.week.slice();
  var originalDue = {};   // id -> { due, urgency } for snooze undo
  var done = {};          // id -> true once "watered" (cared for) today
  var snoozed = {};       // id -> true
  var expandedId = null;
  var toastTimer = null;

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  /* ---------- inline SVG illustration + icon set ---------- */
  var ART = {
    fern:
      '<svg viewBox="0 0 72 72" role="img" aria-label="Illustration of a fern in a terracotta pot">' +
      '<path d="M24 46 h24 l-3.5 18 h-17 Z" fill="#c4623d"/>' +
      '<rect x="21" y="43" width="30" height="6" rx="3" fill="#a94f2f"/>' +
      '<g fill="none" stroke-linecap="round">' +
      '<path d="M36 44 C 33 32 26 24 16 20" stroke="#55704f" stroke-width="3"/>' +
      '<path d="M36 44 C 36 30 32 20 26 12" stroke="#7a9b6d" stroke-width="3"/>' +
      '<path d="M36 44 C 39 31 46 23 56 20" stroke="#55704f" stroke-width="3"/>' +
      '<path d="M36 44 C 37 32 42 22 48 14" stroke="#7a9b6d" stroke-width="3"/>' +
      '<path d="M36 44 C 35 34 36 24 36 14" stroke="#3e5539" stroke-width="3"/>' +
      '</g>' +
      '<g fill="#7a9b6d">' +
      '<circle cx="16" cy="20" r="2.6"/><circle cx="26" cy="12" r="2.4"/>' +
      '<circle cx="56" cy="20" r="2.6"/><circle cx="48" cy="14" r="2.4"/>' +
      '<circle cx="36" cy="13" r="2.6"/>' +
      '</g></svg>',
    pothos:
      '<svg viewBox="0 0 72 72" role="img" aria-label="Illustration of a trailing pothos in a pot">' +
      '<path d="M24 40 h24 l-3.5 20 h-17 Z" fill="#e3a83b"/>' +
      '<rect x="21" y="37" width="30" height="6" rx="3" fill="#c98a25"/>' +
      '<path d="M36 38 C 30 30 24 26 18 24 M36 38 C 42 30 48 26 54 25 M36 38 C 36 28 36 22 36 15" fill="none" stroke="#55704f" stroke-width="2.6" stroke-linecap="round"/>' +
      '<g fill="#7a9b6d">' +
      '<ellipse cx="17" cy="23" rx="5" ry="4" transform="rotate(-30 17 23)"/>' +
      '<ellipse cx="23" cy="30" rx="4.6" ry="3.8" transform="rotate(40 23 30)"/>' +
      '<ellipse cx="55" cy="24" rx="5" ry="4" transform="rotate(28 55 24)"/>' +
      '<ellipse cx="48" cy="32" rx="4.6" ry="3.8" transform="rotate(-42 48 32)"/>' +
      '<ellipse cx="36" cy="13" rx="5" ry="4"/>' +
      '<ellipse cx="31" cy="20" rx="4" ry="3.4" transform="rotate(-24 31 20)"/>' +
      '<ellipse cx="42" cy="19" rx="4" ry="3.4" transform="rotate(24 42 19)"/>' +
      '</g></svg>',
    cactus:
      '<svg viewBox="0 0 72 72" role="img" aria-label="Illustration of a bunny ears cactus in a striped pot">' +
      '<path d="M25 44 h22 l-3 18 h-16 Z" fill="#f6efe3" stroke="#c4623d" stroke-width="2"/>' +
      '<path d="M26.5 50 h19 M28 56 h16" stroke="#c4623d" stroke-width="2" stroke-linecap="round"/>' +
      '<ellipse cx="36" cy="38" rx="9" ry="8" fill="#7a9b6d"/>' +
      '<ellipse cx="29" cy="24" rx="6" ry="12" fill="#7a9b6d" transform="rotate(-12 29 24)"/>' +
      '<ellipse cx="43" cy="24" rx="6" ry="12" fill="#7a9b6d" transform="rotate(12 43 24)"/>' +
      '<ellipse cx="29" cy="24" rx="2.6" ry="7" fill="#a9c39a" transform="rotate(-12 29 24)"/>' +
      '<ellipse cx="43" cy="24" rx="2.6" ry="7" fill="#a9c39a" transform="rotate(12 43 24)"/>' +
      '<g fill="#f6efe3"><circle cx="27" cy="16" r="1"/><circle cx="31" cy="20" r="1"/><circle cx="41" cy="17" r="1"/><circle cx="45" cy="22" r="1"/><circle cx="34" cy="36" r="1"/><circle cx="39" cy="40" r="1"/></g>' +
      '</svg>',
    calathea:
      '<svg viewBox="0 0 72 72" role="img" aria-label="Illustration of a striped calathea in a clay pot">' +
      '<path d="M24 46 h24 l-3.5 18 h-17 Z" fill="#c4623d"/>' +
      '<rect x="21" y="43" width="30" height="6" rx="3" fill="#a94f2f"/>' +
      '<g fill="none" stroke="#3e5539" stroke-width="2.2" stroke-linecap="round">' +
      '<path d="M36 44 C 34 34 28 28 20 24"/>' +
      '<path d="M36 44 C 38 33 44 27 52 23"/>' +
      '<path d="M36 44 C 36 34 36 26 36 18"/>' +
      '</g>' +
      '<g>' +
      '<ellipse cx="19" cy="21" rx="6" ry="9" fill="#55704f" transform="rotate(-28 19 21)"/>' +
      '<ellipse cx="53" cy="20" rx="6" ry="9" fill="#55704f" transform="rotate(28 53 20)"/>' +
      '<ellipse cx="36" cy="14" rx="6.4" ry="9.4" fill="#7a9b6d"/>' +
      '<path d="M17 15 L21 27 M51 14 L47 26 M36 6 L36 22" stroke="#dfe7d2" stroke-width="1.6" stroke-linecap="round"/>' +
      '</g></svg>'
  };

  var ICON = {
    sun: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="4" fill="#e3a83b"/><g stroke="#e3a83b" stroke-width="1.8" stroke-linecap="round"><path d="M10 1.5v2.4M10 16.1v2.4M1.5 10h2.4M16.1 10h2.4M4 4l1.7 1.7M14.3 14.3L16 16M16 4l-1.7 1.7M5.7 14.3L4 16"/></g></svg>',
    drop: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 2 C 13 6.5 15.5 9.4 15.5 12.2 A 5.5 5.5 0 0 1 4.5 12.2 C 4.5 9.4 7 6.5 10 2 Z" fill="#55704f"/></svg>',
    pin: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 18 C 10 18 4 12.6 4 8.4 A 6 6 0 0 1 16 8.4 C 16 12.6 10 18 10 18 Z" fill="none" stroke="#c4623d" stroke-width="2"/><circle cx="10" cy="8.4" r="2" fill="#c4623d"/></svg>',
    check: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 10.5 L8.2 14.5 L16 5.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevron: '<svg class="chev" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 7.5 L10 12.5 L15 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    moon: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M15.5 12.5 A 7 7 0 0 1 7.5 4.5 A 7 7 0 1 0 15.5 12.5 Z" fill="currentColor"/></svg>'
  };

  /* ---------- header date ---------- */
  function renderDate() {
    var d = new Date();
    var text = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    $("header-date").textContent = text;
  }

  /* ---------- queue ---------- */
  function dueClass(p) {
    if (done[p.id]) return "due--done";
    if (snoozed[p.id]) return "due--soon";
    if (p.urgency >= 3) return "due--overdue";
    if (p.urgency >= 1) return "due--today";
    return "due--soon";
  }
  function dueLabel(p) {
    if (done[p.id]) return "Done";
    if (snoozed[p.id]) return "Snoozed · tomorrow";
    return p.due;
  }

  function renderQueue() {
    var list = $("plant-list");
    list.innerHTML = "";

    var sorted = plants.slice().sort(function (a, b) {
      var da = done[a.id] ? 1 : 0, db = done[b.id] ? 1 : 0;
      if (da !== db) return da - db;           // cared-for plants sink to the bottom
      return b.urgency - a.urgency;            // overdue first
    });

    sorted.forEach(function (p) {
      var isDone = !!done[p.id];
      var li = el("li", "plant" + (p.urgency >= 3 && !isDone ? " is-overdue" : "") + (isDone ? " is-done" : ""));
      li.dataset.id = p.id;

      var head = el("button", "plant-head");
      head.type = "button";
      head.setAttribute("aria-expanded", expandedId === p.id ? "true" : "false");
      head.setAttribute("aria-controls", "detail-" + p.id);
      head.innerHTML =
        '<span class="plant-art" aria-hidden="true">' + ART[p.id] + "</span>" +
        '<span class="plant-info">' +
          '<span class="plant-name">' + esc(p.name) +
            (isDone ? ' <span class="done-badge">' + ICON.check + " cared for</span>" : "") +
            '<span class="plant-species">' + esc(p.species) + "</span></span>" +
          '<span class="plant-meta">' + esc(p.location) + " · " + esc(p.task) + "</span>" +
        "</span>" +
        '<span class="due ' + dueClass(p) + '">' + esc(dueLabel(p)) + "</span>" +
        ICON.chevron;
      head.addEventListener("click", function () {
        expandedId = expandedId === p.id ? null : p.id;
        renderQueue();
        if (expandedId === p.id) {
          var panel = document.getElementById("detail-" + p.id);
          if (panel) {
            var firstBtn = panel.querySelector("button");
            if (firstBtn) firstBtn.focus();
          }
        }
      });
      li.appendChild(head);

      var detail = el("div", "plant-detail");
      detail.id = "detail-" + p.id;
      detail.hidden = expandedId !== p.id;

      var facts = el("div", "detail-grid");
      facts.innerHTML =
        '<div class="detail-fact">' + ICON.sun + "<span><strong>Light</strong> · " + esc(p.light) + "</span></div>" +
        '<div class="detail-fact">' + ICON.drop + "<span><strong>Next</strong> · " + esc(p.task) + " · " + esc(dueLabel(p)) + "</span></div>" +
        '<div class="detail-fact">' + ICON.pin + "<span><strong>Spot</strong> · " + esc(p.location) + "</span></div>";
      detail.appendChild(facts);

      var history = el("div", "history");
      var hTitle = el("h3", null, "Recent notes");
      var hList = el("ul");
      p.history.forEach(function (note) {
        hList.appendChild(el("li", null, esc(note)));
      });
      history.appendChild(hTitle);
      history.appendChild(hList);
      detail.appendChild(history);

      var actions = el("div", "detail-actions");
      var waterBtn = el("button", "btn btn-primary", ICON.check + (isDone ? "Cared for" : "Mark " + p.task.toLowerCase()));
      waterBtn.type = "button";
      waterBtn.disabled = isDone;
      waterBtn.addEventListener("click", function () { water(p); });
      var snoozeBtn = el("button", "btn btn-ghost", ICON.moon + "Snooze to tomorrow");
      snoozeBtn.type = "button";
      snoozeBtn.disabled = isDone || !!snoozed[p.id];
      snoozeBtn.addEventListener("click", function () { snooze(p); });
      actions.appendChild(waterBtn);
      actions.appendChild(snoozeBtn);
      detail.appendChild(actions);

      li.appendChild(detail);
      list.appendChild(li);
    });

    renderCount();
    renderDoneState();
  }

  function renderCount() {
    var remaining = plants.filter(function (p) { return !done[p.id]; }).length;
    var overdue = plants.filter(function (p) { return !done[p.id] && p.urgency >= 3; }).length;
    var msg;
    if (remaining === 0) msg = "Queue clear";
    else if (overdue > 0) msg = overdue + " overdue · " + remaining + " to go";
    else msg = remaining + " plant" + (remaining === 1 ? "" : "s") + " to tend";
    $("queue-count").textContent = msg;
  }

  /* ---------- actions ---------- */
  function water(p) {
    if (done[p.id]) return;
    done[p.id] = true;
    showToast(p.name + " says thank you — marked as cared for.", "Undo", function () {
      delete done[p.id];
      renderQueue();
      renderMood();
    });
    renderQueue();
    renderMood();
  }

  function snooze(p) {
    if (snoozed[p.id]) return;
    if (!originalDue[p.id]) originalDue[p.id] = { due: p.due, urgency: p.urgency };
    snoozed[p.id] = true;
    p.due = "Tomorrow";
    p.urgency = 0;
    showToast(p.name + " is snoozed until tomorrow.", "Undo", function () {
      var orig = originalDue[p.id];
      if (orig) { p.due = orig.due; p.urgency = orig.urgency; }
      delete snoozed[p.id];
      renderQueue();
    });
    renderQueue();
  }

  /* ---------- all-done state ---------- */
  function renderDoneState() {
    var allDone = plants.length > 0 && plants.every(function (p) { return done[p.id]; });
    $("all-done").hidden = !allDone;
  }

  $("reset-day").addEventListener("click", function () {
    Object.keys(done).forEach(function (k) { delete done[k]; });
    plants.forEach(function (p) {
      var orig = originalDue[p.id];
      if (orig) { p.due = orig.due; p.urgency = orig.urgency; }
      delete snoozed[p.id];
    });
    expandedId = null;
    renderQueue();
    renderMood();
    showToast("A fresh day begins. The plants are waiting.", null, null);
  });

  /* ---------- weekly rhythm ---------- */
  function renderRhythm() {
    var wrap = $("rhythm-bars");
    wrap.innerHTML = "";
    var max = Math.max.apply(null, week.concat([1]));
    var todayIdx = (new Date().getDay() + 6) % 7; // Monday-first
    week.forEach(function (v, i) {
      var day = el("div", "rhythm-day" + (i === todayIdx ? " is-today" : ""));
      var bar = el("div", "rhythm-bar" + (i === todayIdx ? " is-today" : ""));
      bar.style.height = Math.round((v / max) * 100) + "%";
      bar.title = DAY_LABELS[i] + ": " + v + " task" + (v === 1 ? "" : "s");
      var label = el("span", "rhythm-label", DAY_LABELS[i]);
      day.appendChild(bar);
      day.appendChild(label);
      wrap.appendChild(day);
    });
  }

  /* ---------- moss mood ---------- */
  function renderMood() {
    var remaining = plants.filter(function (p) { return !done[p.id]; }).length;
    var card = document.querySelector(".mood-card");
    var label = $("mood-label");
    card.classList.toggle("is-happy", remaining === 0 && plants.length > 0);
    if (remaining === 0 && plants.length > 0) {
      label.textContent = "Thriving! A little flower for a job well done.";
    } else if (remaining <= 1) {
      label.textContent = "Almost there — one little task left.";
    } else {
      label.textContent = "Doing okay — one thing at a time.";
    }
  }

  /* ---------- toast ---------- */
  function showToast(message, undoLabel, undoFn) {
    var toast = $("toast");
    var undoBtn = $("toast-undo");
    $("toast-msg").textContent = message;
    if (undoLabel && undoFn) {
      undoBtn.hidden = false;
      undoBtn.textContent = undoLabel;
      undoBtn.onclick = function () {
        hideToast();
        undoFn();
      };
    } else {
      undoBtn.hidden = true;
      undoBtn.onclick = null;
    }
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_MS);
  }
  function hideToast() {
    $("toast").hidden = true;
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  }

  /* ---------- keyboard: roving is unnecessary (native buttons),
     but Escape closes an open panel and refocuses its header ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !expandedId) return;
    var id = expandedId;
    expandedId = null;
    renderQueue();
    var head = document.querySelector('.plant[data-id="' + id + '"] .plant-head');
    if (head) head.focus();
  });

  /* ---------- boot ---------- */
  function init(data) {
    plants = data.plants.slice();
    if (Array.isArray(data.week)) week = data.week.slice();
    renderDate();
    renderRhythm();
    renderQueue();
    renderMood();
  }

  renderDate();
  fetch("PLANTS.json", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("bad status")); })
    .then(init)
    .catch(function () { init(FALLBACK_DATA); });
})();
