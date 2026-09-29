"use strict";

// Embedded verbatim from PLANTS.json so index.html also works directly via file://.
// The supplied queue is a September 22 sample; it deliberately doesn't age with the clock.
const DATA = {
  plants: [
    {id: "fern", name: "Frida", species: "Boston fern", location: "Bathroom", task: "Water", due: "2 days overdue", urgency: 4, light: "Low, indirect", history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"]},
    {id: "pothos", name: "Orbit", species: "Golden pothos", location: "Bookshelf", task: "Rotate", due: "Today", urgency: 2, light: "Medium, indirect", history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"]},
    {id: "cactus", name: "Dot", species: "Bunny ears cactus", location: "South window", task: "Check soil", due: "Today", urgency: 1, light: "Bright, direct", history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"]},
    {id: "calathea", name: "Drama", species: "Calathea orbifolia", location: "Bedroom", task: "Mist", due: "Tomorrow", urgency: 0, light: "Medium, filtered", history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"]}
  ],
  week: [1, 3, 2, 4, 2, 1, 3]
};

const TASKS = {
  Water: {done: "Watered", icon: "drop", message: "A drink for Frida.", verb: "watering"},
  Rotate: {done: "Rotated", icon: "rotate", message: "A quarter turn for Orbit.", verb: "rotation"},
  "Check soil": {done: "Checked soil", icon: "soil", message: "See how Dot’s soil feels.", verb: "soil check"},
  Mist: {done: "Misted", icon: "mist", message: "A little mist for Drama.", verb: "misting"}
};
const STORAGE_KEY = "moss-care-v1";
const UNDO_DURATION = 12000;
const plants = [...DATA.plants].sort((a, b) => b.urgency - a.urgency);
const todayPlants = plants.filter(plant => plant.due !== "Tomorrow");
const $ = selector => document.querySelector(selector);
const dialog = $("#plantDialog");
const toast = $("#toast");
const undoButton = $("#undoButton");
let storageAvailable = true;
let state = loadState();
let selectedPlant = null;
let returnFocus = null;
let currentView = "today";
let undoStack = [];
let undoTimer = null;
let pausedAt = null;
let toastHovered = false;
let announcementTimer = null;

function initialState() {
  return Object.fromEntries(plants.map(plant => [plant.id, {status: "pending", history: [...plant.history]}]));
}

function loadState() {
  const initial = initialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    let saved;
    try { saved = JSON.parse(raw); } catch { return initial; }
    if (!saved || saved.version !== 1 || !saved.plants) return initial;
    for (const plant of plants) {
      const item = saved.plants[plant.id];
      if (!item || !["pending", "done", "snoozed"].includes(item.status) || !Array.isArray(item.history)) continue;
      if (!item.history.every(entry => typeof entry === "string" && entry.length < 200)) continue;
      initial[plant.id] = {status: item.status, history: item.history.slice(0, 100)};
    }
  } catch {
    // Private browsing and file:// storage restrictions shouldn't stop tending.
    storageAvailable = false;
  }
  return initial;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({version: 1, plants: state}));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  updateStorageLabel();
}

function updateStorageLabel() {
  $("#saveStatus").textContent = storageAvailable
    ? "Your care, kept on this device."
    : "Care is saved for this visit only.";
  $("#sessionNote").hidden = storageAvailable;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
}

function icon(name) {
  return `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
}

function art(plant, className = "") {
  return `<svg class="${className}" viewBox="0 0 240 250" aria-hidden="true"><use href="#art-${plant.id}"/></svg>`;
}

function artPuck(plant) {
  return `<span class="art-puck ${plant.id}" aria-hidden="true">${art(plant)}</span>`;
}

function detailsLink(plant) {
  return `<button class="details-link" type="button" data-action="details" data-plant="${plant.id}" aria-label="View ${plant.name}’s details">Details ${icon("arrow")}</button>`;
}

function actions(plant) {
  const task = TASKS[plant.task];
  return `<div class="plant-actions">
    <button class="primary-button" type="button" data-action="complete" data-plant="${plant.id}" aria-label="${task.done} — complete ${plant.name}’s ${task.verb}">${icon(task.icon)}${task.done}</button>
    <button class="secondary-button" type="button" data-action="snooze" data-plant="${plant.id}" aria-label="Snooze ${plant.name}’s ${task.verb} until tomorrow" title="Remind me tomorrow">${icon("clock")}Snooze</button>
  </div>`;
}

function pendingToday() {
  return todayPlants.filter(plant => state[plant.id].status === "pending");
}

function completedToday() {
  return todayPlants.filter(plant => state[plant.id].status === "done");
}

function snoozedToday() {
  return todayPlants.filter(plant => state[plant.id].status === "snoozed");
}

function render() {
  const pending = pendingToday();
  const done = completedToday();
  const snoozed = snoozedToday();
  $("#navCount").textContent = pending.length;
  $("#queueCount").textContent = pending.length ? `${pending.length} little ${pending.length === 1 ? "thing" : "things"}` : "Room to relax";
  $("#progressText").textContent = `${done.length} of 3 cared for${snoozed.length ? ` · ${snoozed.length} snoozed` : ""}`;
  $("#progressBar").setAttribute("aria-valuenow", done.length);
  $("#progressBar").setAttribute("aria-valuetext", `${done.length} of 3 cared for${snoozed.length ? `, ${snoozed.length} snoozed until tomorrow` : ""}`);
  $("#progressFill").style.width = `${done.length / 3 * 100}%`;
  $("#intro").textContent = pending.length ? "A sip, a turn, a little attention. You’ve got this." : "Your tending is settled. Take a little breather.";
  $("#todayQueue").innerHTML = pending.length ? pending.map(renderTask).join("") : renderAllDone(done.length, snoozed.length);
  renderCompleted(done);
  renderUpcoming();
  renderCollection();
  renderWeek();
  if (selectedPlant && dialog.open) renderDetail(selectedPlant);
  updateStorageLabel();
}

function renderTask(plant) {
  if (plant.urgency >= 4) {
    return `<article class="urgent-plant" aria-labelledby="task-${plant.id}">
      <div class="urgent-copy"><span class="overdue-label">${icon("clock")}${plant.due}</span>
      <h3 id="task-${plant.id}">${TASKS[plant.task].message}</h3>
      <p class="plant-meta">${plant.species}<br>${plant.location}</p>${detailsLink(plant)}</div>
      ${art(plant, "urgent-art")}${actions(plant)}</article>`;
  }
  return `<article class="task-row" aria-labelledby="task-${plant.id}">${artPuck(plant)}
    <div class="task-content"><div class="task-name"><h3 id="task-${plant.id}">${plant.name}</h3><span class="task-location">· ${plant.location}</span></div>
      <p class="task-description">${TASKS[plant.task].message}</p><p class="plant-meta">${plant.species}</p>
      <div class="row-bottom">${actions(plant)}${detailsLink(plant)}</div></div></article>`;
}

function renderAllDone(done, snoozed) {
  const message = snoozed
    ? `${done ? `${done} ${done === 1 ? "plant" : "plants"} cared for. ` : ""}${snoozed} ${snoozed === 1 ? "reminder is" : "reminders are"} tucked into tomorrow’s list. You can find them just below.`
    : "Your green corner is in good hands. Next up: a little mist for Drama tomorrow.";
  return `<div class="all-done"><svg class="done-illustration" viewBox="0 0 180 165" aria-hidden="true">
    <path d="M25 132V84a65 65 0 0 1 130 0v48Z" fill="#d8dfc5"/><circle cx="132" cy="47" r="15" fill="#f2dfcd"/>
    <path d="M87 136V75" stroke="#426848" stroke-width="3"/>
    <path d="M87 106c-36 2-39-35-39-35s39-2 39 35" fill="#739265"/><path d="M88 84c0-32 31-33 31-33s7 34-31 33" fill="#50774b"/>
    <path d="m65 126 6 27q17 9 35 0l7-27Z" fill="#c87e57"/><rect x="60" y="122" width="58" height="10" rx="4" fill="#dc9870"/>
    <path d="m133 111 7 7 13-15" stroke="#426848" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M23 157h135" stroke="#a6b291" stroke-width="2" stroke-linecap="round"/></svg>
    <h3 id="allDoneHeading" tabindex="-1">${snoozed ? "Nothing more for today." : "A little care. A happy corner."}</h3>
    <p>${message}</p><button class="primary-button" type="button" data-view="plants">Spend a moment with your plants ${icon("arrow")}</button></div>`;
}

function renderCompleted(done) {
  const wasOpen = Boolean($("#completedList")?.open);
  $("#completedSection").innerHTML = done.length ? `<details id="completedList" class="completed-section" ${wasOpen ? "open" : ""}>
    <summary>${icon("check")}${done.length} ${done.length === 1 ? "little thing" : "little things"} cared for</summary>
    ${done.map(plant => `<div class="completed-row"><span>${icon("check")}<span>${plant.name} · ${TASKS[plant.task].done}</span></span>${detailsLink(plant)}</div>`).join("")}</details>` : "";
}

function renderUpcoming() {
  const upcoming = plants.filter(plant => state[plant.id].status === "snoozed" || (plant.due === "Tomorrow" && state[plant.id].status !== "done"));
  $("#upcomingQueue").innerHTML = upcoming.length ? upcoming.map(plant => `<article class="upcoming-row">${artPuck(plant)}
    <div class="upcoming-copy"><h3>${plant.name}</h3><p>${plant.task} · ${plant.location}</p>${state[plant.id].status === "snoozed" ? '<span class="deferred-tag">Snoozed until tomorrow</span>' : ""}</div>${detailsLink(plant)}</article>`).join("")
    : '<p class="supporting-text">Nothing lined up for tomorrow. Enjoy the quiet.</p>';
}

function statusLabel(plant) {
  if (state[plant.id].status === "done") return `${TASKS[plant.task].done} today`;
  if (state[plant.id].status === "snoozed") return `${plant.task} · Snoozed until tomorrow`;
  return `${plant.task} · ${plant.due}`;
}

function renderCollection() {
  $("#plantCollection").innerHTML = plants.map(plant => `<button class="collection-plant" type="button" data-action="details" data-plant="${plant.id}" aria-label="View ${plant.name}, ${plant.species}. ${statusLabel(plant)}">
    <span class="collection-art ${plant.id}">${art(plant)}</span><span class="collection-name">${plant.name}${icon("arrow")}</span>
    <span class="collection-meta">${plant.species} · ${plant.location}</span>
    <span class="collection-status ${plant.urgency >= 4 && state[plant.id].status === "pending" ? "overdue" : ""}">${statusLabel(plant)}</span></button>`).join("");
}

function renderWeek() {
  const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const counts = [...DATA.week];
  counts[1] -= snoozedToday().length;
  counts[2] += plants.filter(plant => state[plant.id].status === "snoozed").length;
  const max = Math.max(...counts, 1);
  $("#weekChart").innerHTML = counts.map((count, day) => {
    const completed = day === 1 ? completedToday().length : 0;
    const description = `${names[day]}${day === 1 ? ", today" : ""}: ${count} planned care ${count === 1 ? "reminder" : "reminders"}${completed ? `, ${completed} completed` : ""}`;
    return `<li class="week-day ${day === 1 ? "is-today" : ""}" aria-label="${description}" title="${description}">
      <span class="week-number" aria-hidden="true">${count}</span><span class="week-bar-space" aria-hidden="true"><span class="week-bar" style="height:${Math.max(count / max * 100, 3)}%">${completed ? `<span class="week-bar-completed" style="height:${completed / count * 100}%"></span>` : ""}</span></span><span class="week-letter" aria-hidden="true">${names[day][0]}</span></li>`;
  }).join("");
}

function renderDetail(plant) {
  const item = state[plant.id];
  const lastWater = item.history.find(entry => entry.endsWith(" · Watered"));
  const lastWaterDate = lastWater ? lastWater.split(" · ")[0] : "No watering recorded";
  const isDueToday = plant.due !== "Tomorrow" && item.status === "pending";
  let reminder;
  if (isDueToday) reminder = `<h3>${plant.task} · ${plant.due}</h3><p>One small moment of care. Snooze moves this reminder to tomorrow’s list.</p>${actions(plant)}`;
  else if (item.status === "done") reminder = `<h3>${icon("check")} ${TASKS[plant.task].done} today</h3><p>Your care is in the history below. Enjoy a little breathing room.</p>`;
  else reminder = `<h3>${plant.task} · Tomorrow</h3><p>${item.status === "snoozed" ? "This reminder is snoozed until tomorrow." : "A little something for tomorrow. Nothing to do right now."}</p>`;

  $("#dialogContent").innerHTML = `<div class="detail-hero ${plant.id}">${art(plant, "detail-art")}<div><span class="eyebrow">Your green companion</span><h2 id="detailName">${plant.name}</h2><p class="plant-meta">${plant.species}<br>${plant.location}</p></div></div>
    <div class="detail-body"><div class="detail-facts"><div><h3 class="fact-title">${icon("sun")}Light</h3><p class="fact-value">${plant.light}</p></div>
      <div><h3 class="fact-title">${icon("drop")}Water</h3><p class="fact-value">Last watered<br><strong>${escapeHTML(lastWaterDate)}</strong></p>
      <button type="button" class="water-log-button" data-action="water" data-plant="${plant.id}" aria-label="Log watering for ${plant.name}">${icon("drop")}Watered</button></div></div>
      <section class="detail-reminder" aria-label="${plant.name}’s care reminder">${reminder}</section>
      <h3 class="history-heading">Life lately</h3><p class="history-intro">Care, observations, and little milestones.</p>
      <ol class="history-list" aria-label="${plant.name}’s care and observation history">${item.history.map(renderHistory).join("")}</ol></div>`;
}

function renderHistory(entry) {
  const [date, ...pieces] = entry.split(" · ");
  const text = pieces.join(" · ") || entry;
  const observation = /new |brown |noted/i.test(text);
  const historyIcon = observation ? "leaf" : /water/i.test(text) ? "drop" : /rotat/i.test(text) ? "rotate" : /soil/i.test(text) ? "soil" : /mist/i.test(text) ? "mist" : /snooz/i.test(text) ? "clock" : "check";
  return `<li><span class="history-icon ${observation ? "history-observation" : ""}">${icon(historyIcon)}</span><div><span class="history-date">${escapeHTML(date)}</span>${escapeHTML(text)}${observation ? '<span class="history-tag">Observation</span>' : ""}</div></li>`;
}

function openDetail(plant) {
  returnFocus = document.activeElement;
  selectedPlant = plant;
  renderDetail(plant);
  // A modal makes the rest of the document inert; keep Undo in its top layer.
  dialog.append(toast);
  dialog.append($("#announcer"));
  dialog.showModal();
  document.body.classList.add("modal-open");
}

function switchView(view, moveFocus = true) {
  if (!["today", "plants"].includes(view)) return;
  currentView = view;
  $("#todayView").hidden = view !== "today";
  $("#plantsView").hidden = view !== "plants";
  document.querySelectorAll(".nav-button").forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  // replaceState doesn't navigate or make a request. File URLs may reject it.
  try { history.replaceState(null, "", `#${view}`); } catch { /* Navigation still works. */ }
  if (moveFocus) {
    $(`#${view}Heading`).focus({preventScroll: true});
    window.scrollTo({top: 0, behavior: "instant"});
  }
}

function announce(message) {
  clearTimeout(announcementTimer);
  $("#announcer").textContent = "";
  announcementTimer = setTimeout(() => { $("#announcer").textContent = message; }, 30);
}

function mutatePlant(plant, action) {
  const item = state[plant.id];
  if ((action === "complete" || action === "snooze") && (item.status !== "pending" || plant.due === "Tomorrow")) return;
  if (action === "water" && item.history.includes("Today · Watered")) {
    announce(`${plant.name}’s watering is already recorded for today.`);
    return;
  }
  const focusedAction = document.activeElement?.dataset?.action;
  const rowIndex = pendingToday().findIndex(candidate => candidate.id === plant.id);
  const before = structuredClone(item);
  let message;
  if (action === "snooze") {
    item.status = "snoozed";
    item.history.unshift(`Today · ${plant.task} snoozed until tomorrow`);
    message = `${plant.name} is tucked into tomorrow.`;
  } else if (action === "water") {
    item.history.unshift("Today · Watered");
    if (plant.task === "Water") item.status = "done";
    message = `${plant.name}’s watering is recorded.`;
  } else {
    item.status = "done";
    item.history.unshift(`Today · ${TASKS[plant.task].done}`);
    message = `${plant.name} · ${TASKS[plant.task].done.toLowerCase()}. Lovely.`;
  }
  item.history = item.history.slice(0, 100);
  const now = Date.now();
  // Older actions remain undoable in reverse order during their own 12-second window.
  undoStack = undoStack.filter(entry => entry.expires > (pausedAt ?? now));
  undoStack.push({plantId: plant.id, before, message, expires: (pausedAt ?? now) + UNDO_DURATION});
  saveState();
  render();
  showUndo();
  const remaining = pendingToday().length;
  announce(`${message} ${remaining ? `${remaining} ${remaining === 1 ? "task remains" : "tasks remain"} for today.` : "Nothing more for today."} Undo is available for 12 seconds.`);
  restoreActionFocus(plant.id, focusedAction, rowIndex);
}

function restoreActionFocus(plantId, action, rowIndex) {
  if (dialog.open) {
    const sameControl = $("#dialogContent").querySelector(`[data-action="${action}"][data-plant="${plantId}"]`);
    (sameControl || $("#closeDialog")).focus({preventScroll: true});
  } else if (currentView === "today") {
    const nextPlant = pendingToday()[Math.max(0, rowIndex)] || pendingToday().at(-1);
    const target = nextPlant ? $("#todayQueue").querySelector(`[data-action="complete"][data-plant="${nextPlant.id}"]`) : $("#allDoneHeading");
    target?.focus({preventScroll: true});
  } else {
    $("#plantCollection").querySelector(`[data-plant="${plantId}"]`)?.focus({preventScroll: true});
  }
}

function showUndo() {
  clearTimeout(undoTimer);
  const latest = undoStack.at(-1);
  if (!latest) {
    hideToast();
    return;
  }
  toast.hidden = false;
  $("#toastMessage").textContent = latest.message;
  undoButton.setAttribute("aria-label", `Undo the latest action for ${plants.find(plant => plant.id === latest.plantId).name}${undoStack.length > 1 ? `. ${undoStack.length} recent actions available to undo` : ""}`);
  tickUndo();
}

function tickUndo() {
  clearTimeout(undoTimer);
  if (pausedAt !== null) return;
  const now = Date.now();
  undoStack = undoStack.filter(entry => entry.expires > now);
  if (!undoStack.length) {
    hideToast();
    return;
  }
  const latest = undoStack.at(-1);
  $("#toastTimer").style.width = `${Math.max(0, (latest.expires - now) / UNDO_DURATION * 100)}%`;
  undoTimer = setTimeout(tickUndo, 100);
}

function pauseUndo() {
  if (pausedAt !== null || toast.hidden) return;
  pausedAt = Date.now();
  clearTimeout(undoTimer);
}

function resumeUndo() {
  if (pausedAt === null || toastHovered || toast.contains(document.activeElement)) return;
  const duration = Date.now() - pausedAt;
  undoStack.forEach(entry => { entry.expires += duration; });
  pausedAt = null;
  tickUndo();
}

function hideToast() {
  clearTimeout(undoTimer);
  const hadFocus = toast.contains(document.activeElement);
  toast.hidden = true;
  toastHovered = false;
  pausedAt = null;
  if (hadFocus) (dialog.open ? $("#closeDialog") : $(`#${currentView}Heading`)).focus({preventScroll: true});
}

function undoLatest() {
  if (pausedAt === null) undoStack = undoStack.filter(entry => entry.expires > Date.now());
  const entry = undoStack.pop();
  if (!entry) {
    hideToast();
    return;
  }
  const plant = plants.find(candidate => candidate.id === entry.plantId);
  state[entry.plantId] = entry.before;
  saveState();
  render();
  showUndo();
  announce(`${plant.name}’s last action was undone. ${pendingToday().length} tasks for today.`);
  if (toast.hidden) {
    if (dialog.open) $("#closeDialog").focus({preventScroll: true});
    else {
      const control = currentView === "today"
        ? $("#todayQueue").querySelector(`[data-action="complete"][data-plant="${plant.id}"]`) || $("#queueHeading")
        : $("#plantCollection").querySelector(`[data-plant="${plant.id}"]`);
      control?.focus({preventScroll: true});
    }
  }
}

document.addEventListener("click", event => {
  const viewButton = event.target.closest("button[data-view]");
  if (viewButton) {
    switchView(viewButton.dataset.view);
    return;
  }
  const button = event.target.closest("button[data-action][data-plant]");
  if (!button) return;
  const plant = plants.find(candidate => candidate.id === button.dataset.plant);
  if (!plant) return;
  if (button.dataset.action === "details") openDetail(plant);
  else if (["complete", "snooze", "water"].includes(button.dataset.action)) mutatePlant(plant, button.dataset.action);
});

$(".brand").addEventListener("click", event => { event.preventDefault(); switchView("today"); });
$("#closeDialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
  document.body.append(toast);
  document.body.append($("#announcer"));
  const previousId = selectedPlant?.id;
  selectedPlant = null;
  if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
  else {
    const root = currentView === "today" ? $("#todayView") : $("#plantsView");
    const replacement = root.querySelector(`[data-action="details"][data-plant="${previousId}"]`);
    (replacement || $(`#${currentView}Heading`)).focus({preventScroll: true});
  }
});
dialog.addEventListener("click", event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
undoButton.addEventListener("click", undoLatest);
$("#dismissToast").addEventListener("click", () => { undoStack = []; hideToast(); });
toast.addEventListener("pointerenter", () => { toastHovered = true; pauseUndo(); });
toast.addEventListener("pointerleave", () => { toastHovered = false; resumeUndo(); });
toast.addEventListener("focusin", pauseUndo);
toast.addEventListener("focusout", () => setTimeout(resumeUndo, 0));
document.addEventListener("visibilitychange", () => {
  // Keep the brief undo path available when the user switches away from this tab.
  if (document.hidden) pauseUndo();
  else resumeUndo();
});

render();
switchView(location.hash === "#plants" ? "plants" : "today", false);
