/* Moss — plant-care companion
   Data is mirrored from PLANTS.json so the page runs from file:// with no network. */

(function () {
  'use strict';

  var DATA = {
    plants: [
      { id: 'fern', name: 'Frida', species: 'Boston fern', location: 'Bathroom', task: 'Water', due: '2 days overdue', urgency: 4, light: 'Low, indirect', history: ['Sep 19 · Misted', 'Sep 16 · Watered', 'Sep 12 · New frond'] },
      { id: 'pothos', name: 'Orbit', species: 'Golden pothos', location: 'Bookshelf', task: 'Rotate', due: 'Today', urgency: 2, light: 'Medium, indirect', history: ['Sep 20 · Watered', 'Sep 14 · Rotated', 'Sep 10 · Wiped leaves'] },
      { id: 'cactus', name: 'Dot', species: 'Bunny ears cactus', location: 'South window', task: 'Check soil', due: 'Today', urgency: 1, light: 'Bright, direct', history: ['Sep 08 · Watered', 'Sep 01 · New pad noted', 'Aug 22 · Rotated'] },
      { id: 'calathea', name: 'Drama', species: 'Calathea orbifolia', location: 'Bedroom', task: 'Mist', due: 'Tomorrow', urgency: 0, light: 'Medium, filtered', history: ['Sep 21 · Misted', 'Sep 18 · Watered', 'Sep 15 · Brown edge noted'] }
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };

  var TASK = {
    'Water': { verb: 'Watered', icon: 'icon-water' },
    'Rotate': { verb: 'Rotated', icon: 'icon-rotate' },
    'Check soil': { verb: 'Checked', icon: 'icon-soil' },
    'Mist': { verb: 'Misted', icon: 'icon-mist' }
  };

  var WATER_NOTES = {
    fern: 'Every 3–4 days — keep the root ball evenly moist, never soggy',
    pothos: 'Every 7–9 days — let the top two inches of soil dry first',
    cactus: 'Every 3–4 weeks in summer, monthly at most in winter',
    calathea: 'Every 5–7 days — filtered or rainwater, and never cold'
  };

  var DAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  var DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var TODAY = 5;
  var TOMORROW = 6;
  var UNDO_MS = 8000;
  var MAX_SEEDS = 6;

  /* ---------- state ---------- */

  var plants = DATA.plants.map(function (p) {
    return {
      id: p.id, name: p.name, species: p.species, location: p.location,
      task: p.task, due: p.due, urgency: p.urgency, light: p.light, history: p.history,
      done: false, snoozed: false
    };
  });
  var week = DATA.week.slice();
  var selectedId = plants[0].id;
  var panelOpen = false;
  var pendingUndo = null;
  var toastTimer = null;
  var weekPulse = -1;
  var wasAllDone = false;

  var desktop = window.matchMedia('(min-width: 900px)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- dom ---------- */

  var $ = function (id) { return document.getElementById(id); };
  var stage = document.querySelector('.stage');
  var listNow = $('list-now');
  var listLater = $('list-later');
  var listDone = $('list-done');
  var groupNow = $('group-now');
  var groupLater = $('group-later');
  var groupDone = $('group-done');
  var weekGrid = $('week-grid');
  var weekFoot = $('week-foot');
  var tally = $('tally');
  var progressFill = $('progress-fill');
  var progressText = $('progress-text');
  var greetLede = $('greet-lede');
  var queueNote = $('queue-note');
  var alldone = $('alldone');
  var alldoneStats = $('alldone-stats');
  var alldoneUndo = $('alldone-undo');
  var detail = $('detail');
  var cards = {};

  /* ---------- helpers ---------- */

  function byId(id) {
    for (var i = 0; i < plants.length; i++) { if (plants[i].id === id) { return plants[i]; } }
    return null;
  }

  function taskOf(p) { return TASK[p.task] || { verb: 'Tended', icon: 'icon-check' }; }

  function dueLabel(p) {
    if (p.done) { return 'done'; }
    if (p.snoozed) { return 'snoozed to tomorrow'; }
    return p.due.toLowerCase();
  }

  function levelOf(p) {
    if (p.done) { return 'done'; }
    if (p.snoozed || p.due === 'Tomorrow') { return 'later'; }
    if (p.urgency >= 4 || /overdue/.test(p.due)) { return 'overdue'; }
    return 'today';
  }

  function listFor(p) {
    if (p.done) { return listDone; }
    if (p.snoozed || p.due === 'Tomorrow') { return listLater; }
    return listNow;
  }

  function historyIcon(text) {
    if (/water/i.test(text)) { return 'icon-water'; }
    if (/mist/i.test(text)) { return 'icon-mist'; }
    if (/rotat/i.test(text)) { return 'icon-rotate'; }
    if (/new/i.test(text)) { return 'icon-spark'; }
    return 'icon-leaf';
  }

  function svgIcon(id, cls) {
    return '<svg class="' + (cls || 'ico') + '" aria-hidden="true"><use href="#' + id + '"></use></svg>';
  }

  /* ---------- build cards ---------- */

  function buildCard(p) {
    var li = document.createElement('li');
    li.className = 'card';
    li.dataset.id = p.id;
    li.dataset.plant = p.id;
    li.dataset.urgency = String(p.urgency);
    li.innerHTML =
      '<div class="card-top">' +
        '<span class="card-art"><svg viewBox="0 0 72 80" aria-hidden="true"><use href="#plant-' + p.id + '"></use></svg></span>' +
        '<div class="card-id">' +
          '<button type="button" class="card-name" aria-expanded="false" aria-controls="detail">' +
            '<span>' + p.name + '</span><span class="card-caret" aria-hidden="true">&#8250;</span>' +
          '</button>' +
          '<p class="card-meta">' + p.species + ' · ' + p.location + '</p>' +
          '<p class="due-badge"><span class="due-icon"></span><span class="due-text"></span></p>' +
        '</div>' +
      '</div>' +
      '<div class="card-actions">' +
        '<button type="button" class="btn btn-primary btn-done"><span class="btn-ico"></span><span class="btn-label"></span></button>' +
        '<button type="button" class="btn btn-ghost btn-snooze">Snooze</button>' +
        '<button type="button" class="btn btn-quiet btn-undo" hidden>Undo</button>' +
      '</div>';

    var name = li.querySelector('.card-name');
    var doneBtn = li.querySelector('.btn-done');
    var snoozeBtn = li.querySelector('.btn-snooze');
    var undoBtn = li.querySelector('.btn-undo');

    name.addEventListener('click', function () { select(p.id, true); });
    doneBtn.addEventListener('click', function () {
      if (p.done) { applyUndo(); } else { act(p.id, 'done'); }
    });
    snoozeBtn.addEventListener('click', function () { act(p.id, 'snooze'); });
    undoBtn.addEventListener('click', applyUndo);

    cards[p.id] = { li: li, name: name, done: doneBtn, snooze: snoozeBtn, undo: undoBtn };
    return li;
  }

  /* ---------- rendering ---------- */

  function syncCard(p) {
    var c = cards[p.id];
    var li = c.li;
    var t = taskOf(p);
    var lvl = levelOf(p);
    li.dataset.level = lvl;

    var dueIco = li.querySelector('.due-icon');
    var dueText = li.querySelector('.due-text');
    dueIco.innerHTML = p.done ? svgIcon('icon-check') : svgIcon(t.icon);
    dueText.textContent = (p.done ? p.task + ' · done' : p.task + ' · ' + dueLabel(p));

    c.name.setAttribute('aria-label', p.name + ', ' + p.species + ', ' + p.task + ', ' + dueLabel(p) + '. Show care detail.');
    c.name.setAttribute('aria-expanded', (selectedId === p.id && panelOpen) ? 'true' : 'false');

    c.done.querySelector('.btn-ico').innerHTML = svgIcon(t.icon);
    c.done.querySelector('.btn-label').textContent = t.verb;
    c.done.hidden = p.done;
    c.done.setAttribute('aria-label', 'Mark ' + p.task + ' done for ' + p.name);
    c.snooze.hidden = p.done;
    c.snooze.setAttribute('aria-label', 'Snooze ' + p.name + ' until tomorrow');
    c.undo.hidden = !(pendingUndo && pendingUndo.id === p.id);
    c.undo.setAttribute('aria-label', 'Undo the last change to ' + p.name);

    placeCard(p);
  }

  function placeCard(p) {
    var list = listFor(p);
    var li = cards[p.id].li;
    if (li.parentElement !== list) { list.appendChild(li); }
    var items = Array.prototype.slice.call(list.children).filter(function (n) { return n.dataset && n.dataset.urgency; });
    items.sort(function (a, b) { return Number(b.dataset.urgency) - Number(a.dataset.urgency); });
    items.forEach(function (n) { list.appendChild(n); });
  }

  function syncGroups() {
    groupNow.hidden = listNow.children.length === 0;
    groupLater.hidden = listLater.children.length === 0;
    groupDone.hidden = listDone.children.length === 0;
  }

  function syncWeek() {
    weekGrid.innerHTML = '';
    week.forEach(function (count, i) {
      var li = document.createElement('li');
      li.className = 'day' + (i === TODAY ? ' is-today' : '');
      var shown = Math.min(count, MAX_SEEDS);
      li.setAttribute('aria-label', DAY_FULL[i] + ': ' + count + ' care task' + (count === 1 ? '' : 's') + (i === TODAY ? ', today' : ''));

      var stalk = document.createElement('span');
      stalk.className = 'day-stalk';
      for (var k = 0; k < shown; k++) {
        var seed = document.createElement('span');
        seed.className = 'seed' + (i === weekPulse && k === shown - 1 ? ' is-new' : '');
        stalk.appendChild(seed);
      }
      var label = document.createElement('span');
      label.className = 'day-label';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = DAY_SHORT[i];

      li.appendChild(stalk);
      li.appendChild(label);
      weekGrid.appendChild(li);
    });

    var max = 0, min = Infinity, maxI = 0, minI = 0;
    week.forEach(function (n, i) {
      if (n > max) { max = n; maxI = i; }
      if (n < min) { min = n; minI = i; }
    });
    weekFoot.textContent = 'Busiest ' + DAY_FULL[maxI] + ' (' + max + '), quietest ' + DAY_FULL[minI] + ' (' + min + '). Today carries ' + week[TODAY] + '.';
    weekPulse = -1;
  }

  function syncTally() {
    var nowCount = 0, laterCount = 0, doneCount = 0;
    plants.forEach(function (p) {
      if (p.done) { doneCount++; } else if (p.snoozed || p.due === 'Tomorrow') { laterCount++; } else { nowCount++; }
    });

    if (doneCount === plants.length) {
      tally.textContent = 'All tended';
      tally.dataset.state = 'clear';
    } else if (nowCount === 0) {
      tally.textContent = 'Clear for today';
      tally.dataset.state = 'clear';
    } else {
      tally.textContent = nowCount + ' to tend';
      delete tally.dataset.state;
      if (laterCount) { tally.textContent += ' · ' + laterCount + ' tomorrow'; }
    }

    progressFill.style.width = Math.round((doneCount / plants.length) * 100) + '%';
    progressText.textContent = doneCount + ' of ' + plants.length + ' tended';

    var overdue = plants.filter(function (p) { return !p.done && !p.snoozed && levelOf(p) === 'overdue'; });
    if (overdue.length) {
      greetLede.textContent = overdue[0].name + ' has been waiting ' + overdue[0].due.replace(' days overdue', ' days') + '. Everyone else can follow.';
      queueNote.textContent = 'Overdue first, then whatever else is on the shelf.';
    } else if (nowCount) {
      greetLede.textContent = 'Nothing overdue. Just ' + nowCount + ' small thing' + (nowCount === 1 ? '' : 's') + ' on the shelf.';
      queueNote.textContent = 'Still ordered by who asked first.';
    } else {
      greetLede.textContent = 'Everything is tended. The shelf can rest until tomorrow.';
      queueNote.textContent = 'Nothing left today — snoozed plants are waiting below.';
    }
  }

  function syncAllDone() {
    var all = plants.every(function (p) { return p.done; });
    alldone.hidden = !all;
    if (!all) { wasAllDone = false; return; }
    if (!wasAllDone) {
      wasAllDone = true;
      try {
        alldone.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      } catch (e) { /* older browsers: ignore */ }
    }
    alldoneStats.innerHTML = '';
    plants.forEach(function (p) {
      var li = document.createElement('li');
      li.innerHTML = svgIcon(taskOf(p).icon) + '<span>' + taskOf(p).verb + ' ' + p.name + '</span>';
      alldoneStats.appendChild(li);
    });
    alldoneUndo.hidden = !pendingUndo;
  }

  function renderDetail() {
    var p = selectedId ? byId(selectedId) : null;
    if (!p) { detail.hidden = true; return; }

    $('detail-art-use').setAttribute('href', '#plant-' + p.id);
    detail.dataset.plant = p.id;
    $('detail-name').textContent = p.name;
    $('detail-species').textContent = p.species;
    $('detail-where-text').textContent = p.location;
    $('detail-due-text').textContent = p.done ? 'tended' : dueLabel(p);
    $('detail-due').dataset.level = levelOf(p);
    $('detail-light').textContent = p.light;
    $('detail-water').textContent = WATER_NOTES[p.id];

    var dueIco = $('detail-due').querySelector('.ico use');
    if (dueIco) { dueIco.setAttribute('href', p.done ? '#icon-check' : '#' + taskOf(p).icon); }

    var hist = $('detail-history');
    hist.innerHTML = '';
    p.history.forEach(function (entry) {
      var parts = entry.split(' · ');
      var li = document.createElement('li');
      li.innerHTML =
        '<span class="node">' + svgIcon(historyIcon(parts[1] || entry)) + '</span>' +
        '<span class="when">' + (parts[0] || '') + '</span>' +
        '<span class="what"> · ' + (parts[1] || entry) + '</span>';
      hist.appendChild(li);
    });

    var t = taskOf(p);
    var primary = $('detail-primary');
    var snooze = $('detail-snooze');
    if (p.done) {
      primary.hidden = !(pendingUndo && pendingUndo.id === p.id);
      primary.textContent = 'Undo';
      primary.className = 'btn btn-ghost';
      primary.setAttribute('aria-label', 'Undo the last change to ' + p.name);
    } else {
      primary.hidden = false;
      primary.textContent = t.verb;
      primary.className = 'btn btn-primary';
      primary.setAttribute('aria-label', 'Mark ' + p.task + ' done for ' + p.name);
    }
    snooze.hidden = p.done;
    snooze.setAttribute('aria-label', 'Snooze ' + p.name + ' until tomorrow');

    detail.hidden = !(panelOpen || desktop.matches);
    $('detail-close').setAttribute('aria-label', 'Close ' + p.name + ' detail');
  }

  function placeDetail() {
    var p = selectedId ? byId(selectedId) : null;
    if (!desktop.matches && p && panelOpen) {
      var host = cards[p.id].li;
      if (detail.parentElement !== host) { host.appendChild(detail); }
      return;
    }
    if (detail.parentElement !== stage) { stage.appendChild(detail); }
  }

  function render(opts) {
    opts = opts || {};
    plants.forEach(syncCard);
    syncGroups();
    syncWeek();
    syncTally();
    syncAllDone();
    renderDetail();
    placeDetail();
    if (opts.pulse) {
      var c = cards[opts.pulse];
      if (c) {
        c.li.classList.add('just-changed');
        if (opts.perk) { c.li.classList.add('is-perking'); }
        window.setTimeout(function () {
          c.li.classList.remove('just-changed', 'is-perking');
        }, 800);
      }
    }
  }

  /* ---------- toast + undo ---------- */

  function showToast(text, icon, undoable, ms) {
    var toast = $('toast');
    toast.hidden = false;
    $('toast-text').textContent = text;
    $('toast-icon').setAttribute('href', '#' + icon);
    $('toast-undo').hidden = !undoable;

    var timer = $('toast-timer');
    timer.style.animation = 'none';
    void timer.offsetWidth;
    timer.style.animation = '';
    timer.style.animationDuration = (ms || UNDO_MS) + 'ms';

    if (toastTimer) { window.clearTimeout(toastTimer); }
    toastTimer = window.setTimeout(function () {
      if (undoable) { commitUndo(); } else { dismissToast(); }
    }, ms || UNDO_MS);
  }

  function dismissToast() {
    var toast = $('toast');
    var focused = document.activeElement === $('toast-undo');
    toast.hidden = true;
    if (toastTimer) { window.clearTimeout(toastTimer); toastTimer = null; }
    if (focused && selectedId) { cards[selectedId].name.focus(); }
  }

  function clearUndoButtons() {
    plants.forEach(function (p) {
      var c = cards[p.id];
      if (c.undo.hidden === false && document.activeElement === c.undo) { c.name.focus(); }
      c.undo.hidden = true;
    });
    if (alldoneUndo.hidden === false && document.activeElement === alldoneUndo) { alldoneUndo.blur(); }
    alldoneUndo.hidden = true;
    if (pendingUndo) {
      var p = byId(pendingUndo.id);
      if (p && p.done) { renderDetail(); }
    }
    pendingUndo = null;
  }

  function commitUndo() {
    if (!pendingUndo) { return; }
    dismissToast();
    clearUndoButtons();
    render();
  }

  function applyUndo() {
    if (!pendingUndo) { return; }
    var p = byId(pendingUndo.id);
    if (!p) { return; }
    p.done = pendingUndo.done;
    p.snoozed = pendingUndo.snoozed;
    week = pendingUndo.week.slice();
    dismissToast();
    clearUndoButtons();
    render();
    if (desktop.matches) { select(p.id, false); }
    showToast(p.name + ' is back on the list.', 'icon-leaf', false, 3200);
  }

  /* ---------- actions ---------- */

  function act(id, kind) {
    var p = byId(id);
    if (!p) { return; }

    dismissToast();
    clearUndoButtons();

    if (kind === 'done') {
      if (p.done) { return; }
      pendingUndo = { id: id, done: p.done, snoozed: p.snoozed, week: week.slice() };
      p.done = true;
      p.snoozed = false;
      week[TODAY] = Math.min(week[TODAY] + 1, MAX_SEEDS);
      weekPulse = TODAY;
      render({ pulse: id, perk: true });
      showToast(taskOf(p).verb + ' ' + p.name + '.', taskOf(p).icon, true, UNDO_MS);
    } else if (kind === 'snooze') {
      if (p.done) { return; }
      pendingUndo = { id: id, done: p.done, snoozed: p.snoozed, week: week.slice() };
      p.snoozed = true;
      week[TOMORROW] = Math.min(week[TOMORROW] + 1, MAX_SEEDS);
      weekPulse = TOMORROW;
      render({ pulse: id });
      showToast(p.name + ' will wait until tomorrow.', 'icon-moon', true, UNDO_MS);
    }

    if (desktop.matches) {
      select(id, false);
    } else {
      plants.forEach(function (q) { syncCard(q); });
      renderDetail();
      placeDetail();
    }
  }

  /* ---------- selection ---------- */

  function select(id, toggle) {
    if (selectedId === id && toggle && !desktop.matches) {
      panelOpen = !panelOpen;
    } else {
      selectedId = id;
      panelOpen = true;
    }
    var activeWasDetail = detail.contains(document.activeElement);
    renderDetail();
    placeDetail();
    plants.forEach(function (p) { syncCard(p); });
    if (activeWasDetail) { detail.focus && detail.focus(); }
  }

  function closePanel() {
    panelOpen = false;
    renderDetail();
    placeDetail();
    plants.forEach(function (p) { syncCard(p); });
    if (selectedId) { cards[selectedId].name.focus(); }
  }

  /* ---------- reset ---------- */

  function resetDay() {
    dismissToast();
    clearUndoButtons();
    plants.forEach(function (p) { p.done = false; p.snoozed = false; });
    week = DATA.week.slice();
    weekPulse = -1;
    render();
    showToast('A fresh day. Everyone is waiting again.', 'icon-spark', false, 3200);
  }

  /* ---------- init ---------- */

  function init() {
    plants.forEach(function (p) { listNow.appendChild(buildCard(p)); });
    panelOpen = desktop.matches;
    render();

    $('detail-primary').addEventListener('click', function () {
      if (!selectedId) { return; }
      var p = byId(selectedId);
      if (p.done) { applyUndo(); } else { act(selectedId, 'done'); }
    });
    $('detail-snooze').addEventListener('click', function () {
      if (selectedId) { act(selectedId, 'snooze'); }
    });
    $('detail-close').addEventListener('click', closePanel);
    $('toast-undo').addEventListener('click', applyUndo);
    alldoneUndo.addEventListener('click', applyUndo);
    $('reset').addEventListener('click', resetDay);

    document.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { return; }
      if (e.key === 'Escape' && panelOpen && !desktop.matches) {
        e.preventDefault();
        closePanel();
      } else if ((e.key === 'u' || e.key === 'U') && pendingUndo && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        applyUndo();
      }
    });

    var onBreakpoint = function () {
      panelOpen = desktop.matches && !!selectedId;
      render();
    };
    if (desktop.addEventListener) { desktop.addEventListener('change', onBreakpoint); }
    else if (desktop.addListener) { desktop.addListener(onBreakpoint); }

    if (reduceMotion.addEventListener) {
      reduceMotion.addEventListener('change', function () { render(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
