'use strict';

// Embedded from PLANTS.json so opening index.html needs no server or requests.
const PLANT_DATA = {
  plants: [
    { id: 'fern', name: 'Frida', species: 'Boston fern', location: 'Bathroom', task: 'Water', due: '2 days overdue', urgency: 4, light: 'Low, indirect', history: ['Sep 19 · Misted', 'Sep 16 · Watered', 'Sep 12 · New frond'] },
    { id: 'pothos', name: 'Orbit', species: 'Golden pothos', location: 'Bookshelf', task: 'Rotate', due: 'Today', urgency: 2, light: 'Medium, indirect', history: ['Sep 20 · Watered', 'Sep 14 · Rotated', 'Sep 10 · Wiped leaves'] },
    { id: 'cactus', name: 'Dot', species: 'Bunny ears cactus', location: 'South window', task: 'Check soil', due: 'Today', urgency: 1, light: 'Bright, direct', history: ['Sep 08 · Watered', 'Sep 01 · New pad noted', 'Aug 22 · Rotated'] },
    { id: 'calathea', name: 'Drama', species: 'Calathea orbifolia', location: 'Bedroom', task: 'Mist', due: 'Tomorrow', urgency: 0, light: 'Medium, filtered', history: ['Sep 21 · Misted', 'Sep 18 · Watered', 'Sep 15 · Brown edge noted'] }
  ],
  week: [1, 3, 2, 4, 2, 1, 3]
};
const CARE = {
  Water: { icon: 'drop', past: 'Watered', prompt: 'A drink for those thirsty roots.' },
  Rotate: { icon: 'rotate', past: 'Rotated', prompt: 'A little turn toward the light.' },
  'Check soil': { icon: 'soil', past: 'Checked soil', prompt: 'Check in before reaching for water.' },
  Mist: { icon: 'drop', past: 'Misted', prompt: 'A little mist is on the list.' }
};
const STORAGE_KEY = 'moss-garden-v1';
const UNDO_MS = 12000;
const $ = (selector, root = document) => root.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
const art = id => `<svg class="plant-art" viewBox="0 0 160 180" aria-hidden="true"><use href="#plant-${id}"/></svg>`;
const plantById = id => PLANT_DATA.plants.find(plant => plant.id === id);
const shortDate = date => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayNumber = day => Date.parse(`${day}T12:00:00Z`) / 86400000;
const addDays = (day, amount) => new Date((dayNumber(day) + amount) * 86400000).toISOString().slice(0, 10);
const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(dayNumber(day)) && addDays(day, 0) === day;
const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let storageAvailable = true;

function loadState() {
  const initial = { version: 1, anchorDay: localDay(), tasks: {}, entries: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !validDay(saved.anchorDay) || !saved.tasks || typeof saved.tasks !== 'object' || !Array.isArray(saved.entries)) return initial;
    const entries = saved.entries.filter(entry => entry && typeof entry.id === 'string' && plantById(entry.plantId) && ['water', 'task', 'observation'].includes(entry.kind) && typeof entry.label === 'string' && entry.label.length <= 280 && typeof entry.at === 'string' && Number.isFinite(Date.parse(entry.at)));
    const tasks = {};
    for (const plant of PLANT_DATA.plants) {
      const task = saved.tasks[plant.id];
      if (!task || typeof task.operationId !== 'string') continue;
      if (task.status === 'done' && typeof task.completedAt === 'string' && Number.isFinite(Date.parse(task.completedAt)) && entries.some(entry => entry.id === task.eventId && entry.plantId === plant.id && entry.kind !== 'observation')) tasks[plant.id] = task;
      if (task.status === 'snoozed' && validDay(task.dueDay)) tasks[plant.id] = task;
    }
    return { version: 1, anchorDay: saved.anchorDay, tasks, entries };
  } catch {
    storageAvailable = false;
    return initial;
  }
}

