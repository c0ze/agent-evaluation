/* Moss — care queue logic. Data mirrors PLANTS.json; no network requests. */
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

  var WATER = {
    fern: { guide: "Keep soil evenly moist; water every 3–4 days and mist often.", cadence: "Every 3–4 days" },
    pothos: { guide: "Water when the top 5 cm run dry, about weekly. Forgives a missed week.", cadence: "About weekly" },
    cactus: { guide: "Soak only when bone-dry, about monthly. Today is just a soil check.", cadence: "About monthly" },
    calathea: { guide: "Keep lightly moist with filtered water; mist on dry days.", cadence: "Mist daily, water weekly" }
  };

  var QUIRKS = {
    fern: "Frida sulks fastest — crispy tips mean she waited too long.",
    pothos: "Orbit leans toward the window like it pays rent there.",
    cactus: "Dot has touched no water in weeks and feels superior about it.",
    calathea: "Drama folds her leaves at night. Asleep, not mad."
  };

  var TIPS = [
    "Calatheas fold their leaves up at night like hands. If Drama looks droopy after dark, she\u2019s just asleep \u2014 not mad at you.",
    "Boston ferns adore steamy bathrooms. Frida\u2019s crispy tips usually mean dry air, not just dry soil.",
    "Pothos tell you when they\u2019re thirsty: leaves go a little limp. Orbit forgives almost everything else.",
    "Bunny-ear cacti want a good soak, then total neglect. When in doubt, put the watering can down."
  ];

  var POT_SVG = {
    fern: '<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><path d="M22 40c-5-14 0-26 9-33-1 11-2 22-3 33z" fill="#3e6b4f"/><path d="M32 40c-5-12-4-25 2-34 1 11 1 23 4 34z" fill="#2a4a38"/><path d="M42 40c-1-10 2-20 8-26 0 9-1 18-2 26z" fill="#3e6b4f"/><path d="M18 40h28l-3 14H21z" fill="#d96c47" stroke="#2e2a23" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    pothos: '<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><path d="M26 22c-6-6-14-7-19-6 3 5 9 9 17 10z" fill="#3e6b4f"/><path d="M38 22c6-6 14-7 19-6-3 5-9 9-17 10z" fill="#2a4a38"/><circle cx="32" cy="20" r="7" fill="#3e6b4f"/><path d="M20 34h24l-3 13H23z" fill="#e9b44c" stroke="#2e2a23" stroke-width="2.5" stroke-linejoin="round"/><path d="M26 47c0 5-3 7-6 8M38 47c0 5 3 7 6 8" stroke="#3e6b4f" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>',
    cactus: '<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><rect x="26" y="12" width="12" height="24" rx="6" fill="#3e6b4f" stroke="#2e2a23" stroke-width="2.5"/><rect x="17" y="22" width="9" height="14" rx="4.5" fill="#3e6b4f" stroke="#2e2a23" stroke-width="2.5"/><rect x="38" y="22" width="9" height="14" rx="4.5" fill="#3e6b4f" stroke="#2e2a23" stroke-width="2.5"/><path d="M20 36h24l-3 13H23z" fill="#f3d9c8" stroke="#2e2a23" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    calathea: '<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><ellipse cx="32" cy="20" rx="8" ry="12" fill="#2a4a38"/><path d="M32 8v24M26 14l12 4M26 22l12-4" stroke="#dde3c8" stroke-width="1.6"/><ellipse cx="20" cy="26" rx="6" ry="9" fill="#3e6b4f" transform="rotate(-24 20 26)"/><ellipse cx="44" cy="26" rx="6" ry="9" fill="#3e6b4f" transform="rotate(24 44 26)"/><path d="M20 36h24l-3 13H23z" fill="#3e6b4f" stroke="#2e2a23" stroke-width="2.5" stroke-linejoin="round"/></svg>'
  };

  var DROP_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.5C8 1.5 3 7 3 10a5 5 0 0 0 10 0c0-3-5-8.5-5-8.5z" fill="currentColor" opacity=".9"/><circle cx="6.4" cy="10.4" r="1.3" fill="#fff" opacity=".8"/></svg>';
  var SNOOZE_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 6.4V9l1.8 1.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.5 1.5h5M8 1.5V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var CHEV_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="#2e2a23" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var DAYS = ["M", "T", "W", "T", "F", "S", "S"];
  var DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- state ----
  var state = {}; // id -> "todo" | "done" | "snoozed"
  var openId = "fern"; // overdue plant starts expanded so its story is visible
  var lastAction = null;
  var toastTimer = null;

  DATA.plants.forEach(function (p) { state[p.id] = "todo"; });

  // ---- element refs ----
  var queueEl = document.getElementById("queue");
  var allDoneEl = document.getElementById("allDone");
  var doneListEl = document.getElementById("doneList");
  var doneItemsEl = document.getElementById("doneItems");
  var progressCount = document.getElementById("progressCount");
  var progressBar = document.getElementById("progressBar");
  var progressFill = document.getElementById("progressFill");
  var queueSub = document.getElementById("queueSub");
  var live = document.getElementById("live");
  var toast = document.getElementById("toast");
  var toastMsg = document.getElementById("toastMsg");
  var toastTimerBar = document.getElementById("toastTimer");
  var undoBtn = document.getElementById("undoBtn");
  var toastClose = document.getElementById("toastClose");

  function plantById(id) {
    for (var i = 0; i < DATA.plants.length; i++) if (DATA.plants[i].id === id) return DATA.plants[i];
    return null;
  }

  function lastWatered(p) {
    for (var i = 0; i < p.history.length; i++) {
      if (/watered/i.test(p.history[i])) return p.history[i];
    }
    return null;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function dueClass(due) {
    if (/overdue/i.test(due)) return "is-overdue";
    if (/today/i.test(due)) return "is-today";
    return "";
  }

  function dueLabel(p) {
    if (state[p.id] === "snoozed") return "Snoozed · back tomorrow";
    return p.due;
  }

  function sortedPlants() {
    return DATA.plants.slice().sort(function (a, b) {
      var sa = state[a.id], sb = state[b.id];
      var rank = function (s) { return s === "todo" ? 0 : s === "snoozed" ? 1 : 2; };
      if (rank(sa) !== rank(sb)) return rank(sa) - rank(sb);
      return b.urgency - a.urgency;
    });
  }

  // ---- render queue ----
  function render() {
    var plants = sortedPlants();
    var todo = plants.filter(function (p) { return state[p.id] === "todo"; });
    var handled = plants.filter(function (p) { return state[p.id] !== "todo"; });

    queueEl.innerHTML = "";
    plants.forEach(function (p, idx) {
      var st = state[p.id];
      var li = document.createElement("li");
      li.className = "plant" + (st === "done" ? " is-done" : st === "snoozed" ? " is-snoozed" : "");
      li.setAttribute("data-urgency", String(p.urgency));
      li.setAttribute("data-id", p.id);

      var isOpen = openId === p.id;
      var detailId = "detail-" + p.id;
      var triggerId = "trigger-" + p.id;
      var lw = lastWatered(p);

      var html = "";
      if (idx === 0 && st === "todo" && p.urgency >= 3) {
        html += '<span class="first-up" aria-hidden="true">First up · overdue</span>';
      }
      html += '<article class="plant-card" aria-label="' + esc(p.name + ", " + p.species) + '">';
      html += '<button type="button" class="disclosure" id="' + triggerId + '" aria-expanded="' + (isOpen ? "true" : "false") + '" aria-controls="' + detailId + '">';
      html += '<span class="pot" aria-hidden="true">' + (POT_SVG[p.id] || "") + "</span>";
      html += '<span><span class="plant-name">' + esc(p.name) + ' <span class="species">' + esc(p.species) + "</span></span>";
      html += '<span class="plant-meta">' + esc(p.location) + " · " + esc(p.light) + "</span></span>";
      html += '<span class="badges"><span class="chip chip-task">' + esc(p.task) + '</span> ';
      html += '<span class="chip chip-due ' + dueClass(dueLabel(p)) + '">' + esc(dueLabel(p)) + "</span></span>";
      html += '<span class="chev" aria-hidden="true">' + CHEV_SVG + "</span>";
      html += "</button>";

      html += '<div class="detail" id="' + detailId + '" role="region" aria-labelledby="' + triggerId + '"' + (isOpen ? "" : " hidden") + ">";
      html += '<dl class="facts">';
      html += '<div class="fact"><dt>Light</dt><dd>' + esc(p.light) + "</dd></div>";
      html += '<div class="fact"><dt>Water</dt><dd>' + esc(WATER[p.id].guide) +
        '<span class="last">Rhythm: ' + esc(WATER[p.id].cadence) + (lw ? " · Last: " + esc(lw) : "") + "</span></dd></div>";
      html += '<div class="fact"><dt>Note</dt><dd>' + esc(QUIRKS[p.id]) + "</dd></div>";
      html += "</dl>";
      html += '<h4 class="obs-heading">Observation history</h4><ul class="obs">';
      p.history.forEach(function (h) { html += "<li>" + esc(h) + "</li>"; });
      html += "</ul></div>";

      html += '<div class="actions">';
      if (st === "done") {
        html += '<button type="button" class="btn btn-snooze" data-act="reopen" data-id="' + p.id + '">Not yet, actually</button>';
        html += '<button type="button" class="mini-undo" data-act="reopen" data-id="' + p.id + '">moves back to the queue</button>';
      } else if (st === "snoozed") {
        html += '<button type="button" class="btn btn-water" data-act="watered" data-id="' + p.id + '">' + DROP_SVG + "Did it anyway</button>";
        html += '<button type="button" class="btn btn-snooze" data-act="reopen" data-id="' + p.id + '">' + SNOOZE_SVG + "Wake up</button>";
      } else {
        html += '<button type="button" class="btn btn-water" data-act="watered" data-id="' + p.id + '">' + DROP_SVG + esc(waterVerb(p)) + "</button>";
        html += '<button type="button" class="btn btn-snooze" data-act="snooze" data-id="' + p.id + '">' + SNOOZE_SVG + "Snooze</button>";
      }
      html += "</div></article>";
      li.innerHTML = html;
      queueEl.appendChild(li);
    });

    // disclosure toggles
    queueEl.querySelectorAll(".disclosure").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.closest("li").getAttribute("data-id");
        openId = (openId === id) ? null : id;
        render();
        var next = document.getElementById("trigger-" + id);
        if (next) next.focus();
      });
    });

    // actions (delegated)
    queueEl.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        handleAction(btn.getAttribute("data-act"), btn.getAttribute("data-id"), btn);
      });
    });

    // progress + all-done
    var doneCount = handled.length;
    var total = DATA.plants.length;
    progressCount.textContent = doneCount + " of " + total + " tended";
    progressBar.setAttribute("aria-valuenow", String(doneCount));
    progressFill.style.width = (doneCount / total * 100) + "%";

    if (todo.length === 0) {
      queueEl.hidden = true;
      allDoneEl.hidden = false;
      var snoozed = handled.filter(function (p) { return state[p.id] === "snoozed"; }).length;
      document.getElementById("allDoneCopy").textContent = snoozed === 0
        ? "Every plant is watered, misted, or spun toward the sun. Go enjoy the green."
        : "Every plant is handled — " + snoozed + " snoozed for a busier day. No guilt; Moss remembers.";
      queueSub.textContent = "All clear. Nicely tended.";
    } else {
      queueEl.hidden = false;
      allDoneEl.hidden = true;
      var first = todo[0];
      queueSub.textContent = /overdue/i.test(first.due)
        ? first.name + " is overdue — start at the top."
        : todo.length + " plant" + (todo.length === 1 ? "" : "s") + " left. " + first.name + " is next.";
    }

    renderDoneList(handled);
  }

  function renderDoneList(handled) {
    if (!doneListEl) return;
    // The done list only appears once the user asks to review the crew.
    if (!doneListOpen || !handled.length) { doneListEl.hidden = true; return; }
    doneListEl.hidden = false;
    doneItemsEl.innerHTML = "";
    handled.forEach(function (p) {
      var li = document.createElement("li");
      var label = state[p.id] === "done" ? "Tended" : "Snoozed";
      li.innerHTML = "<span><strong>" + esc(p.name) + "</strong> · " + esc(label) + "</span>";
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mini-undo";
      b.textContent = "Undo";
      b.setAttribute("aria-label", "Undo " + label.toLowerCase() + " for " + p.name);
      b.addEventListener("click", function () { undoTo(p.id, "todo"); });
      li.appendChild(b);
      doneItemsEl.appendChild(li);
    });
  }

  var doneListOpen = false;

  function waterVerb(p) {
    if (/mist/i.test(p.task)) return "Misted";
    if (/rotate/i.test(p.task)) return "Rotated";
    if (/soil/i.test(p.task)) return "Checked";
    return "Watered";
  }

  // ---- actions + undo ----
  function handleAction(act, id, btn) {
    var p = plantById(id);
    if (!p) return;
    var prev = state[id];
    if (act === "watered") {
      state[id] = "done";
      burst(btn);
      showToast(p.name + " " + waterVerb(p).toLowerCase() + ". Lovely work.", { id: id, prev: prev });
      announce(p.name + " marked as " + waterVerb(p).toLowerCase() + ". Undo available.");
    } else if (act === "snooze") {
      state[id] = "snoozed";
      showToast(p.name + " snoozed until tomorrow. Moss will remind you.", { id: id, prev: prev });
      announce(p.name + " snoozed until tomorrow. Undo available.");
    } else if (act === "reopen") {
      state[id] = "todo";
      hideToast();
      announce(p.name + " is back in the queue.");
    }
    render();
  }

  function undoLast() {
    if (!lastAction) return;
    var p = plantById(lastAction.id);
    state[lastAction.id] = lastAction.prev;
    hideToast();
    render();
    announce(p ? p.name + " restored to the queue." : "Action undone.");
    lastAction = null;
  }

  function undoTo(id, st) {
    state[id] = st;
    hideToast();
    lastAction = null;
    render();
    var p = plantById(id);
    announce(p ? p.name + " restored to the queue." : "Undone.");
  }

  function showToast(msg, action) {
    lastAction = action;
    undoBtn.style.display = action ? "" : "none";
    toastMsg.textContent = msg;
    toast.hidden = false;
    if (toastTimer) window.clearTimeout(toastTimer);
    if (!reduceMotion) {
      toastTimerBar.classList.remove("go");
      void toastTimerBar.offsetWidth; // restart animation
      toastTimerBar.classList.add("go");
    }
    toastTimer = window.setTimeout(function () { hideToast(); lastAction = null; }, 6000);
  }

  function hideToast() {
    toast.hidden = true;
    if (toastTimer) { window.clearTimeout(toastTimer); toastTimer = null; }
  }

  function announce(msg) { live.textContent = ""; window.setTimeout(function () { live.textContent = msg; }, 30); }

  function burst(btn) {
    if (reduceMotion || !btn) return;
    var card = btn.closest(".plant-card");
    if (!card) return;
    var wrap = document.createElement("span");
    wrap.className = "burst";
    wrap.setAttribute("aria-hidden", "true");
    var r = btn.getBoundingClientRect();
    var cr = card.getBoundingClientRect();
    var cx = r.left - cr.left + r.width / 2;
    var cy = r.top - cr.top;
    for (var i = 0; i < 10; i++) {
      var d = document.createElement("i");
      if (i % 3 === 0) d.className = "leaf";
      d.style.left = cx + "px";
      d.style.top = cy + "px";
      d.style.setProperty("--dx", (Math.random() * 120 - 60) + "px");
      d.style.animationDelay = (Math.random() * 0.12) + "s";
      wrap.appendChild(d);
    }
    card.style.position = "relative";
    card.appendChild(wrap);
    window.setTimeout(function () { wrap.remove(); }, 1000);
  }

  undoBtn.addEventListener("click", undoLast);
  toastClose.addEventListener("click", function () { hideToast(); lastAction = null; });

  // Esc collapses the open detail panel
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openId) {
      var id = openId;
      openId = null;
      render();
      var next = document.getElementById("trigger-" + id);
      if (next) next.focus();
    }
  });

  // ---- header date / greeting ----
  (function header() {
    var now = new Date();
    var h = now.getHours();
    var greet = h < 12 ? "Good morning, plant parent." : h < 18 ? "Good afternoon, plant parent." : "Good evening, plant parent.";
    document.getElementById("greeting").textContent = greet;
    var opts = { weekday: "long", month: "long", day: "numeric" };
    try {
      document.getElementById("datePill").textContent = now.toLocaleDateString(undefined, opts);
    } catch (e) {
      document.getElementById("datePill").textContent = "Today";
    }
  })();

  // ---- weekly rhythm ----
  (function rhythm() {
    var bars = document.getElementById("bars");
    var week = DATA.week;
    var max = Math.max.apply(null, week);
    var total = week.reduce(function (a, b) { return a + b; }, 0);
    // JS: 0=Sunday..6=Saturday → index into Mon-first array
    var todayIdx = (new Date().getDay() + 6) % 7;
    document.getElementById("rhythmTotal").textContent = total + " visits this week";
    week.forEach(function (v, i) {
      var li = document.createElement("li");
      if (i === todayIdx) li.className = "is-today";
      var pct = Math.round((v / max) * 100);
      li.innerHTML =
        '<span class="bar-col"><span class="bar' + (i === todayIdx ? " is-today" : "") + (v === max ? " is-max" : "") +
        '" style="height:' + Math.max(pct, 18) + '%" role="img" aria-label="' + DAY_NAMES[i] + ": " + v +
        ' care visits' + (i === todayIdx ? ", today" : "") + '"><span class="bar-val" aria-hidden="true">' + v + "</span></span></span>" +
        '<span class="day" aria-hidden="true">' + DAYS[i] + "</span>";
      bars.appendChild(li);
    });
    var busiest = week.indexOf(max);
    document.getElementById("rhythmCaption").textContent =
      DAY_NAMES[busiest] + " is the busy day — " + max + " little visits. " +
      DAY_NAMES[todayIdx] + " holds " + week[todayIdx] + ".";
  })();

  // ---- tips ----
  (function tips() {
    var idx = 0;
    var text = document.getElementById("tipText");
    document.getElementById("tipBtn").addEventListener("click", function () {
      idx = (idx + 1) % TIPS.length;
      text.textContent = TIPS[idx];
    });
  })();

  // ---- review / tomorrow / reset ----
  document.getElementById("reviewBtn").addEventListener("click", function () {
    doneListOpen = true;
    render();
    var h = doneListEl.querySelector(".done-heading");
    doneListEl.hidden = false;
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: false }); }
    document.getElementById("queueHeading").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });
  document.getElementById("tomorrowBtn").addEventListener("click", function () {
    announce("Tomorrow: Drama wants a mist, and Frida will want checking again. Moss will have the queue ready.");
    showToast("Tomorrow: Drama wants a mist. Queue preview coming at sunrise.", null);
  });
  document.getElementById("resetBtn").addEventListener("click", function () {
    DATA.plants.forEach(function (p) { state[p.id] = "todo"; });
    openId = "fern";
    doneListOpen = false;
    doneListEl.hidden = true;
    hideToast();
    lastAction = null;
    render();
    announce("Demo day restarted. All four plants are back in the queue.");
  });

  render();
})();
