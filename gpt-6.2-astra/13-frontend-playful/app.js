// Inlined so the garden also opens from file:// without a request for PLANTS.json.
const garden = {
  plants: [
    { id: "fern", name: "Frida", species: "Boston fern", location: "Bathroom", task: "Water", due: "2 days overdue", urgency: 4, light: "Low, indirect", history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"] },
    { id: "pothos", name: "Orbit", species: "Golden pothos", location: "Bookshelf", task: "Rotate", due: "Today", urgency: 2, light: "Medium, indirect", history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"] },
    { id: "cactus", name: "Dot", species: "Bunny ears cactus", location: "South window", task: "Check soil", due: "Today", urgency: 1, light: "Bright, direct", history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"] },
    { id: "calathea", name: "Drama", species: "Calathea orbifolia", location: "Bedroom", task: "Mist", due: "Tomorrow", urgency: 0, light: "Medium, filtered", history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"] }
  ],
  week: [1, 3, 2, 4, 2, 1, 3]
};

const taskTypes = {
  Water: { icon: "drop", done: "Watered" },
  Rotate: { icon: "rotate", done: "Rotated" },
  "Check soil": { icon: "soil", done: "Soil checked" },
  Mist: { icon: "mist", done: "Misted" }
};
const waterCare = {
  fern: "Keep the soil lightly moist.",
  pothos: "Let the top layer of soil dry between drinks.",
  cactus: "Let the soil dry fully before watering.",
  calathea: "Keep the soil evenly moist and let excess water drain."
};
const $ = id => document.getElementById(id);
const icon = name => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const fullDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });
const DAY = 86400000;
// Calendar-day arithmetic stays correct over daylight-saving transitions.
function dayNumber(date = new Date()) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY;
}
function dateForDay(day) {
  const utc = new Date(day * DAY);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

function frond(x0, y0, xm, ym, x1, y1, color) {
  let leaves = '';
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    const u = 1 - t;
    const x = u*u*x0 + 2*u*t*xm + t*t*x1;
    const y = u*u*y0 + 2*u*t*ym + t*t*y1;
    const dx = u*(xm-x0) + t*(x1-xm);
    const dy = u*(ym-y0) + t*(y1-ym);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const size = (Math.sin(t * Math.PI) * 0.84 + 0.32).toFixed(2);
    leaves += '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + angle.toFixed(1) + ') scale(' + size + ')" fill="' + color + '" stroke-width=".6"><path d="M0 0Q0-5 5.8-8.5Q5-2 0 0ZM0 0Q.6 5.8 6 8.2Q4.5 1 0 0Z"/></g>';
  }
  return '<path d="M' + x0 + ' ' + y0 + 'Q' + xm + ' ' + ym + ' ' + x1 + ' ' + y1 + '" fill="none" stroke-width="1.6"/>' + leaves;
}
function pot(fill, shade) {
  return '<path d="M32 63q16 3 36 0l-5.5 23q-12 5-25 0Z" fill="' + fill + '"/><path d="m34 66 5 19q2 2 5 2l-3-21" stroke="none" fill="' + shade + '"/><path d="M31 61q18 3 38-.7l-.8 6q-18 3.5-36 .4Z" fill="' + fill + '"/><path d="m62 72-2 10m-22-12 1.2 5" fill="none" stroke-width=".9"/>';
}
function pothosLeaf(x, y, angle, scale) {
  return '<g transform="translate(' + x + ' ' + y + ') rotate(' + angle + ') scale(' + scale + ')"><path d="M0 0C-10-8-16 3-10 10-7 14-3 17 0 21 2 16 13 10 12 3 11-3 5-6 0 0Z" fill="#779458"/><path d="M0 1q-7 3-7 10 6-2 7-10Zm2 1q2 7 7 4Q9 0 2 2Z" fill="#c3c67a" stroke="none"/><path d="M0 2q-1 8 0 15" fill="none" stroke-width=".8"/></g>';
}
const fern = [
  frond(50,64,32,24,16,40,"#829a5f"),
  frond(50,63,69,18,86,37,"#758d57"),
  frond(48,64,40,29,25,17,"#829a5f"),
  frond(51,63,53,26,66,13,"#738951"),
  frond(51,62,40,27,46,9,"#91a66a"),
  frond(48,63,28,32,12,54,"#7c9359"),
  frond(50,63,71,31,88,52,"#8fa364")
].join("") + pot("#c98964","#b77858");
const pothos = '<path d="M48 64Q29 39 33 26m18 36q-1-36 16-38m-18 36Q37 25 46 17m5 42q13-25 25-16m-23 8q19-16 23 13t9 15" fill="none" stroke-width="2.3"/>' +
  pothosLeaf(34,29,49,.86) + pothosLeaf(46,19,-140,.79) + pothosLeaf(62,27,-131,.79) + pothosLeaf(44,37,-40,.82) + pothosLeaf(62,38,-42,.9) + pothosLeaf(34,43,36,.77) +
  pot("#ddb36c","#c99858") + '<path d="M53 57q17-23 21 2t9 23" fill="none" stroke-width="1.8"/>' + pothosLeaf(73,56,-41,.64) + pothosLeaf(76,68,33,.55) + pothosLeaf(81,77,-48,.45);
