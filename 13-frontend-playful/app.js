/* Moss — gentle plant-care companion. Data mirrors PLANTS.json (embedded so the page works from file:// with no network). */
(function () {
  "use strict";

  var PLANTS = [
    { id: "fern", name: "Frida", species: "Boston fern", location: "Bathroom", task: "Water", due: "2 days overdue", urgency: 4, light: "Low, indirect", water: "Keep soil evenly moist; mist fronds 2–3 times a week.", history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"] },
    { id: "pothos", name: "Orbit", species: "Golden pothos", location: "Bookshelf", task: "Rotate", due: "Today", urgency: 2, light: "Medium, indirect", water: "Water when the top 2 cm of soil feel dry.", history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"] },
    { id: "cactus", name: "Dot", species: "Bunny ears cactus", location: "South window", task: "Check soil", due: "Today", urgency: 1, light: "Bright, direct", water: "Water sparingly, only when the soil is bone dry.", history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"] },
    { id: "calathea", name: "Drama", species: "Calathea orbifolia", location: "Bedroom", task: "Mist", due: "Tomorrow", urgency: 0, light: "Medium, filtered", water: "Keep lightly moist; mist often and avoid tap-water spots.", history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"] }
  ];
  var WEEK = [1, 3, 2, 4, 2, 1, 3];
  var WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var TODAY_INDEX = 1; // Tuesday

  var ART = {
    fern: '<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true" focusable="false"><g fill="none" stroke="#33512e" stroke-width="2.6" stroke-linecap="round"><path d="M32 54V34"/><path d="M32 40C24 38 18 32 16 24M32 36c-6-4-8-10-8-16M32 40c8-2 14-8 16-16M32 36c6-4 8-10 8-16M32 32V16"/></g><path d="M22 54h20" stroke="#b94f21" stroke-width="3" stroke-linecap="round"/></svg>',
    pothos: '<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true" focusable="false"><path d="M14 8c14 4 8 14 20 18s10 12 16 14" fill="none" stroke="#33512e" stroke-width="2.6" stroke-linecap="round"/><path d="M20 10c4-4 10-2 11 2-3 3-9 2-11-2ZM30 24c5-2 10 1 10 5-4 2-9-1-10-5ZM42 38c5 0 8 4 7 8-4 1-8-3-7-8Z" fill="#5c7a3e"/></svg>',
    cactus: '<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true" focusable="false"><ellipse cx="26" cy="26" rx="9" ry="13" fill="#5c7a3e"/><ellipse cx="42" cy="20" rx="7" ry="10" fill="#7da05c" transform="rotate(18 42 20)"/><path d="M16 52h32l-4 8H20Z" fill="#b94f21"/><circle cx="23" cy="22" r="1.4" fill="#fffdf4"/><circle cx="29" cy="30" r="1.4" fill="#fffdf4"/><circle cx="42" cy="17" r="1.4" fill="#fffdf4"/></svg>',
    calathea: '<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true" focusable="false"><g fill="#5c7a3e"><ellipse cx="22" cy="26" rx="9" ry="14" transform="rotate(-18 22 26)"/><ellipse cx="42" cy="26" rx="9" ry="14" transform="rotate(18 42 26)"/></g><ellipse cx="32" cy="20" rx="8" ry="13" fill="#7da05c"/><path d="M32 54V36" stroke="#33512e" stroke-width="2.6" stroke-linecap="round"/><path d="M20 56h24" stroke="#b94f21" stroke-width="3" stroke-linecap="round"/></svg>'
  };

  var state = {};
  PLANTS.forEach(function (p) { state[p.id] = "pending"; }); // pending | done | snoozed
  var selectedId = "fern";
  var undoStack = [];
  var toastTimer = null;

  var queueList = document.getElementById("queue-list");
  var snoozedWrap = document.getElementById("snoozed-wrap");
  var snoozedList = document.getElementById("snoozed-list");
  var allDone = document.getElementById("all-done");
  var allDoneCopy = document.getElementById("all-done-copy");
  var reviewSnoozedBtn = document.getElementById("review-snoozed-btn");
  var detailContent = document.getElementById("detail-content");
  var progressLabel = document.getElementById("progress-label");
  var progressFill = document.getElementById("progress-fill");
  var progressBar = document.getElementById("progress-bar");
  var toast = document.getElementById("toast");
  var toastMsg = document.getElementById("toast-msg");

  function byId(id) { return PLANTS.filter(function (p) { return p.id === id; })[0]; }
  function pendingPlants() {
    return PLANTS.filter(function (p) { return state[p.id] === "pending"; })
      .sort(function (a, b) { return b.urgency - a.urgency; });
  }
  function isWaterTask(p) { return /water|mist/i.test(p.task); }
  function primaryLabel(p) { return isWaterTask(p) ? "Watered" : "Done"; }

  function leafBurst(card) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !card) return;
    var burst = document.createElement("span");
    burst.className = "leaf-burst"; burst.setAttribute("aria-hidden", "true");
    burst.style.right = "70px"; burst.style.top = "18px";
    for (var i = 0; i < 7; i++) {
      var leaf = document.createElement("i");
      var angle = (i / 7) * Math.PI * 2;
      leaf.style.setProperty("--tx", Math.round(Math.cos(angle) * 46) + "px");
      leaf.style.setProperty("--ty", Math.round(Math.sin(angle) * 34 - 8) + "px");
      leaf.style.setProperty("--rot", (i * 47) + "deg");
      burst.appendChild(leaf);
    }
    card.appendChild(burst);
    setTimeout(function () { burst.remove(); }, 750);
  }

  function showToast(message) {
    toastMsg.textContent = message;
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }
  function hideToast() { toast.hidden = true; if (toastTimer) clearTimeout(toastTimer); }

  function act(id, action, cardEl) {
    var plant = byId(id);
    undoStack.push({ id: id, prev: state[id], action: action });
    state[id] = action === "watered" ? "done" : "snoozed";
    if (action === "watered") leafBurst(cardEl);
    render();
    showToast(action === "watered"
      ? plant.name + " marked as " + primaryLabel(plant).toLowerCase() + ". Nice one."
      : plant.name + " snoozed until tomorrow.");
    var undoBtn = document.getElementById("toast-undo");
    if (undoBtn) undoBtn.focus({ preventScroll: true });
  }

  function undo() {
    var last = undoStack.pop();
    if (!last) { hideToast(); return; }
    state[last.id] = last.prev;
    selectedId = last.id;
    render();
    toastMsg.textContent = "Undone — " + byId(last.id).name + " is back in today's queue.";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4000);
    var card = queueList.querySelector('[data-plant="' + last.id + '"] .btn-detail');
    if (card) card.focus({ preventScroll: true });
  }

  function renderDetail() {
    var p = byId(selectedId) || PLANTS[0];
    var statusNote = state[p.id] === "done" ? "Cared for today — thank you."
      : state[p.id] === "snoozed" ? "Snoozed until tomorrow." : "Waiting in today's queue.";
    detailContent.innerHTML =
      '<h2 id="detail-heading">' + p.name + '</h2>' +
      '<p class="detail-species">' + p.species + ' · ' + p.location + '</p>' +
      '<dl class="detail-facts">' +
      '<div class="fact"><dt>Light</dt><dd>' + p.light + '</dd></div>' +
      '<div class="fact"><dt>Water</dt><dd>' + p.water + '</dd></div>' +
      '<div class="fact"><dt>Next task</dt><dd>' + p.task + ' · ' + p.due + '</dd></div>' +
      '<div class="fact"><dt>Status</dt><dd>' + statusNote + '</dd></div></dl>' +
      '<h3 class="history-heading">Observation history</h3>' +
      '<ul class="history-list">' + p.history.map(function (h) { return "<li>" + h + "</li>"; }).join("") + '</ul>' +
      (state[p.id] === "pending"
        ? '<div class="detail-actions"><button type="button" class="btn btn-water" data-detail-action="watered" data-id="' + p.id + '">' + primaryLabel(p) + '</button>' +
          '<button type="button" class="btn btn-ghost" data-detail-action="snoozed" data-id="' + p.id + '">Snooze until tomorrow</button></div>'
        : '<p class="detail-hint">' + statusNote + ' Use Undo in the notification, or “Bring everyone back”, to restore the queue.</p>');
  }

  function renderQueue() {
    var pending = pendingPlants();
    queueList.innerHTML = pending.map(function (p, i) {
      var overdue = /overdue/i.test(p.due);
      var featured = i === 0 && overdue;
      var badgeClass = overdue ? "due-badge is-overdue" : (/tomorrow/i.test(p.due) ? "due-badge is-tomorrow" : "due-badge");
      return '<li><article class="plant-card plant-card--' + p.id + (featured ? " is-featured" : "") + (selectedId === p.id ? " is-selected" : "") + '" data-plant="' + p.id + '">' +
        (featured ? '<p class="detail-eyebrow">Start here</p>' : '') +
        '<div class="card-top"><div class="plant-art" aria-hidden="true">' + ART[p.id] + '</div>' +
        '<div class="card-main"><h3 class="plant-name">' + p.name + '</h3>' +
        '<p class="plant-meta">' + p.species + ' · ' + p.location + '</p>' +
        '<span class="' + badgeClass + '">' + p.due + '</span>' +
        '<p class="task-line"><strong>' + p.task + '</strong> — ' + (overdue ? "this one has been waiting, so it goes first." : /tomorrow/i.test(p.due) ? "not urgent yet; a gentle heads-up." : "due today, in good time.") + '</p></div></div>' +
        '<div class="card-actions">' +
        '<button type="button" class="btn ' + (isWaterTask(p) ? "btn-water" : "btn-primary") + '" data-action="watered" data-id="' + p.id + '" aria-label="Mark ' + p.name + ' as ' + primaryLabel(p).toLowerCase() + '">' + primaryLabel(p) + '</button>' +
        '<button type="button" class="btn btn-ghost" data-action="snoozed" data-id="' + p.id + '" aria-label="Snooze ' + p.name + ' until tomorrow">Snooze</button>' +
        '<button type="button" class="btn-detail" data-action="select" data-id="' + p.id + '" aria-expanded="' + (selectedId === p.id) + '" aria-controls="detail-panel">Details <span class="chev" aria-hidden="true">▾</span></button>' +
        '</div></article></li>';
    }).join("");

    var snoozed = PLANTS.filter(function (p) { return state[p.id] === "snoozed"; });
    snoozedWrap.hidden = snoozed.length === 0;
    snoozedList.innerHTML = snoozed.map(function (p) {
      return '<li class="snoozed-item"><span><strong>' + p.name + '</strong> · ' + p.task + ' — resting until tomorrow</span>' +
        '<button type="button" class="btn btn-ghost" data-action="wake" data-id="' + p.id + '">Bring back</button></li>';
    }).join("");

    var doneCount = PLANTS.filter(function (p) { return state[p.id] === "done"; }).length;
    var cared = doneCount + snoozed.length;
    progressLabel.textContent = cared + " of " + PLANTS.length + " cared for today" + (snoozed.length ? " (" + snoozed.length + " snoozed)" : "");
    progressFill.style.width = (cared / PLANTS.length * 100) + "%";
    progressBar.setAttribute("aria-valuenow", String(cared));
    progressBar.setAttribute("aria-valuetext", cared + " of " + PLANTS.length + " plants cared for");

    var isAllDone = pending.length === 0;
    allDone.hidden = !isAllDone;
    if (isAllDone) {
      allDoneCopy.textContent = snoozed.length
        ? "Today's queue is clear. " + snoozed.map(function (p) { return p.name; }).join(", ") + " will pop back tomorrow — nothing is forgotten."
        : "Every plant on today's list has been tended. Drama the calathea is next, with a mist due tomorrow.";
      reviewSnoozedBtn.hidden = snoozed.length === 0;
    }
    if (isAllDone && !byId(selectedId)) selectedId = PLANTS[0].id;
  }

  function renderWeek() {
    var max = Math.max.apply(null, WEEK);
    document.getElementById("week-chart").innerHTML = WEEK.map(function (v, i) {
      var h = Math.round(v / max * 100);
      return '<div class="week-day' + (i === TODAY_INDEX ? " is-today" : "") + '">' +
        '<span class="week-count" aria-hidden="true">' + v + '</span>' +
        '<div class="week-bar-wrap" aria-hidden="true"><div class="week-bar" style="height:' + h + '%"></div></div>' +
        '<span class="week-day-label">' + WEEK_LABELS[i] + (i === TODAY_INDEX ? " · today" : "") + '</span></div>';
    }).join("");
  }

  function render() { renderQueue(); renderDetail(); }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action],[data-detail-action]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var card = btn.closest(".plant-card");
    if (btn.hasAttribute("data-detail-action")) { act(id, btn.getAttribute("data-detail-action"), null); return; }
    var action = btn.getAttribute("data-action");
    if (action === "watered") act(id, "watered", card);
    else if (action === "snoozed") act(id, "snoozed", card);
    else if (action === "wake") { undoStack.push({ id: id, prev: state[id], action: "wake" }); state[id] = "pending"; selectedId = id; render(); showToast(byId(id).name + " is back in today's queue."); }
    else if (action === "select") {
      selectedId = id; render();
      if (window.innerWidth < 900) document.getElementById("detail-panel").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    }
  });

  document.getElementById("toast-undo").addEventListener("click", undo);
  document.getElementById("toast-close").addEventListener("click", hideToast);
  document.getElementById("reset-btn").addEventListener("click", function () {
    PLANTS.forEach(function (p) { state[p.id] = "pending"; });
    undoStack = []; selectedId = "fern"; render(); hideToast();
    document.getElementById("queue-heading").focus({ preventScroll: false });
  });
  reviewSnoozedBtn.addEventListener("click", function () {
    snoozedWrap.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    var first = snoozedList.querySelector("button"); if (first) first.focus({ preventScroll: true });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !toast.hidden) hideToast(); });

  renderWeek();
  render();
})();
