"use strict";
/* Moss — data mirrors PLANTS.json (embedded so the page works from file:// with no network). */
const PLANTS = [
  { id:"fern", name:"Frida", species:"Boston fern", location:"Bathroom", task:"Water", doneLabel:"Watered",
    due:"2 days overdue", urgency:4, light:"Low, indirect",
    water:"Keep evenly moist. Water when the surface is just dry to the touch; bathroom humidity does the rest.",
    next:"Water again in about 3 days; mist between waterings.",
    thanks:"Frida unclenches. Bathroom fern, restored.",
    history:["Sep 19 · Misted","Sep 16 · Watered","Sep 12 · New frond"] },
  { id:"pothos", name:"Orbit", species:"Golden pothos", location:"Bookshelf", task:"Rotate", doneLabel:"Rotated",
    due:"Today", urgency:2, light:"Medium, indirect",
    water:"Water when the top 3 cm of soil is dry. Today's job is a quarter-turn so all sides get the bookshelf light.",
    next:"Rotate again in a week; check water in 2–3 days.",
    thanks:"Orbit gets a new view of the room. Thrilling, for a pothos.",
    history:["Sep 20 · Watered","Sep 14 · Rotated","Sep 10 · Wiped leaves"] },
  { id:"cactus", name:"Dot", species:"Bunny ears cactus", location:"South window", task:"Check soil", doneLabel:"Checked",
    due:"Today", urgency:1, light:"Bright, direct",
    water:"Soak rarely, only when the soil is completely dry all the way down. If in doubt, don't — Dot prefers a drought to a flood.",
    next:"Check again in a week. No water today unless bone dry.",
    thanks:"Dot remains Dot. Stoic. Slightly rounder.",
    history:["Sep 08 · Watered","Sep 01 · New pad noted","Aug 22 · Rotated"] },
  { id:"calathea", name:"Drama", species:"Calathea orbifolia", location:"Bedroom", task:"Mist", doneLabel:"Misted",
    due:"Tomorrow", urgency:0, light:"Medium, filtered",
    water:"Keep lightly moist, ideally with filtered water. Mist in the morning so leaves dry by evening.",
    next:"Mist tomorrow morning; water check in 2 days.",
    thanks:"Drama accepts the mist. No notes. A miracle.",
    history:["Sep 21 · Misted","Sep 18 · Watered","Sep 15 · Brown edge noted"] }
];
const WEEK = [1, 3, 2, 4, 2, 1, 3];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY_INDEX = 4; // Friday in this week's rhythm

const SVG = {
  fern: '<svg viewBox="0 0 64 64" width="52" height="52" aria-hidden="true" focusable="false"><path d="M32 56V22M32 34C22 32 14 24 12 12c12 1 19 9 20 22ZM32 28c0-11 7-18 18-20 0 12-6 19-18 20ZM32 44c-8-1-14-6-16-14 9 1 15 6 16 14Z" fill="#2e4a34"/><path d="M20 56h24" stroke="#c96f4a" stroke-width="5" stroke-linecap="round"/></svg>',
  pothos: '<svg viewBox="0 0 64 64" width="52" height="52" aria-hidden="true" focusable="false"><path d="M32 8c-2 16 12 18 8 30M32 8c2 14-12 16-9 28" stroke="#2e4a34" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M40 22c6-1 10 2 11 8-6 1-10-2-11-8ZM23 30c-6 0-9 3-10 8 6 1 9-2 10-8ZM37 40c5 1 8 4 8 9-5 0-8-3-8-9Z" fill="#5a8a5e"/><circle cx="32" cy="8" r="4" fill="#e9b949"/></svg>',
  cactus: '<svg viewBox="0 0 64 64" width="52" height="52" aria-hidden="true" focusable="false"><ellipse cx="32" cy="38" rx="11" ry="17" fill="#5a8a5e"/><ellipse cx="19" cy="24" rx="7" ry="10" fill="#2e4a34"/><ellipse cx="45" cy="24" rx="7" ry="10" fill="#2e4a34"/><circle cx="29" cy="32" r="1.6" fill="#f2e8d5"/><circle cx="36" cy="42" r="1.6" fill="#f2e8d5"/><circle cx="31" cy="48" r="1.6" fill="#f2e8d5"/><path d="M20 56h24" stroke="#c96f4a" stroke-width="5" stroke-linecap="round"/></svg>',
  calathea: '<svg viewBox="0 0 64 64" width="52" height="52" aria-hidden="true" focusable="false"><ellipse cx="32" cy="30" rx="16" ry="20" fill="#2e4a34"/><path d="M32 12v36M20 22c8 3 16 3 24 0M19 36c9 3 17 3 26 0" stroke="#dce8d2" stroke-width="2.5" fill="none"/><path d="M18 56h28" stroke="#c96f4a" stroke-width="5" stroke-linecap="round"/></svg>'
};

