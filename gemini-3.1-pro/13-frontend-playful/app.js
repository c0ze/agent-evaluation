/**
 * Moss — Household Plant Companion
 * Modern, tactile, accessible, offline JavaScript application
 */

// Initial Seed Data (strictly matching PLANTS.json)
const DEFAULT_DATA = {
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
      history: ["Sep 19 · Misted", "Sep 16 · Watered", "Sep 12 · New frond"],
      waterSchedule: "Every 3–4 days · Soil moist",
      sunPips: 1,
      personality: "Thirsty dramatic icon who loves shower steam",
      status: "pending" // 'pending' | 'completed' | 'snoozed'
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
      waterSchedule: "Weekly · Allow top inch to dry",
      sunPips: 2,
      personality: "Adventurous shelf climber reaching toward natural light",
      status: "pending"
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
      waterSchedule: "Every 2–3 weeks · Bone dry between drinks",
      sunPips: 4,
      personality: "Patient sun worshipper in a hand-thrown terracotta pot",
      status: "pending"
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
      waterSchedule: "Every 4–5 days · Filtered water preferred",
      sunPips: 2,
      personality: "Expressive prayer plant who folds her striped leaves at dusk",
      status: "pending"
    }
  ],
  week: [1, 3, 2, 4, 2, 1, 3]
};

// Application State
const AppState = {
  plants: [],
  weekData: [],
  activeTab: "todo",      // 'todo' | 'all' | 'completed'
  roomFilter: "all",     // 'all' | room name
  selectedPlantId: "fern",
  undoState: null,        // { action, plantId, snapshot, timeoutId }
  toastTimer: null
};