function pad(x,y,angle,rx,ry) {
  let dots = "";
  for (let row = -2; row <= 2; row++) {
    for (let col = -1; col <= 1; col++) {
      const px = col*rx*.52 + (Math.abs(row)%2)*1.2;
      const py = row*ry*.34;
      dots += '<path d="m' + px + ' ' + py + ' -1.4-1.2m1.4 1.2.9-1.6" stroke="#e8d7a4" stroke-width="1.15"/>';
    }
  }
  return '<g transform="translate(' + x + ' ' + y + ') rotate(' + angle + ')"><ellipse rx="' + rx + '" ry="' + ry + '" fill="#90a170"/>' + dots + '</g>';
}
const cactus = pad(32,32,-25,7.4,14) + pad(65,23,15,7.5,16) + pad(61,42,24,10.5,17) + pad(48,53,-14,13,20) + pot("#dba980","#bf8a63");
function stripedLeaf(x,y,a,s) {
  return '<g transform="translate(' + x + ' ' + y + ') rotate(' + a + ') scale(' + s + ')"><path d="M0 0C-16-5-17-22-3-34 11-29 17-10 0 0Z" fill="#94a67a"/><path d="M-1-4q-8-5-10-14 7 4 10 14Zm-.2-10q-6-5-7-13 6 3 7 13Zm1.5 7q8-8 9-15-7 4-9 15ZM0-19q4-4 4-10-5 5-4 10Z" fill="#5c7b55" stroke="none"/><path d="M0-1q1-16-3-32" fill="none" stroke-width="1"/></g>';
}
const calathea = '<path d="M49 65 36 40m13 20 4-31m-2 34q8-18 16-22m-19 22-12-6" fill="none" stroke-width="1.9"/>' + stripedLeaf(39,47,-43,.91) + stripedLeaf(53,37,12,.83) + stripedLeaf(57,54,54,.93) + stripedLeaf(45,59,-63,.81) + stripedLeaf(50,53,-4,.7) + pot("#bd9384","#a67e71");
const plantArt = { fern, pothos, cactus, calathea };
const swatches = { fern: "#e8dcc4", pothos: "#e9ebcf", cactus: "#eee2c8", calathea: "#e5dfde" };
function portrait(id) {
  return '<svg class="plant-art" viewBox="0 0 100 100" aria-hidden="true"><path d="M11 63C2 44 12 20 32 15 50 7 66 13 79 25c15 14 18 35 10 50-10 16-32 20-49 16C25 88 15 79 11 63Z" fill="' + swatches[id] + '"/><path d="M23 89q24 4 54-1" fill="none" stroke="#778065" stroke-width="1" opacity=".6"/><g stroke="#40533a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + plantArt[id] + '</g></svg>';
}

