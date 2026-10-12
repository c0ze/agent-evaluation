'use strict';

/* Moss — gentle plant-care companion.
   Data source: PLANTS.json (fetched when served; embedded mirror as a
   fallback so the app also works from file:// with no network). */

const FALLBACK_DATA = {
  plants: [
    { id: 'fern', name: 'Frida', species: 'Boston fern', location: 'Bathroom', task: 'Water', due: '2 days overdue', urgency: 4, light: 'Low, indirect', history: ['Sep 19 · Misted', 'Sep 16 · Watered', 'Sep 12 · New frond'] },
    { id: 'pothos', name: 'Orbit', species: 'Golden pothos', location: 'Bookshelf', task: 'Rotate', due: 'Today', urgency: 2, light: 'Medium, indirect', history: ['Sep 20 · Watered', 'Sep 14 · Rotated', 'Sep 10 · Wiped leaves'] },
    { id: 'cactus', name: 'Dot', species: 'Bunny ears cactus', location: 'South window', task: 'Check soil', due: 'Today', urgency: 1, light: 'Bright, direct', history: ['Sep 08 · Watered', 'Sep 01 · New pad noted', 'Aug 22 · Rotated'] },
    { id: 'calathea', name: 'Drama', species: 'Calathea orbifolia', location: 'Bedroom', task: 'Mist', due: 'Tomorrow', urgency: 0, light: 'Medium, filtered', history: ['Sep 21 · Misted', 'Sep 18 · Watered', 'Sep 15 · Brown edge noted'] }
  ],
  week: [1, 3, 2, 4, 2, 1, 3]
};