// Botanical SVG Illustrations for each plant
const PlantAvatars = {
  fern: `
    <svg class="plant-avatar-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Illustration of Frida the Boston fern">
      <!-- Terracotta Pot -->
      <path d="M18 46 L22 60 H42 L46 46 Z" fill="#D05E32" stroke="#222B25" stroke-width="2" />
      <rect x="16" y="43" width="32" height="4" rx="2" fill="#E2764B" stroke="#222B25" stroke-width="2" />
      <path d="M26 60 H38" stroke="#8A371B" stroke-width="2" stroke-linecap="round" />
      <!-- Radiating Fern Fronds -->
      <path d="M32 44 C26 32 12 36 6 42" stroke="#335940" stroke-width="2.5" stroke-linecap="round" />
      <path d="M32 44 C22 24 16 16 10 20" stroke="#427252" stroke-width="2.5" stroke-linecap="round" />
      <path d="M32 44 C30 18 32 8 32 6" stroke="#558B67" stroke-width="2.5" stroke-linecap="round" />
      <path d="M32 44 C42 24 48 16 54 20" stroke="#427252" stroke-width="2.5" stroke-linecap="round" />
      <path d="M32 44 C38 32 52 36 58 42" stroke="#335940" stroke-width="2.5" stroke-linecap="round" />
      <!-- Leaflets -->
      <circle cx="12" cy="24" r="1.8" fill="#C4DEC9" />
      <circle cx="18" cy="18" r="1.8" fill="#C4DEC9" />
      <circle cx="28" cy="12" r="1.8" fill="#C4DEC9" />
      <circle cx="36" cy="12" r="1.8" fill="#C4DEC9" />
      <circle cx="46" cy="18" r="1.8" fill="#C4DEC9" />
      <circle cx="52" cy="24" r="1.8" fill="#C4DEC9" />
      <!-- Thirsty dewdrop indicator -->
      <path d="M48 50 C48 53 45 55 43 55 C41 55 38 53 41 48 C44 44 48 48 48 50Z" fill="#E2764B" opacity="0.4" />
    </svg>
  `,
  pothos: `
    <svg class="plant-avatar-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Illustration of Orbit the Golden pothos">
      <!-- Wooden Shelf Foot & Speckled Pot -->
      <rect x="14" y="58" width="36" height="4" rx="2" fill="#B87B40" stroke="#222B25" stroke-width="1.5" />
      <path d="M20 38 L23 58 H41 L44 38 Z" fill="#F1ECE0" stroke="#222B25" stroke-width="2" />
      <!-- Looping Climbing Vine -->
      <path d="M32 40 C34 28 20 22 22 14 C24 6 42 8 40 18 C38 28 48 34 52 46" stroke="#335940" stroke-width="2.5" stroke-linecap="round" />
      <!-- Heart-shaped variegated leaves -->
      <!-- Leaf 1 -->
      <path d="M22 14 C16 10 12 16 18 22 C22 20 22 16 22 14Z" fill="#558B67" stroke="#222B25" stroke-width="1.5" />
      <circle cx="16" cy="16" r="1.5" fill="#FAD178" />
      <!-- Leaf 2 -->
      <path d="M40 18 C46 14 50 20 44 26 C40 24 40 20 40 18Z" fill="#427252" stroke="#222B25" stroke-width="1.5" />
      <circle cx="45" cy="21" r="1.5" fill="#FAD178" />
      <!-- Leaf 3 -->
      <path d="M26 26 C20 24 20 32 26 34 C28 32 28 28 26 26Z" fill="#558B67" stroke="#222B25" stroke-width="1.5" />
      <!-- Trailing Leaf 4 -->
      <path d="M52 46 C56 46 58 52 52 56 C48 52 50 48 52 46Z" fill="#335940" stroke="#222B25" stroke-width="1.5" />
      <circle cx="53" cy="50" r="1.2" fill="#FAD178" />
    </svg>
  `,
  cactus: `
    <svg class="plant-avatar-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Illustration of Dot the Bunny ears cactus">
      <!-- Sandy Clay Pot -->
      <path d="M20 42 L24 60 H40 L44 42 Z" fill="#C87B19" stroke="#222B25" stroke-width="2" />
      <line x1="22" y1="48" x2="42" y2="48" stroke="#9E5D0E" stroke-width="1.5" stroke-dasharray="2 3" />
      <!-- Main Cactus Body -->
      <ellipse cx="32" cy="34" rx="11" ry="14" fill="#427252" stroke="#222B25" stroke-width="2" />
      <!-- Left Ear Pad -->
      <ellipse cx="23" cy="18" rx="7" ry="10" transform="rotate(-18 23 18)" fill="#558B67" stroke="#222B25" stroke-width="2" />
      <!-- Right Ear Pad -->
      <ellipse cx="41" cy="18" rx="6.5" ry="9.5" transform="rotate(18 41 18)" fill="#558B67" stroke="#222B25" stroke-width="2" />
      <!-- Tiny New Sprout Pad -->
      <ellipse cx="20" cy="8" rx="3.5" ry="5" transform="rotate(-10 20 8)" fill="#9CCF82" stroke="#222B25" stroke-width="1.5" />
      <!-- Polka-dot Glochids (tiny yellow spine tufts) -->
      <circle cx="32" cy="28" r="1" fill="#FAD178" />
      <circle cx="28" cy="34" r="1" fill="#FAD178" />
      <circle cx="36" cy="34" r="1" fill="#FAD178" />
      <circle cx="32" cy="40" r="1" fill="#FAD178" />
      <circle cx="22" cy="16" r="1" fill="#FAD178" />
      <circle cx="24" cy="22" r="1" fill="#FAD178" />
      <circle cx="41" cy="16" r="1" fill="#FAD178" />
      <circle cx="40" cy="22" r="1" fill="#FAD178" />
      <!-- Little pink flower blossom -->
      <circle cx="45" cy="10" r="2.5" fill="#E2764B" stroke="#222B25" stroke-width="1" />
    </svg>
  `,
  calathea: `
    <svg class="plant-avatar-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Illustration of Drama the Calathea orbifolia">
      <!-- Dark Glazed Teal Pot -->
      <path d="M19 44 L22 60 H42 L45 44 Z" fill="#316E7D" stroke="#222B25" stroke-width="2" />
      <rect x="17" y="41" width="30" height="4" rx="2" fill="#458B9C" stroke="#222B25" stroke-width="2" />
      <!-- Delicate Stems -->
      <path d="M32 44 Q28 32 20 22" stroke="#264330" stroke-width="2" stroke-linecap="round" fill="none" />
      <path d="M32 44 Q33 26 34 14" stroke="#264330" stroke-width="2" stroke-linecap="round" fill="none" />
      <path d="M32 44 Q38 32 46 22" stroke="#264330" stroke-width="2" stroke-linecap="round" fill="none" />
      <!-- Broad Orbifolia Striped Leaves -->
      <!-- Left Leaf -->
      <ellipse cx="18" cy="20" rx="10" ry="12" transform="rotate(-25 18 20)" fill="#427252" stroke="#222B25" stroke-width="1.8" />
      <path d="M12 18 Q16 19 22 22" stroke="#C4DEC9" stroke-width="1.5" fill="none" />
      <path d="M14 24 Q18 24 24 26" stroke="#C4DEC9" stroke-width="1.5" fill="none" />
      <!-- Center Leaf (Tallest) -->
      <ellipse cx="34" cy="13" rx="11" ry="13" fill="#335940" stroke="#222B25" stroke-width="1.8" />
      <path d="M26 12 Q34 13 42 12" stroke="#C4DEC9" stroke-width="1.5" fill="none" />
      <path d="M28 17 Q34 18 40 17" stroke="#C4DEC9" stroke-width="1.5" fill="none" />
      <!-- Right Leaf -->
      <ellipse cx="48" cy="20" rx="9" ry="12" transform="rotate(22 48 20)" fill="#427252" stroke="#222B25" stroke-width="1.8" />
      <path d="M43 18 Q48 19 54 21" stroke="#C4DEC9" stroke-width="1.5" fill="none" />
    </svg>
  `
};

