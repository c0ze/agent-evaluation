/* ============================================================
   MOSS — a gentle plant-care companion
   Vanilla JS. No network, no storage of anything sensitive.
   Data is inlined from PLANTS.json so the page works from file://.
   ============================================================ */
(function () {
  "use strict";

  var DATA = {
    plants: [
      { id: "fern", name: "Frida", species: "Boston fern", location: "Bathroom", task: "Water", due: "2 days overdue", urgency: 4, light: "Low, indirect", history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"] },
      { id: "pothos", name: "Orbit", species: "Golden pothos", location: "Bookshelf", task: "Rotate", due: "Today", urgency: 2, light: "Medium, indirect", history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"] },
      { id: "cactus", name: "Dot", species: "Bunny ears cactus", location: "South window", task: "Check soil", due: "Today", urgency: 1, light: "Bright, direct", history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"] },
      { id: "calathea", name: "Drama", species: "Calathea orbifolia", location: "Bedroom", task: "Mist", due: "Tomorrow", urgency: 0, light: "Medium, filtered", history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"] }
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };

  var STORE_KEY = "moss.day.v1";
  var DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var TODAY_INDEX = 3; // "Thu" — the day of this gentle fiction

  /* Each plant's mutable day-state: status + care points. */
  function freshState() {
    return {
      plants: {
        fern:     { status: "pending", points: 4 },
        pothos:   { status: "pending", points: 2 },
        cactus:   { status: "pending", points: 1 },
        calathea: { status: "pending", points: 0 }
      },
      log: [],
      doneCount: 0
    };
  }

  var state = load();
  var lastAction = null;   // single-step undo
  var toastTimer = null;
  var openDetailId = null;

  /* ---------- persistence (best-effort; file:// safe) ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.plants && s.log) return s;
      }
    } catch (e) { /* private mode / file:// — just stay in memory */ }
    return freshState();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function dueRank(due) {
    if (due.indexOf("overdue") !== -1) return 3;
    if (due.indexOf("Today") !== -1) return 2;
    if (due.indexOf("Tomorrow") !== -1) return 1;
    return 0;
  }
  function isOverdue(p) { return p.due.indexOf("overdue") !== -1 && state.plants[p.id].status === "pending"; }
  function nowLabel() {
    return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function doneVerb(task) {
    return ({ "Water": "Watered", "Mist": "Misted", "Rotate": "Rotated", "Check soil": "Checked" })[task] || "Done";
  }
  function doneLabel(task) {
    return task === "Water" ? "Watered" : "Done";
  }

  /* ---------- little inline plant illustrations ---------- */
  function plantSVG(id) {
    switch (id) {
      case "fern":
        return '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 42V14" stroke="#3f6b46" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M24 20C16 18 10 14 9 8c8 1 14 5 15 12zM24 26c8-2 14-6 15-12-8 1-14 5-15 12zM24 32c-7-2-12-5-13-11 7 1 12 4 13 11zM24 36c6-1 11-4 12-9-6 1-11 3-12 9z" fill="#5f9260"/><circle cx="24" cy="12" r="2.5" fill="#e8a04b"/></svg>';
      case "pothos":
        return '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M14 8C14 22 20 32 34 40" stroke="#3f6b46" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M16 12c-7 0-11 4-11 10 7 0 11-4 11-10zM22 24c8-1 13 3 13 10-8 1-13-3-13-10zM29 34c-1 7 2 11 8 12 1-7-2-11-8-12z" fill="#7aa863"/><path d="M16 12c-7 0-11 4-11 10 7 0 11-4 11-10z" fill="#a9c66e"/></svg>';
      case "cactus":
        return '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M19 42V18a5 5 0 0 1 10 0v24" fill="#6aa06a" stroke="#3f6b46" stroke-width="2"/><path d="M19 26c-6 0-8-4-8-9 0-4 3-6 6-6 0 5 1 10 2 15z" fill="#7fb277" stroke="#3f6b46" stroke-width="2"/><path d="M29 30c6 0 8-4 8-9 0-4-3-6-6-6 0 5-1 10-2 15z" fill="#5f9260" stroke="#3f6b46" stroke-width="2"/><path d="M16 42h16" stroke="#b96a38" stroke-width="3" stroke-linecap="round"/><circle cx="22" cy="16" r="1" fill="#fff"/><circle cx="27" cy="20" r="1" fill="#fff"/></svg>';
      case "calathea":
        return '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 42V18" stroke="#3f6b46" stroke-width="2.5" stroke-linecap="round" fill="none"/><ellipse cx="24" cy="16" rx="15" ry="9" transform="rotate(-18 24 16)" fill="#7f9c86"/><ellipse cx="24" cy="16" rx="15" ry="9" transform="rotate(-18 24 16)" fill="none" stroke="#3f6b46" stroke-width="1.5"/><path d="M12 20l24-8" stroke="#dfe9d2" stroke-width="1" stroke-dasharray="2 2"/><path d="M24 42c-6-4-9-9-9-14M24 42c6-4 9-9 9-14" stroke="#3f6b46" stroke-width="1.5" fill="none"/></svg>';
    }
    return "";
  }

  var ICON_WATER = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 2C7 6 4 9 4 12a6 6 0 0 0 12 0c0-3-3-6-6-10z" fill="currentColor"/><path d="M7 12a3 3 0 0 0 3 3" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/></svg>';
  var ICON_SNOOZE = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 5v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHEVRON = '<svg class="chev" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false"><path d="M4 7l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ============================================================
     RENDER
     ============================================================ */
  function render() {
    renderHero();
    renderQueue();
    renderRhythm();
    renderLog();
    renderAllDone();
  }

  function pendingPlants() {
    return DATA.plants.filter(function (p) { return state.plants[p.id].status === "pending"; });
  }
  function completedPlants() {
    return DATA.plants.filter(function (p) { return state.plants[p.id].status === "done"; });
  }

  function renderHero() {
    var pending = pendingPlants();
    var overdue = pending.filter(function (p) { return dueRank(p.due) === 3; });
    var today = pending.filter(function (p) { return dueRank(p.due) === 2; });
    var remaining = pending.length;
    var done = DATA.plants.length - remaining;

    $("todayLabel").textContent = "Care queue · Thursday, 21 September";
    $("queueCaption").textContent = remaining
      ? overdue.length
        ? overdue.length + " waiting patiently (but overdue) — let's start there."
        : "Sorted by who's been waiting longest."
      : "Nothing left in the queue. Nicely done.";

    var pills = "";
    if (remaining === 0) {
      pills = '<span class="stat-pill"><b>All done</b> · every plant tended</span>';
    } else {
      if (overdue.length) pills += '<span class="stat-pill is-urgent"><b>' + overdue.length + '</b> overdue</span>';
      if (today.length) pills += '<span class="stat-pill"><b>' + today.length + '</b> due today</span>';
      pills += '<span class="stat-pill"><b>' + done + '</b> already cared for</span>';
    }
    $("heroStats").innerHTML = pills;

    $("ringCount").textContent = remaining;
    var ring = $("ringFill");
    var circumference = 2 * Math.PI * 52;
    var fraction = DATA.plants.length ? done / DATA.plants.length : 0;
    ring.style.strokeDashoffset = String(circumference * (1 - fraction));
    ring.setAttribute("aria-hidden", "true");

    $("queueChip").textContent = remaining
      ? remaining + (remaining === 1 ? " plant" : " plants") + " to tend"
      : "All clear";

    $("heroSub").textContent = remaining === 0
      ? "Every plant is looked after. Go enjoy your day — they're quietly photosynthesising."
      : "Your plants are doing their best. Here's who could use a hand today.";
  }

  function renderQueue() {
    var pending = pendingPlants().sort(function (a, b) {
      var d = dueRank(b.due) - dueRank(a.due);
      return d !== 0 ? d : b.urgency - a.urgency;
    });

    var html = pending.map(function (p, i) {
      var late = isOverdue(p);
      var tomorrow = p.due.indexOf("Tomorrow") !== -1;
      var detailOpen = openDetailId === p.id;
      var st = state.plants[p.id];

      var dueClass = late ? "tag-due is-late" : "tag-due";
      var cls = "plant" + (late ? " is-overdue" : "") + (tomorrow ? " is-tomorrow" : "");

      var detailId = "detail-" + p.id;
      var historyHTML = p.history.map(function (h) {
        return "<li>" + esc(h) + "</li>";
      }).join("");
      var logEntries = (state.log || []).filter(function (e) { return e.plantId === p.id && e.kind !== "undo"; })
        .slice(0, 1);
      if (logEntries.length) {
        historyHTML = "<li>" + esc(logEntries[0].text) + "</li>" + historyHTML;
      }
      if (st.status === "snoozed") {
        historyHTML = "<li>Snoozed until tomorrow</li>" + historyHTML;
      }

      return '' +
        '<li class="' + cls + '" data-id="' + p.id + '">' +
          '<div class="plant-main">' +
            '<span class="avatar a-' + p.id + '" aria-hidden="true">' + plantSVG(p.id) + '</span>' +
            '<div class="plant-info">' +
              '<div class="plant-topline">' +
                '<span class="plant-name">' + esc(p.name) + '</span>' +
                '<span class="plant-species">' + esc(p.species) + '</span>' +
              '</div>' +
              '<div class="plant-meta">' +
                '<span class="tag tag-task"><span class="tag-dot"></span>' + esc(p.task) + '</span>' +
                '<span class="tag ' + dueClass + '">' + esc(p.due) + '</span>' +
                '<span class="tag">' + esc(p.location) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="plant-actions">' +
            '<button class="btn btn-water" type="button" data-action="water" data-id="' + p.id + '">' +
              ICON_WATER + ' ' + doneLabel(p.task) +
            '</button>' +
            '<button class="btn btn-snooze" type="button" data-action="snooze" data-id="' + p.id + '">' +
              ICON_SNOOZE + ' Snooze' +
            '</button>' +
            '<button class="btn btn-detail" type="button" data-action="detail" data-id="' + p.id + '" ' +
              'aria-expanded="' + detailOpen + '" aria-controls="' + detailId + '">' +
              'Care notes ' + CHEVRON +
            '</button>' +
          '</div>' +
          '<div class="detail' + (detailOpen ? " is-open" : "") + '" id="' + detailId + '">' +
            '<div class="detail-inner"><div class="detail-body">' +
              '<div class="detail-grid">' +
                '<div class="fact"><div class="fact-label">Light</div><div class="fact-value">' + esc(p.light) + '</div></div>' +
                '<div class="fact"><div class="fact-label">Water / care</div><div class="fact-value">' + esc(p.task) + ' · ' + esc(p.due.toLowerCase()) + '</div></div>' +
              '</div>' +
              '<div class="detail-history"><h4>Observation history</h4>' +
                '<ul class="history-list">' + historyHTML + '</ul>' +
              '</div>' +
            '</div></div>' +
          '</div>' +
        '</li>';
    }).join("");

    $("queue").innerHTML = html;
  }

  function renderRhythm() {
    var max = Math.max.apply(null, DATA.week);
    var html = DATA.week.map(function (n, i) {
      var blobs = "";
      for (var b = 0; b < n; b++) {
        blobs += '<span class="rhythm-blob" style="animation-delay:' + (i * 40 + b * 60) + 'ms"></span>';
      }
      var classes = "rhythm-day" + (i === TODAY_INDEX ? " is-today" : "") + (n === 0 ? " is-empty" : "");
      return '<div class="' + classes + '">' +
        '<div class="rhythm-stack">' + blobs + '</div>' +
        '<span class="rhythm-label">' + DAY_LABELS[i] + '</span>' +
      '</div>';
    }).join("");
    $("rhythmBars").innerHTML = html;

    var total = DATA.week.reduce(function (a, b) { return a + b; }, 0);
    $("rhythmBars").setAttribute("aria-label",
      "Care moments this week, Monday to Sunday: " +
      DATA.week.map(function (n, i) { return DAY_LABELS[i] + " " + n; }).join(", ") +
      ". Busiest day is " + DAY_LABELS[DATA.week.indexOf(max)] + " with " + max + ". " + total + " moments total.");
    $("rhythmLegend").innerHTML =
      '<span class="legend-swatch" aria-hidden="true"></span>' +
      '<span>Today is <b>Thursday</b> · ' + total + ' little moments this week</span>';
  }

  function renderLog() {
    var entries = (state.log || []).slice(0, 5);
    if (!entries.length) {
      $("log").innerHTML = '<li class="log-empty">No care logged yet today. The queue is your starting point.</li>';
      return;
    }
    $("log").innerHTML = entries.map(function (e) {
      var mark = e.kind === "water" ? "✓" : e.kind === "snooze" ? "z" : "↺";
      var cls = e.kind === "snooze" ? " snooze" : e.kind === "undo" ? " undo" : "";
      return '<li><span class="log-mark' + cls + '" aria-hidden="true">' + mark + '</span>' +
        '<span>' + esc(e.text) + '<span class="log-time">' + esc(e.time) + '</span></span></li>';
    }).join("");
  }

  function renderAllDone() {
    var remaining = pendingPlants().length;
    var done = completedPlants().length;
    var snoozed = DATA.plants.filter(function (p) { return state.plants[p.id].status === "snoozed"; }).length;
    var box = $("allDone");
    if (remaining > 0) {
      box.hidden = true;
      $("queue").hidden = false;
      return;
    }
    box.hidden = false;
    $("queue").hidden = true;
    $("allDoneFacts").innerHTML =
      '<span class="done-fact">' + done + ' cared for</span>' +
      (snoozed ? '<span class="done-fact">' + snoozed + ' snoozed</span>' : "") +
      '<span class="done-fact">Next check-in tomorrow</span>';
  }

  /* ============================================================
     ACTIONS
     ============================================================ */
  function addLog(kind, text, plantId) {
    if (!state.log) state.log = [];
    state.log.unshift({ kind: kind, text: text, plantId: plantId || null, time: nowLabel() });
    if (state.log.length > 12) state.log.length = 12;
  }

  function act(action, id) {
    var plant = DATA.plants.filter(function (p) { return p.id === id; })[0];
    if (!plant) return;
    var st = state.plants[id];
    if (st.status !== "pending") return;

    // snapshot for single-step undo
    lastAction = {
      id: id,
      prevStatus: st.status,
      prevPoints: st.points,
      prevLogLen: state.log.length,
      prevDone: state.doneCount,
      action: action
    };

    if (action === "water") {
      st.status = "done";
      st.points = 0;
      state.doneCount = (state.doneCount || 0) + 1;
      addLog("water", doneVerb(plant.task) + " " + plant.name + " · " + plant.task, id);
      announce(doneVerb(plant.task) + " " + plant.name + ". Undo available.");
      showToast("💧", doneVerb(plant.task) + " " + plant.name + ". Lovely.", true);
    } else if (action === "snooze") {
      st.status = "snoozed";
      st.points = 0;
      addLog("snooze", "Snoozed " + plant.name + " until tomorrow", id);
      announce(plant.name + " snoozed until tomorrow. Undo available.");
      showToast("🌙", plant.name + " snoozed until tomorrow.", true);
    }
    save();
    render();
    refocusAfterAction(id, action);
  }

  /* After an action the button disappears; move focus somewhere sensible. */
  function refocusAfterAction(id, action) {
    var pending = pendingPlants();
    var focusTarget;
    if (pending.length) {
      // focus the same-position action button of the next pending plant
      var next = pending[0];
      focusTarget = document.querySelector('.plant[data-id="' + next.id + '"] [data-action="' + action + '"]');
    }
    if (!focusTarget) focusTarget = $("undoBtn");
    if (focusTarget && !focusTarget.hidden && focusTarget.offsetParent !== null) {
      focusTarget.focus();
    }
  }

  function undoLast() {
    if (!lastAction) return;
    var u = lastAction;
    var st = state.plants[u.id];
    var plant = DATA.plants.filter(function (p) { return p.id === u.id; })[0];
    st.status = u.prevStatus;
    st.points = u.prevPoints;
    state.doneCount = u.prevDone;
    if (state.log && state.log.length > u.prevLogLen) {
      state.log.splice(0, state.log.length - u.prevLogLen);
    }
    addLog("undo", "Undid " + (u.action === "water" ? "mark done" : "snooze") + " for " + (plant ? plant.name : "plant"), u.id);
    lastAction = null;
    save();
    render();
    hideToast();
    announce("Action undone. " + (plant ? plant.name : "The plant") + " is back in the queue.");
    var btn = document.querySelector('.plant[data-id="' + u.id + '"] [data-action="' + u.action + '"]');
    if (btn) btn.focus();
  }

  function toggleDetail(id) {
    openDetailId = openDetailId === id ? null : id;
    renderQueue();
    var btn = document.querySelector('.plant[data-id="' + id + '"] [data-action="detail"]');
    if (btn) btn.setAttribute("aria-expanded", String(openDetailId === id));
    announce(openDetailId === id ? "Care notes expanded." : "Care notes collapsed.");
  }

  function resetDay() {
    state = freshState();
    lastAction = null;
    openDetailId = null;
    save();
    render();
    hideToast();
    announce("Day reset. All four plants are back in the queue.");
  }

  function undoAll() {
    state = freshState();
    lastAction = null;
    save();
    render();
    announce("Queue restored. All four plants are back.");
    var first = document.querySelector('.plant [data-action="detail"]');
    if (first) first.focus();
  }

  /* ============================================================
     TOAST
     ============================================================ */
  function showToast(icon, msg, withUndo) {
    var toast = $("toast");
    $("toastIcon").textContent = icon;
    $("toastMsg").textContent = msg;
    $("undoBtn").hidden = !withUndo;
    toast.hidden = false;
    // force reflow so transition runs
    void toast.offsetWidth;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }
  function hideToast() {
    var toast = $("toast");
    toast.classList.remove("is-visible");
    clearTimeout(toastTimer);
    var delay = prefersReducedMotion() ? 0 : 300;
    toastTimer = setTimeout(function () { toast.hidden = true; }, delay);
  }

  /* ============================================================
     ANNOUNCER
     ============================================================ */
  function announce(msg) {
    var el = $("announcer");
    el.textContent = "";
    setTimeout(function () { el.textContent = msg; }, 40);
  }

  /* ============================================================
     EVENTS (delegation + keyboard friendly)
     ============================================================ */
  document.addEventListener("click", function (e) {
    var target = e.target.closest ? e.target.closest("[data-action]") : null;
    if (target) {
      var action = target.getAttribute("data-action");
      var id = target.getAttribute("data-id");
      if (action === "water" || action === "snooze") act(action, id);
      else if (action === "detail") toggleDetail(id);
      return;
    }
    if (e.target.closest && e.target.closest("#undoBtn")) { undoLast(); return; }
    if (e.target.closest && e.target.closest("#toastClose")) { hideToast(); return; }
    if (e.target.closest && e.target.closest("#resetBtn")) { resetDay(); return; }
    if (e.target.closest && e.target.closest("#undoAllBtn")) { undoAll(); return; }
  });

  // Keyboard: Escape closes toast or collapses an open detail panel.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!$("toast").hidden) { hideToast(); return; }
      if (openDetailId) {
        var id = openDetailId;
        toggleDetail(id);
        var btn = document.querySelector('.plant[data-id="' + id + '"] [data-action="detail"]');
        if (btn) btn.focus();
      }
    }
  });

  // Keep nav "current" honest as sections come into view via scroll/hash.
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".topnav-link"));
  navLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      navLinks.forEach(function (l) { l.classList.remove("is-current"); l.removeAttribute("aria-current"); });
      link.classList.add("is-current");
      link.setAttribute("aria-current", "page");
    });
  });

  /* ---------- go ---------- */
  render();
})();
