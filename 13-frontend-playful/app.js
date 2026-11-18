"use strict";

// Keep the fixture inline so the care desk also runs from a file URL.
const plants = [
  {
    id: "fern", name: "Frida", species: "Boston fern", location: "Bathroom",
    task: "Water", due: "2 days overdue", urgency: 4, light: "Low, indirect",
    history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"]
  },
  {
    id: "pothos", name: "Orbit", species: "Golden pothos", location: "Bookshelf",
    task: "Rotate", due: "Today", urgency: 2, light: "Medium, indirect",
    history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"]
  },
  {
    id: "cactus", name: "Dot", species: "Bunny ears cactus", location: "South window",
    task: "Check soil", due: "Today", urgency: 1, light: "Bright, direct",
    history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"]
  },
  {
    id: "calathea", name: "Drama", species: "Calathea orbifolia", location: "Bedroom",
    task: "Mist", due: "Tomorrow", urgency: 0, light: "Medium, filtered",
    history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"]
  }
];
const week = [1, 3, 2, 4, 2, 1, 3];
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const taskTypes = {
  "Water": { icon: "water", past: "Watered" },
  "Rotate": { icon: "rotate", past: "Rotated" },
  "Check soil": { icon: "soil", past: "Checked soil" },
  "Mist": { icon: "mist", past: "Misted" }
};

const dayLength = 86_400_000;
const storageKey = "moss-care-v1";
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const byId = (id) => document.getElementById(id);
const queue = byId("queue");
const toast = byId("toast");
const undo = byId("undo");

let today = localDay();
const state = loadState();
let openPlant = null;
let pendingUndo = null;
let undoTimer = null;
let timerStarted = 0;

function localDay() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / dayLength;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Number.isInteger(saved?.startDay) && saved.entries && typeof saved.entries === "object") {
      return saved;
    }
  } catch {
    // The app still works for this visit if browser storage is disabled.
  }
  return { startDay: today, entries: {} };
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Keep the current session usable.
  }
}

function initialOffset(due) {
  if (due === "Today") return 0;
  if (due === "Tomorrow") return 1;
  return -Number.parseInt(due, 10);
}

function getSchedule(plant) {
  const entry = state.entries[plant.id];
  const doneDay = Number.isInteger(entry?.doneDay) ? entry.doneDay : null;
  const snoozed = Number.isInteger(entry?.nextDay);
  const dueDay = snoozed ? entry.nextDay : state.startDay + initialOffset(plant.due);
  return { ...plant, dueDay, snoozed, doneDay };
}

function dateLabel(day) {
  if (day === today) return "Today";
  if (day === today + 1) return "Tomorrow";
  return shortDate.format(day * dayLength);
}

function dueLabel(plant) {
  if (plant.doneDay !== null) {
    return plant.doneDay === today ? "Done today" : `Done ${dateLabel(plant.doneDay)}`;
  }

  const overdueBy = today - plant.dueDay;
  if (overdueBy > 0) return `${overdueBy} ${overdueBy === 1 ? "day" : "days"} overdue`;
  if (plant.snoozed && overdueBy < 0) return `Snoozed until ${dateLabel(plant.dueDay).toLowerCase()}`;
  return dateLabel(plant.dueDay);
}