// Task Icons Map
const TaskIcons = {
  Water: "💧",
  Rotate: "🔄",
  "Check soil": "🌱",
  Mist: "💨"
};

// ==========================================================================
// Initialization & Data Loading
// ==========================================================================

async function init() {
  await loadPlantData();
  setupEventListeners();
  renderWeeklyRhythm();
  renderQueue();
  selectPlant(AppState.selectedPlantId || "fern");
  updateCompanionSummary();
}

/**
 * Loads data from PLANTS.json if available; falls back smoothly to embedded DEFAULT_DATA
 */
async function loadPlantData() {
  try {
    const response = await fetch("PLANTS.json");
    if (response.ok) {
      const data = await response.json();
      if (data && data.plants) {
        // Merge with enriched properties for tactile view
        AppState.plants = data.plants.map(p => {
          const fallback = DEFAULT_DATA.plants.find(df => df.id === p.id) || {};
          return {
            ...fallback,
            ...p,
            status: "pending"
          };
        });
        AppState.weekData = data.week || DEFAULT_DATA.week;
        return;
      }
    }
  } catch (err) {
    // Expected when running via file:// or without HTTP server
    console.log("Using embedded plants configuration:", err.message);
  }

  // Fallback to embedded data
  AppState.plants = JSON.parse(JSON.stringify(DEFAULT_DATA.plants));
  AppState.weekData = [...DEFAULT_DATA.week];
}

// ==========================================================================
// Queue Sorting & Rendering
// ==========================================================================

/**
 * Sorts queue strictly prioritizing overdue items (urgency 4) first, then today, then upcoming
 */
function getSortedFilteredPlants() {
  let list = [...AppState.plants];

  // Apply room filter if not "all"
  if (AppState.roomFilter !== "all") {
    list = list.filter(p => p.location.toLowerCase() === AppState.roomFilter.toLowerCase());
  }

  // Apply tab view filter
  if (AppState.activeTab === "todo") {
    list = list.filter(p => p.status === "pending");
  } else if (AppState.activeTab === "completed") {
    list = list.filter(p => p.status === "completed" || p.status === "snoozed");
  }

  // Prioritize overdue care (urgency 4 first, then 2, 1, 0)
  list.sort((a, b) => {
    // If one is completed and one is pending, pending comes first
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    // Highest urgency first
    return b.urgency - a.urgency;
  });

  return list;
}

