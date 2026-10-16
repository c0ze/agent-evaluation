/* Moss care queue. Records mirror PLANTS.json in this directory. */
'use strict';

const SOURCE = {
  plants: [
    { id: 'fern', name: 'Frida', species: 'Boston fern', location: 'Bathroom', task: 'Water', due: '2 days overdue', urgency: 4, light: 'Low, indirect', history: ['Sep 19 · Misted', 'Sep 16 · Watered', 'Sep 12 · New frond'] },
    { id: 'pothos', name: 'Orbit', species: 'Golden pothos', location: 'Bookshelf', task: 'Rotate', due: 'Today', urgency: 2, light: 'Medium, indirect', history: ['Sep 20 · Watered', 'Sep 14 · Rotated', 'Sep 10 · Wiped leaves'] },
    { id: 'cactus', name: 'Dot', species: 'Bunny ears cactus', location: 'South window', task: 'Check soil', due: 'Today', urgency: 1, light: 'Bright, direct', history: ['Sep 08 · Watered', 'Sep 01 · New pad noted', 'Aug 22 · Rotated'] },
    { id: 'calathea', name: 'Drama', species: 'Calathea orbifolia', location: 'Bedroom', task: 'Mist', due: 'Tomorrow', urgency: 0, light: 'Medium, filtered', history: ['Sep 21 · Misted', 'Sep 18 · Watered', 'Sep 15 · Brown edge noted'] }
  ],
  week: [1, 3, 2, 4, 2, 1, 3]
};

const VERB = {
  Water: 'Watered',
  Rotate: 'Rotated',
  'Check soil': 'Soil checked',
  Mist: 'Misted'
};

const LOG_LINE = {
  Water: 'Logs a drink',
  Rotate: 'Logs a turn',
  'Check soil': 'Logs the soil check',
  Mist: 'Logs a mist'
};

