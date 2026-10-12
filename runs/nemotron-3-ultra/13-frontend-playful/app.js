const PLANT_SVGS = {
  fern: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="fernGrad" x1="0" y1="0" x2="64" y2="64"><stop offset="0%" stop-color="#6B8E5E"/><stop offset="100%" stop-color="#4A6D3D"/></linearGradient></defs>
    <g stroke="url(#fernGrad)" stroke-width="1.5" stroke-linecap="round" fill="none">
      <path d="M32 58 C32 58 30 45 32 38 C34 31 36 42 32 38 C28 34 24 25 32 20 C40 15 48 22 32 20 C24 18 18 12 32 8 C46 4 52 16 32 8"/>
      <path d="M32 38 C32 38 24 35 22 28 C20 21 26 16 22 10" opacity="0.7"/>
      <path d="M32 38 C32 38 40 35 42 28 C44 21 38 16 42 10" opacity="0.7"/>
      <path d="M32 20 C32 20 26 18 24 13 C22 8 28 5 24 2" opacity="0.5"/>
      <path d="M32 20 C32 20 38 18 40 13 C42 8 36 5 40 2" opacity="0.5"/>
    </g>
    <circle cx="32" cy="56" r="3" fill="#8AB476"/>
  </svg>`,
  pothos: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="pothosGrad" x1="0" y1="0" x2="64" y2="64"><stop offset="0%" stop-color="#7BA36A"/><stop offset="100%" stop-color="#5A7D4A"/></linearGradient></defs>
    <g fill="url(#pothosGrad)">
      <path d="M32 8 C25 8 20 14 20 21 c0 4 3 8 7 10 2-1 5-3 7-5 C41 26 46 18 38 18 c-4 0-8 3-10 7 2 2 5 3 7 5 4-2 7-6 7-10 C54 14 49 8 42 8 C38 8 35 9 32 8 Z"/>
      <path d="M32 20 C28 20 25 23 25 27 c0 2 1 4 3 5 2-1 4-3 4-5 C32 23 30 20 32 20 Z" opacity="0.5"/>
      <path d="M32 32 C27 32 24 35 24 39 c0 2 2 4 5 5 3-1 5-3 5-5 C37 35 35 32 32 32 Z"/>
      <path d="M32 32 C29 32 27 34 27 37 c0 1.5 1 3 3 4 2-1 4-2.5 4-4 C34 34 33 32 32 32 Z" opacity="0.6"/>
      <path d="M32 44 C28 44 25 47 25 51 c0 2 2 4 5 5 3-1 5-3 5-5 C37 47 35 44 32 44 Z"/>
    </g>
    <circle cx="32" cy="58" r="2.5" fill="#8AB476"/>
  </svg>`,
  cactus: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="cactusGrad" x1="0" y1="0" x2="64" y2="64"><stop offset="0%" stop-color="#5D9B5D"/><stop offset="100%" stop-color="#3D7A3D"/></linearGradient></defs>
    <g fill="url(#cactusGrad)">
      <path d="M32 8 C22 8 14 16 14 26 c0 5 3 9 8 11 3-1 6-3 8-5 2-2 5-5 5-9 C35 27 37 16 32 8 Z"/>
      <path d="M24 26 C20 26 18 30 18 34 c0 3 2 6 6 7 2 0 4-2 5-5 C27 30 26 26 24 26 Z" opacity="0.6"/>
      <path d="M40 26 C44 26 46 30 46 34 c0 3-2 6-6 7 -2 0-4-2-5-5 C37 30 38 26 40 26 Z" opacity="0.6"/>
      <circle cx="20" cy="30" r="1.5" fill="#C49A4A"/>
      <circle cx="44" cy="30" r="1.5" fill="#C49A4A"/>
      <circle cx="28" cy="38" r="1.5" fill="#C49A4A"/>
      <circle cx="36" cy="38" r="1.5" fill="#C49A4A"/>
      <circle cx="32" cy="22" r="1.5" fill="#C49A4A"/>
    </g>
    <ellipse cx="32" cy="56" rx="12" ry="4" fill="#8AB476" opacity="0.4"/>
    <circle cx="32" cy="56" r="2.5" fill="#8AB476"/>
  </svg>`,
  calathea: `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="calatheaGrad" x1="0" y1="0" x2="64" y2="64"><stop offset="0%" stop-color="#6D8B6D"/><stop offset="100%" stop-color="#4A6D4A"/></linearGradient></defs>
    <g fill="url(#calatheaGrad)">
      <path d="M32 6 C20 6 11 15 11 27 c0 7 5 13 12 16 3-1 6-4 7-8 C27 32 26 28 25 23 c-1 5 3 9 8 11 4-1 7-4 8-8 C49 27 41 17 34 17 C30 17 27 18 24 20 C28 17 33 12 32 6 Z" opacity="0.9"/>
      <path d="M32 16 C26 16 22 20 22 26 c0 3 2 5 5 6 3-1 5-3 6-6 C35 20 33 16 32 16 Z" opacity="0.5"/>
      <path d="M32 28 C27 28 24 31 24 36 c0 2.5 2 5 5 6 3-1 5-3.5 6-6 C35 31 33 28 32 28 Z"/>
      <path d="M32 40 C28 40 25 43 25 47 c0 2 2 4 5 5 3-1 5-3 5-5 C35 43 33 40 32 40 Z" opacity="0.7"/>
    </g>
    <circle cx="32" cy="56" r="3" fill="#8AB476"/>
  </svg>`
};

const URGENCY_CLASS = {
  3: 'plant-card--overdue',
  2: 'plant-card--due',
  1: 'plant-card--due',
  0: 'plant-card--upcoming'
};

const URGENCY_LABEL = {
  3: 'Overdue',
  2: 'Due today',
  1: 'Due today',
  0: 'Upcoming'
};

const TASK_ICONS = {
  'Water': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2 C6.5 2 2 6.5 2 12 s4.5 10 10 10 10-4.5 10-10 S17.5 2 12 2 Z M12 6 v8 l5 3"/></svg>`,
  'Mist': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 14 h16 M4 18 h16 M8 10 h8 M10 6 h4"/></svg>`,
  'Rotate': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 4 v6 h-6 M1 20 v-6 h6"/><path d="M3.5 3.5 L20.5 20.5"/></svg>`,
  'Check soil': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9 h6 M9 12 h6 M9 15 h4"/></svg>`
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let plantsData = [];
let weekData = [];
let currentPlantId = null;
let lastAction = null;
let toastTimeout = null;

async function loadPlants() {
  try {
    const response = await fetch('PLANTS.json');
    const data = await response.json();
    plantsData = data.plants;
    weekData = data.week;
    renderPlantList();
    renderWeeklyRhythm();
  } catch (e) {
    console.error('Failed to load plants:', e);
  }
}

function renderPlantList() {
  const list = document.getElementById('plantList');
  const allDone = document.getElementById('allDone');

  const sorted = [...plantsData].sort((a, b) => b.urgency - a.urgency);

  const hasUrgent = sorted.some(p => p.urgency > 0);

  if (!hasUrgent) {
    list.innerHTML = '';
    allDone.hidden = false;
    return;
  }

  allDone.hidden = true;
  list.innerHTML = sorted.map(plant => `
    <li class="plant-card ${URGENCY_CLASS[plant.urgency]}" data-plant-id="${plant.id}" tabindex="0" role="button" aria-pressed="false" aria-label="${plant.name}, ${plant.species}, ${URGENCY_LABEL[plant.urgency]}, task: ${plant.task}">
      <div class="plant-card__avatar" aria-hidden="true">
        ${PLANT_SVGS[plant.id]}
      </div>
      <div class="plant-card__info">
        <div class="plant-card__name">${plant.name}</div>
        <div class="plant-card__species">${plant.species}</div>
      </div>
      <div class="plant-card__task">
        <span class="plant-card__task-label">${URGENCY_LABEL[plant.urgency]}</span>
        <span class="plant-card__due">${plant.due}</span>
      </div>
      <svg class="plant-card__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18 L15 12 L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
    </li>
  `).join('');

  list.querySelectorAll('.plant-card').forEach(card => {
    card.addEventListener('click', () => openDetail(card.dataset.plantId));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(card.dataset.plantId);
      }
    });
  });
}

