/* Moss — care queue logic (no network, data inlined from PLANTS.json) */

const PLANTS = [
  {
    id: "fern",
    name: "Frida",
    species: "Boston fern",
    location: "Bathroom",
    task: "Water",
    due: "2 days overdue",
    urgency: 4,
    light: "Low, indirect",
    history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"],
  },
  {
    id: "pothos",
    name: "Orbit",
    species: "Golden pothos",
    location: "Bookshelf",
    task: "Rotate",
    due: "Today",
    urgency: 2,
    light: "Medium, indirect",
    history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"],
  },
  {
    id: "cactus",
    name: "Dot",
    species: "Bunny ears cactus",
    location: "South window",
    task: "Check soil",
    due: "Today",
    urgency: 1,
    light: "Bright, direct",
    history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"],
  },
  {
    id: "calathea",
    name: "Drama",
    species: "Calathea orbifolia",
    location: "Bedroom",
    task: "Mist",
    due: "Tomorrow",
    urgency: 0,
    light: "Medium, filtered",
    history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"],
  },
];

const WEEK = [1, 3, 2, 4, 2, 1, 3];
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WATER_PIPS = { 0: 1, 1: 2, 2: 3, 3: 3, 4: 4 };

const state = {
  /** id -> "queued" | "done" | "snoozed" */
  status: Object.fromEntries(PLANTS.map((p) => [p.id, "queued"])),
  /** id -> history lines including new entries */
  histories: Object.fromEntries(PLANTS.map((p) => [p.id, [...p.history]])),
  expanded: null,
  undo: null,
  undoTimer: null,
};

const els = {
  list: document.getElementById("plant-list"),
  allDone: document.getElementById("all-done"),
  doneTitle: document.getElementById("done-title"),
  doneCopy: document.getElementById("done-copy"),
  doneCount: document.getElementById("done-count"),
  queueNote: document.getElementById("queue-note"),
  weekChart: document.getElementById("week-chart"),
  weekLegend: document.getElementById("week-legend"),
  pulseList: document.getElementById("pulse-list"),
  toast: document.getElementById("undo-toast"),
  toastText: document.getElementById("undo-text"),
  undoBtn: document.getElementById("undo-btn"),
  resetBtn: document.getElementById("reset-day"),
};