const storageKey = "moss-garden-v1";
function loadJournal() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Number.isInteger(saved.start) && saved.entries && typeof saved.entries === "object") return saved;
  } catch { /* The garden also works with storage disabled. */ }
  return { start: dayNumber(), entries: {} };
}
let journal = loadJournal();
function saveJournal() {
  try { localStorage.setItem(storageKey, JSON.stringify(journal)); } catch { /* Keep the current session usable. */ }
}
saveJournal();
const entryFor = plant => journal.entries[plant.id] || {};
function dueDay(plant) {
  return entryFor(plant).due ?? journal.start + ({ fern: -2, pothos: 0, cactus: 0, calathea: 1 })[plant.id];
}
function dueInfo(plant) {
  if (entryFor(plant).done) return { text: taskTypes[plant.task].done, style: "", icon: "check" };
  const diff = dueDay(plant) - dayNumber();
  if (diff < 0) return { text: Math.abs(diff) + (diff === -1 ? " day overdue" : " days overdue"), style: "overdue", icon: "clock" };
  if (diff === 0) return { text: "Today", style: "", icon: "" };
  const when = diff === 1 ? "Tomorrow" : shortDate.format(dateForDay(dueDay(plant)));
  return { text: (entryFor(plant).snoozed ? "Snoozed · " : "") + when, style: "future", icon: "" };
}
function badge(plant) {
  const due = dueInfo(plant);
  return '<span class="badge ' + due.style + '">' + (due.icon ? icon(due.icon) : "") + escapeHTML(due.text) + '</span>';
}
function actionButton(plant, type, label, glyph, primary = false) {
  return '<button class="action' + (primary ? ' primary' : '') + '" data-action="' + type + '" data-id="' + plant.id + '" aria-label="' + label + ', ' + plant.name + '">' + icon(glyph) + label + '</button>';
}
function row(plant, isDue) {
  const task = taskTypes[plant.task];
  const overdue = dueInfo(plant).style === "overdue";
  const detailAttrs = 'data-action="details" data-id="' + plant.id + '" aria-haspopup="dialog"';
  const snooze = '<button class="snooze-btn" data-action="snooze" data-id="' + plant.id + '" aria-label="Snooze ' + plant.name + ' until tomorrow" title="Snooze until tomorrow">' + icon("snooze") + '<span>Snooze</span></button>';
  const actions = isDue ? actionButton(plant,"complete",task.done,task.icon,overdue) + snooze :
    '<button class="task-link" ' + detailAttrs + ' aria-label="View ' + plant.name + ' details">' + (entryFor(plant).done ? '' : icon(task.icon) + plant.task) + icon("right") + '</button>';
  return '<li class="plant-row' + (overdue ? ' urgent' : '') + '"><button class="plant-link" ' + detailAttrs + ' aria-label="View ' + plant.name + ', ' + plant.species + ', ' + plant.location + ', ' + dueInfo(plant).text + '">' + portrait(plant.id) +
    '<span class="plant-info"><span class="plant-top"><span class="plant-name">' + plant.name + '</span>' + badge(plant) + '</span><span class="plant-meta">' + plant.species + '<span class="sep">·</span>' + plant.location + '</span></span></button><div class="row-actions">' + actions + '</div></li>';
}
function renderQueue() {
  const today = dayNumber();
  const ordered = [...garden.plants].sort((a,b) => dueDay(a) - dueDay(b) || b.urgency - a.urgency);
  const pending = ordered.filter(p => !entryFor(p).done);
  const due = pending.filter(p => dueDay(p) <= today);
  const later = pending.filter(p => dueDay(p) > today);
  const done = ordered.filter(p => entryFor(p).done);
  $("today-date").textContent = fullDate.format(new Date());
  $("today-date").dateTime = dateForDay(today).toLocaleDateString("sv-SE");
  $("queue-count").textContent = due.length + " due today";
  const numbers = ["No", "One", "Two", "Three", "Four"];
  $("hero-summary").textContent = due.length ? numbers[due.length] + (due.length === 1 ? " plant could" : " plants could") + " use a little care today." : "Your care queue is clear for today.";
  let html = due.length ? '<ul class="plant-list">' + due.map(p => row(p,true)).join("") + '</ul>' :
    '<div class="all-done"><svg aria-hidden="true"><use href="#i-sprout"/></svg><div><h3>All set for today.</h3><p>' + (later.length ? 'Next up: ' + later[0].task.toLowerCase() + ' for ' + later[0].name + ' ' + (dueDay(later[0]) === today+1 ? 'tomorrow' : 'on ' + shortDate.format(dateForDay(dueDay(later[0])))) + '.' : 'Your care journal is up to date. Visit a plant to see its history.') + '</p></div></div>';
  if (later.length) html += '<h3 class="subhead">Coming up</h3><ul class="plant-list later">' + later.map(p => row(p,false)).join("") + '</ul>';
  if (done.length) html += '<h3 class="subhead">Care completed</h3><ul class="plant-list finished">' + done.map(p => row(p,false)).join("") + '</ul>';
  $("queue-content").innerHTML = html;
}
function renderShelf() {
  $("plant-grid").innerHTML = garden.plants.map(p => '<button class="shelf-card" aria-haspopup="dialog" data-action="details" data-id="' + p.id + '">' + portrait(p.id) + '<span class="plant-name">' + p.name + '</span><span class="plant-meta">' + p.species + ' · ' + p.location + '</span>' + badge(p) + '</button>').join("");
}
function renderWeek() {
  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const current = (new Date().getDay()+6)%7;
  $("week-chart").innerHTML = '<ul class="week-bars" aria-label="Weekly care rhythm">' + garden.week.map((count,i) => '<li' + (i === current ? ' class="current" aria-current="date"' : '') + '><span class="sr-only">' + days[i] + ', ' + count + (count === 1 ? ' task' : ' tasks') + '</span><span class="bar-space" aria-hidden="true"><b>' + count + '</b><span class="bar" style="--count:' + count + '"></span></span><span class="day-label" aria-hidden="true">' + days[i].slice(0,3) + '</span></li>').join("") + '</ul>';
}
const fieldNotes = garden.plants.flatMap(plant =>
  plant.history
    .filter(line => /New frond|New pad noted|Brown edge noted/.test(line))
    .map(line => ({ plant: plant.name, parts: line.split(" · ") }))
);
let noteIndex = 0;
function renderNote() {
  const note = fieldNotes[noteIndex];
  $("note-content").innerHTML = '<p class="note-title">“' + note.parts[1] + '”</p><p class="note-source">' + note.plant + ' · ' + note.parts[0] + '</p>';
}
function changeNote(offset) {
  noteIndex = (noteIndex + offset + fieldNotes.length) % fieldNotes.length;
  renderNote();
}
$("prev-note").addEventListener("click", () => changeNote(-1));
$("next-note").addEventListener("click", () => changeNote(1));

