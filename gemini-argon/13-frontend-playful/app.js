/**
 * Moss — Household Plant-Care Companion
 * Pure local JavaScript (Zero frameworks, zero external requests)
 */

(function () {
  "use strict";

  // Exact source dataset from PLANTS.json
  const INITIAL_DATA = {
    plants: [
      {
        id: "fern",
        name: "Frida",
        species: "Boston fern",
        location: "Bathroom",
        task: "Water",
        due: "2 days overdue",
        urgency: 4,
        light: "Low, indirect",
        history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"]
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
        history: ["Sep 20 · Watered", "Sep 14 · Rotated", "Sep 10 · Wiped leaves"]
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
        history: ["Sep 08 · Watered", "Sep 01 · New pad noted", "Aug 22 · Rotated"]
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
        history: ["Sep 21 · Misted", "Sep 18 · Watered", "Sep 15 · Brown edge noted"]
      }
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };

  // Rich botanical care context keyed by plant id for the detail view
  const BOTANICAL_GUIDES = {
    fern: {
      waterSchedule: "Keep evenly moist · Deep soak every 4–5 days",
      waterNote: "Loves Bathroom steam; never let her root ball fully dry out.",
      lightNote: "Frosted north sill (150–300 FC). Direct sun singes outer fronds.",
      taskInstruction: "Pour lukewarm water slowly until the saucer brims, then drain excess.",
      quirk: "Throws a dramatic frond tantrum whenever the bathroom radiator kicks on."
    },
    pothos: {
      waterSchedule: "Top 2 inches dry · Water every 7–9 days",
      waterNote: "Last watered Sep 20 — roots are still comfortably hydrated today.",
      lightNote: "Ambient room glow (400–800 FC). Vines lean toward the window.",
      taskInstruction: "Give her pot a 90° clockwise turn so the trailing vines grow evenly.",
      quirk: "Currently attempting to annex a vintage hardcover dictionary on the top shelf."
    },
    cactus: {
      waterSchedule: "Bone-dry drench · Every 18–21 days",
      waterNote: "Last watered Sep 08. Only water today if a wooden skewer comes up dusty.",
      lightNote: "Full south exposure (2,000+ FC). Thrives in 6+ hours of direct sunbeams.",
      taskInstruction: "Probe 3 inches down near the rim; if cool or damp, wait another week.",
      quirk: "Looks deceptively velvety. Do not high-five the glochid bristles."
    },
    calathea: {
      waterSchedule: "Filtered water & mist · Every 5–6 days",
      waterNote: "Watered Sep 18, misted Sep 21. Queued for a gentle morning mist tomorrow.",
      lightNote: "Dappled bedroom light (350–600 FC) behind a sheer linen curtain.",
      taskInstruction: "Mist the undersides of her silver-striped leaves with rainwater or filtered water.",
      quirk: "Folds her leaves upright at 9 PM sharp with an audible rustle."
    }
  };

  const WEEK_DAYS = [
    { short: "Mon", full: "Monday", note: "Light misting check" },
    { short: "Tue", full: "Tuesday (Today)", note: "Frida, Orbit & Dot on the morning slate" },
    { short: "Wed", full: "Wednesday", note: "Midweek humidity &Drama misting" },
    { short: "Thu", full: "Thursday", note: "Peak watering day across 4 rooms" },
    { short: "Fri", full: "Friday", note: "Foliage wipe & fertilizer check" },
    { short: "Sat", full: "Saturday", note: "Easy weekend soil check" },
    { short: "Sun", full: "Sunday", note: "Weekly rotation & dead-leaf trim" }
  ];

  const TODAY_INDEX = 1; // Tuesday (matches Sep 22 & base count 3 urgent/today tasks)

  // Application State
  let state = {
    plants: [],
    week: [],
    selectedPlantId: "fern",
    expandedCardIds: { fern: true }, // Frida starts expanded on mobile/desktop so Light, Water & History are immediately visible
    activeFilter: "all",
    selectedDayIndex: TODAY_INDEX,
    reducedMotion: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    undoSnapshot: null,
    undoTimerId: null
  };

  function cloneInitialPlants() {
    return INITIAL_DATA.plants.map(function (p) {
      return {
        id: p.id,
        name: p.name,
        species: p.species,
        location: p.location,
        task: p.task,
        due: p.due,
        originalDue: p.due,
        urgency: p.urgency,
        originalUrgency: p.urgency,
        light: p.light,
        history: p.history.slice(),
        status: "pending" // "pending" | "watered" | "snoozed"
      };
    });
  }

  function resetState() {
    state.plants = cloneInitialPlants();
    state.week = INITIAL_DATA.week.slice();
    state.selectedPlantId = "fern";
    state.expandedCardIds = { fern: true };
    state.activeFilter = "all";
    state.selectedDayIndex = TODAY_INDEX;
    clearUndoToast();
    renderAll();
  }

  // Custom tactile inline SVG illustrations for each of the 4 plants
  function getPlantSVG(plant) {
    const isTended = plant.status === "watered";
    const isOverdue = plant.status === "pending" && plant.urgency >= 4;

    if (plant.id === "fern") {
      // Frida: Boston fern in striped stoneware pot
      const droopTransform = isOverdue ? "rotate(8 50 55)" : "rotate(0 50 55)";
      return `
        <svg class="plant-svg" viewBox="0 0 100 110" aria-hidden="true">
          <!-- Terracotta & cream striped pot -->
          <path d="M28 68 L72 68 L65 100 L35 100 Z" fill="#D45D3A" stroke="#231F1B" stroke-width="2.5" />
          <path d="M31 80 L69 80 M33 90 L67 90" stroke="#FBF8F1" stroke-width="3" />
          <rect x="24" y="62" width="52" height="8" rx="4" fill="#C84B31" stroke="#231F1B" stroke-width="2.5" />
          <!-- Cascading fern fronds -->
          <g class="sway-leaf" transform="${droopTransform}">
            <path d="M50 62 C35 45, 18 48, 10 66" fill="none" stroke="#376143" stroke-width="3.5" stroke-linecap="round" />
            <path d="M50 62 C65 45, 82 48, 90 66" fill="none" stroke="#376143" stroke-width="3.5" stroke-linecap="round" />
            <path d="M50 62 C42 32, 26 24, 16 34" fill="none" stroke="#558259" stroke-width="3.5" stroke-linecap="round" />
            <path d="M50 62 C58 32, 74 24, 84 34" fill="none" stroke="#558259" stroke-width="3.5" stroke-linecap="round" />
            <path d="M50 62 C50 36, 48 18, 50 12" fill="none" stroke="#376143" stroke-width="3.5" stroke-linecap="round" />
            <!-- Leaflets -->
            <ellipse cx="26" cy="48" rx="6" ry="3" transform="rotate(-25 26 48)" fill="#558259" stroke="#231F1B" stroke-width="1.5" />
            <ellipse cx="74" cy="48" rx="6" ry="3" transform="rotate(25 74 48)" fill="#558259" stroke="#231F1B" stroke-width="1.5" />
            <ellipse cx="36" cy="34" rx="6" ry="3" transform="rotate(-15 36 34)" fill="#8FB973" stroke="#231F1B" stroke-width="1.5" />
            <ellipse cx="64" cy="34" rx="6" ry="3" transform="rotate(15 64 34)" fill="#8FB973" stroke="#231F1B" stroke-width="1.5" />
            <ellipse cx="50" cy="22" rx="5" ry="8" fill="#8FB973" stroke="#231F1B" stroke-width="1.8" />
          </g>
          ${
            isOverdue
              ? `<path d="M80 18 C80 18, 86 27, 86 31 A6 6 0 1 1 74 31 C74 27, 80 18, 80 18 Z" fill="#6AA1AD" stroke="#231F1B" stroke-width="2" />`
              : ""
          }
          ${
            isTended
              ? `<circle cx="80" cy="22" r="7" fill="#C9D97E" stroke="#231F1B" stroke-width="2" />
                 <path d="M77 22 L79 25 L84 19" fill="none" stroke="#231F1B" stroke-width="2" stroke-linecap="round" />`
              : ""
          }
        </svg>
      `;
    }

    if (plant.id === "pothos") {
      // Orbit: Golden pothos trailing from an ochre pedestal pot
      return `
        <svg class="plant-svg" viewBox="0 0 100 110" aria-hidden="true">
          <!-- Ochre vessel -->
          <path d="M30 60 C30 88, 70 88, 70 60 Z" fill="#E5A336" stroke="#231F1B" stroke-width="2.5" />
          <rect x="38" y="84" width="24" height="12" rx="3" fill="#D45D3A" stroke="#231F1B" stroke-width="2.2" />
          <!-- Trailing heart leaves -->
          <g class="sway-leaf">
            <path d="M45 60 C30 48, 22 65, 16 86" fill="none" stroke="#231F1B" stroke-width="2.5" stroke-linecap="round" />
            <path d="M52 58 C56 36, 72 34, 80 48" fill="none" stroke="#231F1B" stroke-width="2.5" stroke-linecap="round" />
            <!-- Heart leaf 1 -->
            <path d="M46 38 C40 28, 28 34, 34 45 L46 54 L58 45 C64 34, 52 28, 46 38 Z" fill="#558259" stroke="#231F1B" stroke-width="2" />
            <!-- Variegated golden fleck -->
            <path d="M44 41 C42 37, 37 39, 40 44 Z" fill="#C9D97E" />
            <!-- Heart leaf 2 -->
            <path d="M76 44 C72 37, 64 41, 68 48 L76 55 L84 48 C88 41, 80 37, 76 44 Z" fill="#8FB973" stroke="#231F1B" stroke-width="2" />
            <!-- Trailing leaf 3 -->
            <path d="M18 76 C14 70, 6 74, 10 81 L18 88 L26 81 C30 74, 22 70, 18 76 Z" fill="#376143" stroke="#231F1B" stroke-width="2" />
          </g>
          <!-- Rotation orbit halo -->
          <ellipse cx="50" cy="22" rx="18" ry="5" fill="none" stroke="#231F1B" stroke-width="1.8" stroke-dasharray="3 3" />
        </svg>
      `;
    }

    if (plant.id === "cactus") {
      // Dot: Bunny ears cactus in low terracotta bowl
      return `
        <svg class="plant-svg" viewBox="0 0 100 110" aria-hidden="true">
          <!-- Terracotta dish -->
          <path d="M22 74 L78 74 L70 98 L30 98 Z" fill="#C86D51" stroke="#231F1B" stroke-width="2.5" />
          <ellipse cx="50" cy="74" rx="28" ry="5" fill="#E5A336" stroke="#231F1B" stroke-width="2.2" />
          <!-- Base pad -->
          <g class="sway-leaf">
            <ellipse cx="50" cy="56" rx="16" ry="20" fill="#558259" stroke="#231F1B" stroke-width="2.5" />
            <!-- Left bunny ear -->
            <ellipse cx="36" cy="30" rx="10" ry="15" transform="rotate(-18 36 30)" fill="#8FB973" stroke="#231F1B" stroke-width="2.3" />
            <!-- Right bunny ear -->
            <ellipse cx="64" cy="30" rx="10" ry="15" transform="rotate(18 64 30)" fill="#8FB973" stroke="#231F1B" stroke-width="2.3" />
            <!-- Glochid polka dots -->
            <circle cx="45" cy="52" r="1.8" fill="#FBF8F1" />
            <circle cx="55" cy="56" r="1.8" fill="#FBF8F1" />
            <circle cx="48" cy="64" r="1.8" fill="#FBF8F1" />
            <circle cx="35" cy="28" r="1.6" fill="#FBF8F1" />
            <circle cx="65" cy="28" r="1.6" fill="#FBF8F1" />
          </g>
        </svg>
      `;
    }

    // Drama: Calathea orbifolia with silver-striped broad leaves
    return `
      <svg class="plant-svg" viewBox="0 0 100 110" aria-hidden="true">
        <!-- Plum-charcoal stoneware pot -->
        <path d="M30 66 L70 66 L66 98 L34 98 Z" fill="#6D597A" stroke="#231F1B" stroke-width="2.5" />
        <g class="sway-leaf">
          <!-- Left striped paddle leaf -->
          <ellipse cx="34" cy="42" rx="14" ry="20" transform="rotate(-16 34 42)" fill="#376143" stroke="#231F1B" stroke-width="2.3" />
          <path d="M26 36 L34 40 M24 44 L35 48 M28 29 L35 33" stroke="#CFE1E5" stroke-width="2.2" stroke-linecap="round" />
          <!-- Right striped paddle leaf -->
          <ellipse cx="66" cy="44" rx="14" ry="19" transform="rotate(16 66 44)" fill="#558259" stroke="#231F1B" stroke-width="2.3" />
          <path d="M65 36 L74 33 M64 44 L75 41 M64 52 L73 49" stroke="#CFE1E5" stroke-width="2.2" stroke-linecap="round" />
          <!-- Center upright leaf -->
          <ellipse cx="50" cy="30" rx="12" ry="18" fill="#376143" stroke="#231F1B" stroke-width="2.3" />
          <path d="M43 24 L50 28 L57 24 M42 32 L50 36 L58 32" fill="none" stroke="#C9D97E" stroke-width="2" stroke-linecap="round" />
        </g>
      </svg>
    `;
  }

  // Trigger "Watered" or "Snooze" with full Undo snapshot
  function performPlantAction(plantId, actionType) {
    const target = state.plants.find(function (p) {
      return p.id === plantId;
    });
    if (!target) return;

    // Save snapshot for Undo
    state.undoSnapshot = {
      plants: JSON.parse(JSON.stringify(state.plants)),
      week: state.week.slice(),
      description:
        actionType === "watered"
          ? `${target.name} (${target.species}) marked as watered.`
          : `Snoozed ${target.name} until tomorrow.`
    };

    if (actionType === "watered") {
      target.status = "watered";
      target.due = "Tended today";
      target.urgency = -1;
      const stamp =
        target.task === "Water"
          ? "Sep 22 · Watered"
          : `Sep 22 · Watered & ${target.task.toLowerCase()} done`;
      if (target.history[0] !== stamp) {
        target.history.unshift(stamp);
      }
      // Increment today's rhythm bar slightly to reward live care
      state.week[TODAY_INDEX] = INITIAL_DATA.week[TODAY_INDEX] + countWateredToday();
    } else if (actionType === "snooze") {
      target.status = "snoozed";
      target.due = "Snoozed · Tomorrow";
      target.urgency = 0;
      const snoozeStamp = "Sep 22 · Snoozed 1 day";
      if (target.history[0] !== snoozeStamp) {
        target.history.unshift(snoozeStamp);
      }
    }

    state.selectedPlantId = plantId;
    showUndoToast(state.undoSnapshot.description);
    renderAll();
  }

  function waterAllDueToday() {
    const duePlants = state.plants.filter(function (p) {
      return p.status === "pending" && p.urgency >= 1;
    });
    if (duePlants.length === 0) return;

    state.undoSnapshot = {
      plants: JSON.parse(JSON.stringify(state.plants)),
      week: state.week.slice(),
      description: `Marked ${duePlants.length} due plant${duePlants.length === 1 ? "" : "s"} as watered.`
    };

    duePlants.forEach(function (p) {
      p.status = "watered";
      p.due = "Tended today";
      p.urgency = -1;
      const stamp =
        p.task === "Water"
          ? "Sep 22 · Watered"
          : `Sep 22 · Watered & ${p.task.toLowerCase()} done`;
      if (p.history[0] !== stamp) {
        p.history.unshift(stamp);
      }
    });

    state.week[TODAY_INDEX] = INITIAL_DATA.week[TODAY_INDEX] + countWateredToday();
    showUndoToast(state.undoSnapshot.description);
    renderAll();
  }

  function undoLastAction() {
    if (!state.undoSnapshot) return;
    state.plants = state.undoSnapshot.plants;
    state.week = state.undoSnapshot.week;
    state.undoSnapshot = null;
    clearUndoToast();
    renderAll();
  }

  function addObservationNote(plantId, noteText) {
    const trimmed = (noteText || "").trim();
    if (!trimmed) return;
    const plant = state.plants.find(function (p) {
      return p.id === plantId;
    });
    if (!plant) return;

    state.undoSnapshot = {
      plants: JSON.parse(JSON.stringify(state.plants)),
      week: state.week.slice(),
      description: `Added field note for ${plant.name}.`
    };

    plant.history.unshift(`Sep 22 · ${trimmed}`);
    showUndoToast(`Logged note on ${plant.name}: "${trimmed}"`);
    renderAll();
  }

  function countWateredToday() {
    return state.plants.filter(function (p) {
      return p.status === "watered";
    }).length;
  }

  // Undo Toast UI Management
  function showUndoToast(message) {
    const toast = document.getElementById("undo-toast");
    const msgEl = document.getElementById("undo-toast-message");
    const barEl = document.getElementById("undo-progress-bar");

    if (state.undoTimerId) {
      clearTimeout(state.undoTimerId);
    }

    msgEl.textContent = message;
    toast.hidden = false;

    // Reset progress bar animation
    barEl.style.transition = "none";
    barEl.style.transform = "scaleX(1)";
    void barEl.offsetWidth;
    if (!state.reducedMotion) {
      barEl.style.transition = "transform 8s linear";
      barEl.style.transform = "scaleX(0)";
    }

    state.undoTimerId = setTimeout(function () {
      clearUndoToast();
    }, 8000);
  }

  function clearUndoToast() {
    if (state.undoTimerId) {
      clearTimeout(state.undoTimerId);
      state.undoTimerId = null;
    }
    const toast = document.getElementById("undo-toast");
    if (toast) {
      toast.hidden = true;
    }
  }

  // Render a single plant card with inline expandable Light, Water & History drawer
  function renderPlantCard(plant) {
    const guide = BOTANICAL_GUIDES[plant.id];
    const isExpanded = Boolean(state.expandedCardIds[plant.id]);
    const isSelected = state.selectedPlantId === plant.id;

    let variantClass = "plant-card--tomorrow";
    if (plant.status === "watered") {
      variantClass = "plant-card--tended";
    } else if (plant.status === "snoozed") {
      variantClass = "plant-card--snoozed";
    } else if (plant.urgency >= 4) {
      variantClass = "plant-card--overdue";
    } else if (plant.id === "pothos") {
      variantClass = "plant-card--today-rotate";
    } else if (plant.id === "cactus") {
      variantClass = "plant-card--today-soil";
    }

    let badgeClass = "badge-due--tomorrow";
    if (plant.status === "watered") {
      badgeClass = "badge-due--tended";
    } else if (plant.status === "snoozed") {
      badgeClass = "badge-due--snoozed";
    } else if (plant.urgency >= 4) {
      badgeClass = "badge-due--overdue";
    } else if (plant.urgency >= 1) {
      badgeClass = "badge-due--today";
    }

    const historyItemsHtml = plant.history
      .map(function (entry, idx) {
        const isNew = idx === 0 && entry.indexOf("Sep 22") === 0;
        return `
          <li class="history-entry ${isNew ? "history-entry--new" : ""}">
            <span class="history-dot" aria-hidden="true"></span>
            <span>${escapeHtml(entry)}</span>
          </li>
        `;
      })
      .join("");

    const wateredBtnLabel =
      plant.status === "watered" ? "✓ Watered today" : "Watered";
    const snoozeBtnLabel =
      plant.status === "snoozed" ? "Snoozed (1d)" : "Snooze";

    return `
      <article
        class="plant-card ${variantClass} ${isSelected ? "is-selected" : ""}"
        role="listitem"
        data-plant-id="${plant.id}"
        aria-label="${escapeHtml(plant.name)} (${escapeHtml(plant.species)}) — ${escapeHtml(plant.due)}"
      >
        <div class="card-top-row">
          <div
            class="plant-illo-alcove"
            data-action="select-plant"
            data-plant-id="${plant.id}"
            title="Inspect ${escapeHtml(plant.name)} in the specimen dossier"
          >
            ${getPlantSVG(plant)}
          </div>

          <div class="card-main-info">
            <div class="card-badges">
              <span class="badge-due ${badgeClass}">${escapeHtml(plant.due)}</span>
              <span class="badge-location">${escapeHtml(plant.location)}</span>
            </div>

            <div class="plant-title-row">
              <button
                type="button"
                class="plant-name-btn"
                data-action="toggle-expand"
                data-plant-id="${plant.id}"
                aria-expanded="${isExpanded ? "true" : "false"}"
                aria-controls="drawer-${plant.id}"
              >
                ${escapeHtml(plant.name)}
              </button>
              <span class="plant-species">${escapeHtml(plant.species)}</span>
            </div>

            <div class="task-callout">
              <span class="task-icon-pill">${escapeHtml(plant.task)}</span>
              <span class="task-desc">${escapeHtml(guide.taskInstruction)}</span>
            </div>

            <div class="card-quick-meta">
              <span class="meta-chip" title="Light requirement">
                ☀ Light: <strong>${escapeHtml(plant.light)}</strong>
              </span>
              <span class="meta-chip" title="Latest log entry">
                ✎ Last: <strong>${escapeHtml(plant.history[0])}</strong>
              </span>
            </div>
          </div>
        </div>

        <div class="card-actions-row">
          <div class="primary-care-btns">
            <button
              type="button"
              class="btn-watered ${plant.status === "watered" ? "is-done" : ""}"
              data-action="watered"
              data-plant-id="${plant.id}"
              aria-label="Mark ${escapeHtml(plant.name)} as watered"
            >
              <span>💧 ${wateredBtnLabel}</span>
            </button>

            <button
              type="button"
              class="btn-snooze ${plant.status === "snoozed" ? "is-snoozed" : ""}"
              data-action="snooze"
              data-plant-id="${plant.id}"
              aria-label="Snooze ${escapeHtml(plant.name)} until tomorrow"
            >
              <span>🌙 ${snoozeBtnLabel}</span>
            </button>
          </div>

          <button
            type="button"
            class="btn-expand-details"
            data-action="toggle-expand"
            data-plant-id="${plant.id}"
            aria-expanded="${isExpanded ? "true" : "false"}"
            aria-controls="drawer-${plant.id}"
          >
            <span>${isExpanded ? "Hide light & history" : "Light, water & history"}</span>
          </button>
        </div>

        <!-- Expandable Plant Detail Drawer (Light, Water, and Observation History) -->
        <div
          id="drawer-${plant.id}"
          class="card-detail-drawer"
          ${isExpanded ? "" : "hidden"}
        >
          <div class="detail-specs-grid">
            <div class="spec-tile">
              <span class="spec-tile-label">☀ Light Needs</span>
              <strong class="spec-tile-value">${escapeHtml(plant.light)}</strong>
              <span class="spec-tile-note">${escapeHtml(guide.lightNote)}</span>
            </div>
            <div class="spec-tile">
              <span class="spec-tile-label">💧 Watering Cadence</span>
              <strong class="spec-tile-value">${escapeHtml(guide.waterSchedule)}</strong>
              <span class="spec-tile-note">${escapeHtml(guide.waterNote)}</span>
            </div>
          </div>

          <h3 class="history-block-title">Observation &amp; Care History</h3>
          <ul class="history-timeline" aria-label="${escapeHtml(plant.name)} observation history">
            ${historyItemsHtml}
          </ul>

          <form class="observation-form" data-plant-id="${plant.id}">
            <label class="sr-only-svg" for="note-input-${plant.id}">Add observation for ${escapeHtml(plant.name)}</label>
            <input
              id="note-input-${plant.id}"
              type="text"
              class="observation-input"
              name="observation"
              placeholder="Add field note (e.g., New leaf unfurling)..."
              maxlength="60"
            />
            <button type="submit" class="btn-log-note">Log note</button>
          </form>
        </div>
      </article>
    `;
  }

  // Render the Sticky Right-Hand Specimen Dossier (Full Plant Detail View)
  function renderDossier() {
    const dossierEl = document.getElementById("specimen-dossier");
    const plant =
      state.plants.find(function (p) {
        return p.id === state.selectedPlantId;
      }) || state.plants[0];
    const guide = BOTANICAL_GUIDES[plant.id];

    const historyHtml = plant.history
      .map(function (entry, idx) {
        const isNew = idx === 0 && entry.indexOf("Sep 22") === 0;
        return `
          <li class="history-entry ${isNew ? "history-entry--new" : ""}">
            <span class="history-dot" aria-hidden="true"></span>
            <span>${escapeHtml(entry)}</span>
          </li>
        `;
      })
      .join("");

    dossierEl.innerHTML = `
      <div class="dossier-header">
        <div class="dossier-portrait" aria-hidden="true">
          ${getPlantSVG(plant)}
        </div>
        <div class="dossier-title-block">
          <span class="dossier-eyebrow">Specimen Dossier · ${escapeHtml(plant.location)}</span>
          <h2 id="dossier-heading" class="dossier-name">${escapeHtml(plant.name)}</h2>
          <p class="dossier-species">${escapeHtml(plant.species)}</p>
          <span class="badge-due ${plant.urgency >= 4 ? "badge-due--overdue" : plant.status === "watered" ? "badge-due--tended" : "badge-due--today"}">
            ${escapeHtml(plant.task)} · ${escapeHtml(plant.due)}
          </span>
        </div>
      </div>

      <p class="dossier-quirk">“${escapeHtml(guide.quirk)}”</p>

      <div class="dossier-actions">
        <button
          type="button"
          class="btn-watered ${plant.status === "watered" ? "is-done" : ""}"
          data-action="watered"
          data-plant-id="${plant.id}"
        >
          💧 ${plant.status === "watered" ? "✓ Watered today" : "Watered"}
        </button>
        <button
          type="button"
          class="btn-snooze ${plant.status === "snoozed" ? "is-snoozed" : ""}"
          data-action="snooze"
          data-plant-id="${plant.id}"
        >
          🌙 ${plant.status === "snoozed" ? "Snoozed (1d)" : "Snooze"}
        </button>
      </div>

      <div class="detail-specs-grid">
        <div class="spec-tile">
          <span class="spec-tile-label">☀ Light Profile</span>
          <strong class="spec-tile-value">${escapeHtml(plant.light)}</strong>
          <span class="spec-tile-note">${escapeHtml(guide.lightNote)}</span>
        </div>
        <div class="spec-tile">
          <span class="spec-tile-label">💧 Water &amp; Humidity</span>
          <strong class="spec-tile-value">${escapeHtml(guide.waterSchedule)}</strong>
          <span class="spec-tile-note">${escapeHtml(guide.waterNote)}</span>
        </div>
      </div>

      <h3 class="history-block-title">Observation History</h3>
      <ul class="history-timeline" aria-label="${escapeHtml(plant.name)} observation log">
        ${historyHtml}
      </ul>

      <form class="observation-form" data-plant-id="${plant.id}">
        <label class="sr-only-svg" for="dossier-note-input">Log observation for ${escapeHtml(plant.name)}</label>
        <input
          id="dossier-note-input"
          type="text"
          class="observation-input"
          name="observation"
          placeholder="Record leaf or soil observation..."
          maxlength="60"
        />
        <button type="submit" class="btn-log-note">Log note</button>
      </form>
    `;
  }

  // Render the Compact Weekly Rhythm Visualization ([1,3,2,4,2,1,3])
  function renderWeeklyRhythm() {
    const chartEl = document.getElementById("rhythm-chart");
    const totalEl = document.getElementById("rhythm-week-total");
    const detailEl = document.getElementById("rhythm-day-detail");
    const loggedCountEl = document.getElementById("rhythm-logged-count");

    const maxVal = Math.max.apply(null, state.week.concat([4]));
    const totalTasks = state.week.reduce(function (acc, val) {
      return acc + val;
    }, 0);

    totalEl.textContent = String(totalTasks);
    loggedCountEl.textContent = String(countWateredToday());

    const selectedDayMeta = WEEK_DAYS[state.selectedDayIndex];
    const selectedDayCount = state.week[state.selectedDayIndex];
    detailEl.textContent = `${selectedDayMeta.full}: ${selectedDayCount} care moment${selectedDayCount === 1 ? "" : "s"} — ${selectedDayMeta.note}.`;

    chartEl.innerHTML = state.week
      .map(function (count, idx) {
        const dayMeta = WEEK_DAYS[idx];
        const heightPct = Math.max(22, Math.round((count / maxVal) * 100));
        const isToday = idx === TODAY_INDEX;
        const isPeak = count >= 4 && !isToday;
        const isActive = idx === state.selectedDayIndex;

        return `
          <button
            type="button"
            class="rhythm-day-btn ${isToday ? "is-today" : ""} ${isPeak ? "is-peak" : ""} ${isActive ? "is-active-day" : ""}"
            data-day-index="${idx}"
            aria-pressed="${isActive ? "true" : "false"}"
            aria-label="${dayMeta.full}: ${count} care tasks"
          >
            <span class="rhythm-count-pill">${count}</span>
            <span class="rhythm-stem-track" aria-hidden="true">
              <span class="rhythm-stem-bar" style="height: ${heightPct}%"></span>
            </span>
            <span class="rhythm-day-label">${dayMeta.short}</span>
          </button>
        `;
      })
      .join("");
  }

  // Render Queue Sections, Masthead Mood, and All-Done State
  function renderAll() {
    const overduePlants = state.plants
      .filter(function (p) {
        return p.status === "pending" && p.urgency >= 4;
      })
      .sort(function (a, b) {
        return b.urgency - a.urgency;
      });

    const todayPlants = state.plants
      .filter(function (p) {
        return p.status === "pending" && p.urgency >= 1 && p.urgency < 4;
      })
      .sort(function (a, b) {
        return b.urgency - a.urgency;
      });

    const restingPlants = state.plants.filter(function (p) {
      return p.status !== "pending" || p.urgency === 0;
    });

    const dueCount = overduePlants.length + todayPlants.length;
    const tendedOrSnoozedCount = state.plants.filter(function (p) {
      return p.status !== "pending";
    }).length;

    // Update top status pills
    document.getElementById("pill-overdue").textContent = `${overduePlants.length} overdue`;
    document.getElementById("pill-today").textContent = `${todayPlants.length} due today`;
    document.getElementById("pill-tended").textContent = `${tendedOrSnoozedCount} tended`;

    // Update filter tab badges
    document.getElementById("count-all").textContent = String(state.plants.length);
    document.getElementById("count-due").textContent = String(dueCount);
    document.getElementById("count-tended").textContent = String(tendedOrSnoozedCount);

    // Show/hide Reset Queue button and batch Water All button
    const resetBtn = document.getElementById("reset-demo-btn");
    resetBtn.hidden = tendedOrSnoozedCount === 0;

    const waterAllBtn = document.getElementById("water-all-due-btn");
    waterAllBtn.hidden = dueCount === 0;

    // Update Companion Whisper & Mascot Expression
    const whisperEl = document.getElementById("companion-whisper");
    const mouthEl = document.getElementById("mascot-mouth");
    if (overduePlants.length > 0) {
      whisperEl.textContent = `${overduePlants[0].name} in the ${overduePlants[0].location.toLowerCase()} is ${overduePlants[0].due}—let’s soak her roots first.`;
      mouthEl.setAttribute("d", "M32 41 Q36 38 40 41"); // slightly concerned pebble
    } else if (todayPlants.length > 0) {
      whisperEl.textContent = `Overdue care is clear! Just ${todayPlants.length} quick check-in${todayPlants.length === 1 ? "" : "s"} left for today.`;
      mouthEl.setAttribute("d", "M32 39 Q36 43 40 39"); // warm smile
    } else {
      whisperEl.textContent = "All urgent and today plants are cared for. The greenhouse is humming.";
      mouthEl.setAttribute("d", "M30 38 Q36 45 42 38"); // beaming grin
    }

    // All-done banner visibility (when all overdue + due today tasks are completed/snoozed)
    const allDoneBanner = document.getElementById("all-done-banner");
    const isAllDueDone = dueCount === 0;
    allDoneBanner.hidden = !isAllDueDone;

    if (isAllDueDone) {
      const wateredNum = countWateredToday();
      const snoozedNum = state.plants.filter(function (p) {
        return p.status === "snoozed";
      }).length;
      document.getElementById("all-done-summary-text").textContent =
        `Today’s rounds: ${wateredNum} watered, ${snoozedNum} snoozed for tomorrow. Every urgent plant is settled.`;
    }

    // Filter visibility logic
    const sectionOverdue = document.getElementById("section-overdue");
    const sectionToday = document.getElementById("section-today");
    const sectionResting = document.getElementById("section-resting");

    const showOverdue =
      overduePlants.length > 0 && state.activeFilter !== "tended";
    const showToday =
      todayPlants.length > 0 && state.activeFilter !== "tended";
    const showResting =
      restingPlants.length > 0 && state.activeFilter !== "due";

    sectionOverdue.hidden = !showOverdue;
    sectionToday.hidden = !showToday;
    sectionResting.hidden = !showResting;

    document.getElementById("overdue-list").innerHTML = overduePlants
      .map(renderPlantCard)
      .join("");
    document.getElementById("today-list").innerHTML = todayPlants
      .map(renderPlantCard)
      .join("");
    document.getElementById("resting-list").innerHTML = restingPlants
      .map(renderPlantCard)
      .join("");

    // Update filter tabs active state
    document.querySelectorAll(".filter-tab").forEach(function (tab) {
      const isMatch = tab.getAttribute("data-filter") === state.activeFilter;
      tab.classList.toggle("is-active", isMatch);
      tab.setAttribute("aria-selected", isMatch ? "true" : "false");
    });

    renderWeeklyRhythm();
    renderDossier();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Event Delegation & Keyboard Listeners
  function bindEvents() {
    document.addEventListener("click", function (e) {
      // 1. Plant Card / Dossier Actions
      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        const action = actionBtn.getAttribute("data-action");
        const plantId = actionBtn.getAttribute("data-plant-id");

        if (action === "watered") {
          performPlantAction(plantId, "watered");
          return;
        }
        if (action === "snooze") {
          performPlantAction(plantId, "snooze");
          return;
        }
        if (action === "toggle-expand") {
          state.expandedCardIds[plantId] = !state.expandedCardIds[plantId];
          state.selectedPlantId = plantId;
          renderAll();
          return;
        }
        if (action === "select-plant") {
          state.selectedPlantId = plantId;
          renderAll();
          return;
        }
      }

      // 2. Weekly Rhythm Day Stem Selection
      const dayBtn = e.target.closest("[data-day-index]");
      if (dayBtn) {
        state.selectedDayIndex = Number(dayBtn.getAttribute("data-day-index"));
        renderWeeklyRhythm();
        return;
      }

      // 3. Filter Tabs
      const filterTab = e.target.closest(".filter-tab");
      if (filterTab) {
        state.activeFilter = filterTab.getAttribute("data-filter");
        renderAll();
        return;
      }

      // 4. Clicking anywhere inside a plant card selects it for the desktop dossier
      const cardEl = e.target.closest(".plant-card");
      if (cardEl) {
        const cardPlantId = cardEl.getAttribute("data-plant-id");
        if (cardPlantId && state.selectedPlantId !== cardPlantId) {
          state.selectedPlantId = cardPlantId;
          renderDossier();
          document.querySelectorAll(".plant-card").forEach(function (el) {
            el.classList.toggle(
              "is-selected",
              el.getAttribute("data-plant-id") === cardPlantId
            );
          });
        }
      }
    });

    // Observation Form Submissions
    document.addEventListener("submit", function (e) {
      const form = e.target.closest(".observation-form");
      if (!form) return;
      e.preventDefault();
      const plantId = form.getAttribute("data-plant-id");
      const input = form.querySelector("input[name='observation']");
      if (input && input.value.trim()) {
        addObservationNote(plantId, input.value);
        input.value = "";
      }
    });

    // Batch Water All Due Today
    document
      .getElementById("water-all-due-btn")
      .addEventListener("click", waterAllDueToday);

    // Undo Toast Controls
    document
      .getElementById("undo-action-btn")
      .addEventListener("click", undoLastAction);
    document
      .getElementById("undo-dismiss-btn")
      .addEventListener("click", clearUndoToast);

    // Reset Demo Queue Buttons
    document
      .getElementById("reset-demo-btn")
      .addEventListener("click", resetState);
    document
      .getElementById("all-done-reset-btn")
      .addEventListener("click", resetState);

    // Reduced Motion Toggle
    const motionBtn = document.getElementById("toggle-motion-btn");
    const motionLabel = document.getElementById("motion-label");
    function syncMotionUI() {
      document.body.classList.toggle("reduce-motion", state.reducedMotion);
      motionBtn.setAttribute("aria-pressed", state.reducedMotion ? "true" : "false");
      motionLabel.textContent = state.reducedMotion ? "Reduced motion: ON" : "Calm motion";
    }
    motionBtn.addEventListener("click", function () {
      state.reducedMotion = !state.reducedMotion;
      syncMotionUI();
    });
    syncMotionUI();

    // Keyboard Shortcuts (when not typing in a text input)
    document.addEventListener("keydown", function (e) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (state.undoSnapshot) {
          e.preventDefault();
          undoLastAction();
        }
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const ids = state.plants.map(function (p) {
        return p.id;
      });
      const currentIdx = Math.max(0, ids.indexOf(state.selectedPlantId));

      if (e.key === "ArrowDown" || e.key.toLowerCase() === "j") {
        e.preventDefault();
        state.selectedPlantId = ids[(currentIdx + 1) % ids.length];
        renderAll();
      } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") {
        e.preventDefault();
        state.selectedPlantId = ids[(currentIdx - 1 + ids.length) % ids.length];
        renderAll();
      } else if (e.key.toLowerCase() === "w") {
        e.preventDefault();
        performPlantAction(state.selectedPlantId, "watered");
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        performPlantAction(state.selectedPlantId, "snooze");
      } else if (e.key.toLowerCase() === "z") {
        if (state.undoSnapshot) {
          e.preventDefault();
          undoLastAction();
        }
      }
    });
  }

  // Initialize application
  state.plants = cloneInitialPlants();
  state.week = INITIAL_DATA.week.slice();
  bindEvents();
  renderAll();
})();