const PORTRAITS = {
  fern: `
    <svg class="plant-portrait" viewBox="0 0 64 64" aria-hidden="true">
      <path class="portrait-bg" d="M8 34c0-14 11-24 24-24s24 10 24 24-10 22-24 22S8 48 8 34z"/>
      <path class="portrait-line" d="M32 50c2-14 4-22 4-22"/>
      <path class="portrait-fill-a" d="M34 30c10-2 16-12 12-20-9 1-15 9-12 20z"/>
      <path class="portrait-fill-b" d="M32 36c-10-5-14-16-9-24 10 4 14 14 9 24z"/>
      <path class="portrait-fill-a" d="M30 28c-8-6-8-16-2-21 7 5 8 14 2 21z"/>
      <circle class="portrait-accent" cx="44" cy="14" r="2.4"/>
    </svg>`,
  pothos: `
    <svg class="plant-portrait" viewBox="0 0 64 64" aria-hidden="true">
      <path class="portrait-bg" d="M10 30c2-13 13-22 25-22 13 0 21 9 21 21 0 14-10 25-24 25S8 44 10 30z"/>
      <path class="portrait-line" d="M20 20c8 6 14 16 12 30"/>
      <path class="portrait-fill-a" d="M22 22c-2-7 3-13 9-13 1 7-3 13-9 13z"/>
      <path class="portrait-fill-b" d="M32 34c-8 1-13 7-11 13 7 0 12-6 11-13z"/>
      <path class="portrait-fill-a" d="M34 48c-1 7 4 12 10 11 0-7-4-12-10-11z"/>
      <path class="portrait-fill-b" d="M28 30c7-3 10-10 7-15-6 2-10 9-7 15z"/>
      <circle class="portrait-accent" cx="46" cy="18" r="2.4"/>
    </svg>`,
  cactus: `
    <svg class="plant-portrait" viewBox="0 0 64 64" aria-hidden="true">
      <path class="portrait-bg" d="M12 32c0-12 9-22 22-22s20 9 20 21-8 23-21 23-21-9-21-22z"/>
      <ellipse class="portrait-fill-a" cx="32" cy="38" rx="8" ry="14"/>
      <ellipse class="portrait-fill-b" cx="22" cy="28" rx="6" ry="10" transform="rotate(-18 22 28)"/>
      <ellipse class="portrait-fill-b" cx="42" cy="28" rx="6" ry="10" transform="rotate(18 42 28)"/>
      <circle class="portrait-accent" cx="32" cy="20" r="2.2"/>
      <circle class="portrait-line" cx="22" cy="26" r="1.1" fill="none" stroke-width="1.4"/>
      <circle class="portrait-line" cx="41" cy="25" r="1.1" fill="none" stroke-width="1.4"/>
      <circle class="portrait-line" cx="34" cy="36" r="1.1" fill="none" stroke-width="1.4"/>
    </svg>`,
  calathea: `
    <svg class="plant-portrait" viewBox="0 0 64 64" aria-hidden="true">
      <path class="portrait-bg" d="M8 36c0-15 11-26 25-26s23 11 23 25-10 23-24 23S8 50 8 36z"/>
      <ellipse class="portrait-fill-a" cx="26" cy="32" rx="10" ry="16" transform="rotate(-16 26 32)"/>
      <ellipse class="portrait-fill-b" cx="40" cy="30" rx="9" ry="15" transform="rotate(14 40 30)"/>
      <path class="portrait-line" d="M26 46c1-8 2-12 2-12M40 43c0-7 1-11 1-11" stroke-width="1.6"/>
      <path class="portrait-line" d="M22 24c2 4 2 8 1 12M28 22c2 4 2 8 1 12" stroke-width="1.3"/>
      <path class="portrait-line" d="M37 22c1 3 1 7 0 10M43 24c1 3 1 6 0 9" stroke-width="1.3"/>
      <circle class="portrait-accent" cx="50" cy="16" r="2.3"/>
    </svg>`,
};

function badgeClass(urgency) {
  if (urgency >= 3) return "badge-overdue";
  if (urgency >= 1) return "badge-today";
  return "badge-tomorrow";
}

function badgeLabel(plant) {
  if (plant.urgency >= 3) return "Overdue";
  if (plant.urgency >= 1) return "Today";
  return "Tomorrow";
}

function careVerb(task) {
  const map = {
    Water: "Watered",
    Rotate: "Rotated",
    Mist: "Misted",
    "Check soil": "Checked soil",
  };
  return map[task] || "Tended";
}

function actionNote(task) {
  const map = {
    Water: "Watered",
    Rotate: "Rotated",
    Mist: "Misted",
    "Check soil": "Soil checked",
  };
  return map[task] || "Tended";
}

function waterPips(urgency) {
  const level = WATER_PIPS[urgency] ?? 2;
  let html = '<div class="water-meter" aria-label="Recent watering level ' + level + ' of 4">';
  for (let i = 1; i <= 4; i++) {
    html += `<span class="water-pip${i <= level ? " is-on" : ""}"></span>`;
  }
  return html + "</div>";
}

