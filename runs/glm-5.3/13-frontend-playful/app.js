/* Moss — gentle plant care. No network, no storage, no drama. */
(() => {
  "use strict";

  /* ————— Data (mirrors PLANTS.json) ————— */

  const PLANTS = [
    { id: "fern", name: "Frida", species: "Boston fern", location: "Bathroom", task: "Water", due: "2 days overdue", urgency: 4, light: "Low, indirect", history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"] },
    { id: "pothos", name: "Orbit", species: "Golden pothos", location: "Bookshelf", task: "Rotate", due: "Today", urgency: 2, light: "Medium, indirect", history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"] },
    { id: "cactus", name: "Dot", species: "Bunny ears cactus", location: "South window", task: "Check soil", due: "Today", urgency: 1, light: "Bright, direct", history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"] },
    { id: "calathea", name: "Drama", species: "Calathea orbifolia", location: "Bedroom", task: "Mist", due: "Tomorrow", urgency: 0, light: "Medium, filtered", history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"] }
  ];
  const WEEK = [1, 3, 2, 4, 2, 1, 3];
  const DAY_LETTERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  PLANTS.forEach((p) => {
    p.hist = p.history.map((s) => {
      const [d, t] = s.split(" · ");
      return { d, t };
    });
  });

  const ACC = {
    fern: ["#5d7c4e", "#dfe8d2"],
    pothos: ["#a3903c", "#efe6c4"],
    cactus: ["#6f9d84", "#dcead9"],
    calathea: ["#8d7fa8", "#e3ddec"]
  };
  const VERB = { Water: "Watered", Rotate: "Rotated", "Check soil": "Checked", Mist: "Misted" };
  const DONE_MSG = {
    fern: "Frida got a long, grateful drink.",
    pothos: "Orbit took a quarter-turn toward the window.",
    cactus: "Dot’s soil was checked — sleepy, but fine.",
    calathea: "Drama received the spa-mist treatment."
  };
  const NOTE = {
    fern: "Frida’s fronds droop politely when thirsty.",
    pothos: "Orbit leans toward the window mid-chapter.",
    cactus: "Dot’s soil may still be sleepy from August.",
    calathea: "Drama demands humidity, as is Drama’s way."
  };

  /* ————— Little icons (inline SVG) ————— */

  const ICONS = {
    check: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 11l4.5 4.5L16.5 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    moon: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M13 3a7.2 7.2 0 1 0 4 9.4A6.4 6.4 0 0 1 13 3Z" fill="currentColor"/></svg>',
    chev: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7.5 10 13l6-5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sun: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="#d9a13c"/><g stroke="#d9a13c" stroke-width="2" stroke-linecap="round"><path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M16 4l-1.4 1.4M5.4 14.6 4 16"/></g></svg>',
    flag: '<svg class="ic" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2v16" stroke="#c05a35" stroke-width="2.4" stroke-linecap="round"/><path d="M6.5 3.5h9l-3 3.2 3 3.3h-9z" fill="#c05a35"/></svg>'
  };

  /* ————— Plant portraits (inline SVG) ————— */

  const ART = {
    fern: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke="#516c3c" stroke-width="3.4" stroke-linecap="round">
        <path d="M32 60C31 42 27 26 19 12"/>
        <path d="M32 60C32 40 32 24 34 8"/>
        <path d="M32 60C34 44 39 27 47 14"/>
        <path d="M32 60C25 48 16 41 7 38"/>
        <path d="M32 60C39 48 49 42 57 40"/>
      </g>
      <g fill="#7fa55e">
        <circle cx="27" cy="44" r="2.6"/><circle cx="22" cy="30" r="2.6"/><circle cx="18" cy="19" r="2.4"/>
        <circle cx="33" cy="46" r="2.6"/><circle cx="33" cy="32" r="2.6"/><circle cx="34" cy="17" r="2.4"/>
        <circle cx="38" cy="45" r="2.6"/><circle cx="43" cy="30" r="2.6"/><circle cx="46" cy="19" r="2.4"/>
        <circle cx="21" cy="46" r="2.2"/><circle cx="13" cy="40" r="2.2"/>
        <circle cx="44" cy="47" r="2.2"/><circle cx="52" cy="41" r="2.2"/>
      </g>
    </svg>`,
    pothos: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 58C22 52 18 42 28 33c9-8 16-14 28-20" fill="none" stroke="#6b8a4a" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="19" cy="46" rx="8" ry="5.6" fill="#7fa05a" transform="rotate(-22 19 46)"/>
      <ellipse cx="33" cy="32" rx="9" ry="6.4" fill="#a4bb61" transform="rotate(-28 33 32)"/>
      <ellipse cx="47" cy="19" rx="8" ry="5.6" fill="#7fa05a" transform="rotate(-38 47 19)"/>
      <ellipse cx="12" cy="54" rx="5.6" ry="4.2" fill="#b7c46e" transform="rotate(14 12 54)"/>
      <ellipse cx="55" cy="26" rx="5.6" ry="4.2" fill="#b7c46e" transform="rotate(60 55 26)"/>
    </svg>`,
    cactus: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <g fill="#7fae8f" stroke="#5d8d70" stroke-width="2.4">
        <rect x="16" y="24" width="13" height="34" rx="6.5"/>
        <rect x="35" y="16" width="13" height="42" rx="6.5"/>
        <rect x="26" y="36" width="12" height="22" rx="6"/>
      </g>
      <g stroke="#f4e9c8" stroke-width="2" stroke-linecap="round">
        <path d="M16 32l-6-4"/><path d="M17 44l-6 4"/>
        <path d="M44 24l6-4"/><path d="M45 36l6 4"/>
        <path d="M28 26l-4-6"/><path d="M28 46l-4 6"/>
      </g>
      <circle cx="41.5" cy="13.5" r="4.2" fill="#e8a1a8"/>
    </svg>`,
    calathea: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 60V44" stroke="#5a7a55" stroke-width="3" stroke-linecap="round" fill="none"/>
      <ellipse cx="19" cy="40" rx="10" ry="13" fill="#94ab73" transform="rotate(-22 19 40)"/>
      <ellipse cx="34" cy="30" rx="16" ry="20" fill="#7c9a6d" transform="rotate(6 34 30)"/>
      <g fill="none" stroke="#d9e6c8" stroke-width="2.4" stroke-linecap="round">
        <path d="M33 48C26 40 25 24 29 13"/>
        <path d="M34 48C34 38 35 22 36 12"/>
        <path d="M36 48C42 40 44 25 41 14"/>
        <path d="M15 46c-3-4-3-10 1-15"/>
        <path d="M22 46c-3-4-3-10 1-14"/>
      </g>
    </svg>`
  };

  /* ————— Moss the mascot ————— */

  function mossSVG(mood) {
    const asleep = mood === "sleep";
    const eyes = asleep
      ? '<path d="M31 52q4.5 5 9 0M56 52q4.5 5 9 0" fill="none" stroke="#2e2a20" stroke-width="2.6" stroke-linecap="round"/>'
      : '<circle cx="35.5" cy="52" r="3.6" fill="#2e2a20"/><circle cx="60.5" cy="52" r="3.6" fill="#2e2a20"/>';
    const zzz = asleep
      ? '<g class="zzz" fill="#8a7a5c" font-weight="700"><text x="64" y="34" font-size="15">z</text><text x="74" y="22" font-size="12">z</text><text x="82" y="12" font-size="10">z</text></g>'
      : "";
    return `<svg viewBox="0 0 96 108" aria-hidden="true">
      <path d="M48 24C49 17 48 12 48 8" fill="none" stroke="#5c7a45" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="39" cy="9" rx="8.5" ry="4.6" fill="#7fae5e" transform="rotate(-16 39 9)"/>
      <ellipse cx="57" cy="9" rx="8.5" ry="4.6" fill="#93bd6d" transform="rotate(16 57 9)"/>
      <path d="M48 26c21 0 40 14 40 34 0 21-17 34-40 34S8 81 8 60C8 40 27 26 48 26Z" fill="#8fa96b"/>
      <g fill="#759058"><circle cx="27" cy="44" r="2.8"/><circle cx="70" cy="60" r="2.4"/><circle cx="42" cy="88" r="2.8"/><circle cx="67" cy="38" r="2.2"/><circle cx="22" cy="66" r="2.2"/></g>
      <ellipse cx="29" cy="60" rx="4.6" ry="2.8" fill="#d99f76" opacity=".55"/>
      <ellipse cx="67" cy="60" rx="4.6" ry="2.8" fill="#d99f76" opacity=".55"/>
      ${eyes}
      <path d="M43 64q5 5 10 0" fill="none" stroke="#2e2a20" stroke-width="2.4" stroke-linecap="round"/>
      ${zzz}
    </svg>`;
  }

  /* ————— State ————— */

  const state = { handled: {}, open: new Set() };
  const rows = new Map();
  let hideTimer = null;
  let wasAllDone = false;

  /* ————— Elements ————— */

  const $ = (id) => document.getElementById(id);
  const list = $("queue-list");
  const queueTitle = $("queue-title");
  const queueSummary = $("queue-summary");
  const allDoneBox = $("all-done");
  const allDoneTitle = $("all-done-title");
  const doneLog = $("done-log");
  const toastBox = $("toast");
  const moodArt = $("mood-moss");
  const moodMsg = $("mood-msg");

  /* ————— Helpers ————— */

  const plant = (id) => PLANTS.find((p) => p.id === id);
  const dueClass = (due) => (due.includes("overdue") ? "overdue" : due === "Today" ? "today" : "tomorrow");

  function defaultActionsHTML(p) {
    return `
      <button type="button" class="btn btn-primary" data-action="done" data-id="${p.id}">${ICONS.check}<span>${VERB[p.task]}</span></button>
      <button type="button" class="btn btn-ghost" data-action="snooze" data-id="${p.id}">${ICONS.moon}<span>Snooze</span></button>
      <button type="button" class="btn btn-details" data-action="toggle" data-id="${p.id}" aria-expanded="false" aria-controls="panel-${p.id}">
        <span>Light &amp; history</span>${ICONS.chev}
      </button>`;
  }

  function buildRow(p) {
    const li = document.createElement("li");
    li.className = "plant-row";
    li.dataset.id = p.id;
    li.style.setProperty("--accent", ACC[p.id][0]);
    li.style.setProperty("--accent-soft", ACC[p.id][1]);
    li.innerHTML = `
      <div class="row-main">
        <div class="art-wrap" aria-hidden="true">${ART[p.id]}</div>
        <div class="row-info">
          <p class="row-topline"><span class="due-pill" data-due="${dueClass(p.due)}">${p.due}</span></p>
          <h3 class="plant-name">${p.name}</h3>
          <p class="plant-meta">${p.species} · ${p.location}</p>
          <p class="plant-note">${NOTE[p.id]}</p>
        </div>
      </div>
      <div class="row-actions" role="group" aria-label="${p.name} actions">${defaultActionsHTML(p)}</div>
      <div class="plant-panel" id="panel-${p.id}" role="region" aria-label="${p.name}: light and history" hidden>
        <div class="panel-inner">
          <div class="panel-light">
            <h4>Light at ${p.location}</h4>
            <p class="light-line">${ICONS.sun}<span>${p.light}</span></p>
          </div>
          <div class="panel-history">
            <h4>Recent notes</h4>
            <ol class="history">${p.hist
              .map((h) => `<li><span class="hist-date">${h.d}</span> ${h.t}</li>`)
              .join("")}</ol>
          </div>
        </div>
      </div>`;
    return li;
  }

  function sortedIds() {
    const rank = (p) => {
      const k = state.handled[p.id];
      if (k === "watered") return 300;
      if (k === "snoozed") return 200;
      return 100 - p.urgency;
    };
    return [...PLANTS].sort((a, b) => rank(a) - rank(b)).map((p) => p.id);
  }

  function orderRows() {
    sortedIds().forEach((id) => list.appendChild(rows.get(id)));
    list.querySelectorAll(".flag").forEach((f) => f.remove());
    const firstOverdue = sortedIds().find(
      (id) => !state.handled[id] && dueClass(plant(id).due) === "overdue"
    );
    if (firstOverdue) {
      rows.get(firstOverdue)
        .querySelector(".row-topline")
        .insertAdjacentHTML("beforeend", `<span class="flag">${ICONS.flag}<span>Needs you most</span></span>`);
    }
  }

  function setHandledUI(p) {
    const kind = state.handled[p.id] || null;
    const li = rows.get(p.id);
    li.classList.toggle("is-done", kind === "watered");
    li.classList.toggle("is-snoozed", kind === "snoozed");
    li.classList.toggle("is-overdue", !kind && dueClass(p.due) === "overdue");
    const pill = li.querySelector(".due-pill");
    const actions = li.querySelector(".row-actions");
    if (!kind) {
      pill.textContent = p.due;
      pill.dataset.due = dueClass(p.due);
      actions.innerHTML = defaultActionsHTML(p);
      const open = state.open.has(p.id);
      const btn = actions.querySelector('[data-action="toggle"]');
      if (btn) btn.setAttribute("aria-expanded", String(open));
      return null;
    }
    if (kind === "watered") {
      pill.textContent = "Tended today";
      pill.dataset.due = "done";
      actions.innerHTML = `<p class="status-chip chip-done" tabindex="-1">${ICONS.check}<span>${VERB[p.task]} · today</span></p>`;
    } else {
      pill.textContent = "Snoozed · tomorrow";
      pill.dataset.due = "snoozed";
      actions.innerHTML = `<p class="status-chip chip-snooze" tabindex="-1">${ICONS.moon}<span>Snoozed till tomorrow</span></p>`;
    }
    return actions.querySelector(".status-chip");
  }

  function celebrate(id) {
    const art = rows.get(id)?.querySelector(".art-wrap");
    if (!art) return;
    art.classList.remove("bloom");
    void art.offsetWidth;
    art.classList.add("bloom");
  }

  /* ————— Toast + undo ————— */

  function showToast(msg, onUndo) {
    clearTimeout(hideTimer);
    toastBox.textContent = "";
    const card = document.createElement("div");
    card.className = "toast-card";
    const msgP = document.createElement("p");
    msgP.className = "toast-msg";
    msgP.textContent = msg;
    card.append(msgP);
    if (onUndo) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-primary btn-undo";
      btn.textContent = "Undo";
      btn.addEventListener("click", () => {
        hideToast();
        onUndo();
      });
      card.append(btn);
    }
    toastBox.append(card);
    toastBox.classList.add("show");
    hideTimer = setTimeout(hideToast, 7000);
  }
  function hideToast() {
    clearTimeout(hideTimer);
    toastBox.classList.remove("show");
  }

  /* ————— Actions ————— */

  function doDone(p) {
    state.handled[p.id] = "watered";
    const chip = setHandledUI(p);
    celebrate(p.id);
    orderRows();
    updateAll();
    showToast(DONE_MSG[p.id], () => revertTo(p, null));
    if (chip) chip.focus();
  }

  function doSnooze(p) {
    state.handled[p.id] = "snoozed";
    const chip = setHandledUI(p);
    orderRows();
    updateAll();
    showToast(`${p.name} will wait until tomorrow — no hard feelings.`, () => revertTo(p, null));
    if (chip) chip.focus();
  }

  function revertTo(p, prev) {
    if (prev == null) delete state.handled[p.id];
    else state.handled[p.id] = prev;
    setHandledUI(p);
    orderRows();
    updateAll();
    const btn = rows.get(p.id).querySelector(".btn-primary");
    if (btn) btn.focus();
    showToast(`Rewound — ${p.name} is back on today’s plate.`);
  }

  function doToggle(id, btn) {
    const panel = document.getElementById("panel-" + id);
    const willOpen = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) {
      state.open.add(id);
      panel.hidden = false;
      panel.classList.remove("pop");
      void panel.offsetWidth;
      panel.classList.add("pop");
    } else {
      state.open.delete(id);
      panel.hidden = true;
    }
  }

  /* ————— Summary / mood / all-done ————— */

  function computeStats() {
    const active = PLANTS.filter((p) => !state.handled[p.id]);
    return {
      active: active.length,
      overdue: active.filter((p) => dueClass(p.due) === "overdue").length,
      tended: PLANTS.filter((p) => state.handled[p.id] === "watered").length,
      snoozed: PLANTS.filter((p) => state.handled[p.id] === "snoozed").length
    };
  }

  function moodMessage(s) {
    if (s.overdue > 0) return "Someone is overdue and slightly dramatic about it. We’re coming, we’re coming.";
    if (s.active > 0) return `${s.active} little ${s.active === 1 ? "job" : "jobs"} before sunset. Moss believes in you.`;
    return "Everything is calm. Moss is having a small lie-down in the shade.";
  }

  function updateAll() {
    const s = computeStats();
    const allDone = s.active === 0;

    queueSummary.textContent = allDone
      ? "All four tended. Go put the kettle on."
      : `${s.active} to care for · ${s.overdue} overdue` + (s.snoozed ? ` · ${s.snoozed} snoozed` : "") + (s.tended ? ` · ${s.tended} done` : "");
    $("g-active").textContent = s.active;
    $("g-overdue").textContent = s.overdue;
    $("g-done").textContent = s.tended;
    moodMsg.textContent = moodMessage(s);
    moodArt.innerHTML = mossSVG(allDone ? "sleep" : "awake");

    allDoneBox.hidden = !allDone;
    list.hidden = allDone;
    if (allDone) {
      doneLog.innerHTML = PLANTS.map((p) =>
        state.handled[p.id] === "watered"
          ? `<li>${ICONS.check}<span><strong>${p.name}</strong> — ${VERB[p.task].toLowerCase()}, happily</span></li>`
          : `<li>${ICONS.moon}<span><strong>${p.name}</strong> — snoozed till tomorrow</span></li>`
      ).join("");
      if (!wasAllDone) allDoneTitle.focus();
    }
    wasAllDone = allDone;
  }

  /* ————— Weekly rhythm ————— */

  function renderRhythm() {
    const todayIdx = (new Date().getDay() + 6) % 7;
    const W = 26, GAP = 10, x0 = 8, baseY = 92, maxH = 62;
    const max = Math.max(...WEEK);
    const peakIdx = WEEK.indexOf(max);
    let bars = "";
    WEEK.forEach((v, i) => {
      const h = 12 + (v / max) * maxH;
      const x = x0 + i * (W + GAP);
      const y = baseY - h;
      const today = i === todayIdx;
      bars += `<rect x="${x}" y="${y}" width="${W}" height="${h}" rx="11" fill="${today ? "#556639" : "#c2cfa2"}"${today ? ' class="bar-today"' : ""}/>`;
      if (v === max) bars += `<circle cx="${x + W / 2}" cy="${y - 9}" r="4" fill="#c05a35"/>`;
      bars += `<text x="${x + W / 2}" y="${baseY + 17}" text-anchor="middle" font-size="11" fill="#6f6049">${DAY_LETTERS[i]}</text>`;
      if (today) bars += `<circle cx="${x + W / 2}" cy="${baseY + 25}" r="2.6" fill="#c05a35"/>`;
    });
    const label = `Care moments per day, Monday through Sunday: ${WEEK.map((v, i) => `${DAY_FULL[i]} ${v}`).join(", ")}. Today is ${DAY_FULL[todayIdx]}.`;
    $("rhythm").innerHTML = `
      <svg viewBox="0 0 258 122" role="img" aria-label="${label}">${bars}</svg>
      <figcaption>Clay dot marks the busiest day (${DAY_FULL[peakIdx]}). Today: ${DAY_FULL[todayIdx]}.</figcaption>`;
  }

  /* ————— Wiring ————— */

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "done") doDone(plant(id));
    else if (action === "snooze") doSnooze(plant(id));
    else if (action === "toggle") doToggle(id, btn);
  });

  $("replay").addEventListener("click", () => {
    PLANTS.forEach((p) => delete state.handled[p.id]);
    PLANTS.forEach((p) => setHandledUI(p));
    orderRows();
    updateAll();
    hideToast();
    queueTitle.focus();
  });

  function init() {
    $("today-line").textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    }).format(new Date());
    $("hero-moss").innerHTML = mossSVG("awake");
    $("all-done-art").innerHTML = mossSVG("sleep");
    PLANTS.forEach((p) => rows.set(p.id, buildRow(p)));
    orderRows();
    renderRhythm();
    updateAll();
  }

  init();
})();