let state = loadState();
let openPlantId = null;
let returnFocusKey = null;
let renderedDay = localDay();
const dialog = $('#plant-dialog');
const toastStack = $('#toast-stack');
const receipts = new Map();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageAvailable = true; }
  catch { storageAvailable = false; }
  $('#storage-status').textContent = storageAvailable ? 'Saved on this device. A little space of your own.' : 'Care works for this visit. Browser storage is unavailable.';
}

function announce(message) {
  $('#announcer').textContent = '';
  window.setTimeout(() => { $('#announcer').textContent = message; }, 30);
}

function dueDay(plant) {
  const task = state.tasks[plant.id];
  if (task?.status === 'snoozed') return task.dueDay;
  return addDays(state.anchorDay, plant.due === 'Tomorrow' ? 1 : plant.due.includes('overdue') ? -2 : 0);
}

function daysUntil(plant) { return dayNumber(dueDay(plant)) - dayNumber(localDay()); }
function isDone(plant) { return state.tasks[plant.id]?.status === 'done'; }
function dueText(plant) {
  if (isDone(plant)) return 'Tended to';
  const days = daysUntil(plant);
  if (days < 0) return `${Math.abs(days)} ${days === -1 ? 'day' : 'days'} overdue`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function queueRow(plant, upcoming = false) {
  const care = CARE[plant.task];
  const overdue = daysUntil(plant) < 0;
  const snoozed = state.tasks[plant.id]?.status === 'snoozed';
  return `<article class="plant-row ${upcoming ? 'upcoming' : ''} ${overdue ? 'overdue' : ''}" aria-label="${plant.name}, ${plant.task.toLowerCase()}, ${dueText(plant).toLowerCase()}">
    <button class="plant-art-button" data-open-plant="${plant.id}" data-return="queue-art-${plant.id}" aria-label="View ${plant.name}’s care details">${art(plant.id)}</button>
    <div class="row-copy"><div class="row-heading"><h3><button class="plant-name-button" data-open-plant="${plant.id}" data-return="queue-name-${plant.id}" aria-label="View ${plant.name}’s care details">${plant.name}</button></h3><span class="due-label">${dueText(plant)}</span></div>
    <p class="plant-meta">${plant.species} <span aria-hidden="true">·</span> ${plant.location}</p>
    <p class="task-label">${icon(care.icon)}${snoozed ? 'Snoozed · ' : ''}${plant.task}${upcoming ? '' : `<span class="sr-only">. ${care.prompt}</span>`}</p></div>
    ${upcoming ? `<button class="icon-button" data-open-plant="${plant.id}" data-return="queue-next-${plant.id}" aria-label="View ${plant.name}’s upcoming care">${icon('arrow')}</button>` : `<div class="row-actions"><button class="primary-button" data-action="complete" data-plant="${plant.id}" aria-label="Mark ${plant.name} as ${care.past.toLowerCase()}">${icon(care.icon)}${care.past}</button><button class="snooze-button" data-action="snooze" data-plant="${plant.id}" aria-label="Snooze ${plant.name}’s ${plant.task.toLowerCase()} until tomorrow">${icon('clock')}Snooze</button></div>`}
  </article>`;
}

function renderQueue() {
  const sorted = [...PLANT_DATA.plants].sort((a, b) => daysUntil(a) - daysUntil(b) || b.urgency - a.urgency);
  const pending = sorted.filter(plant => !isDone(plant) && daysUntil(plant) <= 0);
  const upcoming = sorted.filter(plant => !isDone(plant) && daysUntil(plant) > 0);
  const completed = sorted.filter(isDone);
  $('#today-queue').innerHTML = pending.map(plant => queueRow(plant)).join('');
  $('#upcoming-queue').innerHTML = upcoming.map(plant => queueRow(plant, true)).join('');
  $('#upcoming-section').hidden = !upcoming.length;
  $('#queue-count').textContent = pending.length;
  $('#queue-count').setAttribute('aria-label', `${pending.length} care ${pending.length === 1 ? 'task' : 'tasks'} remaining`);
  $('#all-done').hidden = pending.length > 0;
  $('#daily-summary').textContent = pending.length ? `${pending.length} ${pending.length === 1 ? 'plant needs' : 'plants need'} a little love` : 'A little room to breathe. All done.';
  $('.daily-pill').classList.toggle('is-done', !pending.length);
  $('#queue-intro').textContent = pending.some(plant => daysUntil(plant) < 0) ? 'Start with the one that’s waited a little longer.' : pending.length ? 'A few small moments. That’s all it takes.' : 'Nothing more needs your attention today.';
  const postponed = upcoming.filter(plant => state.tasks[plant.id]?.status === 'snoozed').length;
  $('#done-description').textContent = postponed ? `${postponed} ${postponed === 1 ? 'plant is' : 'plants are'} snoozed until tomorrow. You’ll find ${postponed === 1 ? 'it' : 'them'} below when you’re ready.` : upcoming.length ? `Today’s care is complete. ${upcoming[0].name}’s ${upcoming[0].task.toLowerCase()} is up ${dueText(upcoming[0]).toLowerCase()} — until then, enjoy the green.` : 'Every plant on your list has been cared for. Take a breath, or add a little observation to a plant’s journal.';
  $('#completed-section').hidden = !completed.length;
  const doneToday = completed.filter(plant => localDay(new Date(state.tasks[plant.id].completedAt)) === localDay()).length;
  $('#completed-summary').textContent = `${completed.length} tended to${doneToday === completed.length ? ' today' : ''}`;
  $('#completed-list').innerHTML = completed.map(plant => `<div class="completed-row">${icon('check')}<button data-open-plant="${plant.id}" data-return="completed-${plant.id}" aria-label="View ${plant.name}’s care history">${plant.name}</button><span>${CARE[plant.task].past}</span></div>`).join('');
}

function renderWeek() {
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const monday = addDays(localDay(now), -todayIndex);
  const counts = [...PLANT_DATA.week];
  for (const entry of state.entries) {
    if (entry.kind === 'observation') continue;
    const offset = dayNumber(localDay(new Date(entry.at))) - dayNumber(monday);
    if (offset >= 0 && offset < 7) counts[offset] += 1;
  }
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const max = Math.max(...counts, 1);
  const chart = $('#week-chart');
  chart.innerHTML = counts.map((count, index) => `<div class="day-column ${index === todayIndex ? 'is-today' : ''}" aria-hidden="true"><span class="day-count">${count}</span><div class="day-bar"></div><span class="day-label">${days[index].slice(0, 1)}</span></div>`).join('');
  chart.querySelectorAll('.day-bar').forEach((bar, index) => { bar.style.height = `${Math.round(16 + counts[index] / max * 53)}px`; });
  chart.setAttribute('aria-label', `Weekly care moments: ${counts.map((count, index) => `${days[index]}${index === todayIndex ? ', today,' : ''} ${count}`).join('; ')}. Today is underlined.`);
  $('#week-total').textContent = counts.reduce((sum, count) => sum + count, 0);
}

function renderCollection() {
  $('#plant-collection').innerHTML = PLANT_DATA.plants.map(plant => `<button class="collection-plant" data-open-plant="${plant.id}" data-return="collection-${plant.id}" aria-label="View ${plant.name}, ${plant.species}, ${plant.location}. ${dueText(plant)}.">${art(plant.id)}<span><span class="collection-name">${plant.name}</span><span class="collection-location">${plant.location}</span><span class="collection-status">${isDone(plant) ? '✓ Tended to' : `${plant.task} · ${dueText(plant).toLowerCase()}`}</span></span></button>`).join('');
}

function historyFor(plant) {
  const added = state.entries.filter(entry => entry.plantId === plant.id).slice().reverse().map(entry => ({ date: shortDate(new Date(entry.at)), label: entry.label, kind: entry.kind, at: entry.at }));
  const original = plant.history.map(item => {
    const [date, label] = item.split(' · ');
    return { date, label, kind: /new|brown/i.test(label) ? 'observation' : label === 'Watered' ? 'water' : 'task' };
  });
  return [...added, ...original];
}

function renderDetail({ clearDraft = false } = {}) {
  if (!openPlantId) return;
  const plant = plantById(openPlantId);
  const care = CARE[plant.task];
  const draft = clearDraft ? '' : $('#observation')?.value || '';
  const selection = $('#observation')?.selectionStart || 0;
  const focusedKey = dialog.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
  const history = historyFor(plant);
  const lastWater = history.find(entry => entry.kind === 'water');
  const done = isDone(plant);
  const later = daysUntil(plant) > 0;
  const wateredToday = state.entries.some(entry => entry.plantId === plant.id && entry.kind === 'water' && localDay(new Date(entry.at)) === localDay());
  $('#plant-detail').innerHTML = `<div class="detail-top"><p class="eyebrow">FROM YOUR LITTLE JUNGLE</p><button class="icon-button close-detail" data-close-detail data-focus="close" aria-label="Close plant details" autofocus>${icon('close')}</button><div class="detail-identity">${art(plant.id)}<div><h2 id="detail-name">${plant.name}</h2><p>${plant.species}<br>${plant.location}</p></div></div></div>
    <div class="detail-body"><div class="detail-facts"><section><h3>${icon('sun')}Light</h3><p>${plant.light}</p><p class="fact-note">At home in the ${plant.location.toLowerCase()}.</p></section><section><h3>${icon('drop')}Water</h3><p>${lastWater ? `Last watered ${escapeHTML(lastWater.date)}` : 'No watering recorded yet'}</p><p class="fact-note">Check the soil before a drink.</p></section></div>
    <section class="detail-task" aria-label="Current care"><p>${done ? `${icon('check')} <strong>${care.past}.</strong> This care task is complete.` : `<strong>${plant.task}</strong> · ${dueText(plant)}${state.tasks[plant.id]?.status === 'snoozed' ? ' (snoozed)' : ''}`}<br>${care.prompt}</p>
    ${!done ? `<div class="row-actions"><button class="primary-button" data-action="complete" data-plant="${plant.id}" data-focus="complete" aria-label="Mark ${plant.name} as ${care.past.toLowerCase()}">${icon(care.icon)}${care.past}${later ? ' early' : ''}</button>${!later ? `<button class="snooze-button" data-action="snooze" data-plant="${plant.id}" data-focus="snooze" aria-label="Snooze ${plant.name}’s care until tomorrow">${icon('clock')}Snooze until tomorrow</button>` : ''}</div>` : ''}
    ${plant.task !== 'Water' ? `<button class="secondary-button extra-water" data-action="water" data-plant="${plant.id}" data-focus="water" ${wateredToday ? 'disabled' : ''} aria-label="${wateredToday ? `${plant.name} was watered today` : `Log watering for ${plant.name}`}">${icon(wateredToday ? 'check' : 'drop')}${wateredToday ? 'Watered today' : 'Log watered'}</button>` : ''}</section>
    <section class="history-section" aria-labelledby="history-heading"><h3 id="history-heading">Care & observations</h3><ol class="history-list">${history.map(entry => `<li><span class="history-date">${escapeHTML(entry.date)}</span><span>${escapeHTML(entry.label)}${entry.kind === 'observation' ? '<span class="history-kind">Observation</span>' : ''}</span></li>`).join('')}</ol></section>
    <form class="observation-form" id="observation-form"><label for="observation">Notice something new?</label><textarea id="observation" name="observation" maxlength="280" required data-focus="observation" aria-describedby="observation-hint" placeholder="A new leaf? A small victory?">${escapeHTML(draft)}</textarea><div class="form-footer"><span class="form-hint" id="observation-hint">Your little field notes. Up to 280 characters.</span><button class="secondary-button" type="submit" data-focus="save-note">Save note ${icon('arrow')}</button></div></form></div>`;
  if (focusedKey) {
    const target = $(`[data-focus="${focusedKey}"]`, dialog);
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else $('.close-detail', dialog).focus({ preventScroll: true });
    if (focusedKey === 'observation') $('#observation').setSelectionRange(selection, selection);
  }
}

function renderAll(options = {}) {
  renderedDay = localDay();
  const date = $('#today-date');
  date.dateTime = renderedDay;
  date.textContent = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date());
  renderQueue();
  renderWeek();
  renderCollection();
  renderDetail(options);
}

