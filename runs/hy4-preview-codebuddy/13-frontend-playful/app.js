/* ============================================================
   Moss — gentle household plant-care companion
   Plain ES2019+, no dependencies, no network.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- data ------------------------------------------------
     PLANTS.json is the source of truth when the page is served over
     http(s). A verbatim copy lives here so the screen also works when
     opened straight from disk (where fetch() is blocked).
  ---------------------------------------------------------------- */
  var FALLBACK = {
    plants: [
      {"id":"fern","name":"Frida","species":"Boston fern","location":"Bathroom","task":"Water","due":"2 days overdue","urgency":4,"light":"Low, indirect","history":["Sep 19 · Misted","Sep 16 · Watered","Sep 12 · New frond"]},
      {"id":"pothos","name":"Orbit","species":"Golden pothos","location":"Bookshelf","task":"Rotate","due":"Today","urgency":2,"light":"Medium, indirect","history":["Sep 20 · Watered","Sep 14 · Rotated","Sep 10 · Wiped leaves"]},
      {"id":"cactus","name":"Dot","species":"Bunny ears cactus","location":"South window","task":"Check soil","due":"Today","urgency":1,"light":"Bright, direct","history":["Sep 08 · Watered","Sep 01 · New pad noted","Aug 22 · Rotated"]},
      {"id":"calathea","name":"Drama","species":"Calathea orbifolia","location":"Bedroom","task":"Mist","due":"Tomorrow","urgency":0,"light":"Medium, filtered","history":["Sep 21 · Misted","Sep 18 · Watered","Sep 15 · Brown edge noted"]}
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };

  var DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  var MOBILE = window.matchMedia('(max-width: 999px)');

  var state = {
    plants: [],
    week: [],
    openId: null,
    peek: 0,          // 0 = today, 1 = tomorrow (rhythm highlight)
    lastTrigger: null,
    undo: null,
    toastTimer: null
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  /* ---------- tiny helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function announce(msg) { $('#live').textContent = msg; }

  function parseDue(text) {
    var s = String(text).toLowerCase();
    var m = s.match(/(\d+)\s+day(?:s)?\s+overdue/);
    if (m) return -parseInt(m[1], 10);
    if (s.indexOf('tomorrow') > -1) return 1;
    var n = s.match(/in\s+(\d+)\s+day/);
    if (n) return parseInt(n[1], 10);
    return 0;                                  // "today" and anything unparseable
  }

  function dueLabel(offset) {
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Tomorrow';
    if (offset < 0) {
      var n = -offset;
      return n + ' day' + (n > 1 ? 's' : '') + ' overdue';
    }
    return 'In ' + offset + ' days';
  }

  function completeVerb(task) {
    var t = String(task).toLowerCase();
    if (t.indexOf('water') > -1) return 'Watered';
    if (t.indexOf('rotat') > -1) return 'Rotated';
    if (t.indexOf('mist') > -1) return 'Misted';
    if (t.indexOf('check') > -1) return 'Checked';
    if (t.indexOf('feed') > -1) return 'Fed';
    return 'Done';
  }

  function lightLevel(light) {
    var l = String(light).toLowerCase();
    if (l.indexOf('bright') > -1) return 5;
    if (l.indexOf('medium') > -1) return 3;
    return 2;                                   // low
  }

  function soilGuess(p) {
    if (p.done) return 'Just tended';
    if (p.offset < -1) return "Bone dry — Moss's guess";
    if (p.offset < 0) return "Dry on top — Moss's guess";
    if (p.task.toLowerCase().indexOf('water') > -1) return "Getting thirsty — Moss's guess";
    if (p.urgency >= 2) return "Still damp — Moss's guess";
    return "Comfortable — Moss's guess";
  }

  function lastWatered(p) {
    for (var i = 0; i < p.history.length; i++) {
      if (/water/i.test(p.history[i])) {
        var when = p.history[i].split('·')[0].trim();
        return /today/i.test(when) ? 'today' : when;
      }
    }
    return 'a while ago';
  }

  /* ============================================================
     Illustrations — everything is generated SVG
     ============================================================ */
  function quad(p0, c, p1, t) {
    var u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
    };
  }
  function quadAngle(p0, c, p1, t) {
    var dx = 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x);
    var dy = 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y);
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }

  // A leaf rooted at (x,y) growing toward -y, rotated by `rot` degrees.
  function leaf(x, y, len, wid, rot, fill, stripes) {
    var w = wid, l = len;
    var d = 'M0 0 C ' + w + ' ' + (-l * 0.26) + ' ' + (w * 0.92) + ' ' + (-l * 0.76) +
            ' 0 ' + (-l) + ' C ' + (-w * 0.92) + ' ' + (-l * 0.76) + ' ' + (-w) + ' ' + (-l * 0.26) + ' 0 0 Z';
    var out = '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')">' +
      '<path class="lf" fill="' + fill + '" d="' + d + '"/>';
    if (stripes) {
      for (var i = 1; i <= stripes; i++) {
        var yy = -l * (i / (stripes + 1));
        var ww = w * (0.55 + 0.3 * Math.sin(Math.PI * i / (stripes + 1)));
        out += '<path class="vein" d="M0 ' + yy.toFixed(1) + ' Q ' + (ww * 0.5).toFixed(1) + ' ' +
               (yy - 3).toFixed(1) + ' ' + ww.toFixed(1) + ' ' + (yy + 1).toFixed(1) + '"/>';
        out += '<path class="vein" d="M0 ' + yy.toFixed(1) + ' Q ' + (-ww * 0.5).toFixed(1) + ' ' +
               (yy - 3).toFixed(1) + ' ' + (-ww).toFixed(1) + ' ' + (yy + 1).toFixed(1) + '"/>';
      }
    }
    out += '<path class="vein" d="M0 ' + (-l * 0.08).toFixed(1) + ' L0 ' + (-l * 0.9).toFixed(1) + '"/></g>';
    return out;
  }

  function pot(cx, top, w, h) {
    var x = cx - w / 2;
    return '<ellipse class="soil" cx="' + cx + '" cy="' + top + '" rx="' + (w / 2 - 3) + '" ry="4.5"/>' +
      '<path class="pot" d="M' + x + ' ' + top + ' L' + (x + w) + ' ' + top +
      ' L' + (x + w - 8) + ' ' + (top + h) +
      ' Q' + cx + ' ' + (top + h + 7) + ' ' + (x + 8) + ' ' + (top + h) + ' Z"/>' +
      '<rect class="pot-rim" x="' + (x - 4) + '" y="' + (top - 9) + '" width="' + (w + 8) + '" height="13" rx="6"/>';
  }

  function frond(p0, c, p1, size) {
    var out = '<path class="stem" d="M' + p0.x + ' ' + p0.y + ' Q' + c.x + ' ' + c.y + ' ' + p1.x + ' ' + p1.y + '"/>';
    for (var i = 1; i <= 9; i++) {
      var t = i / 10;
      var pt = quad(p0, c, p1, t);
      var a = quadAngle(p0, c, p1, t);
      var s = size * (1 - t * 0.55);
      if (s < 4) continue;
      out += leaf(pt.x, pt.y, s, s * 0.36, a + (i % 2 ? 0 : 180), i % 2 ? '#5f9159' : '#79a86a');
    }
    return out;
  }

  var PORTRAITS = {
    // Boston fern — arching fronds, fine leaflets
    fern: function () {
      var base = { x: 100, y: 148 }, out = '';
      var spread = [-62, -34, 0, 34, 62];
      var heights = [96, 118, 132, 116, 92];
      for (var i = 0; i < spread.length; i++) {
        var tip = { x: 100 + spread[i], y: 150 - heights[i] };
        var ctl = { x: 100 + spread[i] * 0.32, y: 150 - heights[i] * 0.82 };
        out += frond(base, ctl, tip, 19);
      }
      return out + pot(100, 150, 74, 38);
    },
    // Golden pothos — a trailing vine of alternating leaves
    pothos: function () {
      var p0 = { x: 100, y: 146 }, c = { x: 152, y: 108 }, p1 = { x: 138, y: 186 };
      var out = '<path class="stem" d="M' + p0.x + ' ' + p0.y + ' Q' + c.x + ' ' + c.y + ' ' + p1.x + ' ' + p1.y + '"/>';
      for (var i = 0; i <= 8; i++) {
        var t = i / 8;
        var pt = quad(p0, c, p1, t);
        var a = quadAngle(p0, c, p1, t);
        var s = 34 - t * 12;
        out += leaf(pt.x, pt.y, s, s * 0.72, a + (i % 2 ? 0 : 180), i % 2 ? '#5f9159' : '#8fb862');
      }
      out += leaf(96, 148, 44, 27, -52, '#6f9f5f');
      out += leaf(104, 148, 38, 24, 46, '#8fb862');
      return out + pot(100, 150, 74, 38);
    },
    // Bunny ears cactus — stacked pads with spines
    cactus: function () {
      var out = '';
      function pad(cx, cy, rx, ry, rot) {
        var g = '<g transform="translate(' + cx + ' ' + cy + ') rotate(' + rot + ')">' +
          '<ellipse class="lf" fill="#5f9159" rx="' + rx + '" ry="' + ry + '"/>';
        for (var i = 0; i < 10; i++) {
          var a = (i / 10) * Math.PI * 2;
          var ex = rx * Math.cos(a), ey = ry * Math.sin(a);
          var n = Math.hypot(ex / rx, ey / ry) || 1;
          g += '<path class="spine" d="M' + ex.toFixed(1) + ' ' + ey.toFixed(1) + ' L' +
               (ex / n + ex * 0.08).toFixed(1) + ' ' + (ey / n + ey * 0.08).toFixed(1) + '"/>';
        }
        return g + '</g>';
      }
      out += pad(74, 116, 16, 25, -17);
      out += pad(126, 120, 15, 23, 15);
      out += pad(100, 152, 23, 31, 0);
      out += '<circle class="flower" cx="74" cy="90" r="6"/><circle class="flower" cx="126" cy="96" r="5"/>';
      return out + pot(100, 168, 66, 30);
    },
    // Calathea orbifolia — big striped round leaves
    calathea: function () {
      var out = '';
      out += '<path class="stem" d="M100 152 C 96 132 90 118 84 108"/>';
      out += '<path class="stem" d="M100 152 C 106 134 112 122 118 112"/>';
      out += '<path class="stem" d="M100 152 C 100 140 101 132 100 124"/>';
      out += leaf(84, 110, 62, 44, -14, '#4d8256', 5);
      out += leaf(118, 113, 54, 38, 15, '#79a86a', 4);
      out += leaf(100, 126, 30, 20, 2, '#9dc07c', 3);
      return out + pot(100, 152, 76, 36);
    }
  };

  function portrait(id) {
    var fn = PORTRAITS[id] || PORTRAITS.fern;
    return '<svg viewBox="0 0 200 200" role="img" aria-hidden="true" focusable="false">' + fn() + '</svg>';
  }

  var SPROUT = '<svg class="sprout" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M4 14c0-5.5 4-9 8-9 0 5.5-3.2 9-8 9Z" fill="#4d8256"/>' +
    '<path d="M20 14c0-5.5-4-9-8-9 0 5.5 3.2 9 8 9Z" fill="#8fb862"/>' +
    '<path d="M12 22V11" stroke="#2f5b3b" stroke-width="2.6" stroke-linecap="round"/></svg>';

  /* ============================================================
     Rendering
     ============================================================ */
  function openPlants() { return state.plants.filter(function (p) { return !p.done; }); }

  function groups() {
    var open = openPlants();
    var bySoonest = function (a, b) { return a.offset - b.offset; };
    var byUrgency = function (a, b) { return b.urgency - a.urgency; };
    return [
      { key: 'overdue', title: 'Needs you now', note: 'past due',
        items: open.filter(function (p) { return p.offset < 0; }).sort(function (a, b) {
          return a.offset - b.offset || b.urgency - a.urgency; }) },
      { key: 'today', title: 'Today', note: 'due today', items: open.filter(function (p) { return p.offset === 0; }).sort(byUrgency) },
      { key: 'soon', title: 'Up next', note: 'not yet', items: open.filter(function (p) { return p.offset > 0; }).sort(bySoonest) },
      { key: 'done', title: 'Tended today', note: 'all caught up',
        items: state.plants.filter(function (p) { return p.done; }) }
    ].filter(function (g) { return g.items.length; });
  }

  function cardHTML(p) {
    var overdue = p.offset < 0 && !p.done;
    var cls = 'card' + (overdue ? ' card--priority' : '') + (p.done ? ' card--done' : '');
    var verb = completeVerb(p.task);
    var openBtn =
      '<button class="card__open" type="button" data-open="' + esc(p.id) + '"' +
      ' aria-expanded="' + (state.openId === p.id ? 'true' : 'false') + '"' +
      ' aria-controls="detail">' +
        '<span class="thumb" aria-hidden="true">' + portrait(p.id) + '</span>' +
        '<span class="card__text">' +
          '<span class="card__name">' + esc(p.name) + (p.done ? SPROUT : '') + '</span>' +
          '<span class="card__meta">' + esc(p.species) + ' · ' + esc(p.location) + '</span>' +
          '<span class="card__task">' + esc(p.task) + '</span>' +
        '</span>' +
        '<span class="due' + (overdue ? ' due--overdue' : '') + '">' + esc(dueLabel(p.offset)) + '</span>' +
      '</button>';
    var actions = p.done
      ? '<div class="card__actions"><button class="act act--ghost" type="button" data-act="undo-done" data-id="' + esc(p.id) + '">' +
        'Undo · ' + esc(verb) + '</button></div>'
      : '<div class="card__actions">' +
        '<button class="act act--primary" type="button" data-act="complete" data-id="' + esc(p.id) + '">' +
          esc(verb) + '</button>' +
        '<button class="act" type="button" data-act="snooze" data-id="' + esc(p.id) + '">Snooze</button>' +
      '</div>';
    return '<li class="' + cls + '" data-card="' + esc(p.id) + '">' +
      (overdue ? '<span class="flag">pick me</span>' : '') +
      openBtn + actions + '</li>';
  }

  function renderQueue() {
    var host = $('#queueGroups');
    var gs = groups();
    host.innerHTML = gs.map(function (g) {
      return '<section class="group group--' + g.key + '">' +
        '<div class="group__head"><h3 class="group__title">' + g.title + '</h3>' +
        '<span class="group__rule"></span>' +
        '<span class="group__note">' + g.items.length + '</span></div>' +
        '<ul class="queue">' + g.items.map(cardHTML).join('') + '</ul>' +
      '</section>';
    }).join('');
  }

  function meter(n, max) {
    var out = '<span class="meter" aria-hidden="true">';
    for (var i = 1; i <= max; i++) out += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return out + '</span>';
  }

  function emptyDetail() {
    return '<div class="detail__empty">' +
      '<svg viewBox="0 0 240 170" role="img" aria-hidden="true" focusable="false">' +
        '<rect class="ad-rim" x="18" y="140" width="204" height="10" rx="5"/>' +
        '<path class="pot" d="M42 150h44l-5 20h-34Z"/>' +
        '<path class="pot" d="M150 150h44l-5 20h-34Z"/>' +
        leaf(64, 148, 46, 20, -12, '#5f9159') +
        leaf(66, 148, 34, 15, 26, '#8fb862') +
        leaf(172, 148, 40, 30, 8, '#4d8256', 3) +
        leaf(170, 148, 28, 20, -30, '#9dc07c', 2) +
        '<circle class="flower" cx="212" cy="34" r="15"/>' +
        '<path class="ad-rays" style="stroke:#d99a2b;stroke-width:3;stroke-linecap:round;fill:none" d="M212 8v8M186 34h8M238 34h8M194 16l6 6M230 16l-6 6"/>' +
      '</svg>' +
      '<h2 id="detailTitle">Pick someone</h2>' +
      '<p>Tap a plant to see its light, its watering rhythm, and a short history of what you noticed.</p>' +
      '<p class="hint-keys"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</p>' +
    '</div>';
  }

  function renderDetail() {
    var body = $('#detailBody');
    var p = state.plants.filter(function (x) { return x.id === state.openId; })[0];
    if (!p) { body.innerHTML = emptyDetail(); return; }

    var verb = completeVerb(p.task);
    var overdue = p.offset < 0 && !p.done;
    var light = lightLevel(p.light);

    body.innerHTML =
      '<div class="detail__grip" aria-hidden="true"></div>' +
      '<div class="detail__portrait">' + portrait(p.id) + '</div>' +
      '<h2 class="detail__name" id="detailTitle">' + esc(p.name) +
        '<span class="detail__species">' + esc(p.species) + '</span></h2>' +
      '<p class="detail__where">' + esc(p.location) + ' · ' + esc(p.light) + ' light</p>' +
      '<div class="pills">' +
        '<span class="card__task">' + esc(p.task) + '</span>' +
        '<span class="due' + (overdue ? ' due--overdue' : '') + '">' +
          (p.done ? 'Tended today' : esc(dueLabel(p.offset))) + '</span>' +
      '</div>' +
      '<ul class="facts">' +
        '<li class="fact"><span class="fact__k">Light</span><span class="fact__v">' + esc(p.light) +
          ' ' + meter(light, 5) + '</span>' +
          '<span class="fact__aside">' + (light >= 5 ? 'Direct sun is fine — this one drinks fast.'
            : light >= 3 ? 'Happy a metre or two from a window.'
            : 'Keep it out of harsh sun.') + '</span></li>' +
        '<li class="fact"><span class="fact__k">Water</span><span class="fact__v">Last watered ' + esc(lastWatered(p)) + '</span>' +
          '<span class="fact__aside">' + esc(soilGuess(p)) + '</span></li>' +
        '<li class="fact"><span class="fact__k">Notes</span><span class="fact__v">' +
          p.history.length + ' logged' + (p.done ? ' · tended just now' : '') + '</span></li>' +
      '</ul>' +
      '<div class="detail__actions">' +
        (p.done
          ? '<button class="act act--ghost" type="button" data-act="undo-done" data-id="' + esc(p.id) + '">Undo · ' + esc(verb) + '</button>'
          : '<button class="act act--primary" type="button" data-act="complete" data-id="' + esc(p.id) + '">' + esc(verb) + '</button>' +
            '<button class="act" type="button" data-act="snooze" data-id="' + esc(p.id) + '">Snooze</button>') +
      '</div>' +
      '<h3 class="detail__sub">Observation history</h3>' +
      '<ol class="history">' + p.history.map(function (h) {
        var bits = String(h).split('·');
        return '<li><span class="when">' + esc((bits[0] || '').trim()) + '</span>' +
          (bits[1] ? '<span class="sep">·</span>' + esc(bits[1].trim()) : '') + '</li>';
      }).join('') + '</ol>';
  }

  function renderRhythm() {
    var todayIdx = (new Date().getDay() + 6) % 7;
    var focusIdx = (todayIdx + state.peek) % 7;
    var host = $('#rhythm');
    var bars = state.week.map(function (v, i) {
      var h = 16 + v * 21;
      var cls = 'bar' + (i === focusIdx ? ' is-today' : '');
      return '<div class="' + cls + '" title="' + DAY_NAMES[i] + ': ' + v + ' care moment' + (v === 1 ? '' : 's') + '">' +
        '<span class="bar__stem" style="height:' + h + 'px"></span>' +
        '<span class="bar__day">' + DAY_INITIALS[i] + '<span class="sr-only">' + DAY_NAMES[i] + '</span></span>' +
      '</div>';
    }).join('');
    host.innerHTML = bars;
    host.className = 'rhythm' + (state.peek ? ' is-peek' : '');
    host.setAttribute('role', 'img');
    host.setAttribute('aria-label', 'Weekly care rhythm: ' + state.week.map(function (v, i) {
      return DAY_NAMES[i] + ' ' + v;
    }).join(', ') + '. ' + DAY_NAMES[focusIdx] + ' is highlighted.');

    var sum = state.week.reduce(function (a, b) { return a + b; }, 0);
    var busiest = state.week.indexOf(Math.max.apply(null, state.week));
    $('#rhythmSub').textContent = state.peek
      ? 'Tomorrow looks like ' + state.week[focusIdx] + ' moment' + (state.week[focusIdx] === 1 ? '' : 's') + '.'
      : sum + ' moments this week · ' + DAY_NAMES[busiest] + ' is the busiest.';

    var total = state.plants.length;
    var done = state.plants.filter(function (p) { return p.done; }).length;
    var dots = '';
    for (var i = 0; i < total; i++) dots += '<i class="' + (i < done ? 'on' : '') + '"></i>';
    $('#tally').innerHTML = '<span class="tally__dots" aria-hidden="true">' + dots + '</span>' +
      '<span><strong>' + done + ' of ' + total + '</strong> tended today</span>';
  }

  function renderMeta() {
    var open = openPlants().length;
    var overdue = openPlants().filter(function (p) { return p.offset < 0; }).length;
    var chip = $('#countChip');
    if (open === 0) {
      chip.textContent = 'All clear';
      chip.classList.add('is-clear');
    } else {
      chip.textContent = open + ' to tend';
      chip.classList.remove('is-clear');
    }
    $('#queueNote').textContent = overdue
      ? overdue + ' past due. Everything else can wait its turn.'
      : open
        ? 'Nothing is late. Take them in any order you like.'
        : 'Nothing left today — the shelf is quiet.';

    var allDone = open === 0;
    $('#alldone').hidden = !allDone;
    $('#alldoneUndo').hidden = !state.undo;
    $('#alldonePeek').textContent = state.peek ? 'Back to today' : 'Peek at tomorrow';
  }

  function render() {
    renderQueue();
    renderDetail();
    renderRhythm();
    renderMeta();
    syncSheet();
  }

  /* ============================================================
     Open / close the detail panel
     ============================================================ */
  function syncSheet() {
    var d = $('#detail');
    d.classList.toggle('is-open', !!state.openId);
    // On mobile the panel is a modal-ish sheet; on desktop it is always visible.
    if (MOBILE.matches) d.setAttribute('aria-hidden', state.openId ? 'false' : 'true');
    else d.removeAttribute('aria-hidden');
  }

  function open(id, trigger) {
    state.openId = id;
    state.lastTrigger = trigger || null;
    renderQueue();
    renderDetail();
    syncSheet();
    if (MOBILE.matches) {
      var close = $('#detailClose');
      if (close) close.focus();
    } else {
      $('#detail').focus({ preventScroll: true });
    }
    var p = state.plants.filter(function (x) { return x.id === id; })[0];
    announce(p.name + ' opened. ' + p.task + ', ' + dueLabel(p.offset) + '.');
  }

  function close() {
    if (!state.openId) return;
    var trigger = state.lastTrigger;
    state.openId = null;
    renderQueue();
    renderDetail();
    syncSheet();
    if (trigger && document.contains(trigger)) trigger.focus();
    announce('Plant detail closed.');
  }

  /* ============================================================
     Actions: complete / snooze / undo
     ============================================================ */
  function findPlant(id) {
    return state.plants.filter(function (p) { return p.id === id; })[0];
  }

  function toast(text, undoLabel, onUndo) {
    var host = $('#toasts');
    host.innerHTML = '';
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="toast__icon" aria-hidden="true">✿</span>' +
      '<span class="toast__msg">' + esc(text) + '</span>';
    if (onUndo) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast__undo';
      btn.textContent = undoLabel;
      btn.addEventListener('click', function () {
        clearTimeout(state.toastTimer);
        host.innerHTML = '';
        onUndo();
      });
      el.appendChild(btn);
      state.undo = { label: undoLabel, run: onUndo };
    } else {
      state.undo = null;
    }
    host.appendChild(el);
    renderMeta();
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      host.innerHTML = '';
      state.undo = null;
      renderMeta();
    }, 7000);
  }

  function complete(id) {
    var p = findPlant(id);
    if (!p || p.done) return;
    var verb = completeVerb(p.task);
    p.done = true;
    p.history.unshift('Today · ' + verb);
    render();
    var sprout = document.querySelector('[data-card="' + id + '"] .sprout');
    if (sprout) sprout.classList.add('pop');
    toast(p.name + ' ' + verb.toLowerCase() + '.', 'Undo', function () {
      p.done = false;
      p.history.shift();
      render();
      announce(p.name + ' restored to ' + dueLabel(p.offset) + '.');
    });
    announce(p.name + ' marked ' + verb.toLowerCase() + '. Undo is available for a few seconds.');
  }

  function snooze(id) {
    var p = findPlant(id);
    if (!p || p.done) return;
    var from = p.offset;
    p.offset = p.offset >= 0 ? p.offset + 1 : Math.min(p.offset + 1, 0);
    render();
    toast(p.name + ' snoozed to ' + dueLabel(p.offset) + '.', 'Undo', function () {
      p.offset = from;
      render();
      announce(p.name + ' is due ' + dueLabel(p.offset) + ' again.');
    });
    announce(p.name + ' snoozed until ' + dueLabel(p.offset) + '.');
  }

  function undoDone(id) {
    var p = findPlant(id);
    if (!p || !p.done) return;
    p.done = false;
    p.history = p.history.filter(function (h) { return !/^Today ·/.test(h); });
    render();
    announce(p.name + ' is due ' + dueLabel(p.offset) + ' again.');
  }

  /* ============================================================
     Wiring
     ============================================================ */
  function onClick(e) {
    if (!e.target || typeof e.target.closest !== 'function') return;
    var actBtn = e.target.closest('[data-act]');
    if (actBtn) {
      var id = actBtn.getAttribute('data-id');
      var kind = actBtn.getAttribute('data-act');
      if (kind === 'complete') complete(id);
      else if (kind === 'snooze') snooze(id);
      else if (kind === 'undo-done') undoDone(id);
      return;
    }
    var openBtn = e.target.closest('[data-open]');
    if (openBtn) {
      var pid = openBtn.getAttribute('data-open');
      if (state.openId === pid) close();
      else open(pid, openBtn);
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      if (state.openId) { e.preventDefault(); close(); }
      return;
    }
    // move through the queue with arrows or j/k
    var host = $('#queueGroups');
    if (!host.contains(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
    var down = e.key === 'ArrowDown' || e.key === 'j';
    var up = e.key === 'ArrowUp' || e.key === 'k';
    if (!down && !up) return;
    var btns = Array.prototype.slice.call(host.querySelectorAll('[data-open]'));
    var i = btns.indexOf(e.target);
    if (i < 0) return;
    e.preventDefault();
    var next = btns[(i + (down ? 1 : -1) + btns.length) % btns.length];
    next.focus();
  }

  // Keep Tab inside the sheet while it is a mobile overlay.
  function trapTab(e) {
    if (e.key !== 'Tab' || !MOBILE.matches || !state.openId) return;
    var panel = $('#detail');
    var items = Array.prototype.slice.call(
      panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) { return el.offsetParent !== null; });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function boot(data) {
    state.week = data.week && data.week.length ? data.week : [1, 3, 2, 4, 2, 1, 3];
    state.plants = data.plants.map(function (p) {
      return {
        id: p.id, name: p.name, species: p.species, location: p.location,
        task: p.task, due: p.due, urgency: p.urgency || 0, light: p.light,
        history: (p.history || []).slice(),
        offset: parseDue(p.due), done: false
      };
    });

    $('#dateChip').textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short'
    });

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('keydown', trapTab);
    $('#detailClose').addEventListener('click', close);
    $('#alldoneUndo').addEventListener('click', function () {
      if (state.undo) { clearTimeout(state.toastTimer); $('#toasts').innerHTML = ''; state.undo.run(); }
    });
    $('#alldonePeek').addEventListener('click', function () {
      state.peek = state.peek ? 0 : 1;
      renderRhythm();
      renderMeta();
      announce(state.peek ? 'Showing tomorrow in the weekly rhythm.' : 'Showing today in the weekly rhythm.');
    });
    MOBILE.addEventListener('change', syncSheet);

    render();
  }

  function load() {
    if (location.protocol === 'file:') { boot(FALLBACK); return; }
    fetch('PLANTS.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('no json'); return r.json(); })
      .then(function (d) { boot(d && d.plants ? d : FALLBACK); })
      .catch(function () { boot(FALLBACK); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
