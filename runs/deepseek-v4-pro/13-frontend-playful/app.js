/* Moss — app logic. Data is inlined from PLANTS.json so the screen runs
   fully offline (file://) with no network or fetch requests. */

"use strict";

const PLANTS = [
  {
    id: "fern", name: "Frida", species: "Boston fern", location: "Bathroom",
    task: "Water", offset: -2, urgency: 4, light: "Low, indirect",
    tint: "fern",
    history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"],
  },
  {
    id: "pothos", name: "Orbit", species: "Golden pothos", location: "Bookshelf",
    task: "Rotate", offset: 0, urgency: 2, light: "Medium, indirect",
    tint: "pothos",
    history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"],
  },
  {
    id: "cactus", name: "Dot", species: "Bunny ears cactus", location: "South window",
    task: "Check soil", offset: 0, urgency: 1, light: "Bright, direct",
    tint: "cactus",
    history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"],
  },
  {
    id: "calathea", name: "Drama", species: "Calathea orbifolia", location: "Bedroom",
    task: "Mist", offset: 1, urgency: 0, light: "Medium, filtered",
    tint: "calathea",
    history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"],
  },
];

const WEEK = [1, 3, 2, 4, 2, 1, 3];
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const PAST = {
  "Water": "Watered",
  "Rotate": "Rotated",
  "Check soil": "Checked soil",
  "Mist": "Misted",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const el = (id) => document.getElementById(id);

function dueLabel(offset) {
  if (offset <= -2) return `${-offset} days overdue`;
  if (offset === -1) return "1 day overdue";
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return `In ${offset} days`;
}

function dueClass(offset) {
  if (offset < 0) return "overdue";
  if (offset === 0) return "today";
  return "tomorrow";
}

function sortQueue(list) {
  return [...list].sort((a, b) => a.offset - b.offset || b.urgency - a.urgency);
}

/* ---------- Illustrations ---------- */

function leafSVG(id) {
  const common = 'viewBox="0 0 96 96" aria-hidden="true" focusable="false"';
  switch (id) {
    case "fern":
      return `<svg ${common}>
        <path d="M48 92 C42 70 46 46 54 22" fill="none" stroke="#47603a" stroke-width="3.5" stroke-linecap="round"/>
        <g fill="#6f9855">
          <path d="M44 78 C34 76 26 79 22 84 C32 81 40 79 44 78Z"/>
          <path d="M46 68 C36 66 28 69 24 74 C34 71 42 69 46 68Z"/>
          <path d="M48 58 C38 56 30 59 26 64 C36 61 44 59 48 58Z"/>
          <path d="M49 48 C40 46 32 49 28 53 C37 50 45 49 49 48Z"/>
          <path d="M51 38 C43 36 35 38 31 42 C40 40 47 39 51 38Z"/>
          <path d="M52 28 C45 26 38 28 34 31 C42 29 48 29 52 28Z"/>
        </g>
        <g fill="#8ab468">
          <path d="M50 78 C60 76 68 79 72 84 C62 81 54 79 50 78Z"/>
          <path d="M50 68 C60 66 68 69 72 74 C62 71 54 69 50 68Z"/>
          <path d="M50 58 C60 56 68 59 72 64 C62 61 54 59 50 58Z"/>
          <path d="M51 48 C60 46 68 49 72 53 C63 50 55 49 51 48Z"/>
          <path d="M51 38 C60 36 68 38 72 42 C63 40 55 39 51 38Z"/>
          <path d="M52 28 C60 26 68 28 72 31 C63 29 55 29 52 28Z"/>
        </g>
      </svg>`;
    case "pothos":
      return `<svg ${common}>
        <path d="M48 14 C48 14 16 40 16 60 C16 74 27 84 40 84 C47 84 48 78 48 72 C48 78 49 84 56 84 C69 84 80 74 80 60 C80 40 48 14 48 14Z" fill="#6f9855"/>
        <path d="M48 14 C48 14 16 40 16 60 C16 66 19 72 24 76 C28 72 30 64 31 52 C35 60 42 64 46 62 C40 54 38 36 48 14Z" fill="#8ab468"/>
        <path d="M48 84 L48 92" stroke="#47603a" stroke-width="3" stroke-linecap="round" fill="none"/>
      </svg>`;
    case "cactus":
      return `<svg ${common}>
        <ellipse cx="30" cy="40" rx="13" ry="24" transform="rotate(-22 30 40)" fill="#7ba05f"/>
        <ellipse cx="66" cy="40" rx="13" ry="24" transform="rotate(22 66 40)" fill="#7ba05f"/>
        <ellipse cx="30" cy="40" rx="7" ry="16" transform="rotate(-22 30 40)" fill="#8ab468"/>
        <ellipse cx="66" cy="40" rx="7" ry="16" transform="rotate(22 66 40)" fill="#8ab468"/>
        <ellipse cx="48" cy="70" rx="24" ry="26" fill="#7ba05f"/>
        <ellipse cx="48" cy="70" rx="15" ry="17" fill="#8ab468"/>
        <circle cx="28" cy="34" r="1.4" fill="#e8dcc0"/>
        <circle cx="68" cy="34" r="1.4" fill="#e8dcc0"/>
        <circle cx="40" cy="62" r="1.4" fill="#e8dcc0"/>
        <circle cx="56" cy="70" r="1.4" fill="#e8dcc0"/>
      </svg>`;
    case "calathea":
      return `<svg ${common}>
        <path d="M48 12 C60 22 70 40 70 58 C70 74 60 86 48 86 C36 86 26 74 26 58 C26 40 36 22 48 12Z" fill="#6f9855"/>
        <path d="M48 22 C56 30 62 42 62 58 C62 72 56 82 48 86 C40 82 34 70 34 58 C34 44 40 30 48 22Z" fill="#8ab468"/>
        <path d="M30 56 C36 50 44 48 52 50" stroke="#efe6cd" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.75"/>
        <path d="M28 66 C36 60 46 58 54 60" stroke="#efe6cd" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.75"/>
        <path d="M32 76 C38 72 46 70 52 72" stroke="#efe6cd" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.75"/>
        <path d="M48 86 L48 92" stroke="#47603a" stroke-width="3" stroke-linecap="round" fill="none"/>
      </svg>`;
    default:
      return "";
  }
}

function historyIcon(text) {
  if (/Watered|Misted/.test(text)) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 C9 9 6 12 6 15 a6 6 0 0 0 12 0 C18 12 15 9 12 3Z" fill="currentColor"/></svg>`;
  }
  if (/Rotated|Wiped/.test(text)) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 11 A8 8 0 1 0 21 15"/><path d="M21 4v6h-6"/></svg>`;
  }
  return `<svg class="obs" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 C8 8 5 12 5 14 a7 7 0 0 0 14 0 C19 12 16 8 12 5Z" fill="currentColor"/><circle cx="12" cy="14" r="2.4" fill="#fffdf7"/></svg>`;
}