function openDetail(id, trigger) {
  if (!plantById(id)) return;
  openPlantId = id;
  returnFocusKey = trigger?.dataset.return || `collection-${id}`;
  // A new plant starts a fresh note; actions within this panel preserve its draft.
  renderDetail({ clearDraft: true });
  dialog.append(toastStack);
  dialog.append($('#announcer'));
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function removeReceipt(id) {
  const receipt = receipts.get(id);
  if (!receipt) return;
  clearTimeout(receipt.timer);
  receipt.element.remove();
  receipts.delete(id);
}

function offerUndo(transaction, message) {
  // Only a plant's latest change is reversible; other plants keep their own undo.
  for (const [id, receipt] of receipts) if (receipt.transaction.plantId === transaction.plantId) removeReceipt(id);
  const element = document.createElement('div');
  element.className = 'toast';
  element.innerHTML = `<span>${escapeHTML(message)}</span><button class="toast-undo" data-undo="${transaction.id}" aria-label="Undo: ${escapeHTML(message)}">Undo</button>`;
  toastStack.append(element);
  const receipt = { element, transaction, timer: null, remaining: UNDO_MS, started: performance.now(), hovered: false };
  receipts.set(transaction.id, receipt);
  const pause = () => {
    if (receipt.timer === null) return;
    clearTimeout(receipt.timer);
    receipt.timer = null;
    receipt.remaining = Math.max(0, receipt.remaining - (performance.now() - receipt.started));
  };
  const resume = () => {
    if (receipt.hovered || element.contains(document.activeElement) || document.hidden) return;
    receipt.started = performance.now();
    clearTimeout(receipt.timer);
    receipt.timer = setTimeout(() => removeReceipt(transaction.id), Math.max(receipt.remaining, 1500));
  };
  receipt.pause = pause;
  receipt.resume = resume;
  element.addEventListener('pointerenter', () => { receipt.hovered = true; pause(); });
  element.addEventListener('pointerleave', () => { receipt.hovered = false; resume(); });
  element.addEventListener('focusin', pause);
  element.addEventListener('focusout', () => setTimeout(resume, 0));
  resume();
  announce(`${message} Undo is available for 12 seconds and stays available while focused.`);
}

function focusAfterAction(plantId) {
  if (dialog.open) return;
  const target = $(`[data-action="complete"][data-plant="${plantId}"]`) || $('#today-queue [data-action="complete"]') || $('#care-queue');
  target.focus({ preventScroll: true });
}

function act(type, plantId) {
  const plant = plantById(plantId);
  if (!plant || !['complete', 'snooze', 'water'].includes(type)) return;
  if ((type === 'complete' || type === 'snooze') && isDone(plant)) return;
  if (type === 'water' && state.entries.some(entry => entry.plantId === plantId && entry.kind === 'water' && localDay(new Date(entry.at)) === localDay())) return;
  const id = newId();
  const transaction = { id, plantId, previousTask: state.tasks[plantId] ? { ...state.tasks[plantId] } : null, changesTask: type !== 'water', eventId: null };
  let message;
  if (type === 'snooze') {
    state.tasks[plantId] = { status: 'snoozed', dueDay: addDays(localDay(), 1), operationId: id };
    message = `${plant.name}’s ${plant.task.toLowerCase()} can wait until tomorrow.`;
  } else {
    const at = new Date().toISOString();
    const label = type === 'water' ? 'Watered' : CARE[plant.task].past;
    const entry = { id: newId(), plantId, kind: label === 'Watered' ? 'water' : 'task', label, at };
    state.entries.push(entry);
    transaction.eventId = entry.id;
    if (type === 'complete') state.tasks[plantId] = { status: 'done', completedAt: at, eventId: entry.id, operationId: id };
    message = `${plant.name} ${label.toLowerCase()}. A little love, logged.`;
  }
  persist();
  renderAll();
  focusAfterAction(plantId);
  offerUndo(transaction, message);
}

function undo(id) {
  const receipt = receipts.get(id);
  if (!receipt) return;
  const transaction = receipt.transaction;
  if (transaction.eventId) state.entries = state.entries.filter(entry => entry.id !== transaction.eventId);
  if (transaction.changesTask && state.tasks[transaction.plantId]?.operationId === transaction.id) {
    if (transaction.previousTask) state.tasks[transaction.plantId] = transaction.previousTask;
    else delete state.tasks[transaction.plantId];
  }
  removeReceipt(id);
  persist();
  renderAll();
  if (dialog.open) $('.close-detail', dialog).focus({ preventScroll: true });
  else focusAfterAction(transaction.plantId);
  announce(`Undone. ${plantById(transaction.plantId).name}’s previous care record is restored.`);
}

document.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.hasAttribute('data-close-detail')) dialog.close();
  else if (target.dataset.openPlant) openDetail(target.dataset.openPlant, target);
  else if (target.dataset.action) act(target.dataset.action, target.dataset.plant);
  else if (target.dataset.undo) undo(target.dataset.undo);
});