function renderQueue() {
  const container = document.getElementById("plant-list-panel");
  const allDoneState = document.getElementById("all-done-state");
  const priorityBanner = document.getElementById("priority-banner");
  const sortedPlants = getSortedFilteredPlants();

  // Check if overdue plants remain
  const hasOverduePending = AppState.plants.some(p => p.urgency >= 3 && p.status === "pending");
  if (priorityBanner) {
    if (hasOverduePending && AppState.activeTab !== "completed") {
      priorityBanner.classList.remove("hidden");
    } else {
      priorityBanner.classList.add("hidden");
    }
  }

  // Check if all to-do plants are completed
  const pendingCount = AppState.plants.filter(p => p.status === "pending").length;
  if (AppState.activeTab === "todo" && pendingCount === 0) {
    container.innerHTML = "";
    allDoneState.classList.remove("hidden");
    updateCounts();
    return;
  } else {
    allDoneState.classList.add("hidden");
  }

  // If filtered list is empty
  if (sortedPlants.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card" style="text-align: center; padding: 32px; background: var(--surface-bg); border: 2px dashed var(--border-soft); border-radius: var(--radius-lg);">
        <p style="color: var(--ink-600); font-size: 0.95rem;">No plants match this view.</p>
      </div>
    `;
    updateCounts();
    return;
  }

  // Build plant cards
  container.innerHTML = sortedPlants.map(plant => createPlantCardHtml(plant)).join("");

  updateCounts();
}

/**
 * Creates HTML for individual plant care card
 */
function createPlantCardHtml(plant) {
  const isSelected = plant.id === AppState.selectedPlantId;
  const isOverdue = plant.urgency >= 3 && plant.status === "pending";
  const isCompleted = plant.status === "completed";
  const isSnoozed = plant.status === "snoozed";

  let statusClass = "";
  if (isOverdue) statusClass = "is-overdue";
  else if (isCompleted) statusClass = "is-completed";
  else if (isSnoozed) statusClass = "is-snoozed";

  if (isSelected) statusClass += " is-selected";

  // Due badge text and style
  let badgeClass = "badge-tomorrow";
  let dueText = plant.due;
  if (isCompleted) {
    badgeClass = "badge-done";
    dueText = "✓ Done today";
  } else if (isSnoozed) {
    badgeClass = "badge-tomorrow";
    dueText = "⏱ Snoozed (+1d)";
  } else if (plant.urgency >= 3) {
    badgeClass = "badge-overdue";
  } else if (plant.urgency >= 1) {
    badgeClass = "badge-today";
  }

  const avatarSvg = PlantAvatars[plant.id] || PlantAvatars.fern;
  const taskIcon = TaskIcons[plant.task] || "🌿";

  // Action buttons
  let actionButtonsHtml = "";
  if (isCompleted) {
    actionButtonsHtml = `
      <div class="completed-note">
        <span>✓ Completed for today</span>
      </div>
      <button type="button" class="btn btn-secondary btn-reopen" data-id="${plant.id}" data-action="reopen" aria-label="Mark ${plant.name} as pending again">
        Re-open
      </button>
      <button type="button" class="btn btn-details-toggle" data-id="${plant.id}" data-action="inspect" aria-label="Inspect ${plant.name}">
        Diary & Specs →
      </button>
    `;
  } else if (isSnoozed) {
    actionButtonsHtml = `
      <div class="completed-note" style="color: var(--sun-700);">
        <span>⏱ Snoozed until tomorrow</span>
      </div>
      <button type="button" class="btn btn-secondary btn-reopen" data-id="${plant.id}" data-action="reopen" aria-label="Resume ${plant.name} care today">
        Resume today
      </button>
      <button type="button" class="btn btn-details-toggle" data-id="${plant.id}" data-action="inspect" aria-label="Inspect ${plant.name}">
        Diary & Specs →
      </button>
    `;
  } else {
    // Standard Pending State
    const actionVerb = plant.task === "Water" ? "Water" : plant.task;
    const primaryBtnClass = isOverdue ? "btn-primary is-overdue-action" : "btn-primary";

    actionButtonsHtml = `
      <button type="button" class="btn ${primaryBtnClass}" data-id="${plant.id}" data-action="complete" aria-label="${actionVerb} ${plant.name}">
        <span aria-hidden="true">${taskIcon}</span>
        ${actionVerb} ${plant.name}
      </button>
      <button type="button" class="btn btn-secondary" data-id="${plant.id}" data-action="snooze" aria-label="Snooze ${plant.name} care">
        <span aria-hidden="true">⏱</span>
        Snooze
      </button>
      <button type="button" class="btn btn-details-toggle" data-id="${plant.id}" data-action="inspect" aria-label="Inspect ${plant.name} details and history">
        Diary →
      </button>
    `;
  }

  return `
    <article class="plant-card ${statusClass}" id="card-${plant.id}" data-id="${plant.id}">
      <div class="card-main">
        <!-- Plant Avatar -->
        <div class="plant-avatar-wrap" aria-hidden="true">
          ${avatarSvg}
        </div>

        <!-- Plant Details -->
        <div class="card-details">
          <div class="card-top-row">
            <h3 class="plant-name">${plant.name}</h3>
            <span class="due-badge ${badgeClass}">${dueText}</span>
          </div>

          <div class="plant-species-row">
            <span class="species-name">${plant.species}</span>
            <span>·</span>
            <span class="location-tag" title="Located in ${plant.location}">
              📍 ${plant.location}
            </span>
          </div>

          <!-- Task Strip -->
          <div class="task-strip">
            <span class="task-icon-badge" aria-hidden="true">${taskIcon}</span>
            <span class="task-description">
              <strong>${plant.task}</strong>: ${isOverdue ? "Immediate care needed" : plant.personality}
            </span>
            <span class="light-hint" title="Light requirement">☀️ ${plant.light}</span>
          </div>
        </div>
      </div>

      <!-- Action controls -->
      <div class="card-actions">
        ${actionButtonsHtml}
      </div>
    </article>
  `;
}

// ==========================================================================
// Action Handlers & Undo System
// ==========================================================================

/**
 * Handles completing/watering a plant task
 */
function handleComplete(plantId) {
  const plant = AppState.plants.find(p => p.id === plantId);
  if (!plant) return;

  // Snapshot for undo
  const snapshot = {
    status: plant.status,
    urgency: plant.urgency,
    due: plant.due,
    history: [...plant.history]
  };

  // Update plant state
  plant.status = "completed";
  const actionLabel = plant.task === "Water" ? "Watered" : `${plant.task} completed`;
  const todayEntry = `Today · ${actionLabel}`;
  plant.history.unshift(todayEntry);

  // Trigger UI updates
  renderQueue();
  selectPlant(plantId);
  updateCompanionSummary();

  // Show Tactile Undo Toast
  showUndoToast({
    message: `${plant.name} marked complete`,
    subtext: `${actionLabel}! You can undo this anytime.`,
    plantId: plantId,
    snapshot: snapshot
  });
}

/**
 * Handles snoozing a plant task
 */
function handleSnooze(plantId) {
  const plant = AppState.plants.find(p => p.id === plantId);
  if (!plant) return;

  // Snapshot for undo
  const snapshot = {
    status: plant.status,
    urgency: plant.urgency,
    due: plant.due,
    history: [...plant.history]
  };

  // Update plant state
  plant.status = "snoozed";
  plant.urgency = 0; // demoted for today
  plant.due = "Tomorrow (snoozed)";
  const todayEntry = `Today · Snoozed ${plant.task.toLowerCase()}`;
  plant.history.unshift(todayEntry);

  // Trigger UI updates
  renderQueue();
  selectPlant(plantId);
  updateCompanionSummary();

  // Show Tactile Undo Toast
  showUndoToast({
    message: `Snoozed ${plant.name}`,
    subtext: `Task pushed to tomorrow. Rest easy.`,
    plantId: plantId,
    snapshot: snapshot
  });
}

/**
 * Re-opens a completed or snoozed plant
 */
function handleReopen(plantId) {
  const plant = AppState.plants.find(p => p.id === plantId);
  if (!plant) return;

  const original = DEFAULT_DATA.plants.find(p => p.id === plantId);
  plant.status = "pending";
  plant.urgency = original ? original.urgency : 2;
  plant.due = original ? original.due : "Today";
  // Remove most recent today entry if present
  if (plant.history.length > 0 && plant.history[0].startsWith("Today")) {
    plant.history.shift();
  }

  renderQueue();
  selectPlant(plantId);
  updateCompanionSummary();
}

/**
 * Displays floating Undo notification with a 6-second countdown
 */
function showUndoToast({ message, subtext, plantId, snapshot }) {
  const toast = document.getElementById("undo-toast");
  const msgEl = document.getElementById("toast-message");
  const subEl = document.getElementById("toast-subtext");
  const progressEl = document.getElementById("toast-progress");

  if (!toast) return;

  // Clear previous timer
  if (AppState.toastTimer) {
    clearTimeout(AppState.toastTimer);
  }

  AppState.undoState = { plantId, snapshot };

  msgEl.textContent = message;
  subEl.textContent = subtext;

  // Reset progress bar animation
  progressEl.style.animation = "none";
  // Force reflow
  void progressEl.offsetWidth;
  progressEl.style.animation = "countdown 6s linear forwards";

  toast.classList.remove("hidden");

  // Auto-dismiss after 6 seconds
  AppState.toastTimer = setTimeout(() => {
    hideUndoToast();
  }, 6000);
}

function hideUndoToast() {
  const toast = document.getElementById("undo-toast");
  if (toast) toast.classList.add("hidden");
  if (AppState.toastTimer) {
    clearTimeout(AppState.toastTimer);
    AppState.toastTimer = null;
  }
}

/**
 * Undoes the last completed or snoozed action
 */
function undoLastAction() {
  if (!AppState.undoState) return;

  const { plantId, snapshot } = AppState.undoState;
  const plant = AppState.plants.find(p => p.id === plantId);

  if (plant && snapshot) {
    plant.status = snapshot.status;
    plant.urgency = snapshot.urgency;
    plant.due = snapshot.due;
    plant.history = [...snapshot.history];
  }

  AppState.undoState = null;
  hideUndoToast();
  renderQueue();
  selectPlant(plantId);
  updateCompanionSummary();

  // Return focus to the restored card
  const card = document.getElementById(`card-${plantId}`);
  if (card) {
    const primaryBtn = card.querySelector(".btn-primary") || card.querySelector(".btn");
    if (primaryBtn) primaryBtn.focus();
  }
}

// ==========================================================================
// Plant Inspector & Diary (Right Column / Mobile Sheet)
// ==========================================================================

/**
 * Selects a plant and updates the detailed inspector panel
 */
function selectPlant(plantId) {
  AppState.selectedPlantId = plantId;
  const plant = AppState.plants.find(p => p.id === plantId);
  if (!plant) return;

  // Highlight card in queue
  document.querySelectorAll(".plant-card").forEach(c => {
    c.classList.remove("is-selected");
  });
  const currentCard = document.getElementById(`card-${plantId}`);
  if (currentCard) currentCard.classList.add("is-selected");

  const inspectorContainer = document.getElementById("inspector-card");
  if (!inspectorContainer) return;

  const avatarSvg = PlantAvatars[plant.id] || PlantAvatars.fern;
  const taskIcon = TaskIcons[plant.task] || "🌿";

  // Render sun pips
  let sunPipsHtml = "";
  for (let i = 1; i <= 4; i++) {
    sunPipsHtml += `<span class="sun-pip ${i <= plant.sunPips ? "active" : ""}"></span>`;
  }

  // Render history timeline
  const historyHtml = plant.history.map(item => {
    const parts = item.split("·");
    const dateStr = parts[0]?.trim() || "";
    const noteStr = parts[1]?.trim() || item;
    return `
      <div class="timeline-item">
        <span class="timeline-date">${dateStr}</span>
        <span class="timeline-text">${noteStr}</span>
      </div>
    `;
  }).join("");

  inspectorContainer.innerHTML = `
    <!-- Inspector Header -->
    <div class="inspector-header">
      <div class="inspector-avatar" aria-hidden="true">
        ${avatarSvg}
      </div>
      <div class="inspector-titles">
        <h3 class="inspector-name">${plant.name}</h3>
        <span class="inspector-species">${plant.species}</span>
        <div class="inspector-badge-row">
          <span class="location-tag">📍 ${plant.location}</span>
          <span class="location-tag" style="background: var(--surface-bg); border: 1px solid var(--border-soft);">
            ${plant.due}
          </span>
        </div>
      </div>
      <button type="button" class="btn-icon close-inspector-btn" id="btn-close-inspector" aria-label="Close plant inspector">
        ✕
      </button>
    </div>

    <!-- Companion Botanical Note -->
    <p style="font-size: 0.86rem; color: var(--ink-700); font-style: italic; line-height: 1.4;">
      "${plant.personality}"
    </p>

    <!-- Care Requirements Specs -->
    <div class="inspector-specs-grid">
      <div class="spec-box">
        <span class="spec-label">
          <span aria-hidden="true">☀️</span> Light Requirement
        </span>
        <span class="spec-value">${plant.light}</span>
        <div class="sun-meter" aria-label="Sun intensity level: ${plant.sunPips} of 4">
          ${sunPipsHtml}
        </div>
      </div>
      <div class="spec-box">
        <span class="spec-label">
          <span aria-hidden="true">💧</span> Water & Moisture
        </span>
        <span class="spec-value">${plant.waterSchedule}</span>
      </div>
    </div>

    <!-- Observation & Care History -->
    <div class="history-section">
      <div class="history-heading-row">
        <h4 class="history-title">Observation Diary</h4>
        <span class="history-count">${plant.history.length} logs recorded</span>
      </div>

      <div class="history-timeline" role="list">
        ${historyHtml}
      </div>

      <!-- Quick Add Observation Form -->
      <form class="add-observation-form" id="add-observation-form" data-id="${plant.id}">
        <div class="quick-tag-row" aria-label="Quick observation tags">
          <button type="button" class="tag-btn" data-tag="Spotted new sprout">🌱 New sprout</button>
          <button type="button" class="tag-btn" data-tag="Soil dry to touch">🍂 Dry soil</button>
          <button type="button" class="tag-btn" data-tag="Wiped dusty leaves">✨ Cleaned leaves</button>
          <button type="button" class="tag-btn" data-tag="Rotated toward sun">☀️ Rotated</button>
        </div>
        <div class="observation-input-wrap">
          <label for="obs-input-${plant.id}" class="sr-only">Add an observation</label>
          <input type="text" id="obs-input-${plant.id}" class="observation-input" placeholder="Note new growth, leaf drop, or moisture..." required>
          <button type="submit" class="btn btn-secondary btn-add-obs">Add Note</button>
        </div>
      </form>
    </div>

    <!-- Quick Action from Inspector -->
    <div class="inspector-actions-bar">
      ${plant.status === "pending" ? `
        <button type="button" class="btn btn-primary" data-id="${plant.id}" data-action="complete" style="flex: 1;">
          <span aria-hidden="true">${taskIcon}</span> Mark ${plant.task} Done
        </button>
        <button type="button" class="btn btn-secondary" data-id="${plant.id}" data-action="snooze">
          ⏱ Snooze
        </button>
      ` : `
        <button type="button" class="btn btn-secondary" data-id="${plant.id}" data-action="reopen" style="flex: 1;">
          ↺ Re-open for today
        </button>
      `}
    </div>
  `;

  // Attach quick observation form listener
  const form = document.getElementById("add-observation-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector(".observation-input");
      if (input && input.value.trim()) {
        addObservation(plant.id, input.value.trim());
      }
    });

    // Quick tag clicks
    form.querySelectorAll(".tag-btn").forEach(tagBtn => {
      tagBtn.addEventListener("click", () => {
        const text = tagBtn.dataset.tag;
        if (text) addObservation(plant.id, text);
      });
    });
  }

  // Close inspector button for mobile
  const closeBtn = document.getElementById("btn-close-inspector");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeMobileInspector);
  }
}

/**
 * Appends a new observation note to a plant's history
 */
function addObservation(plantId, text) {
  const plant = AppState.plants.find(p => p.id === plantId);
  if (!plant) return;

  const today = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateStr = `${months[today.getMonth()]} ${today.getDate()}`;
  plant.history.unshift(`${dateStr} · ${text}`);

  selectPlant(plantId);
}

function openMobileInspector(plantId) {
  selectPlant(plantId);
  const sidebar = document.getElementById("plant-inspector-container");
  const backdrop = document.getElementById("modal-backdrop");
  if (sidebar) sidebar.classList.add("is-open");
  if (backdrop) backdrop.classList.remove("hidden");
}

function closeMobileInspector() {
  const sidebar = document.getElementById("plant-inspector-container");
  const backdrop = document.getElementById("modal-backdrop");
  if (sidebar) sidebar.classList.remove("is-open");
  if (backdrop) backdrop.classList.add("hidden");
}

// ==========================================================================
// Weekly Rhythm Visualization
// ==========================================================================

function renderWeeklyRhythm() {
  const chartEl = document.getElementById("rhythm-chart");
  const mobRhythmBody = document.getElementById("mob-rhythm-body");
  if (!chartEl) return;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = AppState.weekData || [1, 3, 2, 4, 2, 1, 3];
  const maxCount = Math.max(...counts, 4);

  // Thu is index 3 (matching today's 4 scheduled plants)
  const todayIndex = 3;

  const chartHtml = days.map((day, idx) => {
    const count = counts[idx];
    const isToday = idx === todayIndex;
    const heightPercent = Math.round((count / maxCount) * 100);

    return `
      <button type="button" class="rhythm-col ${isToday ? "is-today" : ""}" data-day="${day}" data-count="${count}" aria-label="${day}: ${count} care tasks ${isToday ? "(today)" : ""}">
        <span class="rhythm-count">${count}</span>
        <div class="rhythm-bar-track">
          <div class="rhythm-bar-fill" style="height: ${heightPercent}%;"></div>
        </div>
        <span class="rhythm-day-label">${day}</span>
      </button>
    `;
  }).join("");

  chartEl.innerHTML = chartHtml;

  // Add click listeners to rhythm columns to update caption
  chartEl.querySelectorAll(".rhythm-col").forEach(col => {
    col.addEventListener("click", () => {
      const day = col.dataset.day;
      const count = col.dataset.count;
      const caption = document.getElementById("rhythm-caption");
      if (caption) {
        caption.innerHTML = `<strong>${day}</strong> has <strong>${count} tasks</strong> scheduled. Consistent rhythm keeps roots thriving.`;
      }
    });
  });

  // Also clone into mobile dialog if available
  if (mobRhythmBody) {
    mobRhythmBody.innerHTML = `
      <div class="weekly-rhythm-card" style="border: none; box-shadow: none; padding: 0;">
        <div class="rhythm-chart" style="margin-top: 12px;">
          ${chartHtml}
        </div>
        <p class="rhythm-caption" style="margin-top: 14px;">
          <strong>Thursday</strong> is your peak watering day (4 tasks). Friday eases up gently.
        </p>
      </div>
    `;
  }
}

// ==========================================================================
// Summary Counts & State Updates
// ==========================================================================

function updateCounts() {
  const pendingPlants = AppState.plants.filter(p => p.status === "pending");
  const overdueCount = AppState.plants.filter(p => p.urgency >= 3 && p.status === "pending").length;
  const todayCount = AppState.plants.filter(p => p.urgency >= 1 && p.urgency <= 2 && p.status === "pending").length;
  const doneCount = AppState.plants.filter(p => p.status === "completed" || p.status === "snoozed").length;

  // Update badge counters
  const counterEl = document.getElementById("active-queue-counter");
  if (counterEl) counterEl.textContent = `${pendingPlants.length} left`;

  const todoTabCount = document.getElementById("todo-tab-count");
  if (todoTabCount) todoTabCount.textContent = pendingPlants.length;

  const doneTabCount = document.getElementById("done-tab-count");
  if (doneTabCount) doneTabCount.textContent = doneCount;

  const mobQueueCount = document.getElementById("mob-queue-count");
  if (mobQueueCount) mobQueueCount.textContent = pendingPlants.length;

  const statOverdue = document.getElementById("stat-overdue-count");
  if (statOverdue) statOverdue.textContent = overdueCount;

  const statToday = document.getElementById("stat-today-count");
  if (statToday) statToday.textContent = todayCount;

  const statDone = document.getElementById("stat-done-count");
  if (statDone) statDone.textContent = doneCount;
}

function updateCompanionSummary() {
  updateCounts();
  const msgEl = document.getElementById("companion-message");
  if (!msgEl) return;

  const pendingCount = AppState.plants.filter(p => p.status === "pending").length;
  const hasOverdue = AppState.plants.some(p => p.urgency >= 3 && p.status === "pending");

  if (pendingCount === 0) {
    msgEl.textContent = "All companions are watered and content! Quiet leaves, happy roots.";
  } else if (hasOverdue) {
    msgEl.textContent = "Four quiet green lives under your roof today. Frida's fronds are asking for moisture first.";
  } else {
    msgEl.textContent = `A gentle day. Just ${pendingCount} plant${pendingCount > 1 ? "s" : ""} awaiting your touch.`;
  }
}

/**
 * Resets demo queue back to fresh initial state
 */
function resetDemoQueue() {
  AppState.plants = JSON.parse(JSON.stringify(DEFAULT_DATA.plants));
  AppState.activeTab = "todo";
  AppState.selectedPlantId = "fern";

  // Reset tab buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === "todo");
    btn.setAttribute("aria-selected", btn.dataset.filter === "todo" ? "true" : "false");
  });

  renderQueue();
  selectPlant("fern");
  updateCompanionSummary();
  hideUndoToast();
}

// ==========================================================================
// Event Listeners Setup
// ==========================================================================

function setupEventListeners() {
  // Global Delegate for Card Actions (Click & Keyboard Enter)
  document.addEventListener("click", (e) => {
    // Action button inside card or inspector
    const btn = e.target.closest("button[data-action]");
    if (btn) {
      const plantId = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === "complete") {
        handleComplete(plantId);
      } else if (action === "snooze") {
        handleSnooze(plantId);
      } else if (action === "reopen") {
        handleReopen(plantId);
      } else if (action === "inspect") {
        if (window.innerWidth < 980) {
          openMobileInspector(plantId);
        } else {
          selectPlant(plantId);
        }
      }
      return;
    }

    // Card click (open inspector on card tap)
    const card = e.target.closest(".plant-card");
    if (card && !e.target.closest("button")) {
      const plantId = card.dataset.id;
      if (window.innerWidth < 980) {
        openMobileInspector(plantId);
      } else {
        selectPlant(plantId);
      }
    }
  });

  // Undo Toast Actions
  const btnUndo = document.getElementById("btn-undo");
  if (btnUndo) {
    btnUndo.addEventListener("click", undoLastAction);
  }

  const btnToastDismiss = document.getElementById("btn-toast-dismiss");
  if (btnToastDismiss) {
    btnToastDismiss.addEventListener("click", hideUndoToast);
  }

  // Queue View Tab Buttons
  document.querySelectorAll(".tab-btn").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      AppState.activeTab = tab.dataset.filter;
      renderQueue();
    });
  });

  // Room Filter Chips
  document.querySelectorAll(".chip[data-room]").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-room]").forEach(c => {
        c.classList.remove("active");
        c.setAttribute("aria-pressed", "false");
      });
      chip.classList.add("active");
      chip.setAttribute("aria-pressed", "true");
      AppState.roomFilter = chip.dataset.room;
      renderQueue();
    });
  });

  // All-Done State Buttons
  const btnViewCompleted = document.getElementById("btn-view-completed");
  if (btnViewCompleted) {
    btnViewCompleted.addEventListener("click", () => {
      const tabCompleted = document.getElementById("tab-completed");
      if (tabCompleted) tabCompleted.click();
    });
  }

  const btnResetDemo = document.getElementById("btn-reset-demo");
  if (btnResetDemo) {
    btnResetDemo.addEventListener("click", resetDemoQueue);
  }

  // Mobile Bottom Bar Buttons
  const mobBtnQueue = document.getElementById("mob-btn-queue");
  const mobBtnRhythm = document.getElementById("mob-btn-rhythm");
  const mobBtnAllPlants = document.getElementById("mob-btn-allplants");
  const rhythmModal = document.getElementById("rhythm-modal");

  if (mobBtnQueue) {
    mobBtnQueue.addEventListener("click", () => {
      const tabTodo = document.getElementById("tab-todo");
      if (tabTodo) tabTodo.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (mobBtnRhythm) {
    mobBtnRhythm.addEventListener("click", () => {
      if (rhythmModal) rhythmModal.showModal();
    });
  }

  const closeRhythmBtn = document.getElementById("close-rhythm-modal");
  if (closeRhythmBtn && rhythmModal) {
    closeRhythmBtn.addEventListener("click", () => {
      rhythmModal.close();
    });
  }

  if (mobBtnAllPlants) {
    mobBtnAllPlants.addEventListener("click", () => {
      const tabAll = document.getElementById("tab-all");
      if (tabAll) tabAll.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Backdrop click to close mobile inspector
  const backdrop = document.getElementById("modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", closeMobileInspector);
  }

  // Keyboard accessibility: Escape closes open mobile modals / sheets
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMobileInspector();
      if (rhythmModal && rhythmModal.open) {
        rhythmModal.close();
      }
      hideUndoToast();
    }
  });
}

// Start Application on DOM Ready
document.addEventListener("DOMContentLoaded", init);