const state = new Map(PLANTS.map((p) => [p.id, "pending"]));
const expanded = new Set(["fern"]);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let lastAction = null;
let toastTimer = null;

const $ = (id) => document.getElementById(id);
const queueEl = $("queue"), settledEl = $("settled-list"), toastEl = $("toast");

function dueClass(p) { return p.urgency >= 3 ? "overdue" : p.urgency >= 1 ? "today" : "tomorrow"; }
function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

function plantCard(p) {
  const isOpen = expanded.has(p.id);
  const chip = dueClass(p);
  const hist = p.history.map((h) => "<li>" + esc(h) + "</li>").join("");
  const optional = p.urgency === 0 ? '<p class="plant-task">Due tomorrow — an early mist is welcome, never required.</p>' : "";
  return '<li class="plant plant--' + chip + '" data-id="' + p.id + '">' +
    '<div class="plant-top"><div class="plant-blob blob-' + p.id + '">' + SVG[p.id] + "</div>" +
    '<div><h3 class="plant-name">' + esc(p.name) + '</h3>' +
    '<p class="plant-meta">' + esc(p.species) + " · " + esc(p.location) + "</p>" +
    '<span class="due-chip due-chip--' + chip + '">' + esc(p.due) + "</span></div></div>" +
    '<p class="plant-task">Today: <strong>' + esc(p.task) + "</strong></p>" + optional +
    '<div class="plant-actions">' +
    '<button type="button" class="btn btn--done" data-action="done" data-id="' + p.id + '" aria-label="Mark ' + esc(p.name) + " as " + esc(p.doneLabel.toLowerCase()) + '">' + esc(p.doneLabel) + ' ✓</button>' +
    '<button type="button" class="btn btn--snooze" data-action="snooze" data-id="' + p.id + '" aria-label="Snooze ' + esc(p.name) + ' until tomorrow">Snooze 1 day</button>' +
    '<button type="button" class="btn btn--detail" data-action="detail" data-id="' + p.id + '" aria-expanded="' + isOpen + '" aria-controls="detail-' + p.id + '">' + (isOpen ? "Hide details" : "Details") + "</button>" +
    "</div>" +
    '<div class="plant-detail" id="detail-' + p.id + '"' + (isOpen ? "" : " hidden") + '>' +
    '<div class="detail-grid"><dl>' +
    '<div class="detail-fact"><dt>Light</dt><dd>' + esc(p.light) + "</dd></div>" +
    '<div class="detail-fact"><dt>Where</dt><dd>' + esc(p.location) + "</dd></div>" +
    '<div class="detail-fact"><dt>Next</dt><dd>' + esc(p.next) + "</dd></div></dl>" +
    "<div><h4>Water notes</h4><p>" + esc(p.water) + "</p></div></div>" +
    "<h4>Observation history</h4><ul class=\"history\">" + hist + "</ul>" +
    "</div></li>";
}

function render() {
  const pending = PLANTS.filter((p) => state.get(p.id) === "pending").sort((a, b) => b.urgency - a.urgency);
  queueEl.innerHTML = pending.map(plantCard).join("");

  const settled = PLANTS.filter((p) => state.get(p.id) !== "pending");
  settledEl.innerHTML = settled.map((p) => {
    const s = state.get(p.id);
    const label = s === "done" ? p.doneLabel + " today" : "Snoozed → tomorrow";
    return '<li class="settled-item"><p><strong>' + esc(p.name) + '</strong> · ' + esc(p.task) +
      ' <span class="settled-tag' + (s === "snoozed" ? " settled-tag--snoozed" : "") + '">' + esc(label) + "</span></p>" +
      '<button type="button" class="btn btn--undo" data-action="undo" data-id="' + p.id + '" aria-label="Undo for ' + esc(p.name) + '">Undo</button></li>';
  }).join("");
  $("settled-empty").hidden = settled.length > 0;

  const neededToday = PLANTS.filter((p) => p.urgency >= 1);
  const neededLeft = neededToday.filter((p) => state.get(p.id) === "pending");
  const doneCount = settled.length;
  $("progress-fill").style.width = Math.round((doneCount / PLANTS.length) * 100) + "%";

  const overdueLeft = PLANTS.filter((p) => p.urgency >= 3 && state.get(p.id) === "pending").length;
  const sticker = $("overdue-sticker");
  sticker.textContent = overdueLeft ? overdueLeft + " overdue" : "Nothing overdue";
  sticker.classList.toggle("is-clear", overdueLeft === 0);

  const progressText = $("progress-text");
  if (neededLeft.length === 0) {
    progressText.textContent = "All of today's care is settled. " + doneCount + " of " + PLANTS.length + " plants attended to.";
  } else {
    const first = neededLeft.sort((a, b) => b.urgency - a.urgency)[0];
    progressText.textContent = doneCount + " of " + PLANTS.length + " settled today. Next up: " + first.name + " (" + first.task.toLowerCase() + ", " + first.due.toLowerCase() + ").";
  }

  // Tomorrow list = plants due tomorrow + anything snoozed
  const tomorrowItems = PLANTS.filter((p) => (p.urgency === 0 && state.get(p.id) === "pending") || state.get(p.id) === "snoozed");
  $("tomorrow-list").innerHTML = tomorrowItems.length
    ? tomorrowItems.map((p) => "<li><strong>" + esc(p.name) + "</strong> (" + esc(p.species) + ") · " + esc(p.task) + " · " + esc(p.location) + (state.get(p.id) === "snoozed" ? " · snoozed from today" : "") + "</li>").join("")
    : "<li>Nothing queued — a rare, quiet tomorrow.</li>";

  // All-done state: nothing due today/overdue remains
  const allDone = neededLeft.length === 0;
  const panel = $("all-done");
  panel.hidden = !allDone;
  if (allDone) {
    const stillTomorrow = PLANTS.filter((p) => p.urgency === 0 && state.get(p.id) === "pending");
    $("all-done-copy").textContent = "Nothing else needs you today. Kettle on. Plants: quietly photosynthesising.";
    $("all-done-next").textContent = stillTomorrow.length
      ? "Tomorrow: " + stillTomorrow.map((p) => p.name + " (" + p.task.toLowerCase() + ")").join(", ") + (settled.some((p) => state.get(p.id) === "snoozed") ? ", plus anything snoozed above." : ".")
      : "Even tomorrow's early bird is done. Check the weekly rhythm — Thursday is usually your busiest day.";
  }
}

