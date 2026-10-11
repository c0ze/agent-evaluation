/* ============================================================
   Moss — app logic.
   Data below mirrors PLANTS.json (embedded so the app runs
   from file:// with zero network requests, per the brief).
   ============================================================ */

"use strict";

const PLANT_DATA = {
  plants: [
    { id: "fern",     name: "Frida", species: "Boston fern",        location: "Bathroom",     task: "Water",      due: "2 days overdue", urgency: 4, light: "Low, indirect",    history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"] },
    { id: "pothos",   name: "Orbit", species: "Golden pothos",      location: "Bookshelf",    task: "Rotate",     due: "Today",          urgency: 2, light: "Medium, indirect", history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"] },
    { id: "cactus",   name: "Dot",   species: "Bunny ears cactus",  location: "South window", task: "Check soil", due: "Today",          urgency: 1, light: "Bright, direct",   history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"] },
    { id: "calathea", name: "Drama", species: "Calathea orbifolia", location: "Bedroom",      task: "Mist",       due: "Tomorrow",       urgency: 0, light: "Medium, filtered", history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"] }
  ],
  week: [1, 3, 2, 4, 2, 1, 3]
};

const DONE_LABEL = { "Water": "Watered", "Rotate": "Rotated", "Check soil": "Soil checked", "Mist": "Misted" };
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TOAST_MS = 8000;

/* ---------- state ---------- */

const state = PLANT_DATA.plants.map((p) => ({
  ...p,
  history: [...p.history],
  status: "todo",          // "todo" | "done" | "snoozed"
  doneLabel: DONE_LABEL[p.task] || "Done"
}));

let lastAction = null;     // { id, prevStatus, prevDue, prevUrgency, addedNote }
let toastTimer = null;

/* ---------- dom refs ---------- */

const queueEl   = document.getElementById("queue");
const countEl   = document.getElementById("queue-count");
const allDoneEl = document.getElementById("all-done");
const toastEl   = document.getElementById("toast");
const toastMsg  = document.getElementById("toast-msg");
const toastUndo = document.getElementById("toast-undo");
const moodEl    = document.getElementById("mood-text");

/* ---------- svg portraits (inline illustration) ---------- */

function portrait(id) {
  const pot = '<path d="M16 46h24l-3 14H19z" fill="#c26a44"/><rect x="14" y="42" width="28" height="6" rx="3" fill="#a8562f"/>';
  const art = {
    fern:
      '<g fill="none" stroke="#3f5c38" stroke-width="2.4" stroke-linecap="round">' +
      '<path d="M28 42C26 30 18 26 10 27"/><path d="M28 42c0-13 7-19 16-19"/>' +
      '<path d="M28 42c-1-10-6-15-13-16"/><path d="M28 42c1-11 8-15 14-14"/>' +
      '<path d="M28 42V22"/></g>' +
      '<g fill="#7fa168"><ellipse cx="10" cy="26" rx="3" ry="1.8"/><ellipse cx="15" cy="25" rx="3" ry="1.8"/><ellipse cx="20" cy="26" rx="3" ry="1.8"/>' +
      '<ellipse cx="44" cy="23" rx="3" ry="1.8"/><ellipse cx="39" cy="24" rx="3" ry="1.8"/><ellipse cx="34" cy="26" rx="3" ry="1.8"/>' +
      '<ellipse cx="28" cy="20" rx="2.4" ry="3.4"/><ellipse cx="28" cy="28" rx="2.4" ry="3.4"/></g>',
    pothos:
      '<g fill="none" stroke="#3f5c38" stroke-width="2.2" stroke-linecap="round">' +
      '<path d="M28 42c-2-10-8-12-14-10"/><path d="M28 42c3-12 10-14 15-11"/><path d="M28 42c0 8 6 10 9 14"/></g>' +
      '<g fill="#7fa168"><path d="M14 32c-4-4-10-1-9 4 1 4 7 5 9-4z"/><path d="M43 31c4-5 10-2 9 3-1 5-8 5-9-3z"/>' +
      '<path d="M38 56c5 2 4 8-1 9-4 1-6-5 1-9z"/><path d="M28 24c-5-3-3-10 2-10 5 0 6 7-2 10z" fill="#a9c393"/></g>',
    cactus:
      '<g fill="#7fa168" stroke="#3f5c38" stroke-width="2">' +
      '<rect x="21" y="20" width="14" height="23" rx="7"/>' +
      '<rect x="13" y="10" width="8" height="14" rx="4" transform="rotate(-14 17 17)"/>' +
      '<rect x="35" y="10" width="8" height="14" rx="4" transform="rotate(14 39 17)"/></g>' +
      '<g stroke="#3f5c38" stroke-width="1.6" stroke-linecap="round"><path d="M25 30v.1M31 26v.1M28 34v.1"/></g>',
    calathea:
      '<g fill="none" stroke="#3f5c38" stroke-width="2.2" stroke-linecap="round">' +
      '<path d="M28 42C27 32 24 26 18 22"/><path d="M28 42c1-11 5-18 12-21"/><path d="M28 42V20"/></g>' +
      '<g><ellipse cx="17" cy="20" rx="5" ry="7" fill="#7fa168" transform="rotate(-22 17 20)"/>' +
      '<ellipse cx="41" cy="19" rx="5" ry="7" fill="#a9c393" transform="rotate(24 41 19)"/>' +
      '<ellipse cx="28" cy="16" rx="5.4" ry="7.6" fill="#7fa168"/>' +
      '<g stroke="#3f5c38" stroke-width="1.3" fill="none" opacity="0.75">' +
      '<path d="M25 12l6 0M24.4 16l7.2 0M25 20l6 0"/></g></g>'
  };
  return '<svg viewBox="0 0 56 60" aria-hidden="true">' + (art[id] || art.fern) + pot + "</svg>";
}

/* ---------- render: queue ---------- */

function sortedPlants() {
  const rank = { todo: 0, snoozed: 1, done: 2 };
  return [...state].sort((a, b) =>
    rank[a.status] - rank[b.status] || b.urgency - a.urgency);
}

function render() {
  const remaining = state.filter((p) => p.status === "todo").length;
  const total = state.length;
  countEl.textContent = remaining === 0
    ? "all clear"
    : remaining + " of " + total + " still need" + (remaining === 1 ? "s" : "") + " you";
  const expandedIds = new Set(
    [...document.querySelectorAll('.expand-btn[aria-expanded="true"]')].map((b) => b.dataset.plant)
  );

  queueEl.innerHTML = "";

  for (const plant of sortedPlants()) {
    queueEl.appendChild(buildCard(plant, expandedIds.has(plant.id)));
  }

  const finished = state.every((p) => p.status !== "todo");
  allDoneEl.hidden = !finished;
  queueEl.hidden = finished;
  document.querySelector(".queue-head").style.visibility = finished ? "hidden" : "visible";

  updateMood();
}

function buildCard(plant, expanded) {
  const li = document.createElement("li");
  li.className = "card";
  li.dataset.plant = plant.id;
  li.style.position = "relative";
  li.style.animationDelay = "60ms";
  if (plant.status === "todo" && plant.urgency >= 3) li.classList.add("is-overdue");
  if (plant.status === "done") li.classList.add("is-done");
  if (plant.status === "snoozed") li.classList.add("is-snoozed");

  const detailId = "detail-" + plant.id;
  const overdue = plant.status === "todo" && plant.urgency >= 3;

  li.innerHTML =
    '<div class="card-main">' +
      '<div class="plant-portrait">' + portrait(plant.id) + "</div>" +
      "<div>" +
        '<h3 class="plant-name">' + plant.name + "</h3>" +
        '<p class="plant-meta">' + plant.species + " · " + plant.location + "</p>" +
        '<div class="chips">' +
          '<span class="chip chip-task">' + plant.task + "</span>" +
          (overdue ? '<span class="chip chip-overdue">' + plant.due + "</span>"
                   : '<span class="chip">' + plant.due + "</span>") +
          (plant.status === "done" ? '<span class="chip chip-done">' + plant.doneLabel + " ✓</span>" : "") +
          (plant.status === "snoozed" ? '<span class="chip chip-snooze">Snoozed to tomorrow</span>' : "") +
        "</div>" +
      "</div>" +
      '<button type="button" class="expand-btn" data-plant="' + plant.id + '"' +
        ' aria-expanded="' + (expanded ? "true" : "false") + '" aria-controls="' + detailId + '"' +
        ' aria-label="' + (expanded ? "Hide" : "Show") + " details for " + plant.name + '">' +
        '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button>" +
    "</div>" +
    '<div class="card-detail' + (expanded ? " open" : "") + '" id="' + detailId + '"' + (expanded ? "" : " hidden") + '>' +
      '<div class="detail-inner"><div class="detail-grid">' +
        '<dl class="fact"><dt>Light</dt><dd>' + plant.light + "</dd></dl>" +
        '<dl class="fact"><dt>Care up next</dt><dd>' + plant.task + " — " + plant.due + "</dd></dl>" +
        '<div class="history"><h4>Observations</h4><ul>' +
          plant.history.map((h, i) => '<li' + (i === 0 && plant._fresh ? ' class="fresh"' : "") + ">" + h + "</li>").join("") +
        "</ul></div>" +
      "</div></div>" +
    "</div>" +
    (plant.status === "todo"
      ? '<div class="card-actions">' +
          '<button type="button" class="btn btn-done" data-act="done">' +
            (plant.task === "Water" ? "Watered" : "Mark “" + plant.task + "” done") + "</button>" +
          '<button type="button" class="btn btn-snooze" data-act="snooze">Snooze till tomorrow</button>' +
        "</div>"
      : '<p class="card-status-note">' +
          (plant.status === "done"
            ? "Tended to today. " + plant.name + " appreciates you."
            : "Resting until tomorrow — no guilt, plants are patient.") +
        "</p>");

  // wire events
  const expandBtn = li.querySelector(".expand-btn");
  expandBtn.addEventListener("click", () => toggleDetail(li, expandBtn));

  const doneBtn = li.querySelector('[data-act="done"]');
  if (doneBtn) doneBtn.addEventListener("click", () => completePlant(plant.id, li));

  const snoozeBtn = li.querySelector('[data-act="snooze"]');
  if (snoozeBtn) snoozeBtn.addEventListener("click", () => snoozePlant(plant.id));

  return li;
}

function toggleDetail(cardEl, btn) {
  const detail = cardEl.querySelector(".card-detail");
  const opening = detail.hasAttribute("hidden");
  const name = cardEl.querySelector(".plant-name").textContent;

  if (opening) {
    detail.removeAttribute("hidden");
    requestAnimationFrame(() => detail.classList.add("open"));
  } else {
    detail.classList.remove("open");
    if (REDUCED_MOTION) detail.setAttribute("hidden", "");
    else detail.addEventListener("transitionend", () => detail.setAttribute("hidden", ""), { once: true });
  }
  btn.setAttribute("aria-expanded", String(opening));
  btn.setAttribute("aria-label", (opening ? "Hide" : "Show") + " details for " + name);
}

/* ---------- actions ---------- */

function snapshot(plant) {
  return { id: plant.id, status: plant.status, due: plant.due, urgency: plant.urgency };
}

function completePlant(id, cardEl) {
  const plant = state.find((p) => p.id === id);
  lastAction = snapshot(plant);
  plant.status = "done";
  plant.urgency = 0;
  plant._fresh = true;
  plant.history.unshift("Today · " + plant.doneLabel);

  if (!REDUCED_MOTION && cardEl) leafConfetti(cardEl);
  render();
  showToast(plant.name + " is " + plant.doneLabel.toLowerCase() + ". Lovely work.");
}

function snoozePlant(id) {
  const plant = state.find((p) => p.id === id);
  lastAction = snapshot(plant);
  plant.status = "snoozed";
  plant.due = "Tomorrow";
  plant.urgency = 0;
  plant._fresh = true;
  plant.history.unshift("Today · Snoozed");

  render();
  showToast(plant.name + " will remind you tomorrow.");
}

function undoLast() {
  if (!lastAction) return;
  const plant = state.find((p) => p.id === lastAction.id);
  if (plant) {
    plant.status = lastAction.status;
    plant.due = lastAction.due;
    plant.urgency = lastAction.urgency;
    if (plant._fresh) { plant.history.shift(); plant._fresh = false; }
  }
  lastAction = null;
  hideToast();
  render();
  const card = queueEl.querySelector('[data-plant="' + plant.id + '"]');
  const btn = card && card.querySelector('[data-act="done"]');
  if (btn) btn.focus();
}

/* ---------- toast ---------- */

function showToast(msg) {
  clearTimeout(toastTimer);
  toastMsg.textContent = msg;
  toastEl.hidden = false;
  toastUndo.focus();
  toastTimer = setTimeout(() => { lastAction = null; hideToast(); }, TOAST_MS);
}

function hideToast() {
  clearTimeout(toastTimer);
  toastEl.hidden = true;
}

toastUndo.addEventListener("click", undoLast);
toastEl.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { lastAction = null; hideToast(); }
});

/* ---------- leaf confetti ---------- */

function leafConfetti(cardEl) {
  for (let i = 0; i < 7; i++) {
    const bit = document.createElement("span");
    bit.className = "leaf-bit";
    bit.style.left = 18 + Math.random() * 60 + "%";
    bit.style.top = "30%";
    bit.style.setProperty("--dx", (Math.random() * 90 - 45) + "px");
    bit.style.setProperty("--dy", -(30 + Math.random() * 60) + "px");
    bit.style.setProperty("--rot", (Math.random() * 260 - 130) + "deg");
    if (Math.random() > 0.5) bit.style.background = "var(--mustard)";
    cardEl.appendChild(bit);
    bit.addEventListener("animationend", () => bit.remove());
  }
}

/* ---------- weekly rhythm ---------- */

function renderWeek() {
  const chart = document.getElementById("week-chart");
  const week = PLANT_DATA.week;
  const max = Math.max(...week);
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon = 0
  const total = week.reduce((a, b) => a + b, 0);

  chart.setAttribute("aria-label",
    "Care tasks across the week: " +
    week.map((n, i) => DAY_NAMES[i] + " " + n + (n === 1 ? " task" : " tasks")).join(", ") + ".");

  chart.innerHTML = week.map((n, i) => {
    const h = Math.round((n / max) * 100);
    const today = i === todayIdx ? " today" : "";
    return '<div class="day' + today + '">' +
      '<div class="day-bar-track"><div class="day-bar" style="height:' + h + '%"></div></div>' +
      '<span class="day-label">' + DAY_NAMES[i][0] + "</span>" +
      '<span class="day-count" aria-hidden="true">' + n + "</span>" +
    "</div>";
  }).join("");

  document.getElementById("week-note").textContent =
    total + " little tasks this week — busiest on " + DAY_NAMES[week.indexOf(max)] + ".";
}

/* ---------- mood / whisper ---------- */

function updateMood() {
  const overdueLeft = state.filter((p) => p.status === "todo" && p.urgency >= 3);
  const left = state.filter((p) => p.status === "todo");
  let text;
  if (left.length === 0) {
    text = "The windowsill is humming quietly. Nothing needs you — go watch the clouds.";
  } else if (overdueLeft.length > 0) {
    text = overdueLeft[0].name + " has been waiting patiently. Fronds first, then tea.";
  } else if (left.length === 1) {
    text = "Just " + left[0].name + " left on the list. Nearly a holiday.";
  } else {
    text = left.length + " small kindnesses between you and a happy windowsill.";
  }
  moodEl.textContent = text;
}

/* ---------- misc ---------- */

document.getElementById("reset-day").addEventListener("click", () => {
  for (const p of state) {
    const orig = PLANT_DATA.plants.find((o) => o.id === p.id);
    p.status = "todo";
    p.due = orig.due;
    p.urgency = orig.urgency;
    p.history = [...orig.history];
    p._fresh = false;
  }
  lastAction = null;
  hideToast();
  render();
  document.getElementById("queue-heading").focus?.();
});

document.getElementById("today-label").textContent =
  new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

renderWeek();
render();
