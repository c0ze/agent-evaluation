/*
 * Moss: today's care queue.
 * Plain JavaScript, no network. SEED mirrors PLANTS.json; fetch() is blocked
 * on file:// pages, so the data is inlined here instead.
 */
(() => {
  'use strict';

  const SEED = {
    plants: [
      { id: 'fern', name: 'Frida', species: 'Boston fern', location: 'Bathroom', task: 'Water', due: '2 days overdue', urgency: 4, light: 'Low, indirect', history: ['Sep 19 · Misted', 'Sep 16 · Watered', 'Sep 12 · New frond'] },
      { id: 'pothos', name: 'Orbit', species: 'Golden pothos', location: 'Bookshelf', task: 'Rotate', due: 'Today', urgency: 2, light: 'Medium, indirect', history: ['Sep 20 · Watered', 'Sep 14 · Rotated', 'Sep 10 · Wiped leaves'] },
      { id: 'cactus', name: 'Dot', species: 'Bunny ears cactus', location: 'South window', task: 'Check soil', due: 'Today', urgency: 1, light: 'Bright, direct', history: ['Sep 08 · Watered', 'Sep 01 · New pad noted', 'Aug 22 · Rotated'] },
      { id: 'calathea', name: 'Drama', species: 'Calathea orbifolia', location: 'Bedroom', task: 'Mist', due: 'Tomorrow', urgency: 0, light: 'Medium, filtered', history: ['Sep 21 · Misted', 'Sep 18 · Watered', 'Sep 15 · Brown edge noted'] },
    ],
    week: [1, 3, 2, 4, 2, 1, 3],
  };

  // What each care task logs, what its button says, and how long until the next one.
  const TASKS = {
    Water: { verb: 'Watered', button: 'Watered', every: 5 },
    Rotate: { verb: 'Rotated', button: 'Rotated', every: 7 },
    'Check soil': { verb: 'Checked soil', button: 'Soil checked', every: 3 },
    Mist: { verb: 'Misted', button: 'Misted', every: 2 },
  };

  const MOODS = {
    fern: {
      overdue: 'Frida has been sulking politely. A drink should fix it.',
      today: 'Frida is getting dramatic about the dry spell.',
      done: 'Frida is drinking it all in. Fronds up.',
      coming: 'Frida is comfortable for now. Fronds unbothered.',
    },
    pothos: {
      overdue: 'Orbit has been leaning toward the window. A quarter turn, please.',
      today: 'Orbit would like a small rotation. Nothing dramatic.',
      done: 'Orbit is facing the room again. Very dignified.',
      coming: 'Orbit is leaning gently. Nothing urgent.',
    },
    cactus: {
      overdue: 'Dot has waited with spiky patience. Check the soil.',
      today: 'Dot would like the soil checked. Gently. Dot does not do hugs.',
      done: 'Dot checked out. Dot is unimpressed, and pleased about it.',
      coming: 'Dot is fine. Dot has been fine for a while.',
    },
    calathea: {
      overdue: 'Drama needs a mist, immediately. Everything is a big deal.',
      today: 'Drama needs a mist and a moment of silence.',
      done: 'Drama is misty and magnificent.',
      coming: 'Drama is preparing a scene for tomorrow. Mist first.',
    },
  };

  const ALL_DONE_LINES = [
    'Nothing needs you right now. The plants are pretending they did it themselves.',
    'Everyone has been watered, turned, misted, or politely inspected. Moss is napping.',
    'The leaves are content. Go do something that is not plant-related.',
  ];

  const GROUPS = ['overdue', 'today', 'done', 'coming'];
  const GROUP_TITLES = { overdue: 'Overdue', today: 'Due today', done: 'Done today', coming: 'Coming up' };
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const $ = (selector) => document.querySelector(selector);
  const queueBody = $('#queue-body');
  const queueTitle = $('#queue-title');
  const lede = $('#lede');
  const progress = $('#progress');
  const progressCount = $('#progress-count');
  const sill = $('#sill');
  const rhythm = $('#rhythm');
  const rhythmNote = $('#rhythm-note');
  const toast = $('#toast');
  const toastText = $('#toast-text');
  const undoButton = $('#undo');
  const announcer = $('#announce');

  const TOAST_UNDO_MS = 6000;
  const TOAST_NOTE_MS = 3000;

  const state = {
    plants: SEED.plants.map(seedPlant),
    week: SEED.week.slice(),
  };
  const expanded = new Set();
  let undo = null; // { prev, focus } for the most recent action
  let toastTimer = 0;

  // Helpers

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const plural = (n, word) => `${n} ${word}${Math.abs(n) === 1 ? '' : 's'}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const find = (id) => state.plants.find((p) => p.id === id);

  function parseDue(text) {
    if (/tomorrow/i.test(text)) return 1;
    if (/today/i.test(text)) return 0;
    const overdue = text.match(/(\d+)\s+days?\s+overdue/i);
    if (overdue) return -Number(overdue[1]);
    return 0;
  }

  function seedPlant(raw) {
    return {
      id: raw.id,
      name: raw.name,
      species: raw.species,
      location: raw.location,
      task: raw.task,
      urgency: raw.urgency,
      light: raw.light,
      dueIn: parseDue(raw.due), // negative = overdue, 0 = today, 1+ = days out
      tended: false, // done today
      history: raw.history.map((line) => {
        const [when, ...rest] = line.split(' · ');
        return { when, text: rest.join(' · ') };
      }),
    };
  }

  function groupOf(p) {
    if (p.tended) return 'done';
    if (p.dueIn < 0) return 'overdue';
    if (p.dueIn === 0) return 'today';
    return 'coming';
  }

  function groupedPlants() {
    const groups = { overdue: [], today: [], done: [], coming: [] };
    for (const p of state.plants) groups[groupOf(p)].push(p);
    for (const list of Object.values(groups)) {
      list.sort((a, b) => a.dueIn - b.dueIn || b.urgency - a.urgency);
    }
    return groups;
  }

  const openCount = () => state.plants.filter((p) => !p.tended && p.dueIn <= 0).length;

  function dueLabel(p, group) {
    if (group === 'done') return `Tended · next in ${plural(p.dueIn, 'day')}`;
    if (p.dueIn < 0) return `${plural(-p.dueIn, 'day')} overdue`;
    if (p.dueIn === 0) return 'Due today';
    if (p.dueIn === 1) return 'Tomorrow';
    return `In ${plural(p.dueIn, 'day')}`;
  }

  const bucketOf = (text) => {
    if (/water|mist/i.test(text)) return 'water';
    if (/rotat|light/i.test(text)) return 'light';
    return 'notes';
  };

  // Rendering

  function plantArt(id) {
    return `<svg viewBox="0 0 80 80" focusable="false" aria-hidden="true">${ART[id]()}</svg>`;
  }

  const POT = '<path d="M21 44h38l-4.5 25a4 4 0 0 1-4 3.5H29.5a4 4 0 0 1-4-3.5z" fill="#b5673d"/>'
    + '<rect x="17" y="37" width="46" height="10" rx="5" fill="#cf7d52"/>';

  const ART = {
    fern: () => {
      const fronds = [-68, -40, -15, 12, 38, 64].map((angle, i) => {
        const len = i % 2 ? 26 : 32;
        const fill = i % 2 ? '#7a9d55' : '#4f7a38';
        return `<ellipse cx="40" cy="${40 - len / 2}" rx="4.5" ry="${len / 2}" transform="rotate(${angle} 40 40)" fill="${fill}"/>`;
      });
      return fronds.join('') + POT;
    },
    pothos: () => '<path d="M40 38Q36 30 30 26M40 38Q46 30 52 22" stroke="#4d6b30" stroke-width="2" fill="none"/>'
      + '<ellipse cx="26" cy="26" rx="11" ry="8" transform="rotate(-30 26 26)" fill="#6f9a45"/>'
      + '<ellipse cx="52" cy="20" rx="10" ry="8" transform="rotate(20 52 20)" fill="#5d8a3b"/>'
      + '<ellipse cx="60" cy="40" rx="9" ry="7" transform="rotate(60 60 40)" fill="#7fa552"/>'
      + '<ellipse cx="32" cy="42" rx="9" ry="7" transform="rotate(-70 32 42)" fill="#5d8a3b"/>'
      + '<circle cx="22" cy="24" r="2" fill="#f0c95a"/><circle cx="56" cy="18" r="1.6" fill="#f0c95a"/>'
      + POT,
    cactus: () => '<rect x="31" y="14" width="14" height="30" rx="7" fill="#7f9c6c"/>'
      + '<rect x="45" y="24" width="11" height="20" rx="5.5" fill="#6d8c5c"/>'
      + '<rect x="22" y="30" width="10" height="16" rx="5" fill="#6d8c5c"/>'
      + '<g fill="#f3e3b5"><circle cx="38" cy="22" r="1.2"/><circle cx="36" cy="32" r="1.2"/>'
      + '<circle cx="50" cy="30" r="1.1"/><circle cx="27" cy="36" r="1.1"/></g>'
      + POT,
    calathea: () => '<ellipse cx="30" cy="30" rx="11" ry="13" transform="rotate(-20 30 30)" fill="#5f8a4e"/>'
      + '<ellipse cx="51" cy="28" rx="10" ry="12" transform="rotate(18 51 28)" fill="#6f9a57"/>'
      + '<path d="M30 42L26 22M30 30l-6-3M30 34l-7 1M51 40L52 20M51 30l6-3M51 35l6 1" stroke="#c4d99c" stroke-width="1.4" stroke-linecap="round" fill="none"/>'
      + POT,
  };

  const SUN_ART = '<svg class="all-done__art" viewBox="0 0 120 120" focusable="false" aria-hidden="true">'
    + '<circle cx="60" cy="62" r="40" fill="#e3a72f"/>'
    + '<path d="M60 24C58 12 68 4 80 6c-2 12-10 20-20 18z" fill="#55733a"/>'
    + '<path d="M44 62q5 5 10 0M66 62q5 5 10 0M55 76q5 3 10 0" stroke="#2b2319" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
    + '</svg>';

  function careItem(p, group, isFirst) {
    const rule = TASKS[p.task];
    const open = expanded.has(p.id);
    const name = esc(p.name);
    const actions = [];

    if (group !== 'done') {
      actions.push(`<button type="button" class="btn btn--primary" data-action="tend" data-id="${p.id}" data-focus="${p.id}:tend">${rule.button}<span class="sr-only"> ${name}</span></button>`);
    }
    if (group === 'overdue' || group === 'today') {
      actions.push(`<button type="button" class="btn" data-action="snooze" data-id="${p.id}" data-focus="${p.id}:snooze">Snooze a day<span class="sr-only"> ${name}</span></button>`);
    }
    actions.push(`<button type="button" class="btn btn--quiet" data-action="toggle" data-id="${p.id}" data-focus="${p.id}:toggle" aria-expanded="${open}" aria-controls="details-${p.id}">Details<span class="sr-only"> for ${name}</span></button>`);

    const byBucket = { light: [], water: [], notes: [] };
    for (const entry of p.history) byBucket[bucketOf(entry.text)].push(entry);

    return `
      <li class="care care--${p.id} care--${group}" data-plant="${p.id}">
        ${isFirst ? '<span class="sticker" aria-hidden="true">Start here</span>' : ''}
        <div class="care__row">
          <div class="care__avatar">${plantArt(p.id)}</div>
          <div>
            <p class="care__name"><strong>${name}</strong> <span class="care__species">${esc(p.species)}</span></p>
            <p class="care__task">${esc(p.task)} · ${esc(p.location)}</p>
            <p class="care__mood">${esc(MOODS[p.id][group])}</p>
            <p class="care__due"><span class="chip chip--${group}">${esc(dueLabel(p, group))}</span></p>
          </div>
        </div>
        <div class="care__actions">${actions.join('')}</div>
        <div class="care__details" id="details-${p.id}"${open ? '' : ' hidden'}>
          <dl class="facts">
            <div><dt>Light</dt><dd>${esc(p.light)}</dd></div>
            <div><dt>Spot</dt><dd>${esc(p.location)}</dd></div>
          </dl>
          <div class="logs">
            ${logSection('Light', byBucket.light)}
            ${logSection('Water and mist', byBucket.water)}
            ${logSection('Observations', byBucket.notes)}
          </div>
        </div>
      </li>`;
  }

  function logSection(title, entries) {
    const items = entries.length
      ? entries.map((e) => `<li><span class="when">${esc(e.when)}</span>${esc(e.text)}</li>`).join('')
      : '<li class="empty">Nothing logged yet.</li>';
    return `<section><h4>${title}</h4><ul>${items}</ul></section>`;
  }

  function renderQueue(groups) {
    const allDone = groups.overdue.length === 0 && groups.today.length === 0;
    const parts = [];
    if (allDone) {
      const line = ALL_DONE_LINES[new Date().getDate() % ALL_DONE_LINES.length];
      parts.push(`
        <div class="all-done">
          ${SUN_ART}
          <h3>All tended for now</h3>
          <p>${esc(line)}</p>
        </div>`);
    }
    const startHere = groups.overdue[0] || groups.today[0];
    for (const group of GROUPS) {
      const list = groups[group];
      if (!list.length) continue;
      const items = list.map((p) => careItem(p, group, p === startHere));
      parts.push(`
        <section class="group group--${group}" aria-labelledby="group-${group}">
          <h3 class="group__title" id="group-${group}">${GROUP_TITLES[group]} <span class="group__count">${list.length}</span></h3>
          <ol class="care-list">${items.join('')}</ol>
        </section>`);
    }
    queueBody.innerHTML = parts.join('');
  }

  function renderSummary(groups) {
    const { overdue, today } = groups;
    if (overdue.length) {
      lede.textContent = `${plural(overdue.length, 'plant')} overdue. Start with ${overdue[0].name}.`;
    } else if (today.length) {
      lede.textContent = `${plural(today.length, 'plant')} due today. Easy does it.`;
    } else {
      lede.textContent = 'Everyone is tended for now. Go be a plant-adjacent human.';
    }
    progress.max = state.plants.length;
    progress.value = groups.done.length;
    progressCount.textContent = `${groups.done.length}/${state.plants.length}`;
  }

  function renderSill() {
    sill.innerHTML = state.plants
      .map((p) => `<span class="sill__plant sill__plant--${p.id} is-${groupOf(p)}" data-plant="${p.id}">${plantArt(p.id)}</span>`)
      .join('');
  }

  function renderRhythm() {
    const today = new Date();
    const last = state.week.length - 1;
    const days = state.week.map((count, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (last - i));
      return { label: WEEKDAYS[date.getDay()], count, isToday: i === last };
    });
    const busiest = days.reduce((best, day) => (day.count > best.count ? day : best));
    rhythmNote.textContent = `Busiest day: ${busiest.label} (${busiest.count}). Today so far: ${plural(days[last].count, 'care moment')}.`;

    rhythm.innerHTML = `
      <ol class="rhythm__list">
        ${days.map((d) => `
          <li class="rhythm__day${d.isToday ? ' is-today' : ''}"${d.isToday ? ' aria-current="date"' : ''}>
            <span class="rhythm__count" aria-hidden="true">${d.count}</span>
            <span class="rhythm__bar" style="--n:${d.count}" aria-hidden="true"></span>
            <span class="rhythm__label" aria-hidden="true">${d.label}</span>
            <span class="sr-only">${d.label}: ${plural(d.count, 'care moment')}${d.isToday ? ', today' : ''}</span>
          </li>`).join('')}
      </ol>`;
  }

  function render(pending = {}) {
    const groups = groupedPlants();
    renderSummary(groups);
    renderQueue(groups);
    renderSill();
    renderRhythm();
    if (pending.fx) applyFx(pending.fx);
    if (pending.focus) focusAfterRender(pending.focus);
  }

  function focusAfterRender(key) {
    const target = queueBody.querySelector(`[data-focus="${key}"]`);
    if (target) target.focus();
    else if (!toast.hidden && !undoButton.hidden) undoButton.focus();
    else queueTitle.focus();
  }

  // Small moments of delight: a droplet and a perk for watering, a sleepy z for snoozing.

  function applyFx({ id, kind }) {
    const item = queueBody.querySelector(`li[data-plant="${id}"]`);
    if (!item) return;
    if (kind === 'tend') {
      const avatar = item.querySelector('.care__avatar');
      const drop = document.createElement('span');
      drop.className = 'drop';
      drop.setAttribute('aria-hidden', 'true');
      avatar.classList.add('is-perking');
      avatar.append(drop);
      setTimeout(() => drop.remove(), 800);
      sill.querySelector(`.sill__plant--${id}`)?.classList.add('is-perking');
    } else {
      const zzz = document.createElement('span');
      zzz.className = 'zzz';
      zzz.setAttribute('aria-hidden', 'true');
      zzz.textContent = 'z z';
      item.append(zzz);
      setTimeout(() => zzz.remove(), 1700);
    }
  }

  // Actions

  function act(message, prev, focus, fx) {
    undo = { prev, focus };
    showToast(message, true);
    render({ focus, fx });
  }

  function tend(id) {
    const p = find(id);
    const rule = TASKS[p.task];
    const prev = clone(state);
    p.tended = true;
    p.dueIn = rule.every;
    p.history.unshift({ when: 'Today', text: rule.verb });
    state.week[state.week.length - 1] += 1;

    const finished = openCount() === 0 ? ' That is everything for today.' : '';
    act(`${p.name} ${rule.verb.toLowerCase()}. Lovely.${finished}`, prev, `${id}:tend`, { id, kind: 'tend' });
  }

  function snooze(id) {
    const p = find(id);
    const prev = clone(state);
    p.dueIn += 1;
    const message = p.dueIn < 0
      ? `${p.name} snoozed a day. Still overdue, though.`
      : `${p.name} snoozed a day. Zzz.`;
    act(message, prev, `${id}:snooze`, { id, kind: 'snooze' });
  }

  function toggleDetails(id, button) {
    const open = !expanded.has(id);
    if (open) expanded.add(id);
    else expanded.delete(id);
    button.setAttribute('aria-expanded', String(open));
    document.getElementById(`details-${id}`).hidden = !open;
  }

  // Toast with undo

  function showToast(message, withUndo) {
    toastText.textContent = message;
    undoButton.hidden = !withUndo;
    toast.hidden = false;
    announcer.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, withUndo ? TOAST_UNDO_MS : TOAST_NOTE_MS);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toast.hidden = true;
    undo = null;
  }

  const pauseToast = () => clearTimeout(toastTimer);
  const resumeToast = () => {
    if (toast.hidden || toast.matches(':hover, :focus-within')) return;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_NOTE_MS);
  };
  toast.addEventListener('pointerenter', pauseToast);
  toast.addEventListener('pointerleave', resumeToast);
  toast.addEventListener('focusin', pauseToast);
  toast.addEventListener('focusout', resumeToast);

  undoButton.addEventListener('click', () => {
    if (!undo) return;
    const { prev, focus } = undo;
    state.plants = prev.plants;
    state.week = prev.week;
    showToast('Put back. Nothing lost.', false);
    undo = null;
    render({ focus });
  });

  queueBody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'tend') tend(id);
    else if (action === 'snooze') snooze(id);
    else if (action === 'toggle') toggleDetails(id, button);
  });

  render();
})();