function announce(msg) { $("live-region").textContent = msg; }

function burst(card) {
  if (reducedMotion.matches || !card) return;
  for (let i = 0; i < 7; i++) {
    const s = document.createElement("span");
    s.className = "burst"; s.setAttribute("aria-hidden", "true");
    s.style.left = "55%"; s.style.top = "38%";
    s.style.setProperty("--dx", (Math.random() * 120 - 60) + "px");
    s.style.setProperty("--dy", (-20 - Math.random() * 70) + "px");
    s.style.background = ["#5a8a5e", "#e9b949", "#c96f4a"][i % 3];
    card.appendChild(s);
    setTimeout(() => s.remove(), 750);
  }
}

function showToast(msg) {
  $("toast-msg").textContent = msg;
  toastEl.hidden = false;
  announce(msg + " Undo available.");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 8000);
  $("toast-undo").focus();
}
function hideToast() { toastEl.hidden = true; clearTimeout(toastTimer); }

function act(id, kind, sourceBtn) {
  const p = PLANTS.find((x) => x.id === id);
  if (!p) return;
  if (kind === "detail") {
    expanded.has(id) ? expanded.delete(id) : expanded.add(id);
    render();
    const btn = queueEl.querySelector('[data-action="detail"][data-id="' + id + '"]');
    if (btn) btn.focus();
    return;
  }
  const prev = state.get(id);
  if (kind === "undo") {
    state.set(id, "pending"); lastAction = null; hideToast(); render();
    announce(p.name + " is back in today's queue.");
    const card = queueEl.querySelector('[data-id="' + id + '"] .btn--done');
    if (card) card.focus();
    return;
  }
  const cardEl = sourceBtn ? sourceBtn.closest(".plant") : null;
  if (kind === "done") burst(cardEl);
  lastAction = { id, prev };
  state.set(id, kind === "done" ? "done" : "snoozed");
  render();
  showToast(kind === "done" ? p.thanks : p.name + " snoozed until tomorrow. No guilt — plants respect a rain check.");
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (btn) act(btn.dataset.id, btn.dataset.action, btn);
});
$("toast-undo").addEventListener("click", () => { if (lastAction) act(lastAction.id, "undo"); });
$("toast-dismiss").addEventListener("click", hideToast);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideToast(); });

function renderRhythm() {
  const max = Math.max.apply(null, WEEK);
  const items = WEEK.map((v, i) =>
    '<li class="' + (i === TODAY_INDEX ? "is-today" : "") + '">' +
    '<span class="rhythm-bar" style="height:' + Math.round(26 + (v / max) * 62) + 'px">' + v + "</span>" +
    '<span class="rhythm-day">' + DAYS[i] + (i === TODAY_INDEX ? '<span class="visually-hidden"> (today)</span>' : "") + "</span></li>"
  ).join("");
  $("rhythm-chart").innerHTML =
    '<ul class="rhythm-bars" role="img" aria-label="Bar chart of care moments per day, Monday to Sunday: ' +
    WEEK.map((v, i) => DAYS[i] + " " + v).join(", ") + '. Friday is today.">' + items + "</ul>";
}

$("today-label").textContent = "Friday · Sep 22";
renderRhythm();
render();