function icon(name) {
  return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function renderDetails(plant) {
  const { id, light, doneDay, task } = plant;
  const history = plant.history.map((event) => event.split(" · "));
  if (doneDay !== null) {
    history.unshift([dateLabel(doneDay), taskTypes[task].past]);
  }

  const watered = history.find(([, note]) => note === "Watered");
  const lastWatered = watered ? `Last watered ${watered[0].replace(/^Today$/, "today")}` : "No watering logged yet";

  return `
    <div class="plant-detail" id="detail-${id}" role="region" aria-labelledby="toggle-${id}"${openPlant === id ? "" : " hidden"}>
      <dl>
        <div>
          <dt>${icon("sun")} Light</dt>
          <dd>${light}</dd>
        </div>
        <div>
          <dt>${icon("water")} Water</dt>
          <dd>${lastWatered}</dd>
        </div>
      </dl>
      <div class="history">
        <h3>Observation history</h3>
        <ul role="list">
          ${history.map(([date, note]) => `<li><span class="history-date">${date}</span><span>${note}</span></li>`).join("")}
        </ul>
      </div>
    </div>`;
}

function renderPlant(plant) {
  const { id, name, species, location, task, dueDay, doneDay } = plant;
  const care = taskTypes[task];
  const active = doneDay === null && dueDay <= today;
  const overdue = active && dueDay < today;
  const rowState = overdue ? "overdue" : active ? "today" : doneDay === null ? "upcoming" : "done";

  return `
    <li class="plant" data-id="${id}" data-state="${rowState}">
      <div class="plant-row">
        <svg class="plant-art" aria-hidden="true"><use href="#plant-${id}"/></svg>
        <div class="plant-copy">
          <button class="plant-toggle" type="button" data-action="detail" id="toggle-${id}"
            aria-expanded="${openPlant === id}" aria-controls="detail-${id}">${name} ${icon("chevron")}</button>
          <p class="plant-meta">${species} · ${location}</p>
          <p class="task-line">
            <span class="task-name">${icon(care.icon)} ${doneDay === null ? task : care.past}</span>
            <span class="due${overdue ? " due-overdue" : ""}">${dueLabel(plant)}</span>
          </p>
        </div>
        ${active ? `
          <div class="plant-actions">
            <button class="complete" type="button" data-action="complete">
              ${icon("check")} ${care.past}<span class="sr-only"> · ${name}</span>
            </button>
            <button class="snooze" type="button" data-action="snooze">
              ${icon("clock")} Snooze<span class="sr-only"> ${name} until tomorrow</span>
            </button>
          </div>` : ""}
      </div>
      ${renderDetails(plant)}
    </li>`;
}

function renderList(rows) {
  return `<ul class="plant-list" role="list">${rows.map(renderPlant).join("")}</ul>`;
}

function renderGroup(title, rows) {
  if (!rows.length) return "";
  return `<h3 class="queue-group-title">${title}</h3>${renderList(rows)}`;
}

function renderAllDone(next) {
  let nextMessage = "You can revisit your plants and their care notes below.";
  if (next) {
    const when = next.dueDay === today + 1 ? "tomorrow" : `on ${dateLabel(next.dueDay)}`;
    nextMessage = `Next up is ${next.name} ${when}.`;
  }
  return `
    <div class="all-done">
      <div>
        <h3>You’re all caught up.</h3>
        <p>${nextMessage}</p>
      </div>
      <svg aria-hidden="true"><use href="#resting-leaf"/></svg>
    </div>`;
}

function renderQueue() {
  const schedule = plants.map(getSchedule).sort((a, b) => a.dueDay - b.dueDay || b.urgency - a.urgency);
  const active = schedule.filter((plant) => plant.doneDay === null && plant.dueDay <= today);
  const upcoming = schedule.filter((plant) => plant.doneDay === null && plant.dueDay > today);
  const done = schedule.filter((plant) => plant.doneDay !== null).sort((a, b) => b.doneDay - a.doneDay);
  const count = active.length;

  byId("queue-count").textContent = count ? `${count} to do` : "All done";
  if (count) {
    const first = active[0];
    const priority = first.dueDay < today ? ` Start with ${first.name}.` : "";
    byId("hero-status").textContent = `${count} ${count === 1 ? "plant" : "plants"} to tend today.${priority}`;
  } else {
    byId("hero-status").textContent = "Your plants can take it easy today.";
  }

  queue.innerHTML = (count ? renderList(active) : renderAllDone(upcoming[0]))
    + renderGroup("Up next", upcoming)
    + renderGroup("Completed care", done);
}

function renderCalendar() {
  const date = new Date(today * dayLength);
  const dateElement = byId("today-date");
  dateElement.textContent = longDate.format(date);
  dateElement.dateTime = date.toISOString().slice(0, 10);

  const todayIndex = (date.getUTCDay() + 6) % 7;
  const max = Math.max(...week);
  byId("week").innerHTML = week.map((count, index) => `
    <li class="week-day"${index === todayIndex ? ' aria-current="date"' : ""}>
      <span class="sr-only">${weekdays[index]}, ${count} care ${count === 1 ? "task" : "tasks"}</span>
      <div class="bar-slot" aria-hidden="true">
        <div class="bar" style="--bar-height: ${count / max * 81}%">
          <span class="bar-value">${count}</span>
        </div>
      </div>
      <span class="day-label" aria-hidden="true">${weekdays[index].slice(0, 3)}</span>
    </li>`).join("");

  byId("weekly-total").textContent = `${week.reduce((sum, count) => sum + count, 0)} tasks per week`;
}

function setExpanded(id, expanded) {
  byId(`toggle-${id}`).setAttribute("aria-expanded", String(expanded));
  byId(`detail-${id}`).hidden = !expanded;
}

function clearUndo() {
  window.clearTimeout(undoTimer);
  undoTimer = null;
  pendingUndo = null;
  toast.hidden = true;
}

function pauseUndo() {
  if (!pendingUndo || undoTimer === null) return;
  pendingUndo.remaining -= performance.now() - timerStarted;
  window.clearTimeout(undoTimer);
  undoTimer = null;
}

function resumeUndo() {
  if (!pendingUndo || undoTimer !== null || toast.contains(document.activeElement) || toast.matches(":hover")) return;
  timerStarted = performance.now();
  undoTimer = window.setTimeout(clearUndo, Math.max(0, pendingUndo.remaining));
}

function announce(message) {
  byId("announcement").textContent = message;
}

queue.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const row = button.closest(".plant");
  const id = row.dataset.id;
  const action = button.dataset.action;

  if (action === "detail") {
    const wasOpen = openPlant === id;
    if (openPlant) setExpanded(openPlant, false);
    openPlant = wasOpen ? null : id;
    if (openPlant) setExpanded(openPlant, true);
    return;
  }

  const plant = getSchedule(plants.find((item) => item.id === id));
  const previous = state.entries[id];
  const previousOpen = openPlant;
  const snoozing = action === "snooze";
  const message = snoozing ? `${plant.name} snoozed until tomorrow.` : `${taskTypes[plant.task].past} ${plant.name}.`;
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  state.entries[id] = snoozing ? { nextDay: today + 1 } : { ...previous, doneDay: today };
  if (openPlant === id) openPlant = null;
  saveState();
  renderQueue();

  clearUndo();
  pendingUndo = { id, action, previous, previousOpen, remaining: 9000 };
  byId("toast-message").textContent = message;
  byId("toast-icon").setAttribute("href", snoozing ? "#i-clock" : "#i-check");
  toast.hidden = false;
  const keyboardAction = event.detail === 0;
  if (keyboardAction) {
    undo.focus({ preventScroll: true });
  } else {
    const nextFocus = nextRow ? byId(`toggle-${nextRow.dataset.id}`) : byId("care-title");
    nextFocus.focus({ preventScroll: true });
  }
  const allDone = !queue.querySelector(".plant-actions");
  announce(`${message} ${allDone ? "You’re all caught up. " : ""}Undo available.`);
  resumeUndo();
});