function renderWeeklyRhythm() {
  const barsContainer = document.getElementById('weeklyBars');
  const labelsContainer = document.getElementById('weeklyLabels');
  const maxVal = Math.max(...weekData);

  barsContainer.innerHTML = weekData.map((val, i) => `
    <div class="weekly-rhythm__bar-wrapper" role="button" tabindex="0" aria-pressed="false" aria-label="${DAY_LABELS[i]}: ${val} task${val !== 1 ? 's' : ''}" data-day="${i}" style="--height: ${(val / maxVal) * 100}%">
      <div class="weekly-rhythm__bar" style="height: ${(val / maxVal) * 100}%"></div>
      <span class="weekly-rhythm__label">${DAY_LABELS[i]}</span>
    </div>
  `).join('');

  labelsContainer.innerHTML = '';

  barsContainer.querySelectorAll('.weekly-rhythm__bar-wrapper').forEach(wrapper => {
    wrapper.addEventListener('click', () => filterByDay(parseInt(wrapper.dataset.day)));
    wrapper.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        filterByDay(parseInt(wrapper.dataset.day));
      }
    });
  });
}

function filterByDay(dayIndex) {
  const bars = document.querySelectorAll('.weekly-rhythm__bar-wrapper');
  bars.forEach((bar, i) => {
    const pressed = i === dayIndex;
    bar.setAttribute('aria-pressed', pressed);
    if (pressed) {
      bar.focus();
    }
  });
}

