/* ==========================================================================
   Moss — app logic
   No frameworks, no network: the four plants from PLANTS.json live here,
   everything else is state + DOM.
   ========================================================================== */

(() => {
  'use strict';

  /* --- Data (mirrors PLANTS.json) --------------------------------------- */

  const DATA = {
    plants: [
      { id: 'fern',    name: 'Frida', species: 'Boston fern',       location: 'Bathroom',     task: 'Water',      due: '2 days overdue', urgency: 4, light: 'Low, indirect',    history: ['Sep 19 · Misted', 'Sep 16 · Watered', 'Sep 12 · New frond'] },
      { id: 'pothos',  name: 'Orbit', species: 'Golden pothos',     location: 'Bookshelf',    task: 'Rotate',     due: 'Today',          urgency: 2, light: 'Medium, indirect', history: ['Sep 20 · Watered', 'Sep 14 · Rotated', 'Sep 10 · Wiped leaves'] },
      { id: 'cactus',  name: 'Dot',   species: 'Bunny ears cactus', location: 'South window', task: 'Check soil', due: 'Today',          urgency: 1, light: 'Bright, direct',   history: ['Sep 08 · Watered', 'Sep 01 · New pad noted', 'Aug 22 · Rotated'] },
      { id: 'calathea',name: 'Drama', species: 'Calathea orbifolia',location: 'Bedroom',      task: 'Mist',       due: 'Tomorrow',       urgency: 0, light: 'Medium, filtered', history: ['Sep 21 · Misted', 'Sep 18 · Watered', 'Sep 15 · Brown edge noted'] }
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };

  /* Display-only extras: sticker colours and whispered notes. */
  const TINTS = {
    fern:     { tint: '#9dbb9a', bg: '#e3ecdf' },
    pothos:   { tint: '#f0c265', bg: '#fbeed2' },
    cactus:   { tint: '#e2a173', bg: '#f7e4d3' },
    calathea: { tint: '#a8c3d4', bg: '#dfe9ee' }
  };

  const NOTES = {
    fern:     'Frida loves steam — every shower is her spa day. Misting counts as watering to her.',
    pothos:   'Orbit leans toward the window. A quarter turn each week keeps him honest.',
    cactus:   'Dot is low-drama. Forget her for a month; she absolutely respects it.',
    calathea: 'Drama folds her leaves when sulking. It is a performance. She is fine.'
  };

  const REACTIONS = {
    fern:     'Fronds uncurling already.',
    pothos:   'Roots humming, vines considering the window.',
    cactus:   'She will act unimpressed. She is not.',
    calathea: 'Leaves lifting within the hour, most likely.'
  };

  const today = new Date();
  const todayIndex = (today.getDay() + 6) % 7; // Monday-first week

  const initialItems = () => DATA.plants.map((p) => ({ ...p, status: 'todo' }));

  const state = {
    items: initialItems(),
    past: [] // undo snapshots
  };

  /* --- Helpers ----------------------------------------------------------- */

  const $ = (sel, root = document) => root.querySelector(sel);

  const el = {
    list: $('#plant-list'),
    date: $('#today-date'),
    greeting: $('#greeting'),
    progress: $('#progress'),
    progressFill: $('#progress-fill'),
    progressCount: $('#progress-count'),
    hint: $('#queue-hint'),
    queueHeading: $('#queue-heading'),
    done: $('#done-state'),
    doneTitle: $('#done-title'),
    doneMsg: $('#done-msg'),
    reset: $('#reset-day'),
    snoozeCorner: $('#snooze-corner'),
    snoozeList: $('#snooze-list'),
    rhythmFigure: $('#rhythm-figure'),
    rhythmCaption: $('#rhythm-caption'),
    notesBody: $('#notes-body'),
    toast: $('#toast'),
    toastMsg: $('#toast-msg'),
    toastUndo: $('#toast-undo')
  };

  const fmtLong = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const fmtShort = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const escapeHtml = (str) => String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const isOverdue = (item) => /overdue/i.test(item.due);
  const byUrgency = (a, b) => b.urgency - a.urgency;

  const queueItems = () => state.items.filter((i) => i.status === 'todo').sort(byUrgency);
  const snoozedItems = () => state.items.filter((i) => i.status === 'snoozed');
  const doneCount = () => state.items.filter((i) => i.status === 'done').length;

  /* --- Icons ------------------------------------------------------------- */

  const DROP = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3c3.5 4.2 6 7.4 6 10.2A6 6 0 0 1 6 13.2C6 10.4 8.5 7.2 12 3z" fill="currentColor"/></svg>';
  const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></g></svg>';

  /* --- Plant illustrations (inline SVG) ---------------------------------- */

  function pot(body = '#c8663f', rim = '#a34e2b') {
    return `
      <path d="M38 76 h44 l-5 24a9 9 0 0 1 -9 8 h-16 a9 9 0 0 1 -9 -8 z" fill="${body}"/>
      <path d="M38.6 82.5 h42.8 l-1.2 5.6 h-40.4 z" fill="#3a1c0d" opacity=".12"/>
      <rect x="33" y="67" width="54" height="11" rx="5.5" fill="${rim}"/>`;
  }

  function plantSvg(id) {
    if (id === 'fern') {
      const fronds = [-64, -38, -16, 8, 34, 60]
        .map((r, i) => `<path d="M60 72 C 53 52 42 36 24 28 C 36 46 47 62 60 72 Z"
            fill="${i % 2 ? '#5e8a68' : '#3d6b4f'}" transform="rotate(${r} 60 72)"/>`).join('');
      return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${pot()}${fronds}</svg>`;
    }
    if (id === 'pothos') {
      const leaf = 'M0 0 C -8 -5 -8 -17 0 -21 C 8 -17 8 -5 0 0 Z';
      const spots = [[40, 64, -35, 1], [31, 51, -58, .9], [46, 55, -12, .8],
                     [79, 63, 38, 1], [88, 51, 60, .9], [73, 55, 14, .8]]
        .map(([x, y, r, s]) => `<path d="${leaf}" fill="#3d6b4f" transform="translate(${x} ${y}) rotate(${r}) scale(${s})"/>`)
        .join('');
      return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${pot()}
        <path d="M56 68 C 44 64 34 56 30 42" stroke="#5e8a68" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M64 68 C 76 66 85 60 89 48" stroke="#5e8a68" stroke-width="3" fill="none" stroke-linecap="round"/>
        ${spots}</svg>`;
    }
    if (id === 'cactus') {
      return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${pot()}
        <rect x="45" y="22" width="27" height="52" rx="13.5" fill="#4d7f57" transform="rotate(-9 58 74)"/>
        <rect x="61" y="32" width="22" height="44" rx="11" fill="#5e8a68" transform="rotate(13 72 74)"/>
        <g stroke="#2b4d38" stroke-width="1.6" stroke-linecap="round">
          <path d="M50 34 l-4 -3 M52 46 l-5 -2 M53 58 l-5 -1" transform="rotate(-9 58 74)"/>
          <path d="M68 44 l4 -3 M67 56 l5 -2 M66 66 l5 -1" transform="rotate(13 72 74)"/>
        </g>
        <g fill="#f0c265">
          <circle cx="51" cy="20" r="4.5"/>
          <circle cx="45" cy="24" r="3"/><circle cx="57" cy="24" r="3"/>
          <circle cx="45" cy="17" r="3"/><circle cx="57" cy="17" r="3"/>
        </g></svg>`;
    }
    // calathea
    const leaf = 'M0 0 C -15 -12 -17 -36 0 -54 C 17 -36 15 -12 0 0 Z';
    const leaves = [[-52, .85], [-24, 1], [6, 1.05], [40, .9]]
      .map(([r, s], i) => `
        <g transform="rotate(${r} 60 74)">
          <g transform="scale(${s}) translate(${(60 / s - 60).toFixed(1)} ${(74 / s - 74).toFixed(1)})">
            <path d="${leaf}" fill="${i % 2 ? '#4f7f5c' : '#3d6b4f'}" transform="translate(60 74)"/>
            <path d="M60 70 L60 28" stroke="#c9dcc4" stroke-width="2" opacity=".65" transform="translate(60 74)"/>
          </g>
        </g>`).join('');
    return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${pot()}${leaves}</svg>`;
  }

  /* --- Rendering --------------------------------------------------------- */

  function renderHeader() {
    el.date.textContent = fmtLong;
    const h = today.getHours();
    el.greeting.textContent = h < 12 ? 'Good morning, gardener' : h < 18 ? 'Good afternoon, gardener' : 'Good evening, gardener';

    const total = state.items.length;
    const done = doneCount();
    el.progressFill.style.width = `${(done / total) * 100}%`;
    el.progress.setAttribute('aria-valuenow', String(done));
    el.progress.setAttribute('aria-valuetext', `${done} of ${total} plants tended`);
    el.progressCount.textContent = String(done);
  }

  function cardEl(item) {
    const li = document.createElement('li');
    const t = TINTS[item.id] || TINTS.fern;
    li.className = 'plant' + (isOverdue(item) ? ' plant--overdue' : '');
    li.dataset.id = item.id;
    li.style.setProperty('--plant-tint', t.tint);
    li.style.setProperty('--plant-tint-bg', t.bg);

    const lastWater = item.history.find((h) => /water|mist/i.test(h));
    const lastWaterDate = lastWater ? lastWater.split(' · ')[0] : 'No record';
    const dueChip = isOverdue(item)
      ? `<span class="chip chip--overdue"><span class="chip__dot"></span>${escapeHtml(item.due)}</span>`
      : `<span class="chip chip--due">${escapeHtml(item.due)}</span>`;

    li.innerHTML = `
      <div class="plant__main">
        <div class="plant__art">${plantSvg(item.id)}</div>
        <div class="plant__info">
          <h3 class="plant__name">${escapeHtml(item.name)}<span class="plant__species">${escapeHtml(item.species)}</span></h3>
          <div class="plant__chips">
            <span class="chip chip--task">${escapeHtml(item.task)}</span>
            ${dueChip}
          </div>
        </div>
        <p class="plant__meta">${escapeHtml(item.location)} &middot; ${escapeHtml(item.light)}</p>
        <div class="plant__actions">
          <button type="button" class="btn btn--water" data-action="water">${DROP}Watered</button>
          <button type="button" class="btn btn--ghost" data-action="snooze">${CLOCK}Snooze</button>
        </div>
        <button type="button" class="btn btn--link plant__toggle" data-action="toggle"
                aria-expanded="false" aria-controls="detail-${item.id}">Details</button>
      </div>
      <div class="plant__detail" id="detail-${item.id}" hidden>
        <div class="detail__grid">
          <div class="detail__block">
            <h4>Care facts</h4>
            <div class="detail__facts">
              <p class="fact"><span class="fact__icon" aria-hidden="true">${SUN}</span>
                <span><span class="fact__value">${escapeHtml(item.light)}</span> light<br>
                <span class="fact__note">in the ${escapeHtml(item.location.toLowerCase())}</span></span></p>
              <p class="fact"><span class="fact__icon" aria-hidden="true">${DROP}</span>
                <span><span class="fact__value">${escapeHtml(lastWaterDate)}</span>
                <span class="fact__note">last soaked</span></span></p>
              <p class="fact"><span class="fact__icon" aria-hidden="true">${CLOCK}</span>
                <span><span class="fact__value">${escapeHtml(item.task)}</span>
                <span class="fact__note">${escapeHtml(item.due)}</span></span></p>
            </div>
          </div>
          <div class="detail__block">
            <h4>Light, water &amp; observations</h4>
            <ul class="timeline">
              ${item.history.map((entry) => {
                const [date, ...rest] = entry.split(' · ');
                const label = rest.join(' · ');
                const care = /water|mist|rotat|wipe|fertil/i.test(label);
                return `<li class="timeline__item">
                  <span class="timeline__date">${escapeHtml(date)}</span>
                  <span class="timeline__kind ${care ? 'timeline__kind--care' : 'timeline__kind--note'}">${escapeHtml(label)}</span>
                </li>`;
              }).join('')}
            </ul>
          </div>
        </div>
      </div>`;
    return li;
  }

  function renderQueue() {
    const queue = queueItems();
    const topOverdue = queue.find(isOverdue);

    el.hint.textContent = topOverdue
      ? `Start with ${topOverdue.name} — ${topOverdue.due}. The rest can wait for evening.`
      : queue.length
        ? 'Easy day: a light pass is plenty.'
        : '';

    el.list.replaceChildren(...queue.map(cardEl));

    const snoozed = snoozedItems();
    el.done.hidden = queue.length > 0;
    if (queue.length === 0) {
      if (snoozed.length) {
        el.doneTitle.textContent = 'That\u2019s the queue for now';
        el.doneMsg.textContent = `${snoozed.map((i) => i.name).join(' and ')} ${snoozed.length > 1 ? 'are' : 'is'} snoozing until evening — everything else is tended.`;
      } else {
        el.doneTitle.textContent = 'Every plant is tended';
        el.doneMsg.textContent = `You gave all ${state.items.length} plants exactly what they needed. The fern is already uncurling.`;
      }
    }
  }

  function renderSnoozed() {
    const snoozed = snoozedItems();
    el.snoozeCorner.hidden = snoozed.length === 0;
    el.snoozeList.replaceChildren(...snoozed.map((item) => {
      const li = document.createElement('li');
      li.className = 'snooze-item';
      li.dataset.id = item.id;
      li.innerHTML = `
        <span class="snooze-item__art">${plantSvg(item.id)}</span>
        <span>
          <span class="snooze-item__name">${escapeHtml(item.name)}</span>
          <span class="snooze-item__until">snoozed until evening</span>
        </span>
        <span class="snooze-item__actions">
          <button type="button" class="btn btn--water" data-action="water">${DROP}Watered</button>
          <button type="button" class="btn btn--ghost" data-action="wake">Wake up</button>
        </span>`;
      return li;
    }));
  }

  function renderRhythm() {
    const week = DATA.week;
    const total = week.reduce((a, b) => a + b, 0);
    const baseY = 104, x0 = 30, step = 42;
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const parts = [];

    parts.push(`<path d="M14 ${baseY} H 300" stroke="#e0d2b6" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round"/>`);

    week.forEach((count, i) => {
      const x = x0 + i * step;
      const tipY = baseY - (18 + count * 12);
      const isToday = i === todayIndex;
      const stem = isToday ? '#3d6b4f' : '#8aa886';

      parts.push(`<path d="M ${x} ${baseY} C ${x + 2} ${(baseY + tipY) / 2 + 12} ${x - 3} ${tipY + 14} ${x} ${tipY}"
        stroke="${stem}" stroke-width="3" fill="none" stroke-linecap="round"/>`);

      for (let l = 0; l < count; l++) {
        const t = (l + 1) / (count + 0.35);
        const y = tipY + (baseY - tipY) * t;
        const side = l % 2 === 0 ? -1 : 1;
        const fill = (l + i) % 2 ? '#3d6b4f' : '#7fa886';
        parts.push(`<ellipse cx="${x + side * 11}" cy="${y - 3}" rx="9.5" ry="5.6"
          transform="rotate(${side * 24} ${x + side * 11} ${y - 3})" fill="${fill}"/>`);
      }

      if (isToday) {
        parts.push(`<circle cx="${x}" cy="${tipY - 16}" r="11" fill="#f0c265"/>`);
        parts.push(`<text x="${x}" y="${tipY - 12.5}" text-anchor="middle" font-size="11" font-weight="800" fill="#33291f">${count}</text>`);
        parts.push(`<rect x="${x - 17}" y="${baseY + 8}" width="34" height="18" rx="9" fill="#33291f"/>
          <text x="${x}" y="${baseY + 21}" text-anchor="middle" font-size="10.5" font-weight="800" fill="#f6efe3">today</text>`);
      } else {
        parts.push(`<text x="${x}" y="${tipY - 12}" text-anchor="middle" font-size="10" font-weight="700" fill="#97876f">${count}</text>`);
        parts.push(`<text x="${x}" y="${baseY + 21}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#6f604c">${dayNames[i]}</text>`);
      }
    });

    const label = `Care rhythm for this week: ${week
      .map((c, i) => `${dayNames[i]} ${c} ${c === 1 ? 'visit' : 'visits'}${i === todayIndex ? ' (today)' : ''}`)
      .join(', ')}.`;

    el.rhythmFigure.innerHTML = `<svg viewBox="0 0 314 132" role="img" aria-label="${escapeHtml(label)}">${parts.join('')}</svg>`;

    el.rhythmCaption.innerHTML = `<strong>${total} little visits</strong> across seven days — ${total <= 14 ? 'steady beats heroic' : 'a full week of care'}.`;
  }

  function renderNotes() {
    const queue = queueItems();
    const featured = [...queue].sort(byUrgency);
    const calmest = [...queue].sort((a, b) => a.urgency - b.urgency)[0];
    const picks = queue.length
      ? [featured[0], calmest].filter((p, i, arr) => arr.indexOf(p) === i)
      : state.items.slice(0, 2);

    el.notesBody.innerHTML = `<ul class="notes__list">${picks.map((item) => `
      <li class="note-item">
        <span class="note-item__avatar">${plantSvg(item.id)}</span>
        <span><span class="note-item__who">${escapeHtml(item.name)}</span>
        <p>${escapeHtml(NOTES[item.id])}</p></span>
      </li>`).join('')}</ul>`;
  }

  function renderAll() {
    renderHeader();
    renderQueue();
    renderSnoozed();
    renderRhythm();
    renderNotes();
  }

  /* --- Toast + undo ------------------------------------------------------ */

  let toastTimer = null;
  let undoHandler = null;

  function showToast(message, onUndo) {
    el.toastMsg.textContent = message;
    undoHandler = onUndo || null;
    el.toastUndo.hidden = !onUndo;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 7000);

    // small delight: a droplet falls past the toast icon
    el.toast.classList.remove('toast--pour');
    void el.toast.offsetWidth; // restart the animation
    el.toast.classList.add('toast--pour');
  }

  function hideToast() {
    el.toast.hidden = true;
    clearTimeout(toastTimer);
    undoHandler = null;
  }

  el.toastUndo.addEventListener('click', () => {
    if (undoHandler) undoHandler();
    hideToast();
    el.queueHeading.focus({ preventScroll: true });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.toast.hidden) hideToast();
  });

  /* --- Actions ----------------------------------------------------------- */

  function snapshot() {
    state.past.push(state.items.map((i) => ({ ...i, history: [...i.history] })));
    if (state.past.length > 25) state.past.shift();
  }

  function restore() {
    const prev = state.past.pop();
    if (!prev) return;
    state.items = prev;
    renderAll();
    showToast('Brought it back — nothing happened.');
  }

  const findItem = (id) => state.items.find((i) => i.id === id);

  function water(id) {
    const item = findItem(id);
    if (!item) return;
    snapshot();
    item.history = [`${fmtShort} · Watered`, ...item.history];
    item.status = 'done';
    renderAll();
    showToast(`${item.name} is watered. ${REACTIONS[id] || ''}`.trim(), restore);

    // When the focused button disappears with the card, land focus on the
    // next sensible control so keyboard users keep their place.
    const next = queueItems()[0];
    if (next) focusCard(next.id, 'water');
    else if (snoozedItems().length) focusSnoozed(snoozedItems()[0].id, 'wake');
    else el.done.focus({ preventScroll: true });
  }

  function snooze(id) {
    const item = findItem(id);
    if (!item) return;
    snapshot();
    item.status = 'snoozed';
    renderAll();
    showToast(`${item.name} snoozed until evening. No guilt accrued.`, restore);
    focusSnoozed(id, 'wake');
  }

  function wake(id) {
    const item = findItem(id);
    if (!item) return;
    snapshot();
    item.status = 'todo';
    renderAll();
    showToast(`${item.name} is back in the queue.`, restore);
    focusCard(id, 'water');
  }

  function resetDay() {
    snapshot();
    state.items = initialItems();
    renderAll();
    showToast('Morning restored. The queue is yours again.', restore);
  }

  function focusCard(id, action) {
    const card = el.list.querySelector(`.plant[data-id="${id}"]`);
    const btn = card && card.querySelector(`[data-action="${action}"]`);
    if (btn) btn.focus({ preventScroll: true });
  }

  function focusSnoozed(id, action) {
    const row = el.snoozeList.querySelector(`.snooze-item[data-id="${id}"]`);
    const btn = row && row.querySelector(`[data-action="${action}"]`);
    if (btn) btn.focus({ preventScroll: true });
  }

  function toggleDetail(btn) {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
    btn.textContent = open ? 'Details' : 'Hide details';
  }

  /* --- Events ------------------------------------------------------------ */

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const holder = btn.closest('[data-id]');
    if (!holder) return;
    const id = holder.dataset.id;

    switch (btn.dataset.action) {
      case 'water': water(id); break;
      case 'snooze': snooze(id); break;
      case 'wake': wake(id); break;
      case 'toggle': toggleDetail(btn); break;
    }
  });

  el.reset.addEventListener('click', resetDay);

  // focus targets for focus management
  [el.done, el.queueHeading].forEach((n) => n && n.setAttribute('tabindex', '-1'));

  /* --- Boot -------------------------------------------------------------- */

  renderAll();
})();
