/* ==========================================================================
   Moss — Gentle Household Plant Care
   Pure local vanilla JS. Loads PLANTS.json with seamless offline/file:// fallback.
   ========================================================================== */

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

  const PLANT_PERSONALITY = {
    fern: {
      quirk: 'Loves shower steam; gets gently dramatic when her soil dries out.',
      actionLabel: 'Watered',
      pastVerb: 'Watered',
      waterCadence: 'Keep evenly damp, never soggy',
      lightLevel: 1
    },
    pothos: {
      quirk: 'Leans slowly toward the hallway lamp unless given a quarter turn.',
      actionLabel: 'Rotated',
      pastVerb: 'Rotated',
      waterCadence: 'Water when top inch feels dry',
      lightLevel: 2
    },
    cactus: {
      quirk: 'Happiest left in peace; prefers a dry wooden-skewer pinch test.',
      actionLabel: 'Soil checked',
      pastVerb: 'Checked soil',
      waterCadence: 'Deep soak only when bone dry',
      lightLevel: 3
    },
    calathea: {
      quirk: 'Folds her striped leaves at dusk and sighs over crisp bedroom air.',
      actionLabel: 'Misted',
      pastVerb: 'Misted',
      waterCadence: 'Filtered water & soft morning mist',
      lightLevel: 2
    }
  };

  const DAY_NAMES = [
    { short: 'Mon', full: 'Monday' },
    { short: 'Tue', full: 'Tuesday' },
    { short: 'Wed', full: 'Wednesday' },
    { short: 'Thu', full: 'Thursday' },
    { short: 'Fri', full: 'Friday' },
    { short: 'Sat', full: 'Saturday' },
    { short: 'Today', full: 'Today (Tue, Sep 22)' }
  ];

  const TOAST_DURATION_MS = 7500;
  const desktopQuery = window.matchMedia('(min-width: 860px)');

  const state = {
    initialSource: null,
    plants: [],
    week: [],
    baseWeekToday: 3,
    selectedId: 'fern',
    expandedId: null,
    selectedDayIndex: 6,
    celebrateId: null,
    undoSnapshot: null,
    hasChanges: false
  };

  const toastCtrl = {
    timerId: null,
    remainingMs: 0,
    startedAt: 0,
    visible: false
  };

  const dom = {
    headerWhisper: document.getElementById('header-whisper'),
    pebbleTracker: document.getElementById('pebble-tracker'),
    headerResetBtn: document.getElementById('header-reset-btn'),
    queueCountLabel: document.getElementById('queue-count-label'),
    overdueZone: document.getElementById('overdue-zone'),
    todayZone: document.getElementById('today-zone'),
    allDoneZone: document.getElementById('all-done-zone'),
    restingZone: document.getElementById('resting-zone'),
    desktopDossier: document.getElementById('desktop-dossier'),
    rhythmPanel: document.getElementById('rhythm-panel'),
    toastRegion: document.getElementById('toast-region'),
    srAnnouncer: document.getElementById('sr-announcer')
  };

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cloneData(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isDesktop() {
    return desktopQuery.matches;
  }

  function announce(message) {
    if (!dom.srAnnouncer) return;
    dom.srAnnouncer.textContent = '';
    window.setTimeout(() => {
      dom.srAnnouncer.textContent = message;
    }, 30);
  }

  function getPlantMeta(plant) {
    const preset = PLANT_PERSONALITY[plant.id] || {};
    const taskLower = (plant.task || '').toLowerCase();
    const defaultAction =
      taskLower === 'water'
        ? 'Watered'
        : taskLower === 'rotate'
        ? 'Rotated'
        : taskLower === 'mist'
        ? 'Misted'
        : 'Done';

    return {
      quirk: preset.quirk || 'Settled comfortably in its favorite spot.',
      actionLabel: preset.actionLabel || defaultAction,
      pastVerb: preset.pastVerb || defaultAction,
      waterCadence: preset.waterCadence || 'Check soil before watering',
      lightLevel: preset.lightLevel || (plant.light.toLowerCase().includes('bright') ? 3 : plant.light.toLowerCase().includes('low') ? 1 : 2)
    };
  }

  function getLastWatered(plant) {
    const entry = plant.history.find((item) => /watered/i.test(item));
    if (!entry) return 'Not yet logged';
    const parts = entry.split('·').map((s) => s.trim());
    return parts[0] || entry;
  }

  function parseHistoryEntry(entry) {
    const parts = entry.split('·');
    if (parts.length >= 2) {
      return {
        date: parts[0].trim(),
        text: parts.slice(1).join('·').trim()
      };
    }
    return { date: 'Note', text: entry.trim() };
  }

  function getHistoryDotClass(text) {
    if (/water|mist/i.test(text)) return 'history-dot--water';
    if (/frond|pad|edge|leaf|note|bud|sprout/i.test(text)) return 'history-dot--obs';
    return '';
  }

  function hydrateState(raw) {
    state.initialSource = cloneData(raw);
    state.plants = raw.plants.map((p) => {
      const initialStatus = p.urgency > 0 ? 'active' : 'upcoming';
      return {
        ...p,
        history: [...p.history],
        status: initialStatus,
        initialDue: p.due,
        initialUrgency: p.urgency,
        initialStatus,
        wasDueToday: p.urgency > 0,
        freshCount: 0,
        rotated: false
      };
    });
    state.week = [...raw.week];
    state.baseWeekToday = raw.week[6] ?? 0;

    const sortedActive = getActivePlants();
    state.selectedId = sortedActive[0] ? sortedActive[0].id : state.plants[0]?.id || null;
    state.expandedId = null;
    state.selectedDayIndex = 6;
    state.celebrateId = null;
    state.undoSnapshot = null;
    state.hasChanges = false;
  }

  function getPlantById(id) {
    return state.plants.find((p) => p.id === id) || null;
  }

  function getActivePlants() {
    return state.plants
      .filter((p) => p.status === 'active')
      .sort((a, b) => b.urgency - a.urgency);
  }

  function getOverduePlants() {
    return getActivePlants().filter((p) => p.urgency >= 3);
  }

  function getDueTodayPlants() {
    return getActivePlants().filter((p) => p.urgency > 0 && p.urgency < 3);
  }

  function getUpcomingAndSnoozedPlants() {
    return state.plants.filter((p) => p.status === 'upcoming' || p.status === 'snoozed');
  }

  function getDonePlants() {
    return state.plants.filter((p) => p.status === 'done');
  }

  /* ------------------------------------------------------------------------
     Inline SVG Icons & Bespoke Botanical Portraits
     ------------------------------------------------------------------------ */

  function iconSvg(kind) {
    switch (kind) {
      case 'water':
        return `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
          <path d="M10 2.6C10 2.6 4.8 8.3 4.8 12.1C4.8 15 7.1 17.3 10 17.3C12.9 17.3 15.2 15 15.2 12.1C15.2 8.3 10 2.6 10 2.6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M8.1 12.4C8.1 13.7 9 14.6 10.2 14.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>`;
      case 'rotate':
        return `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
          <path d="M15.4 8.2A5.8 5.8 0 1 0 14.8 13.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M15.8 4.4V8.5H11.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case 'soil':
        return `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
          <path d="M4.2 13.2C6.4 12.1 8.4 12.1 10 13.2C11.6 14.3 13.6 14.3 15.8 13.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M10 3.2V11.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M7.5 8.8L10 11.3L12.5 8.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="6.2" cy="16.2" r="1" fill="currentColor"/>
          <circle cx="10.2" cy="16.6" r="1" fill="currentColor"/>
          <circle cx="14" cy="16" r="1" fill="currentColor"/>
        </svg>`;
      case 'mist':
        return `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
          <circle cx="6" cy="7.5" r="1.3" fill="currentColor"/>
          <circle cx="10" cy="5.5" r="1.4" fill="currentColor"/>
          <circle cx="14" cy="7.5" r="1.3" fill="currentColor"/>
          <circle cx="8" cy="11.5" r="1.3" fill="currentColor"/>
          <circle cx="12.5" cy="11.5" r="1.3" fill="currentColor"/>
          <circle cx="10" cy="15.2" r="1.2" fill="currentColor"/>
        </svg>`;
      case 'snooze':
        return `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
          <path d="M14.8 12.4A5.7 5.7 0 0 1 7.6 5.2A5.8 5.8 0 1 0 14.8 12.4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>`;
      case 'sun':
        return `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="3.4" stroke="currentColor" stroke-width="1.7"/>
          <path d="M10 3.2V4.8M10 15.2V16.8M3.2 10H4.8M15.2 10H16.8M5.2 5.2L6.3 6.3M13.7 13.7L14.8 14.8M14.8 5.2L13.7 6.3M6.3 13.7L5.2 14.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>`;
      case 'chevron':
        return `<svg class="chevron-icon" viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
          <path d="M5.5 7.8L10 12.3L14.5 7.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case 'check':
        return `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
          <path d="M4.5 10.4L8.2 14L15.6 6.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case 'undo':
        return `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
          <path d="M6.4 6.5H12A4.4 4.4 0 1 1 12 15.3H7.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M8.5 3.9L5.7 6.5L8.5 9.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      default:
        return '';
    }
  }

  function getTaskIconKind(task) {
    const t = (task || '').toLowerCase();
    if (t.includes('water')) return 'water';
    if (t.includes('rotate')) return 'rotate';
    if (t.includes('soil')) return 'soil';
    if (t.includes('mist')) return 'mist';
    return 'check';
  }

  function renderPlantSvg(plant, sizeClass = '') {
    const isOverdue = plant.status === 'active' && plant.urgency >= 3;
    const isDone = plant.status === 'done';
    const isRotated = plant.rotated || (plant.id === 'pothos' && isDone);
    const stateClasses = [
      'plant-portrait-svg',
      sizeClass,
      isOverdue ? 'is-overdue' : '',
      isDone ? 'is-tended' : '',
      isRotated ? 'is-rotated' : ''
    ]
      .filter(Boolean)
      .join(' ');

    if (plant.id === 'fern') {
      return `<svg class="${stateClasses}" viewBox="0 0 110 112" fill="none" aria-hidden="true">
        <!-- Soft bathroom steam wisps -->
        <path d="M22 22C24 18 22 14 25 11" stroke="#8AB097" stroke-width="1.8" stroke-linecap="round" opacity="0.55"/>
        <path d="M86 24C88 20 86 16 89 13" stroke="#8AB097" stroke-width="1.8" stroke-linecap="round" opacity="0.55"/>
        <!-- Left arching frond -->
        <g class="svg-frond-left">
          <path d="M52 67C39 58 26 48 16 34" stroke="#244E39" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M44 61C38 56 32 58 29 53C35 52 40 54 44 61Z" fill="#3D7856" stroke="#1D2A22" stroke-width="1.5"/>
          <path d="M36 53C30 48 23 49 21 43C27 43 32 46 36 53Z" fill="#538F68" stroke="#1D2A22" stroke-width="1.5"/>
          <path d="M28 44C22 40 16 40 14 34C20 35 25 38 28 44Z" fill="#6AA57B" stroke="#1D2A22" stroke-width="1.5"/>
          <path d="M41 59C43 52 40 46 44 42C47 47 46 53 41 59Z" fill="#2C5E44" stroke="#1D2A22" stroke-width="1.5"/>
          <path d="M32 50C34 44 31 38 35 34C38 39 37 45 32 50Z" fill="#3D7856" stroke="#1D2A22" stroke-width="1.5"/>
        </g>
        <!-- Right arching frond -->
        <g class="svg-frond-right">
          <path d="M58 67C71 58 84 48 94 34" stroke="#244E39" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M66 61C72 56 78 58 81 53C75 52 70 54 66 61Z" fill="#3D7856" stroke="#1D2A22" stroke-width="1.5"/>
          <path d="M74 53C80 48 87 49 89 43C83 43 78 46 74 53Z" fill="#538F68" stroke="#1D2A22" stroke-width="1.5"/>
          <path d="M82 44C88 40 94 40 96 34C90 35 85 38 82 44Z" fill="#6AA57B" stroke="#1D2A22" stroke-width="1.5"/>
          <path d="M69 59C67 52 70 46 66 42C63 47 64 53 69 59Z" fill="#2C5E44" stroke="#1D2A22" stroke-width="1.5"/>
          <path d="M78 50C76 44 79 38 75 34C72 39 73 45 78 50Z" fill="#3D7856" stroke="#1D2A22" stroke-width="1.5"/>
        </g>
        <!-- Center upright frond -->
        <path d="M55 68C54 50 55 34 56 18" stroke="#1D2A22" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M55 56C47 50 44 43 47 39C52 43 54 49 55 56Z" fill="#2C5E44" stroke="#1D2A22" stroke-width="1.5"/>
        <path d="M55 56C63 50 66 43 63 39C58 43 56 49 55 56Z" fill="#3D7856" stroke="#1D2A22" stroke-width="1.5"/>
        <path d="M55 43C48 37 46 30 49 26C53 30 55 36 55 43Z" fill="#538F68" stroke="#1D2A22" stroke-width="1.5"/>
        <path d="M55 43C62 37 64 30 61 26C57 30 55 36 55 43Z" fill="#6AA57B" stroke="#1D2A22" stroke-width="1.5"/>
        <path d="M56 29C52 24 53 18 56 15C59 18 60 24 56 29Z" fill="#82BC8F" stroke="#1D2A22" stroke-width="1.5"/>
        <!-- Speckled Terracotta Pot -->
        <path d="M31 68H79L73.5 99C73 101.8 70.5 103.5 67.6 103.5H42.4C39.5 103.5 37 101.8 36.5 99L31 68Z" fill="#C9633F" stroke="#1D2A22" stroke-width="2.2" stroke-linejoin="round"/>
        <rect x="27" y="61" width="56" height="9.5" rx="4.5" fill="#D87551" stroke="#1D2A22" stroke-width="2.2"/>
        <circle cx="43" cy="82" r="1.6" fill="#8E381B"/>
        <circle cx="57" cy="91" r="1.5" fill="#8E381B"/>
        <circle cx="66" cy="79" r="1.7" fill="#8E381B"/>
        <circle cx="48" cy="95" r="1.3" fill="#F2B89B"/>
        ${
          isOverdue
            ? `<path d="M90 14C90 14 84 20.5 84 24.4C84 27.7 86.7 30.2 90 30.2C93.3 30.2 96 27.7 96 24.4C96 20.5 90 14 90 14Z" fill="#F8DFD1" stroke="#933417" stroke-width="2" stroke-dasharray="3 2"/>`
            : ''
        }
        ${
          isDone
            ? `<circle cx="24" cy="24" r="3" fill="#5CA4B5" stroke="#1D2A22" stroke-width="1.3"/>
               <circle cx="87" cy="21" r="3.4" fill="#5CA4B5" stroke="#1D2A22" stroke-width="1.3"/>
               <circle cx="71" cy="14" r="2.2" fill="#82BC8F" stroke="#1D2A22" stroke-width="1.2"/>`
            : ''
        }
      </svg>`;
    }

    if (plant.id === 'pothos') {
      return `<svg class="${stateClasses}" viewBox="0 0 110 112" fill="none" aria-hidden="true">
        <!-- Trailing variegated pothos vine (flips gently when rotated!) -->
        <g class="svg-pothos-vine">
          <path d="M55 62C54 44 43 32 30 27" stroke="#244E39" stroke-width="2.3" stroke-linecap="round"/>
          <path d="M57 62C68 48 80 51 86 67C90 78 88 91 82 99" stroke="#244E39" stroke-width="2.3" stroke-linecap="round"/>
          <path d="M54 58C60 40 69 27 78 22" stroke="#244E39" stroke-width="2.2" stroke-linecap="round"/>
          <!-- Heart leaves with golden variegation -->
          <path d="M32 28C22 20 14 27 17 36C20 43 29 44 36 39C39 35 37 31 32 28Z" fill="#3B7A57" stroke="#1D2A22" stroke-width="1.9" stroke-linejoin="round"/>
          <path d="M23 30C26 32 29 35 31 38" stroke="#EBC96E" stroke-width="2" stroke-linecap="round"/>
          <path d="M77 23C86 16 95 23 91 33C87 40 78 40 71 35C69 31 72 26 77 23Z" fill="#2C5E44" stroke="#1D2A22" stroke-width="1.9" stroke-linejoin="round"/>
          <path d="M84 26C81 29 79 32 76 34" stroke="#EBC96E" stroke-width="2" stroke-linecap="round"/>
          <path d="M47 45C40 34 45 22 55 24C64 26 65 37 59 46C55 50 50 49 47 45Z" fill="#538F68" stroke="#1D2A22" stroke-width="1.9" stroke-linejoin="round"/>
          <path d="M54 30C55 35 55 40 54 44" stroke="#EBC96E" stroke-width="2" stroke-linecap="round"/>
          <path d="M86 66C95 66 99 75 93 82C88 87 80 84 78 76C77 71 81 66 86 66Z" fill="#3B7A57" stroke="#1D2A22" stroke-width="1.9" stroke-linejoin="round"/>
          <path d="M84 95C91 96 93 103 87 107C82 109 76 106 76 100C76 96 80 94 84 95Z" fill="#6AA57B" stroke="#1D2A22" stroke-width="1.8" stroke-linejoin="round"/>
        </g>
        <!-- Glazed cream stoneware cylinder pot with ochre band -->
        <path d="M31 61H79V93C79 98.5 74.5 103 69 103H41C35.5 103 31 98.5 31 93V61Z" fill="#F2E8D5" stroke="#1D2A22" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M31 76H79V86H31V76Z" fill="#DFA749" stroke="#1D2A22" stroke-width="1.8"/>
        <line x1="27" y1="61" x2="83" y2="61" stroke="#1D2A22" stroke-width="2.4" stroke-linecap="round"/>
        ${
          isDone
            ? `<circle cx="24" cy="19" r="3" fill="#DFA749" stroke="#1D2A22" stroke-width="1.3"/>
               <circle cx="88" cy="16" r="2.4" fill="#538F68" stroke="#1D2A22" stroke-width="1.2"/>`
            : ''
        }
      </svg>`;
    }

    if (plant.id === 'cactus') {
      return `<svg class="${stateClasses}" viewBox="0 0 110 112" fill="none" aria-hidden="true">
        <!-- South window sun-arch halo -->
        <path class="svg-cactus-halo" d="M22 72A33 33 0 0 1 88 72" fill="${isDone ? '#F6D680' : '#F4DFAA'}" opacity="${isDone ? '0.92' : '0.62'}"/>
        <!-- Bunny ears opuntia pads -->
        <!-- Left ear -->
        <ellipse cx="38" cy="40" rx="11.5" ry="18" transform="rotate(-18 38 40)" fill="#5E9567" stroke="#1D2A22" stroke-width="2.2"/>
        <!-- Right ear -->
        <ellipse cx="72" cy="39" rx="11" ry="17" transform="rotate(17 72 39)" fill="#4D8259" stroke="#1D2A22" stroke-width="2.2"/>
        <!-- Tiny new pad noted Sep 01! -->
        <ellipse cx="81" cy="21" rx="5.5" ry="7.5" transform="rotate(24 81 21)" fill="#80B584" stroke="#1D2A22" stroke-width="1.9"/>
        <!-- Main center pad -->
        <ellipse cx="55" cy="59" rx="17" ry="20" fill="#467A53" stroke="#1D2A22" stroke-width="2.2"/>
        <!-- Botanical golden stippling (areoles) -->
        <circle cx="35" cy="34" r="1.4" fill="#F2D17B"/>
        <circle cx="40" cy="44" r="1.4" fill="#F2D17B"/>
        <circle cx="33" cy="43" r="1.3" fill="#F2D17B"/>
        <circle cx="71" cy="33" r="1.4" fill="#F2D17B"/>
        <circle cx="74" cy="43" r="1.4" fill="#F2D17B"/>
        <circle cx="67" cy="41" r="1.3" fill="#F2D17B"/>
        <circle cx="50" cy="53" r="1.5" fill="#F2D17B"/>
        <circle cx="60" cy="55" r="1.5" fill="#F2D17B"/>
        <circle cx="55" cy="63" r="1.5" fill="#F2D17B"/>
        <circle cx="47" cy="63" r="1.4" fill="#F2D17B"/>
        <circle cx="63" cy="64" r="1.4" fill="#F2D17B"/>
        <!-- Squat striped desert clay bowl -->
        <path d="M27 72H83L78 96C77 100.5 73 103.5 68 103.5H42C37 103.5 33 100.5 32 96L27 72Z" fill="#DFC39B" stroke="#1D2A22" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M29.5 82H80.5" stroke="#C24E2A" stroke-width="3.5"/>
        <path d="M31.5 91H78.5" stroke="#1D2A22" stroke-width="1.6" stroke-dasharray="4 4"/>
      </svg>`;
    }

    // Default / Calathea orbifolia (Drama)
    return `<svg class="${stateClasses}" viewBox="0 0 110 112" fill="none" aria-hidden="true">
      ${
        isDone
          ? `<g class="svg-mist-arcs">
               <path d="M26 20C36 12 46 12 54 18" stroke="#5393A3" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 5"/>
               <path d="M58 17C68 11 79 13 86 21" stroke="#5393A3" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 5"/>
             </g>`
          : ''
      }
      <!-- Stems -->
      <path d="M52 70C46 56 39 48 34 42" stroke="#244E39" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M58 70C64 55 71 47 77 41" stroke="#244E39" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M55 70V40" stroke="#244E39" stroke-width="2.2" stroke-linecap="round"/>
      <!-- Broad Calathea orbifolia leaves with silver-sage curved stripes -->
      <g>
        <ellipse cx="30" cy="40" rx="18" ry="13" transform="rotate(-24 30 40)" fill="#34684B" stroke="#1D2A22" stroke-width="2.1"/>
        <path d="M18 44C25 40 33 38 42 36" stroke="#B9D7C1" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M22 36C27 34 32 33 37 32" stroke="#B9D7C1" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M23 48C29 45 34 43 40 42" stroke="#B9D7C1" stroke-width="1.5" stroke-linecap="round"/>
      </g>
      <g>
        <ellipse cx="79" cy="41" rx="18" ry="13" transform="rotate(22 79 41)" fill="#3F7857" stroke="#1D2A22" stroke-width="2.1"/>
        <path d="M91 45C84 41 76 39 67 37" stroke="#C4DFCB" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M87 37C82 35 77 34 72 33" stroke="#C4DFCB" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M85 49C80 46 75 44 69 43" stroke="#C4DFCB" stroke-width="1.5" stroke-linecap="round"/>
      </g>
      <g>
        <ellipse cx="55" cy="34" rx="16.5" ry="19" fill="#2C5E44" stroke="#1D2A22" stroke-width="2.1"/>
        <path d="M55 17V50" stroke="#B7D6BF" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M43 26C48 28 51 30 55 32C59 30 62 28 67 26" stroke="#B7D6BF" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M41 35C47 37 51 38 55 40C59 38 63 37 69 35" stroke="#B7D6BF" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M45 44C49 45 52 46 55 47C58 46 61 45 65 44" stroke="#B7D6BF" stroke-width="1.5" stroke-linecap="round"/>
      </g>
      <!-- Matte sage footed ceramic planter -->
      <path d="M30 69H80L76 92C75 96.5 71 99.5 66 99.5H44C39 99.5 35 96.5 34 92L30 69Z" fill="#B5C7B6" stroke="#1D2A22" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M41 99.5L39 105H46L47 99.5" fill="#9BB39D" stroke="#1D2A22" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M69 99.5L71 105H64L63 99.5" fill="#9BB39D" stroke="#1D2A22" stroke-width="1.8" stroke-linejoin="round"/>
    </svg>`;
  }

  function renderAllDoneSvg() {
    return `<svg class="all-done-art" viewBox="0 0 132 104" fill="none" aria-hidden="true">
      <!-- Warm sunlit arch window -->
      <path d="M24 84V44C24 22 41 8 66 8C91 8 108 22 108 44V84H24Z" fill="#FBF1D4" stroke="#1D2A22" stroke-width="2.2"/>
      <circle cx="84" cy="31" r="11" fill="#F0C765"/>
      <!-- Resting watering can -->
      <path d="M36 60H64V83H40C37.8 83 36 81.2 36 79V60Z" fill="#D5734E" stroke="#1D2A22" stroke-width="2.1" stroke-linejoin="round"/>
      <path d="M36 65C28 65 27 78 36 78" stroke="#1D2A22" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M64 74L79 58" stroke="#1D2A22" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="81" cy="56" rx="4.5" ry="2.8" transform="rotate(-38 81 56)" fill="#E9B85B" stroke="#1D2A22" stroke-width="1.8"/>
      <!-- Happy moss pebble sprout -->
      <path d="M74 79C74 71 81 66 91 66C101 66 107 71 107 78.5C107 82 104 84 99 84H80C76 84 74 82 74 79Z" fill="#C9DFC8" stroke="#1D2A22" stroke-width="2.1"/>
      <path d="M90 67C90 59 94 53 102 52C101 59 97 65 90 67Z" fill="#538F68" stroke="#1D2A22" stroke-width="2"/>
      <path d="M90 67C89 60 84 55 77 55C79 61 84 65 90 67Z" fill="#2C5E44" stroke="#1D2A22" stroke-width="2"/>
      <!-- Windowsill ledge -->
      <rect x="12" y="83" width="108" height="10" rx="5" fill="#E3D4BC" stroke="#1D2A22" stroke-width="2.2"/>
    </svg>`;
  }

  /* ------------------------------------------------------------------------
     Shared Specimen Detail Markup (Used inline on mobile, sticky aside on desktop)
     ------------------------------------------------------------------------ */

  function renderSpecimenDetailsMarkup(plant, mode) {
    const meta = getPlantMeta(plant);
    const lastWatered = getLastWatered(plant);
    const isTaskWater = plant.task.toLowerCase() === 'water';
    const isDesktopMode = mode === 'desktop';
    const isOverdue = plant.status === 'active' && plant.urgency >= 3;

    const statusBadge =
      plant.status === 'done'
        ? `<span class="due-pill due-pill--done">${iconSvg('check')} Tended today</span>`
        : plant.status === 'snoozed'
        ? `<span class="due-pill due-pill--snoozed">${iconSvg('snooze')} Snoozed · Tomorrow</span>`
        : isOverdue
        ? `<span class="due-pill due-pill--overdue">${escapeHtml(plant.due)}</span>`
        : plant.status === 'upcoming'
        ? `<span class="due-pill due-pill--tomorrow">Due ${escapeHtml(plant.due)}</span>`
        : `<span class="due-pill due-pill--today">Due ${escapeHtml(plant.due)}</span>`;

    const lightPips = [1, 2, 3]
      .map(
        (lvl) =>
          `<span class="light-pip ${lvl <= meta.lightLevel ? 'light-pip--on' : ''}"></span>`
      )
      .join('');

    const historyItems = plant.history
      .map((entry, idx) => {
        const parsed = parseHistoryEntry(entry);
        const isFresh = idx < plant.freshCount;
        const dotClass = getHistoryDotClass(parsed.text);
        return `
          <li class="history-item ${isFresh ? 'history-item--fresh' : ''}">
            <span class="history-dot ${dotClass}" aria-hidden="true"></span>
            <span class="history-date">${escapeHtml(parsed.date)}</span>
            <span class="history-text">${escapeHtml(parsed.text)}</span>
          </li>`;
      })
      .join('');

    const desktopHeader = isDesktopMode
      ? `
        <div class="dossier-card-header">
          <div>
            <p class="dossier-eyebrow">Specimen dossier</p>
            <h2 id="dossier-plant-name" class="dossier-title">${escapeHtml(plant.name)}</h2>
            <p class="dossier-subtitle">${escapeHtml(plant.species)} · ${escapeHtml(plant.location)}</p>
          </div>
          ${statusBadge}
        </div>
        <div class="dossier-stage ${state.celebrateId === plant.id ? 'is-celebrating' : ''}" data-room="${escapeHtml(plant.location)}">
          <div class="dossier-portrait-large">
            ${renderPlantSvg(plant)}
          </div>
          <div class="dossier-stage-copy">
            <span class="task-verb">${iconSvg(getTaskIconKind(plant.task))} Next care: ${escapeHtml(plant.task)}</span>
            <p class="dossier-quirk">${escapeHtml(meta.quirk)}</p>
          </div>
        </div>`
      : '';

    const desktopPrimaryActions = isDesktopMode
      ? `
        <div class="dossier-quick-bar">
          ${
            plant.status === 'active' || plant.status === 'upcoming'
              ? `<button type="button" class="btn btn-care ${isOverdue ? 'btn-care--urgent' : ''}" data-action="care" data-plant-id="${plant.id}" data-origin="dossier" aria-label="Mark ${escapeHtml(plant.name)} as ${escapeHtml(meta.actionLabel.toLowerCase())}">
                  ${iconSvg(getTaskIconKind(plant.task))}
                  <span>${escapeHtml(meta.actionLabel)}</span>
                </button>`
              : `<button type="button" class="btn btn-snooze" data-action="restore" data-plant-id="${plant.id}" data-origin="dossier">
                  ${iconSvg('undo')}
                  <span>Return to queue</span>
                </button>`
          }
          ${
            plant.status === 'active'
              ? `<button type="button" class="btn btn-snooze" data-action="snooze" data-plant-id="${plant.id}" data-origin="dossier" aria-label="Snooze ${escapeHtml(plant.name)} until tomorrow">
                  ${iconSvg('snooze')}
                  <span>Snooze</span>
                </button>`
              : ''
          }
          ${
            !isTaskWater
              ? `<button type="button" class="btn-water-chip" data-action="water-extra" data-plant-id="${plant.id}" data-origin="dossier">
                  + Log watered
                </button>`
              : ''
          }
        </div>`
      : !isTaskWater
      ? `
        <div class="dossier-quick-bar">
          <button type="button" class="btn-water-chip" data-action="water-extra" data-plant-id="${plant.id}" data-origin="inline">
            + Log watered too
          </button>
        </div>`
      : '';

    const noteInputId = `note-input-${mode}-${plant.id}`;

    return `
      ${desktopHeader}

      <div class="spec-grid">
        <div class="spec-tile">
          <p class="spec-label">${iconSvg('sun')} Light</p>
          <p class="spec-value">${escapeHtml(plant.light)}</p>
          <div class="light-meter" aria-label="Light intensity ${meta.lightLevel} of 3">
            ${lightPips}
          </div>
        </div>
        <div class="spec-tile">
          <p class="spec-label">${iconSvg('water')} Watering</p>
          <p class="spec-value">Last: ${escapeHtml(lastWatered)}</p>
          <p class="spec-note">${escapeHtml(meta.waterCadence)}</p>
        </div>
      </div>

      ${desktopPrimaryActions}

      <div class="history-block">
        <h3 class="history-heading">Care &amp; observation history</h3>
        <ul class="history-list">
          ${historyItems}
        </ul>

        <form class="note-form" data-note-form="${plant.id}" data-origin="${mode}">
          <label class="sr-only" for="${noteInputId}">Add an observation for ${escapeHtml(plant.name)}</label>
          <input
            id="${noteInputId}"
            class="note-input"
            type="text"
            name="note"
            maxlength="70"
            autocomplete="off"
            placeholder="Jot an observation for ${escapeHtml(plant.name)}…"
          >
          <button type="submit" class="btn-note-save">Add note</button>
        </form>
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     Rendering Sections
     ------------------------------------------------------------------------ */

  function renderMasthead() {
    const dueTodaySet = state.plants.filter((p) => p.wasDueToday);
    const doneToday = dueTodaySet.filter((p) => p.status === 'done').length;
    const snoozedToday = dueTodaySet.filter((p) => p.status === 'snoozed').length;
    const remaining = dueTodaySet.filter((p) => p.status === 'active');
    const overdue = getOverduePlants();

    // Dynamic whisper line
    if (overdue.length > 0) {
      dom.headerWhisper.textContent = `Start with ${overdue[0].name} — ${overdue[0].due} and ready for a drink.`;
    } else if (remaining.length > 0) {
      dom.headerWhisper.textContent =
        remaining.length === 1
          ? `Just ${remaining[0].name} left on today’s bench.`
          : `${remaining.length} gentle rounds left for today.`;
    } else if (doneToday === dueTodaySet.length) {
      dom.headerWhisper.textContent = 'Every pot on today’s bench is happy and tended.';
    } else {
      dom.headerWhisper.textContent = 'Today’s bench is clear — the rest can wait until morning.';
    }

    // Tactile pebble tracker
    const pipsHtml = dueTodaySet
      .map((p) => {
        const pipClass =
          p.status === 'done'
            ? 'pebble-pip--done'
            : p.status === 'snoozed'
            ? 'pebble-pip--snoozed'
            : p.urgency >= 3
            ? 'pebble-pip--overdue'
            : '';
        return `<span class="pebble-pip ${pipClass}" title="${escapeHtml(p.name)}: ${escapeHtml(p.status)}"></span>`;
      })
      .join('');

    const trackerText =
      remaining.length === 0
        ? `All clear (${doneToday}/${dueTodaySet.length} tended)`
        : `${remaining.length} left · ${doneToday}/${dueTodaySet.length} tended`;

    dom.pebbleTracker.innerHTML = `
      <span class="pebble-pips" aria-hidden="true">${pipsHtml}</span>
      <span>${escapeHtml(trackerText)}</span>
    `;

    dom.headerResetBtn.hidden = !state.hasChanges;

    // Queue meta summary
    if (remaining.length === 0) {
      dom.queueCountLabel.textContent =
        snoozedToday > 0 ? `${doneToday} tended · ${snoozedToday} snoozed` : `${doneToday} of ${dueTodaySet.length} tended`;
    } else {
      const parts = [];
      if (overdue.length > 0) parts.push(`${overdue.length} overdue`);
      const regularDue = remaining.length - overdue.length;
      if (regularDue > 0) parts.push(`${regularDue} due today`);
      dom.queueCountLabel.textContent = parts.join(' · ');
    }
  }

  function renderPlantVessel(plant, variant) {
    const meta = getPlantMeta(plant);
    const isOverdue = variant === 'overdue';
    const isSelected = state.selectedId === plant.id;
    const isExpanded = !isDesktop() && state.expandedId === plant.id;
    const isCelebrating = state.celebrateId === plant.id;
    const inlineDetailId = `inline-detail-${plant.id}`;

    const duePillClass = isOverdue ? 'due-pill--overdue' : 'due-pill--today';
    const careAria = `Mark ${plant.name} as ${meta.actionLabel.toLowerCase()}`;

    return `
      <article
        class="plant-vessel ${isOverdue ? 'plant-vessel--overdue' : 'plant-vessel--today'} ${isSelected ? 'is-selected' : ''} ${isCelebrating ? 'is-celebrating' : ''}"
        data-plant="${escapeHtml(plant.id)}"
        aria-label="${escapeHtml(plant.name)}, ${escapeHtml(plant.species)}"
      >
        ${isOverdue ? '<div class="vessel-rim" aria-hidden="true"></div>' : ''}
        <div class="plant-vessel-inner">
          <div class="plant-head">
            <div class="plant-portrait-frame" data-room="${escapeHtml(plant.location)}">
              ${renderPlantSvg(plant)}
            </div>
            <div class="plant-summary">
              <div class="plant-badges">
                <span class="due-pill ${duePillClass}">${escapeHtml(plant.due)}</span>
                <span class="room-chip">${escapeHtml(plant.location)}</span>
                <span class="selected-indicator" aria-hidden="true">Viewing</span>
              </div>
              <button
                type="button"
                class="plant-title-trigger"
                data-action="select"
                data-plant-id="${plant.id}"
                ${isDesktop() ? `aria-current="${isSelected ? 'true' : 'false'}"` : `aria-expanded="${isExpanded ? 'true' : 'false'}" aria-controls="${inlineDetailId}"`}
                aria-label="Inspect ${escapeHtml(plant.name)} (${escapeHtml(plant.species)}) details and history"
              >
                <h3 class="plant-name">${escapeHtml(plant.name)}</h3>
                <p class="plant-species">${escapeHtml(plant.species)}</p>
              </button>
              <div class="plant-task-callout">
                <span class="task-verb">${iconSvg(getTaskIconKind(plant.task))} ${escapeHtml(plant.task)}</span>
                <span class="task-divider" aria-hidden="true">·</span>
                <span class="task-light-hint">${escapeHtml(plant.light)}</span>
              </div>
              ${isOverdue ? `<p class="plant-quirk-line">${escapeHtml(meta.quirk)}</p>` : ''}
            </div>
          </div>

          <div class="plant-actions">
            <button
              type="button"
              class="btn btn-care ${isOverdue ? 'btn-care--urgent' : ''}"
              data-action="care"
              data-plant-id="${plant.id}"
              data-origin="queue"
              aria-label="${escapeHtml(careAria)}"
            >
              ${iconSvg(getTaskIconKind(plant.task))}
              <span>${escapeHtml(meta.actionLabel)}</span>
            </button>
            <button
              type="button"
              class="btn btn-snooze"
              data-action="snooze"
              data-plant-id="${plant.id}"
              data-origin="queue"
              aria-label="Snooze ${escapeHtml(plant.name)} until tomorrow"
            >
              ${iconSvg('snooze')}
              <span>Snooze</span>
            </button>
            <button
              type="button"
              class="btn btn-details btn-details--mobile"
              data-action="toggle-mobile"
              data-plant-id="${plant.id}"
              aria-expanded="${isExpanded ? 'true' : 'false'}"
              aria-controls="${inlineDetailId}"
            >
              <span>${isExpanded ? 'Hide' : 'Details'}</span>
              ${iconSvg('chevron')}
            </button>
          </div>

          <div
            id="${inlineDetailId}"
            class="mobile-inline-dossier"
            ${isExpanded ? '' : 'hidden'}
          >
            ${isExpanded ? renderSpecimenDetailsMarkup(plant, 'mobile') : ''}
          </div>
        </div>
      </article>
    `;
  }

  function renderQueue() {
    const overdue = getOverduePlants();
    const today = getDueTodayPlants();
    const hasActive = overdue.length + today.length > 0;

    if (overdue.length > 0) {
      dom.overdueZone.innerHTML = `
        <p class="zone-sublabel zone-sublabel--urgent">
          <span class="zone-dot" aria-hidden="true"></span>
          Needs you first
        </p>
        ${overdue.map((p) => renderPlantVessel(p, 'overdue')).join('')}
      `;
    } else {
      dom.overdueZone.innerHTML = '';
    }

    if (today.length > 0) {
      dom.todayZone.classList.toggle('has-pair', today.length >= 2);
      dom.todayZone.innerHTML = `
        <p class="zone-sublabel">
          <span class="zone-dot" aria-hidden="true"></span>
          Today’s gentle rounds
        </p>
        ${today.map((p) => renderPlantVessel(p, 'today')).join('')}
      `;
    } else {
      dom.todayZone.classList.remove('has-pair');
      dom.todayZone.innerHTML = '';
    }

    if (!hasActive) {
      renderAllDone();
      dom.allDoneZone.hidden = false;
    } else {
      dom.allDoneZone.hidden = true;
      dom.allDoneZone.innerHTML = '';
    }
  }

  function renderAllDone() {
    const donePlants = getDonePlants();
    const snoozedPlants = state.plants.filter((p) => p.status === 'snoozed');
    const tomorrowPlant = state.plants.find((p) => p.status === 'upcoming') || snoozedPlants[0] || null;
    const allTended = snoozedPlants.length === 0;

    const headline = allTended
      ? 'All tended for today'
      : 'Today’s bench is clear';

    const description =
      allTended && !tomorrowPlant
        ? 'All four plants — including tomorrow’s misting for Drama — are tended. Put the watering can down and enjoy the quiet green.'
        : allTended
        ? 'Frida, Orbit, and Dot are all set. Put the watering can down and enjoy the quiet green.'
        : `You tended ${donePlants.length} plant${donePlants.length === 1 ? '' : 's'} and tucked ${snoozedPlants.length} away until tomorrow morning.`;

    dom.allDoneZone.innerHTML = `
      <div class="all-done-card" tabindex="-1" id="all-done-card">
        <div class="all-done-top">
          ${renderAllDoneSvg()}
          <div>
            <h3 class="all-done-title">${escapeHtml(headline)}</h3>
            <p class="all-done-body">${escapeHtml(description)}</p>
          </div>
        </div>

        <div class="all-done-stats">
          <span class="done-stat-chip">${iconSvg('check')} ${donePlants.length} tended today</span>
          ${
            snoozedPlants.length > 0
              ? `<span class="done-stat-chip">${iconSvg('snooze')} ${snoozedPlants.length} snoozed</span>`
              : ''
          }
          ${
            tomorrowPlant
              ? `<span class="done-stat-chip">Next up: ${escapeHtml(tomorrowPlant.task)} ${escapeHtml(tomorrowPlant.name)} (${escapeHtml(tomorrowPlant.location)})</span>`
              : '<span class="done-stat-chip">Even tomorrow’s care is done!</span>'
          }
        </div>

        <div class="all-done-actions">
          ${
            tomorrowPlant
              ? `<button type="button" class="btn btn-care" data-action="peek-tomorrow" data-plant-id="${tomorrowPlant.id}">
                  <span>Peek at ${escapeHtml(tomorrowPlant.name)}</span>
                </button>`
              : ''
          }
          <button type="button" class="btn btn-snooze" data-action="reset-day">
            ${iconSvg('undo')}
            <span>Replay today’s queue</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderRestingSlip(plant) {
    const meta = getPlantMeta(plant);
    const isDone = plant.status === 'done';
    const isSnoozed = plant.status === 'snoozed';
    const isSelected = state.selectedId === plant.id;
    const isExpanded = !isDesktop() && state.expandedId === plant.id;
    const inlineDetailId = `inline-detail-${plant.id}`;

    const subtitle = isDone
      ? `${meta.pastVerb} today · ${plant.location}`
      : isSnoozed
      ? `Snoozed to tomorrow · ${plant.task} · ${plant.location}`
      : `Tomorrow · ${plant.task} · ${plant.location}`;

    const actionButton = isDone
      ? `<button type="button" class="btn-slip" data-action="restore" data-plant-id="${plant.id}" aria-label="Return ${escapeHtml(plant.name)} to today’s queue">Restore</button>`
      : isSnoozed
      ? `<button type="button" class="btn-slip" data-action="restore" data-plant-id="${plant.id}" aria-label="Bring ${escapeHtml(plant.name)} back to today">Unsnooze</button>`
      : `<button type="button" class="btn-slip btn-slip--care" data-action="care" data-plant-id="${plant.id}" data-origin="resting" aria-label="Mark ${escapeHtml(plant.name)} as ${escapeHtml(meta.actionLabel.toLowerCase())} early">${escapeHtml(meta.actionLabel)} early</button>`;

    return `
      <article
        class="resting-slip ${isDone ? 'resting-slip--done' : ''} ${isSelected ? 'is-selected' : ''}"
        data-plant="${escapeHtml(plant.id)}"
      >
        <div class="resting-slip-row">
          <div class="resting-mini-portrait">
            ${renderPlantSvg(plant)}
          </div>
          <div class="resting-copy">
            <button
              type="button"
              class="resting-name-btn"
              data-action="select"
              data-plant-id="${plant.id}"
              ${isDesktop() ? `aria-current="${isSelected ? 'true' : 'false'}"` : `aria-expanded="${isExpanded ? 'true' : 'false'}" aria-controls="${inlineDetailId}"`}
            >
              ${escapeHtml(plant.name)}
            </button>
            <p class="resting-meta">${escapeHtml(subtitle)}</p>
          </div>
          <div class="resting-actions">
            ${actionButton}
            <button
              type="button"
              class="btn-slip btn-details--mobile"
              data-action="toggle-mobile"
              data-plant-id="${plant.id}"
              aria-expanded="${isExpanded ? 'true' : 'false'}"
              aria-controls="${inlineDetailId}"
            >
              ${isExpanded ? 'Hide' : 'Details'}
            </button>
          </div>
        </div>
        <div
          id="${inlineDetailId}"
          class="mobile-inline-dossier"
          ${isExpanded ? '' : 'hidden'}
        >
          ${isExpanded ? renderSpecimenDetailsMarkup(plant, 'mobile') : ''}
        </div>
      </article>
    `;
  }

  function renderRestingZone() {
    const upcomingAndSnoozed = getUpcomingAndSnoozedPlants();
    const donePlants = getDonePlants();
    const groups = [];

    if (upcomingAndSnoozed.length > 0) {
      groups.push(`
        <div class="resting-group">
          <h2 id="resting-heading" class="resting-heading">Coming up &amp; snoozed</h2>
          <div class="resting-list">
            ${upcomingAndSnoozed.map(renderRestingSlip).join('')}
          </div>
        </div>
      `);
    }

    if (donePlants.length > 0) {
      groups.push(`
        <div class="resting-group">
          <h2 ${upcomingAndSnoozed.length === 0 ? 'id="resting-heading"' : ''} class="resting-heading">Tended today</h2>
          <div class="resting-list">
            ${donePlants.map(renderRestingSlip).join('')}
          </div>
        </div>
      `);
    }

    dom.restingZone.innerHTML = groups.join('');
    dom.restingZone.hidden = groups.length === 0;
  }

  function renderDesktopDossier() {
    if (!isDesktop()) {
      dom.desktopDossier.hidden = true;
      dom.desktopDossier.innerHTML = '';
      return;
    }

    dom.desktopDossier.hidden = false;
    const plant = getPlantById(state.selectedId) || state.plants[0];
    if (!plant) return;
    dom.desktopDossier.innerHTML = renderSpecimenDetailsMarkup(plant, 'desktop');
  }

  function renderWeeklyRhythm() {
    const total = state.week.reduce((sum, n) => sum + n, 0);
    const maxVal = Math.max(...state.week, 1);
    const addedToday = Math.max(0, state.week[6] - state.baseWeekToday);

    const rhythmMood =
      total >= 19
        ? 'Lush streak'
        : total >= 17
        ? 'Thriving cadence'
        : 'Steady drizzle';

    const columnsHtml = state.week
      .map((count, idx) => {
        const day = DAY_NAMES[idx] || { short: `D${idx + 1}`, full: `Day ${idx + 1}` };
        const isToday = idx === 6;
        const isPeak = !isToday && count === maxVal;
        const isSelected = state.selectedDayIndex === idx;

        const pebbles = Array.from({ length: Math.min(count, 7) }, (_, pIdx) => {
          const isAdded = isToday && pIdx >= state.baseWeekToday;
          return `<span class="rhythm-pebble ${isAdded ? 'rhythm-pebble--added' : ''}"></span>`;
        }).join('');

        const sproutSvg =
          isToday || count >= 4
            ? `<svg class="rhythm-sprout" viewBox="0 0 18 12" width="16" height="11" fill="none" aria-hidden="true">
                 <path d="M9 11C9 6.5 11.4 3.2 16 2.2C15.5 6.8 13.1 9.8 9 11Z" fill="#538461" stroke="#1D2A22" stroke-width="1.3"/>
                 <path d="M9 11C8.3 7.2 5.6 4.6 2 4.1C3 7.8 5.4 10 9 11Z" fill="#2B5C43" stroke="#1D2A22" stroke-width="1.3"/>
               </svg>`
            : '';

        return `
          <button
            type="button"
            class="rhythm-day-btn ${isToday ? 'rhythm-day-btn--today' : ''} ${isPeak ? 'rhythm-day-btn--peak' : ''}"
            data-action="select-day"
            data-day-index="${idx}"
            aria-pressed="${isSelected ? 'true' : 'false'}"
            aria-label="${escapeHtml(day.full)}: ${count} care ${count === 1 ? 'moment' : 'moments'}"
          >
            <span class="rhythm-stack" aria-hidden="true">
              ${pebbles}
              ${sproutSvg}
            </span>
            <span class="rhythm-day-label">${escapeHtml(day.short)}</span>
          </button>
        `;
      })
      .join('');

    const activeDay = DAY_NAMES[state.selectedDayIndex] || DAY_NAMES[6];
    const activeCount = state.week[state.selectedDayIndex] ?? 0;
    const extraNote =
      state.selectedDayIndex === 6 && addedToday > 0
        ? ` (+${addedToday} just now)`
        : state.selectedDayIndex !== 6 && activeCount === maxVal
        ? ' · Peak day'
        : '';

    dom.rhythmPanel.innerHTML = `
      <div class="rhythm-header">
        <h2 id="rhythm-heading" class="rhythm-title">Weekly rhythm</h2>
        <span class="rhythm-total">${total} moments</span>
      </div>
      <div class="rhythm-chart" role="group" aria-label="Daily plant care count across the past seven days">
        ${columnsHtml}
      </div>
      <div class="rhythm-caption">
        <span><strong>${escapeHtml(activeDay.full)}:</strong> ${activeCount} care ${activeCount === 1 ? 'action' : 'actions'}${escapeHtml(extraNote)}</span>
        <span class="rhythm-mood">${escapeHtml(rhythmMood)}</span>
      </div>
    `;
  }

  function renderAll(focusHint = null) {
    renderMasthead();
    renderQueue();
    renderRestingZone();
    renderDesktopDossier();
    renderWeeklyRhythm();

    if (focusHint) {
      applyFocusHint(focusHint);
    }
  }

  function applyFocusHint(hint) {
    if (!hint) return;
    let target = null;

    if (hint.type === 'selector') {
      target = document.querySelector(hint.selector);
    } else if (hint.type === 'next-queue-or-done') {
      const nextActive = getActivePlants()[0];
      if (nextActive) {
        target = document.querySelector(`.plant-vessel[data-plant="${nextActive.id}"] [data-action="care"]`);
      } else {
        target = document.querySelector('#all-done-card [data-action="peek-tomorrow"]') ||
          document.querySelector('#all-done-card [data-action="reset-day"]') ||
          document.getElementById('all-done-card');
      }
    } else if (hint.type === 'dossier') {
      target = dom.desktopDossier;
    }

    if (target && typeof target.focus === 'function') {
      target.focus({ preventScroll: false });
    }
  }

  /* ------------------------------------------------------------------------
     Toast & Undo Engine
     ------------------------------------------------------------------------ */

  function clearToastTimer() {
    if (toastCtrl.timerId !== null) {
      window.clearTimeout(toastCtrl.timerId);
      toastCtrl.timerId = null;
    }
  }

  function dismissToast() {
    clearToastTimer();
    toastCtrl.visible = false;
    dom.toastRegion.innerHTML = '';
  }

  function startToastCountdown(ms) {
    clearToastTimer();
    toastCtrl.remainingMs = ms;
    toastCtrl.startedAt = Date.now();
    toastCtrl.timerId = window.setTimeout(() => {
      dismissToast();
    }, ms);
  }

  function pauseToastCountdown() {
    if (!toastCtrl.visible || toastCtrl.timerId === null) return;
    clearToastTimer();
    const elapsed = Date.now() - toastCtrl.startedAt;
    toastCtrl.remainingMs = Math.max(1200, toastCtrl.remainingMs - elapsed);
  }

  function resumeToastCountdown() {
    if (!toastCtrl.visible || toastCtrl.timerId !== null) return;
    startToastCountdown(toastCtrl.remainingMs);
  }

  function showUndoToast(message) {
    clearToastTimer();
    toastCtrl.visible = true;

    dom.toastRegion.innerHTML = `
      <div class="toast-card" style="--toast-duration: ${TOAST_DURATION_MS}ms">
        <p class="toast-message">${escapeHtml(message)}</p>
        <div class="toast-controls">
          <button type="button" class="toast-undo" data-action="undo">Undo</button>
          <button type="button" class="toast-dismiss" data-action="dismiss-toast" aria-label="Dismiss notification">&times;</button>
        </div>
        <div class="toast-progress" aria-hidden="true">
          <div class="toast-progress-bar"></div>
        </div>
      </div>
    `;

    const card = dom.toastRegion.querySelector('.toast-card');
    if (card) {
      card.addEventListener('mouseenter', pauseToastCountdown);
      card.addEventListener('mouseleave', resumeToastCountdown);
      card.addEventListener('focusin', pauseToastCountdown);
      card.addEventListener('focusout', (ev) => {
        if (!card.contains(ev.relatedTarget)) {
          resumeToastCountdown();
        }
      });
    }

    startToastCountdown(TOAST_DURATION_MS);
  }

  function saveUndoSnapshot(label, plantId = null) {
    state.undoSnapshot = {
      plants: cloneData(state.plants),
      week: [...state.week],
      selectedId: state.selectedId,
      expandedId: state.expandedId,
      hasChanges: state.hasChanges,
      plantId,
      label
    };
  }

  function triggerCelebration(plantId) {
    state.celebrateId = plantId;
    window.setTimeout(() => {
      if (state.celebrateId === plantId) {
        state.celebrateId = null;
        document.querySelectorAll('.is-celebrating').forEach((el) => {
          el.classList.remove('is-celebrating');
        });
      }
    }, 650);
  }

  /* ------------------------------------------------------------------------
     User Actions
     ------------------------------------------------------------------------ */

  function handleCare(plantId, origin) {
    const plant = getPlantById(plantId);
    if (!plant) return;
    const meta = getPlantMeta(plant);

    saveUndoSnapshot(`${plant.name} ${meta.actionLabel.toLowerCase()}`, plant.id);

    plant.status = 'done';
    plant.due = 'Tended today';
    plant.urgency = 0;
    plant.history.unshift(`Today · ${meta.pastVerb}`);
    plant.freshCount += 1;
    if (plant.id === 'pothos') {
      plant.rotated = true;
    }

    state.week[6] = (state.week[6] || 0) + 1;
    state.selectedDayIndex = 6;
    state.hasChanges = true;
    if (isDesktop()) {
      state.selectedId = plant.id;
    }

    triggerCelebration(plant.id);

    const toastText = `${plant.name} ${meta.actionLabel.toLowerCase()} · +1 today`;
    const focusHint =
      origin === 'queue'
        ? { type: 'next-queue-or-done' }
        : origin === 'dossier'
        ? { type: 'selector', selector: '#desktop-dossier [data-action="restore"]' }
        : null;

    renderAll(focusHint);
    showUndoToast(toastText);
    announce(`${plant.name} marked ${meta.actionLabel.toLowerCase()}. Press Undo or Control Z to revert.`);
  }

  function handleSnooze(plantId, origin) {
    const plant = getPlantById(plantId);
    if (!plant) return;

    saveUndoSnapshot(`snoozing ${plant.name}`, plant.id);

    plant.status = 'snoozed';
    plant.due = 'Snoozed · Tomorrow';
    plant.urgency = 0;
    state.hasChanges = true;
    if (isDesktop()) {
      state.selectedId = plant.id;
    }

    const focusHint =
      origin === 'queue'
        ? { type: 'next-queue-or-done' }
        : origin === 'dossier'
        ? { type: 'selector', selector: '#desktop-dossier [data-action="restore"]' }
        : null;

    renderAll(focusHint);
    showUndoToast(`Snoozed ${plant.name} until tomorrow`);
    announce(`Snoozed ${plant.name} until tomorrow. Press Undo or Control Z to revert.`);
  }

  function handleExtraWater(plantId, origin) {
    const plant = getPlantById(plantId);
    if (!plant) return;

    saveUndoSnapshot(`watering ${plant.name}`, plant.id);

    plant.history.unshift('Today · Watered');
    plant.freshCount += 1;
    state.week[6] = (state.week[6] || 0) + 1;
    state.selectedDayIndex = 6;
    state.hasChanges = true;
    triggerCelebration(plant.id);

    const focusHint =
      origin === 'dossier'
        ? { type: 'selector', selector: '#desktop-dossier [data-action="water-extra"]' }
        : { type: 'selector', selector: `[data-plant="${plant.id}"] [data-action="water-extra"]` };

    renderAll(focusHint);
    showUndoToast(`Logged watering for ${plant.name}`);
    announce(`Logged watering for ${plant.name}.`);
  }

  function handleRestore(plantId, origin) {
    const plant = getPlantById(plantId);
    if (!plant) return;
    const meta = getPlantMeta(plant);

    saveUndoSnapshot(`returning ${plant.name}`, plant.id);

    const wasDone = plant.status === 'done';
    plant.status = plant.initialStatus;
    plant.due = plant.initialDue;
    plant.urgency = plant.initialUrgency;
    if (wasDone) {
      const autoEntry = `Today · ${meta.pastVerb}`;
      const autoIdx = plant.history.indexOf(autoEntry);
      if (autoIdx !== -1) {
        plant.history.splice(autoIdx, 1);
        plant.freshCount = Math.max(0, plant.freshCount - 1);
        state.week[6] = Math.max(state.baseWeekToday, (state.week[6] || 0) - 1);
      }
    }
    if (plant.id === 'pothos') {
      plant.rotated = false;
    }

    state.selectedId = plant.id;
    state.hasChanges = true;

    const focusHint =
      origin === 'dossier'
        ? { type: 'selector', selector: '#desktop-dossier [data-action="care"]' }
        : { type: 'selector', selector: `[data-plant="${plant.id}"] [data-action="care"]` };

    renderAll(focusHint);
    showUndoToast(`Returned ${plant.name} to the queue`);
    announce(`Returned ${plant.name} to the care queue.`);
  }

  function handleAddNote(plantId, rawText, origin) {
    const text = rawText.trim();
    if (!text) return;
    const plant = getPlantById(plantId);
    if (!plant) return;

    saveUndoSnapshot(`note on ${plant.name}`, plant.id);

    plant.history.unshift(`Today · ${text}`);
    plant.freshCount += 1;
    state.hasChanges = true;

    const inputSelector = `#note-input-${origin}-${plant.id}`;
    renderAll({ type: 'selector', selector: inputSelector });
    showUndoToast(`Saved note for ${plant.name}`);
    announce(`Added observation "${text}" for ${plant.name}.`);
  }

  function handleUndo() {
    if (!state.undoSnapshot) return;
    const snap = state.undoSnapshot;

    state.plants = cloneData(snap.plants);
    state.week = [...snap.week];
    state.selectedId = snap.selectedId;
    state.expandedId = snap.expandedId;
    state.hasChanges = snap.hasChanges;
    state.undoSnapshot = null;

    dismissToast();
    const focusHint = snap.plantId
      ? {
          type: 'selector',
          selector: `[data-plant="${snap.plantId}"] [data-action="care"], [data-plant="${snap.plantId}"] [data-action="select"]`
        }
      : { type: 'next-queue-or-done' };
    renderAll(focusHint);
    announce(`Undid ${snap.label}.`);
  }

  function handleResetDay() {
    if (!state.initialSource) return;
    saveUndoSnapshot('resetting today');
    const prevSnapshot = state.undoSnapshot;
    hydrateState(state.initialSource);
    state.undoSnapshot = prevSnapshot;

    renderAll({ type: 'next-queue-or-done' });
    showUndoToast('Today’s queue restored to start');
    announce('Reset today’s care queue back to the beginning.');
  }

  function handleSelectPlant(plantId) {
    const plant = getPlantById(plantId);
    if (!plant) return;

    if (isDesktop()) {
      state.selectedId = plant.id;
      renderAll({ type: 'selector', selector: `[data-plant="${plant.id}"] [data-action="select"]` });
      announce(`Showing specimen details for ${plant.name}.`);
    } else {
      state.selectedId = plant.id;
      state.expandedId = state.expandedId === plant.id ? null : plant.id;
      renderAll({ type: 'selector', selector: `[data-plant="${plant.id}"] [data-action="select"]` });
    }
  }

  function handleToggleMobileDetail(plantId) {
    state.selectedId = plantId;
    state.expandedId = state.expandedId === plantId ? null : plantId;
    renderAll({ type: 'selector', selector: `[data-plant="${plantId}"] [data-action="toggle-mobile"]` });
  }

  function handlePeekTomorrow(plantId) {
    state.selectedId = plantId;
    if (!isDesktop()) {
      state.expandedId = plantId;
      renderAll({ type: 'selector', selector: `[data-plant="${plantId}"] [data-action="select"]` });
      const el = document.querySelector(`[data-plant="${plantId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      renderAll({ type: 'dossier' });
    }
    const plant = getPlantById(plantId);
    if (plant) {
      announce(`Inspecting tomorrow’s plant, ${plant.name}.`);
    }
  }

  /* ------------------------------------------------------------------------
     Event Delegation & Keyboard Shortcuts
     ------------------------------------------------------------------------ */

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.dataset.action;
    const plantId = trigger.dataset.plantId;
    const origin = trigger.dataset.origin || 'queue';

    switch (action) {
      case 'care':
        handleCare(plantId, origin);
        break;
      case 'snooze':
        handleSnooze(plantId, origin);
        break;
      case 'water-extra':
        handleExtraWater(plantId, origin);
        break;
      case 'restore':
        handleRestore(plantId, origin);
        break;
      case 'select':
        handleSelectPlant(plantId);
        break;
      case 'toggle-mobile':
        handleToggleMobileDetail(plantId);
        break;
      case 'peek-tomorrow':
        handlePeekTomorrow(plantId);
        break;
      case 'reset-day':
        handleResetDay();
        break;
      case 'undo':
        handleUndo();
        break;
      case 'dismiss-toast':
        dismissToast();
        break;
      case 'select-day': {
        const idx = Number(trigger.dataset.dayIndex);
        if (!Number.isNaN(idx)) {
          state.selectedDayIndex = idx;
          renderWeeklyRhythm();
          applyFocusHint({ type: 'selector', selector: `[data-day-index="${idx}"]` });
        }
        break;
      }
      default:
        break;
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-note-form]');
    if (!form) return;
    event.preventDefault();

    const plantId = form.dataset.noteForm;
    const origin = form.dataset.origin || 'desktop';
    const input = form.querySelector('input[name="note"]');
    if (!input) return;

    handleAddNote(plantId, input.value, origin);
  });

  if (dom.headerResetBtn) {
    dom.headerResetBtn.addEventListener('click', handleResetDay);
  }

  document.addEventListener('keydown', (event) => {
    const targetTag = event.target?.tagName?.toLowerCase();
    const isTyping = targetTag === 'input' || targetTag === 'textarea' || event.target?.isContentEditable;

    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z' && !isTyping) {
      if (state.undoSnapshot) {
        event.preventDefault();
        handleUndo();
      }
      return;
    }

    if (event.key === 'Escape') {
      if (toastCtrl.visible) {
        dismissToast();
      } else if (!isDesktop() && state.expandedId) {
        const prevId = state.expandedId;
        state.expandedId = null;
        renderAll({ type: 'selector', selector: `[data-plant="${prevId}"] [data-action="toggle-mobile"]` });
      }
    }
  });

  // Cleanly re-sync mobile inline panel vs desktop sticky dossier across viewport resizes
  desktopQuery.addEventListener('change', () => {
    renderAll();
  });

  /* ------------------------------------------------------------------------
     Bootstrap (local PLANTS.json with file:// safe fallback)
     ------------------------------------------------------------------------ */

  async function init() {
    let data = FALLBACK_DATA;
    try {
      const response = await fetch('./PLANTS.json');
      if (response.ok) {
        const parsed = await response.json();
        if (parsed && Array.isArray(parsed.plants) && Array.isArray(parsed.week)) {
          data = parsed;
        }
      }
    } catch (_err) {
      // Opening index.html directly via file:// blocks fetch; fallback keeps full offline fidelity.
    }

    hydrateState(data);
    renderAll();
  }

  init();
})();