/* ---------- Rendering ---------- */

function renderHeader() {
  const now = new Date();
  el("today").textContent =
    `${WEEKDAYS[now.getDay()]}, ${MONTHS_FULL[now.getMonth()]} ${now.getDate()}`;
}

function renderRhythm() {
  const chart = el("rhythm-chart");
  const max = Math.max(...WEEK, 1);
  chart.innerHTML = WEEK.map((value, i) => {
    const pct = Math.round((value / max) * 100);
    return `
      <div class="day" role="img" aria-label="${DAY_NAMES[i]}: ${value} care ${value === 1 ? "task" : "tasks"}">
        <div class="bar-track">
          <div class="bar-fill" style="height:${pct}%; animation-delay:${i * 70}ms"></div>
          <span class="bar-leaf" style="bottom:${pct}%"></span>
        </div>
        <span class="dow">${DAY_LABELS[i]}</span>
      </div>`;
  }).join("");
}

function render() {
  const list = el("plant-list");
  const queue = sortQueue(PLANTS.filter((p) => !p.done));
  const done = PLANTS.filter((p) => p.done);

  el("queue-count").textContent = queue.length
    ? `${queue.length} to go`
    : "all clear";

  list.innerHTML = queue.map((p) => {
    const facts = `
      <div class="fact">
        <span class="fact-label">Light</span>
        <span class="fact-value">${p.light}</span>
      </div>
      <div class="fact">
        <span class="fact-label">Water</span>
        <span class="fact-value">${p.task}</span>
      </div>
      <div class="fact">
        <span class="fact-label">Spot</span>
        <span class="fact-value">${p.location}</span>
      </div>`;

    const history = p.history.map((entry) => {
      const [date, ...rest] = entry.split(" · ");
      const note = rest.join(" · ");
      return `
        <li>
          ${historyIcon(note)}
          <span class="h-date">${date}</span>
          <span>${note}</span>
        </li>`;
    }).join("");

    return `
      <li class="plant" data-id="${p.id}">
        <button class="expand" type="button"
          aria-expanded="false"
          aria-controls="detail-${p.id}">
          <span class="leaf-tile" style="--tint:var(--tint-${p.tint})">${leafSVG(p.id)}</span>
          <span class="meta">
            <span class="name">${p.name}</span>
            <span class="sub">${p.species} · ${p.location}</span>
            <span class="task-row">
              <span class="task-chip">${p.task}</span>
              <span class="due ${dueClass(p.offset)}">${dueLabel(p.offset)}</span>
            </span>
          </span>
          <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="actions">
          <button class="btn primary" type="button" data-action="watered" data-id="${p.id}">${PAST[p.task]}</button>
          <button class="btn ghost" type="button" data-action="snooze" data-id="${p.id}">Snooze</button>
        </div>
        <div class="detail" id="detail-${p.id}" role="region" aria-label="${p.name} care details">
          <div class="detail-inner">
            <div class="detail-body">
              <div class="facts">${facts}</div>
              <h4 class="log-title">Care log</h4>
              <ul class="history">${history}</ul>
            </div>
          </div>
        </div>
      </li>`;
  }).join("");

  bindExpands();
  bindActions();

  const doneEl = el("all-done");
  if (queue.length === 0) {
    el("all-done-sub").textContent =
      `${done.length} ${done.length === 1 ? "plant" : "plants"} watered, ${todayStamp()} — and not a single leaf complains.`;
    el("done-list").innerHTML = done.map((p) => `
      <li><span class="tick" aria-hidden="true">✓</span>${p.name} · ${PAST[p.task]}</li>`).join("");
    doneEl.hidden = false;
  } else {
    doneEl.hidden = true;
  }
}