dialog.addEventListener('close', () => {
  document.body.append(toastStack);
  document.body.append($('#announcer'));
  const plantId = openPlantId;
  openPlantId = null;
  const target = $(`[data-return="${returnFocusKey}"]`) || $(`[data-return="collection-${plantId}"]`) || $('#care-queue');
  target.focus({ preventScroll: true });
});

// Only a click that both starts and ends outside the panel dismisses it.
let backdropStart = false;
dialog.addEventListener('pointerdown', event => { backdropStart = event.target === dialog && outsideDialog(event); });
dialog.addEventListener('click', event => { if (backdropStart && event.target === dialog && outsideDialog(event)) dialog.close(); backdropStart = false; });
function outsideDialog(event) {
  const rect = dialog.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}

document.addEventListener('submit', event => {
  if (event.target.id !== 'observation-form') return;
  event.preventDefault();
  const input = $('#observation');
  const label = input.value.trim();
  if (!label) { input.setCustomValidity('Write a little observation first.'); input.reportValidity(); return; }
  const entry = { id: newId(), plantId: openPlantId, kind: 'observation', label: label.slice(0, 280), at: new Date().toISOString() };
  state.entries.push(entry);
  persist();
  renderAll({ clearDraft: true });
  offerUndo({ id: newId(), plantId: openPlantId, changesTask: false, eventId: entry.id }, `${plantById(openPlantId).name}’s observation is saved.`);
});
document.addEventListener('input', event => { if (event.target.id === 'observation') event.target.setCustomValidity(''); });

document.addEventListener('visibilitychange', () => {
  for (const receipt of receipts.values()) document.hidden ? receipt.pause() : receipt.resume();
  if (!document.hidden && localDay() !== renderedDay) renderAll();
});
// A page left open overnight should bring tomorrow's care back into the queue.
setInterval(() => { if (localDay() !== renderedDay && !document.hidden) renderAll(); }, 60000);

renderAll();
persist();