function render() {
  renderQueue();
  renderShelf();
  renderWeek();
}
function route() {
  const shelf = location.hash === "#plants";
  $("plants-view").hidden = !shelf;
  $("today-view").hidden = shelf;
  $("nav-plants").removeAttribute("aria-current");
  $("nav-today").removeAttribute("aria-current");
  $(shelf ? "nav-plants" : "nav-today").setAttribute("aria-current","page");
  document.title = (shelf ? "My plants" : "Today") + " · Moss";
}
window.addEventListener("hashchange", route);
document.querySelector(".skip").addEventListener("click", event => {
  event.preventDefault();
  $("main").focus();
});
let detailOpener;
const detail = $("detail");
function setDetail(plant) {
  const entry = entryFor(plant);
  const task = taskTypes[plant.task];
  const history = [
    ...(entry.log || []).map(event => [shortDate.format(dateForDay(event.day)),event.label]),
    ...plant.history.map(line => line.split(" · "))
  ];
  const lastWatered = history.find(item => item[1] === "Watered");
  const waterLogged = (entry.log || []).some(event => event.day === dayNumber() && event.label === "Watered");
  let controls = entry.done ? '' : actionButton(plant, "complete", task.done, task.icon, true);
  if (!entry.done && dueDay(plant) <= dayNumber()) controls += actionButton(plant,"snooze","Snooze","snooze");
  if (plant.task !== "Water" && !waterLogged) controls += actionButton(plant,"water","Watered","drop");
  $("detail-content").innerHTML = '<div class="detail-head">' + portrait(plant.id) + '<div><h2 id="detail-name">' + plant.name + '</h2><p>' + plant.species + '</p><p>' + icon("location") + ' ' + plant.location + '</p></div><button autofocus class="icon-btn dialog-close" data-action="close" aria-label="Close plant details">' + icon("close") + '</button></div><div class="detail-body"><div class="detail-task"><h3>' + plant.task + '</h3>' + badge(plant) + '</div>' +
    (controls ? '<div class="detail-actions">' + controls + '</div>' : '') +
    '<dl class="facts"><div><dt>Light</dt><dd>' + plant.light + '</dd></div><div><dt>Water</dt><dd>' + waterCare[plant.id] + '</dd></div><div><dt>Last watered</dt><dd>' + escapeHTML(lastWatered?.[0] || "No entry yet") + '</dd></div></dl><h3 class="history-title">Observation history</h3><ul class="history">' + history.map(([date,label]) => '<li><time>' + escapeHTML(date) + '</time>' + escapeHTML(label) + '</li>').join("") + '</ul></div>';
}
function openDetail(plant,button) {
  detailOpener = { id: plant.id, shelf: !!button.closest("#plants-view") };
  setDetail(plant);
  detail.showModal();
  detail.querySelector(".dialog-close").focus();
}
function focusPlant(opener) {
  if (!opener) return;
  const root = $(opener.shelf ? "plant-grid" : "queue-content");
  root.querySelector('[data-action="details"][data-id="' + opener.id + '"]')?.focus({ preventScroll: true });
}
detail.addEventListener("close", () => focusPlant(detailOpener));
detail.addEventListener("click", event => {
  if (event.target !== detail) return;
  const rect = detail.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) detail.close();
});