function bindExpands() {
  document.querySelectorAll(".expand").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      panel.classList.toggle("open", !open);
    });
  });
}

function bindActions() {
  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const plant = PLANTS.find((p) => p.id === btn.dataset.id);
      if (btn.dataset.action === "watered") markWatered(plant, btn);
      else snooze(plant);
    });
  });
}

/* ---------- Actions ---------- */

function todayStamp() {
  const now = new Date();
  return `${MONTHS[now.getMonth()]} ${now.getDate()}`;
}

function markWatered(plant, btn) {
  const snap = snapshot(plant);
  plant.done = true;
  plant.history.unshift(`${todayStamp()} · ${PAST[plant.task]}`);

  const item = btn.closest(".plant");
  if (item) {
    item.classList.add("leaving");
    setTimeout(render, 320);
  } else {
    render();
  }
  showToast(`${plant.name} ${PAST[plant.task].toLowerCase()}.`, () => {
    restore(plant, snap);
    render();
  });
}

function snooze(plant) {
  const snap = snapshot(plant);
  plant.offset += 1;
  plant.urgency = Math.max(0, plant.urgency - 1);
  render();
  showToast(`${plant.name} snoozed to ${dueLabel(plant.offset).toLowerCase()}.`, () => {
    restore(plant, snap);
    render();
  });
}

function snapshot(plant) {
  return { ...plant, history: [...plant.history] };
}

function restore(plant, snap) {
  Object.assign(plant, snap);
}

/* ---------- Toast / undo ---------- */

let toastTimer = null;
let pendingUndo = null;

function showToast(message, undo) {
  const toast = el("toast");
  const msg = el("toast-msg");
  const undoBtn = el("toast-undo");

  clearTimeout(toastTimer);
  msg.textContent = message;
  pendingUndo = undo || null;
  undoBtn.hidden = !undo;

  toast.hidden = false;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");

  toastTimer = setTimeout(hideToast, 6000);
}

function hideToast() {
  el("toast").hidden = true;
  pendingUndo = null;
}

el("toast-undo").addEventListener("click", () => {
  if (pendingUndo) pendingUndo();
  hideToast();
});

/* ---------- Init ---------- */

renderHeader();
renderRhythm();
render();