function openDetail(plantId) {
  const plant = plantsData.find(p => p.id === plantId);
  if (!plant) return;

  currentPlantId = plantId;
  const panel = document.getElementById('detailPanel');

  document.getElementById('detailTitle').textContent = plant.name;
  document.getElementById('detailSpecies').textContent = plant.species;
  document.getElementById('detailLocation').textContent = plant.location;
  document.getElementById('detailLight').textContent = plant.light;
  document.getElementById('detailTask').textContent = plant.task;
  document.getElementById('detailDue').textContent = plant.due;

  const illustration = document.getElementById('plantIllustration');
  illustration.innerHTML = PLANT_SVGS[plant.id];

  const historyList = document.getElementById('historyList');
  historyList.innerHTML = plant.history.map((entry, i) => {
    const [date, ...actionParts] = entry.split(' · ');
    const action = actionParts.join(' · ');
    const icon = getHistoryIcon(action);
    return `
      <li class="history__item">
        <div class="history__icon" aria-hidden="true">${icon}</div>
        <div class="history__content">
          <div class="history__text">${action}</div>
          <div class="history__date">${date}</div>
        </div>
      </li>
    `;
  }).join('');

  document.getElementById('wateredBtn').disabled = false;
  document.getElementById('snoozeBtn').disabled = false;

  panel.hidden = false;
  requestAnimationFrame(() => panel.setAttribute('open', ''));
  document.body.style.overflow = 'hidden';

  const closeBtn = document.getElementById('detailClose');
  closeBtn.focus();

  trapFocus(panel);
}

