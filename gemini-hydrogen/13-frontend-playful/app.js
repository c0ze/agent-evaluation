(() => {
  'use strict';

  const FALLBACK_DATA = {
    plants: [
      {
        id: 'fern',
        name: 'Frida',
        species: 'Boston fern',
        location: 'Bathroom',
        task: 'Water',
        due: '2 days overdue',
        urgency: 4,
        light: 'Low, indirect',
        history: ['Sep 19 · Misted', 'Sep 16 · Watered', 'Sep 12 · New frond']
      },
      {
        id: 'pothos',
        name: 'Orbit',
        species: 'Golden pothos',
        location: 'Bookshelf',
        task: 'Rotate',
        due: 'Today',
        urgency: 2,
        light: 'Medium, indirect',
        history: ['Sep 20 · Watered', 'Sep 14 · Rotated', 'Sep 10 · Wiped leaves']
      },
      {
        id: 'cactus',
        name: 'Dot',
        species: 'Bunny ears cactus',
        location: 'South window',
        task: 'Check soil',
        due: 'Today',
        urgency: 1,
        light: 'Bright, direct',
        history: ['Sep 08 · Watered', 'Sep 01 · New pad noted', 'Aug 22 · Rotated']
      },
      {
        id: 'calathea',
        name: 'Drama',
        species: 'Calathea orbifolia',
        location: 'Bedroom',
        task: 'Mist',
        due: 'Tomorrow',
        urgency: 0,
        light: 'Medium, filtered',
        history: ['Sep 21 · Misted', 'Sep 18 · Watered', 'Sep 15 · Brown edge noted']
      }
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };

  const WEEK_LABELS = ['Sep 16', 'Sep 17', 'Sep 18', 'Sep 19', 'Sep 20', 'Sep 21', 'Today'];
  const WEEK_SHORT = ['16', '17', '18', '19', '20', '21', 'Now'];

  const PLANT_META = {
    fern: {
      lightLevel: 1,
      lightNote: 'Soft steamy shade away from glass.',
      quip: 'Dramatic bathroom tenant. Curled slightly after two missed days.',
      doneVerb: 'Watered',
      quickNotes: ['Fronds lifted', 'Soil damp', 'Misted crown']
    },
    pothos: {
      lightLevel: 2,
      lightNote: 'Bright hallway bounce, no harsh glare.',
      quip: 'Reaching sideways toward the doorway lamp; ready for a half-turn.',
      doneVerb: 'Rotated',
      quickNotes: ['Turned 180°', 'New trail leaf', 'Wiped dust']
    },
    cactus: {
      lightLevel: 3,
      lightNote: 'Full south sill sun, loves warmth.',
      quip: 'Stoic desert roommate. Check two knuckles down before pouring.',
      doneVerb: 'Checked soil',
      quickNotes: ['Dry two inches', 'Still cool', 'Firm pads']
    },
    calathea: {
      lightLevel: 2,
      lightNote: 'Filtered curtain light; dislikes drafts.',
      quip: 'Critiques tap water like a sommelier. Resting calmly until tomorrow.',
      doneVerb: 'Misted',
      quickNotes: ['Leaves praying', 'Edges steady', 'Filtered mist']
    }
  };

  const DEFAULT_META = {
    lightLevel: 2,
    lightNote: 'Gentle household daylight.',
    quip: 'Quiet green roommate keeping the shelf company.',
    doneVerb: 'Done',
    quickNotes: ['Looks happy', 'Soil checked', 'New leaf']
  };

  const desktopMq = window.matchMedia('(min-width: 860px)');
  const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

  const state = {
    sourceData: cloneJson(FALLBACK_DATA),
    plants: [],
    week: [],
    selectedId: null,
    expandedMobileIds: new Set(),
    undoStack: [],
    toast: null,
    toastTimer: null,
    toastPaused: false,
    pendingFocusSelector: null
  };

  const els = {
    mastheadStatus: document.getElementById('masthead-status'),
    queueSubtitle: document.getElementById('queue-subtitle'),
    queueContent: document.getElementById('queue-content'),
    resetBtn: document.getElementById('reset-btn'),
    rhythmCaption: document.getElementById('rhythm-caption'),
    rhythmTotal: document.getElementById('rhythm-total'),
    rhythmBars: document.getElementById('rhythm-bars'),
    desktopDossier: document.getElementById('desktop-dossier'),
    toastRegion: document.getElementById('toast-region'),
    srAnnouncer: document.getElementById('sr-announcer')
  };

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getMeta(id) {
    return PLANT_META[id] || DEFAULT_META;
  }

  function hydrateState(rawData) {
    const clean = cloneJson(rawData);
    state.sourceData = cloneJson(rawData);
    state.plants = clean.plants.map((plant) => ({
      ...plant,
      status: 'active', // 'active' | 'done' | 'snoozed'
      doneLabel: null,
      originalDue: plant.due,
      originalUrgency: plant.urgency
    }));
    state.week = Array.isArray(clean.week) && clean.week.length === 7
      ? [...clean.week]
      : [...FALLBACK_DATA.week];
    const sorted = getSortedActivePlants();
    state.selectedId = sorted.length ? sorted[0].id : (state.plants[0]?.id || null);
    state.expandedMobileIds.clear();
    state.undoStack = [];
    clearToast();
  }

  function getSortedActivePlants() {
    return state.plants
      .filter((p) => p.status === 'active')
      .sort((a, b) => b.urgency - a.urgency);
  }

  function getPlantById(id) {
    return state.plants.find((p) => p.id === id) || null;
  }

  function isOverduePlant(plant) {
    return plant.status === 'active' && (plant.urgency >= 3 || /overdue/i.test(plant.due));
  }

  function isTodayDuePlant(plant) {
    return plant.status === 'active' && !isOverduePlant(plant) && plant.urgency >= 1;
  }

  function isUpcomingPlant(plant) {
    return plant.status === 'active' && plant.urgency === 0;
  }

  function getWaterSummary(plant) {
    const wateredEntry = plant.history.find((item) => /watered/i.test(item));
    const datePart = wateredEntry ? wateredEntry.split('·')[0].trim() : 'No recent record';

    if (wateredEntry && datePart.toLowerCase() === 'today') {
      return {
        value: 'Watered today',
        detail: 'Soil moisture freshly topped up.'
      };
    }

    if (plant.task.toLowerCase() === 'water' && plant.status === 'active' && isOverduePlant(plant)) {
      return {
        value: `Last: ${datePart}`,
        detail: `${plant.due} — thirsty now.`
      };
    }

    if (plant.id === 'cactus') {
      return {
        value: `Last: ${datePart}`,
        detail: 'Long dry cycle; test soil before pouring.'
      };
    }

    return {
      value: `Last: ${datePart}`,
      detail: 'Moisture holding steady for now.'
    };
  }

  function getHistoryDotClass(entry) {
    const lower = entry.toLowerCase();
    if (lower.includes('watered') || lower.includes('misted')) return 'history-dot--water';
    if (lower.includes('snoozed')) return 'history-dot--snooze';
    if (lower.includes('noted') || lower.includes('frond') || lower.includes('pad') || lower.includes('edge')) {
      return 'history-dot--note';
    }
    return '';
  }

  function renderPlantSvg(plant, size = 68) {
    const isOverdue = isOverduePlant(plant);
    const isDone = plant.status === 'done';
    const swayClass = !reducedMotionMq.matches && plant.status !== 'snoozed' ? 'svg-sway' : '';

    if (plant.id === 'fern') {
      const droop = isOverdue ? 'translate(0, 4) rotate(4 40 48)' : (isDone ? 'translate(0, -2)' : '');
      return `
        <svg viewBox="0 0 80 86" width="${size}" height="${size}" aria-hidden="true" fill="none">
          <g class="${swayClass}" transform="${droop}">
            <path d="M40 46C34 31 24 21 12 20C21 26 28 35 33 48" stroke="#2F5E3B" stroke-width="3" stroke-linecap="round"/>
            <path d="M40 45C39 27 35 16 27 8C35 15 41 26 42 45" stroke="#3F784C" stroke-width="3" stroke-linecap="round"/>
            <path d="M41 46C46 28 54 17 66 13C58 21 51 31 46 47" stroke="#2F5E3B" stroke-width="3" stroke-linecap="round"/>
            <path d="M44 49C53 37 63 32 72 34C62 38 54 43 48 51" stroke="#5B9462" stroke-width="2.8" stroke-linecap="round"/>
            <ellipse cx="22" cy="24" rx="4.5" ry="2.2" transform="rotate(-24 22 24)" fill="#4A8556"/>
            <ellipse cx="16" cy="21" rx="4" ry="2" transform="rotate(-12 16 21)" fill="#6CA170"/>
            <ellipse cx="34" cy="18" rx="4.6" ry="2.2" transform="rotate(-62 34 18)" fill="#5B9462"/>
            <ellipse cx="52" cy="23" rx="4.8" ry="2.2" transform="rotate(42 52 23)" fill="#4A8556"/>
            <ellipse cx="60" cy="17" rx="4.2" ry="2" transform="rotate(28 60 17)" fill="#6CA170"/>
            <ellipse cx="62" cy="36" rx="4.5" ry="2.1" transform="rotate(14 62 36)" fill="#5B9462"/>
            ${isOverdue ? '<circle cx="15" cy="38" r="2.2" fill="#A94324"/><circle cx="66" cy="44" r="2" fill="#A94324"/>' : ''}
            ${isDone ? '<path d="M62 11L63.5 14.5L67 16L63.5 17.5L62 21L60.5 17.5L57 16L60.5 14.5Z" fill="#EAB84E"/>' : ''}
          </g>
          <path d="M22 48H58L53 75C52.4 78.2 49.6 80 46.3 80H33.7C30.4 80 27.6 78.2 27 75L22 48Z" fill="#C65D3B" stroke="#1D2A1F" stroke-width="2.2" stroke-linejoin="round"/>
          <rect x="19" y="43" width="42" height="7" rx="3.5" fill="#D56D4A" stroke="#1D2A1F" stroke-width="2.2"/>
          <path d="M27 59H53M29 68H51" stroke="#8E381D" stroke-width="1.6" stroke-linecap="round"/>
        </svg>`;
    }

    if (plant.id === 'pothos') {
      return `
        <svg viewBox="0 0 80 86" width="${size}" height="${size}" aria-hidden="true" fill="none">
          <g class="${swayClass}">
            <path d="M36 45C32 32 25 22 18 18" stroke="#2F5E3B" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M41 44C44 30 51 22 61 20" stroke="#2F5E3B" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M48 48C59 50 67 59 65 71" stroke="#2F5E3B" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M18 18C11 19 8 25 14 31C21 31 24 24 18 18Z" fill="#3D7549" stroke="#1D2A1F" stroke-width="1.9"/>
            <path d="M18 18C14 21 13 25 15 29" stroke="#DFBA4F" stroke-width="2" stroke-linecap="round"/>
            <path d="M35 20C30 12 37 6 43 12C45 19 40 23 35 20Z" fill="#4C8656" stroke="#1D2A1F" stroke-width="1.9"/>
            <path d="M61 20C67 16 72 22 66 29C60 30 57 25 61 20Z" fill="#3D7549" stroke="#1D2A1F" stroke-width="1.9"/>
            <path d="M61 20C63 23 64 26 63 28" stroke="#DFBA4F" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M65 71C70 67 74 72 68 78C62 79 60 74 65 71Z" fill="#5D9661" stroke="#1D2A1F" stroke-width="1.9"/>
          </g>
          <path d="M21 48C21 46 22.8 44 25 44H53C55.2 44 57 46 57 48L54 71C53 76 48 79 42 79H36C30 79 25 76 24 71L21 48Z" fill="#EAE0CC" stroke="#1D2A1F" stroke-width="2.2"/>
          <path d="M22 52H56" stroke="#2F5E3B" stroke-width="3"/>
          <circle cx="32" cy="63" r="1.5" fill="#7D6B55"/>
          <circle cx="44" cy="67" r="1.5" fill="#7D6B55"/>
          <circle cx="38" cy="59" r="1.3" fill="#7D6B55"/>
        </svg>`;
    }

    if (plant.id === 'cactus') {
      return `
        <svg viewBox="0 0 80 86" width="${size}" height="${size}" aria-hidden="true" fill="none">
          <g class="${swayClass}">
            <ellipse cx="32" cy="36" rx="11" ry="16" transform="rotate(-10 32 36)" fill="#4D8054" stroke="#1D2A1F" stroke-width="2.1"/>
            <ellipse cx="48" cy="32" rx="10" ry="15" transform="rotate(14 48 32)" fill="#609464" stroke="#1D2A1F" stroke-width="2.1"/>
            <path d="M51 15C51 11 55 10 57 14C58 17 53 19 51 15Z" fill="#D55E47" stroke="#1D2A1F" stroke-width="1.7"/>
            <circle cx="29" cy="29" r="1.5" fill="#FBF8F1"/>
            <circle cx="35" cy="34" r="1.5" fill="#FBF8F1"/>
            <circle cx="30" cy="40" r="1.5" fill="#FBF8F1"/>
            <circle cx="46" cy="26" r="1.5" fill="#FBF8F1"/>
            <circle cx="52" cy="32" r="1.5" fill="#FBF8F1"/>
            <circle cx="47" cy="39" r="1.5" fill="#FBF8F1"/>
          </g>
          <path d="M20 50H60L55 75C54 78 51 80 47 80H33C29 80 26 78 25 75L20 50Z" fill="#DF9F45" stroke="#1D2A1F" stroke-width="2.2" stroke-linejoin="round"/>
          <path d="M24 58L30 63L36 58L42 63L48 58L54 63" stroke="#1D2A1F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }

    // Calathea ("Drama") or default
    return `
      <svg viewBox="0 0 80 86" width="${size}" height="${size}" aria-hidden="true" fill="none">
        <g class="${swayClass}">
          <path d="M38 49C36 37 31 28 24 23" stroke="#2F5E3B" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M41 49C42 35 45 25 49 18" stroke="#2F5E3B" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M45 50C51 39 58 32 63 29" stroke="#2F5E3B" stroke-width="2.4" stroke-linecap="round"/>
          <ellipse cx="22" cy="26" rx="12" ry="9" transform="rotate(-22 22 26)" fill="#3A6C4A" stroke="#1D2A1F" stroke-width="2"/>
          <path d="M15 28C19 25 23 24 28 24M17 31C21 29 25 28 29 28" stroke="#C5DAC1" stroke-width="1.6" stroke-linecap="round"/>
          <ellipse cx="47" cy="20" rx="13" ry="10.5" transform="rotate(8 47 20)" fill="#4A835B" stroke="#1D2A1F" stroke-width="2"/>
          <path d="M39 20C44 17 49 17 54 19M40 24C45 22 50 22 55 23" stroke="#D1E3CE" stroke-width="1.7" stroke-linecap="round"/>
          <path d="M62 24C69 24 72 32 65 37C58 39 54 32 62 24Z" fill="#7D434F" stroke="#1D2A1F" stroke-width="1.9"/>
        </g>
        <path d="M23 48H57L54 75C53.5 78 51 80 48 80H32C29 80 26.5 78 26 75L23 48Z" fill="#2A4735" stroke="#1D2A1F" stroke-width="2.2"/>
        <path d="M31 50V77M40 50V77M49 50V77" stroke="#4D745A" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
  }

  function renderAllDoneSvg() {
    return `
      <svg viewBox="0 0 180 104" width="168" height="96" aria-hidden="true" fill="none">
        <path d="M18 92H162" stroke="#1D2A1F" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="136" cy="28" r="14" fill="#EAB84E" stroke="#1D2A1F" stroke-width="2"/>
        <path d="M136 8V12M156 28H152M150 14L147 17M122 14L125 17" stroke="#A94324" stroke-width="2" stroke-linecap="round"/>
        <path d="M52 62C46 47 40 39 30 37C39 44 45 52 48 63" stroke="#2F5E3B" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M55 62C56 44 59 35 66 28C63 39 60 50 58 63" stroke="#3E764B" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M59 63C67 52 74 47 84 47C76 52 68 57 63 64" stroke="#2F5E3B" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M38 63H74L70 89C69.5 91 67.5 92 65 92H47C44.5 92 42.5 91 42 89L38 63Z" fill="#C65D3B" stroke="#1D2A1F" stroke-width="2.2"/>
        <rect x="35" y="59" width="42" height="6" rx="3" fill="#D87551" stroke="#1D2A1F" stroke-width="2"/>
        <path d="M98 73H124V85C124 89 120 92 115 92H107C102 92 98 89 98 85V73Z" fill="#FBF8F1" stroke="#1D2A1F" stroke-width="2.1"/>
        <path d="M124 76H128C130.5 76 132 78 132 80.5C132 83 130.5 85 128 85H124" stroke="#1D2A1F" stroke-width="2"/>
        <path d="M106 66C106 62 109 61 109 57M115 66C115 62 118 61 118 57" stroke="#505D51" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`;
  }

  function renderMastheadStatus() {
    const active = getSortedActivePlants();
    const overdueCount = active.filter(isOverduePlant).length;
    const todayDueCount = active.filter(isTodayDuePlant).length;
    const doneCount = state.plants.filter((p) => p.status === 'done').length;

    const chips = [];
    if (overdueCount > 0) {
      chips.push(
        `<span class="status-chip status-chip--urgent"><span class="status-dot" aria-hidden="true"></span>${overdueCount} overdue</span>`
      );
    }
    if (overdueCount + todayDueCount > 0) {
      chips.push(
        `<span class="status-chip">${overdueCount + todayDueCount} left today</span>`
      );
    } else {
      chips.push(
        `<span class="status-chip status-chip--calm"><span class="status-dot" aria-hidden="true"></span>Today clear</span>`
      );
    }
    if (doneCount > 0) {
      chips.push(`<span class="status-chip status-chip--calm">${doneCount} tended</span>`);
    }

    els.mastheadStatus.innerHTML = chips.join('');

    const hasChanges = state.plants.some((p) => p.status !== 'active' || p.history.length !== getOriginalHistoryLength(p.id));
    els.resetBtn.hidden = !hasChanges;
  }

  function getOriginalHistoryLength(plantId) {
    const orig = state.sourceData.plants.find((p) => p.id === plantId);
    return orig ? orig.history.length : 0;
  }

  function renderDossierInner(plant, options = {}) {
    const { compactHero = false } = options;
    const meta = getMeta(plant.id);
    const water = getWaterSummary(plant);
    const isOverdue = isOverduePlant(plant);
    const waterTaskPending = plant.task.toLowerCase() === 'water' && plant.status === 'active';

    const sunPips = Array.from({ length: 3 }, (_, idx) => {
      const filled = idx < meta.lightLevel;
      return `<span class="sun-pip ${filled ? 'sun-pip--filled' : ''}" aria-hidden="true"></span>`;
    }).join('');

    const historyMarkup = plant.history
      .map((entry) => {
        const parts = entry.split('·');
        const dateText = parts[0] ? parts[0].trim() : 'Note';
        const eventText = parts.slice(1).join('·').trim() || entry;
        const dotClass = getHistoryDotClass(entry);
        return `
          <li class="history-item">
            <span class="history-dot ${dotClass}" aria-hidden="true"></span>
            <span class="history-date">${escapeHtml(dateText)}</span>
            <span class="history-event">${escapeHtml(eventText)}</span>
          </li>`;
      })
      .join('');

    const chipButtons = meta.quickNotes
      .map(
        (note, idx) =>
          `<button type="button" class="note-chip" data-action="quick-note" data-plant-id="${escapeHtml(plant.id)}" data-note="${escapeHtml(note)}" data-focus-id="chip-${escapeHtml(plant.id)}-${idx}">+ ${escapeHtml(note)}</button>`
      )
      .join('');

    const taskBtn =
      plant.status === 'active' && !waterTaskPending
        ? `<button type="button" class="btn btn--primary" data-action="complete" data-plant-id="${escapeHtml(plant.id)}" data-focus-id="dossier-complete-${escapeHtml(plant.id)}" aria-label="Mark ${escapeHtml(plant.name)} as ${escapeHtml(meta.doneVerb.toLowerCase())}">${escapeHtml(meta.doneVerb)}</button>`
        : '';

    const wateredBtn = `
      <button type="button" class="btn ${waterTaskPending ? (isOverdue ? 'btn--urgent' : 'btn--primary') : 'btn--secondary'}" data-action="water" data-plant-id="${escapeHtml(plant.id)}" data-focus-id="dossier-water-${escapeHtml(plant.id)}" aria-label="${waterTaskPending ? `Mark ${escapeHtml(plant.name)} as watered` : `Log watering for ${escapeHtml(plant.name)}`}">
        Watered
      </button>`;

    const snoozeBtn =
      plant.status === 'active'
        ? `<button type="button" class="btn btn--secondary" data-action="snooze" data-plant-id="${escapeHtml(plant.id)}" data-focus-id="dossier-snooze-${escapeHtml(plant.id)}" aria-label="Snooze ${escapeHtml(plant.name)} until tomorrow">Snooze</button>`
        : `<button type="button" class="btn btn--secondary" data-action="restore" data-plant-id="${escapeHtml(plant.id)}" data-focus-id="dossier-restore-${escapeHtml(plant.id)}" aria-label="Bring ${escapeHtml(plant.name)} back to queue">Return to queue</button>`;

    const heroMarkup = compactHero
      ? (isOverdue ? '' : `<p class="inline-dossier-quip">${escapeHtml(meta.quip)}</p>`)
      : `
        <div class="dossier-hero">
          <div class="dossier-alcove">
            ${renderPlantSvg(plant, 76)}
          </div>
          <div class="dossier-title-group">
            <h3 class="dossier-name">${escapeHtml(plant.name)}</h3>
            <p class="dossier-meta">${escapeHtml(plant.species)} · ${escapeHtml(plant.location)}</p>
            <p class="dossier-quip">${escapeHtml(meta.quip)}</p>
          </div>
        </div>`;

    const dossierActionButtons = compactHero
      ? (waterTaskPending || plant.status !== 'active' ? '' : wateredBtn)
      : `${taskBtn}${wateredBtn}${snoozeBtn}`;

    const actionsMarkup = dossierActionButtons
      ? `<div class="dossier-actions">${dossierActionButtons}</div>`
      : '';

    return `
      ${heroMarkup}

      <div class="dossier-vitals">
        <div class="vital-tile">
          <div class="vital-label">
            <span>Light</span>
            <span class="sun-pips" aria-label="Light intensity ${meta.lightLevel} of 3">${sunPips}</span>
          </div>
          <p class="vital-value">${escapeHtml(plant.light)}</p>
          <p class="vital-sub">${escapeHtml(meta.lightNote)}</p>
        </div>

        <div class="vital-tile">
          <div class="vital-label">
            <span>Water</span>
          </div>
          <p class="vital-value">${escapeHtml(water.value)}</p>
          <p class="vital-sub">${escapeHtml(water.detail)}</p>
        </div>
      </div>

      ${actionsMarkup}

      <div>
        <h4 class="history-heading">Observation &amp; Care History</h4>
        <ul class="history-list">
          ${historyMarkup}
        </ul>
      </div>

      <form class="note-form" data-action="note-form" data-plant-id="${escapeHtml(plant.id)}">
        <label class="visually-hidden" for="note-input-${escapeHtml(plant.id)}">Add observation for ${escapeHtml(plant.name)}</label>
        <div class="note-input-row">
          <input
            id="note-input-${escapeHtml(plant.id)}"
            class="note-input"
            name="note"
            type="text"
            maxlength="80"
            placeholder="Jot a leaf or soil note…"
            autocomplete="off"
          >
          <button type="submit" class="btn btn--secondary">Add note</button>
        </div>
        <div class="note-chips" aria-label="Quick observation tags">
          ${chipButtons}
        </div>
      </form>
    `;
  }

  function renderPlantCard(plant, tier) {
    const meta = getMeta(plant.id);
    const isDesktop = desktopMq.matches;
    const isSelected = isDesktop && state.selectedId === plant.id;
    const isExpandedMobile = !isDesktop && state.expandedMobileIds.has(plant.id);
    const cardTierClass =
      tier === 'overdue'
        ? 'plant-card--overdue'
        : tier === 'upcoming'
          ? 'plant-card--upcoming'
          : 'plant-card--today';

    const stampClass =
      tier === 'overdue'
        ? 'due-stamp--overdue'
        : tier === 'upcoming'
          ? 'due-stamp--upcoming'
          : 'due-stamp--today';

    const primaryBtnClass = tier === 'overdue' ? 'btn--urgent' : 'btn--primary';
    const inspectLabel = isDesktop
      ? (isSelected ? 'Viewing' : 'Details')
      : (isExpandedMobile ? 'Hide details' : 'Details');

    const inspectAria = isDesktop
      ? `aria-pressed="${isSelected ? 'true' : 'false'}"`
      : `aria-expanded="${isExpandedMobile ? 'true' : 'false'}" aria-controls="inline-dossier-${escapeHtml(plant.id)}"`;

    const inlineDrawer = isExpandedMobile
      ? `<div class="inline-dossier" id="inline-dossier-${escapeHtml(plant.id)}">${renderDossierInner(plant, { compactHero: true })}</div>`
      : '';

    return `
      <li>
        <article class="plant-card ${cardTierClass} ${isSelected ? 'plant-card--selected' : ''}" data-plant-card="${escapeHtml(plant.id)}">
          <div class="plant-card-top">
            <button
              type="button"
              class="plant-portrait-btn"
              data-action="inspect"
              data-plant-id="${escapeHtml(plant.id)}"
              data-focus-id="portrait-${escapeHtml(plant.id)}"
              aria-label="Inspect ${escapeHtml(plant.name)} details"
            >
              ${renderPlantSvg(plant, tier === 'overdue' ? 74 : 58)}
            </button>

            <div class="plant-summary">
              <div class="plant-badges">
                <span class="due-stamp ${stampClass}">${escapeHtml(plant.due)}</span>
                <span class="location-tag">${escapeHtml(plant.location)} · ${escapeHtml(plant.light)}</span>
              </div>

              <div class="plant-heading-row">
                <h3 class="plant-name-heading">
                  <button
                    type="button"
                    class="plant-name-btn"
                    data-action="inspect"
                    data-plant-id="${escapeHtml(plant.id)}"
                    data-focus-id="name-${escapeHtml(plant.id)}"
                    ${isSelected ? 'aria-current="true"' : ''}
                  >
                    ${escapeHtml(plant.name)}
                  </button>
                </h3>
                <span class="plant-species">${escapeHtml(plant.species)}</span>
              </div>

              <p class="plant-task-line">
                Task: <span class="plant-task-verb">${escapeHtml(plant.task)}</span>
              </p>

              ${tier === 'overdue' ? `<p class="plant-quip">${escapeHtml(meta.quip)}</p>` : ''}
            </div>
          </div>

          <div class="plant-actions">
            <button
              type="button"
              class="btn ${primaryBtnClass}"
              data-action="complete"
              data-plant-id="${escapeHtml(plant.id)}"
              data-focus-id="complete-${escapeHtml(plant.id)}"
              aria-label="Mark ${escapeHtml(plant.name)} as ${escapeHtml(meta.doneVerb.toLowerCase())}"
            >
              ${escapeHtml(meta.doneVerb)}
            </button>

            <button
              type="button"
              class="btn btn--secondary"
              data-action="snooze"
              data-plant-id="${escapeHtml(plant.id)}"
              data-focus-id="snooze-${escapeHtml(plant.id)}"
              aria-label="Snooze ${escapeHtml(plant.name)} until tomorrow"
            >
              Snooze
            </button>

            <button
              type="button"
              class="btn btn--subtle"
              data-action="inspect"
              data-plant-id="${escapeHtml(plant.id)}"
              data-focus-id="inspect-${escapeHtml(plant.id)}"
              ${inspectAria}
            >
              ${inspectLabel}
            </button>
          </div>

          ${inlineDrawer}
        </article>
      </li>`;
  }

  function renderHandledTray(handledPlants) {
    if (!handledPlants.length) return '';

    const rows = handledPlants
      .map((plant) => {
        const badgeClass = plant.status === 'done' ? 'handled-badge--done' : 'handled-badge--snoozed';
        const statusLabel = plant.status === 'done' ? (plant.doneLabel || 'Done') : 'Snoozed';
        const isDesktop = desktopMq.matches;
        const isExpandedMobile = !isDesktop && state.expandedMobileIds.has(plant.id);
        const inlineDrawer = isExpandedMobile
          ? `<div class="inline-dossier" id="inline-dossier-${escapeHtml(plant.id)}">${renderDossierInner(plant, { compactHero: true })}</div>`
          : '';

        return `
          <li>
            <div class="handled-row">
              <div class="handled-info">
                <span class="handled-badge ${badgeClass}">${escapeHtml(statusLabel)}</span>
                <strong>${escapeHtml(plant.name)}</strong>
                <span class="plant-species">${escapeHtml(plant.location)}</span>
              </div>
              <div class="handled-controls">
                <button
                  type="button"
                  class="mini-link-btn"
                  data-action="inspect"
                  data-plant-id="${escapeHtml(plant.id)}"
                  data-focus-id="handled-inspect-${escapeHtml(plant.id)}"
                  ${isDesktop ? `aria-pressed="${state.selectedId === plant.id ? 'true' : 'false'}"` : `aria-expanded="${isExpandedMobile ? 'true' : 'false'}"`}
                >
                  ${isDesktop ? 'Inspect' : (isExpandedMobile ? 'Hide' : 'History')}
                </button>
                <button
                  type="button"
                  class="mini-link-btn"
                  data-action="restore"
                  data-plant-id="${escapeHtml(plant.id)}"
                  data-focus-id="handled-undo-${escapeHtml(plant.id)}"
                  aria-label="Undo ${escapeHtml(statusLabel.toLowerCase())} for ${escapeHtml(plant.name)}"
                >
                  Undo
                </button>
              </div>
            </div>
            ${inlineDrawer}
          </li>`;
      })
      .join('');

    return `
      <section class="handled-section" aria-label="Handled today">
        <h3 class="tier-label">Handled today (${handledPlants.length})</h3>
        <ul class="handled-list">
          ${rows}
        </ul>
      </section>`;
  }

  function renderAllDoneSanctuary(upcomingPlants, handledPlants) {
    const doneCount = handledPlants.filter((p) => p.status === 'done').length;
    const snoozedCount = handledPlants.filter((p) => p.status === 'snoozed').length;

    let headline = 'All clear on the windowsill.';
    let summary = 'Every plant due today has been tucked in. Even Frida forgave the delay.';
    if (snoozedCount > 0 && doneCount > 0) {
      summary = `${doneCount} tended today and ${snoozedCount} nudged to tomorrow — calm shelves ahead.`;
    } else if (snoozedCount > 0 && doneCount === 0) {
      headline = 'Shelf paused until tomorrow.';
      summary = `All ${snoozedCount} tasks are snoozed to tomorrow. Take a breather and check back fresh.`;
    }

    const nextUp = upcomingPlants[0] || null;
    const nextUpMarkup = nextUp
      ? `
        <div class="all-done-next">
          <div>
            <strong>Tomorrow’s first up: ${escapeHtml(nextUp.name)}</strong>
            <div class="plant-species">${escapeHtml(nextUp.species)} · ${escapeHtml(nextUp.task)} tomorrow</div>
          </div>
          <div class="all-done-next-actions">
            <button type="button" class="btn btn--secondary" data-action="inspect" data-plant-id="${escapeHtml(nextUp.id)}" data-focus-id="alldone-inspect-${escapeHtml(nextUp.id)}">
              Inspect
            </button>
            <button type="button" class="btn btn--primary" data-action="complete" data-plant-id="${escapeHtml(nextUp.id)}" data-focus-id="complete-${escapeHtml(nextUp.id)}">
              ${escapeHtml(nextUp.task)} early
            </button>
          </div>
        </div>`
      : `<p class="all-done-empty-note">Even tomorrow’s misting is sorted — nothing waiting at all.</p>`;

    const expandedUpcoming =
      nextUp && !desktopMq.matches && state.expandedMobileIds.has(nextUp.id)
        ? `<div class="inline-dossier">${renderDossierInner(nextUp, { compactHero: true })}</div>`
        : '';

    return `
      <section class="all-done-card" aria-labelledby="all-done-heading">
        <div class="all-done-art">
          ${renderAllDoneSvg()}
        </div>
        <h3 class="all-done-title" id="all-done-heading" tabindex="-1">${escapeHtml(headline)}</h3>
        <p class="all-done-copy">${escapeHtml(summary)}</p>
        ${nextUpMarkup}
        ${expandedUpcoming}
        <div class="all-done-actions">
          <button type="button" class="btn btn--secondary" id="all-done-reset-btn" data-action="reset">
            Start fresh day
          </button>
        </div>
      </section>
      ${renderHandledTray(handledPlants)}
    `;
  }

  function renderQueue() {
    const active = getSortedActivePlants();
    const overdue = active.filter(isOverduePlant);
    const today = active.filter(isTodayDuePlant);
    const upcoming = active.filter(isUpcomingPlant);
    const handled = state.plants.filter((p) => p.status !== 'active');

    const dueNowCount = overdue.length + today.length;

    if (dueNowCount === 0) {
      els.queueSubtitle.textContent = 'Today’s watering, rotating, and soil checks are complete.';
      els.queueContent.innerHTML = renderAllDoneSanctuary(upcoming, handled);
      return;
    }

    els.queueSubtitle.textContent = 'Sorted by urgency — overdue care sits first in terracotta.';

    const sections = [];
    if (overdue.length) {
      sections.push(`
        <section class="tier-group" aria-label="Overdue care">
          <h3 class="tier-label tier-label--overdue">Needs care first · Overdue</h3>
          <ul class="tier-list">
            ${overdue.map((p) => renderPlantCard(p, 'overdue')).join('')}
          </ul>
        </section>`);
    }

    if (today.length) {
      sections.push(`
        <section class="tier-group" aria-label="Due today">
          <h3 class="tier-label">Due today</h3>
          <ul class="tier-list">
            ${today.map((p) => renderPlantCard(p, 'today')).join('')}
          </ul>
        </section>`);
    }

    if (upcoming.length) {
      sections.push(`
        <section class="tier-group" aria-label="Coming up tomorrow">
          <h3 class="tier-label">Coming up · Tomorrow</h3>
          <ul class="tier-list">
            ${upcoming.map((p) => renderPlantCard(p, 'upcoming')).join('')}
          </ul>
        </section>`);
    }

    sections.push(renderHandledTray(handled));
    els.queueContent.innerHTML = sections.join('');
  }

  function renderWeeklyRhythm() {
    const total = state.week.reduce((sum, n) => sum + n, 0);
    const maxVal = Math.max(...state.week);
    const peakIndex = state.week.indexOf(maxVal);

    els.rhythmTotal.textContent = `${total} total`;
    els.rhythmCaption.textContent = `Peak on ${WEEK_LABELS[peakIndex]} (${maxVal}) · today updates live`;

    els.rhythmBars.innerHTML = state.week
      .map((count, idx) => {
        const isToday = idx === state.week.length - 1;
        const isPeak = count === maxVal && !isToday;
        const pebbles = Array.from({ length: count }, () => '<span class="pebble-bead" aria-hidden="true"></span>').join('');
        const cls = [
          'rhythm-day',
          isToday ? 'rhythm-day--today' : '',
          isPeak ? 'rhythm-day--peak' : ''
        ]
          .filter(Boolean)
          .join(' ');

        return `
          <li class="${cls}" aria-label="${WEEK_LABELS[idx]}: ${count} care ${count === 1 ? 'action' : 'actions'}">
            <div class="pebble-stack">${pebbles}</div>
            <span class="rhythm-count">${count}</span>
            <span class="rhythm-label">${WEEK_SHORT[idx]}</span>
          </li>`;
      })
      .join('');
  }

  function renderDesktopDossier() {
    if (!desktopMq.matches) {
      els.desktopDossier.innerHTML = '';
      return;
    }

    const selected = getPlantById(state.selectedId) || state.plants[0];
    if (!selected) return;
    state.selectedId = selected.id;
    els.desktopDossier.innerHTML = renderDossierInner(selected);
  }

  function renderToast() {
    if (!state.toast) {
      els.toastRegion.innerHTML = '';
      return;
    }

    els.toastRegion.innerHTML = `
      <div class="toast-pill">
        <span class="toast-msg">${escapeHtml(state.toast.message)}</span>
        <div class="toast-controls">
          ${state.toast.canUndo ? '<button type="button" class="toast-undo-btn" data-action="undo-toast">Undo</button>' : ''}
          <button type="button" class="toast-close-btn" data-action="dismiss-toast" aria-label="Dismiss notification">✕</button>
        </div>
      </div>`;
  }

  function render() {
    const activeFocusId = document.activeElement?.dataset?.focusId || null;

    renderMastheadStatus();
    renderQueue();
    renderWeeklyRhythm();
    renderDesktopDossier();
    renderToast();

    const focusSelector = state.pendingFocusSelector
      || (activeFocusId ? `[data-focus-id="${activeFocusId}"]` : null);
    state.pendingFocusSelector = null;

    if (focusSelector) {
      const target = document.querySelector(focusSelector);
      if (target) {
        target.focus({ preventScroll: true });
      }
    }
  }

  function announce(text) {
    els.srAnnouncer.textContent = '';
    window.setTimeout(() => {
      els.srAnnouncer.textContent = text;
    }, 20);
  }

  function clearToast() {
    if (state.toastTimer) {
      window.clearTimeout(state.toastTimer);
      state.toastTimer = null;
    }
    state.toast = null;
    state.toastPaused = false;
  }

  function scheduleToastDismiss() {
    if (state.toastTimer) window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      if (!state.toastPaused) {
        state.toast = null;
        renderToast();
      }
    }, 7000);
  }

  function showToast(message, canUndo = true) {
    state.toast = { message, canUndo };
    state.toastPaused = false;
    renderToast();
    scheduleToastDismiss();
    announce(`${message}${canUndo ? ' Undo available.' : ''}`);
  }

  function pushUndoSnapshot(plantId, weekDelta, label) {
    const plant = getPlantById(plantId);
    if (!plant) return;
    state.undoStack.push({
      plantId,
      plantSnapshot: cloneJson(plant),
      weekDelta,
      label
    });
  }

  function computeExitFocusTarget(exitingPlantId) {
    const remaining = getSortedActivePlants().filter((p) => p.id !== exitingPlantId);
    const dueRemaining = remaining.filter((p) => isOverduePlant(p) || isTodayDuePlant(p));
    if (dueRemaining.length > 0) {
      return `[data-focus-id="complete-${dueRemaining[0].id}"]`;
    }
    return '#all-done-heading';
  }

  function completePlantTask(plantId) {
    const plant = getPlantById(plantId);
    if (!plant || plant.status !== 'active') return;

    const meta = getMeta(plant.id);
    const nextFocus = computeExitFocusTarget(plantId);
    pushUndoSnapshot(plantId, 1, meta.doneVerb);

    plant.status = 'done';
    plant.doneLabel = meta.doneVerb;
    plant.due = 'Tended today';
    plant.history.unshift(`Today · ${meta.doneVerb}`);
    state.week[state.week.length - 1] += 1;

    // Advance desktop selection gently to next due plant if current left active queue
    const remaining = getSortedActivePlants();
    if (desktopMq.matches && remaining.length > 0) {
      state.selectedId = remaining[0].id;
    }
    state.expandedMobileIds.delete(plantId);
    state.pendingFocusSelector = nextFocus;

    render();
    const toastMessage = meta.doneVerb === 'Checked soil'
      ? `Checked ${plant.name}’s soil.`
      : `${meta.doneVerb} ${plant.name}.`;
    showToast(toastMessage, true);
  }

  function logWatered(plantId) {
    const plant = getPlantById(plantId);
    if (!plant) return;

    if (plant.task.toLowerCase() === 'water' && plant.status === 'active') {
      completePlantTask(plantId);
      return;
    }

    pushUndoSnapshot(plantId, 1, 'Watered');
    plant.history.unshift('Today · Watered');
    state.week[state.week.length - 1] += 1;
    render();
    showToast(`Logged watering for ${plant.name}.`, true);
  }

  function snoozePlant(plantId) {
    const plant = getPlantById(plantId);
    if (!plant || plant.status !== 'active') return;

    const nextFocus = computeExitFocusTarget(plantId);
    pushUndoSnapshot(plantId, 0, 'Snoozed');

    const wasTomorrow = /tomorrow/i.test(plant.originalDue);
    plant.status = 'snoozed';
    plant.urgency = 0;
    plant.due = wasTomorrow ? 'Snoozed · In 2 days' : 'Snoozed · Tomorrow';
    plant.history.unshift(wasTomorrow ? 'Today · Snoozed 2 days' : 'Today · Snoozed to tomorrow');

    const remaining = getSortedActivePlants();
    if (desktopMq.matches && remaining.length > 0) {
      state.selectedId = remaining[0].id;
    }
    state.expandedMobileIds.delete(plantId);
    state.pendingFocusSelector = nextFocus;

    render();
    showToast(`Snoozed ${plant.name} until tomorrow.`, true);
  }

  function restoreSpecificPlant(plantId) {
    const plant = getPlantById(plantId);
    if (!plant) return;

    const orig = state.sourceData.plants.find((p) => p.id === plantId);
    if (!orig) return;

    // Find latest matching snapshot for this plant if present, else restore baseline
    let idx = -1;
    for (let i = state.undoStack.length - 1; i >= 0; i -= 1) {
      if (state.undoStack[i].plantId === plantId) {
        idx = i;
        break;
      }
    }

    if (idx !== -1) {
      const entry = state.undoStack.splice(idx, 1)[0];
      const pos = state.plants.findIndex((p) => p.id === plantId);
      state.plants[pos] = entry.plantSnapshot;
      state.week[state.week.length - 1] = Math.max(0, state.week[state.week.length - 1] - entry.weekDelta);
    } else {
      const pos = state.plants.findIndex((p) => p.id === plantId);
      state.plants[pos] = {
        ...cloneJson(orig),
        status: 'active',
        doneLabel: null,
        originalDue: orig.due,
        originalUrgency: orig.urgency
      };
    }

    state.selectedId = plantId;
    state.pendingFocusSelector = `[data-focus-id="complete-${plantId}"]`;
    clearToast();
    render();
    announce(`Restored ${plant.name} to care queue.`);
  }

  function undoLastAction() {
    const entry = state.undoStack.pop();
    if (!entry) return;

    const pos = state.plants.findIndex((p) => p.id === entry.plantId);
    if (pos !== -1) {
      state.plants[pos] = entry.plantSnapshot;
    }
    state.week[state.week.length - 1] = Math.max(0, state.week[state.week.length - 1] - entry.weekDelta);
    state.selectedId = entry.plantId;
    state.pendingFocusSelector = `[data-focus-id="complete-${entry.plantId}"]`;
    clearToast();
    render();
    announce(`Undid ${entry.label.toLowerCase()} for ${entry.plantSnapshot.name}.`);
  }

  function addObservation(plantId, rawText, keepInputFocus = false) {
    const text = rawText.trim();
    const plant = getPlantById(plantId);
    if (!plant || !text) return;

    pushUndoSnapshot(plantId, 0, 'Note');
    plant.history.unshift(`Today · ${text}`);
    if (keepInputFocus) {
      state.pendingFocusSelector = `#note-input-${plantId}`;
    }
    render();
    showToast(`Added observation to ${plant.name}.`, true);
  }

  function inspectPlant(plantId) {
    if (desktopMq.matches) {
      state.selectedId = plantId;
      render();
      const plant = getPlantById(plantId);
      if (plant) announce(`Showing details for ${plant.name}.`);
      return;
    }

    if (state.expandedMobileIds.has(plantId)) {
      state.expandedMobileIds.delete(plantId);
    } else {
      state.expandedMobileIds.add(plantId);
    }
    state.selectedId = plantId;
    render();
  }

  function resetDay() {
    hydrateState(state.sourceData);
    const first = getSortedActivePlants()[0];
    state.pendingFocusSelector = first ? `[data-focus-id="complete-${first.id}"]` : '#queue-heading';
    render();
    showToast('Reset to morning care queue.', false);
  }

  function handleActionClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.tagName === 'FORM') return;

    const action = button.dataset.action;
    const plantId = button.dataset.plantId;

    if (action === 'complete' && plantId) {
      completePlantTask(plantId);
    } else if (action === 'water' && plantId) {
      logWatered(plantId);
    } else if (action === 'snooze' && plantId) {
      snoozePlant(plantId);
    } else if (action === 'inspect' && plantId) {
      inspectPlant(plantId);
    } else if (action === 'restore' && plantId) {
      restoreSpecificPlant(plantId);
    } else if (action === 'quick-note' && plantId) {
      addObservation(plantId, button.dataset.note || '', false);
    } else if (action === 'undo-toast') {
      undoLastAction();
    } else if (action === 'dismiss-toast') {
      const wasFocusedInside = els.toastRegion.contains(document.activeElement);
      clearToast();
      renderToast();
      if (wasFocusedInside) {
        const first = getSortedActivePlants()[0];
        const fallback = first ? document.querySelector(`[data-focus-id="complete-${first.id}"]`) : document.getElementById('all-done-reset-btn');
        if (fallback) fallback.focus({ preventScroll: true });
      }
    } else if (action === 'reset') {
      resetDay();
    }
  }

  function handleFormSubmit(event) {
    const form = event.target.closest('form[data-action="note-form"]');
    if (!form) return;
    event.preventDefault();
    const plantId = form.dataset.plantId;
    const input = form.querySelector('input[name="note"]');
    if (!input) return;
    addObservation(plantId, input.value, true);
  }

  async function loadInitialData() {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      try {
        const response = await fetch('./PLANTS.json', { cache: 'no-store' });
        if (response.ok) {
          const json = await response.json();
          if (json && Array.isArray(json.plants)) {
            return json;
          }
        }
      } catch (_) {
        // Use embedded PLANTS.json copy when offline or fetch-restricted
      }
    }
    return FALLBACK_DATA;
  }

  function bindEvents() {
    document.addEventListener('click', handleActionClick);
    document.addEventListener('submit', handleFormSubmit);

    els.resetBtn.addEventListener('click', resetDay);

    els.toastRegion.addEventListener('mouseenter', () => {
      state.toastPaused = true;
    });
    els.toastRegion.addEventListener('mouseleave', () => {
      state.toastPaused = false;
      if (state.toast) scheduleToastDismiss();
    });
    els.toastRegion.addEventListener('focusin', () => {
      state.toastPaused = true;
    });
    els.toastRegion.addEventListener('focusout', () => {
      state.toastPaused = false;
      if (state.toast) scheduleToastDismiss();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (state.toast) {
          const wasFocusedInside = els.toastRegion.contains(document.activeElement);
          clearToast();
          renderToast();
          if (wasFocusedInside) {
            const first = getSortedActivePlants()[0];
            const fallback = first ? document.querySelector(`[data-focus-id="complete-${first.id}"]`) : document.getElementById('all-done-reset-btn');
            if (fallback) fallback.focus({ preventScroll: true });
          }
        } else if (!desktopMq.matches && state.expandedMobileIds.size > 0) {
          const lastExpanded = Array.from(state.expandedMobileIds).pop();
          state.expandedMobileIds.clear();
          state.pendingFocusSelector = lastExpanded ? `[data-focus-id="inspect-${lastExpanded}"]` : null;
          render();
        }
      }
    });

    desktopMq.addEventListener('change', () => {
      render();
    });
  }

  async function init() {
    bindEvents();
    const initial = await loadInitialData();
    hydrateState(initial);
    render();
  }

  init();
})();
