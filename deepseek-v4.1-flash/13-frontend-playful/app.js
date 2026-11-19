'use strict';

/* ==========================================================================
   Moss — care queue behaviour
   State lives in this file only. Nothing is fetched, stored, or sent.
   ========================================================================== */

(function () {
  const data = JSON.parse(document.getElementById('plant-data').textContent);

  const TODAY = new Date(2026, 8, 22); // Saturday, 22 September — the demo's "now".
  const TODAY_INDEX = 5;               // Saturday in the Mon–Sun strip.
  const WEEK_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const WEEK_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const TOTAL = data.plants.length;

  const DONE_LABEL = { Water: 'Watered', Rotate: 'Rotated', 'Check soil': 'Soil checked', Mist: 'Misted' };
  const DONE_STATUS = { Water: 'Watered', Rotate: 'Rotated', 'Check soil': 'Soil checked', Mist: 'Misted' };
  const DONE_PROSE = { Water: 'watered', Rotate: 'rotated', 'Check soil': 'soil checked', Mist: 'misted' };

  const NOTES = {
    fern: {
      blurb: 'Frida is a Boston fern with strong feelings about humidity. She forgives you the moment the shower runs.',
      light: 'The bathroom shelf is her idea of a spa.',
      water: 'Damp, never soggy. Steam from the shower counts as a snack.',
      toastDone: 'Frida is watered. She is being graceful about it.',
      toastSnooze: 'Frida snoozed. She will be dramatic about it tomorrow.'
    },
    pothos: {
      blurb: 'Orbit grows toward whatever is brightest and pretends she doesn’t. A quarter turn keeps her even-tempered.',
      light: 'She leans toward the bookshelf edge; the turn is the point.',
      water: 'Half a mug when the top inch of soil is dry.',
      toastDone: 'Orbit turned toward the window. She seems satisfied.',
      toastSnooze: 'Orbit snoozed until tomorrow. She will keep growing sideways.'
    },
    cactus: {
      blurb: 'Dot is two soft pads and a long memory. She would like to be admired, not watered.',
      light: 'Never once complained about the south window.',
      water: 'Once a month, thoroughly. More is a betrayal.',
      toastDone: 'Dot’s soil is dry two knuckles down. Noted, not watered.',
      toastSnooze: 'Dot snoozed. Dot did not notice.'
    },
    calathea: {
      blurb: 'Drama is a Calathea orbifolia and the name is not a coincidence. She notices everything, especially dry air.',
      light: 'Direct sun would be an insult.',
      water: 'Filtered, room-temperature water. She can tell the difference.',
      toastDone: 'Drama has been misted. She looks pleased, probably.',
      toastSnooze: 'Drama snoozed. She has notes.'
    }
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQuery = window.matchMedia('(max-width: 959px)');

  const state = data.plants.map((plant) => ({
    ...plant,
    status: 'pending', // pending | done | snoozed
    seq: 0,
    history: [...plant.history],
    undo: null
  }));
  const byId = Object.fromEntries(state.map((plant) => [plant.id, plant]));
  const manuscriptOrder = new Map(data.plants.map((plant, index) => [plant.id, index]));

  let selectedId = 'fern';
  let seqCounter = 0;
  let lastActionId = null;
  let toastTimer = null;
  let announceTimer = null;
  let lastDetailMarkup = '';
  let lastWeekSignature = '';

  /* DOM --------------------------------------------------------------------- */

  const careList = document.getElementById('care-list');
  const settledSection = document.getElementById('settled');
  const settledList = document.getElementById('settled-list');
  const settledCount = document.getElementById('settled-count');
  const allDone = document.getElementById('all-done');
  const allDoneTitle = document.getElementById('all-done-title');
  const doneCopy = document.getElementById('done-copy');
  const doneReceipt = document.getElementById('done-receipt');
  const doneWeek = document.getElementById('done-week');
  const doneUndo = document.getElementById('done-undo');
  const queueSub = document.getElementById('queue-sub');
  const meter = document.getElementById('meter');
  const meterFill = document.getElementById('meter-fill');
  const meterCount = document.getElementById('meter-count');
  const weekChart = document.getElementById('week-chart');
  const weekTotal = document.getElementById('week-total');
  const weekCard = document.getElementById('week');
  const detailInner = document.getElementById('detail-inner');
  const announcer = document.getElementById('announcer');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastUndo = document.getElementById('toast-undo');
  const toastClose = document.getElementById('toast-close');
  const queueTitle = document.getElementById('queue-title');

  /* Small helpers ----------------------------------------------------------- */

  function announce(message) {
    window.clearTimeout(announceTimer);
    announcer.textContent = '';
    announceTimer = window.setTimeout(() => {
      announcer.textContent = message;
    }, 60);
  }

  function prefersReduced() {
    return reduceMotion.matches;
  }

  function scrollBehavior() {
    return prefersReduced() ? 'auto' : 'smooth';
  }

  function remainingCount() {
    return state.filter((plant) => plant.status === 'pending').length;
  }

  function sortedPending() {
    return state
      .filter((plant) => plant.status === 'pending')
      .sort((a, b) => b.urgency - a.urgency || manuscriptOrder.get(a.id) - manuscriptOrder.get(b.id));
  }

  function sortedSettled() {
    return state.filter((plant) => plant.status !== 'pending').sort((a, b) => b.seq - a.seq);
  }

  function historyType(event) {
    if (/watered|misted/i.test(event)) return 'water';
    if (/rotat/i.test(event)) return 'light';
    return 'note';
  }

  function daysAgo(dateLabel) {
    if (/^today$/i.test(dateLabel)) return 0;
    const match = dateLabel.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
    if (!match || !(match[1] in MONTHS)) return null;
    const then = new Date(2026, MONTHS[match[1]], Number(match[2]));
    return Math.max(0, Math.round((TODAY - then) / 86400000));
  }

  function relativeDays(days) {
    if (days === null) return 'recently';
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
  }

  function lastWateredDays(plant) {
    const entry = plant.history.find((item) => {
      const [, event = ''] = item.split(' · ');
      return /watered/i.test(event);
    });
    if (!entry) return null;
    const [date] = entry.split(' · ');
    return daysAgo(date);
  }

  function actionWord(plant) {
    return DONE_LABEL[plant.task] || 'Done';
  }

  /* Queue rendering --------------------------------------------------------- */

  function chipFor(plant) {
    if (plant.urgency >= 3) return 'chip--late';
    if (plant.due === 'Today') return 'chip--today';
    return 'chip--tomorrow';
  }

  function markLabel(plant) {
    if (plant.task === 'Check soil') return `Mark ${plant.name}’s soil as checked`;
    return `Mark ${plant.name} as ${actionWord(plant).toLowerCase()}`;
  }

  function actionButtons(plant) {
    const label = actionWord(plant);
    return `
      <button class="btn btn--done" type="button" data-action="done" aria-label="${markLabel(plant)}">
        ${label}
        <svg class="btn-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#icon-check"></use></svg>
      </button>
      <button class="btn btn--ghost" type="button" data-action="snooze" aria-label="Snooze ${plant.name} until tomorrow">Snooze</button>`;
  }

  function careMarkup(plant) {
    const hero = plant.urgency >= 3;
    const current = plant.id === selectedId ? ' aria-current="true"' : '';
    const due = hero
      ? `<span class="stamp">${plant.due}</span>`
      : `<span class="chip ${chipFor(plant)}">${plant.due}</span>`;

    return `
      <li class="care${hero ? ' care--hero' : ''}" data-id="${plant.id}">
        <div class="care-fig" aria-hidden="true">
          <span class="care-blob"></span>
          <svg class="plant" viewBox="0 0 120 120" focusable="false"><use href="#plant-${plant.id}"></use></svg>
        </div>
        <div class="care-body">
          <div class="care-meta">
            <span class="care-loc">${plant.location}</span>
            ${due}
          </div>
          <h2 class="care-name">
            <button class="care-open" type="button" data-action="select" aria-controls="detail"${current}>${plant.name}</button>
          </h2>
          <p class="care-sub">
            <span class="care-species">${plant.species}</span>
            <span class="care-dot" aria-hidden="true">·</span>
            <span class="care-task">${plant.task}</span>
          </p>
        </div>
        <div class="care-actions">${actionButtons(plant)}</div>
      </li>`;
  }

  function settledMarkup(plant) {
    const current = plant.id === selectedId ? ' aria-current="true"' : '';
    const status = plant.status === 'snoozed' ? 'Snoozed · back tomorrow' : `${DONE_STATUS[plant.task]} · just now`;
    return `
      <li class="settled-row" data-id="${plant.id}">
        <span class="settled-fig" aria-hidden="true">
          <svg viewBox="0 0 120 120" focusable="false"><use href="#plant-${plant.id}"></use></svg>
        </span>
        <div class="settled-main">
          <p class="settled-name">
            <button class="care-open" type="button" data-action="select" aria-controls="detail"${current}>${plant.name}</button>
          </p>
          <p class="settled-status">
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#${plant.status === 'snoozed' ? 'icon-clock' : 'icon-check'}"></use></svg>
            ${status}
          </p>
        </div>
        <button class="settled-undo" type="button" data-action="undo" aria-label="Undo today’s update for ${plant.name}">Undo</button>
      </li>`;
  }

  /* Week rendering ---------------------------------------------------------- */

  function weekValues() {
    const values = [...data.week];
    const tended = state.filter((plant) => plant.status === 'done').length;
    values[TODAY_INDEX] += tended;
    return values;
  }

  function weekSummary(values) {
    const total = values.reduce((sum, value) => sum + value, 0);
    const days = values
      .map((value, index) => (index === TODAY_INDEX ? `${WEEK_LONG[index]} ${value} so far` : `${WEEK_LONG[index]} ${value}`))
      .join(', ');
    return `Weekly care rhythm. ${days}. ${total} care moments this week.`;
  }

  function renderWeek() {
    const values = weekValues();
    const total = values.reduce((sum, value) => sum + value, 0);
    const signature = values.join('-');
    weekTotal.textContent = `${total} moments`;
    weekChart.setAttribute('aria-label', weekSummary(values));
    if (signature === lastWeekSignature) return;
    lastWeekSignature = signature;

    const max = Math.max(4, ...values);
    weekChart.innerHTML = values
      .map((value, index) => {
        const height = 24 + (value / max) * 62;
        const leaves = Array.from({ length: value }, (_, leaf) => {
          const bottom = 6 + ((leaf + 0.55) / value) * 80;
          const side = leaf % 2 === 0 ? 'l' : 'r';
          return `<span class="wk-leaf wk-leaf--${side}" style="bottom:${bottom.toFixed(1)}%"></span>`;
        }).join('');
        return `
          <div class="wk-day${index === TODAY_INDEX ? ' is-today' : ''}">
            <div class="wk-plot">
              <div class="wk-stem" style="--h:${height.toFixed(1)}%;animation-delay:${index * 45}ms">${leaves}</div>
            </div>
            <span class="wk-label">${WEEK_SHORT[index]}</span>
          </div>`;
      })
      .join('');
  }

  /* Detail rendering -------------------------------------------------------- */

  function detailMarkup(plant) {
    const note = NOTES[plant.id];
    const settled = plant.status !== 'pending';
    const last = lastWateredDays(plant);
    const timeline = plant.history
      .slice(0, 4)
      .map((entry) => {
        const [date, event = ''] = entry.split(' · ');
        const type = historyType(event);
        const tag = type === 'water' ? 'Water' : type === 'light' ? 'Light' : 'Note';
        return `
          <li class="tl-item tl-item--${type}">
            <span class="tl-date">${date}</span>
            <span class="tl-dot" aria-hidden="true"></span>
            <span class="tl-text"><span>${event}</span><span class="tl-tag">${tag}</span></span>
          </li>`;
      })
      .join('');

    const badge = settled
      ? `<span class="settled-badge" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><use href="#${plant.status === 'snoozed' ? 'icon-clock' : 'icon-check'}"></use></svg></span>`
      : '';

    const footer = settled
      ? `<div class="detail-settled">
           <span class="status-pill">
             <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#${plant.status === 'snoozed' ? 'icon-clock' : 'icon-check'}"></use></svg>
             ${plant.status === 'snoozed' ? 'Snoozed to tomorrow' : `${DONE_STATUS[plant.task]} · today`}
           </span>
           <button class="btn btn--ghost" type="button" data-action="undo" aria-label="Undo today’s update for ${plant.name}">Undo</button>
         </div>`
      : `<div class="detail-actions">
           <button class="btn btn--done" type="button" data-action="done" aria-label="${markLabel(plant)}">
             ${actionWord(plant)}
             <svg class="btn-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#icon-check"></use></svg>
           </button>
           <button class="btn btn--ghost" type="button" data-action="snooze" aria-label="Snooze ${plant.name} until tomorrow">Snooze</button>
         </div>`;

    return `
      <article class="detail-card" data-id="${plant.id}">
        <div class="detail-top">
          <p class="eyebrow">Field notes</p>
          <button class="back-link" type="button" data-action="back">
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><use href="#icon-arrow"></use></svg>
            Back to the list
          </button>
        </div>
        <div class="detail-head">
          <div>
            <h2 id="detail-title" tabindex="-1">${plant.name}</h2>
            <p class="detail-species"><em>${plant.species}</em> · ${plant.location}</p>
          </div>
          <div class="detail-figure">
            <span class="detail-blob" aria-hidden="true"></span>
            <svg class="plant" viewBox="0 0 120 120" role="img" aria-label="${plant.name}, ${plant.species}"><use href="#plant-${plant.id}"></use></svg>
            ${badge}
          </div>
        </div>
        <p class="detail-blurb">${note.blurb}</p>
        <div class="facts">
          <div class="fact">
            <span class="fact-icon fact-icon--sun" aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false"><use href="#icon-sun"></use></svg>
            </span>
            <div>
              <p class="fact-label">Light</p>
              <p class="fact-value">${plant.light}</p>
              <p class="fact-note">${note.light}</p>
            </div>
          </div>
          <div class="fact">
            <span class="fact-icon fact-icon--drop" aria-hidden="true">
              <svg viewBox="0 0 20 20" focusable="false"><use href="#icon-drop"></use></svg>
            </span>
            <div>
              <p class="fact-label">Water</p>
              <p class="fact-value">Last watered ${relativeDays(last)}</p>
              <p class="fact-note">${note.water}</p>
            </div>
          </div>
        </div>
        <div class="timeline">
          <h3>Observations &amp; care</h3>
          <ol>${timeline}</ol>
        </div>
        ${footer}
      </article>`;
  }

  function renderDetail(force) {
    const plant = byId[selectedId];
    const markup = detailMarkup(plant);
    if (!force && markup === lastDetailMarkup) return;
    lastDetailMarkup = markup;
    detailInner.innerHTML = markup;
  }

  /* Full render ------------------------------------------------------------- */

  function render(options = {}) {
    const pending = sortedPending();
    const settled = sortedSettled();

    careList.innerHTML = pending.map(careMarkup).join('');
    careList.hidden = pending.length === 0;

    settledSection.hidden = settled.length === 0;
    settledList.innerHTML = settled.map(settledMarkup).join('');
    settledCount.textContent = settled.length ? `${settled.length} of ${TOTAL}` : '';

    const tended = settled.length;
    meter.setAttribute('aria-valuenow', String(tended));
    meterFill.style.width = `${(tended / TOTAL) * 100}%`;
    meterFill.dataset.empty = tended === 0 ? 'true' : 'false';
    meterCount.textContent = String(tended);

    const complete = pending.length === 0;
    allDone.hidden = !complete;

    if (complete) {
      const anySnoozed = settled.some((plant) => plant.status === 'snoozed');
      allDoneTitle.textContent = anySnoozed ? 'Today is settled.' : 'All four, tended.';
      doneCopy.textContent = anySnoozed
        ? 'Tended or tucked away. Nothing else needs you today.'
        : 'Everyone has had their moment. The rest of the day is yours.';
      doneReceipt.textContent = settled
        .slice()
        .sort((a, b) => a.seq - b.seq)
        .map((plant) =>
          plant.status === 'snoozed'
            ? `${plant.name} snoozed to tomorrow`
            : `${plant.name} ${DONE_PROSE[plant.task]}`
        )
        .join(' · ');
      doneUndo.hidden = !lastActionId;
      doneUndo.setAttribute('aria-label', lastActionId ? `Undo the last action, for ${byId[lastActionId].name}` : 'Undo the last action');
      queueSub.textContent = 'The list is clear. The plants are as happy as they get.';
    } else {
      queueSub.textContent = 'Sorted by urgency. Overdue plants first, feelings second.';
    }

    renderWeek();
    renderDetail();

    if (options.focus === 'next') {
      focusNextPending();
    } else if (options.focus === 'detail') {
      const heading = document.getElementById('detail-title');
      if (heading) heading.focus({ preventScroll: true });
    } else if (options.focus === 'item' && options.focusId) {
      const target = document.querySelector(`[data-id="${options.focusId}"] .care-open`);
      if (target) target.focus();
    }
  }

  function focusNextPending() {
    const next = careList.querySelector('.care-open');
    if (next) {
      next.focus();
    } else {
      allDoneTitle.focus();
    }
  }

  /* Actions ----------------------------------------------------------------- */

  function completePlant(plant, source) {
    if (plant.status !== 'pending') return;

    plant.undo = { status: plant.status, history: [...plant.history], seq: plant.seq };
    plant.status = 'done';
    plant.seq = ++seqCounter;
    plant.history.unshift(`Today · ${DONE_STATUS[plant.task]}`);
    lastActionId = plant.id;

    render({ focus: source === 'detail' ? 'detail' : 'next' });

    const left = remainingCount();
    if (left === 0) {
      hideToast(true);
      allDoneTitle.focus();
    }
    // The all-done panel is the reward (and carries its own undo), so no toast on top of it.
    if (left > 0) {
      showToast(`${NOTES[plant.id].toastDone} ${left} of ${TOTAL} still waiting.`, plant.id);
    }
    announce(
      left === 0
        ? `${plant.name} ${DONE_PROSE[plant.task]}. Today’s queue is clear.`
        : `${plant.name} ${DONE_PROSE[plant.task]}. ${left} of ${TOTAL} still waiting.`
    );
  }

  function snoozePlant(plant, source) {
    if (plant.status !== 'pending') return;

    plant.undo = { status: plant.status, history: [...plant.history], seq: plant.seq };
    plant.status = 'snoozed';
    plant.seq = ++seqCounter;
    plant.history.unshift('Today · Snoozed to tomorrow');
    lastActionId = plant.id;

    render({ focus: source === 'detail' ? 'detail' : 'next' });

    const left = remainingCount();
    if (left === 0) {
      hideToast(true);
      allDoneTitle.focus();
    }
    if (left > 0) {
      showToast(`${NOTES[plant.id].toastSnooze} ${left} of ${TOTAL} still waiting.`, plant.id);
    }
    announce(
      left === 0
        ? `${plant.name} snoozed until tomorrow. Today’s queue is clear.`
        : `${plant.name} snoozed until tomorrow. ${left} of ${TOTAL} still waiting.`
    );
  }

  function undoPlant(id, options = {}) {
    const plant = byId[id];
    if (!plant || !plant.undo) return;
    const snapshot = plant.undo;

    plant.status = snapshot.status;
    plant.history = [...snapshot.history];
    plant.seq = snapshot.seq;
    plant.undo = null;
    if (lastActionId === id) lastActionId = null;

    hideToast(true);
    render({ focus: 'item', focusId: id, ...options });
    announce(`${plant.name} is back in the queue.`);
  }

  /* Selection --------------------------------------------------------------- */

  function selectPlant(id, options = {}) {
    const plant = byId[id];
    if (!plant) return;
    selectedId = id;

    document.querySelectorAll('.care-open').forEach((button) => {
      const holder = button.closest('[data-id]');
      if (holder && holder.dataset.id === id) {
        button.setAttribute('aria-current', 'true');
      } else {
        button.removeAttribute('aria-current');
      }
    });

    renderDetail();
    announce(`Showing ${plant.name}, ${plant.species}.`);

    if (options.scroll && mobileQuery.matches) {
      document.getElementById('detail').scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      const heading = document.getElementById('detail-title');
      if (heading) heading.focus({ preventScroll: true });
    }
  }

  /* Toast ------------------------------------------------------------------- */

  function autoHideToast() {
    if (toast.contains(document.activeElement)) {
      toastTimer = window.setTimeout(autoHideToast, 3000);
      return;
    }
    hideToast();
  }

  function showToast(message, undoId) {
    toastMsg.textContent = message;
    toastUndo.dataset.id = undoId;
    toastUndo.setAttribute('aria-label', `Undo today’s update for ${byId[undoId] ? byId[undoId].name : 'this plant'}`);
    toast.hidden = false;
    toast.classList.remove('is-visible', 'is-paused');
    // Restart the CSS entrance and countdown cleanly.
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(autoHideToast, 9000);
  }

  function hideToast(immediate) {
    window.clearTimeout(toastTimer);
    toastTimer = null;
    const hadFocus = toast.contains(document.activeElement);
    toast.classList.remove('is-visible', 'is-paused');
    if (immediate) {
      toast.hidden = true;
      if (hadFocus) {
        const fallback = document.querySelector('.care-open') || queueTitle;
        fallback.focus();
      }
    } else {
      window.setTimeout(() => {
        if (!toast.classList.contains('is-visible')) toast.hidden = true;
      }, 240);
    }
  }

  function pauseToast() {
    window.clearTimeout(toastTimer);
    toast.classList.add('is-paused');
  }

  function resumeToast() {
    if (toast.hidden) return;
    toast.classList.remove('is-paused');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(autoHideToast, 4000);
  }

  /* Events ------------------------------------------------------------------ */

  careList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const item = button.closest('[data-id]');
    if (!item) return;
    const plant = byId[item.dataset.id];
    const action = button.dataset.action;

    if (action === 'select') selectPlant(plant.id, { scroll: true });
    if (action === 'done') completePlant(plant, 'queue');
    if (action === 'snooze') snoozePlant(plant, 'queue');
  });

  settledList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const item = button.closest('[data-id]');
    if (!item) return;

    if (button.dataset.action === 'select') selectPlant(item.dataset.id, { scroll: true });
    if (button.dataset.action === 'undo') undoPlant(item.dataset.id);
  });

  detailInner.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const plant = byId[selectedId];
    if (!plant) return;

    if (button.dataset.action === 'done') completePlant(plant, 'detail');
    if (button.dataset.action === 'snooze') snoozePlant(plant, 'detail');
    if (button.dataset.action === 'undo') undoPlant(plant.id, { focus: 'detail' });
    if (button.dataset.action === 'back') {
      const target = document.querySelector(`[data-id="${plant.id}"] .care-open`) || careList.querySelector('.care-open');
      if (target) target.focus();
      else queueTitle.focus();
    }
  });

  doneWeek.addEventListener('click', () => {
    weekCard.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    weekCard.focus({ preventScroll: true });
    announce(weekChart.getAttribute('aria-label'));
  });

  doneUndo.addEventListener('click', () => {
    if (lastActionId) undoPlant(lastActionId);
  });

  toastUndo.addEventListener('click', () => {
    if (toastUndo.dataset.id) undoPlant(toastUndo.dataset.id);
  });

  toastClose.addEventListener('click', () => hideToast(true));
  toast.addEventListener('pointerenter', pauseToast);
  toast.addEventListener('pointerleave', resumeToast);
  toast.addEventListener('focusin', pauseToast);
  toast.addEventListener('focusout', (event) => {
    if (!toast.contains(event.relatedTarget)) resumeToast();
  });

  function arrowNavigate(event, container) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...container.querySelectorAll('.care-open')];
    const index = buttons.indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  careList.addEventListener('keydown', (event) => arrowNavigate(event, careList));
  settledList.addEventListener('keydown', (event) => arrowNavigate(event, settledList));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !toast.hidden) {
      hideToast(true);
    }
  });

  /* Go ---------------------------------------------------------------------- */

  render();
})();
