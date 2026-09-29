const plants = [
  { id: "fern", name: "Frida", species: "Boston fern", location: "Bathroom", task: "Water", due: "2 days overdue", urgency: 4, light: "Low, indirect", history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"] },
  { id: "pothos", name: "Orbit", species: "Golden pothos", location: "Bookshelf", task: "Rotate", due: "Today", urgency: 2, light: "Medium, indirect", history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"] },
  { id: "cactus", name: "Dot", species: "Bunny ears cactus", location: "South window", task: "Check soil", due: "Today", urgency: 1, light: "Bright, direct", history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"] },
  { id: "calathea", name: "Drama", species: "Calathea orbifolia", location: "Bedroom", task: "Mist", due: "Tomorrow", urgency: 0, light: "Medium, filtered", history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"] }
];

const week = [1, 3, 2, 4, 2, 1, 3];
const days = ["M", "T", "W", "T", "F", "S", "S"];
const state = Object.fromEntries(plants.map((plant) => [plant.id, { status: "active", due: plant.due }]));

const queueList = document.querySelector("#queue-list");
const snoozedList = document.querySelector("#snoozed-list");
const doneList = document.querySelector("#done-list");
const snoozedSection = document.querySelector("#snoozed-section");
const doneSection = document.querySelector("#done-section");
const allDone = document.querySelector("#all-done");
const queueIntro = document.querySelector("#queue-intro");
const queueCount = document.querySelector("#queue-count");
const queueCounter = document.querySelector("#queue-counter");
const toast = document.querySelector("#toast");
const toastMessage = document.querySelector("#toast-message");
const undoButton = document.querySelector("#undo-action");
const dismissButton = document.querySelector("#dismiss-toast");
let undoSnapshot = null;
let toastTimer = null;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function plantIllustration(id) {
  const start = '<svg viewBox="0 0 48 48" focusable="false" aria-hidden="true">';
  const finish = '<path class="pot-fill" d="M12 32h24l-2.5 11h-19z"/><path class="pot-line" d="M10 31h28"/></svg>';
  const drawings = {
    fern: '<path d="M24 31V8m0 17C17 16 13 14 9 15c1 7 6 11 15 13m0-10c6-8 11-10 15-9-1 7-6 11-15 13m0 13c-7-7-12-8-17-6 2 6 7 9 17 9m0-9c7-7 12-8 17-6-2 6-7 9-17 9"/><path d="M14 17l8 9m13-12-10 9m-9 5 8 7m12-7-10 7"/>',
    pothos: '<path d="M24 32V11m0 17c-4-7-10-10-16-7 1 9 7 13 16 13m0-13c3-8 9-12 16-9 0 9-5 14-16 15m-1-14c-3-5-2-9 1-12 4 4 4 8 1 12"/>',
    cactus: '<path d="M24 31V10c0-4 6-4 6 0v6m-6 0c0-4-6-4-6 0v7m8-8c4-1 6 1 6 5v7m-12-6c-4-1-6 1-6 5v4"/><path d="M22 14h.1m6 7h.1m-8 4h.1m8-10h.1m4 10h.1" stroke-width="2.5"/>',
    calathea: '<path d="M24 32V9m0 19c-4-9-10-12-16-10 1 9 6 13 16 15m0-13c3-9 10-12 16-9-1 9-6 14-16 16m-1-17c-2-6 0-9 3-11 3 5 2 9-2 12m-7 7 7 6m9-10-9 8"/>'
  };
  return `${start}${drawings[id]}${finish}`;
}

function dueLabel(plant) {
  const plantState = state[plant.id];
  if (plantState.status === "snoozed") return "Later today";
  if (plantState.status === "done") return "Tended";
  return plantState.due;
}

function renderCard(plant, quiet = false) {
  const plantState = state[plant.id];
  const overdue = plantState.status === "active" && plant.due.includes("overdue");
  const due = dueLabel(plant);
  const mainAction = plant.task === "Water" ? "Watered" : "Done for today";
  const actionLabel = plant.task === "Water" ? `Mark ${plant.name} as watered` : `Mark ${plant.name}’s ${plant.task.toLowerCase()} task done`;
  const history = plant.history.map((entry) => `<li>${escapeHTML(entry)}</li>`).join("");
  const quietStatus = plantState.status === "snoozed" ? "Later today · snoozed" : "Done for today";
  return `
    <article class="plant-card${overdue ? " is-overdue" : ""}" style="--portrait-bg:${plant.id === "cactus" ? "#f0e3c7" : plant.id === "calathea" ? "#e6e8dc" : plant.id === "pothos" ? "#e4e9ce" : "#e4ead7"};--portrait-ink:${plant.id === "cactus" ? "#a2764a" : plant.id === "calathea" ? "#687f60" : plant.id === "pothos" ? "#68824d" : "#688554"}">
      <div class="plant-main">
        <span class="plant-portrait">${plantIllustration(plant.id)}</span>
        <div class="plant-copy">
          <div class="card-topline"><span class="due-chip">${overdue ? '<span class="due-dot" aria-hidden="true"></span>' : ""}${escapeHTML(due)}</span></div>
          <div class="plant-title-line"><h3 class="plant-name">${escapeHTML(plant.name)}</h3><span class="plant-species">${escapeHTML(plant.species)}</span></div>
          <p class="plant-task">${escapeHTML(plant.task)} <strong>· ${plant.task === "Water" ? "Give her a drink" : plant.task === "Rotate" ? "Turn toward the light" : plant.task === "Check soil" ? "A fingertip check" : "A soft mist"}</strong></p>
          <p class="plant-location">${escapeHTML(plant.location)}</p>
        </div>
      </div>
      ${quiet ? `<span class="quiet-status">${escapeHTML(quietStatus)}</span>` : `
        <div class="plant-actions" aria-label="Actions for ${escapeHTML(plant.name)}">
          <button class="action-button complete-button" type="button" data-action="complete" data-plant="${plant.id}" aria-label="${escapeHTML(actionLabel)}"><span class="action-icon" aria-hidden="true">${plant.task === "Water" ? "↗" : "✓"}</span>${mainAction}</button>
          <button class="action-button snooze-button" type="button" data-action="snooze" data-plant="${plant.id}" aria-label="Snooze ${escapeHTML(plant.name)} until later today" title="Snooze until later today"><span aria-hidden="true">◷</span><span class="snooze-label">Snooze</span></button>
        </div>
        <details class="plant-detail">
          <summary>Plant notes &amp; recent history</summary>
          <div class="detail-content">
            <div><span class="detail-label">Light likes</span><span class="light-value"><span class="light-symbol" aria-hidden="true">☼</span>${escapeHTML(plant.light)}</span></div>
            <div><span class="detail-label">Recent moments</span><ul class="history-list">${history}</ul></div>
          </div>
        </details>
      `}
    </article>`;
}

function render() {
  const active = plants.filter((plant) => state[plant.id].status === "active").sort((a, b) => b.urgency - a.urgency);
  const snoozed = plants.filter((plant) => state[plant.id].status === "snoozed");
  const done = plants.filter((plant) => state[plant.id].status === "done");
  queueList.innerHTML = active.map((plant) => renderCard(plant)).join("");
  snoozedList.innerHTML = snoozed.map((plant) => renderCard(plant, true)).join("");
  doneList.innerHTML = done.map((plant) => renderCard(plant, true)).join("");
  snoozedSection.hidden = snoozed.length === 0;
  doneSection.hidden = done.length === 0;
  allDone.hidden = active.length > 0 || snoozed.length > 0;
  queueList.hidden = active.length === 0;
  queueIntro.hidden = active.length === 0;
  queueIntro.textContent = active.some((plant) => plant.due.includes("overdue"))
    ? "First, one plant could use a bit of extra love."
    : active.length ? "A few small things, at your own pace." : "Everything is tucked in for today.";
  queueCount.textContent = active.length === 0 ? "All tended for today" : active.length === 1 ? "1 small thing" : `${active.length} small things`;
  queueCounter.innerHTML = `${String(active.length).padStart(2, "0")} <span>to tend</span>`;
}

function showToast(message, snapshot) {
  clearTimeout(toastTimer);
  undoSnapshot = snapshot;
  toastMessage.textContent = message;
  toast.hidden = false;
  undoButton.focus();
  toastTimer = setTimeout(() => {
    toast.hidden = true;
    undoSnapshot = null;
  }, 8000);
}

function changeStatus(id, nextStatus) {
  const plant = plants.find((item) => item.id === id);
  if (!plant) return;
  const previous = { ...state[id] };
  state[id] = nextStatus === "snoozed"
    ? { status: "snoozed", due: "Later today" }
    : { status: "done", due: "Tended" };
  render();
  if (nextStatus === "snoozed") {
    showToast(`${plant.name} is snoozed until later today.`, { id, value: previous });
  } else {
    const message = plant.task === "Water" ? `${plant.name} got a nice drink.` : `${plant.name}’s ${plant.task.toLowerCase()} is all done.`;
    showToast(message, { id, value: previous });
  }
}

function undoLastAction() {
  if (!undoSnapshot) return;
  const restoredId = undoSnapshot.id;
  state[restoredId] = undoSnapshot.value;
  clearTimeout(toastTimer);
  toast.hidden = true;
  undoSnapshot = null;
  render();
  document.querySelector(`[data-plant="${CSS.escape(restoredId)}"]`)?.focus();
}

document.addEventListener("click", (event) => {
  const action = event.target.closest("button[data-action]");
  if (!action) return;
  changeStatus(action.dataset.plant, action.dataset.action === "snooze" ? "snoozed" : "done");
});

undoButton.addEventListener("click", undoLastAction);
dismissButton.addEventListener("click", () => {
  clearTimeout(toastTimer);
  toast.hidden = true;
  undoSnapshot = null;
});

function renderWeek() {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const bars = week.map((value, index) => `
    <div class="day-column${index === todayIndex ? " is-today" : ""}" aria-label="${days[index]}, ${value} care ${value === 1 ? "moment" : "moments"}${index === todayIndex ? ", today" : ""}">
      <div class="bar-wrap"><span class="day-bar" style="height:${Math.max(14, value / 4 * 100)}%"></span></div>
      <span class="day-label" aria-hidden="true">${days[index]}</span>
    </div>`).join("");
  document.querySelector("#chart-bars").innerHTML = bars;
  document.querySelector("#week-total").textContent = `${week.reduce((sum, count) => sum + count, 0)} this week`;
  document.querySelector("#week-chart").setAttribute("aria-label", `Care moments this week: ${week.join(", ")}, Monday through Sunday.`);
}

function renderDate() {
  const date = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  document.querySelector("#today-date").textContent = `${date} · a gentle check-in`;
}

render();
renderWeek();
renderDate();
