// Moss — today's care queue. Data mirrors PLANTS.json (embedded so the
// page works from file:// with zero network requests).
const PLANTS = [
  { id: "fern", name: "Frida", species: "Boston fern", location: "Bathroom", task: "Water", due: "2 days overdue", dueKind: "overdue", urgency: 4, light: "Low, indirect", water: "Keep soil evenly moist; mist often", history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"] },
  { id: "pothos", name: "Orbit", species: "Golden pothos", location: "Bookshelf", task: "Rotate", due: "Today", dueKind: "today", urgency: 2, light: "Medium, indirect", water: "Water when top 3 cm dry", history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"] },
  { id: "cactus", name: "Dot", species: "Bunny ears cactus", location: "South window", task: "Check soil", due: "Today", dueKind: "today", urgency: 1, light: "Bright, direct", water: "Drench rarely; bone-dry between", history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"] },
  { id: "calathea", name: "Drama", species: "Calathea orbifolia", location: "Bedroom", task: "Mist", due: "Tomorrow", dueKind: "tomorrow", urgency: 0, light: "Medium, filtered", water: "Rainwater if you can; evenly damp", history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"] }
];
const WEEK = [1, 3, 2, 4, 2, 1, 3];
const LEAF_SVG = {
  fern: '<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><path d="M20 36 L20 8" stroke="#2c4f26" stroke-width="2.6" stroke-linecap="round"/><g stroke="#3e6b34" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M20 14 C14 14 10 11 8 7"/><path d="M20 14 C26 14 30 11 32 7"/><path d="M20 21 C13 21 9 18 6 13"/><path d="M20 21 C27 21 31 18 34 13"/><path d="M20 28 C14 28 10 25 7 21"/><path d="M20 28 C26 28 30 25 33 21"/></g></svg>',
  pothos: '<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><path d="M20 36 C20 26 12 24 8 14 C18 16 22 22 20 36 Z" fill="#4c7f3f"/><path d="M20 36 C20 25 28 23 32 12 C23 14 18 22 20 36 Z" fill="#7fb069"/><circle cx="20" cy="36" r="2.4" fill="#2c4f26"/></svg>',
  cactus: '<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><ellipse cx="20" cy="24" rx="7" ry="11" fill="#4c7f3f"/><ellipse cx="11" cy="18" rx="4.5" ry="7" fill="#7fb069"/><ellipse cx="29" cy="18" rx="4.5" ry="7" fill="#7fb069"/><g fill="#2c3a24"><circle cx="20" cy="20" r="1"/><circle cx="20" cy="26" r="1"/><circle cx="11" cy="18" r="0.9"/><circle cx="29" cy="18" r="0.9"/></g></svg>',
  calathea: '<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><ellipse cx="20" cy="20" rx="13" ry="10" fill="#7fb069" transform="rotate(-18 20 20)"/><ellipse cx="20" cy="20" rx="8" ry="6" fill="#4c7f3f" transform="rotate(-18 20 20)"/><line x1="9" y1="27" x2="31" y2="13" stroke="#d9edc0" stroke-width="1.6"/></svg>'
};

const state = new Map(PLANTS.map(p => [p.id, "todo"])); // todo | done | snoozed
let lastAction = null; // { id, prev, msg }
let toastTimer = null;

const queueEl = document.getElementById("queue");
const summaryEl = document.getElementById("summary");
const progressCount = document.getElementById("progress-count");
const progressFill = document.getElementById("progress-fill");
const alldoneEl = document.getElementById("alldone");
const restingWrap = document.getElementById("resting-wrap");
const restingList = document.getElementById("resting-list");
const toastEl = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const undoBtn = document.getElementById("undo-btn");
const tipText = document.getElementById("tip-text");

const TIPS = {
  fern: "Frida sulks when she dries out. A deep drink, then back to her steamy bathroom spa.",
  pothos: "Orbit leans toward the books. A quarter-turn keeps him orbiting evenly.",
  cactus: "Dot thrives on neglect — but a quick poke of the soil never hurts.",
  calathea: "Drama folds her leaves at night like pajamas. Mist her and admire."
};

function sortedPlants() {
  return [...PLANTS].sort((a, b) => b.urgency - a.urgency);
}

function activeQueue() {
  return sortedPlants().filter(p => state.get(p.id) === "todo");
}

function render() {
  const q = activeQueue();
  queueEl.innerHTML = "";
  q.forEach(p => queueEl.appendChild(cardFor(p)));

  const doneCount = PLANTS.filter(p => state.get(p.id) === "done").length;
  const cleared = PLANTS.filter(p => state.get(p.id) !== "todo").length;
  progressCount.textContent = `${doneCount} of ${PLANTS.length}`;
  progressFill.style.width = `${(cleared / PLANTS.length) * 100}%`;

  const overdue = q.find(p => p.dueKind === "overdue");
  if (q.length === 0) {
    summaryEl.textContent = "Everything is tended. Nicely grown.";
  } else if (overdue) {
    summaryEl.textContent = `${overdue.name} needs you most — ${overdue.due.toLowerCase()}.`;
  } else {
    summaryEl.textContent = `${q.length} gentle task${q.length > 1 ? "s" : ""} left today.`;
  }
  alldoneEl.hidden = q.length !== 0;
  queueEl.hidden = q.length === 0;

  const snoozed = PLANTS.filter(p => state.get(p.id) === "snoozed");
  restingWrap.hidden = snoozed.length === 0;
  restingList.innerHTML = "";
  snoozed.forEach(p => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = `${p.name} · ${p.task} — back tomorrow`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Bring back";
    btn.addEventListener("click", () => setStatus(p.id, "todo", `${p.name} is back in today's queue.`));
    li.append(span, btn);
    restingList.appendChild(li);
  });

  // Whisper follows the most urgent open plant.
  tipText.textContent = q.length ? TIPS[q[0].id] : "The jungle naps. Whisper resumes tomorrow.";
}

function cardFor(p) {
  const li = document.createElement("li");
  li.className = "plant" + (p.dueKind === "overdue" ? " is-overdue" : "");
  li.dataset.plant = p.id;

  const top = document.createElement("div");
  top.className = "plant-top";

  const pot = document.createElement("span");
  pot.className = "pot";
  pot.innerHTML = LEAF_SVG[p.id] || "";

  const idWrap = document.createElement("div");
  const h = document.createElement("h2");
  h.className = "plant-id";
  const nm = document.createElement("span");
  nm.className = "pname";
  nm.textContent = p.name;
  const sp = document.createElement("span");
  sp.className = "pspecies";
  sp.textContent = ` · ${p.species}`;
  h.append(nm, sp);
  const meta = document.createElement("p");
  meta.className = "plant-meta";
  meta.textContent = `${p.location}`;
  idWrap.append(h, meta);

  const taskWrap = document.createElement("div");
  taskWrap.className = "plant-task";
  const pill = document.createElement("span");
  pill.className = "task-pill";
  pill.textContent = p.task;
  const sticker = document.createElement("span");
  sticker.className = `sticker sticker-${p.dueKind}`;
  sticker.textContent = p.due;
  taskWrap.append(pill);
  top.append(pot, idWrap);
  li.append(top);

  const sub = document.createElement("div");
  sub.appendChild(taskWrap);
  // place sticker beside task pill: move into a row with the pill
  taskWrap.prepend(sticker);

  const actions = document.createElement("div");
  actions.className = "plant-actions";

  const waterBtn = document.createElement("button");
  waterBtn.type = "button";
  waterBtn.className = "btn btn-water";
  waterBtn.textContent = p.task === "Water" ? "Watered" : `Done · ${p.task.toLowerCase()}`;
  waterBtn.setAttribute("aria-label", `Mark ${p.name} as ${p.task.toLowerCase()} done`);
  waterBtn.addEventListener("click", () => setStatus(p.id, "done", `${p.name} is tended. Looking perky.`));

  const snoozeBtn = document.createElement("button");
  snoozeBtn.type = "button";
  snoozeBtn.className = "btn btn-snooze";
  snoozeBtn.textContent = "Snooze";
  snoozeBtn.setAttribute("aria-label", `Snooze ${p.name} until tomorrow`);
  snoozeBtn.addEventListener("click", () => setStatus(p.id, "snoozed", `${p.name} snoozed till tomorrow.`));

  actions.append(waterBtn, snoozeBtn);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "detail-toggle";
  const detailId = `detail-${p.id}`;
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", detailId);
  toggle.textContent = `Care notes for ${p.name} ▾`;

  const detail = document.createElement("div");
  detail.className = "detail";
  detail.id = detailId;
  detail.hidden = true;
  detail.innerHTML = `
    <dl>
      <dt>Light</dt><dd></dd>
      <dt>Water</dt><dd></dd>
      <dt>Home</dt><dd></dd>
    </dl>
    <ul class="history"></ul>`;
  const [lightDd, waterDd, homeDd] = detail.querySelectorAll("dd");
  lightDd.textContent = p.light;
  waterDd.textContent = p.water;
  homeDd.textContent = p.location;
  const hist = detail.querySelector(".history");
  p.history.forEach(entry => {
    const item = document.createElement("li");
    item.textContent = entry;
    hist.appendChild(item);
  });

  toggle.addEventListener("click", () => {
    const open = detail.hidden;
    detail.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? `Hide ${p.name}'s notes ▴` : `Care notes for ${p.name} ▾`;
  });

  li.append(sub, actions, toggle, detail);
  return li;
}

function setStatus(id, next, msg) {
  lastAction = { id, prev: state.get(id), msg };
  state.set(id, next);
  render();
  showToast(msg);
}

function showToast(msg) {
  clearTimeout(toastTimer);
  toastMsg.textContent = msg;
  toastEl.hidden = false;
  undoBtn.focus({ preventScroll: true });
  toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
  clearTimeout(toastTimer);
  toastEl.hidden = true;
  lastAction = null;
}

undoBtn.addEventListener("click", () => {
  if (!lastAction) return;
  state.set(lastAction.id, lastAction.prev);
  const p = PLANTS.find(x => x.id === lastAction.id);
  render();
  hideToast();
  // Return focus to the restored card's primary action.
  const card = queueEl.querySelector(`[data-plant="${p.id}"] .btn-water`);
  if (card) card.focus();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !toastEl.hidden) hideToast();
});

document.getElementById("reset-btn").addEventListener("click", () => {
  PLANTS.forEach(p => state.set(p.id, "todo"));
  hideToast();
  render();
});

function renderRhythm() {
  const wrap = document.getElementById("bars");
  const max = Math.max(...WEEK);
  WEEK.forEach((v, i) => {
    const bar = document.createElement("div");
    bar.className = "bar" + (v === max ? " peak" : "") + (i === 1 ? " today" : "");
    bar.style.height = `${(v / max) * 100}%`;
    bar.title = `${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}: ${v} touches`;
    wrap.appendChild(bar);
  });
}

renderRhythm();
render();