const DONE_LABELS = {
  'Water': 'Watered',
  'Mist': 'Misted',
  'Rotate': 'Rotated',
  'Check soil': 'Soil checked'
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const state = {
  plants: [],
  week: [],
  expandedId: null,
  snapshot: null,       // for undo
  snackTimer: null,
  interacted: false
};

/* ---------- helpers ---------- */

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function doneLabel(task) {
  return DONE_LABELS[task] || 'Done';
}

function isOverdue(plant) {
  return plant.status === 'todo' && /overdue/i.test(plant.due);
}

function announce(msg) {
  $('#live').textContent = msg;
}

/* ---------- plant portraits (inline SVG, no remote assets) ---------- */

function portraitSVG(id) {
  const pot = '<path d="M18 45h28l-2.6 13.4a4 4 0 0 1-3.9 3.2h-15a4 4 0 0 1-3.9-3.2z" fill="var(--pot)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/><path d="M16 41h32v5H16z" fill="var(--pot)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>';
  const art = {
    fern: '<g stroke="var(--moss-deep)" stroke-width="2.6" fill="none" stroke-linecap="round">' +
      '<path d="M32 41C31 30 27 22 18 15"/><path d="M32 41C32 29 34 20 42 12"/><path d="M32 41C32 32 32 24 31 13"/></g>' +
      '<g fill="var(--moss)">' +
      '<ellipse cx="21" cy="21" rx="4" ry="2.2" transform="rotate(-38 21 21)"/><ellipse cx="25.5" cy="28" rx="4" ry="2.2" transform="rotate(-30 25.5 28)"/>' +
      '<ellipse cx="40" cy="18" rx="4" ry="2.2" transform="rotate(40 40 18)"/><ellipse cx="36.5" cy="27" rx="4" ry="2.2" transform="rotate(28 36.5 27)"/>' +
      '<ellipse cx="29" cy="19" rx="3.6" ry="2" transform="rotate(-8 29 19)"/><ellipse cx="33" cy="26" rx="3.6" ry="2" transform="rotate(6 33 26)"/>' +
      '<circle cx="17.4" cy="14.4" r="2" /><circle cx="42.4" cy="11.4" r="2" /><circle cx="31" cy="11.4" r="2" /></g>',
    pothos: '<path d="M32 41C31 34 26 31 22 30M32 41c1-8 6-13 10-15M32 41c0-9 0-16-1-24" stroke="var(--moss-deep)" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<g fill="var(--moss)" stroke="var(--moss-deep)" stroke-width="1.6">' +
      '<path d="M21 30c-4.4-1-6.8-4.4-6-8 3.6-.8 7 1.6 8 6z" transform="rotate(8 21 30)"/>' +
      '<path d="M43 26c4.2-1.4 6-5 4.8-8.4-3.6-.4-6.6 2.4-7.2 6.6z" transform="rotate(-6 43 26)"/>' +
      '<path d="M31 17c-3-3.4-3-7.4-.4-10 2.8 2.4 3 6.6.4 10z"/></g>' +
      '<circle cx="30.6" cy="12" r="0" fill="none"/>',
    cactus: '<g fill="var(--moss)" stroke="var(--moss-deep)" stroke-width="2">' +
      '<ellipse cx="32" cy="31" rx="8.5" ry="13"/><ellipse cx="20" cy="20" rx="6" ry="9" transform="rotate(-24 20 20)"/><ellipse cx="44" cy="22" rx="6" ry="9" transform="rotate(22 44 22)"/></g>' +
      '<g fill="var(--sun)"><circle cx="17.5" cy="14.5" r="1.6"/><circle cx="45.5" cy="16" r="1.6"/><circle cx="31" cy="19.5" r="1.6"/></g>' +
      '<g stroke="var(--moss-deep)" stroke-width="1.8" stroke-linecap="round"><path d="M29 27v6M35 26v7M20 22l-1.5 4M44 24l1.6 4"/></g>',
    calathea: '<path d="M32 41c-1-7-5-11-11-13M32 41c0-8 3-14 9-18" stroke="var(--moss-deep)" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<g stroke="var(--ink)" stroke-width="1.8">' +
      '<ellipse cx="22" cy="22" rx="9" ry="12" transform="rotate(-24 22 22)" fill="var(--moss)"/>' +
      '<ellipse cx="42" cy="18" rx="8" ry="11" transform="rotate(26 42 18)" fill="var(--moss-deep)"/></g>' +
      '<g stroke="var(--paper)" stroke-width="1.7" stroke-linecap="round" opacity="0.85">' +
      '<path d="M17 20l9 1M16 25l10 0M18.5 29.5l8-.5"/><path d="M38 14l8 1M37.5 19l8.5.5M38.5 23.5l7 .5"/></g>'
  };
  return '<svg viewBox="0 0 64 64" width="46" height="46" focusable="false" aria-hidden="true">' + (art[id] || '') + pot + '</svg>';
}

/* ---------- data loading ---------- */

async function loadData() {
  try {
    const res = await fetch('PLANTS.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('bad response');
    const json = await res.json();
    if (!json || !Array.isArray(json.plants)) throw new Error('bad shape');
    return json;
  } catch (err) {
    return null;
  }
}

function seedPlants(source) {
  return source.plants.map((p) => ({
    ...p,
    status: 'todo',
    originalDue: p.due,
    historyFresh: false,
    history: p.history.slice()
  }));
}

/* ---------- rendering ---------- */

function cardNode(plant, opts) {
  const urgent = isOverdue(plant);
  const li = el('li', {
    class: 'card' + (urgent ? ' card--urgent' : '') + (plant.status === 'done' ? ' card--done' : ''),
    'data-id': plant.id
  });

  const detailId = 'detail-' + plant.id;
  const expanded = state.expandedId === plant.id;

  let dueClass = 'due-pill';
  if (urgent) dueClass += ' due-pill--overdue';
  else if (plant.status === 'snoozed') dueClass += ' due-pill--snoozed';
  else if (plant.status === 'done') dueClass += ' due-pill--done';

  const toggle = el('button', {
    type: 'button',
    class: 'card-toggle',
    'aria-expanded': expanded ? 'true' : 'false',
    'aria-controls': detailId,
    onclick: () => toggleDetail(plant.id)
  },
    el('span', { class: 'portrait', html: portraitSVG(plant.id) }),
    el('span', { class: 'card-text' },
      el('span', { class: 'card-titlerow' },
        el('span', { class: 'card-name' }, plant.name),
        el('span', { class: dueClass }, plant.status === 'done' ? 'Done today' : plant.due)
      ),
      el('span', { class: 'card-meta' }, plant.species + ' · ' + plant.location)
    ),
    el('span', { class: 'chev', html: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' })
  );

  const detail = el('div', { class: 'card-detail', id: detailId });
  if (!expanded) detail.hidden = true;
  if (expanded) {
    const waterEntry = plant.history.find((h) => /watered|misted/i.test(h));
    const obsEntry = plant.history.find((h) => /noted|frond|pad/i.test(h));
    detail.appendChild(
      el('div', { class: 'detail-grid' },
        el('div', { class: 'fact fact--light' },
          el('span', { class: 'fact-label' }, 'Light'),
          el('span', { class: 'fact-value' }, plant.light)
        ),
        el('div', { class: 'fact fact--water' },
          el('span', { class: 'fact-label' }, 'Water'),
          el('span', { class: 'fact-value' }, waterEntry ? 'Last: ' + waterEntry.split(' · ')[0] : 'No recent watering'),
          el('span', { class: 'fact-value', style: 'font-weight:400;font-size:.82rem' }, plant.task === 'Water' || plant.task === 'Mist' ? 'Loves a drink soon.' : 'Soil first, water later.')
        ),
        el('div', { class: 'fact fact--watch' },
          el('span', { class: 'fact-label' }, 'Watch'),
          el('span', { class: 'fact-value' }, obsEntry ? obsEntry.split(' · ')[1] || obsEntry : 'Looking steady')
        )
      )
    );
    detail.appendChild(el('h3', { class: 'history-h' }, 'Observation log'));
    detail.appendChild(el('ul', { class: 'history' },
      plant.history.map((h, i) => el('li', {
        class: (/noted|frond|pad/i.test(h) ? 'is-obs ' : '') + (i === 0 && plant.historyFresh ? 'is-fresh' : '')
      }, h))
    ));
  }

  li.appendChild(toggle);
  li.appendChild(detail);

  if (plant.status !== 'done') {
    li.appendChild(
      el('div', { class: 'card-actions' },
        el('button', {
          type: 'button',
          class: 'btn btn--do',
          'data-action': 'complete',
          'data-id': plant.id,
          html: '<svg class="drop" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.5C8 1.5 2.5 7.2 2.5 10.4A5.5 5.5 0 0 0 13.5 10.4C13.5 7.2 8 1.5 8 1.5z" fill="currentColor"/></svg>'
        }, doneLabel(plant.task)),
        el('button', {
          type: 'button',
          class: 'btn btn--snooze',
          'data-action': 'snooze',
          'data-id': plant.id
        }, 'Snooze')
      )
    );
  } else if (opts && opts.canRestore) {
    li.appendChild(
      el('div', { class: 'card-actions' },
        el('button', {
          type: 'button',
          class: 'btn btn--restore',
          'data-action': 'restore',
          'data-id': plant.id
        }, 'Put back on the list')
      )
    );
  }

  return li;
}

function renderQueue() {
  const list = $('#queue');
  list.textContent = '';
  const todo = state.plants
    .filter((p) => p.status === 'todo')
    .sort((a, b) => b.urgency - a.urgency || a.name.localeCompare(b.name));

  for (const plant of todo) list.appendChild(cardNode(plant, { canRestore: false }));

  const overdue = todo.filter(isOverdue).length;
  const sub = $('#queue-summary');
  if (todo.length === 0) {
    sub.textContent = 'Nothing pending — enjoy the green.';
  } else {
    const bits = [];
    if (overdue > 0) bits.push(overdue + (overdue === 1 ? ' plant is thirsty and overdue' : ' plants are thirsty and overdue'));
    bits.push(todo.length + (todo.length === 1 ? ' task' : ' tasks') + ' on the list');
    sub.textContent = bits.join(' · ') + '.';
  }

  // Later (snoozed)
  const snoozed = state.plants.filter((p) => p.status === 'snoozed');
  const later = $('#later');
  const laterList = $('#later-list');
  laterList.textContent = '';
  later.hidden = snoozed.length === 0;
  for (const plant of snoozed) laterList.appendChild(cardNode(plant, { canRestore: false }));

  // All done
  const done = state.plants.filter((p) => p.status === 'done');
  const alldone = $('#alldone');
  const hasPending = todo.length > 0 || snoozed.length > 0;
  alldone.hidden = hasPending;
  const chips = $('#done-chips');
  chips.textContent = '';
  for (const plant of done) {
    chips.appendChild(el('li', {},
      el('span', { class: 'tick', html: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3 8.5l3.2 3.2L13 4.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' }),
      plant.name
    ));
  }
  renderDoneSection(done);
}

function renderDoneSection(done) {
  let section = $('#done-section');
  const hasPending = state.plants.some((p) => p.status !== 'done');
  if (!section) {
    section = el('section', { class: 'later', id: 'done-section', 'aria-labelledby': 'done-h' },
      el('h2', { class: 'section-label', id: 'done-h' }, 'Done today'),
      el('ul', { class: 'queue queue--later', id: 'done-list' })
    );
    $('#later').after(section);
  }
  const list = $('#done-list');
  list.textContent = '';
  section.hidden = done.length === 0 || !hasPending;
  for (const plant of done) list.appendChild(cardNode(plant, { canRestore: true }));
}

function renderWeek() {
  const week = $('#week');
  week.textContent = '';
  const counts = state.week;
  const max = Math.max(...counts, 1);
  const peak = counts.indexOf(max);
  counts.forEach((n, i) => {
    const col = el('div', { class: 'week-col' + (i === peak ? ' is-peak' : '') },
      el('div', { class: 'week-bar', style: 'height:' + Math.max(12, (n / max) * 84) + '%;animation-delay:' + (i * 60) + 'ms' },
        el('span', { class: 'count' }, String(n))
      ),
      el('span', { class: 'day' }, DAY_LABELS[i])
    );
    week.appendChild(col);
  });
  const total = counts.reduce((a, b) => a + b, 0);
  week.setAttribute('aria-label',
    'Weekly care rhythm: ' + DAY_LABELS.map((d, i) => d + ' ' + counts[i]).join(', ') +
    '. ' + total + ' care touches in total.');
  $('#week-note').innerHTML = 'About <strong>' + total + ' care moments</strong> a week. ' +
    '<strong>' + DAY_LABELS[peak] + '</strong> is your busiest day — Moss pads the list around it.';
}

function renderTally() {
  const tally = $('#tally');
  tally.textContent = '';
  const counts = [
    ['swatch--overdue', 'Overdue', state.plants.filter(isOverdue).length],
    ['swatch--today', 'Due today', state.plants.filter((p) => p.status === 'todo' && /today/i.test(p.due)).length],
    ['swatch--soon', 'Snoozed or soon', state.plants.filter((p) => p.status === 'snoozed' || (p.status === 'todo' && /tomorrow/i.test(p.due))).length],
    ['swatch--done', 'Done today', state.plants.filter((p) => p.status === 'done').length]
  ];
  for (const [cls, label, n] of counts) {
    tally.appendChild(el('li', {},
      el('span', { class: 'swatch ' + cls, 'aria-hidden': 'true' }),
      el('span', {}, label),
      el('span', { class: 'tally-n' }, String(n))
    ));
  }
}

function renderTip() {
  const overdue = state.plants.filter(isOverdue);
  const tip = $('#tip');
  if (overdue.length > 0) {
    const p = overdue[0];
    tip.innerHTML = '<strong>' + p.name + '</strong> has been waiting (' + p.due +
      '). A fern never sulks — it just crisps. Start there.';
  } else if (state.plants.some((p) => p.status === 'todo')) {
    tip.innerHTML = 'No emergencies. A calm day is a good day to <strong>rotate ' +
      (state.plants.find((p) => p.task === 'Rotate' && p.status === 'todo') || { name: 'someone' }).name +
      '</strong> toward the light.';
  } else if (state.plants.some((p) => p.status === 'snoozed')) {
    tip.innerHTML = 'Everything active is snoozed. Moss approves of <strong>rest</strong> — for you and the plants.';
  } else {
    tip.innerHTML = 'Queue empty, vibes green. Consider a <strong>leaf wipe</strong> — nobody ever regretted it.';
  }
}

function renderDayline() {
  const now = new Date();
  $('#dayline').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function render() {
  renderQueue();
  renderWeek();
  renderTally();
  renderTip();
}

/* ---------- interactions ---------- */

function toggleDetail(id) {
  state.expandedId = state.expandedId === id ? null : id;
  render();
  if (state.expandedId === id) {
    const t = document.querySelector('.card[data-id="' + id + '"] .card-toggle');
    if (t) t.focus();
  }
}

function takeSnapshot() {
  state.snapshot = JSON.parse(JSON.stringify({
    plants: state.plants,
    expandedId: state.expandedId
  }));
}

function showSnack(message, undoFn) {
  const bar = $('#snackbar');
  const btn = $('#snackbar-undo');
  $('#snackbar-msg').textContent = message;
  bar.hidden = false;
  clearTimeout(state.snackTimer);
  const newBtn = btn.cloneNode(true);
  btn.replaceWith(newBtn);
  newBtn.addEventListener('click', () => {
    undoFn();
    hideSnack();
  });
  newBtn.focus();
  state.snackTimer = setTimeout(() => {
    hideSnack();
    // return focus to the queue if it was on the snackbar
    if (document.activeElement === newBtn || document.activeElement === document.body) {
      const first = document.querySelector('#queue .card-toggle, #later-list .card-toggle, #queue-h');
      if (first) first.focus();
    }
  }, 6000);
}

function hideSnack() {
  clearTimeout(state.snackTimer);
  $('#snackbar').hidden = true;
}

function completePlant(id) {
  state.interacted = true;
  const plant = state.plants.find((p) => p.id === id);
  if (!plant || plant.status === 'done') return;
  takeSnapshot();
  const label = doneLabel(plant.task);
  plant.status = 'done';
  plant.historyFresh = true;
  plant.history.unshift('Today · ' + label);
  state.expandedId = null;
  render();
  announce(label + ' ' + plant.name + '. Undo available from the toast.');
  showSnack(label + ' ' + plant.name + ' — nice.', () => {
    undo();
    const t = document.querySelector('.card[data-id="' + id + '"] .card-toggle');
    if (t) t.focus();
  });
}

function snoozePlant(id) {
  state.interacted = true;
  const plant = state.plants.find((p) => p.id === id);
  if (!plant || plant.status !== 'todo') return;
  takeSnapshot();
  plant.status = 'snoozed';
  plant.due = 'Snoozed · later';
  state.expandedId = null;
  render();
  announce(plant.name + ' snoozed for later. Undo available from the toast.');
  showSnack(plant.name + ' can wait a little.', () => {
    undo();
    const t = document.querySelector('.card[data-id="' + id + '"] .card-toggle');
    if (t) t.focus();
  });
}

function restorePlant(id) {
  state.interacted = true;
  const plant = state.plants.find((p) => p.id === id);
  if (!plant || plant.status !== 'done') return;
  takeSnapshot();
  plant.status = 'todo';
  plant.due = plant.originalDue;
  if (plant.historyFresh) {
    plant.history.shift();
    plant.historyFresh = false;
  }
  render();
  announce(plant.name + ' is back on the list.');
  showSnack(plant.name + ' is back on the list.', () => {
    undo();
  });
}

function undo() {
  if (!state.snapshot) return;
  state.plants = state.snapshot.plants;
  state.expandedId = state.snapshot.expandedId;
  state.snapshot = null;
  render();
  announce('Undone.');
}

/* ---------- keyboard ---------- */

function setupKeyboard() {
  document.addEventListener('keydown', (ev) => {
    const toggle = ev.target.closest && ev.target.closest('.card-toggle');

    if (toggle && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault();
      const toggles = Array.from(document.querySelectorAll('.queue .card-toggle'));
      const i = toggles.indexOf(toggle);
      const next = toggles[(i + (ev.key === 'ArrowDown' ? 1 : -1) + toggles.length) % toggles.length];
      if (next) next.focus();
      return;
    }

    if (ev.key === 'Escape') {
      if (!document.getElementById('snackbar').hidden && document.activeElement === document.getElementById('snackbar-undo')) {
        hideSnack();
        const first = document.querySelector('#queue .card-toggle, #queue-h');
        if (first) first.focus();
        return;
      }
      if (state.expandedId) {
        const id = state.expandedId;
        state.expandedId = null;
        render();
        const t = document.querySelector('.card[data-id="' + id + '"] .card-toggle');
        if (t) t.focus();
        announce('Details closed.');
      }
      return;
    }

    if (toggle && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
      const card = toggle.closest('.card');
      const id = card && card.dataset.id;
      if (!id) return;
      const key = ev.key.toLowerCase();
      if (key === 'w') {
        ev.preventDefault();
        const plant = state.plants.find((p) => p.id === id);
        if (plant && plant.status !== 'done') completePlant(id);
      } else if (key === 's') {
        ev.preventDefault();
        snoozePlant(id);
      }
    }
  });

  // delegated clicks for action buttons
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    state.interacted = true;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'complete') completePlant(id);
    else if (btn.dataset.action === 'snooze') snoozePlant(id);
    else if (btn.dataset.action === 'restore') restorePlant(id);
  });
}

/* ---------- boot ---------- */

async function init() {
  // Render instantly from the embedded mirror so the screen is never blank,
  // then refresh from PLANTS.json when it is reachable (served over http).
  state.week = FALLBACK_DATA.week;
  state.plants = seedPlants(FALLBACK_DATA);
  renderDayline();
  render();
  setupKeyboard();

  const data = await loadData();
  if (data && !state.interacted && JSON.stringify(data.plants) !== JSON.stringify(FALLBACK_DATA.plants)) {
    state.week = Array.isArray(data.week) ? data.week : state.week;
    state.plants = seedPlants(data);
    render();
  }
}

init();
