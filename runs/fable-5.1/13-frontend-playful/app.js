/* Moss — a gentle plant-care companion.
   Plain JavaScript, no dependencies, no network. */
'use strict';

(function () {
  // ---------------------------------------------------------------------------
  // Data. This is a verbatim copy of PLANTS.json: the page is meant to open
  // straight from disk, and fetch() of a local file is blocked in most browsers.
  // ---------------------------------------------------------------------------
  const DATA = {
    plants: [
      { id: 'fern', name: 'Frida', species: 'Boston fern', location: 'Bathroom', task: 'Water', due: '2 days overdue', urgency: 4, light: 'Low, indirect', history: ['Sep 19 · Misted', 'Sep 16 · Watered', 'Sep 12 · New frond'] },
      { id: 'pothos', name: 'Orbit', species: 'Golden pothos', location: 'Bookshelf', task: 'Rotate', due: 'Today', urgency: 2, light: 'Medium, indirect', history: ['Sep 20 · Watered', 'Sep 14 · Rotated', 'Sep 10 · Wiped leaves'] },
      { id: 'cactus', name: 'Dot', species: 'Bunny ears cactus', location: 'South window', task: 'Check soil', due: 'Today', urgency: 1, light: 'Bright, direct', history: ['Sep 08 · Watered', 'Sep 01 · New pad noted', 'Aug 22 · Rotated'] },
      { id: 'calathea', name: 'Drama', species: 'Calathea orbifolia', location: 'Bedroom', task: 'Mist', due: 'Tomorrow', urgency: 0, light: 'Medium, filtered', history: ['Sep 21 · Misted', 'Sep 18 · Watered', 'Sep 15 · Brown edge noted'] }
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };

  // Per-plant character. Not in the data file, but it is what makes them feel like housemates.
  const EXTRA = {
    fern:     { quirk: 'Wilts theatrically. Forgives instantly.',            cadence: 'Every 3–4 days · keep evenly moist',          lightLevel: 1, blob: 'a', tint: 'clay',  flourish: 'She is already perking up.' },
    pothos:   { quirk: 'Leans toward the window like it is eavesdropping.',  cadence: 'Every 7–10 days · let the top inch dry',      lightLevel: 2, blob: 'b', tint: 'sun',   flourish: 'Now facing a fresh wall.' },
    cactus:   { quirk: 'Wants nothing. Will accept a compliment.',           cadence: 'Every 3–4 weeks · bone dry in between',       lightLevel: 3, blob: 'c', tint: 'petal', flourish: 'Dot noticed, in her way.' },
    calathea: { quirk: 'Folds her leaves at night. Yes, on purpose.',        cadence: 'Every 5–7 days · filtered water, never soggy', lightLevel: 2, blob: 'd', tint: 'water', flourish: 'Drama, appeased for now.' }
  };

  const TASKS = {
    'Water':      { past: 'Watered', icon: 'drop' },
    'Rotate':     { past: 'Rotated', icon: 'rotate' },
    'Check soil': { past: 'Checked', icon: 'soil' },
    'Mist':       { past: 'Misted',  icon: 'mist' }
  };

  // ---------------------------------------------------------------------------
  // Inline SVG. Small icons are 16×16; plant portraits are 96×96.
  // ---------------------------------------------------------------------------
  const svg = (inner, vb = '0 0 16 16') =>
    `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${inner}</svg>`;

  const ICONS = {
    drop:   svg('<path d="M8 1.5C8 1.5 3 7 3 10.2a5 5 0 0 0 10 0C13 7 8 1.5 8 1.5Z" fill="currentColor"/>'),
    rotate: svg('<path d="M13 8A5 5 0 1 1 8 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7.6.8 11.2 3 7.6 5.2Z" fill="currentColor"/>'),
    soil:   svg('<path d="M2 13.2h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 12.5V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 7.2C8.2 4 6.2 2.4 3.2 2.4 3 5.6 5 7.6 8 7.2Z" fill="currentColor"/><path d="M8 9.4c0-2.4 1.6-3.6 4-3.6 0 2.5-1.6 3.8-4 3.6Z" fill="currentColor"/>'),
    mist:   svg('<g fill="currentColor"><circle cx="3.5" cy="5" r="1.7"/><circle cx="8.5" cy="3" r="1.7"/><circle cx="12.5" cy="7" r="1.7"/><circle cx="6" cy="10" r="1.7"/><circle cx="11" cy="12.5" r="1.7"/></g>'),
    leaf:   svg('<path d="M13.5 2.5C7 2.5 2.5 7 2.5 13.5 9 13.5 13.5 9 13.5 2.5Z" fill="currentColor"/><path d="M3.5 12.5 11 5" stroke="var(--paper)" stroke-width="1.4" stroke-linecap="round"/>'),
    note:   svg('<path d="M8 2v12M2 8h12M3.8 3.8l8.4 8.4M12.2 3.8l-8.4 8.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    check:  svg('<path d="M3 8.6 6.4 12 13 4.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
    sun:    svg('<circle cx="8" cy="8" r="3.2" fill="currentColor"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3"/></g>'),
    moon:   svg('<path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7Z" fill="currentColor"/>'),
    back:   svg('<path d="M6.5 3.5 2.5 8l4 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 8h7.5a3 3 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    chev:   svg('<path d="M4 6.2 8 10l4-3.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
    close:  svg('<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>')
  };

  const FROND = (d) =>
    `<path d="${d}" stroke="var(--moss)" stroke-width="9" stroke-dasharray="1.8 3.2" stroke-linecap="butt" fill="none"/>` +
    `<path d="${d}" stroke="var(--moss-deep)" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
  const HEART = 'M0-6C-6-12-14-4-8 3L0 10 8 3C14-4 6-12 0-6Z';
  const STRIPES = '<g fill="none" stroke="var(--moss-soft)" stroke-width="1.6" stroke-linecap="round"><path d="M-7-6Q0-9 7-6"/><path d="M-9 0Q0-3 9 0"/><path d="M-7 6Q0 3 7 6"/></g>';

  const PLANT_ART = {
    fern: svg(
      FROND('M48 62C46 46 34 34 14 30') + FROND('M48 62C50 44 62 32 82 30') +
      FROND('M48 62C44 44 36 24 24 10') + FROND('M48 62C52 44 60 24 72 10') +
      FROND('M48 62C48 44 48 26 48 6') +
      '<path d="M30 60h36l-4 28H34Z" fill="var(--clay)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>' +
      '<rect x="26" y="54" width="44" height="9" rx="3" fill="var(--clay-deep)" stroke="var(--ink)" stroke-width="2"/>',
      '0 0 96 96'),
    pothos: svg(
      '<rect x="4" y="57" width="88" height="5" rx="2.5" fill="var(--ink)"/>' +
      '<path d="M32 30h32v22a6 6 0 0 1-6 6H38a6 6 0 0 1-6-6Z" fill="var(--sun)" stroke="var(--ink)" stroke-width="2"/>' +
      '<rect x="29" y="25" width="38" height="8" rx="3" fill="var(--sun-ink)" stroke="var(--ink)" stroke-width="2"/>' +
      '<g fill="none" stroke="var(--moss-deep)" stroke-width="2" stroke-linecap="round"><path d="M36 30C30 44 20 60 26 90"/><path d="M60 30C64 46 76 60 70 88"/><path d="M48 26c0-8-4-12-8-14"/></g>' +
      '<g fill="var(--moss)" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round">' +
      `<path d="${HEART}" transform="translate(30 46) rotate(-24)"/>` +
      `<path d="${HEART}" transform="translate(24 70) rotate(14) scale(.9)"/>` +
      `<path d="${HEART}" transform="translate(67 50) rotate(26)"/>` +
      `<path d="${HEART}" transform="translate(72 74) rotate(-8) scale(.85)"/>` +
      `<path d="${HEART}" transform="translate(40 14) rotate(-34) scale(.7)"/>` +
      '</g>' +
      '<g fill="var(--sun-soft)"><ellipse cx="27" cy="46" rx="3.2" ry="2" transform="rotate(-24 27 46)"/><ellipse cx="69" cy="52" rx="3.2" ry="2" transform="rotate(26 69 52)"/><ellipse cx="22" cy="70" rx="2.4" ry="1.6"/></g>',
      '0 0 96 96'),
    cactus: svg(
      '<g fill="var(--moss)" stroke="var(--ink)" stroke-width="2">' +
      '<ellipse cx="33" cy="36" rx="9" ry="13" transform="rotate(-22 33 36)"/>' +
      '<ellipse cx="63" cy="36" rx="9" ry="13" transform="rotate(22 63 36)"/>' +
      '<ellipse cx="48" cy="52" rx="16" ry="19"/></g>' +
      '<g fill="var(--paper)"><circle cx="42" cy="44" r="1.7"/><circle cx="50" cy="41" r="1.7"/><circle cx="57" cy="48" r="1.7"/><circle cx="44" cy="54" r="1.7"/><circle cx="52" cy="57" r="1.7"/><circle cx="40" cy="63" r="1.7"/><circle cx="55" cy="65" r="1.7"/><circle cx="48" cy="48" r="1.7"/><circle cx="31" cy="30" r="1.5"/><circle cx="35" cy="39" r="1.5"/><circle cx="29" cy="42" r="1.5"/><circle cx="65" cy="30" r="1.5"/><circle cx="61" cy="39" r="1.5"/><circle cx="67" cy="42" r="1.5"/></g>' +
      '<g transform="translate(66 22)"><circle r="5.5" fill="var(--petal)" stroke="var(--ink)" stroke-width="1.6"/><circle r="2" fill="var(--sun)"/></g>' +
      '<path d="M28 66h40l-5 22H33Z" fill="var(--petal)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>' +
      '<rect x="24" y="60" width="48" height="9" rx="4" fill="var(--petal-ink)" stroke="var(--ink)" stroke-width="2"/>',
      '0 0 96 96'),
    calathea: svg(
      '<g fill="none" stroke="var(--moss-deep)" stroke-width="2.2" stroke-linecap="round"><path d="M48 62C46 50 38 42 30 36"/><path d="M48 62C50 50 58 40 66 34"/><path d="M48 62C48 48 48 36 48 26"/></g>' +
      '<g stroke="var(--ink)" stroke-width="1.8">' +
      `<g transform="translate(48 22)"><ellipse rx="11" ry="14" fill="var(--moss)"/>${STRIPES}</g>` +
      `<g transform="translate(28 36) rotate(-22)"><ellipse rx="12" ry="15" fill="var(--moss)"/>${STRIPES}</g>` +
      `<g transform="translate(68 34) rotate(22)"><ellipse rx="12" ry="15" fill="var(--moss)"/>${STRIPES}<path d="M9 8Q12.4 1 11-7" fill="none" stroke="var(--clay)" stroke-width="2.2" stroke-linecap="round"/></g>` +
      '</g>' +
      '<rect x="34" y="60" width="28" height="30" rx="5" fill="var(--water)" stroke="var(--ink)" stroke-width="2"/>' +
      '<rect x="31" y="56" width="34" height="8" rx="3" fill="var(--water-ink)" stroke="var(--ink)" stroke-width="2"/>',
      '0 0 96 96')
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const TOAST_MS = 6000;
  const mqDesktop = window.matchMedia('(min-width: 960px)');
  const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  let state = {
    plants: DATA.plants.map((p) => ({ ...p, history: [...p.history], status: 'pending' })),
    selectedId: null,
    undo: null
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  let panelEl = null; // the single detail panel; it moves between the sidebar and a row

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v; // only ever app-authored SVG strings
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (name, cls = 'ico') => el('span', { class: cls, html: ICONS[name], 'aria-hidden': 'true' });

  const plantById = (id) => state.plants.find((p) => p.id === id);
  const byUrgency = (a, b) => b.urgency - a.urgency;

  function bucketOf(p) {
    const m = /(\d+)\s+days?\s+overdue/i.exec(p.due);
    if (m) return { key: 'overdue', daysAgo: Number(m[1]) };
    if (/today/i.test(p.due)) return { key: 'today', daysAgo: 0 };
    return { key: 'later', daysAgo: -1 };
  }
  const pendingIn = (key) => state.plants.filter((p) => p.status === 'pending' && bucketOf(p).key === key).sort(byUrgency);
  const upcoming = () => [
    ...state.plants.filter((p) => p.status === 'pending' && bucketOf(p).key === 'later').sort(byUrgency),
    ...state.plants.filter((p) => p.status === 'snoozed').sort(byUrgency)
  ];
  const doneToday = () => state.plants.filter((p) => p.status === 'done').sort(byUrgency);
  const queueOrder = () => [...pendingIn('overdue'), ...pendingIn('today'), ...upcoming(), ...doneToday()];
  const allDone = () => pendingIn('overdue').length === 0 && pendingIn('today').length === 0;

  function kindOf(entry) {
    const t = entry.toLowerCase();
    if (/watered|misted/.test(t)) return 'water';
    if (/rotated|wiped|checked/.test(t)) return 'care';
    return 'note';
  }
  const splitEntry = (entry) => {
    const i = entry.indexOf(' · ');
    return i === -1 ? { date: '', what: entry } : { date: entry.slice(0, i), what: entry.slice(i + 3) };
  };
  const lastWatered = (p) => {
    const hit = p.history.find((h) => /watered/i.test(h));
    return hit ? splitEntry(hit).date : 'not on record';
  };
  const NUM = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
  const numberWord = (n) => NUM[n] || String(n);
  const joinNames = (list) => {
    const names = list.map((p) => p.name);
    if (names.length <= 1) return names.join('');
    return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  };

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------
  function renderHeader() {
    const weekday = new Date().toLocaleDateString(undefined, { weekday: 'long' });
    const overdue = pendingIn('overdue');
    const today = pendingIn('today');
    const greeting = $('#greeting');
    const lede = $('#lede');

    if (overdue.length) {
      const p = overdue[0];
      greeting.textContent = `${weekday}. ${p.name} has been waiting.`;
      lede.textContent = `${p.name} the ${p.species.toLowerCase()} missed a ${p.task.toLowerCase()} ${bucketOf(p).daysAgo} days ago. Start there; the rest can hold on a minute.`;
    } else if (today.length) {
      greeting.textContent = `${weekday}. ${today.length === 1 ? 'One small thing' : numberWord(today.length) + ' small things'} today.`;
      lede.textContent = `Nothing is overdue. ${joinNames(today)} ${today.length === 1 ? 'needs' : 'need'} a moment each.`;
    } else {
      greeting.textContent = `${weekday}. Everyone is fine.`;
      lede.textContent = 'Nothing needs you until tomorrow. Go drink some water yourself.';
    }

    const stickers = $('#stickers');
    stickers.replaceChildren();
    const add = (n, label, tone) => {
      if (!n) return;
      stickers.append(el('li', { class: `sticker sticker--${tone}` }, el('strong', {}, String(n)), ' ', label));
    };
    add(overdue.length, 'overdue', 'clay');
    add(today.length, 'today', 'sun');
    add(pendingIn('later').length, 'tomorrow', 'paper');
    add(state.plants.filter((p) => p.status === 'snoozed').length, 'snoozed', 'paper');
    add(doneToday().length, 'done', 'moss');

    $('#mascot').classList.toggle('is-asleep', allDone());
  }

  // ---------------------------------------------------------------------------
  // Queue rows
  // ---------------------------------------------------------------------------
  function dueTag(p, tier) {
    const b = bucketOf(p);
    if (tier === 'done') return el('span', { class: 'tag tag--done' }, icon('check'), 'Done today');
    if (p.status === 'snoozed') return el('span', { class: 'tag tag--snoozed' }, icon('moon'), b.key === 'overdue' ? `Snoozed · was ${p.due.toLowerCase()}` : 'Snoozed · back tomorrow');
    if (b.key === 'overdue') return el('span', { class: 'tag tag--overdue' }, p.due);
    if (b.key === 'today') return el('span', { class: 'tag tag--today' }, 'Today');
    return el('span', { class: 'tag tag--later' }, p.due);
  }

  function buildRow(p, tier) {
    const task = TASKS[p.task];
    const x = EXTRA[p.id];
    const selected = state.selectedId === p.id;
    const li = el('li', { class: `row row--${tier}${selected ? ' is-selected' : ''}`, id: `row-${p.id}`, dataset: { id: p.id } });

    const open = el('button', {
      class: 'row__open', type: 'button', id: `open-${p.id}`,
      'aria-expanded': String(selected), 'aria-controls': 'detail',
      onclick: () => toggleDetail(p.id)
    },
      el('span', { class: `avatar avatar--${x.blob} tint-${x.tint}`, html: PLANT_ART[p.id], 'aria-hidden': 'true' }),
      el('span', { class: 'row__names' },
        el('span', { class: 'row__name' }, p.name, el('span', { class: 'chev', html: ICONS.chev, 'aria-hidden': 'true' })),
        el('span', { class: 'row__sub' }, `${p.species} · ${p.location}`)),
      el('span', { class: 'sr-only' }, ', details'));

    const tags = el('p', { class: 'row__tags' },
      el('span', { class: 'tag tag--task' }, icon(task.icon), p.task),
      dueTag(p, tier));

    const actions = el('div', { class: 'row__actions' });
    if (tier === 'overdue' || tier === 'today') {
      actions.append(
        el('button', { class: 'btn btn--primary', type: 'button', 'aria-label': `${task.past}: ${p.name}`, onclick: () => performAction('done', p.id) }, icon('check'), task.past),
        el('button', { class: 'btn', type: 'button', 'aria-label': `Snooze ${p.name} until tomorrow`, onclick: () => performAction('snooze', p.id) }, icon('moon'), 'Snooze'));
    } else if (tier === 'upcoming' && p.status === 'snoozed') {
      actions.append(el('button', { class: 'btn btn--quiet', type: 'button', 'aria-label': `Bring ${p.name} back to today`, onclick: () => performAction('unsnooze', p.id) }, icon('back'), 'Bring back'));
    } else if (tier === 'upcoming') {
      actions.append(el('button', { class: 'btn btn--quiet', type: 'button', 'aria-label': `Do it early: ${p.task.toLowerCase()} ${p.name} now`, onclick: () => performAction('done', p.id) }, icon(task.icon), 'Do it early'));
    }

    li.append(el('div', { class: 'row__head' }, open, tags), actions);
    return li;
  }

  function fillList(id, plants, tier) {
    const list = $(`#list-${id}`);
    const section = $(`#sec-${id}`);
    list.replaceChildren(...plants.map((p) => buildRow(p, tier)));
    section.hidden = plants.length === 0;
  }

  function renderLists() {
    fillList('overdue', pendingIn('overdue'), 'overdue');
    fillList('today', pendingIn('today'), 'today');
    fillList('upcoming', upcoming(), 'upcoming');
    fillList('done', doneToday(), 'done');
  }

  // ---------------------------------------------------------------------------
  // All-done state
  // ---------------------------------------------------------------------------
  function renderAllDone() {
    const box = $('#alldone');
    const done = allDone();
    box.hidden = !done;
    if (!done) return;

    const later = pendingIn('later');
    const snoozed = state.plants.filter((p) => p.status === 'snoozed');
    const tended = doneToday();

    const shelf = el('div', { class: 'shelf', 'aria-hidden': 'true' },
      ...state.plants.map((p) => el('span', { class: `shelf__plant${p.status === 'snoozed' ? ' is-resting' : ''}`, html: PLANT_ART[p.id] })));

    const next = el('dl', { class: 'next' });
    const addNext = (term, desc) => next.append(el('div', { class: 'next__item' }, el('dt', {}, term), el('dd', {}, desc)));
    if (later.length) addNext('Tomorrow', later.map((p) => `${p.name} · ${p.task.toLowerCase()}`).join(', '));
    if (snoozed.length) addNext('Snoozed', `${joinNames(snoozed)} ${snoozed.length === 1 ? 'comes' : 'come'} back tomorrow. Listed under Coming up if you change your mind.`);
    if (tended.length) addNext('Tended today', joinNames(tended));

    // A small idle suggestion: the plant whose leaves were wiped longest ago.
    const wipeAge = (p) => {
      const hit = p.history.find((h) => /wiped/i.test(h));
      return hit ? splitEntry(hit).date : null;
    };
    const wipedToday = state.plants.some((p) => p.history.some((h) => /^Today · Wiped/i.test(h)));
    const tipPlant = plantById('pothos');
    const tip = wipedToday
      ? el('p', { class: 'tip', id: 'tip' }, icon('leaf'), el('span', {}, 'Leaves wiped. There is genuinely nothing left to do. Sit down.'))
      : el('p', { class: 'tip', id: 'tip' }, icon('leaf'),
        el('span', {}, `Idle hands? ${tipPlant.name}'s leaves were last wiped on ${wipeAge(tipPlant) || 'a date lost to history'}. `,
          el('button', { class: 'linkbtn', type: 'button', onclick: () => performAction('wipe', tipPlant.id) }, 'Log a leaf wipe')));

    box.replaceChildren(
      shelf,
      el('h2', { class: 'alldone__title', id: 'alldone-title', tabindex: '-1' }, tended.length === state.plants.length ? 'Everyone, tended.' : 'All tended for today.'),
      el('p', { class: 'alldone__lede' }, tended.length ? `${numberWord(tended.length)} ${tended.length === 1 ? 'plant' : 'plants'} looked after. The house is quietly photosynthesising.` : 'Nothing on the list. The house is quietly photosynthesising.'),
      next,
      tip);
  }

  // ---------------------------------------------------------------------------
  // Detail panel. One panel; it lives in the sidebar on desktop and slides
  // inline under the selected row on narrow screens.
  // ---------------------------------------------------------------------------
  // Desktop always shows a plant in the sidebar; narrow screens start collapsed.
  function resolveSelection() {
    if (state.selectedId && !plantById(state.selectedId)) state.selectedId = null;
    if (mqDesktop.matches && !state.selectedId) state.selectedId = (queueOrder()[0] || {}).id || null;
  }

  function placePanel() {
    const panel = panelEl;
    const slot = $('#detail-slot');
    if (mqDesktop.matches) {
      slot.append(panel);
      panel.hidden = !state.selectedId;
      return;
    }
    const li = state.selectedId ? $(`#row-${state.selectedId}`) : null;
    if (li) { li.append(panel); panel.hidden = false; }
    else { slot.append(panel); panel.hidden = true; }
  }

  function lightMeter(level) {
    const m = el('span', { class: 'meter', 'aria-hidden': 'true' });
    for (let i = 1; i <= 3; i++) m.append(el('i', { class: i <= level ? 'is-on' : '' }));
    return m;
  }

  function logBlock(title, entries, empty) {
    const list = el('ol', { class: 'log' });
    if (!entries.length) list.append(el('li', { class: 'log__empty' }, empty));
    for (const h of entries) {
      const { date, what } = splitEntry(h);
      const kind = kindOf(h);
      list.append(el('li', { class: `log__item log__item--${kind}` },
        el('span', { class: 'log__date' }, date),
        el('span', { class: 'log__what' }, icon(kind === 'water' ? (/misted/i.test(what) ? 'mist' : 'drop') : kind === 'care' ? 'leaf' : 'note'), what)));
    }
    return el('section', { class: 'logblock' }, el('h3', { class: 'logblock__title' }, title), list);
  }

  function renderPanel() {
    const panel = panelEl;
    const p = state.selectedId && plantById(state.selectedId);
    if (!p) { panel.replaceChildren(); return; }
    const x = EXTRA[p.id];
    const b = bucketOf(p);
    const task = TASKS[p.task];

    let nextText, nextSub;
    if (p.status === 'done') { nextText = `${task.past} today`; nextSub = 'Nothing else until the next round.'; }
    else if (p.status === 'snoozed') { nextText = `${p.task} · resting`; nextSub = 'Snoozed. Back in the queue tomorrow.'; }
    else if (b.key === 'overdue') { nextText = `${p.task} · ${p.due.toLowerCase()}`; nextSub = 'Top of the queue.'; }
    else if (b.key === 'today') { nextText = `${p.task} · today`; nextSub = 'Whenever you pass by.'; }
    else { nextText = `${p.task} · ${p.due.toLowerCase()}`; nextSub = 'No rush.'; }

    const fact = (term, ico, main, sub, extra) => el('div', { class: 'fact' },
      el('dt', {}, icon(ico), term),
      el('dd', {}, el('span', { class: 'fact__main' }, main, extra), el('span', { class: 'fact__sub' }, sub)));

    const water = p.history.filter((h) => kindOf(h) !== 'note');
    const notes = p.history.filter((h) => kindOf(h) === 'note');

    const actions = el('div', { class: 'detail__actions' });
    actions.append(el('button', { class: 'btn btn--primary', type: 'button', id: 'detail-water', 'aria-label': `Log a drink for ${p.name}`, onclick: () => performAction('water', p.id) }, icon('drop'), 'Log a drink'));
    if (p.status === 'pending' && b.key !== 'later') {
      actions.append(el('button', { class: 'btn', type: 'button', id: 'detail-snooze', 'aria-label': `Snooze ${p.name} until tomorrow`, onclick: () => performAction('snooze', p.id) }, icon('moon'), 'Snooze'));
    } else if (p.status === 'snoozed') {
      actions.append(el('button', { class: 'btn', type: 'button', id: 'detail-unsnooze', 'aria-label': `Bring ${p.name} back to today`, onclick: () => performAction('unsnooze', p.id) }, icon('back'), 'Bring back'));
    }

    panel.replaceChildren(
      el('div', { class: 'detail__head' },
        el('span', { class: `avatar avatar--lg avatar--${x.blob} tint-${x.tint}`, html: PLANT_ART[p.id], 'aria-hidden': 'true' }),
        el('div', { class: 'detail__titles' },
          el('h2', { class: 'detail__name', id: 'detail-title' }, p.name),
          el('p', { class: 'detail__sub' }, `${p.species} · ${p.location}`),
          el('p', { class: 'detail__quirk' }, x.quirk)),
        el('button', { class: 'iconbtn detail__close', type: 'button', 'aria-label': `Close ${p.name}'s details`, html: ICONS.close, onclick: closeDetail })),
      el('dl', { class: 'facts' },
        fact('Light', 'sun', p.light, x.lightLevel === 3 ? 'Loves a sunny sill.' : x.lightLevel === 2 ? 'Bright room, no direct beam.' : 'Happy in the dim corners.', lightMeter(x.lightLevel)),
        fact('Water', 'drop', `Last drink ${lastWatered(p)}`, x.cadence),
        fact('Up next', task.icon, nextText, nextSub)),
      el('div', { class: 'detail__logs' },
        logBlock('Water & care', water, 'No care logged yet.'),
        logBlock('Observations', notes, 'Nothing noted yet. Look closely.')),
      actions);
  }

  function toggleDetail(id) {
    if (state.selectedId === id) {
      if (mqDesktop.matches) { panelEl.focus(); return; }
      state.selectedId = null;
      render();
      focusEl(`#open-${id}`);
      return;
    }
    state.selectedId = id;
    render();
    focusEl(`#open-${id}`);
  }

  function closeDetail() {
    const id = state.selectedId;
    if (mqDesktop.matches) { focusEl(`#open-${id}`); return; }
    state.selectedId = null;
    render();
    focusEl(`#open-${id}`);
  }

  // ---------------------------------------------------------------------------
  // Weekly rhythm: the last seven days, today at the right edge.
  // ---------------------------------------------------------------------------
  function renderRhythm() {
    const W = 320, colW = 46, baseY = 68, gapY = 12, rx = 6.6, ry = 4.6;
    const week = DATA.week;
    const todayIdx = week.length - 1;
    const now = new Date();
    const dayLabel = (i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (todayIdx - i));
      return d.toLocaleDateString(undefined, { weekday: 'short' });
    };

    // Which past days have a missed slot? Overdue plants tell us.
    const missed = new Map();
    for (const p of state.plants) {
      const b = bucketOf(p);
      if (b.key === 'overdue') {
        const idx = todayIdx - b.daysAgo;
        if (idx >= 0 && idx < todayIdx) missed.set(idx, (missed.get(idx) || 0) + 1);
      }
    }
    // Today's slots come from live state: today's tasks, then the catch-ups.
    const todaySlots = [
      ...state.plants.filter((p) => bucketOf(p).key === 'today').sort(byUrgency).map((p) => ({ plant: p, catchup: false })),
      ...state.plants.filter((p) => bucketOf(p).key === 'overdue').sort(byUrgency).map((p) => ({ plant: p, catchup: true }))
    ];

    let out = '';
    const descParts = [];
    let total = 0, missedTotal = 0;
    for (let i = 0; i < week.length; i++) {
      const cx = 22 + i * colW;
      const isToday = i === todayIdx;
      if (isToday) out += `<rect class="rhythm__today" x="${cx - 21}" y="10" width="42" height="86" rx="21"/>`;
      const dots = [];
      if (!isToday) {
        const n = week[i], m = missed.get(i) || 0;
        for (let k = 0; k < n; k++) dots.push(k < n - m ? 'done' : 'missed');
        total += n; missedTotal += m;
        descParts.push(`${dayLabel(i)}: ${n} ${n === 1 ? 'moment' : 'moments'}${m ? `, ${m} missed` : ''}`);
      } else {
        let doneN = 0;
        for (const s of todaySlots) {
          if (s.plant.status === 'done') { dots.push('done'); doneN++; }
          else if (s.plant.status === 'snoozed') dots.push('snoozed');
          else dots.push(s.catchup ? 'catchup' : 'todo');
        }
        total += todaySlots.length;
        descParts.push(`Today: ${doneN} of ${todaySlots.length} done`);
      }
      dots.forEach((kind, k) => {
        const cy = baseY - k * gapY;
        const rot = (k % 2 ? 9 : -9) + (i % 2 ? 3 : -3);
        out += `<ellipse class="dot dot--${kind}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})"/>`;
      });
      out += `<text class="rhythm__label${isToday ? ' is-today' : ''}" x="${cx}" y="88" text-anchor="middle">${esc(isToday ? 'Today' : dayLabel(i))}</text>`;
    }

    const todayDone = todaySlots.filter((s) => s.plant.status === 'done').length;
    const summary = `${total} care moments this week · ${missedTotal ? `${missedTotal} missed · ` : ''}today ${todayDone} of ${todaySlots.length} done`;
    $('#rhythm-summary').textContent = summary;
    const svgEl = $('#rhythm-svg');
    svgEl.setAttribute('viewBox', `0 0 ${W} 100`);
    svgEl.innerHTML = `<title id="rhythm-title">Care moments over the last seven days</title><desc id="rhythm-desc">${esc(descParts.join('. '))}.</desc>${out}`;
  }

  // ---------------------------------------------------------------------------
  // Actions, undo, toast
  // ---------------------------------------------------------------------------
  function mutate(kind, p) {
    const task = TASKS[p.task];
    switch (kind) {
      case 'done':
        p.status = 'done';
        p.history.unshift(`Today · ${task.past}`);
        break;
      case 'snooze':
        p.status = 'snoozed';
        break;
      case 'unsnooze':
        p.status = 'pending';
        break;
      case 'water':
        p.history.unshift('Today · Watered');
        if (p.task === 'Water' && p.status !== 'done') p.status = 'done';
        break;
      case 'wipe':
        p.history.unshift('Today · Wiped leaves');
        break;
    }
  }

  function messageFor(kind, p) {
    const x = EXTRA[p.id];
    const b = bucketOf(p);
    switch (kind) {
      case 'done': return `${p.name} ${TASKS[p.task].past.toLowerCase()}. ${x.flourish}`;
      case 'snooze': return `${p.name} snoozed until tomorrow.${b.key === 'overdue' ? ` That will make it ${b.daysAgo + 1} days, just so you know.` : ''}`;
      case 'unsnooze': return `${p.name} is back in today's queue.`;
      case 'water': return `Logged a drink for ${p.name}.${p.task === 'Water' ? ` ${x.flourish}` : ''}`;
      case 'wipe': return `Leaf wipe logged for ${p.name}. Shiny.`;
    }
    return 'Done.';
  }

  function performAction(kind, id) {
    const p = plantById(id);
    if (!p) return;
    const snapshot = JSON.stringify({ plants: state.plants, selectedId: state.selectedId });
    const leaving = (kind === 'done' || kind === 'snooze') && p.status === 'pending';
    const wasFromPanel = !!document.activeElement && panelEl.contains(document.activeElement);

    // Work out where focus should land once the row is gone.
    const actionable = [...pendingIn('overdue'), ...pendingIn('today')];
    const idx = actionable.findIndex((q) => q.id === id);
    const neighbour = idx === -1 ? null : (actionable[idx + 1] || actionable[idx - 1] || null);

    const apply = () => {
      mutate(kind, p);
      state.undo = { snapshot, focusId: id, kind };

      if (leaving && state.selectedId === id) {
        state.selectedId = mqDesktop.matches ? null : null; // desktop re-picks the top of the queue in placePanel
      }
      render();

      if (kind === 'unsnooze') focusEl(`#open-${id}`);
      else if (wasFromPanel) focusEl('#detail-water');
      else if (kind === 'wipe') focusEl('#alldone-title');
      else if (leaving) {
        if (neighbour) focusEl(`#open-${neighbour.id}`);
        else focusEl('#alldone-title');
      }

      showToast(messageFor(kind, p));
      if (kind === 'done' || kind === 'water' || kind === 'wipe') hop();
    };

    if (leaving) leaveRow(id, kind, apply);
    else apply();
  }

  function leaveRow(id, kind, then) {
    const li = $(`#row-${id}`);
    if (!li || mqReduced.matches) { then(); return; }
    li.classList.add('is-leaving', kind === 'done' ? 'is-leaving--done' : 'is-leaving--snooze');
    li.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    let fired = false;
    const finish = () => { if (fired) return; fired = true; then(); };
    li.addEventListener('animationend', (e) => { if (e.target === li) finish(); });
    setTimeout(finish, 520);
  }

  function undo() {
    if (!state.undo) return;
    const { snapshot, focusId, kind } = state.undo;
    const restored = JSON.parse(snapshot);
    state = { plants: restored.plants, selectedId: restored.selectedId, undo: null };
    hideToast(false);
    render();
    const p = plantById(focusId);
    if (kind === 'wipe') focusEl('#alldone-title');
    else focusEl(`#open-${focusId}`);
    announce(`Undone. ${p ? p.name + ' is back where it was.' : ''}`);
  }

  const toast = { root: null, msg: null, timer: null, remaining: 0, startedAt: 0 };

  function showToast(message) {
    toast.msg.textContent = message;
    toast.root.hidden = false;
    toast.root.classList.remove('is-open', 'is-paused');
    void toast.root.offsetWidth; // restart the drain animation
    toast.root.classList.add('is-open');
    clearTimeout(toast.timer);
    toast.remaining = TOAST_MS;
    startToastTimer();
    announce(`${message} Undo is available for a few seconds: press Control Z, or use the Undo button.`);
  }
  function startToastTimer() {
    toast.startedAt = performance.now();
    toast.timer = setTimeout(() => hideToast(true), toast.remaining);
  }
  function pauseToast() {
    if (!toast.timer) return;
    clearTimeout(toast.timer);
    toast.timer = null;
    toast.remaining = Math.max(800, toast.remaining - (performance.now() - toast.startedAt));
    toast.root.classList.add('is-paused');
  }
  function resumeToast() {
    if (toast.root.hidden || toast.timer) return;
    toast.root.classList.remove('is-paused');
    startToastTimer();
  }
  function hideToast(commit) {
    clearTimeout(toast.timer);
    toast.timer = null;
    const hadFocus = toast.root.contains(document.activeElement);
    toast.root.hidden = true;
    toast.root.classList.remove('is-open', 'is-paused');
    if (commit) state.undo = null;
    if (hadFocus) focusEl('#queue');
  }

  function announce(text) {
    const a = $('#announcer');
    a.textContent = '';
    setTimeout(() => { a.textContent = text; }, 40);
  }

  function focusEl(sel) {
    const node = $(sel);
    if (node) node.focus({ preventScroll: false });
  }

  function hop() {
    const m = $('#mascot');
    if (mqReduced.matches) return;
    m.classList.remove('is-hopping');
    void m.getBoundingClientRect();
    m.classList.add('is-hopping');
  }

  // ---------------------------------------------------------------------------
  // Render everything
  // ---------------------------------------------------------------------------
  function render() {
    // Park the panel in the sidebar first: rebuilding the lists would otherwise
    // destroy it along with the row it was sitting in.
    $('#detail-slot').append(panelEl);
    resolveSelection();
    renderHeader();
    renderLists();
    renderAllDone();
    placePanel();
    renderPanel();
    renderRhythm();
  }

  function init() {
    panelEl = $('#detail');
    toast.root = $('#toast');
    toast.msg = $('#toast-msg');
    toast.root.style.setProperty('--toast-ms', `${TOAST_MS}ms`);
    $('#toast-undo').addEventListener('click', undo);
    $('#toast-close').addEventListener('click', () => hideToast(true));
    toast.root.addEventListener('mouseenter', pauseToast);
    toast.root.addEventListener('mouseleave', () => { if (!toast.root.contains(document.activeElement)) resumeToast(); });
    toast.root.addEventListener('focusin', pauseToast);
    toast.root.addEventListener('focusout', (e) => { if (!toast.root.contains(e.relatedTarget)) resumeToast(); });

    $('#mascot').addEventListener('animationend', (e) => { if (e.animationName === 'hop') $('#mascot').classList.remove('is-hopping'); });

    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'z') {
        if (state.undo) { e.preventDefault(); undo(); }
        return;
      }
      if (e.key === 'Escape') {
        if (!toast.root.hidden) { hideToast(true); return; }
        if (!mqDesktop.matches && state.selectedId && panelEl.contains(document.activeElement)) closeDetail();
      }
    });

    let layoutIsDesktop = mqDesktop.matches;
    const onLayoutChange = () => {
      if (mqDesktop.matches === layoutIsDesktop) return;
      layoutIsDesktop = mqDesktop.matches;
      render();
    };
    if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', onLayoutChange);
    else mqDesktop.addListener(onLayoutChange);

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
