/* ==========================================================================
   Moss — gentle plant care
   Plain ES2018+. No frameworks, no fetch, no network calls.
   PLANTS.json is inlined below (fetch() would be a network request, and the
   file must work from file://), so the screen works offline from disk.
   ========================================================================== */
(function () {
  'use strict';

  /* ---- data -------------------------------------------------------------- */

  var DATA = {
    plants: [
      { id: 'fern', name: 'Frida', species: 'Boston fern', location: 'Bathroom', task: 'Water', due: '2 days overdue', urgency: 4, light: 'Low, indirect', lightLevel: 1,
        history: ['Sep 19 · Misted', 'Sep 16 · Watered', 'Sep 12 · New frond'],
        note: 'Humidity gossip, mostly. The bathroom window suits her better than she lets on.' },
      { id: 'pothos', name: 'Orbit', species: 'Golden pothos', location: 'Bookshelf', task: 'Rotate', due: 'Today', urgency: 2, light: 'Medium, indirect', lightLevel: 3,
        history: ['Sep 20 · Watered', 'Sep 14 · Rotated', 'Sep 10 · Wiped leaves'],
        note: 'Trails off the shelf edge on purpose. Leaves wiped Sep 10 — dust is the real enemy here.' },
      { id: 'cactus', name: 'Dot', species: 'Bunny ears cactus', location: 'South window', task: 'Check soil', due: 'Today', urgency: 1, light: 'Bright, direct', lightLevel: 4,
        history: ['Sep 08 · Watered', 'Sep 01 · New pad noted', 'Aug 22 · Rotated'],
        note: 'Water sparingly, doubt generously. The south window does nearly all the work.' },
      { id: 'calathea', name: 'Drama', species: 'Calathea orbifolia', location: 'Bedroom', task: 'Mist', due: 'Tomorrow', urgency: 0, light: 'Medium, filtered', lightLevel: 2,
        history: ['Sep 21 · Misted', 'Sep 18 · Watered', 'Sep 15 · Brown edge noted'],
        note: 'Drama in every sense. Brown edge Sep 15 — filtered light only, no direct sun.' }
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };

  var PASTED = { Water: 'Watered', Rotate: 'Rotated', 'Check soil': 'Checked', Mist: 'Misted' };
  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var TOAST_MS = 7000;

  /* ---- state ------------------------------------------------------------- */

  var state = {
    plants: DATA.plants.map(function (p) {
      return { raw: p, done: false, snoozed: false, snoozedUntil: null, fresh: [] };
    }),
    open: {},          // plantId -> detail panel open
    undo: null,        // { snapshot, text, focusKey }
    toastTimer: null
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var todayIndex = (function () {
    var d = new Date().getDay();            // 0 = Sunday
    return d === 0 ? 6 : d - 1;             // Monday-first index
  })();

  var refs = {
    queue: document.getElementById('queue'),
    queueCount: document.getElementById('queue-count'),
    queueEmpty: document.getElementById('queue-empty'),
    alldone: document.getElementById('alldone'),
    alldoneTitle: document.getElementById('alldone-title'),
    alldoneText: document.getElementById('alldone-text'),
    alldoneList: document.getElementById('alldone-list'),
    rhythm: document.getElementById('rhythm-bars'),
    lightmap: document.getElementById('lightmap'),
    note: document.getElementById('note-text'),
    dayStatus: document.getElementById('day-status'),
    heroTitle: document.getElementById('hero-title'),
    toasts: document.getElementById('toasts'),
    reset: document.getElementById('reset-day')
  };

  var pendingFocus = null;

  /* ---- small helpers ----------------------------------------------------- */

  function icon(name, cls) {
    return '<svg class="art' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#art-' + name + '"></use></svg>';
  }

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    if (html != null) node.innerHTML = html;
    return node;
  }

  function findFocusable(key) {
    return key ? document.querySelector('[data-focus-key="' + key + '"]') : null;
  }

  function snapshot() {
    return JSON.stringify(state.plants.map(function (p) {
      return { done: p.done, snoozed: p.snoozed, snoozedUntil: p.snoozedUntil, fresh: p.fresh.slice() };
    }));
  }

  function restore(json) {
    JSON.parse(json).forEach(function (rec, i) {
      var p = state.plants[i];
      p.done = rec.done;
      p.snoozed = rec.snoozed;
      p.snoozedUntil = rec.snoozedUntil;
      p.fresh = rec.fresh.slice();
    });
  }

  /* ---- derived state ----------------------------------------------------- */

  function statusOf(p) {
    if (p.done) return 'done';
    if (p.snoozed) return 'snoozed';
    var u = p.raw.urgency;
    if (u >= 4) return 'overdue';
    if (u >= 1) return 'today';
    return 'soon';
  }

  function dueTextOf(p) {
    var s = statusOf(p);
    if (s === 'done') return 'Cared for today';
    if (s === 'snoozed') return 'Snoozed until ' + (p.snoozedUntil || 'tomorrow');
    return p.raw.due;
  }

  var RANK = { overdue: 0, today: 1, soon: 2, snoozed: 3, done: 4 };

  function ordered() {
    return state.plants.slice().sort(function (a, b) {
      var d = RANK[statusOf(a)] - RANK[statusOf(b)];
      if (d !== 0) return d;
      var du = b.raw.urgency - a.raw.urgency;
      if (du !== 0) return du;
      return 0;
    });
  }

  function counts() {
    var c = { overdue: 0, today: 0, soon: 0, snoozed: 0, done: 0, left: 0, total: state.plants.length };
    state.plants.forEach(function (p) {
      var s = statusOf(p);
      c[s]++;
      if (s === 'overdue' || s === 'today' || s === 'soon') c.left++;
    });
    return c;
  }

  /* ---- render ------------------------------------------------------------ */

  function meter(level, total) {
    var pips = '';
    for (var i = 1; i <= total; i++) {
      pips += '<span class="meter__pip"' + (i <= level ? ' data-on' : '') + '></span>';
    }
    return pips;
  }

  function historyOf(p) {
    var fresh = p.fresh.map(function (e) {
      return '<li data-fresh>' + esc(e.text) + (e.note ? ' <span class="sr-only">' + esc(e.note) + '</span>' : '') + '</li>';
    });
    var old = p.raw.history.map(function (h) {
      var parts = h.split(' · ');
      return '<li><time>' + esc(parts[0]) + '</time> · ' + esc(parts[1] || '') + '</li>';
    });
    return fresh.concat(old).join('');
  }

  function cardHTML(p) {
    var raw = p.raw;
    var st = statusOf(p);
    var done = PASTED[raw.task] || 'Done';
    var open = !!state.open[raw.id];
    var detailId = 'detail-' + raw.id;

    var pill;
    if (st === 'done') pill = icon('check') + '<span>Cared for</span>';
    else if (st === 'snoozed') pill = icon('zzz') + '<span>Snoozed</span>';
    else if (st === 'overdue') pill = icon('clock') + '<span>Overdue</span>';
    else pill = icon('sun') + '<span>' + esc(raw.due) + '</span>';

    var dueIcon = st === 'overdue' ? 'clock'
      : (st === 'done' ? 'check'
        : (st === 'snoozed' ? 'zzz'
          : ((raw.task === 'Water' || raw.task === 'Mist') ? 'drop' : 'sun')));

    var actions;
    if (st === 'done') {
      actions =
        '<button type="button" class="btn btn--quiet" data-action="undo-care" data-id="' + raw.id + '" data-focus-key="' + raw.id + '-undo">' +
        icon('check') + '<span>Mark not done</span></button>';
    } else if (st === 'snoozed') {
      actions =
        '<button type="button" class="btn btn--ghost" data-action="wake" data-id="' + raw.id + '" data-focus-key="' + raw.id + '-wake">' +
        icon('sun') + '<span>Bring it back today</span></button>';
    } else {
      actions =
        '<button type="button" class="btn btn--primary" data-action="water" data-id="' + raw.id + '" data-focus-key="' + raw.id + '-water" aria-label="' + esc(done + ' ' + raw.name) + '">' +
        icon('drop') + '<span>' + esc(done) + '</span></button>' +
        '<button type="button" class="btn btn--ghost" data-action="snooze" data-id="' + raw.id + '" data-focus-key="' + raw.id + '-snooze" aria-label="Snooze ' + esc(raw.name) + ' until tomorrow">' +
        icon('zzz') + '<span>Snooze</span></button>';
    }

    actions +=
      '<button type="button" class="btn btn--quiet" data-action="details" data-id="' + raw.id + '" data-focus-key="' + raw.id + '-details" ' +
      'aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="' + detailId + '">' +
      '<span>Details</span>' + icon('chevron') + '</button>';

    return '' +
    '<li class="plant" data-plant="' + raw.id + '" data-state="' + st + '" tabindex="-1" id="plant-' + raw.id + '">' +
      '<article class="plant__card" aria-labelledby="name-' + raw.id + '">' +
        '<div class="plant__avatar">' +
          '<svg class="art" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#art-' + raw.id + '"></use></svg>' +
          '<span class="plant__pill" aria-hidden="true">' + pill + '</span>' +
        '</div>' +
        '<div class="plant__main">' +
          '<h3 class="plant__name" id="name-' + raw.id + '">' + esc(raw.name) +
            '<span class="plant__species">' + esc(raw.species) + '</span></h3>' +
          '<p class="plant__meta">' +
            '<span>' + esc(raw.location) + '</span><span class="plant__dot" aria-hidden="true">·</span>' +
            '<span class="plant__task">' + esc(raw.task) + '</span>' +
          '</p>' +
          '<p class="plant__due' + (st === 'overdue' ? ' plant__due--overdue' : '') + '">' + icon(dueIcon) +
            '<span>' + esc(dueTextOf(p)) + '</span></p>' +
          '<div class="plant__actions">' + actions + '</div>' +
        '</div>' +
      '</article>' +
      '<div class="plant__detail" id="' + detailId + '"' + (open ? '' : ' hidden') + '>' +
        '<div class="detail__grid">' +
          '<section class="detail__block">' +
            '<h4>' + icon('sun') + 'Light</h4>' +
            '<div class="meter" role="img" aria-label="Light need: ' + esc(raw.light) + ', ' + raw.lightLevel + ' of 4">' + meter(raw.lightLevel, 4) + '</div>' +
            '<p class="meter__val">' + esc(raw.light) + '</p>' +
          '</section>' +
          '<section class="detail__block">' +
            '<h4>Care &amp; observations</h4>' +
            '<ol class="history">' + historyOf(p) + '</ol>' +
          '</section>' +
          '<section class="detail__block detail__block--note">' +
            '<h4>Moss observed</h4>' +
            '<p class="detail__note">' + esc(raw.note) + '</p>' +
          '</section>' +
        '</div>' +
      '</div>' +
    '</li>';
  }

  function renderRhythm() {
    var max = Math.max.apply(null, DATA.week) || 1;
    var html = DATA.week.map(function (v, i) {
      var h = Math.round((v / max) * 100);
      var isToday = i === todayIndex;
      return '<li' + (isToday ? ' data-today' : '') + '>' +
        '<span class="bar" style="--h:' + h + '%"></span>' +
        '<span class="bar__n" aria-hidden="true">' + v + '</span>' +
        '<span class="bar__day">' + DAY_SHORT[i] + '</span>' +
        '<span class="sr-only">' + DAY_NAMES[i] + ': ' + v + ' care ' + (v === 1 ? 'action' : 'actions') + (isToday ? ' (today)' : '') + '</span>' +
        '</li>';
    }).join('');
    refs.rhythm.innerHTML = html;
  }

  function renderLightmap() {
    refs.lightmap.innerHTML = state.plants.map(function (p) {
      var raw = p.raw;
      return '<li data-plant="' + raw.id + '">' +
        '<span class="lightmap__art" aria-hidden="true"><svg class="art" viewBox="0 0 64 64"><use href="#art-' + raw.id + '"></use></svg></span>' +
        '<span><span class="lightmap__name">' + esc(raw.name) + '</span><br><span class="lightmap__where">' + esc(raw.location) + '</span></span>' +
        '<span class="meter" role="img" aria-label="' + esc(raw.name) + ' needs ' + esc(raw.light) + ' light, ' + raw.lightLevel + ' of 4">' + meter(raw.lightLevel, 4) + '</span>' +
        '</li>';
    }).join('');
  }

  function renderQueue() {
    refs.queue.innerHTML = ordered().map(cardHTML).join('');
  }

  function renderSummary() {
    var c = counts();

    if (c.left === 0 && c.total > 0) {
      if (refs.alldone.hidden) {
        refs.alldone.hidden = false;
        var leaves = el('div', { 'class': 'alldone__leaves', 'aria-hidden': 'true' },
          '<span></span><span></span><span></span><span></span><span></span>');
        refs.alldone.insertBefore(leaves, refs.alldone.firstChild);
      }
      refs.alldoneTitle.textContent = c.done === c.total
        ? 'All ' + c.total + ' are cared for.'
        : 'Nothing urgent left.';
      refs.alldoneText.textContent = c.snoozed
        ? c.snoozed + ' snoozed for tomorrow, quietly.'
        : 'Nothing else today. Go enjoy the window light.';
      refs.alldoneList.innerHTML = state.plants
        .filter(function (p) { return p.done; })
        .map(function (p) { return '<li>' + esc(p.raw.name) + ' · ' + esc(PASTED[p.raw.task] || 'Done') + '</li>'; })
        .join('');
    } else {
      refs.alldone.hidden = true;
    }

    var parts = [];
    if (c.overdue) parts.push(c.overdue + ' overdue');
    if (c.today) parts.push(c.today + ' due today');
    if (c.soon) parts.push(c.soon + ' coming up');
    refs.queueCount.textContent = c.left
      ? parts.join(' · ') + ' — ' + (c.left) + ' of ' + c.total + ' to go'
      : 'All ' + c.total + ' cared for';

    refs.queueEmpty.hidden = state.plants.length !== 0;

    var tone = c.overdue ? 'urgent' : (c.left ? 'calm' : 'clear');
    refs.dayStatus.setAttribute('data-tone', tone);
    refs.dayStatus.textContent = c.overdue
      ? c.overdue + ' plant' + (c.overdue > 1 ? 's' : '') + ' past due'
      : (c.left ? c.left + ' to tend, nothing on fire' : 'Everything watered, nothing burning');

    // Moss's note: a small opinion about whatever is left
    var next = ordered().filter(function (p) { return !p.done && !p.snoozed; })[0];
    if (next) {
      var raw = next.raw;
      if (raw.urgency >= 4) {
        refs.note.textContent = raw.name + ' is ' + raw.due.toLowerCase() + ' and doing that quiet, brittle thing. Start there.';
      } else if (statusOf(next) === 'today') {
        refs.note.textContent = raw.name + ' is on the list for today — ' + raw.task.toLowerCase() + ', nothing dramatic.';
      } else {
        refs.note.textContent = raw.name + ' can wait until tomorrow. The rest of the house is fine.';
      }
    } else {
      refs.note.textContent = 'Nothing left to fuss over. The windowsill is behaving itself.';
    }
  }

  function render(opts) {
    opts = opts || {};
    renderQueue();
    renderSummary();
    if (opts.celebrate) celebrate();
    if (pendingFocus) {
      var target = findFocusable(pendingFocus) || (pendingFocus.split('-')[0] && document.getElementById('plant-' + pendingFocus.split('-')[0]));
      if (target) target.focus({ preventScroll: true });
      pendingFocus = null;
    }
  }

  /* ---- moments of delight ------------------------------------------------ */

  function celebrate() {
    if (reduceMotion.matches) return;
    document.body.classList.add('is-celebrating');
    refs.heroTitle.classList.remove('is-cheer');
    void refs.heroTitle.offsetWidth;
    refs.heroTitle.classList.add('is-cheer');
    window.setTimeout(function () {
      document.body.classList.remove('is-celebrating');
      refs.heroTitle.classList.remove('is-cheer');
    }, 1400);
  }

  function splash(btn) {
    if (reduceMotion.matches || !btn) return;
    var box = el('span', { 'class': 'splash', 'aria-hidden': 'true' });
    for (var i = 0; i < 5; i++) {
      var d = el('span');
      d.style.setProperty('--dx', ((i - 2) * 9 + (i % 2 ? 3 : -3)) + 'px');
      d.style.setProperty('--dy', (-30 - (i % 3) * 9) + 'px');
      d.style.animationDelay = (i * 45) + 'ms';
      box.appendChild(d);
    }
    btn.appendChild(box);
    window.setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 900);
  }

  function settle(plantId) {
    if (reduceMotion.matches) return;
    var li = document.getElementById('plant-' + plantId);
    if (!li) return;
    li.classList.add('is-settling');
    window.setTimeout(function () { li.classList.remove('is-settling'); }, 500);
  }

  /* ---- toasts & undo ----------------------------------------------------- */

  function dismissToast() {
    if (state.toastTimer) { window.clearTimeout(state.toastTimer); state.toastTimer = null; }
    var t = refs.toasts.querySelector('.toast');
    if (!t) return;
    t.classList.add('is-going');
    window.setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
  }

  function toast(opts) {
    dismissToast();
    var t = el('div', { 'class': 'toast' },
      '<span class="toast__art" aria-hidden="true">' + icon(opts.icon || 'drop') + '</span>' +
      '<p class="toast__text">' + opts.text + '</p>' +
      (opts.undoKey
        ? '<span class="toast__undo-wrap"><button type="button" class="btn btn--undo" data-action="undo" data-focus-key="toast-undo">Undo</button></span>'
        : '') +
      '<span class="toast__timer" aria-hidden="true"></span>');
    refs.toasts.appendChild(t);
    state.undo = opts.undoKey ? { snapshot: opts.snapshot, focusKey: opts.focusKey } : null;
    if (opts.undoKey) {
      state.toastTimer = window.setTimeout(function () {
        state.undo = null;
        dismissToast();
      }, TOAST_MS);
    }
  }

  function runUndo() {
    if (!state.undo) return;
    restore(state.undo.snapshot);
    pendingFocus = state.undo.focusKey;
    state.undo = null;
    var t = refs.toasts.querySelector('.toast');
    if (t) {
      t.classList.add('toast--undoing');
      var bar = t.querySelector('.toast__timer');
      if (bar) bar.style.animationDuration = '.3s';
    }
    window.setTimeout(function () { dismissToast(); }, 320);
    render();
  }

  /* ---- actions ----------------------------------------------------------- */

  function plantById(id) {
    for (var i = 0; i < state.plants.length; i++) if (state.plants[i].raw.id === id) return state.plants[i];
    return null;
  }

  function doCare(id, btn) {
    var p = plantById(id);
    if (!p || p.done) return;
    var verb = PASTED[p.raw.task] || 'Done';
    var before = snapshot();

    p.done = true;
    p.snoozed = false;
    p.snoozedUntil = null;
    p.fresh.unshift({ text: 'Today · ' + verb, note: 'added just now' });
    pendingFocus = id + '-undo';
    splash(btn);
    settle(id);

    var allDone = counts().left === 0;
    render();
    if (allDone) celebrate();

    toast({
      icon: 'drop',
      text: '<strong>' + esc(p.raw.name) + '</strong> marked ' + esc(verb.toLowerCase()) + '.',
      undoKey: true,
      snapshot: before,
      focusKey: id + '-undo'
    });
  }

  function doSnooze(id) {
    var p = plantById(id);
    if (!p || p.done || p.snoozed) return;
    var before = snapshot();
    p.snoozed = true;
    p.snoozedUntil = 'tomorrow';
    pendingFocus = id + '-wake';
    render();
    toast({
      icon: 'zzz',
      text: '<strong>' + esc(p.raw.name) + '</strong> snoozed until tomorrow. Moss will not mention it again today.',
      undoKey: true,
      snapshot: before,
      focusKey: id + '-wake'
    });
  }

  function doWake(id) {
    var p = plantById(id);
    if (!p) return;
    var before = snapshot();
    p.snoozed = false;
    p.snoozedUntil = null;
    pendingFocus = id + '-water';
    render();
    toast({
      icon: 'sun',
      text: '<strong>' + esc(p.raw.name) + '</strong> is back in the queue.',
      undoKey: true,
      snapshot: before,
      focusKey: id + '-water'
    });
  }

  function undoCare(id) {
    var p = plantById(id);
    if (!p) return;
    var before = snapshot();
    p.done = false;
    pendingFocus = id + '-water';
    render();
    toast({
      icon: 'sun',
      text: '<strong>' + esc(p.raw.name) + '</strong> is back in the queue.',
      undoKey: true,
      snapshot: before,
      focusKey: id + '-water'
    });
  }

  function resetDay() {
    var before = snapshot();
    state.plants.forEach(function (p) { p.done = false; p.snoozed = false; p.snoozedUntil = null; p.fresh = []; });
    state.open = {};
    pendingFocus = 'reset';
    render();
    toast({
      icon: 'sprout-sm',
      text: 'The day starts over. Water cans back on the shelf.',
      undoKey: true,
      snapshot: before,
      focusKey: 'reset'
    });
  }

  function toggleDetails(id) {
    state.open[id] = !state.open[id];
    render();
  }

  /* ---- events ------------------------------------------------------------ */

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var id = btn.getAttribute('data-id');

    if (action === 'water') doCare(id, btn);
    else if (action === 'snooze') doSnooze(id);
    else if (action === 'wake') doWake(id);
    else if (action === 'undo-care') undoCare(id);
    else if (action === 'details') toggleDetails(id);
    else if (action === 'undo') runUndo();
  });

  refs.reset.addEventListener('click', resetDay);

  // Escape closes the last thing you opened — a small keyboard courtesy.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.activeElement && document.activeElement.getAttribute('data-action') === 'details') {
      var id = document.activeElement.getAttribute('data-id');
      state.open[id] = false;
      pendingFocus = id + '-details';
      render();
      return;
    }
    if (state.undo) runUndo();
  });

  /* ---- boot -------------------------------------------------------------- */

  renderRhythm();
  renderLightmap();
  render();
})();
