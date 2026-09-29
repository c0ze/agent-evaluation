/* Moss — a gentle household plant-care companion.
 * Plain JavaScript, no dependencies, no network. The plant data below mirrors
 * PLANTS.json verbatim; it is embedded so the page also works from file://
 * (where fetch() of a local file is blocked) and never makes a request. */
(() => {
  'use strict';

  // ---------------------------------------------------------------- data ---
  const SOURCE = {
    plants: [
      { id: 'fern', name: 'Frida', species: 'Boston fern', location: 'Bathroom', task: 'Water', due: '2 days overdue', urgency: 4, light: 'Low, indirect', history: ['Sep 19 · Misted', 'Sep 16 · Watered', 'Sep 12 · New frond'] },
      { id: 'pothos', name: 'Orbit', species: 'Golden pothos', location: 'Bookshelf', task: 'Rotate', due: 'Today', urgency: 2, light: 'Medium, indirect', history: ['Sep 20 · Watered', 'Sep 14 · Rotated', 'Sep 10 · Wiped leaves'] },
      { id: 'cactus', name: 'Dot', species: 'Bunny ears cactus', location: 'South window', task: 'Check soil', due: 'Today', urgency: 1, light: 'Bright, direct', history: ['Sep 08 · Watered', 'Sep 01 · New pad noted', 'Aug 22 · Rotated'] },
      { id: 'calathea', name: 'Drama', species: 'Calathea orbifolia', location: 'Bedroom', task: 'Mist', due: 'Tomorrow', urgency: 0, light: 'Medium, filtered', history: ['Sep 21 · Misted', 'Sep 18 · Watered', 'Sep 15 · Brown edge noted'] }
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };

  // The history in the data runs up to Sep 21, so Moss's "today" is Tue Sep 22.
  const TODAY = new Date(2026, 8, 22);
  const DAY = 86400000;
  const STORE_KEY = 'moss.state.v1';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const TODAY_INDEX = (TODAY.getDay() + 6) % 7; // Monday-first index
  const UNDO_MS = 8000;

  const TASKS = {
    'Water':      { done: 'Watered',      log: 'Watered',      noun: 'a drink',     past: 'watered',      icon: 'drop' },
    'Rotate':     { done: 'Rotated',      log: 'Rotated',      noun: 'a turn',      past: 'rotated',      icon: 'turn' },
    'Check soil': { done: 'Soil checked', log: 'Checked soil', noun: 'a soil check', past: 'soil-checked', icon: 'finger' },
    'Mist':       { done: 'Misted',       log: 'Misted',       noun: 'a misting',   past: 'misted',       icon: 'mist' }
  };

  const CARE = {
    fern: {
      waterEvery: 4,
      water: 'Keep the soil lightly damp, never soggy. Bathroom steam helps.',
      lightTip: 'Happy away from the window. Direct sun crisps the fronds.',
      quirk: 'Sulks loudly when dry, forgives quickly.'
    },
    pothos: {
      waterEvery: 7,
      water: 'Water when the top 3 cm of soil is dry, about weekly.',
      lightTip: 'Turn it a quarter each week so it doesn’t lean toward the lamp.',
      quirk: 'Will climb anything, including the bookshelf.'
    },
    cactus: {
      waterEvery: 18,
      water: 'Only when the pot is dry all the way down. Probably every 2–3 weeks.',
      lightTip: 'Loves the south window. The more sun, the rounder the pads.',
      quirk: 'Looks soft. Is not. Mind the tiny prickles.'
    },
    calathea: {
      waterEvery: 7,
      water: 'Evenly moist, with filtered or rain water. Tap water browns the edges.',
      lightTip: 'Bright but filtered. A sheer curtain is perfect.',
      quirk: 'Folds its leaves up at night and makes a small rustle about it.'
    }
  };

  // --------------------------------------------------------- utilities ---
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const stamp = (d) => `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => new Date(d.getTime() + n * DAY);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 1000px)');

  function parseDue(due) {
    const m = /(\d+)\s+days?\s+overdue/i.exec(due);
    if (m) return -Number(m[1]);
    if (/tomorrow/i.test(due)) return 1;
    return 0;
  }

  function dueLabel(offset) {
    if (offset < 0) return `${plural(-offset, 'day')} overdue`;
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Tomorrow';
    return WEEKDAYS[addDays(TODAY, offset).getDay()];
  }

  function parseStamp(entry) {
    const m = /^([A-Z][a-z]{2})\s+(\d{1,2})/.exec(entry);
    if (!m) return null;
    const month = MONTHS.indexOf(m[1]);
    return month < 0 ? null : new Date(TODAY.getFullYear(), month, Number(m[2]));
  }

  function splitEntry(entry) {
    const i = entry.indexOf(' · ');
    return i < 0 ? { when: '', what: entry } : { when: entry.slice(0, i), what: entry.slice(i + 3) };
  }

  function lastWatered(p) {
    const entry = p.history.find((h) => /watered/i.test(splitEntry(h).what));
    if (!entry) return null;
    const date = parseStamp(entry);
    return date ? { date, ago: Math.round((TODAY - date) / DAY) } : null;
  }

  function lightLevel(light) {
    if (/bright/i.test(light)) return 3;
    if (/medium/i.test(light)) return 2;
    return 1;
  }

  // ------------------------------------------------------------- state ---
  function freshState() {
    return {
      plants: SOURCE.plants.map((p) => ({
        id: p.id, name: p.name, species: p.species, location: p.location,
        task: p.task, urgency: p.urgency, light: p.light,
        offset: parseDue(p.due), status: 'due', history: p.history.slice()
      })),
      selected: null
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return freshState();
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.plants) || saved.plants.length !== SOURCE.plants.length) return freshState();
      return { plants: saved.plants, selected: saved.selected || null };
    } catch (e) {
      return freshState();
    }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: fine */ }
  }

  let state = load();
  let undo = null;       // { snapshot, timer, remaining, started }
  let sheetOpener = null;
  let pendingCelebrate = null; // id of a plant just finished, for a small flourish

  const byId = (id) => state.plants.find((p) => p.id === id);
  const sortQueue = (a, b) => (a.offset - b.offset) || (b.urgency - a.urgency);

  function groups() {
    const due = state.plants.filter((p) => p.status === 'due').sort(sortQueue);
    return {
      overdue: due.filter((p) => p.offset < 0),
      today: due.filter((p) => p.offset === 0),
      later: due.filter((p) => p.offset > 0),
      snoozed: state.plants.filter((p) => p.status === 'snoozed').sort(sortQueue),
      done: state.plants.filter((p) => p.status === 'done')
    };
  }

  // The order a keyboard user meets the actionable rows in.
  function actionableOrder() {
    const g = groups();
    return [...g.overdue, ...g.today, ...g.later].map((p) => p.id);
  }

  const dueNowTotal = () => SOURCE.plants.filter((p) => parseDue(p.due) <= 0).length;

  // -------------------------------------------------------------- art ---
  function face(mood) {
    switch (mood) {
      case 'worried':
        return `<g class="face face--worried">
          <path class="face__line" d="M36.5 82.5 L45 85 M63.5 82.5 L55 85"/>
          <circle class="face__eye" cx="42" cy="89" r="2.6"/><circle class="face__eye" cx="58" cy="89" r="2.6"/>
          <path class="face__line" d="M46 98 Q50 95 54 98"/></g>`;
      case 'happy':
        return `<g class="face face--happy">
          <path class="face__line" d="M38.5 90 Q42 85.5 45.5 90 M54.5 90 Q58 85.5 61.5 90"/>
          <path class="face__line" d="M45 95.5 Q50 100 55 95.5"/>
          <circle class="face__cheek" cx="36" cy="95" r="3"/><circle class="face__cheek" cx="64" cy="95" r="3"/></g>`;
      case 'sleepy':
        return `<g class="face face--sleepy">
          <path class="face__line" d="M38.5 89 Q42 92 45.5 89 M54.5 89 Q58 92 61.5 89"/>
          <path class="face__line" d="M48 97 H52"/>
          <path class="face__z" d="M70 50 h6 l-6 7 h6 M80 40 h4 l-4 5 h4"/></g>`;
      default:
        return `<g class="face face--ok">
          <circle class="face__eye blink" cx="42" cy="89" r="2.6"/><circle class="face__eye blink" cx="58" cy="89" r="2.6"/>
          <path class="face__line" d="M47 97 Q50 98.5 53 97"/></g>`;
    }
  }

  function fern() {
    const fronds = [[-64, 0.72], [-42, 0.9], [-20, 1], [0, 1.05], [20, 0.98], [42, 0.88], [64, 0.7]];
    return `<g class="sway">${fronds.map(([a, s]) => {
      const tip = 66 - 50 * s;
      return `<g transform="rotate(${a} 50 66)">
        <path class="frond" d="M50 66 Q45 ${66 - 26 * s} 50 ${tip}"/>
        <path class="vein-dark" d="M50 66 Q45 ${66 - 26 * s} 50 ${tip}"/></g>`;
    }).join('')}</g>`;
  }

  function heart(x, y, r, s, variegated) {
    return `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">
      <path class="leaf" d="M0 0 C-8 -6 -10 -15 -4 -17 C-1.5 -18 0 -16 0 -14 C0 -16 1.5 -18 4 -17 C10 -15 8 -6 0 0Z"/>
      ${variegated ? '<path class="leaf-streak" d="M0 -2 Q-2 -8 -4 -13"/>' : ''}
      <path class="vein" d="M0 -1 V-13"/></g>`;
  }

  function pothos() {
    return `<g class="sway">
      <path class="vine" d="M33 67 Q18 78 20 106"/>
      <path class="vine" d="M67 67 Q86 76 82 100"/>
      <path class="vine" d="M50 66 Q46 44 52 26"/>
      ${heart(19, 104, 10, 0.8, true)}${heart(21, 86, -60, 0.85, false)}${heart(81, 99, -8, 0.75, false)}${heart(83, 80, 60, 0.85, true)}
      ${heart(50, 58, -150, 1.05, true)}${heart(56, 46, 140, 0.95, false)}${heart(47, 36, -160, 0.95, true)}${heart(53, 27, 175, 0.8, false)}
      ${heart(38, 64, -110, 0.9, false)}${heart(63, 63, 110, 0.9, true)}
    </g>`;
  }

  function cactus() {
    const dots = [[44, 40], [54, 36], [49, 50], [58, 48], [42, 55], [55, 58], [36, 22], [40, 16], [61, 22], [63, 29], [68, 44]];
    return `<g class="sway sway--stiff">
      <ellipse class="leaf" cx="50" cy="46" rx="16" ry="20.5"/>
      <ellipse class="leaf" cx="38" cy="22" rx="8" ry="11.5" transform="rotate(-22 38 22)"/>
      <ellipse class="leaf" cx="62" cy="25" rx="7.5" ry="10.5" transform="rotate(18 62 25)"/>
      <ellipse class="leaf leaf--new" cx="69" cy="45" rx="4.8" ry="6.5" transform="rotate(35 69 45)"/>
      ${dots.map(([x, y]) => `<circle class="glochid" cx="${x}" cy="${y}" r="1.3"/>`).join('')}
    </g>`;
  }

  function roundLeaf(x, y, r, s) {
    return `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">
      <ellipse class="leaf" rx="15" ry="12.5"/>
      <path class="stripe" d="M-11 -6 Q0 -2.5 11 -6 M-11 6 Q0 2.5 11 6 M-7 -10 Q0 -7.5 7 -10 M-7 10 Q0 7.5 7 10"/>
      <path class="vein" d="M-14 0 H14"/></g>`;
  }

  function calathea() {
    return `<g class="sway">
      <path class="stem" d="M47 66 L30 40 M50 66 L50 22 M53 66 L70 38 M50 66 L76 58 M50 66 L24 58"/>
      ${roundLeaf(24, 56, 20, 0.62)}${roundLeaf(76, 56, -18, 0.6)}${roundLeaf(29, 36, -35, 0.9)}${roundLeaf(71, 34, 32, 0.88)}${roundLeaf(50, 19, 90, 0.85)}
    </g>`;
  }

  const PLANT_ART = { fern, pothos, cactus, calathea };

  function moodFor(p) {
    if (p.status === 'done') return 'happy';
    if (p.status === 'snoozed') return 'sleepy';
    if (p.offset < 0) return 'worried';
    return 'ok';
  }

  function art(p, extraClass = '') {
    const draw = PLANT_ART[p.id] || fern;
    return `<svg class="plant ${extraClass}" viewBox="0 0 100 112" focusable="false" aria-hidden="true">
      <ellipse class="plant__shadow" cx="50" cy="109" rx="24" ry="3"/>
      ${draw()}
      <g class="pot">
        <path class="pot__body" d="M27 73 H73 L67.5 104 Q66.5 109 61.5 109 H38.5 Q33.5 109 32.5 104 Z"/>
        <rect class="pot__rim" x="22" y="64" width="56" height="11" rx="4.5"/>
        ${face(moodFor(p))}
      </g>
    </svg>`;
  }

  const ICONS = {
    drop: '<path d="M12 3c3 4.2 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.8 6-11z"/>',
    turn: '<path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    finger: '<path d="M4 17h16M8 17v-3m4 3v-6m4 6v-2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="6.5" r="2.5"/>',
    mist: '<circle cx="6" cy="8" r="1.8"/><circle cx="12" cy="5" r="1.8"/><circle cx="18" cy="8" r="1.8"/><circle cx="9" cy="13" r="1.8"/><circle cx="15" cy="13" r="1.8"/><circle cx="12" cy="19" r="1.8"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
    pin: '<path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2" fill="var(--paper)"/>'
  };
  const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="currentColor" focusable="false" aria-hidden="true">${ICONS[name]}</svg>`;

  // ------------------------------------------------------ queue render ---
  const queueBody = $('#queue-body');
  let firstPaint = true;

  function actionButtons(p, where) {
    const t = TASKS[p.task];
    const snoozeTo = dueLabel(Math.max(p.offset, 0) + 1).toLowerCase();
    return `<div class="actions">
      <button type="button" class="btn btn--primary" data-action="done" data-id="${p.id}" data-where="${where}">
        ${icon(t.icon)}<span>${t.done}</span><span class="sr-only">, ${esc(p.name)}</span>
      </button>
      <button type="button" class="btn btn--quiet" data-action="snooze" data-id="${p.id}" data-where="${where}">
        ${icon('moon')}<span>Snooze</span><span class="sr-only">, ${esc(p.name)}, until ${snoozeTo}</span>
      </button>
    </div>`;
  }

  function openButton(p, extra = '') {
    const selected = wide.matches && state.selected === p.id;
    return `<button type="button" class="plant-link" data-action="open" data-id="${p.id}"
      ${wide.matches ? 'aria-controls="pane"' : 'aria-haspopup="dialog"'} ${selected ? 'aria-current="true"' : ''}>
      <span class="plant-link__name">${esc(p.name)}</span>${extra}<span class="sr-only">, open details</span></button>`;
  }

  function rowOverdue(p) {
    const t = TASKS[p.task];
    return `<li class="task task--overdue" data-id="${p.id}">
      <div class="task__art">${art(p, 'plant--wobble')}</div>
      <div class="task__body">
        <p class="sticker"><span>${esc(dueLabel(p.offset))}</span></p>
        <h4 class="task__name">${openButton(p)}</h4>
        <p class="task__what"><strong>${esc(p.task)}</strong> <span aria-hidden="true">·</span> ${esc(p.species)} <span class="muted">in the ${esc(p.location.toLowerCase())}</span></p>
        <p class="task__why">${esc(p.name)} has been waiting for ${t.noun}. ${esc(CARE[p.id].quirk)}</p>
        ${actionButtons(p, 'row')}
      </div>
    </li>`;
  }

  function rowToday(p) {
    return `<li class="task task--today" data-id="${p.id}">
      <div class="task__art">${art(p)}</div>
      <div class="task__body">
        <h4 class="task__name">${openButton(p)}</h4>
        <p class="task__what"><span class="chip chip--${p.id}">${esc(p.task)}</span> ${esc(p.species)} <span aria-hidden="true">·</span> <span class="muted">${esc(p.location)}</span></p>
        ${actionButtons(p, 'row')}
      </div>
    </li>`;
  }

  function rowLater(p) {
    const snoozed = p.status === 'snoozed';
    const when = dueLabel(p.offset);
    return `<li class="task task--later ${snoozed ? 'is-snoozed' : ''}" data-id="${p.id}">
      <div class="task__art">${art(p)}</div>
      <div class="task__body">
        <h4 class="task__name">${openButton(p)}</h4>
        <p class="task__what">${esc(p.task)} <span aria-hidden="true">·</span> ${snoozed ? `<span class="muted">snoozed until</span> ${esc(when.toLowerCase())}` : `<span class="muted">due</span> ${esc(when.toLowerCase())}`}</p>
      </div>
      ${snoozed
        ? `<button type="button" class="btn btn--quiet btn--small" data-action="wake" data-id="${p.id}" data-where="row">${icon('sun')}<span>Do today</span><span class="sr-only">, ${esc(p.name)}</span></button>`
        : `<button type="button" class="btn btn--quiet btn--small" data-action="done" data-id="${p.id}" data-where="row">${icon(TASKS[p.task].icon)}<span>${TASKS[p.task].done} early</span><span class="sr-only">, ${esc(p.name)}</span></button>`}
    </li>`;
  }

  function shelf(done) {
    if (!done.length) return '';
    return `<section class="group group--done" aria-labelledby="g-done">
      <h3 class="group__title" id="g-done">Done today <span class="count">${done.length}</span></h3>
      <ul class="shelf" role="list">
        ${done.map((p) => `<li class="shelf__item">
          <div class="shelf__art">${art(p, 'plant--pop')}</div>
          ${openButton(p, `<span class="shelf__what">${icon('check')}${esc(TASKS[p.task].done)}</span>`)}
        </li>`).join('')}
      </ul>
    </section>`;
  }

  function nextWaterLine() {
    // A useful forward look: the next watering Moss expects for each plant.
    const upcoming = state.plants.map((p) => {
      const lw = lastWatered(p);
      const next = lw ? addDays(lw.date, CARE[p.id].waterEvery) : TODAY;
      return { p, next: next < addDays(TODAY, 1) ? addDays(TODAY, 1) : next };
    }).sort((a, b) => a.next - b.next);
    return upcoming.slice(0, 3);
  }

  function allDone(g) {
    const doneNames = g.done.map((p) => `${TASKS[p.task].past} ${p.name}`);
    const sentence = doneNames.length
      ? `You ${doneNames.length > 1 ? doneNames.slice(0, -1).join(', ') + ' and ' + doneNames.slice(-1) : doneNames[0]}.`
      : 'Nothing was pressing today.';
    const next = [...g.later, ...g.snoozed].sort(sortQueue)[0];
    const waters = nextWaterLine();
    return `<section class="alldone" aria-labelledby="alldone-title">
      <div class="alldone__art" aria-hidden="true">
        <div class="mossball mossball--big is-happy"><span class="mossball__eye"></span><span class="mossball__eye"></span><span class="mossball__sprout"></span></div>
        <span class="confetti"><i></i><i></i><i></i><i></i><i></i><i></i></span>
      </div>
      <h3 class="alldone__title" id="alldone-title" tabindex="-1">Everyone’s looked after.</h3>
      <p class="alldone__lead">${esc(sentence)}${g.snoozed.length ? ` ${plural(g.snoozed.length, 'plant')} snoozed until tomorrow.` : ''} Nothing else needs you today.</p>
      <dl class="alldone__facts">
        <div><dt>Next up</dt><dd>${next ? `${esc(next.name)} wants ${esc(TASKS[next.task].noun)} ${esc(dueLabel(next.offset).toLowerCase())}` : 'Nothing scheduled. Enjoy it.'}</dd></div>
        <div><dt>Water forecast</dt><dd><ul role="list">${waters.map(({ p, next: d }) => `<li><span>${esc(p.name)}</span> <span class="muted">around ${WEEKDAYS[d.getDay()].slice(0, 3)} ${stamp(d)}</span></li>`).join('')}</ul></dd></div>
      </dl>
      <p class="alldone__nudge">Maybe open a window. Drama likes the fresh air, and so do you.</p>
      <button type="button" class="btn btn--quiet btn--small" data-action="reset">Start the day over <span class="muted">(demo)</span></button>
    </section>`;
  }

  function renderQueue() {
    const g = groups();
    const nowCount = g.overdue.length + g.today.length;
    const later = [...g.later, ...g.snoozed].sort(sortQueue);
    let html = '';

    if (nowCount === 0) {
      html += allDone(g);
    } else {
      if (g.overdue.length) {
        html += `<section class="group group--overdue" aria-labelledby="g-overdue">
          <h3 class="group__title" id="g-overdue">${icon('drop')}Needs you first <span class="count">${g.overdue.length}</span></h3>
          <ol class="list" role="list">${g.overdue.map(rowOverdue).join('')}</ol></section>`;
      }
      if (g.today.length) {
        html += `<section class="group group--today" aria-labelledby="g-today">
          <h3 class="group__title" id="g-today">Also today <span class="count">${g.today.length}</span></h3>
          <ol class="list list--today" role="list">${g.today.map(rowToday).join('')}</ol></section>`;
      }
    }
    if (later.length) {
      html += `<section class="group group--later" aria-labelledby="g-later">
        <h3 class="group__title" id="g-later">Coming up <span class="count">${later.length}</span></h3>
        <ol class="list list--later" role="list">${later.map(rowLater).join('')}</ol></section>`;
    }
    html += shelf(g.done);
    queueBody.innerHTML = html;
    if (firstPaint) {
      queueBody.classList.add('first-paint');
      window.setTimeout(() => queueBody.classList.remove('first-paint'), 900);
      firstPaint = false;
    }

    $('#queue-sub').textContent = nowCount === 0
      ? 'All caught up for today.'
      : `${plural(nowCount, 'thing')} to do, most urgent first.`;
  }

  // ---------------------------------------------------- hello / rhythm ---
  function renderHello() {
    const g = groups();
    const total = dueNowTotal();
    const handled = total - g.overdue.length - g.today.length;
    const hour = new Date().getHours();
    $('#greeting').textContent = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
    $('#today-date').textContent = `${WEEKDAYS[TODAY.getDay()]}, ${MONTHS[TODAY.getMonth()]} ${TODAY.getDate()}`;

    let mood;
    const ball = $('#mossball');
    ball.classList.remove('is-happy', 'is-worried');
    if (g.overdue.length) {
      const p = g.overdue[0];
      mood = `${p.name} has been waiting ${plural(-p.offset, 'day')} for ${TASKS[p.task].noun}. Start there?`;
      ball.classList.add('is-worried');
    } else if (g.today.length) {
      mood = `${plural(g.today.length, 'small thing')} left. None of them are in a hurry.`;
    } else {
      mood = 'Everyone’s sorted. Go drink a glass of water yourself.';
      ball.classList.add('is-happy');
    }
    $('#mood').textContent = mood;

    const pct = Math.round((Math.max(0, Math.min(handled, total)) / total) * 100);
    $('#progress').innerHTML = `
      <div class="progress__track" aria-hidden="true"><span class="progress__fill" style="--p:${pct}%"></span>
        ${Array.from({ length: total }, (_, i) => `<i class="progress__seed ${i < handled ? 'is-on' : ''}"></i>`).join('')}</div>
      <p class="progress__label"><strong>${Math.min(handled, total)} of ${total}</strong> handled today${g.snoozed.length ? ` <span class="muted">(${g.snoozed.length} snoozed)</span>` : ''}</p>`;
  }

  function renderRhythm() {
    const week = SOURCE.week;
    const g = groups();
    const doneToday = g.done.length;
    const max = Math.max(4, ...week, week[TODAY_INDEX] + 0, doneToday);
    const busiest = week.indexOf(Math.max(...week));
    const days = week.map((n, i) => {
      const isToday = i === TODAY_INDEX;
      const count = isToday ? Math.max(n, doneToday) : n;
      const state = i < TODAY_INDEX ? 'past' : isToday ? 'today' : 'future';
      const leaves = Array.from({ length: count }, (_, k) => {
        const filled = state === 'past' || (isToday && k < doneToday);
        const fresh = isToday && pendingCelebrate && k === doneToday - 1 && !reduceMotion.matches;
        return `<i class="sprig ${filled ? 'is-filled' : ''} ${fresh ? 'is-new' : ''}"></i>`;
      }).join('');
      const sr = isToday
        ? `${WEEK[i]}, today: ${plural(count, 'care moment')}, ${doneToday} done`
        : `${WEEK[i]}: ${plural(n, 'care moment')}${state === 'past' ? ', done' : ''}`;
      return `<li class="day day--${state}">
        <span class="sr-only">${sr}</span>
        <span class="day__stack" aria-hidden="true" style="--max:${max};--n:${count}">${leaves}</span>
        <span class="day__label" aria-hidden="true">${WEEK[i].slice(0, 2)}</span>
      </li>`;
    }).join('');

    $('#rhythm').innerHTML = `
      <div class="rhythm__head">
        <h2 class="rhythm__title" id="rhythm-title">This week’s rhythm</h2>
        <p class="rhythm__sub">Care moments per day</p>
      </div>
      <ol class="rhythm__days" role="list">${days}</ol>
      <p class="rhythm__note">${WEEK[busiest]} is the busy one, with ${plural(week[busiest], 'thing')}. Weekends stay light.</p>`;
  }

  // ------------------------------------------------------------ detail ---
  const pane = $('#pane');
  const sheet = $('#sheet');
  const sheetBody = $('#sheet-body');

  function detailHTML(p, prefix) {
    const t = TASKS[p.task];
    const care = CARE[p.id];
    const level = lightLevel(p.light);
    const lw = lastWatered(p);
    const statusLine = p.status === 'done'
      ? `<span class="status status--done">${icon('check')}${esc(t.done)} today</span>`
      : p.status === 'snoozed'
        ? `<span class="status status--snoozed">${icon('moon')}Snoozed until ${esc(dueLabel(p.offset).toLowerCase())}</span>`
        : `<span class="status ${p.offset < 0 ? 'status--overdue' : ''}">${esc(p.task)} · ${esc(dueLabel(p.offset))}</span>`;

    return `
      <div class="detail" data-detail="${p.id}">
        <div class="detail__top">
          ${prefix === 'sheet' ? `<button type="button" class="icon-btn detail__close" data-action="close">${icon('close')}<span class="sr-only">Close ${esc(p.name)}'s details</span></button>` : ''}
          <div class="detail__art">${art(p)}</div>
          <div class="detail__id">
            <p class="detail__kicker">${esc(p.species)}</p>
            <h2 class="detail__name" id="${prefix}-name" tabindex="-1">${esc(p.name)}</h2>
            <p class="detail__where">${icon('pin')}${esc(p.location)}</p>
            ${statusLine}
          </div>
        </div>

        <p class="detail__quirk">“${esc(care.quirk)}”</p>

        ${p.status === 'due' ? `<div class="detail__task">${actionButtons(p, 'detail')}</div>` : ''}
        ${p.status === 'snoozed' ? `<div class="detail__task"><button type="button" class="btn btn--quiet" data-action="wake" data-id="${p.id}" data-where="detail">${icon('sun')}<span>Do it today instead</span></button></div>` : ''}

        <div class="facts">
          <section class="fact fact--light" aria-labelledby="${prefix}-light">
            <h3 class="fact__title" id="${prefix}-light">${icon('sun')}Light</h3>
            <p class="fact__value">${esc(p.light)}</p>
            <div class="meter" aria-hidden="true">${[1, 2, 3].map((n) => `<i class="${n <= level ? 'is-on' : ''}"></i>`).join('')}</div>
            <p class="fact__tip">${esc(care.lightTip)}</p>
          </section>
          <section class="fact fact--water" aria-labelledby="${prefix}-water">
            <h3 class="fact__title" id="${prefix}-water">${icon('drop')}Water</h3>
            <p class="fact__value">${lw ? (lw.ago === 0 ? 'Watered today' : `Last watered ${stamp(lw.date)}, ${plural(lw.ago, 'day')} ago`) : 'No watering logged yet'}</p>
            <p class="fact__tip">${esc(care.water)}</p>
            <button type="button" class="btn btn--water btn--small" data-action="water" data-id="${p.id}" data-where="detail" ${lw && lw.ago === 0 ? 'disabled' : ''}>
              ${icon('drop')}<span>${lw && lw.ago === 0 ? 'Watered today' : 'Log a watering'}</span></button>
          </section>
        </div>

        <section class="history" aria-labelledby="${prefix}-history">
          <h3 class="fact__title" id="${prefix}-history">Observations</h3>
          <ol class="timeline" role="list">
            ${p.history.map((h, i) => {
              const e = splitEntry(h);
              return `<li class="timeline__item ${i === 0 ? 'is-latest' : ''}"><span class="timeline__when">${esc(e.when)}</span><span class="timeline__what">${esc(e.what)}</span></li>`;
            }).join('')}
          </ol>
          <form class="note" data-form="note" data-id="${p.id}">
            <label class="note__label" for="${prefix}-note">Add an observation</label>
            <div class="note__row">
              <input class="note__input" id="${prefix}-note" name="note" type="text" maxlength="80" autocomplete="off" placeholder="e.g. new curl on the left">
              <button type="submit" class="btn btn--quiet btn--small">Add</button>
            </div>
          </form>
        </section>
      </div>`;
  }

  function currentSelection() {
    if (state.selected && byId(state.selected)) return state.selected;
    const order = actionableOrder();
    return order[0] || state.plants[0].id;
  }

  function renderPane() {
    if (!wide.matches) { pane.innerHTML = ''; return; }
    const p = byId(currentSelection());
    pane.innerHTML = `<div class="pane__card">${detailHTML(p, 'pane')}</div>`;
  }

  function renderSheet() {
    if (!sheet.open) return;
    const p = byId(currentSelection());
    sheetBody.innerHTML = detailHTML(p, 'sheet');
  }

  function openDetail(id, opener) {
    state.selected = id;
    save();
    if (wide.matches) {
      renderQueue();
      renderPane();
      const h = $('#pane-name');
      if (h) h.focus({ preventScroll: false });
    } else {
      sheetOpener = opener || null;
      sheetBody.innerHTML = detailHTML(byId(id), 'sheet');
      if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
      placeLayers();
      const h = $('#sheet-name');
      if (h) h.focus();
    }
  }

  function closeSheet() {
    if (sheet.open) {
      if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open');
    }
  }

  sheet.addEventListener('close', () => {
    placeLayers();
    const id = state.selected;
    const target = (sheetOpener && document.contains(sheetOpener)) ? sheetOpener
      : $(`.plant-link[data-id="${id}"]`) || $('#queue-title');
    sheetOpener = null;
    if (target) target.focus();
  });

  // Click on the backdrop closes the sheet.
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) closeSheet();
  });

  // ---------------------------------------------------------- render all ---
  function render() {
    renderHello();
    renderRhythm();
    renderQueue();
    renderPane();
    renderSheet();
    flushCelebrate();
  }

  // ---------------------------------------------------- actions + undo ---
  const toast = $('#toast');
  const announcer = $('#announcer');

  function announce(msg) {
    announcer.textContent = '';
    // Re-set on the next frame so repeated messages are still read.
    window.requestAnimationFrame(() => { announcer.textContent = msg; });
  }

  function commit(mutate, message) {
    const snapshot = JSON.stringify(state.plants);
    mutate();
    save();
    showUndo(snapshot, message);
  }

  // A modal sheet makes the rest of the page inert, so the toast and the
  // live region travel into whichever layer is currently interactive.
  function placeLayers() {
    const host = sheet.open ? sheet : document.body;
    if (toast.parentElement !== host) host.appendChild(toast);
    if (announcer.parentElement !== host) host.appendChild(announcer);
  }

  function showUndo(snapshot, message) {
    clearUndo();
    placeLayers();
    undo = { snapshot, remaining: UNDO_MS, started: Date.now(), timer: null };
    $('#toast-msg').textContent = message;
    toast.hidden = false;
    // restart the timer bar animation
    toast.classList.remove('is-running');
    void toast.offsetWidth;
    toast.classList.add('is-running');
    toast.style.setProperty('--undo-ms', `${UNDO_MS}ms`);
    undo.timer = window.setTimeout(hideUndo, UNDO_MS);
    announce(`${message} Press U or use the Undo button to undo.`);
  }

  function pauseUndo() {
    if (!undo || !undo.timer) return;
    window.clearTimeout(undo.timer);
    undo.timer = null;
    undo.remaining -= Date.now() - undo.started;
    toast.classList.add('is-paused');
  }

  function resumeUndo() {
    if (!undo || undo.timer) return;
    undo.started = Date.now();
    undo.timer = window.setTimeout(hideUndo, Math.max(1500, undo.remaining));
    toast.classList.remove('is-paused');
  }

  function clearUndo() {
    if (undo && undo.timer) window.clearTimeout(undo.timer);
    undo = null;
  }

  function hideUndo() {
    const hadFocus = toast.contains(document.activeElement);
    clearUndo();
    toast.hidden = true;
    toast.classList.remove('is-running', 'is-paused');
    if (hadFocus) $('#queue-title').focus();
  }

  function doUndo() {
    if (!undo) return;
    const restored = JSON.parse(undo.snapshot);
    const hadFocus = toast.contains(document.activeElement);
    state.plants = restored;
    save();
    hideUndo();
    render();
    announce('Undone. Back as it was.');
    if (hadFocus || document.activeElement === document.body) {
      const first = actionableOrder()[0];
      const btn = first && $(`.queue [data-action="done"][data-id="${first}"]`);
      (btn || $('#queue-title')).focus();
    }
  }

  toast.addEventListener('mouseenter', pauseUndo);
  toast.addEventListener('mouseleave', () => { if (!toast.contains(document.activeElement)) resumeUndo(); });
  toast.addEventListener('focusin', pauseUndo);
  toast.addEventListener('focusout', (e) => { if (!toast.contains(e.relatedTarget)) resumeUndo(); });

  function logEntry(p, text) {
    p.history.unshift(`${stamp(TODAY)} · ${text}`);
  }

  // After a row leaves the "now" list, keep the keyboard user in place:
  // focus moves to whatever now sits where the finished row was.
  function focusAfterRowAction(prevOrder, id) {
    const idx = prevOrder.indexOf(id);
    const order = actionableOrder();
    const g = groups();
    if (g.overdue.length + g.today.length === 0) {
      const t = $('#alldone-title');
      if (t) { t.focus(); return; }
    }
    const nextId = order[Math.min(Math.max(idx, 0), order.length - 1)];
    const btn = nextId && ($(`.queue [data-action="done"][data-id="${nextId}"]`) || $(`.queue .plant-link[data-id="${nextId}"]`));
    (btn || $('#queue-title')).focus();
  }

  function focusAfterDetailAction() {
    const h = sheet.open ? $('#sheet-name') : $('#pane-name');
    if (h) h.focus();
  }

  function act(action, id, where, trigger) {
    const p = id ? byId(id) : null;
    const prevOrder = actionableOrder();
    switch (action) {
      case 'open':
        openDetail(id, trigger);
        return;
      case 'close':
        closeSheet();
        return;
      case 'undo':
        doUndo();
        return;
      case 'reset':
        clearUndo();
        toast.hidden = true;
        state = freshState();
        save();
        render();
        announce('Fresh start. Today’s care is back in the queue.');
        $('#queue-title').focus();
        return;
      case 'done': {
        const t = TASKS[p.task];
        commit(() => {
          p.status = 'done';
          logEntry(p, t.log);
          celebrate(p.id);
        }, `${p.name}: ${t.done.toLowerCase()}.`);
        break;
      }
      case 'snooze': {
        const to = Math.max(p.offset, 0) + 1;
        commit(() => {
          p.status = 'snoozed';
          p.offset = to;
        }, `${p.name} snoozed until ${dueLabel(to).toLowerCase()}.`);
        break;
      }
      case 'wake':
        commit(() => {
          p.status = 'due';
          p.offset = 0;
        }, `${p.name} is back on today’s list.`);
        break;
      case 'water': {
        commit(() => {
          logEntry(p, 'Watered');
          if (p.task === 'Water' && p.status !== 'done') p.status = 'done';
        }, `${p.name} watered.`);
        break;
      }
      default:
        return;
    }
    render();
    if (where === 'detail') focusAfterDetailAction();
    else focusAfterRowAction(prevOrder, id);
  }

  function addNote(form) {
    const id = form.dataset.id;
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) {
      input.setAttribute('aria-invalid', 'true');
      announce('Type a short note first.');
      input.focus();
      return;
    }
    const p = byId(id);
    commit(() => logEntry(p, text.charAt(0).toUpperCase() + text.slice(1)), `Noted for ${p.name}.`);
    render();
    const again = document.getElementById(`${sheet.open ? 'sheet' : 'pane'}-note`);
    if (again) again.focus();
  }

  // Little moment of delight: a sprout pops out of the finished plant.
  function celebrate(id) { pendingCelebrate = id; }
  function flushCelebrate() {
    if (!pendingCelebrate || reduceMotion.matches) { pendingCelebrate = null; return; }
    document.querySelectorAll(`.shelf__item .plant-link[data-id="${pendingCelebrate}"]`).forEach((el) => {
      el.closest('.shelf__item').classList.add('is-fresh');
    });
    const ball = $('#mossball');
    ball.classList.remove('is-bouncing');
    void ball.offsetWidth;
    ball.classList.add('is-bouncing');
    pendingCelebrate = null;
  }

  // ------------------------------------------------------------ events ---
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    act(el.dataset.action, el.dataset.id, el.dataset.where, el);
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form="note"]');
    if (!form) return;
    e.preventDefault();
    addNote(form);
  });

  document.addEventListener('input', (e) => {
    if (e.target.matches('.note__input')) e.target.removeAttribute('aria-invalid');
  });

  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (typing) return;
    const key = e.key.toLowerCase();
    if (undo && ((key === 'u' && !e.metaKey && !e.ctrlKey && !e.altKey) || (key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey))) {
      e.preventDefault();
      doUndo();
    }
  });

  function onWideChange() {
    if (wide.matches && sheet.open) {
      sheetOpener = null;
      closeSheet();
    }
    render();
  }
  if (wide.addEventListener) wide.addEventListener('change', onWideChange);
  else if (wide.addListener) wide.addListener(onWideChange);

  render();
})();