let undoStack = [];
let timer;
let timerStarted = 0;
const undoButton = $("undo");
const toast = $("toast");
function announce(text) { $("announcement").textContent = text; }
function stopTimer() {
  clearTimeout(timer);
  if (timerStarted && undoStack.length) undoStack.at(-1).time -= Date.now() - timerStarted;
  timerStarted = 0;
}
function displayUndo() {
  stopTimer();
  const latest = undoStack.at(-1);
  toast.hidden = !latest;
  if (!latest) return;
  $("toast-text").textContent = latest.message;
  if (toast.matches(":hover") || toast.contains(document.activeElement)) return;
  timerStarted = Date.now();
  timer = setTimeout(() => {
    timerStarted = 0;
    undoStack = [];
    toast.hidden = true;
  },Math.max(0,latest.time));
}
toast.addEventListener("pointerenter",stopTimer);
toast.addEventListener("pointerleave",displayUndo);
toast.addEventListener("focusin",stopTimer);
toast.addEventListener("focusout",() => queueMicrotask(displayUndo));
function act(plant, action) {
  const current = entryFor(plant);
  const day = dayNumber();
  if (action === "complete" && current.done) return;
  if (action === "snooze" && (current.done || dueDay(plant) > day)) return;
  const next = { ...current, log: [...(current.log || [])] };
  let label, message;
  if (action === "snooze") {
    next.due = day + 1;
    next.snoozed = true;
    label = "Snoozed until " + shortDate.format(dateForDay(day + 1));
    message = plant.name + " snoozed until tomorrow.";
  } else {
    label = action === "water" ? "Watered" : taskTypes[plant.task].done;
    if (action === "complete") next.done = true;
    message = label === "Soil checked" ? "Soil checked for " + plant.name + "." : plant.name + " " + label.toLowerCase() + ".";
  }
  const opener = { id: plant.id, shelf: !$("plants-view").hidden };
  if (detail.open) detail.close();
  next.log.unshift({ day, label });
  journal.entries[plant.id] = next;
  saveJournal();
  render();
  stopTimer();
  undoStack.push({ id: plant.id, previous: current, message, time: 12000 });
  displayUndo();
  announce(message + " Undo available.");
  focusPlant(opener);
}
function undoLastAction() {
  stopTimer();
  const last = undoStack.pop();
  if (!last) return;
  journal.entries[last.id] = last.previous;
  saveJournal();
  render();
  focusPlant({ id: last.id, shelf: !$("plants-view").hidden });
  displayUndo();
  announce("Undone. " + garden.plants.find(p => p.id === last.id).name + " restored.");
}
undoButton.addEventListener("click", undoLastAction);
document.addEventListener("keydown", event => {
  if (!detail.open && undoStack.length && (event.ctrlKey || event.metaKey)
      && !event.shiftKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoLastAction();
  }
});
document.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "close") { detail.close(); return; }
  const plant = garden.plants.find(p => p.id === button.dataset.id);
  if (!plant) return;
  if (action === "details") openDetail(plant,button);
  else act(plant,action);
});
render();
renderNote();
route();