function plantCard(plant) {
  const status = state.status[plant.id];
  const expanded = state.expanded === plant.id;
  const history = state.histories[plant.id]
    .map((h) => `<li>${escapeHtml(h)}</li>`)
    .join("");

  const actions =
    status === "queued"
      ? `
        <button type="button" class="btn btn-primary" data-action="watered" data-id="${plant.id}">
          Watered
        </button>
        <button type="button" class="btn btn-secondary" data-action="snooze" data-id="${plant.id}">
          Snooze
        </button>`
      : `
        <span class="btn btn-done-mark" aria-hidden="true">${
          status === "done" ? "Tended" : "Snoozed"
        }</span>
        <button type="button" class="btn btn-secondary" data-action="undo-inline" data-id="${plant.id}">
          Undo
        </button>`;

  return `
  <li>
    <article class="plant${status !== "queued" ? " is-done" : ""}" data-id="${plant.id}" data-urgency="${
      status === "queued" ? plant.urgency : 0
    }">
      <button
        type="button"
        class="plant-head"
        data-action="toggle"
        data-id="${plant.id}"
        aria-expanded="${expanded}"
        aria-controls="detail-${plant.id}"
      >
        ${PORTRAITS[plant.id] || ""}
        <div class="plant-meta">
          <h3 class="plant-name">${escapeHtml(plant.name)}
            <span class="plant-species">${escapeHtml(plant.species)}</span>
          </h3>
          <p class="plant-taskline">${escapeHtml(plant.task)} · ${escapeHtml(plant.location)}</p>
          <span class="plant-badge-slot badge ${badgeClass(
            status === "queued" ? plant.urgency : 0
          )}">${
            status === "queued"
              ? badgeLabel(plant) + " · " + escapeHtml(plant.due)
              : status === "done"
                ? "Tended just now"
                : "Snoozed to tomorrow"
          }</span>
        </div>
        <span class="chev" aria-hidden="true"></span>
      </button>
      <div class="plant-actions">${actions}</div>
      <div class="plant-detail" id="detail-${plant.id}"${expanded ? "" : " hidden"}>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Light</span>
            <span class="detail-value">${escapeHtml(plant.light)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Water rhythm</span>
            <span class="detail-value">${waterPips(plant.urgency)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Observation history</span>
            <h4 class="detail-history-title">Notes</h4>
            <ul class="history-list">${history}</ul>
          </div>
        </div>
      </div>
    </article>
  </li>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function counts() {
  const values = Object.values(state.status);
  return {
    queued: values.filter((s) => s === "queued").length,
    done: values.filter((s) => s === "done").length,
    snoozed: values.filter((s) => s === "snoozed").length,
  };
}

function renderWeek() {
  const max = Math.max(...WEEK);
  els.weekChart.innerHTML = WEEK.map((level, i) => {
    const h = 18 + (level / max) * 72;
    return `
      <div class="week-bar" data-level="${level}" title="${WEEK_DAYS[i]}: care level ${level} of ${max}">
        <div class="week-bar-fill" style="height:${h}%"></div>
      </div>`;
  }).join("");

  els.weekLegend.innerHTML = WEEK.map(
    (level, i) => `<li><strong>${WEEK_DAYS[i][0]}</strong>${level}</li>`
  ).join("");

  els.weekChart.setAttribute(
    "aria-label",
    `Weekly care load: ${WEEK.map((v, i) => `${WEEK_DAYS[i]} ${v}`).join(", ")}. Scale gentle to busy.`
  );
}

function renderPulse() {
  const c = counts();
  const overdueLeft = PLANTS.filter(
    (p) => state.status[p.id] === "queued" && p.urgency >= 3
  ).length;

  els.pulseList.innerHTML = `
    <li data-tone="overdue"><span>Overdue waiting</span><span class="pulse-count">${overdueLeft}</span></li>
    <li><span>In queue</span><span class="pulse-count">${c.queued}</span></li>
    <li data-tone="done"><span>Tended</span><span class="pulse-count">${c.done}</span></li>
    <li data-tone="snoozed"><span>Snoozed</span><span class="pulse-count">${c.snoozed}</span></li>
  `;
}

function renderAllDone() {
  const c = counts();
  const empty = c.queued === 0;
  els.allDone.hidden = !empty;
  els.list.hidden = empty;

  if (!empty) {
    els.doneCount.textContent = String(c.done);
    els.queueNote.textContent =
      c.done + c.snoozed > 0
        ? "Nice. Overdue first — the rest can wait a breath."
        : "Overdue first — the rest can wait a breath.";
    return;
  }

  els.doneCount.textContent = String(c.done);

  if (c.snoozed === 0) {
    els.doneTitle.textContent = "All clear";
    els.doneCopy.textContent =
      "Every plant is tended. Frida can uncurl, Orbit can turn toward the light, Dot can ignore you majestically.";
    els.queueNote.textContent = "Queue empty. Well done.";
  } else if (c.done === 0) {
    els.doneTitle.textContent = "Queue postponed";
    els.doneCopy.textContent = `Everything snoozed to tomorrow (${c.snoozed}). The plants will keep. Start a fresh day when you are ready.`;
    els.queueNote.textContent = "Nothing due right now.";
  } else {
    els.doneTitle.textContent = "Today is wrapped";
    els.doneCopy.textContent = `${c.done} tended, ${c.snoozed} snoozed to tomorrow. A tidy little queue.`;
    els.queueNote.textContent = "Today’s care is complete.";
  }
}

function render() {
  // Overdue (highest urgency) first, then remaining by urgency desc
  const ordered = [...PLANTS].sort((a, b) => {
    const sa = state.status[a.id];
    const sb = state.status[b.id];
    if (sa !== sb) {
      const rank = { queued: 0, snoozed: 1, done: 2 };
      return rank[sa] - rank[sb];
    }
    return b.urgency - a.urgency;
  });

  els.list.innerHTML = ordered.map(plantCard).join("");
  renderWeek();
  renderPulse();
  renderAllDone();
}

function showToast(message, undoFn) {
  clearTimeout(state.undoTimer);
  state.undo = undoFn;
  els.toastText.textContent = message;
  els.toast.hidden = false;
  state.undoTimer = setTimeout(hideToast, 6500);
}

function hideToast() {
  clearTimeout(state.undoTimer);
  state.undo = null;
  els.toast.hidden = true;
}

function applyAction(id, kind) {
  const plant = PLANTS.find((p) => p.id === id);
  if (!plant || state.status[id] !== "queued") return;

  const prevStatus = state.status[id];
  const prevHistory = [...state.histories[id]];

  if (kind === "watered") {
    state.status[id] = "done";
    state.histories[id] = [`Today · ${actionNote(plant.task)}`, ...state.histories[id]];
  } else {
    state.status[id] = "snoozed";
    state.histories[id] = [`Today · Snoozed to tomorrow`, ...state.histories[id]];
  }

  render();

  const label =
    kind === "watered"
      ? `${plant.name} · Watered`
      : `${plant.name} · Snoozed until tomorrow`;

  showToast(`${label}`, () => {
    state.status[id] = prevStatus;
    state.histories[id] = prevHistory;
    hideToast();
    render();
  });
}

function undoStatus(id) {
  // Inline undo after completion: revert status + newest history line
  const plant = PLANTS.find((p) => p.id === id);
  if (!plant) return;
  if (state.status[id] === "queued") return;

  state.status[id] = "queued";
  // Drop the entry this action prepended
  if (state.histories[id][0]?.startsWith("Today ·")) {
    state.histories[id] = state.histories[id].slice(1);
  }
  hideToast();
  render();
}

function toggleDetail(id) {
  state.expanded = state.expanded === id ? null : id;
  render();
  // Restore focus to the toggled head after re-render
  const head = document.querySelector(`.plant-head[data-id="${id}"]`);
  if (head) head.focus();
}

els.list.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "toggle") toggleDetail(id);
  else if (action === "watered") applyAction(id, "watered");
  else if (action === "snooze") applyAction(id, "snooze");
  else if (action === "undo-inline") undoStatus(id);
});

els.undoBtn.addEventListener("click", () => {
  if (state.undo) state.undo();
});

els.resetBtn.addEventListener("click", () => {
  state.status = Object.fromEntries(PLANTS.map((p) => [p.id, "queued"]));
  state.histories = Object.fromEntries(PLANTS.map((p) => [p.id, [...p.history]]));
  state.expanded = null;
  hideToast();
  render();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!els.toast.hidden) {
      hideToast();
      return;
    }
    if (state.expanded) {
      const id = state.expanded;
      toggleDetail(id);
    }
  }
});

render();
