/* =========================================================
   Moss · plant companion — app logic
   Plain JS, no framework. Keyboard-first, reduced-motion aware.
   ========================================================= */

(() => {
  'use strict';

  /* ---------- Data ---------- */
  const DATA = {
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
        history: [
          { date: 'Sep 19', text: 'Misted' },
          { date: 'Sep 16', text: 'Watered' },
          { date: 'Sep 12', text: 'New frond unfurled' },
        ],
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
        history: [
          { date: 'Sep 20', text: 'Watered' },
          { date: 'Sep 14', text: 'Rotated' },
          { date: 'Sep 10', text: 'Wiped leaves' },
        ],
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
        history: [
          { date: 'Sep 08', text: 'Watered' },
          { date: 'Sep 01', text: 'New pad noted' },
          { date: 'Aug 22', text: 'Rotated' },
        ],
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
        history: [
          { date: 'Sep 21', text: 'Misted' },
          { date: 'Sep 18', text: 'Watered' },
          { date: 'Sep 15', text: 'Brown edge noted' },
        ],
      },
    ],
    week: [1, 3, 2, 4, 2, 1, 3],
  };

  /* ---------- Inline SVG avatars (expressive, not clip art) ---------- */
  const SVG = {
    fern: (size = '100%') => `
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width="${size}" height="${size}" aria-hidden="true">
        <defs>
          <radialGradient id="potFern" cx="50%" cy="0%" r="80%">
            <stop offset="0%" stop-color="#D58966"/>
            <stop offset="100%" stop-color="#9C5436"/>
          </radialGradient>
        </defs>
        <!-- fronds arching -->
        <g stroke="#3E5A2E" stroke-width="1.6" stroke-linecap="round" fill="none">
          <path d="M50 70 Q 30 48 24 28"/>
          <path d="M50 70 Q 70 48 76 28"/>
          <path d="M50 70 Q 50 50 50 24"/>
          <path d="M50 70 Q 38 56 32 42"/>
          <path d="M50 70 Q 62 56 68 42"/>
          <path d="M50 70 Q 44 60 40 56"/>
          <path d="M50 70 Q 56 60 60 56"/>
        </g>
        <!-- leaf shapes -->
        <g fill="#7A8E58">
          <ellipse cx="24" cy="28" rx="3" ry="9" transform="rotate(-30 24 28)"/>
          <ellipse cx="76" cy="28" rx="3" ry="9" transform="rotate(30 76 28)"/>
          <ellipse cx="50" cy="24" rx="3" ry="9"/>
          <ellipse cx="32" cy="42" rx="2.6" ry="7" transform="rotate(-50 32 42)"/>
          <ellipse cx="68" cy="42" rx="2.6" ry="7" transform="rotate(50 68 42)"/>
          <ellipse cx="40" cy="56" rx="2.2" ry="5.5" transform="rotate(-65 40 56)"/>
          <ellipse cx="60" cy="56" rx="2.2" ry="5.5" transform="rotate(65 60 56)"/>
        </g>
        <g fill="#A2B679">
          <ellipse cx="22" cy="34" rx="2" ry="6" transform="rotate(-30 22 34)"/>
          <ellipse cx="78" cy="34" rx="2" ry="6" transform="rotate(30 78 34)"/>
          <ellipse cx="50" cy="32" rx="2" ry="6"/>
        </g>
        <!-- pot -->
        <path d="M30 70 L 70 70 L 65 92 L 35 92 Z" fill="url(#potFern)"/>
        <ellipse cx="50" cy="70" rx="20" ry="3.6" fill="#7A4329"/>
        <ellipse cx="50" cy="70" rx="18" ry="2.6" fill="#5C2F1B"/>
        <path d="M30 70 L 70 70" stroke="#2A1B12" stroke-width="1" opacity="0.4"/>
      </svg>`,
    pothos: (size = '100%') => `
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width="${size}" height="${size}" aria-hidden="true">
        <defs>
          <radialGradient id="potPothos" cx="50%" cy="0%" r="80%">
            <stop offset="0%" stop-color="#F2EAD0"/>
            <stop offset="100%" stop-color="#C9B998"/>
          </radialGradient>
        </defs>
        <!-- macramé cords -->
        <g stroke="#A89878" stroke-width="1.4" fill="none">
          <line x1="40" y1="22" x2="36" y2="38"/>
          <line x1="60" y1="22" x2="64" y2="38"/>
          <line x1="50" y1="20" x2="50" y2="38"/>
          <line x1="46" y1="22" x2="44" y2="38"/>
          <line x1="54" y1="22" x2="56" y2="38"/>
        </g>
        <!-- pot -->
        <path d="M34 38 L 66 38 L 62 56 L 38 56 Z" fill="url(#potPothos)"/>
        <ellipse cx="50" cy="38" rx="16" ry="3" fill="#9B8C68"/>
        <!-- vines trailing -->
        <path d="M44 56 Q 38 70 32 86" stroke="#3E5A2E" stroke-width="1.6" fill="none"/>
        <path d="M50 56 Q 52 72 50 88" stroke="#3E5A2E" stroke-width="1.6" fill="none"/>
        <path d="M56 56 Q 62 70 68 86" stroke="#3E5A2E" stroke-width="1.6" fill="none"/>
        <!-- heart leaves -->
        <g fill="#6B7F4A">
          <path d="M32 86 c -3 -3 -7 -2 -7 2 c 0 3 4 5 7 7 c 3 -2 7 -4 7 -7 c 0 -4 -4 -5 -7 -2 z"/>
          <path d="M50 88 c -3 -3 -7 -2 -7 2 c 0 3 4 5 7 7 c 3 -2 7 -4 7 -7 c 0 -4 -4 -5 -7 -2 z"/>
          <path d="M68 86 c -3 -3 -7 -2 -7 2 c 0 3 4 5 7 7 c 3 -2 7 -4 7 -7 c 0 -4 -4 -5 -7 -2 z"/>
        </g>
        <g fill="#D6BE6E" opacity="0.85">
          <path d="M30 84 c -1 -2 -3 -2 -3 0 c 0 2 2 3 3 4 c 1 -1 3 -2 3 -4 c 0 -2 -2 -2 -3 0 z" transform="translate(2 1)"/>
          <path d="M48 86 c -1 -2 -3 -2 -3 0 c 0 2 2 3 3 4 c 1 -1 3 -2 3 -4 c 0 -2 -2 -2 -3 0 z" transform="translate(2 1)"/>
        </g>
        <g fill="#A2B679">
          <ellipse cx="38" cy="68" rx="3" ry="4" transform="rotate(-25 38 68)"/>
          <ellipse cx="62" cy="68" rx="3" ry="4" transform="rotate(25 62 68)"/>
        </g>
      </svg>`,
    cactus: (size = '100%') => `
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width="${size}" height="${size}" aria-hidden="true">
        <defs>
          <radialGradient id="potCactus" cx="50%" cy="0%" r="80%">
            <stop offset="0%" stop-color="#D58966"/>
            <stop offset="100%" stop-color="#9C5436"/>
          </radialGradient>
          <radialGradient id="pad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#A2B679"/>
            <stop offset="100%" stop-color="#6B7F4A"/>
          </radialGradient>
        </defs>
        <!-- two bunny-ear pads -->
        <g>
          <ellipse cx="42" cy="58" rx="14" ry="18" fill="url(#pad)"/>
          <ellipse cx="60" cy="58" rx="14" ry="18" fill="url(#pad)"/>
          <ellipse cx="51" cy="68" rx="13" ry="14" fill="url(#pad)"/>
        </g>
        <!-- bunny dots (the namesake) -->
        <g fill="#FBF3DF">
          <circle cx="38" cy="48" r="1.6"/>
          <circle cx="44" cy="52" r="1.6"/>
          <circle cx="36" cy="58" r="1.6"/>
          <circle cx="48" cy="46" r="1.4"/>
          <circle cx="56" cy="48" r="1.6"/>
          <circle cx="64" cy="52" r="1.6"/>
          <circle cx="58" cy="58" r="1.6"/>
          <circle cx="50" cy="58" r="1.4"/>
          <circle cx="48" cy="66" r="1.4"/>
          <circle cx="54" cy="66" r="1.4"/>
        </g>
        <!-- subtle face -->
        <g fill="#3E5A2E">
          <circle cx="48" cy="60" r="1.4"/>
          <circle cx="54" cy="60" r="1.4"/>
        </g>
        <path d="M49 64 Q 51 65.5 53 64" stroke="#3E5A2E" stroke-width="1" fill="none" stroke-linecap="round"/>
        <!-- pot -->
        <path d="M28 70 L 72 70 L 68 92 L 32 92 Z" fill="url(#potCactus)"/>
        <ellipse cx="50" cy="70" rx="22" ry="3.4" fill="#7A4329"/>
        <ellipse cx="50" cy="70" rx="20" ry="2.4" fill="#5C2F1B"/>
      </svg>`,
    calathea: (size = '100%') => `
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" width="${size}" height="${size}" aria-hidden="true">
        <defs>
          <radialGradient id="potCal" cx="50%" cy="0%" r="80%">
            <stop offset="0%" stop-color="#3D4A55"/>
            <stop offset="100%" stop-color="#1F2A33"/>
          </radialGradient>
          <linearGradient id="leafCal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#7A8E58"/>
            <stop offset="100%" stop-color="#4A5C36"/>
          </linearGradient>
        </defs>
        <!-- stems -->
        <path d="M50 70 Q 38 50 30 30" stroke="#4A5C36" stroke-width="2" fill="none"/>
        <path d="M50 70 Q 50 48 50 24" stroke="#4A5C36" stroke-width="2" fill="none"/>
        <path d="M50 70 Q 62 50 70 30" stroke="#4A5C36" stroke-width="2" fill="none"/>
        <!-- round striped leaves -->
        <g>
          <ellipse cx="30" cy="28" rx="14" ry="12" fill="url(#leafCal)" transform="rotate(-30 30 28)"/>
          <ellipse cx="30" cy="28" rx="11" ry="9" fill="none" stroke="#A2B679" stroke-width="1.2" opacity="0.7" transform="rotate(-30 30 28)"/>
          <ellipse cx="30" cy="28" rx="7" ry="6" fill="none" stroke="#C2CC9D" stroke-width="1" opacity="0.7" transform="rotate(-30 30 28)"/>

          <ellipse cx="50" cy="22" rx="15" ry="13" fill="url(#leafCal)"/>
          <ellipse cx="50" cy="22" rx="12" ry="10" fill="none" stroke="#A2B679" stroke-width="1.2" opacity="0.7"/>
          <ellipse cx="50" cy="22" rx="8" ry="6.5" fill="none" stroke="#C2CC9D" stroke-width="1" opacity="0.7"/>

          <ellipse cx="70" cy="28" rx="14" ry="12" fill="url(#leafCal)" transform="rotate(30 70 28)"/>
          <ellipse cx="70" cy="28" rx="11" ry="9" fill="none" stroke="#A2B679" stroke-width="1.2" opacity="0.7" transform="rotate(30 70 28)"/>
          <ellipse cx="70" cy="28" rx="7" ry="6" fill="none" stroke="#C2CC9D" stroke-width="1" opacity="0.7" transform="rotate(30 70 28)"/>
        </g>
        <!-- pot -->
        <path d="M30 70 L 70 70 L 66 92 L 34 92 Z" fill="url(#potCal)"/>
        <ellipse cx="50" cy="70" rx="20" ry="3.4" fill="#1A2228"/>
        <ellipse cx="50" cy="70" rx="18" ry="2.4" fill="#0F161B"/>
      </svg>`,
    water: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 C 8 8 6 12 6 15 a6 6 0 0 0 12 0 c 0 -3 -2 -7 -6 -12 z" fill="currentColor"/></svg>`,
    sun: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21"/><line x1="3" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21" y2="12"/><line x1="5.6" y1="5.6" x2="7" y2="7"/><line x1="17" y1="17" x2="18.4" y2="18.4"/><line x1="18.4" y1="5.6" x2="17" y2="7"/><line x1="7" y1="17" x2="5.6" y2="18.4"/></g></svg>`,
    drop: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 C 8 8 6 13 6 16 a6 6 0 0 0 12 0 c 0 -3 -2 -8 -6 -13 z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
    clock: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    pin: () => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c-4 0-7 3-7 7 0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9" r="2.4" fill="currentColor"/></svg>`,
  };

  /* ---------- State ---------- */
  const state = {
    plants: DATA.plants.map(p => ({
      ...p,
      history: [...p.history],
      state: 'pending',     // pending | done | snoozed
    })),
    selectedId: null,
    lastAction: null,       // { plantId, prevState, prevHistory, action, timeout }
    undoWindow: 6000,
  };

  // Default selection = most urgent pending plant
  function pickDefault() {
    const ordered = [...state.plants].sort((a, b) => b.urgency - a.urgency);
    state.selectedId = ordered[0]?.id || null;
  }

  /* ---------- DOM helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Render cards ---------- */
  function renderCards() {
    const list = $('#cards');
    const tpl = $('#card-tpl');
    list.innerHTML = '';

    const ordered = [...state.plants].sort((a, b) => b.urgency - a.urgency);

    for (const p of ordered) {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = p.id;
      node.dataset.urgency = String(p.urgency);
      node.dataset.state = p.state;

      const btn = $('[data-select]', node);
      const avatar = $('[data-avatar]', node);
      const name = $('[data-name]', node);
      const species = $('[data-species]', node);
      const loc = $('[data-location]', node);
      const task = $('[data-task]', node);
      const due = $('[data-due]', node);
      const status = $('[data-status]', node);

      avatar.innerHTML = SVG[p.id]();
      name.textContent = p.name;
      species.textContent = p.species;
      loc.textContent = p.location;
      task.textContent = p.task;
      due.textContent = p.due;
      status.textContent = p.state === 'done' ? '— watered' : '— snoozed';

      btn.setAttribute('aria-label', `${p.name}, ${p.species}, ${p.due}. Press to see care notes.`);
      btn.setAttribute('aria-pressed', String(p.id === state.selectedId));

      // Mobile inline expand/collapse via [data-selected]
      if (p.id === state.selectedId) {
        node.dataset.selected = 'true';
      }

      list.appendChild(node);
    }

    bindCardEvents();

    const due = state.plants.filter(p => p.urgency >= 1);
    const done = due.filter(p => p.state !== 'pending');
    $('[data-done]').textContent = String(done.length);
    $('[data-total]').textContent = String(due.length);

    // All-done state
    const alldone = $('#alldone');
    const allTended = due.every(p => p.state !== 'pending');
    if (allTended && due.length > 0) {
      alldone.hidden = false;
    } else {
      alldone.hidden = true;
    }
  }

  /* ---------- Render detail ---------- */
  function renderDetail() {
    const root = $('#detail');
    const p = state.plants.find(x => x.id === state.selectedId);
    if (!p) {
      root.innerHTML = `
        <div class="detail__empty">
          <h3 class="detail__name" style="font-size:22px">Choose a plant</h3>
          <p style="color:var(--ink-mute); margin-top:8px;">Tap any plant in the queue to see its light, history, and care notes.</p>
        </div>`;
      return;
    }

    root.innerHTML = `
      <div class="detail__hero">
        <div class="detail__avatar">${SVG[p.id]()}</div>
        <div>
          <h3 class="detail__name" id="detail-name">${p.name}</h3>
          <p class="detail__species">${p.species}</p>
          <span class="detail__loc">${SVG.pin()}<span>${p.location}</span></span>
        </div>
      </div>

      <div class="detail__grid">
        <div class="fact">
          <span class="fact__icon">${SVG.sun()}</span>
          <span>
            <span class="fact__label">Light</span>
            <span class="fact__value">${p.light}</span>
          </span>
        </div>
        <div class="fact">
          <span class="fact__icon">${SVG.drop()}</span>
          <span>
            <span class="fact__label">Today's task</span>
            <span class="fact__value">${p.task} · ${p.due}</span>
          </span>
        </div>
      </div>

      <div class="detail__history">
        <h3>Recent notes</h3>
        <ol class="timeline" role="list">
          ${p.history.map(h => `
            <li>
              <time>${h.date}</time>
              <span>${h.text}</span>
            </li>
          `).join('')}
        </ol>
      </div>

      <div class="detail__note">
        <span>${noteFor(p)}</span>
      </div>

      <div class="detail__actions">
        <button type="button" class="act act--water" data-detail-water>
          ${SVG.water()}<span>${p.state === 'done' ? 'Watered · undo' : 'Mark watered'}</span>
        </button>
        <button type="button" class="act act--snooze" data-detail-snooze>
          ${SVG.clock()}<span>${p.state === 'snoozed' ? 'Snoozed · undo' : 'Snooze a day'}</span>
        </button>
      </div>
    `;

    // Re-mark selected
    $$('#cards .card').forEach(c => {
      c.dataset.selected = String(c.dataset.id === state.selectedId);
    });
  }

  function noteFor(p) {
    const map = {
      fern: 'Ferns sulk when their soil goes fully bone-dry. A gentle shower in the sink resets her mood.',
      pothos: 'Orbit prefers a quarter-turn each visit so her stems don\u2019t lean toward the window.',
      cactus: 'Stick a finger in: if the top inch is dry, give a small drink. If not, leave her be.',
      calathea: 'Drama likes a soft mist and filtered light. Tap-water can crisp her edges; rainwater is dreamy.',
    };
    return map[p.id] || '';
  }

  /* ---------- Bindings ---------- */
  function bindCardEvents() {
    $$('#cards .card').forEach(card => {
      const id = card.dataset.id;
      const select = () => selectPlant(id);
      $('[data-select]', card).addEventListener('click', select);

      const w = $('[data-water]', card);
      const s = $('[data-snooze]', card);
      if (w) w.addEventListener('click', e => { e.stopPropagation(); doAction(id, 'water'); });
      if (s) s.addEventListener('click', e => { e.stopPropagation(); doAction(id, 'snooze'); });
    });
  }

  function bindGlobalEvents() {
    document.addEventListener('click', e => {
      const dw = e.target.closest('[data-detail-water]');
      const ds = e.target.closest('[data-detail-snooze]');
      if (dw) { dw.blur(); doAction(state.selectedId, 'water'); }
      if (ds) { ds.blur(); doAction(state.selectedId, 'snooze'); }
    });

    // Keyboard navigation
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const t = $('#toast');
        if (!t.hidden) hideToast();
      }
      if ((e.key === 'j' || e.key === 'ArrowDown') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        moveSelection(1);
      }
      if ((e.key === 'k' || e.key === 'ArrowUp') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        moveSelection(-1);
      }
    });

    // Greeting
    updateGreeting();

    // Toast undo button
    $('#toastUndo').addEventListener('click', undo);
  }

  function updateGreeting() {
    const h = new Date().getHours();
    let g = 'Good day';
    if (h < 5) g = 'Still up';
    else if (h < 12) g = 'Good morning';
    else if (h < 17) g = 'Good afternoon';
    else if (h < 21) g = 'Good evening';
    else g = 'Good night';
    const el = $('#greeting');
    if (el) el.textContent = `${g}.`;
  }

  function selectPlant(id) {
    state.selectedId = id;
    $$('#cards .card').forEach(c => {
      c.dataset.selected = String(c.dataset.id === id);
      $('[data-select]', c)?.setAttribute('aria-pressed', String(c.dataset.id === id));
    });
    renderDetail();

    // On mobile, scroll detail into view if needed
    if (window.matchMedia('(max-width: 859px)').matches) {
      const det = $('#detail');
      if (det && det.firstElementChild) {
        det.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function moveSelection(delta) {
    const cards = $$('#cards .card').map(c => c.dataset.id);
    if (!cards.length) return;
    const idx = cards.indexOf(state.selectedId);
    const next = cards[(idx + delta + cards.length) % cards.length];
    selectPlant(next);
  }

  /* ---------- Actions ---------- */
  function doAction(id, action) {
    const p = state.plants.find(x => x.id === id);
    if (!p) return;

    // Snapshot for undo
    const snapshot = {
      plantId: id,
      prevState: p.state,
      prevHistory: [...p.history],
      action,
    };

    if (action === 'water') {
      if (p.state === 'done') {
        // Already watered: undo via detail button (toggle off)
        snapshot.action = 'water-toggle-off';
        p.state = 'pending';
        p.history = p.history.filter(h => !(h.text === 'Watered today' && h.date === 'Today'));
      } else {
        p.state = 'done';
        const today = todayLabel();
        p.history = [{ date: today, text: 'Watered today' }, ...p.history].slice(0, 6);
      }
    } else if (action === 'snooze') {
      if (p.state === 'snoozed') {
        snapshot.action = 'snooze-toggle-off';
        p.state = 'pending';
      } else {
        p.state = 'snoozed';
      }
    }

    state.lastAction = snapshot;
    renderCards();
    renderDetail();

    // Visual pulse on the affected card
    const card = $(`#cards .card[data-id="${id}"]`);
    if (card && action === 'water' && snapshot.action === 'water') {
      card.classList.add('is-watered');
      setTimeout(() => card.classList.remove('is-watered'), 520);
    }

    showToast(p, action, snapshot.action);
  }

  function todayLabel() {
    const d = new Date();
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  }

  /* ---------- Toast / Undo ---------- */
  let toastTimer = null;
  function showToast(plant, action, kind) {
    const t = $('#toast');
    const msg = $('#toastMsg');
    const ic = $('#toastIcon');
    t.hidden = false;

    let verb, iconSvg;
    if (kind === 'water') { verb = `Watered ${plant.name}`; iconSvg = SVG.water(); }
    else if (kind === 'snooze') { verb = `Snoozed ${plant.name} a day`; iconSvg = SVG.clock(); }
    else if (kind === 'water-toggle-off') { verb = `Reverted ${plant.name}`; iconSvg = SVG.water(); }
    else if (kind === 'snooze-toggle-off') { verb = `Brought ${plant.name} back`; iconSvg = SVG.clock(); }

    ic.innerHTML = iconSvg;
    msg.textContent = verb;

    requestAnimationFrame(() => t.classList.add('is-on'));

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, state.undoWindow);
  }

  function hideToast() {
    const t = $('#toast');
    if (!t || t.hidden) return;
    t.classList.remove('is-on');
    setTimeout(() => { t.hidden = true; }, 280);
    state.lastAction = null;
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  }

  function undo() {
    const snap = state.lastAction;
    if (!snap) return;
    const p = state.plants.find(x => x.id === snap.plantId);
    if (!p) return;
    p.state = snap.prevState;
    p.history = [...snap.prevHistory];
    state.lastAction = null;
    renderCards();
    renderDetail();
    hideToast();
    announce(`Restored ${p.name} to its earlier state.`);
  }

  /* ---------- Live region ---------- */
  let announceTimer = null;
  function announce(text) {
    const list = $('#cards');
    if (!list) return;
    // Briefly add a live message inside the list region
    list.setAttribute('aria-live', 'polite');
    // Append a hidden message
    const el = document.createElement('span');
    el.setAttribute('role', 'status');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    el.textContent = text;
    list.appendChild(el);
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => el.remove(), 1500);
  }

  /* ---------- Init ---------- */
  function init() {
    pickDefault();
    renderCards();
    renderDetail();
    bindGlobalEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();