function getHistoryIcon(action) {
  const lower = action.toLowerCase();
  if (lower.includes('water')) return TASK_ICONS['Water'];
  if (lower.includes('mist')) return TASK_ICONS['Mist'];
  if (lower.includes('rotat')) return TASK_ICONS['Rotate'];
  if (lower.includes('soil') || lower.includes('check')) return TASK_ICONS['Check soil'];
  if (lower.includes('frond') || lower.includes('pad') || lower.includes('edge') || lower.includes('new') || lower.includes('note')) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2 L14 8 L20 8 L15 12 L17 18 L12 15 L7 18 L9 12 L4 8 L10 8 Z"/></svg>`;
  }
  if (lower.includes('wipe')) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 L6 18 M14 6 L2 18 M22 10 L10 22"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/></svg>`;
}

function closeDetail() {
  const panel = document.getElementById('detailPanel');
  panel.removeAttribute('open');
  panel.addEventListener('transitionend', () => {
    panel.hidden = true;
  }, { once: true });
  document.body.style.overflow = '';
  currentPlantId = null;
}

function trapFocus(element) {
  const focusable = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  element.addEventListener('keydown', function handleTab(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

function handleAction(action) {
  const plant = plantsData.find(p => p.id === currentPlantId);
  if (!plant) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  let message = '';
  let newHistory = '';
  let newUrgency = plant.urgency;
  let newDue = plant.due;
  let newTask = plant.task;

  if (action === 'watered') {
    message = `${plant.name} watered`;
    newHistory = `${dateStr} · Watered`;
    if (plant.task === 'Water' || plant.task === 'Mist') {
      newUrgency = 0;
      newDue = 'In 3 days';
      newTask = 'Check soil';
    }
  } else if (action === 'snooze') {
    message = `${plant.name} snoozed until tomorrow`;
    newHistory = `${dateStr} · Snoozed`;
    if (plant.urgency >= 2) {
      newUrgency = Math.max(0, plant.urgency - 1);
      newDue = plant.urgency === 3 ? 'Tomorrow' : 'In 2 days';
    } else {
      newDue = 'Tomorrow';
    }
  }

  lastAction = {
    plantId: currentPlantId,
    previousUrgency: plant.urgency,
    previousDue: plant.due,
    previousTask: plant.task,
    previousHistory: [...plant.history]
  };

  plant.urgency = newUrgency;
  plant.due = newDue;
  plant.task = newTask;
  plant.history.unshift(newHistory);

  showToast(message);
  renderPlantList();
  renderWeeklyRhythm();
  openDetail(currentPlantId);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.setAttribute('open', ''));

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => hideToast(), 5000);
}

function hideToast() {
  const toast = document.getElementById('toast');
  toast.removeAttribute('open');
  toast.addEventListener('transitionend', () => {
    toast.hidden = true;
  }, { once: true });
}

function undoAction() {
  if (!lastAction) return;

  const plant = plantsData.find(p => p.id === lastAction.plantId);
  if (!plant) return;

  plant.urgency = lastAction.previousUrgency;
  plant.due = lastAction.previousDue;
  plant.task = lastAction.previousTask;
  plant.history = lastAction.previousHistory;

  lastAction = null;
  hideToast();
  renderPlantList();
  renderWeeklyRhythm();
  if (currentPlantId) openDetail(currentPlantId);
}

function init() {
  loadPlants();

  document.getElementById('detailClose').addEventListener('click', closeDetail);
  document.getElementById('detailBackdrop').addEventListener('click', closeDetail);

  document.getElementById('wateredBtn').addEventListener('click', () => handleAction('watered'));
  document.getElementById('snoozeBtn').addEventListener('click', () => handleAction('snooze'));

  document.getElementById('toastUndo').addEventListener('click', undoAction);

  document.getElementById('viewAllBtn').addEventListener('click', () => {
    const panel = document.getElementById('detailPanel');
    panel.hidden = false;
    requestAnimationFrame(() => panel.setAttribute('open', ''));
    document.body.style.overflow = 'hidden';
    const firstCard = document.querySelector('.plant-card');
    if (firstCard) firstCard.focus();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const panel = document.getElementById('detailPanel');
      if (panel.hasAttribute('open')) {
        closeDetail();
      }
      hideToast();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);