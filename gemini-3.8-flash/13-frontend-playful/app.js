/**
 * Moss — Gentle Plant Care Companion
 * Vanilla JavaScript application with zero external dependencies.
 */

(() => {
  'use strict';

  // Fallback initial dataset matching PLANTS.json
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
    week: [1, 3, 2, 4, 2, 1, 3] // Mon to Sun, Day 4 (Thu) is Today
  };

  const STORAGE_KEY = 'moss_plants_state_v1';
  const SOUND_KEY = 'moss_sound_enabled';

  // Plant Care Guides: moisture, humidity, and water rules
  const PLANT_CARE_GUIDES = {
    fern: {
      waterRule: "Keep soil consistently damp; never let root ball dry out completely. Enjoys steam.",
      moistureLevel: "Moist (70-80%)",
      humidity: "High (Bathroom ideal)"
    },
    pothos: {
      waterRule: "Allow top 2 inches of potting mix to dry before watering. Rotate weekly for bushy vines.",
      moistureLevel: "Moderate (40-50%)",
      humidity: "Standard room"
    },
    cactus: {
      waterRule: "Strict soak-and-dry cycle. Only water when soil is bone dry throughout. Keep saucer drained.",
      moistureLevel: "Dry (10-20%)",
      humidity: "Low / Arid"
    },
    calathea: {
      waterRule: "Sensitive to tap minerals. Use filtered water; keep lightly moist and mist often.",
      moistureLevel: "Damp (60-70%)",
      humidity: "High (Mist morning)"
    }
  };

  // SVG Botanical Illustrations (Unique, expressive character silhouettes)
  const PLANT_SVGS = {
    fern: `
      <svg viewBox="0 0 100 100" class="plant-svg" aria-label="Frida the Boston fern">
        <!-- Hanging ropes -->
        <line x1="28" y1="20" x2="38" y2="60" stroke="#4A5B4E" stroke-width="1.5" stroke-dasharray="2,2"/>
        <line x1="72" y1="20" x2="62" y2="60" stroke="#4A5B4E" stroke-width="1.5" stroke-dasharray="2,2"/>
        <!-- Terracotta Pot -->
        <path d="M36 60 L64 60 L59 82 L41 82 Z" fill="#D65D38" stroke="#212F24" stroke-width="2"/>
        <line x1="39" y1="70" x2="61" y2="70" stroke="#B94926" stroke-width="1.5"/>
        <!-- Cascading Fern Fronds -->
        <path d="M50 60 Q30 45 14 55 Q24 40 50 60 Z" fill="#557A46" stroke="#212F24" stroke-width="1.5"/>
        <path d="M50 60 Q40 32 30 22 Q46 32 50 60 Z" fill="#7CA96E" stroke="#212F24" stroke-width="1.5"/>
        <path d="M50 60 Q50 25 50 14 Q56 28 50 60 Z" fill="#557A46" stroke="#212F24" stroke-width="1.5"/>
        <path d="M50 60 Q62 30 74 24 Q60 38 50 60 Z" fill="#7CA96E" stroke="#212F24" stroke-width="1.5"/>
        <path d="M50 60 Q75 42 88 56 Q72 44 50 60 Z" fill="#557A46" stroke="#212F24" stroke-width="1.5"/>
        <!-- Sub Fronds -->
        <path d="M50 60 Q20 58 10 70 Q30 62 50 60 Z" fill="#8FBC7A" stroke="#212F24" stroke-width="1.2"/>
        <path d="M50 60 Q80 60 92 68 Q70 62 50 60 Z" fill="#8FBC7A" stroke="#212F24" stroke-width="1.2"/>
        <!-- Droplet accent -->
        <circle cx="82" cy="74" r="2.5" fill="#5C8E8E"/>
      </svg>
    `,
    pothos: `
      <svg viewBox="0 0 100 100" class="plant-svg" aria-label="Orbit the Golden Pothos">
        <!-- Ceramic Pot -->
        <path d="M32 62 L68 62 L63 85 L37 85 Z" fill="#EADBC8" stroke="#212F24" stroke-width="2"/>
        <!-- Speckles -->
        <circle cx="44" cy="72" r="1.5" fill="#738577"/>
        <circle cx="56" cy="76" r="1.5" fill="#738577"/>
        <!-- Moss Pole / Trellis -->
        <rect x="47" y="24" width="6" height="42" fill="#738577" stroke="#212F24" stroke-width="1.5"/>
        <line x1="47" y1="32" x2="53" y2="36" stroke="#212F24" stroke-width="1"/>
        <line x1="47" y1="44" x2="53" y2="48" stroke="#212F24" stroke-width="1"/>
        <!-- Heart Leaves with Golden Variegation -->
        <path d="M47 38 C35 32 32 20 44 18 C52 16 50 32 47 38 Z" fill="#557A46" stroke="#212F24" stroke-width="1.5"/>
        <path d="M42 22 Q46 26 43 32" fill="none" stroke="#EBB04D" stroke-width="1.8"/>
        <path d="M53 48 C68 44 72 30 60 26 C52 24 51 42 53 48 Z" fill="#7CA96E" stroke="#212F24" stroke-width="1.5"/>
        <path d="M58 32 Q62 38 56 42" fill="none" stroke="#EBB04D" stroke-width="1.8"/>
        <path d="M47 58 C28 54 26 40 38 38 C48 36 48 52 47 58 Z" fill="#557A46" stroke="#212F24" stroke-width="1.5"/>
        <!-- Trailing Vine -->
        <path d="M52 62 Q66 66 68 76 Q72 82 78 82" fill="none" stroke="#395536" stroke-width="2"/>
        <path d="M78 82 C84 80 88 88 82 90 C78 90 76 84 78 82 Z" fill="#7CA96E" stroke="#212F24" stroke-width="1.2"/>
      </svg>
    `,
    cactus: `
      <svg viewBox="0 0 100 100" class="plant-svg" aria-label="Dot the Bunny ears cactus">
        <!-- Shallow Saucer Pot -->
        <path d="M28 68 L72 68 L66 86 L34 86 Z" fill="#D65D38" stroke="#212F24" stroke-width="2"/>
        <ellipse cx="50" cy="68" rx="22" ry="4" fill="#B94926"/>
        <!-- Main Cactus Paddle -->
        <path d="M40 68 C34 50 34 38 50 38 C66 38 66 50 60 68 Z" fill="#557A46" stroke="#212F24" stroke-width="2"/>
        <!-- Left Bunny Ear -->
        <ellipse cx="36" cy="30" rx="9" ry="14" transform="rotate(-18 36 30)" fill="#7CA96E" stroke="#212F24" stroke-width="1.8"/>
        <!-- Right Bunny Ear -->
        <ellipse cx="64" cy="28" rx="8" ry="12" transform="rotate(22 64 28)" fill="#7CA96E" stroke="#212F24" stroke-width="1.8"/>
        <!-- Dot Glochids (Cactus Spines) -->
        <circle cx="50" cy="48" r="1.5" fill="#FDF4E3"/>
        <circle cx="44" cy="56" r="1.5" fill="#FDF4E3"/>
        <circle cx="56" cy="56" r="1.5" fill="#FDF4E3"/>
        <circle cx="50" cy="62" r="1.5" fill="#FDF4E3"/>
        <circle cx="34" cy="28" r="1.2" fill="#FDF4E3"/>
        <circle cx="38" cy="34" r="1.2" fill="#FDF4E3"/>
        <circle cx="63" cy="26" r="1.2" fill="#FDF4E3"/>
        <circle cx="66" cy="32" r="1.2" fill="#FDF4E3"/>
      </svg>
    `,
    calathea: `
      <svg viewBox="0 0 100 100" class="plant-svg" aria-label="Drama the Calathea orbifolia">
        <!-- Fluted Pot -->
        <path d="M34 65 L66 65 L62 86 L38 86 Z" fill="#F4D3C7" stroke="#212F24" stroke-width="2"/>
        <line x1="44" y1="65" x2="44" y2="86" stroke="#D65D38" stroke-width="1"/>
        <line x1="56" y1="65" x2="56" y2="86" stroke="#D65D38" stroke-width="1"/>
        <!-- Broad Striped Leaves -->
        <g stroke="#212F24" stroke-width="1.5">
          <!-- Back Leaf -->
          <ellipse cx="50" cy="32" rx="16" ry="22" fill="#557A46"/>
          <line x1="50" y1="54" x2="50" y2="12" stroke="#212F24" stroke-width="1.5"/>
          <line x1="50" y1="24" x2="38" y2="20" stroke="#8FBC7A" stroke-width="1.5"/>
          <line x1="50" y1="30" x2="62" y2="26" stroke="#8FBC7A" stroke-width="1.5"/>
          <line x1="50" y1="38" x2="36" y2="36" stroke="#8FBC7A" stroke-width="1.5"/>
          <line x1="50" y1="44" x2="64" y2="42" stroke="#8FBC7A" stroke-width="1.5"/>
          <!-- Left Leaf -->
          <ellipse cx="32" cy="46" rx="14" ry="18" transform="rotate(-30 32 46)" fill="#7CA96E"/>
          <!-- Right Leaf -->
          <ellipse cx="68" cy="46" rx="14" ry="18" transform="rotate(30 68 46)" fill="#7CA96E"/>
        </g>
        <!-- Mist drop -->
        <path d="M50 14 C48 10 52 10 50 8 Z" fill="#5C8E8E"/>
      </svg>
    `
  };

  // State
  let state = {
    plants: [],
    week: [],
    selectedPlantId: 'fern',
    activeFilter: 'all',
    undoStack: null, // { plantId, previousPlantState, type, timerId }
    soundEnabled: true
  };

  // Web Audio Synthesizer (pure offline, no audio files required)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(type) {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'water') {
        // Cheerful ascending water droplet blip
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'snooze') {
        // Soft clock ticking chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.setValueAtTime(320, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'undo') {
        // Reverse resolving tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch {
      // Audio autoplay policy gracefully handled
    }
  }

  // DOM Elements
  const elements = {
    activePlantsList: document.getElementById('active-plants-list'),
    completedTray: document.getElementById('completed-tray'),
    completedPlantsList: document.getElementById('completed-plants-list'),
    completedCountBadge: document.getElementById('completed-count-badge'),
    completedToggleBtn: document.getElementById('completed-toggle-btn'),
    allDoneState: document.getElementById('all-done-state'),
    overdueBanner: document.getElementById('overdue-banner'),
    bannerQuenchBtn: document.getElementById('banner-quench-btn'),
    householdStatusDot: document.getElementById('header-status-dot'),
    householdStatusText: document.getElementById('header-status-text'),
    totalPlantsCount: document.getElementById('total-plants-count'),
    urgentTasksCount: document.getElementById('urgent-tasks-count'),
    completedTasksCount: document.getElementById('completed-tasks-count'),
    weeklyRhythmBars: document.querySelector('.rhythm-bars'),
    weeklyTotalBadge: document.getElementById('weekly-total-badge'),
    filterChips: document.querySelectorAll('.filter-chip'),
    resetDataBtn: document.getElementById('reset-data-btn'),
    allDoneResetBtn: document.getElementById('all-done-reset-btn'),
    allDoneHistoryBtn: document.getElementById('all-done-history-btn'),

    // Inspector
    inspector: document.getElementById('plant-inspector'),
    inspectorCloseBtn: document.getElementById('inspector-close-btn'),
    inspectorPortrait: document.getElementById('inspector-portrait'),
    inspectorSpecies: document.getElementById('inspector-species'),
    inspectorLocation: document.getElementById('inspector-location'),
    inspectorPlantName: document.getElementById('inspector-plant-name'),
    inspectorStatusPill: document.getElementById('inspector-status-pill'),
    inspectorLight: document.getElementById('inspector-light'),
    inspectorTask: document.getElementById('inspector-task'),
    inspectorMoisture: document.getElementById('inspector-moisture'),
    inspectorHumidity: document.getElementById('inspector-humidity'),
    inspectorWaterRule: document.getElementById('inspector-water-rule'),
    inspectorPrimaryBtn: document.getElementById('inspector-action-primary'),
    inspectorPrimaryLabel: document.getElementById('inspector-primary-label'),
    inspectorPrimaryIcon: document.getElementById('inspector-primary-icon'),
    inspectorSnoozeBtn: document.getElementById('inspector-action-snooze'),
    inspectorHistoryList: document.getElementById('inspector-history-list'),
    inspectorHistoryCount: document.getElementById('history-count-badge'),
    observationForm: document.getElementById('observation-form'),
    observationInput: document.getElementById('new-observation-input'),

    // Modals & Feedback
    modalBackdrop: document.getElementById('modal-backdrop'),
    toastCard: document.getElementById('toast-card'),
    toastIcon: document.getElementById('toast-icon'),
    toastMessage: document.getElementById('toast-message'),
    toastUndoBtn: document.getElementById('toast-undo-btn'),
    toastDismissBtn: document.getElementById('toast-dismiss-btn'),
    shortcutsBtn: document.getElementById('shortcuts-btn'),
    shortcutsDialog: document.getElementById('shortcuts-dialog'),
    closeShortcutsBtn: document.getElementById('close-shortcuts-dialog'),
    shortcutsDoneBtn: document.getElementById('shortcuts-done-btn'),
    soundToggleBtn: document.getElementById('sound-toggle-btn'),
    soundIcon: document.getElementById('sound-icon'),
    srAnnouncer: document.getElementById('sr-announcer')
  };

  /**
   * Initialize Application
   */
  async function init() {
    loadSavedSettings();
    await loadPlantData();
    setupEventListeners();
    renderAll();
  }

  function loadSavedSettings() {
    try {
      const soundVal = localStorage.getItem(SOUND_KEY);
      if (soundVal !== null) {
        state.soundEnabled = soundVal === 'true';
      }
      updateSoundButtonUI();
    } catch {
      // LocalStorage unavailable
    }
  }

  function updateSoundButtonUI() {
    if (elements.soundIcon) {
      elements.soundIcon.textContent = state.soundEnabled ? '🔔' : '🔕';
      elements.soundToggleBtn.setAttribute('aria-label', state.soundEnabled ? 'Disable audio chimes' : 'Enable audio chimes');
    }
  }

  async function loadPlantData() {
    // 1. Try localStorage for persisted demo modifications
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.plants && Array.isArray(parsed.plants)) {
          state.plants = parsed.plants;
          state.week = parsed.week || DEFAULT_DATA.week;
          return;
        }
      }
    } catch {
      // ignore
    }

    // 2. Try fetching PLANTS.json directly
    try {
      const response = await fetch('PLANTS.json');
      if (response.ok) {
        const json = await response.json();
        state.plants = json.plants.map(p => ({
          ...p,
          status: 'pending', // 'pending' | 'done' | 'snoozed'
          initialDue: p.due,
          initialUrgency: p.urgency
        }));
        state.week = json.week || DEFAULT_DATA.week;
        saveState();
        return;
      }
    } catch {
      // fetch failed (e.g. file:// protocol restriction), fallback to embedded
    }

    // 3. Fallback to bundled data
    state.plants = JSON.parse(JSON.stringify(DEFAULT_DATA.plants)).map(p => ({
      ...p,
      status: 'pending',
      initialDue: p.due,
      initialUrgency: p.urgency
    }));
    state.week = [...DEFAULT_DATA.week];
    saveState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        plants: state.plants,
        week: state.week
      }));
    } catch {
      // ignore
    }
  }

  function resetToDefault() {
    state.plants = JSON.parse(JSON.stringify(DEFAULT_DATA.plants)).map(p => ({
      ...p,
      status: 'pending',
      initialDue: p.due,
      initialUrgency: p.urgency
    }));
    state.week = [...DEFAULT_DATA.week];
    state.selectedPlantId = 'fern';
    state.undoStack = null;
    hideToast();
    saveState();
    renderAll();
    announce('Moss demo queue reset to initial state.');
  }

  /**
   * Action Handlers: Water / Done, Snooze, Undo
   */
  function handleTaskDone(plantId) {
    const plant = state.plants.find(p => p.id === plantId);
    if (!plant) return;

    // Save undo state
    const previousState = JSON.parse(JSON.stringify(plant));
    setUndoAction(plantId, previousState, 'done', `${plant.name} marked ${plant.task}ed!`);

    // Update plant
    plant.status = 'done';
    const taskName = plant.task === 'Water' ? 'Watered' : `${plant.task} done`;
    plant.history.unshift(`Sep 21 · ${taskName}`);
    saveState();
    playTone('water');

    renderAll();
    announce(`${plant.name} care completed. Task marked done.`);
  }

  function handleTaskSnooze(plantId) {
    const plant = state.plants.find(p => p.id === plantId);
    if (!plant) return;

    const previousState = JSON.parse(JSON.stringify(plant));
    setUndoAction(plantId, previousState, 'snooze', `${plant.name} snoozed to tomorrow.`);

    plant.status = 'snoozed';
    plant.due = 'Tomorrow (Snoozed)';
    plant.urgency = 0;
    saveState();
    playTone('snooze');

    renderAll();
    announce(`${plant.name} snoozed by one day.`);
  }

  function setUndoAction(plantId, previousState, type, message) {
    if (state.undoStack && state.undoStack.timerId) {
      clearTimeout(state.undoStack.timerId);
    }

    const timerId = setTimeout(() => {
      hideToast();
      state.undoStack = null;
    }, 5000);

    state.undoStack = {
      plantId,
      previousState,
      type,
      timerId
    };

    showToast(message);
  }

  function handleUndo() {
    if (!state.undoStack) return;
    const { plantId, previousState, timerId } = state.undoStack;
    clearTimeout(timerId);

    const index = state.plants.findIndex(p => p.id === plantId);
    if (index !== -1) {
      state.plants[index] = previousState;
      saveState();
      playTone('undo');
      renderAll();
      announce(`Undone. Restored ${previousState.name} to the care queue.`);
    }

    hideToast();
    state.undoStack = null;
  }

  function handleAddObservation(e) {
    e.preventDefault();
    const text = elements.observationInput.value.trim();
    if (!text) return;

    const plant = state.plants.find(p => p.id === state.selectedPlantId);
    if (!plant) return;

    plant.history.unshift(`Today · ${text}`);
    elements.observationInput.value = '';
    saveState();
    renderAll();
    announce(`Observation recorded for ${plant.name}: ${text}`);
  }

  function selectPlant(id) {
    state.selectedPlantId = id;
    renderInspector();
    renderCareQueue(); // update active card highlight

    // On mobile / tablet, open drawer
    if (window.innerWidth < 1080) {
      openMobileInspector();
    }
  }

  function openMobileInspector() {
    elements.inspector.classList.add('is-open');
    elements.inspector.setAttribute('aria-hidden', 'false');
    elements.modalBackdrop.classList.add('is-visible');
    elements.modalBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeMobileInspector() {
    elements.inspector.classList.remove('is-open');
    elements.inspector.setAttribute('aria-hidden', 'true');
    elements.modalBackdrop.classList.remove('is-visible');
    elements.modalBackdrop.setAttribute('aria-hidden', 'true');
  }

  /**
   * Rendering
   */
  function renderAll() {
    renderCareQueue();
    renderWeeklyRhythm();
    renderInspector();
    renderSummaryBadges();
  }

  function renderSummaryBadges() {
    const activeTasks = state.plants.filter(p => p.status === 'pending');
    const overdueCount = activeTasks.filter(p => p.urgency >= 3).length;
    const todayCount = activeTasks.filter(p => p.urgency > 0 && p.urgency < 3).length;
    const completedCount = state.plants.filter(p => p.status === 'done').length;

    elements.totalPlantsCount.textContent = state.plants.length;
    elements.urgentTasksCount.textContent = overdueCount;
    elements.completedTasksCount.textContent = completedCount;
    elements.completedCountBadge.textContent = completedCount;

    if (overdueCount > 0) {
      elements.householdStatusDot.className = 'status-dot alert';
      elements.householdStatusText.textContent = `${overdueCount} overdue · ${todayCount} today`;
    } else if (todayCount > 0) {
      elements.householdStatusDot.className = 'status-dot';
      elements.householdStatusText.textContent = `${todayCount} due today`;
    } else {
      elements.householdStatusDot.className = 'status-dot';
      elements.householdStatusText.textContent = 'All tended today';
    }

    // Overdue banner
    const overduePlant = state.plants.find(p => p.status === 'pending' && p.urgency >= 3);
    if (overduePlant) {
      elements.overdueBanner.hidden = false;
      elements.bannerQuenchBtn.onclick = () => handleTaskDone(overduePlant.id);
    } else {
      elements.overdueBanner.hidden = true;
    }
  }

  function renderCareQueue() {
    elements.activePlantsList.innerHTML = '';
    elements.completedPlantsList.innerHTML = '';

    // Filter plants by room
    const filteredPlants = state.activeFilter === 'all'
      ? state.plants
      : state.plants.filter(p => p.location.toLowerCase() === state.activeFilter.toLowerCase());

    const pendingPlants = filteredPlants.filter(p => p.status === 'pending');
    const completedPlants = filteredPlants.filter(p => p.status === 'done');

    // Priority sorting: Overdue (highest urgency) first
    pendingPlants.sort((a, b) => b.urgency - a.urgency);

    if (pendingPlants.length === 0) {
      elements.allDoneState.hidden = false;
    } else {
      elements.allDoneState.hidden = true;
      pendingPlants.forEach((plant, index) => {
        const card = createPlantCardElement(plant, index + 1);
        elements.activePlantsList.appendChild(card);
      });
    }

    // Completed Tray
    if (completedPlants.length > 0) {
      elements.completedTray.hidden = false;
      completedPlants.forEach(plant => {
        const row = document.createElement('li');
        row.className = 'completed-plant-row';
        row.innerHTML = `
          <div class="completed-row-info">
            <span class="completed-check-icon">✓</span>
            <span class="completed-plant-name">${plant.name}</span>
            <span class="plant-species-name">(${plant.species})</span>
          </div>
          <button class="completed-undo-btn" aria-label="Undo care for ${plant.name}">Undo care</button>
        `;
        row.querySelector('.completed-undo-btn').onclick = () => {
          plant.status = 'pending';
          plant.history.shift(); // remove today's record
          saveState();
          renderAll();
          announce(`Restored ${plant.name} to pending.`);
        };
        elements.completedPlantsList.appendChild(row);
      });
    } else {
      elements.completedTray.hidden = true;
    }
  }

  function createPlantCardElement(plant, queueIndex) {
    const isSelected = plant.id === state.selectedPlantId;
    const isOverdue = plant.urgency >= 3;
    const isToday = plant.urgency > 0 && plant.urgency < 3;

    const li = document.createElement('li');
    li.className = `plant-card ${isOverdue ? 'urgency-high' : ''} ${isSelected ? 'is-selected' : ''}`;
    li.id = `plant-card-${plant.id}`;
    li.setAttribute('tabindex', '0');
    li.setAttribute('role', 'article');
    li.setAttribute('aria-label', `${plant.name}, ${plant.species}. ${plant.task} is ${plant.due}. Location: ${plant.location}.`);

    const dueBadgeClass = isOverdue ? 'overdue' : (isToday ? 'today' : 'tomorrow');
    const actionLabel = plant.task === 'Water' ? 'Watered' : (plant.task === 'Rotate' ? 'Rotated' : 'Done');
    const actionIcon = plant.task === 'Water' ? '💧' : (plant.task === 'Rotate' ? '🔄' : '✓');

    li.innerHTML = `
      <div class="plant-avatar-frame" title="Click to view ${plant.name}'s details">
        ${PLANT_SVGS[plant.id] || ''}
      </div>

      <div class="plant-info-block">
        <div class="plant-badge-row">
          <span class="due-badge ${dueBadgeClass}">${plant.due}</span>
          <span class="location-tag">📍 ${plant.location}</span>
        </div>
        <div class="plant-name-row">
          <h4 class="plant-display-name">${plant.name}</h4>
          <span class="plant-species-name">${plant.species}</span>
        </div>
        <div class="plant-task-row">
          <span class="task-chip">${actionIcon} ${plant.task}</span>
          <span class="last-log-hint">Last: ${plant.history[0] || 'No logs'}</span>
        </div>
      </div>

      <div class="plant-actions-group">
        <button class="pill-btn ${isOverdue ? 'urgent-action-btn' : 'primary-btn'} card-done-btn" aria-label="Mark ${plant.task} done for ${plant.name}">
          <span>${actionIcon}</span>
          <span>${actionLabel}</span>
        </button>
        <button class="pill-btn secondary-btn card-snooze-btn" aria-label="Snooze ${plant.name} care to tomorrow" title="Snooze 1 day">
          <span>⏰</span>
        </button>
        <button class="inspect-card-btn" aria-label="Inspect ${plant.name} details" title="View care details">
          <span>ℹ️</span>
        </button>
      </div>
    `;

    // Events
    li.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        selectPlant(plant.id);
      }
    });

    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.target.closest('button')) {
        selectPlant(plant.id);
      }
    });

    const doneBtn = li.querySelector('.card-done-btn');
    doneBtn.onclick = (e) => {
      e.stopPropagation();
      handleTaskDone(plant.id);
    };

    const snoozeBtn = li.querySelector('.card-snooze-btn');
    snoozeBtn.onclick = (e) => {
      e.stopPropagation();
      handleTaskSnooze(plant.id);
    };

    const inspectBtn = li.querySelector('.inspect-card-btn');
    inspectBtn.onclick = (e) => {
      e.stopPropagation();
      selectPlant(plant.id);
    };

    return li;
  }

  function renderInspector() {
    const plant = state.plants.find(p => p.id === state.selectedPlantId) || state.plants[0];
    if (!plant) return;

    elements.inspectorPortrait.innerHTML = PLANT_SVGS[plant.id] || '';
    elements.inspectorSpecies.textContent = plant.species;
    elements.inspectorLocation.textContent = `📍 ${plant.location}`;
    elements.inspectorPlantName.textContent = plant.name;

    const isDone = plant.status === 'done';
    const isOverdue = plant.urgency >= 3 && !isDone;
    elements.inspectorStatusPill.className = `inspector-status-badge ${isDone ? 'done' : (isOverdue ? 'overdue' : 'today')}`;
    elements.inspectorStatusPill.textContent = isDone ? 'Tended today' : plant.due;

    elements.inspectorLight.textContent = plant.light;
    elements.inspectorTask.textContent = plant.task;

    const guide = PLANT_CARE_GUIDES[plant.id] || {
      waterRule: "Water according to plant species soil dryness check.",
      moistureLevel: "Moderate (40-50%)",
      humidity: "Average room"
    };
    if (elements.inspectorMoisture) elements.inspectorMoisture.textContent = guide.moistureLevel;
    if (elements.inspectorHumidity) elements.inspectorHumidity.textContent = guide.humidity;
    if (elements.inspectorWaterRule) elements.inspectorWaterRule.textContent = guide.waterRule;

    const actionLabel = plant.task === 'Water' ? 'Mark Watered' : `Mark ${plant.task} Done`;
    elements.inspectorPrimaryLabel.textContent = isDone ? 'Completed' : actionLabel;
    elements.inspectorPrimaryIcon.textContent = isDone ? '✓' : (plant.task === 'Water' ? '💧' : '🌱');
    elements.inspectorPrimaryBtn.disabled = isDone;

    elements.inspectorPrimaryBtn.onclick = () => {
      if (!isDone) handleTaskDone(plant.id);
    };

    elements.inspectorSnoozeBtn.onclick = () => {
      handleTaskSnooze(plant.id);
    };

    // History Timeline
    elements.inspectorHistoryCount.textContent = `${plant.history.length} entries`;
    elements.inspectorHistoryList.innerHTML = '';
    plant.history.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <span class="history-bullet">🌱</span>
        <span class="history-text">${entry}</span>
      `;
      elements.inspectorHistoryList.appendChild(li);
    });
  }

  function renderWeeklyRhythm() {
    elements.weeklyRhythmBars.innerHTML = '';
    const days = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];
    const maxVal = Math.max(...state.week, 5);

    // Calculate total
    const totalWeekly = state.week.reduce((a, b) => a + b, 0);
    elements.weeklyTotalBadge.textContent = `${totalWeekly} moments`;

    const completedToday = state.plants.filter(p => p.status === 'done').length;
    const pendingToday = state.plants.filter(p => p.status === 'pending').length;

    state.week.forEach((count, idx) => {
      const isToday = idx === 3; // Day 4 (Thursday) is Today
      const col = document.createElement('div');
      col.className = `rhythm-col ${isToday ? 'is-today' : ''}`;
      col.setAttribute('tabindex', '0');
      col.setAttribute('role', 'button');

      const heightPercent = Math.max(15, Math.round((count / maxVal) * 100));

      let barInnerHtml = `<div class="rhythm-bar-fill" style="height: ${heightPercent}%"></div>`;
      let dayTitle = `${days[idx]}: ${count} plant care moments scheduled`;

      if (isToday) {
        dayTitle = `Thu (Today): ${completedToday} tended, ${pendingToday} pending (${count} scheduled moments)`;
        col.setAttribute('aria-label', `Thursday (Today): ${completedToday} tended, ${pendingToday} pending of ${count} scheduled care moments`);

        if (completedToday > 0) {
          const completedPercent = Math.min(heightPercent, Math.round((completedToday / count) * heightPercent));
          const pendingPercent = Math.max(0, heightPercent - completedPercent);
          barInnerHtml = `
            <div class="rhythm-bar-fill is-pending-fill" style="height: ${pendingPercent}%; background: var(--terracotta);"></div>
            <div class="rhythm-bar-fill is-done-fill" style="height: ${completedPercent}%; background: var(--moss-sprout);"></div>
          `;
        }
      } else {
        col.setAttribute('aria-label', `${days[idx]}: ${count} care moments scheduled`);
      }

      col.innerHTML = `
        <span class="rhythm-count-indicator">${count}</span>
        <div class="rhythm-bar-track">
          ${barInnerHtml}
        </div>
        <span class="rhythm-day-lbl">${days[idx]}</span>
      `;

      col.title = dayTitle;
      elements.weeklyRhythmBars.appendChild(col);
    });
  }

  /**
   * Toast / Undo Notifications
   */
  function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toastCard.hidden = false;
  }

  function hideToast() {
    elements.toastCard.hidden = true;
  }

  /**
   * Accessible Screen Reader Announcement
   */
  function announce(message) {
    if (elements.srAnnouncer) {
      elements.srAnnouncer.textContent = message;
    }
  }

  /**
   * Event Listeners & Shortcuts
   */
  function setupEventListeners() {
    // Undo button
    elements.toastUndoBtn.onclick = handleUndo;
    elements.toastDismissBtn.onclick = hideToast;

    // Mobile Inspector close
    elements.inspectorCloseBtn.onclick = closeMobileInspector;
    elements.modalBackdrop.onclick = closeMobileInspector;

    // Reset button
    elements.resetDataBtn.onclick = resetToDefault;
    elements.allDoneResetBtn.onclick = resetToDefault;

    // All Done review history
    elements.allDoneHistoryBtn.onclick = () => {
      elements.completedTray.hidden = false;
      elements.completedPlantsList.scrollIntoView({ behavior: 'smooth' });
    };

    // Toggle completed tray
    elements.completedToggleBtn.onclick = () => {
      const isExpanded = elements.completedToggleBtn.getAttribute('aria-expanded') === 'true';
      elements.completedToggleBtn.setAttribute('aria-expanded', !isExpanded);
      elements.completedPlantsList.hidden = isExpanded;
    };

    // Add observation form
    elements.observationForm.onsubmit = handleAddObservation;

    // Sound toggle
    elements.soundToggleBtn.onclick = () => {
      state.soundEnabled = !state.soundEnabled;
      try {
        localStorage.setItem(SOUND_KEY, state.soundEnabled);
      } catch {}
      updateSoundButtonUI();
      announce(state.soundEnabled ? 'Audio chimes enabled' : 'Audio chimes muted');
    };

    // Filter Chips
    elements.filterChips.forEach(chip => {
      chip.onclick = () => {
        elements.filterChips.forEach(c => {
          c.classList.remove('active');
          c.setAttribute('aria-pressed', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');
        state.activeFilter = chip.dataset.filter;
        renderCareQueue();
      };
    });

    // Shortcuts Dialog
    elements.shortcutsBtn.onclick = () => {
      elements.shortcutsDialog.hidden = false;
      elements.shortcutsDoneBtn.focus();
    };

    const closeShortcuts = () => {
      elements.shortcutsDialog.hidden = true;
      elements.shortcutsBtn.focus();
    };

    elements.closeShortcutsBtn.onclick = closeShortcuts;
    elements.shortcutsDoneBtn.onclick = closeShortcuts;

    // Keyboard Shortcuts System
    document.addEventListener('keydown', (e) => {
      // Ignore if user is currently typing in an input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (!elements.shortcutsDialog.hidden) {
          closeShortcuts();
        } else if (elements.inspector.classList.contains('is-open')) {
          closeMobileInspector();
        }
        return;
      }

      if (e.key === '?') {
        elements.shortcutsDialog.hidden = !elements.shortcutsDialog.hidden;
        return;
      }

      if (e.key === 'z' || e.key === 'Z') {
        if (state.undoStack) {
          handleUndo();
        }
        return;
      }

      // Quick numbers 1 to 4 to select plant
      if (['1', '2', '3', '4'].includes(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        if (state.plants[index]) {
          selectPlant(state.plants[index].id);
          const card = document.getElementById(`plant-card-${state.plants[index].id}`);
          if (card) card.focus();
        }
        return;
      }

      // 'W' or 'D' to water / mark done selected plant
      if (e.key === 'w' || e.key === 'W' || e.key === 'd' || e.key === 'D') {
        if (state.selectedPlantId) {
          handleTaskDone(state.selectedPlantId);
        }
        return;
      }

      // 'S' to snooze selected plant
      if (e.key === 's' || e.key === 'S') {
        if (state.selectedPlantId) {
          handleTaskSnooze(state.selectedPlantId);
        }
        return;
      }

      // 'O' to open details
      if (e.key === 'o' || e.key === 'O') {
        if (state.selectedPlantId) {
          selectPlant(state.selectedPlantId);
        }
        return;
      }
    });
  }

  // Launch app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