const ASIDES = {
  fern: 'The pot wants a real drink. Brown tips are how this one files a complaint.',
  pothos: 'A quarter-turn toward the books. The leaves already know the window.',
  cactus: 'A finger in the soil is the whole visit. The pads can stay proud.',
  calathea: 'Tomorrow’s plant, unless the edges curl. The bedroom light is already the careful kind.'
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKSHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const state = {
  plants: SOURCE.plants.map((plant, order) => ({
    id: plant.id,
    name: plant.name,
    species: plant.species,
    location: plant.location,
    task: plant.task,
    due: plant.due,
    urgency: plant.urgency,
    light: plant.light,
    history: plant.history.slice(),
    status: 'pending',
    baseDue: plant.due,
    baseUrgency: plant.urgency,
    order
  })),
  week: SOURCE.week.slice(),
  selectedId: null,
  mobileOpen: false,
  undoStack: [],
  toast: null,
  timer: 0,
  toastHold: false,
  focusAfterRender: null,
  focusReturn: null,
  scrollTicket: null
};

let toastShown = '';

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function clonePlant(plant) {
  return { ...plant, history: plant.history.slice() };
}

function desktop() {
  return !!(window.matchMedia && window.matchMedia('(min-width: 960px)').matches);
}

function nowParts() {
  const date = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const longMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const sundayFirst = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
  return {
    stampDate: months[date.getMonth()] + ' ' + date.getDate(),
    dayName: sundayFirst[date.getDay()],
    dateLine: sundayFirst[date.getDay()] + ', ' + longMonths[date.getMonth()] + ' ' + date.getDate(),
    weekIndex
  };
}

function byPriority(a, b) {
  return b.baseUrgency - a.baseUrgency || a.order - b.order;
}

function sortCare(list) {
  return list.slice().sort(byPriority);
}

function pendingPlants() {
  return sortCare(state.plants.filter((plant) => plant.status === 'pending'));
}

function snoozedPlants() {
  return sortCare(state.plants.filter((plant) => plant.status === 'snoozed'));
}

function donePlants() {
  return state.plants.filter((plant) => plant.status === 'done').slice().sort((a, b) => a.order - b.order);
}

function loggedCount() {
  return donePlants().length;
}

function allDone() {
  return loggedCount() === state.plants.length;
}

function findPlant(id) {
  return state.plants.find((plant) => plant.id === id) || null;
}

function nextOpen() {
  return pendingPlants()[0] || snoozedPlants()[0] || null;
}

function verbFor(task) {
  return VERB[task] || 'Done';
}

function isWaterEntry(entry) {
  return /\b(watered|misted|soil checked)\b/i.test(entry);
}

function splitHistory(history) {
  const water = [];
  const notes = [];
  history.forEach((entry) => {
    if (isWaterEntry(entry)) water.push(entry);
    else notes.push(entry);
  });
  return { water, notes };
}

function lightLevel(light) {
  if (/^bright/i.test(light)) return 3;
  if (/^low/i.test(light)) return 1;
  return 2;
}

function lightNote(light) {
  if (/^low/i.test(light)) return 'The bathroom’s shade is the right dose. Keep it out of noon sun.';
  if (/^bright/i.test(light)) return 'It can take the south window, including the hard light.';
  if (/filtered/i.test(light)) return 'A sheer curtain keeps the silver from scorching.';
  return 'Bright enough to read by, with a soft shadow on the leaves.';
}

function tone(plant) {
  if (plant.status === 'snoozed') return 'snoozed';
  if (plant.status === 'done') return 'done';
  if (plant.baseUrgency >= 4) return 'late';
  if (plant.baseDue === 'Tomorrow') return 'soon';
  return 'today';
}

function sillState(plant) {
  if (plant.status === 'done') return 'Done';
  if (plant.status === 'snoozed') return 'Later';
  if (plant.baseUrgency >= 4) return 'Overdue';
  if (plant.baseDue === 'Tomorrow') return 'Tomorrow';
  return 'Today';
}

function wasDue(baseDue) {
  if (baseDue === 'Today' || baseDue === 'Tomorrow') return 'due ' + baseDue.toLowerCase();
  return baseDue.toLowerCase();
}

function statusPhrase(plant) {
  if (plant.status === 'done') return 'Logged today. Was ' + wasDue(plant.baseDue) + '.';
  if (plant.status === 'snoozed') return 'Snoozed for later today. Was ' + wasDue(plant.baseDue) + '.';
  return plant.baseDue;
}

function ledeText(now) {
  const pending = pendingPlants();
  const snoozed = snoozedPlants();
  if (allDone()) return now.dayName + '. All four cares are logged. The sill can be left alone.';
  const late = pending.filter((plant) => plant.baseUrgency >= 4);
  if (late.length === 1) {
    const more = pending.length - 1 + snoozed.length;
    const extra = more === 1 ? '1 more still on the list.' : more + ' more still on the list.';
    return now.dayName + '. ' + late[0].name + ' is ' + late[0].baseDue.toLowerCase() + '. ' + extra;
  }
  if (late.length > 1) {
    return now.dayName + '. ' + late.map((plant) => plant.name).join(' and ') + ' are overdue.';
  }
  if (!pending.length && snoozed.length) {
    const noun = snoozed.length === 1 ? '1 plant is snoozed for later.' : snoozed.length + ' plants are snoozed for later.';
    return now.dayName + '. Nothing is due this sitting. ' + noun;
  }
  const first = pending[0];
  return now.dayName + '. Nothing is overdue. Next up: ' + first.name + ', ' + first.task.toLowerCase() + '.';
}

function countLine() {
  const pending = pendingPlants();
  const snoozed = snoozedPlants();
  const late = pending.filter((plant) => plant.baseUrgency >= 4).length;
  if (!pending.length && !snoozed.length) return 'All logged';
  if (!pending.length) return snoozed.length + ' later today';
  if (late) return pending.length + ' waiting · overdue first';
  return pending.length + ' waiting · nothing overdue';
}

function titleFor() {
  const pending = pendingPlants();
  const late = pending.filter((plant) => plant.baseUrgency >= 4).length;
  if (allDone()) return 'Moss — all done today';
  if (late) return 'Moss — ' + late + ' overdue';
  const open = state.plants.filter((plant) => plant.status !== 'done').length;
  return 'Moss — ' + open + ' left today';
}

function glanceCopy() {
  const drama = findPlant('calathea');
  const edge = drama.history.find((entry) => /brown edge/i.test(entry));
  const caught = state.plants.filter((plant) => plant.baseUrgency >= 4).map((plant) => plant.name);
  const caughtLine = caught.length
    ? caught.join(' and ') + (caught.length > 1 ? ' are caught up.' : ' is caught up.')
    : 'Nobody was overdue.';
  const edgeLine = edge
    ? 'Tomorrow, look in on Drama in the bedroom. The log still has “' + edge + '”, and today’s mist should hold overnight.'
    : 'Tomorrow, look in on Drama in the bedroom.';
  return edgeLine + ' ' + caughtLine;
}

function potMarkup(body, lip, inset) {
  const left = 38 + inset;
  const right = 122 - inset;
  const bottomL = 52 + inset * 0.45;
  const bottomR = 108 - inset * 0.45;
  const rx = 44 - inset;
  return (
    '<ellipse cx="80" cy="178" rx="' + (rx - 4) + '" ry="7" fill="#b89a72"/>' +
    '<path d="M' + left + ' 128 H' + right + ' L' + bottomR + ' 174 H' + bottomL + ' Z" fill="' + body + '"/>' +
    '<ellipse cx="80" cy="128" rx="' + rx + '" ry="11" fill="' + lip + '"/>' +
    '<ellipse cx="80" cy="128" rx="' + (rx - 16) + '" ry="6.5" fill="#4e382c"/>' +
    '<ellipse cx="' + (left + 16) + '" cy="150" rx="7" ry="15" fill="#ffffff" fill-opacity="0.2"/>'
  );
}

const FOLIAGE = {
  fern:
    '<g fill="#2f4a38">' +
      '<ellipse cx="66" cy="108" rx="12" ry="5" transform="rotate(-28 66 108)"/>' +
      '<ellipse cx="54" cy="92" rx="12" ry="4.6" transform="rotate(-42 54 92)"/>' +
      '<ellipse cx="44" cy="76" rx="11" ry="4.2" transform="rotate(-58 44 76)"/>' +
      '<ellipse cx="36" cy="60" rx="9" ry="3.8" transform="rotate(-72 36 60)"/>' +
      '<ellipse cx="74" cy="96" rx="10" ry="4" transform="rotate(8 74 96)"/>' +
      '<ellipse cx="64" cy="82" rx="10" ry="4" transform="rotate(-8 64 82)"/>' +
      '<ellipse cx="56" cy="66" rx="9" ry="3.6" transform="rotate(-18 56 66)"/>' +
      '<ellipse cx="96" cy="106" rx="12" ry="5" transform="rotate(26 96 106)" fill="#3f6b4e"/>' +
      '<ellipse cx="110" cy="90" rx="12" ry="4.6" transform="rotate(42 110 90)" fill="#3f6b4e"/>' +
      '<ellipse cx="122" cy="74" rx="11" ry="4.2" transform="rotate(58 122 74)" fill="#3f6b4e"/>' +
      '<ellipse cx="130" cy="58" rx="8" ry="3.6" transform="rotate(72 130 58)" fill="#3f6b4e"/>' +
      '<ellipse cx="90" cy="94" rx="10" ry="4" transform="rotate(-6 90 94)" fill="#345540"/>' +
      '<ellipse cx="102" cy="78" rx="10" ry="4" transform="rotate(12 102 78)" fill="#345540"/>' +
      '<ellipse cx="112" cy="62" rx="8" ry="3.5" transform="rotate(24 112 62)" fill="#345540"/>' +
      '<ellipse cx="78" cy="78" rx="9" ry="4" transform="rotate(-8 78 78)" fill="#4e7a58"/>' +
      '<ellipse cx="76" cy="60" rx="8" ry="3.6" transform="rotate(-4 76 60)" fill="#4e7a58"/>' +
      '<ellipse cx="74" cy="44" rx="6" ry="3.2" transform="rotate(-12 74 44)" fill="#4e7a58"/>' +
    '</g>' +
    '<path d="M80 126 C64 104 46 80 32 56" fill="none" stroke="#234232" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M80 126 C78 96 74 68 70 40" fill="none" stroke="#234232" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M80 126 C98 102 116 78 132 52" fill="none" stroke="#234232" stroke-width="2.6" stroke-linecap="round"/>',
  pothos:
    '<path d="M78 130 C64 112 46 108 36 92 C52 100 66 112 80 128" fill="none" stroke="#234232" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M80 128 C98 108 120 112 132 90" fill="none" stroke="#234232" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M80 126 C86 104 70 86 84 70" fill="none" stroke="#234232" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M86 78 C108 70 132 86 124 108 C112 96 96 98 86 112 C84 96 80 86 86 78 Z" fill="#2f4a38"/>' +
    '<path d="M28 86 C18 64 36 48 52 58 C62 46 82 54 74 74 C64 92 40 100 28 86 Z" fill="#6e8b46"/>' +
    '<path d="M70 62 C64 42 84 30 98 42 C110 32 128 44 118 62 C108 78 80 80 70 62 Z" fill="#c5b15a"/>' +
    '<path d="M78 128 C92 116 108 100 112 88" fill="none" stroke="#234232" stroke-width="3" stroke-linecap="round"/>',
  cactus:
    '<g fill="#5f8a5a" stroke="#234232" stroke-width="4">' +
      '<ellipse cx="84" cy="90" rx="24" ry="36"/>' +
      '<ellipse cx="50" cy="74" rx="16" ry="26" transform="rotate(-32 50 74)"/>' +
      '<ellipse cx="120" cy="64" rx="15" ry="23" transform="rotate(26 120 64)"/>' +
    '</g>' +
    '<g fill="#234232">' +
      '<circle cx="76" cy="76" r="2.2"/><circle cx="90" cy="96" r="2.2"/><circle cx="80" cy="112" r="2"/>' +
      '<circle cx="44" cy="66" r="1.8"/><circle cx="56" cy="86" r="1.7"/>' +
      '<circle cx="124" cy="56" r="1.8"/><circle cx="112" cy="74" r="1.7"/>' +
    '</g>',
  calathea:
    '<path d="M78 130 C70 112 62 100 56 92" fill="none" stroke="#234232" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M82 130 C92 110 104 98 112 88" fill="none" stroke="#234232" stroke-width="4" stroke-linecap="round"/>' +
    '<ellipse cx="56" cy="82" rx="30" ry="42" transform="rotate(-22 56 82)" fill="#234232"/>' +
    '<ellipse cx="56" cy="82" rx="20" ry="32" transform="rotate(-22 56 82)" fill="none" stroke="#d7e4c4" stroke-width="3.5"/>' +
    '<ellipse cx="56" cy="82" rx="10" ry="22" transform="rotate(-22 56 82)" fill="none" stroke="#d7e4c4" stroke-width="2.5"/>' +
    '<ellipse cx="114" cy="74" rx="32" ry="44" transform="rotate(18 114 74)" fill="#2f4a38"/>' +
    '<ellipse cx="114" cy="74" rx="21" ry="33" transform="rotate(18 114 74)" fill="none" stroke="#e7f0dc" stroke-width="3.5"/>' +
    '<ellipse cx="114" cy="74" rx="11" ry="22" transform="rotate(18 114 74)" fill="none" stroke="#e7f0dc" stroke-width="2.5"/>'
};

const POTS = {
  fern: ['#7d9474', '#e3d3b4', 0],
  pothos: ['#c4893a', '#f0d7a6', 2],
  cactus: ['#eadcc8', '#c46b45', 8],
  calathea: ['#6c596e', '#e6d5c2', 1]
};

function plantSVG(id) {
  const pot = POTS[id];
  return '<svg class="plant-svg" viewBox="0 0 160 196" aria-hidden="true">' +
    FOLIAGE[id] + potMarkup(pot[0], pot[1], pot[2]) + '</svg>';
}

function actionIcon(task) {
  if (task === 'Rotate') {
    return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.1-5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19.8 4.2v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  if (task === 'Check soil') {
    return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16c2.2 2 11.8 2 14 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 16V9.5h10V16" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 9.5h15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  if (task === 'Mist') {
    return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="12.2" cy="5.6" r="1.5" fill="currentColor"/><circle cx="16.2" cy="8.4" r="1.5" fill="currentColor"/><path d="M5 15.5h14M7 19.5h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.4c3.6 5 6.2 8.2 6.2 12a6.2 6.2 0 0 1-12.4 0c0-3.8 2.6-7 6.2-12z"/></svg>';
}

const MOON = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 3.2A8 8 0 1 0 20.8 14 6.6 6.6 0 0 1 15.5 3.2z"/></svg>';

const MARK = '<svg class="mark" viewBox="0 0 72 72" aria-hidden="true">' +
  '<ellipse cx="36" cy="54" rx="22" ry="8" fill="#d9c6a6"/>' +
  '<path d="M16 52c4-18 14-28 22-26-2 10-2 18-8 26" fill="#3f6b4e"/>' +
  '<path d="M34 52c4-20 16-30 26-24-4 12-10 20-20 24" fill="#234232"/>' +
  '<path d="M24 50c10-6 22-8 30-2-10 2-20 6-28 10" fill="#6d8f62"/>' +
  '<ellipse cx="36" cy="52" rx="18" ry="6" fill="#c4a27a"/>' +
  '<circle cx="28" cy="40" r="3" fill="#234232"/>' +
  '<circle cx="40" cy="36" r="2.2" fill="#234232"/>' +
  '<circle cx="48" cy="44" r="2.4" fill="#234232"/>' +
  '</svg>';

function historyList(entries, stampDate, kind) {
  if (!entries.length) {
    const empty = kind === 'water' ? 'No drink on the record yet.' : 'Nothing noted yet.';
    return '<p>' + empty + '</p>';
  }
  return '<ul>' + entries.map((entry) => {
    const fresh = entry.indexOf(stampDate + ' ·') === 0;
    return '<li class="' + (fresh ? 'is-new' : '') + '">' + esc(entry) +
      (fresh ? '<span class="new-tag">New</span>' : '') + '</li>';
  }).join('') + '</ul>';
}

function lightBlock(plant) {
  const level = lightLevel(plant.light);
  const panes = [1, 2, 3].map((pane) => {
    const on = pane <= level;
    const bright = on && level === 3 && pane === 3;
    return '<span class="pane' + (on ? ' on' : '') + (bright ? ' bright' : '') + '"></span>';
  }).join('');
  return '<section class="fact fact-light">' +
    '<h3>Light</h3>' +
    '<div class="light-row">' +
      '<div class="window" aria-hidden="true">' + panes + '</div>' +
      '<div><p class="fact-strong">' + esc(plant.light) + '</p><p>' + esc(lightNote(plant.light)) + '</p></div>' +
    '</div></section>';
}

function factsHTML(plant, stampDate) {
  const parts = splitHistory(plant.history);
  return '<div class="facts">' +
    lightBlock(plant) +
    '<section class="fact fact-water"><h3>Water</h3>' + historyList(parts.water, stampDate, 'water') + '</section>' +
    '<section class="fact fact-notes"><h3>Observations</h3>' + historyList(parts.notes, stampDate, 'notes') + '</section>' +
    '</div>';
}

function careButtons(plant, rich) {
  const verb = verbFor(plant.task);
  const water = rich
    ? actionIcon(plant.task) + '<span class="btn-label">' + esc(verb) + '</span><span class="btn-sub">' + esc(LOG_LINE[plant.task] || 'Logs this care') + '</span>'
    : '<span class="sr-only">' + esc(plant.name) + '. </span>' + esc(verb);
  let html = '<div class="actions' + (plant.status === 'pending' ? '' : ' is-single') + '">';
  html += '<button type="button" class="btn btn-water" data-action="watered" data-id="' + plant.id + '" data-focusid="watered-' + plant.id + '">' + water + '</button>';
  if (plant.status === 'pending') {
    const snooze = rich
      ? MOON + '<span class="btn-label">Snooze</span><span class="btn-sub">Later today</span>'
      : '<span class="sr-only">' + esc(plant.name) + '. </span>Snooze';
    html += '<button type="button" class="btn btn-snooze" data-action="snooze" data-id="' + plant.id + '" data-focusid="snooze-' + plant.id + '">' + snooze + '</button>';
  }
  html += '</div>';
  return html;
}

function doneActions(plant) {
  const next = nextOpen();
  if (next) {
    return '<p class="done-note">Logged today.</p>' +
      '<button type="button" class="btn btn-next" data-action="select" data-id="' + next.id + '" data-focusid="next-' + next.id + '">Care for ' + esc(next.name) + ' next</button>';
  }
  return '<p class="done-note">Logged today.</p>' +
    '<button type="button" class="btn btn-next" data-action="clear" data-focusid="back-sill">Back to the sill</button>';
}

function detailBody(plant, stampDate, rich) {
  const stamp = plant.status === 'done' ? 'Logged' : plant.status === 'snoozed' ? 'Later' : '';
  const art = '<div class="art-wrap">' + plantSVG(plant.id) +
    (stamp && rich ? '<p class="stamp' + (plant.status === 'snoozed' ? ' is-later' : '') + '">' + stamp + '</p>' : '') +
    '</div>';
  const taskLine = plant.status === 'done'
    ? 'Today’s task was ' + plant.task.toLowerCase() + '.'
    : 'Today’s task: ' + plant.task + '.';
  const copy = '<p class="eyebrow">' + esc(plant.species) + '</p>' +
    (rich ? '<h2 class="plant-name" id="room-title">' + esc(plant.name) + '</h2>' : '<p class="plant-name">' + esc(plant.name) + '</p>') +
    '<p class="aside">' + esc(ASIDES[plant.id] || '') + '</p>' +
    '<p class="where">' + esc(plant.location) + ' · ' + esc(statusPhrase(plant)) + '</p>' +
    '<p class="task-line">' + esc(taskLine) + '</p>';
  const actions = plant.status === 'done' ? doneActions(plant) : (rich ? careButtons(plant, true) : '');
  if (rich) {
    return '<div class="room-hero">' + art + '<div class="room-copy">' + copy + '</div></div>' + actions + factsHTML(plant, stampDate);
  }
  return art + copy + actions + factsHTML(plant, stampDate);
}

function sillHTML() {
  const buttons = state.plants.slice().sort((a, b) => a.order - b.order).map((plant) => {
    const selected = state.selectedId === plant.id;
    return '<button type="button" class="sill-btn is-' + tone(plant) + (selected ? ' is-selected' : '') + '" data-action="select" data-id="' + plant.id + '" data-focusid="sill-' + plant.id + '" data-nav="item"' +
      (selected ? ' aria-current="true"' : '') + '>' +
      plantSVG(plant.id) +
      '<span class="sill-name">' + esc(plant.name) + '</span>' +
      '<span class="sill-state">' + esc(sillState(plant)) + '</span>' +
      '</button>';
  }).join('');
  return '<nav class="sill" aria-label="Plants on the sill">' + buttons + '</nav>';
}

function posterHTML(place) {
  const items = donePlants().map((plant) => {
    const latest = plant.history[0] || verbFor(plant.task);
    return '<li><span class="recap-name">' + esc(plant.name) + '</span>' +
      '<span class="recap-did">' + esc(latest) + '</span>' +
      '<span class="recap-was">Was ' + esc(wasDue(plant.baseDue)) + '</span></li>';
  }).join('');
  const hint = place === 'room'
    ? 'Choose someone on the sill, or open the settled list, for light, water, and notes.'
    : 'Open any settled plant below for light, water, and notes.';
  return '<div class="poster">' +
    '<h2 id="done-title">The sill is quiet</h2>' +
    '<p>All four cares are logged. Nothing is overdue and nothing is waiting. ' + hint + '</p>' +
    '<ul class="recap">' + items + '</ul>' +
    '<div class="next-slip"><h3>Next glance</h3><p>' + esc(glanceCopy()) + '</p></div>' +
    '</div>';
}

function roomHTML(stampDate) {
  const plant = state.selectedId ? findPlant(state.selectedId) : null;
  const quiet = !plant;
  let body;
  if (!plant) body = posterHTML('room');
  else body = '<div id="detail">' + detailBody(plant, stampDate, true) + '</div>';
  return '<section class="room' + (quiet ? ' is-quiet' : '') + '"' +
    (plant ? ' aria-labelledby="room-title"' : ' aria-labelledby="done-title"') + '>' +
    sillHTML() + body + '</section>';
}

function ticketHTML(plant, index, total, stampDate, prefix) {
  const selected = state.selectedId === plant.id;
  const open = selected && (desktop() || state.mobileOpen);
  const showInline = !desktop() && state.mobileOpen && selected;
  const more = desktop()
    ? '<span class="sr-only">Show details.</span>'
    : '<span class="more">' + (open ? 'Hide notes' : 'Notes') + '</span>';
  const actions = !desktop() && plant.status !== 'done'
    ? '<div class="row-actions' + (plant.status === 'pending' ? '' : ' is-single') + '">' +
        '<button type="button" class="btn btn-water" data-action="watered" data-id="' + plant.id + '" data-focusid="watered-' + plant.id + '"><span class="sr-only">' + esc(plant.name) + '. </span>' + esc(verbFor(plant.task)) + '</button>' +
        (plant.status === 'pending'
          ? '<button type="button" class="btn btn-snooze" data-action="snooze" data-id="' + plant.id + '" data-focusid="snooze-' + plant.id + '"><span class="sr-only">' + esc(plant.name) + '. </span>Snooze</button>'
          : '') +
      '</div>'
    : '';
  const detail = showInline
    ? '<section class="inline-detail" id="detail" aria-label="Light, water, and notes for ' + esc(plant.name) + '">' +
        detailBody(plant, stampDate, false) + '</section>'
    : '';
  return '<li class="ticket is-' + tone(plant) + (selected ? ' is-selected' : '') + '" id="ticket-' + plant.id + '">' +
    '<button type="button" class="ticket-btn" data-action="select" data-id="' + plant.id + '" data-focusid="select-' + plant.id + '" data-nav="item" aria-expanded="' + (open ? 'true' : 'false') + '"' +
      (open ? ' aria-controls="detail"' : '') +
      (selected ? ' aria-current="true"' : '') + '>' +
      '<span class="sr-only">' + esc(prefix) + ' ' + (index + 1) + ' of ' + total + '. </span>' +
      '<span class="ord" aria-hidden="true">' + (index + 1) + '</span>' +
      '<span class="t-copy"><span class="t-kicker">' + esc(plant.task) + '</span>' +
        '<span class="t-name">' + esc(plant.name) + '</span>' +
        '<span class="t-meta">' + esc(plant.species) + ' · ' + esc(plant.location) + '</span>' +
        more + '</span>' +
      '<span class="t-due">' + esc(plant.due) + '</span>' +
    '</button>' + actions + detail + '</li>';
}

function queueHTML(stampDate) {
  const pending = pendingPlants();
  const snoozed = snoozedPlants();
  if (allDone()) {
    if (desktop()) {
      return '<section id="queue" tabindex="-1" data-focusid="queue" aria-labelledby="queue-title">' +
        '<div class="queue-head"><h2 class="queue-title" id="queue-title">Today’s care</h2><p class="count">All logged</p></div>' +
        '<p class="queue-note">All four are logged. The sill has the recap and the next glance. Settled plants below still open their notes.</p>' +
        '</section>';
    }
    return '<section id="queue" tabindex="-1" data-focusid="queue" aria-labelledby="done-title">' + posterHTML('queue') + '</section>';
  }

  let lists = '';
  if (!pending.length) {
    lists += '<p class="queue-empty">Nothing is due this sitting. Snoozed care sits under Later today, ready when you are.</p>';
  } else {
    lists += '<ol class="care-list">' + pending.map((plant, index) => ticketHTML(plant, index, pending.length, stampDate, 'Priority')).join('') + '</ol>';
  }
  if (snoozed.length) {
    lists += '<h3 class="later-title" id="later-title">Later today</h3>' +
      '<ol class="care-list" aria-labelledby="later-title">' +
      snoozed.map((plant, index) => ticketHTML(plant, index, snoozed.length, stampDate, 'Snoozed,')).join('') +
      '</ol>';
  }
  return '<section id="queue" tabindex="-1" data-focusid="queue" aria-labelledby="queue-title">' +
    '<div class="queue-head"><h2 class="queue-title" id="queue-title">Today’s care</h2><p class="count">' + esc(countLine()) + '</p></div>' +
    lists + '</section>';
}

function settledHTML(stampDate) {
  const done = donePlants();
  if (!done.length) return '';
  const items = done.map((plant) => {
    const selected = state.selectedId === plant.id;
    const open = selected && (desktop() || state.mobileOpen);
    const showInline = !desktop() && state.mobileOpen && selected;
    const detail = showInline
      ? '<section class="inline-detail" id="detail" aria-label="Light, water, and notes for ' + esc(plant.name) + '">' +
          detailBody(plant, stampDate, false) + '</section>'
      : '';
    return '<li>' +
      '<button type="button" class="settled-btn' + (selected ? ' is-selected' : '') + '" data-action="select" data-id="' + plant.id + '" data-focusid="select-' + plant.id + '" data-nav="item" aria-expanded="' + (open ? 'true' : 'false') + '"' +
        (showInline || (desktop() && selected) ? ' aria-controls="detail"' : '') +
        (selected ? ' aria-current="true"' : '') + '>' +
        '<span class="sr-only">Settled. </span><span class="s-name">' + esc(plant.name) + '</span>' +
        '<span class="s-did">' + esc(plant.history[0] || verbFor(plant.task)) + '</span></button>' +
      detail + '</li>';
  }).join('');
  return '<section class="settled" aria-labelledby="settled-title"><h2 class="settled-title" id="settled-title">Settled</h2><ul class="settled-list">' + items + '</ul></section>';
}

function rhythmHTML(now) {
  const logged = loggedCount();
  const usual = state.week[now.weekIndex];
  const note = 'Bigger stone, busier day, Monday to Sunday. Today is ' + now.dayName +
    ', usually ' + usual + '. Today’s ring is the log: ' + logged + ' of 4.';
  const days = state.week.map((value, index) => {
    const today = index === now.weekIndex;
    const progress = today ? (logged / 4) * 100 : 0;
    return '<li class="day' + (today ? ' is-today' : '') + '" data-n="' + value + '">' +
      '<span class="stone-ring" style="--p:' + progress.toFixed(2) + '" aria-hidden="true"><span class="stone" style="--n:' + value + '"></span></span>' +
      '<span class="day-label"><span aria-hidden="true">' + WEEKSHORT[index] + '</span><span class="sr-only">' + WEEKDAYS[index] + '</span></span>' +
      '<span class="day-num"><span class="sr-only">rhythm </span>' + value + '</span>' +
      '<span class="day-flag">' + (today ? 'Today' : '') + '</span>' +
      '</li>';
  }).join('');
  return '<figure class="rhythm"><figcaption><span class="rhythm-title">Weekly rhythm</span><span class="rhythm-note">' +
    esc(note) + '</span></figcaption><ol class="tray">' + days + '</ol></figure>';
}

function headerHTML(now) {
  return '<header class="top"><div class="brand">' + MARK +
    '<div><p class="kicker">Household plant care</p><h1>Moss</h1><p class="dateline">' + esc(now.dateLine) + '</p></div></div>' +
    '<p class="lede">' + esc(ledeText(now)) + '</p></header>';
}

function footerHTML() {
  return '<footer class="colophon"><p>Moss keeps house for Frida, Orbit, Dot, and Drama.</p>' +
    '<p>Keyboard: Tab moves through every control. Arrow keys walk the sill, the queue, or the settled list. Escape closes notes, or closes the undo slip and keeps the change.</p></footer>';
}

function appHTML() {
  const now = nowParts();
  const wide = desktop();
  const rhythm = rhythmHTML(now);
  const ledger = '<div class="ledger">' + (wide ? rhythm : '') + queueHTML(now.stampDate) + settledHTML(now.stampDate) + '</div>';
  const main = wide
    ? '<main class="layout">' + roomHTML(now.stampDate) + ledger + '</main>'
    : '<main class="layout">' + ledger + '</main>';
  return headerHTML(now) + (wide ? '' : rhythm) + main + footerHTML();
}

function arm(ms) {
  window.clearTimeout(state.timer);
  state.timer = window.setTimeout(expireUndo, ms);
  if (state.timer && typeof state.timer.unref === 'function') state.timer.unref();
}

function expireUndo() {
  if (state.toastHold) {
    arm(8000);
    return;
  }
  state.undoStack = [];
  state.toast = null;
  syncToast();
}

function topUndo() {
  return state.undoStack.length ? state.undoStack[state.undoStack.length - 1] : null;
}

function syncToast() {
  const el = document.getElementById('toast');
  if (!el) return;
  const next = state.toast || '';
  if (next === toastShown && el.dataset.ready === '1') return;
  toastShown = next;
  el.dataset.ready = '1';
  state.toastHold = false;
  if (!next) {
    el.hidden = true;
    el.innerHTML = '';
    document.body.classList.remove('has-toast');
    return;
  }
  const undo = topUndo();
  const undoBtn = undo
    ? '<button type="button" class="btn btn-undo" data-action="undo" data-focusid="undo"><span class="btn-label">Undo</span><span class="btn-sub">' + esc(undo.label) + '</span></button>'
    : '';
  el.innerHTML = '<p class="toast-msg">' + esc(next) + '</p>' + undoBtn +
    '<button type="button" class="btn btn-dismiss" data-action="dismiss" data-focusid="dismiss">Close</button>';
  el.hidden = false;
  document.body.classList.add('has-toast');
}

function focusDesired(id) {
  if (!id || !document.querySelector) return;
  let el = document.querySelector('[data-focusid="' + id + '"]');
  if (!el && id.indexOf('next-') === 0) {
    el = document.querySelector('[data-focusid="select-' + id.slice(5) + '"]');
  }
  if (!el && id.indexOf('watered-') === 0) {
    el = document.querySelector('[data-focusid="select-' + id.slice(8) + '"]');
  }
  if (!el) el = document.getElementById('detail') || document.getElementById('queue');
  if (el && typeof el.focus === 'function') el.focus();
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;
  const active = document.activeElement;
  const current = active && active.dataset ? active.dataset.focusid || '' : '';
  const desired = state.focusAfterRender || current;
  state.focusAfterRender = null;
  const y = window.scrollY || 0;
  document.body.classList.toggle('is-desktop', desktop());
  document.body.classList.toggle('is-quiet', desktop() && !state.selectedId && allDone());
  document.title = titleFor();
  root.innerHTML = appHTML();
  syncToast();
  if (typeof window.scrollTo === 'function') window.scrollTo(0, y);
  focusDesired(desired);
  if (state.scrollTicket) {
    const node = document.getElementById('ticket-' + state.scrollTicket);
    state.scrollTicket = null;
    if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' });
  }
}

function pushUndo(plant, kind) {
  const label = plant.name + ' ' + (kind === 'snooze' ? 'snoozed' : verbFor(plant.task).toLowerCase());
  state.undoStack.push({
    id: plant.id,
    plant: clonePlant(plant),
    label,
    kind
  });
  state.focusReturn = 'select-' + plant.id;
}

function markWatered(id) {
  const plant = findPlant(id);
  if (!plant || plant.status === 'done') return;
  pushUndo(plant, 'water');
  plant.status = 'done';
  plant.due = 'Done today';
  plant.history = [nowParts().stampDate + ' · ' + verbFor(plant.task), ...plant.history];
  const next = nextOpen();
  if (next) {
    state.selectedId = next.id;
    state.mobileOpen = false;
  } else {
    state.selectedId = null;
    state.mobileOpen = false;
  }
  state.toast = plant.name + ': ' + verbFor(plant.task) + '.';
  state.focusAfterRender = 'undo';
  arm(8000);
  render();
}

function snoozePlant(id) {
  const plant = findPlant(id);
  if (!plant || plant.status !== 'pending') return;
  pushUndo(plant, 'snooze');
  plant.status = 'snoozed';
  plant.due = 'Later today';
  state.selectedId = plant.id;
  state.mobileOpen = true;
  state.toast = plant.name + ' snoozed for later today.';
  state.focusAfterRender = 'undo';
  arm(8000);
  render();
}

function undo() {
  const entry = state.undoStack.pop();
  if (!entry) return;
  const index = state.plants.findIndex((plant) => plant.id === entry.id);
  if (index >= 0) state.plants[index] = entry.plant;
  state.selectedId = entry.id;
  state.mobileOpen = true;
  state.scrollTicket = desktop() ? null : entry.id;
  if (state.undoStack.length) {
    state.toast = entry.plant.name + ' is back on the queue.';
    state.focusAfterRender = 'undo';
    arm(8000);
  } else {
    state.toast = entry.plant.name + ' is back on the queue.';
    state.focusAfterRender = 'select-' + entry.id;
    arm(2800);
  }
  render();
}

function dismissToast() {
  window.clearTimeout(state.timer);
  state.undoStack = [];
  state.toast = null;
  const back = state.focusReturn || (state.selectedId ? 'select-' + state.selectedId : 'queue');
  syncToast();
  focusDesired(back);
}

function selectPlant(id) {
  const plant = findPlant(id);
  if (!plant) return;
  const same = state.selectedId === id;
  if (!desktop() && same) state.mobileOpen = !state.mobileOpen;
  else {
    state.selectedId = id;
    state.mobileOpen = true;
  }
  if (!desktop()) state.scrollTicket = id;
  render();
}

function clearSelection() {
  state.selectedId = null;
  state.mobileOpen = false;
  state.focusAfterRender = 'queue';
  render();
}

function onClick(event) {
  const target = event.target.closest ? event.target.closest('[data-action]') : null;
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (action === 'select') selectPlant(id);
  else if (action === 'watered') markWatered(id);
  else if (action === 'snooze') snoozePlant(id);
  else if (action === 'undo') undo();
  else if (action === 'dismiss') dismissToast();
  else if (action === 'clear') clearSelection();
}

function onKey(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Escape') {
    if (state.toast) {
      event.preventDefault();
      dismissToast();
      return;
    }
    if (!desktop() && state.mobileOpen) {
      event.preventDefault();
      state.mobileOpen = false;
      state.focusAfterRender = state.selectedId ? 'select-' + state.selectedId : 'queue';
      render();
    }
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
  const current = event.target.closest ? event.target.closest('[data-nav="item"]') : null;
  if (!current) return;
  const group = current.closest('.care-list, .settled-list, .sill');
  if (!group) return;
  const items = Array.from(group.querySelectorAll('[data-nav="item"]'));
  const index = items.indexOf(current);
  if (index < 0) return;
  let next = index;
  if (event.key === 'ArrowDown') next = Math.min(items.length - 1, index + 1);
  if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = items.length - 1;
  if (next === index) return;
  event.preventDefault();
  const id = items[next].dataset.id;
  state.selectedId = id;
  state.mobileOpen = !desktop();
  state.focusAfterRender = items[next].dataset.focusid;
  if (!desktop()) state.scrollTicket = id;
  render();
}

function boot() {
  const first = pendingPlants()[0];
  state.selectedId = first ? first.id : null;
  state.mobileOpen = false;
  const toast = document.getElementById('toast');
  if (toast) {
    toast.addEventListener('pointerenter', () => { state.toastHold = true; });
    toast.addEventListener('pointerleave', () => { state.toastHold = false; });
    toast.addEventListener('focusin', () => { state.toastHold = true; });
    toast.addEventListener('focusout', (event) => {
      if (!toast.contains(event.relatedTarget)) state.toastHold = false;
    });
  }
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  const mq = window.matchMedia ? window.matchMedia('(min-width: 960px)') : null;
  if (mq && typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', () => {
      if (!mq.matches && state.selectedId) state.mobileOpen = true;
      render();
    });
  }
  render();
}

if (typeof document !== 'undefined') boot();