undo.addEventListener("click", () => {
  if (!pendingUndo) return;
  const { id, action, previous, previousOpen } = pendingUndo;
  if (previous) {
    state.entries[id] = previous;
  } else {
    delete state.entries[id];
  }
  if (previousOpen === id) openPlant = id;
  saveState();
  clearUndo();
  renderQueue();
  const restored = queue.querySelector(`[data-id="${id}"] [data-action="${action}"]`) || byId(`toggle-${id}`);
  restored.focus();
  announce(`${plants.find((plant) => plant.id === id).name} is back in the care queue.`);
});

toast.addEventListener("mouseenter", pauseUndo);
toast.addEventListener("mouseleave", resumeUndo);
toast.addEventListener("focusin", pauseUndo);
toast.addEventListener("focusout", () => window.setTimeout(resumeUndo, 0));

function refreshDate() {
  const nextDay = localDay();
  if (nextDay === today) return;
  const activeButton = document.activeElement.closest("button[data-action]");
  const focusedPlant = activeButton?.closest(".plant").dataset.id;
  today = nextDay;
  renderCalendar();
  renderQueue();
  if (focusedPlant) {
    const control = queue.querySelector(`[data-id="${focusedPlant}"] [data-action="${activeButton.dataset.action}"]`);
    (control || byId(`toggle-${focusedPlant}`)).focus({ preventScroll: true });
  }
}

window.addEventListener("focus", refreshDate);
window.setInterval(refreshDate, 60_000);
saveState();
renderCalendar();
renderQueue();
