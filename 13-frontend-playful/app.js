/* Moss: a gentle household plant-care companion.
   Plain JavaScript, no dependencies, no network. State lives in memory only.
   Data comes from the inlined copy of PLANTS.json in index.html. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Constants and data
   * ------------------------------------------------------------------ */
  var DATA = JSON.parse(document.getElementById('plants-data').textContent);

  // The demo day. PLANTS.json histories end on Sep 21 and Frida is "2 days
  // overdue", so we pin the calendar to Tuesday, Sep 22, 2026.
  var TODAY = Date.UTC(2026, 8, 22);
  var TODAY_IDX = 1; // DATA.week runs Monday..Sunday
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  var INK = '#2a2620';
  var TOAST_MS = 8000;

  /* Inline icons. Stroke icons inherit currentColor. */
  function ico(inner, mode) {
    var attrs = mode === 'fill'
      ? 'fill="currentColor"'
      : 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
    return '<svg class="ico" viewBox="0 0 24 24" ' + attrs + ' aria-hidden="true" focusable="false">' + inner + '</svg>';
  }
  var ICON = {
    drop: ico('<path d="M12 2.8c3.6 4.5 6.2 7.7 6.2 11a6.2 6.2 0 0 1-12.4 0c0-3.3 2.6-6.5 6.2-11z"/>', 'fill'),
    rotate: ico('<path d="M20 12a8 8 0 1 1-2.7-6"/><path d="M20 4v5h-5"/>'),
    lens: ico('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>'),
    mist: ico('<circle cx="7" cy="8" r="2" /><circle cx="14" cy="6" r="2"/><circle cx="17" cy="13" r="2"/><circle cx="9" cy="15" r="2"/><circle cx="14" cy="19" r="1.4"/>', 'fill'),
    moon: ico('<path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z"/>', 'fill'),
    undo: ico('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    check: ico('<path d="M5 12.5l4.6 4.6L19 7.6"/>'),
    close: ico('<path d="M6 6l12 12M18 6L6 18"/>'),
    sun: ico('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/>'),
    eye: ico('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>')
  };

  /* What each task means: label for the "done" button, history bucket, toast copy. */
  var TASKS = {
    'Water': { done: 'Watered', cat: 'water', icon: ICON.drop, toast: function (n) { return n + ' is watered. Ahh.'; } },
    'Rotate': { done: 'Rotated', cat: 'light', icon: ICON.rotate, toast: function (n) { return n + ' got a quarter turn.'; } },
    'Check soil': { done: 'Soil checked', cat: 'obs', icon: ICON.lens, toast: function (n) { return n + '’s soil is checked.'; } },
    'Mist': { done: 'Misted', cat: 'water', icon: ICON.mist, toast: function (n) { return n + ' is misted and pleased.'; } }
  };

  /* A little personality per plant. */
  var FLAVOR = {
    fern: {
      alarm: 'Frida is <em>parched</em> and telling the whole bathroom.',
      quip: 'Likes her soil like a wrung-out sponge.',
      light: 'A soft, sideways glow suits her. Direct sun crisps the tips.',
      water: 'Water until it runs through, then let her drip in the sink.',
      obs: 'New fronds curl up like question marks. Worth a look.'
    },
    pothos: {
      alarm: 'Orbit is <em>leaning</em> toward the window again.',
      quip: 'Unbothered, but he leans. A quarter turn evens him out.',
      light: 'Happy in medium light. He will trail toward any brighter spot.',
      water: 'Let the top inch dry out. He forgives a late drink.',
      obs: 'Nothing noted yet. Pale leaves or new vines both count.'
    },
    cactus: {
      alarm: 'Dot is <em>fine</em>, but would like a poke.',
      quip: 'Dry two knuckles down? Then she is thirsty.',
      light: 'Wants all the sun the south window will give her.',
      water: 'Deep drink, then a long dry spell. Never a little sip.',
      obs: 'New pads show up as tiny green thumbs. Note them.'
    },
    calathea: {
      alarm: 'Drama is <em>folding</em> her leaves for the evening.',
      quip: 'Folds her leaves at night, so yes, the theatre is real.',
      light: 'Filtered light only. Bright sun bleaches those stripes.',
      water: 'Filtered water, evenly damp, and a morning mist.',
      obs: 'Brown edges usually mean dry air. Keep an eye on them.'
    }
  };

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  function classify(label) {
    if (/water|mist/i.test(label)) return 'water';
    if (/rotat|wipe/i.test(label)) return 'light';
    return 'obs';
  }

  function parseEntry(str) {
    var parts = str.split(' · ');
    var dm = parts[0].split(' ');
    var t = Date.UTC(2026, MONTHS[dm[0]], parseInt(dm[1], 10));
    return {
      date: parts[0].replace(/ 0(\d)$/, ' $1'),
      label: parts[1],
      cat: classify(parts[1]),
      daysAgo: Math.round((TODAY - t) / 86400000)
    };
  }

  function makePlants() {
    return DATA.plants.map(function (p) {
      return Object.assign({}, p, {
        baseDay: /tomorrow/i.test(p.due) ? 1 : 0,
        overdue: /overdue/i.test(p.due),
        status: 'pending', // pending | done | snoozed
        doneAt: 0,
        alsoWatered: false,
        hist: p.history.map(parseEntry)
      });
    });
  }

  var state = {
    plants: makePlants(),
    selectedId: null,
    sheetOpen: false,
    opener: null,
    lastAction: null,
    pulse: null,        // id of the plant that just moved, so only it animates
    wasAllDone: false
  };
  state.selectedId = state.plants.slice().sort(function (a, b) { return b.urgency - a.urgency; })[0].id;

  var toastTimer = 0;

  /* ------------------------------------------------------------------ *
   * DOM handles
   * ------------------------------------------------------------------ */
  var $ = function (sel) { return document.querySelector(sel); };
  var el = {
    app: $('#app'),
    masthead: $('#masthead'),
    status: $('#status'),
    headline: $('#headline'),
    subline: $('#subline'),
    pips: $('#pips'),
    sprout: $('#sprout'),
    queue: $('#queue'),
    rhythm: $('#rhythm'),
    foot: $('#foot'),
    detail: $('#detail'),
    scrim: $('#scrim'),
    toastRegion: $('#toast-region'),
    srLive: $('#sr-live')
  };
  var desktopMQ = window.matchMedia('(min-width: 900px)');
  function isDesktop() { return desktopMQ.matches; }

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function byId(id) { return state.plants.filter(function (p) { return p.id === id; })[0]; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function lc(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  function agoText(e) {
    if (e.fresh) return 'just now';
    if (e.daysAgo === 0) return 'today';
    if (e.daysAgo === 1) return 'yesterday';
    return e.daysAgo + ' days ago';
  }

  function snoozeTarget(p) {
    var idx = TODAY_IDX + p.baseDay + 1;
    if (idx === TODAY_IDX + 1) return 'tomorrow';
    return DAYS[idx] || 'next week';
  }

  function moodOf(p) {
    if (p.status === 'done') return 'happy';
    if (p.status === 'pending' && p.overdue && p.baseDay === 0) return 'thirsty';
    return 'ok';
  }

  function dueLabel(p) {
    if (p.status === 'snoozed') return 'Back ' + snoozeTarget(p);
    return p.due;
  }

  /* Everything the plant has ever logged, today's taps first. */
  function entriesOf(p) {
    var out = [];
    if (p.status === 'done') {
      out.push({ date: 'Sep 22', label: TASKS[p.task].done, cat: TASKS[p.task].cat, daysAgo: 0, fresh: true });
    }
    if (p.alsoWatered) out.push({ date: 'Sep 22', label: 'Watered', cat: 'water', daysAgo: 0, fresh: true });
    return out.concat(p.hist);
  }

  function lightLevel(text) {
    if (/^low/i.test(text)) return 1;
    if (/^medium/i.test(text)) return 2;
    if (/indirect/i.test(text)) return 3;
    return 4;
  }

  /* ------------------------------------------------------------------ *
   * Grouping and summary
   * ------------------------------------------------------------------ */
  function groups() {
    var P = state.plants;
    var pend = P.filter(function (p) { return p.status === 'pending'; })
      .sort(function (a, b) { return b.urgency - a.urgency; });
    return {
      overdue: pend.filter(function (p) { return p.baseDay === 0 && p.overdue; }),
      today: pend.filter(function (p) { return p.baseDay === 0 && !p.overdue; }),
      later: pend.filter(function (p) { return p.baseDay > 0; }),
      done: P.filter(function (p) { return p.status === 'done'; }).sort(function (a, b) { return b.doneAt - a.doneAt; }),
      snoozed: P.filter(function (p) { return p.status === 'snoozed'; })
    };
  }

  function summary() {
    var g = groups();
    var scope = state.plants.filter(function (p) { return p.baseDay === 0 && p.status !== 'snoozed'; });
    var tended = scope.filter(function (p) { return p.status === 'done'; }).length;
    return {
      g: g,
      total: scope.length,
      tended: tended,
      open: g.overdue.length + g.today.length,
      allDone: g.overdue.length + g.today.length === 0
    };
  }

  /* ------------------------------------------------------------------ *
   * Illustration: hand-built SVG, one small scene per plant.
   * ------------------------------------------------------------------ */
  function quadPt(p0, p1, p2, t) {
    var u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  }
  function quadTan(p0, p1, p2, t) {
    var u = 1 - t;
    return Math.atan2(2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]), 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0])) * 180 / Math.PI;
  }
  function r1(n) { return Math.round(n * 10) / 10; }

  function sparkle(x, y, s) {
    return '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0-8Q1.2-1.2 8 0Q1.2 1.2 0 8Q-1.2 1.2-8 0Q-1.2-1.2 0-8z" fill="#f2c94c" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/>';
  }
  function sweat() {
    return '<path d="M101 26c4 5 6.6 8.4 6.6 11.6a6.6 6.6 0 0 1-13.2 0c0-3.2 2.6-6.6 6.6-11.6z" fill="#bfdcd8" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/>';
  }

  function pot(body, rim, extra) {
    return '<g stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round">' +
      '<path d="M36 86h48l-5 25q-.7 3.4-4.4 3.4H45.4q-3.7 0-4.4-3.4z" fill="' + body + '"/>' +
      (extra || '') +
      '<rect x="31" y="74" width="58" height="14" rx="6.5" fill="' + rim + '"/></g>';
  }

  function fernArt(mood) {
    var droop = mood === 'thirsty';
    var fronds = [[-72, 46], [-40, 52], [-8, 56], [26, 52], [58, 44]];
    var out = '';
    fronds.forEach(function (f, fi) {
      var a = f[0] * Math.PI / 180, L = f[1];
      var p0 = [60, 76], p1, p2;
      if (droop) {
        p1 = [60 + Math.sin(a) * L * 0.42, 76 - L * 0.9];
        p2 = [60 + Math.sin(a) * L * 1.02, 76 - Math.cos(a) * L * 0.32 + 12];
      } else {
        p1 = [60 + Math.sin(a) * L * 0.34, 76 - L * 0.8];
        p2 = [60 + Math.sin(a) * L * 0.86, 76 - Math.cos(a) * L * 0.98];
      }
      out += '<path d="M60 76Q' + r1(p1[0]) + ' ' + r1(p1[1]) + ' ' + r1(p2[0]) + ' ' + r1(p2[1]) + '" fill="none" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/>';
      for (var i = 1; i <= 6; i++) {
        var t = 0.14 + i * 0.13;
        var pt = quadPt(p0, p1, p2, t), tan = quadTan(p0, p1, p2, t);
        var rx = 8.4 * (1 - 0.55 * t), ry = 3.1 * (1 - 0.25 * t);
        [1, -1].forEach(function (s) {
          var ang = tan + s * 64, rad = ang * Math.PI / 180;
          var cx = pt[0] + Math.cos(rad) * rx * 0.85, cy = pt[1] + Math.sin(rad) * rx * 0.85;
          out += '<ellipse cx="' + r1(cx) + '" cy="' + r1(cy) + '" rx="' + r1(rx) + '" ry="' + r1(ry) + '" transform="rotate(' + r1(ang) + ' ' + r1(cx) + ' ' + r1(cy) + ')" fill="' + ((fi + i) % 2 ? '#6f9a45' : '#85ad55') + '" stroke="' + INK + '" stroke-width="1.5"/>';
        });
      }
    });
    return out + pot('#c8623f', '#dc7d5c', '<path d="M39 96h42" stroke="#a04a2c" stroke-width="2.4" stroke-linecap="round" fill="none"/>');
  }

  function pothosArt() {
    var vines = [
      [[46, 78], [16, 72], [24, 110], 4],
      [[74, 78], [104, 72], [98, 110], 4],
      [[53, 76], [38, 52], [50, 24], 4],
      [[66, 76], [80, 58], [71, 30], 4],
      [[59, 76], [64, 54], [58, 40], 3]
    ];
    var out = '', leaves = '';
    vines.forEach(function (v, vi) {
      out += '<path d="M' + v[0][0] + ' ' + v[0][1] + 'Q' + v[1][0] + ' ' + v[1][1] + ' ' + v[2][0] + ' ' + v[2][1] + '" fill="none" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/>';
      for (var i = 1; i <= v[3]; i++) {
        var t = i / v[3] * 0.95;
        var pt = quadPt(v[0], v[1], v[2], t), tan = quadTan(v[0], v[1], v[2], t);
        var side = (i + vi) % 2 ? 1 : -1;
        var rot = tan - 90 + side * 34;
        var sc = 1.05 + (i % 2) * 0.22;
        leaves += '<g transform="translate(' + r1(pt[0]) + ' ' + r1(pt[1]) + ') rotate(' + r1(rot) + ') scale(' + sc + ')">' +
          '<path d="M0 0C-8-7-15 3 0 17C15 3 8-7 0 0z" fill="' + ((i + vi) % 3 === 0 ? '#a4c266' : '#6f9a45') + '" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
          '<path d="M0 3V12" stroke="#e7efc4" stroke-width="1.6" stroke-linecap="round"/></g>';
      }
    });
    return out + leaves + pot('#f3ead6', '#fff7e4', '<path d="M37 94h46M39 102h42" stroke="#c8623f" stroke-width="2.6" stroke-linecap="round" fill="none"/>');
  }

  function cactusArt() {
    function spines(cx, cy, rx, ry, n, seed) {
      var s = '';
      for (var i = 0; i < n; i++) {
        var a = (i * 137.5 + seed) * Math.PI / 180;
        var d = Math.sqrt((i + 0.5) / n);
        s += '<circle cx="' + r1(cx + Math.cos(a) * rx * 0.72 * d) + '" cy="' + r1(cy + Math.sin(a) * ry * 0.72 * d) + '" r="1.25"/>';
      }
      return s;
    }
    var pad = 'fill="#8fb069" stroke="' + INK + '" stroke-width="2.6"';
    return '<ellipse cx="60" cy="72" rx="20" ry="13" ' + pad + '/>' +
      '<ellipse cx="46" cy="50" rx="15" ry="22" transform="rotate(-14 46 50)" ' + pad + '/>' +
      '<ellipse cx="75" cy="42" rx="14" ry="21" transform="rotate(16 75 42)" ' + pad + '/>' +
      '<g fill="#fff7e4" stroke="none">' + spines(46, 50, 15, 22, 9, 10) + spines(75, 42, 14, 21, 9, 40) + spines(60, 72, 20, 13, 6, 70) + '</g>' +
      '<g stroke="' + INK + '" stroke-width="2"><circle cx="79" cy="18" r="6" fill="#e8735a"/><circle cx="87" cy="24" r="6" fill="#e8735a"/><circle cx="71" cy="24" r="6" fill="#e8735a"/><circle cx="79" cy="27" r="4.6" fill="#f2c94c"/></g>' +
      pot('#3b8583', '#4f9c99', '<path d="M38 96h44" stroke="#2a6667" stroke-width="2.4" stroke-linecap="round" fill="none"/>');
  }

  function calatheaArt() {
    function leaf(angle, h, w, fill, stripe) {
      var s = '<g transform="translate(60 78) rotate(' + angle + ')">' +
        '<ellipse cx="0" cy="' + (-h - 3) + '" rx="' + w + '" ry="' + h + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="2.4"/>' +
        '<path d="M0 -6V' + (-2 * h) + '" stroke="' + stripe + '" stroke-width="2.2" stroke-linecap="round" fill="none"/>';
      for (var y = 14; y < 2 * h - 8; y += 11) {
        var k = Math.max(0.35, 1 - Math.abs(y - h) / (h * 1.1));
        s += '<path d="M0 ' + (-y) + 'L' + r1(w * 0.82 * k) + ' ' + (-y - 7) + 'M0 ' + (-y) + 'L' + r1(-w * 0.82 * k) + ' ' + (-y - 7) + '" stroke="' + stripe + '" stroke-width="2.1" stroke-linecap="round" fill="none"/>';
      }
      return s + '</g>';
    }
    return leaf(10, 32, 13, '#8a3d55', '#d7a9b6') +
      leaf(-46, 24, 11.5, '#4f7f45', '#d7e6b0') +
      leaf(44, 25, 11.5, '#57894b', '#d7e6b0') +
      leaf(-20, 31, 13, '#4f7f45', '#d7e6b0') +
      leaf(21, 30, 13, '#5b8d4e', '#d7e6b0') +
      leaf(0, 34, 14, '#4a7a41', '#d7e6b0') +
      pot('#5a3a55', '#76506f', '<path d="M39 96h42" stroke="#3f2a3c" stroke-width="2.4" stroke-linecap="round" fill="none"/>');
  }

  function art(id, mood) {
    var body = id === 'fern' ? fernArt(mood)
      : id === 'pothos' ? pothosArt()
      : id === 'cactus' ? cactusArt()
      : calatheaArt();
    if (mood === 'thirsty') body += sweat();
    if (mood === 'happy') body += sparkle(19, 34, 1.1) + sparkle(104, 22, 0.9) + sparkle(100, 64, 0.65);
    return '<svg class="art" viewBox="0 0 120 120" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  function snailArt() {
    return '<svg class="snail-art" viewBox="0 0 132 84" aria-hidden="true" focusable="false">' +
      '<g stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="M8 72c0-8 6-11 15-11h72c9 0 14-6 14-15 0-5-1-9-1-14 0-4 6-4 6 0 0 6 2 9 4 15 4 13-2 25-18 25H21C13 72 8 76 8 72z" fill="#f0b892"/>' +
      '<path d="M112 32L108 14M119 32L125 16" fill="none"/>' +
      '<circle cx="108" cy="12" r="3.6" fill="#fff7e4"/><circle cx="125" cy="14" r="3.6" fill="#fff7e4"/>' +
      '<circle cx="56" cy="42" r="28" fill="#f2c94c"/>' +
      '<path d="M56 42a4.4 4.4 0 0 1 8.8 0a9.6 9.6 0 0 1-19.2 0a15 15 0 0 1 30 0a20.5 20.5 0 0 1-41 0" fill="none" stroke-width="2.4"/>' +
      '</g></svg>';
  }

  /* ------------------------------------------------------------------ *
   * Templates: queue
   * ------------------------------------------------------------------ */
  function openBtn(p) {
    var expanded = p.id === state.selectedId && (isDesktop() || state.sheetOpen);
    return '<button type="button" class="q-open" data-act="open" data-id="' + p.id + '" aria-controls="detail" aria-expanded="' + expanded + '"' +
      (p.id === state.selectedId && isDesktop() ? ' aria-current="true"' : '') + '>' + esc(p.name) + '<span class="sr-only">, show details</span></button>';
  }

  function actionButtons(p, early) {
    var t = TASKS[p.task];
    var label = early ? t.done + ' early' : t.done;
    return '<button type="button" class="btn btn-primary" data-act="done" data-id="' + p.id + '" aria-label="Mark ' + esc(p.name) + ' as ' + lc(t.done) + (early ? ' early' : '') + '">' +
      t.icon + '<span>' + esc(label) + '</span></button>' +
      '<button type="button" class="btn btn-ghost" data-act="snooze" data-id="' + p.id + '" aria-label="Snooze ' + esc(p.name) + ' until ' + snoozeTarget(p) + '">' +
      ICON.moon + '<span>Snooze</span></button>';
  }

  function queueItem(p, kind) {
    var t = TASKS[p.task];
    var quip = kind === 'hero' ? '<p class="q-quip">' + esc(FLAVOR[p.id].quip) + '</p>' : '';
    return '<li class="q-item q-' + kind + (p.id === state.selectedId ? ' is-selected' : '') + (p.id === state.pulse ? ' is-new' : '') + '" data-plant="' + p.id + '">' +
      '<div class="portrait tint-' + p.id + '">' + art(p.id, moodOf(p)) + '</div>' +
      '<div class="q-body">' +
      '<p class="q-kicker"><span class="q-task">' + t.icon + esc(p.task) + '</span><span class="q-due">' + esc(p.due) + '</span></p>' +
      '<h3 class="q-name">' + openBtn(p) + '</h3>' +
      '<p class="q-meta">' + esc(p.species) + ' · ' + esc(p.location) + '</p>' + quip +
      '</div>' +
      '<div class="q-actions">' + actionButtons(p, kind === 'quiet') + '</div>' +
      '</li>';
  }

  function compactItem(p) {
    var done = p.status === 'done';
    var t = TASKS[p.task];
    var note = done ? t.done + ' just now' : p.task + ' · back ' + snoozeTarget(p);
    var aria = done ? 'Undo ' + lc(t.done) + ' for ' + p.name : 'Bring ' + p.name + ' back to the queue';
    return '<li class="q-item q-compact ' + (done ? 'is-done' : 'is-snoozed') + (p.id === state.selectedId ? ' is-selected' : '') + (p.id === state.pulse ? ' is-new' : '') + '" data-plant="' + p.id + '">' +
      '<span class="c-mark" aria-hidden="true">' + (done ? ICON.check : ICON.moon) + '</span>' +
      '<div class="c-body"><h3 class="c-name">' + openBtn(p) + '</h3><p class="c-note">' + esc(note) + '</p></div>' +
      '<button type="button" class="btn btn-quiet" data-act="restore" data-id="' + p.id + '" aria-label="' + esc(aria) + '">' +
      ICON.undo + '<span>' + (done ? 'Undo' : 'Bring back') + '</span></button>' +
      '</li>';
  }

  function section(cls, title, count, listCls, items, labelId) {
    return '<section class="q-section ' + cls + '" aria-labelledby="' + labelId + '">' +
      '<h2 class="q-heading" id="' + labelId + '"><span class="q-tag">' + title + '</span><span class="q-count">' + count + '</span></h2>' +
      '<ul class="q-list ' + listCls + '">' + items + '</ul></section>';
  }

  function allDonePanel(s) {
    var g = s.g;
    var recap = g.done.map(function (p) {
      return '<li><span class="recap-dot" aria-hidden="true"></span>' + esc(p.name) + ' <span class="recap-what">' + esc(lc(TASKS[p.task].done)) + '</span></li>';
    }).join('');
    var snoozedLine = g.snoozed.length
      ? '<li class="recap-snoozed"><span class="recap-dot" aria-hidden="true"></span>' + g.snoozed.map(function (p) { return esc(p.name); }).join(' and ') +
        ' <span class="recap-what">snoozed</span></li>'
      : '';
    var title = g.snoozed.length ? 'Clear for today.' : 'Everything’s tended.';
    var lead = s.tended
      ? plural(s.tended, 'plant', 'plants') + ' looked after. The windowsill is content.'
      : 'Nothing is due right now. Snoozed plants will nudge you again.';
    // What is coming next, so the calm has a purpose.
    var next = [];
    g.later.forEach(function (p) { next.push(p.name + '’s ' + lc(p.task) + ' is due ' + (p.baseDay === 1 ? 'tomorrow' : 'soon')); });
    g.snoozed.forEach(function (p) { next.push(p.name + '’s ' + lc(p.task) + ' returns ' + snoozeTarget(p)); });
    var nextLine = next.length
      ? '<p class="alldone-next"><strong>Next up:</strong> ' + esc(next.join('. ')) + '.</p>'
      : '<p class="alldone-next"><strong>Next up:</strong> nothing on the calendar. Enjoy the quiet.</p>';
    var undoBtn = state.lastAction
      ? '<button type="button" class="btn btn-quiet" data-act="toast-undo">' + ICON.undo + '<span>Undo last change</span></button>'
      : '';
    return '<section class="alldone' + (state.wasAllDone ? '' : ' is-new') + '" id="alldone" aria-labelledby="alldone-title">' +
      '<div class="alldone-art">' + snailArt() + '</div>' +
      '<div class="alldone-copy"><p class="eyebrow">All done</p>' +
      '<h2 id="alldone-title" tabindex="-1">' + title + '</h2>' +
      '<p class="alldone-lead">' + esc(lead) + '</p>' +
      ((recap || snoozedLine) ? '<ul class="recap">' + recap + snoozedLine + '</ul>' : '') +
      nextLine +
      '<p class="alldone-nudge">Anything new on a leaf? A bud, a curl, a crisp edge. Open a plant to read its notes.</p>' +
      '<div class="alldone-actions">' + undoBtn + '<button type="button" class="btn btn-quiet" data-act="reset">' + ICON.rotate + '<span>Start today over</span></button></div>' +
      '</div></section>';
  }

  function queueHTML() {
    var s = summary(), g = s.g, html = '';
    if (s.allDone) html += allDonePanel(s);
    if (g.overdue.length) {
      html += section('q-section--overdue', 'Overdue', g.overdue.length, 'q-list--hero',
        g.overdue.map(function (p) { return queueItem(p, 'hero'); }).join(''), 'h-overdue');
    }
    if (g.today.length) {
      html += section('q-section--today', 'Due today', g.today.length, 'q-list--today',
        g.today.map(function (p) { return queueItem(p, 'row'); }).join(''), 'h-today');
    }
    if (g.later.length) {
      html += section('q-section--later', 'Up next', g.later.length, 'q-list--later',
        g.later.map(function (p) { return queueItem(p, 'quiet'); }).join(''), 'h-later');
    }
    if (g.done.length) {
      html += section('q-section--done', 'Tended', g.done.length, 'q-list--compact',
        g.done.map(compactItem).join(''), 'h-done');
    }
    if (g.snoozed.length) {
      html += section('q-section--snoozed', 'Snoozed', g.snoozed.length, 'q-list--compact',
        g.snoozed.map(compactItem).join(''), 'h-snoozed');
    }
    return html;
  }

  /* ------------------------------------------------------------------ *
   * Templates: status, rhythm
   * ------------------------------------------------------------------ */
  function renderStatus() {
    var s = summary(), g = s.g, head, sub;
    if (s.allDone) {
      head = g.snoozed.length ? 'Today is <em>clear</em>.' : '<em>Everyone’s</em> content.';
      sub = s.tended
        ? plural(s.tended, 'plant', 'plants') + ' tended' + (g.snoozed.length ? ', ' + g.snoozed.length + ' snoozed.' : '. Nothing left to do.')
        : plural(g.snoozed.length, 'plant', 'plants') + ' snoozed. Nothing due right now.';
    } else if (g.overdue.length) {
      head = FLAVOR[g.overdue[0].id].alarm;
      sub = s.tended + ' of ' + s.total + ' tended today · ' + g.overdue.length + ' running late';
    } else {
      head = 'A gentle day: <em>' + plural(s.open, 'small thing', 'small things') + '</em> left.';
      sub = s.tended + ' of ' + s.total + ' tended today · nothing running late';
    }
    el.headline.innerHTML = head;
    el.subline.textContent = sub;
    var pips = '';
    for (var i = 0; i < s.total; i++) pips += '<span class="pip' + (i < s.tended ? ' is-done' : '') + '"></span>';
    el.pips.innerHTML = pips;

    var frac = s.total ? s.tended / s.total : 0;
    var leaves = s.tended === 0 ? 0 : Math.max(1, Math.round(frac * 3));
    for (var l = 1; l <= 3; l++) el.sprout.classList.toggle('has-leaf-' + l, l <= leaves);
    el.sprout.classList.toggle('is-bloom', s.allDone && s.tended > 0);
    el.sprout.classList.toggle('is-worried', g.overdue.length > 0);
  }

  function rhythmData() {
    var c = DATA.week.slice(), done = [0, 0, 0, 0, 0, 0, 0], moved = [0, 0, 0, 0, 0, 0, 0], late = 0;
    state.plants.forEach(function (p) {
      var from = TODAY_IDX + p.baseDay;
      if (p.status === 'snoozed') {
        c[from] = Math.max(0, c[from] - 1);
        if (from + 1 < 7) { c[from + 1] += 1; moved[from + 1] += 1; }
      }
      if (p.status === 'done') done[from] += 1;
      if (p.status === 'pending' && p.baseDay === 0 && p.overdue) late += 1;
    });
    return { c: c, done: done, moved: moved, late: late };
  }

  function rhythmHTML() {
    var R = rhythmData(), cols = '';
    for (var d = 0; d < 7; d++) {
      var n = R.c[d], peb = [];
      var nDone = d < TODAY_IDX ? n : Math.min(R.done[d], n);
      var nLate = d === TODAY_IDX ? Math.min(R.late, n - nDone) : 0;
      var nMoved = d > TODAY_IDX ? Math.min(R.moved[d], n - nDone) : 0;
      var nDue = Math.max(0, n - nDone - nLate - nMoved);
      var i;
      for (i = 0; i < nDone; i++) peb.push('done');
      for (i = 0; i < nLate; i++) peb.push('late');
      for (i = 0; i < nDue; i++) peb.push('due');
      for (i = 0; i < nMoved; i++) peb.push('moved');
      var stack = peb.map(function (k, idx) {
        var rot = ((d * 7 + idx * 5) % 7 - 3) * 2.2;
        var w = 78 + ((d * 3 + idx * 4) % 5) * 5;
        return '<span class="peb peb--' + k + '" style="--rot:' + rot + 'deg;--w:' + w + '%"></span>';
      }).join('');
      var status = d === TODAY_IDX ? ', today' : (d < TODAY_IDX ? ', finished' : '');
      var detail = nDone ? ', ' + nDone + ' done' : '';
      if (nLate) detail += ', ' + nLate + ' late';
      if (nMoved) detail += ', ' + nMoved + ' snoozed here';
      cols += '<li class="rc' + (d === TODAY_IDX ? ' is-today' : '') + (d < TODAY_IDX ? ' is-past' : '') + '">' +
        '<div class="stack" aria-hidden="true">' + stack + '</div>' +
        '<span class="rc-label" aria-hidden="true">' + DAY_SHORT[d] + '</span>' +
        '<span class="sr-only">' + DAYS[d] + status + ': ' + plural(n, 'task', 'tasks') + detail + '</span></li>';
    }
    // Caption: busiest and quietest day from today onward.
    var busy = TODAY_IDX, calm = TODAY_IDX;
    for (var k = TODAY_IDX; k < 7; k++) {
      if (R.c[k] > R.c[busy]) busy = k;
      if (R.c[k] <= R.c[calm]) calm = k;
    }
    var cap = DAYS[busy] + ' is the busy one (' + R.c[busy] + '). ' + DAYS[calm] + ' is a breather (' + R.c[calm] + ').';
    return '<h2 class="rhythm-title" id="rhythm-title">This week’s rhythm</h2>' +
      '<ol class="rc-list">' + cols + '</ol>' +
      '<p class="rhythm-cap">' + esc(cap) + '</p>' +
      '<ul class="legend" aria-hidden="true">' +
      '<li><span class="peb peb--done"></span>done</li><li><span class="peb peb--late"></span>late</li>' +
      '<li><span class="peb peb--due"></span>to do</li><li><span class="peb peb--moved"></span>snoozed here</li></ul>';
  }

  /* ------------------------------------------------------------------ *
   * Template: plant detail
   * ------------------------------------------------------------------ */
  function histList(items, emptyText) {
    if (!items.length) return '<p class="hist-empty">' + esc(emptyText) + '</p>';
    return '<ol class="hist">' + items.map(function (e) {
      return '<li' + (e.fresh ? ' class="is-fresh"' : '') + '><span class="hist-date">' + esc(e.date) + '</span><span class="hist-what">' + esc(e.label) + '</span><span class="hist-ago">' + esc(agoText(e)) + '</span></li>';
    }).join('') + '</ol>';
  }

  function dripStrip(entries) {
    var cells = '';
    for (var back = 20; back >= 0; back--) {
      var kind = '';
      entries.forEach(function (e) {
        if (e.cat !== 'water' || e.daysAgo !== back) return;
        if (/^watered/i.test(e.label)) kind = 'watered'; else if (!kind) kind = 'misted';
      });
      cells += '<li class="dr' + (kind ? ' dr--' + kind : '') + (back === 0 ? ' dr--today' : '') + '"></li>';
    }
    return '<ol class="drips" aria-hidden="true">' + cells + '</ol>' +
      '<div class="drips-scale" aria-hidden="true"><span>3 weeks ago</span><span>today</span></div>';
  }

  function detailActions(p) {
    var t = TASKS[p.task];
    if (p.status === 'pending') {
      return '<div class="d-actions">' + actionButtons(p, p.baseDay > 0) + '</div>';
    }
    if (p.status === 'done') {
      return '<div class="d-state"><span class="c-mark" aria-hidden="true">' + ICON.check + '</span><p>' + esc(t.done) + ' just now.</p>' +
        '<button type="button" class="btn btn-quiet" data-act="restore" data-id="' + p.id + '" aria-label="Undo ' + esc(lc(t.done)) + ' for ' + esc(p.name) + '">' + ICON.undo + '<span>Undo</span></button></div>';
    }
    return '<div class="d-state"><span class="c-mark" aria-hidden="true">' + ICON.moon + '</span><p>Snoozed until ' + snoozeTarget(p) + '.</p>' +
      '<button type="button" class="btn btn-quiet" data-act="restore" data-id="' + p.id + '" aria-label="Bring ' + esc(p.name) + ' back to the queue">' + ICON.undo + '<span>Bring back</span></button></div>';
  }

  function detailHTML() {
    var p = byId(state.selectedId), t = TASKS[p.task], f = FLAVOR[p.id];
    var entries = entriesOf(p);
    var by = { light: [], water: [], obs: [] };
    entries.forEach(function (e) { by[e.cat].push(e); });
    var lvl = lightLevel(p.light);
    var lastWater = entries.filter(function (e) { return /^watered/i.test(e.label); })[0];
    var lastMist = entries.filter(function (e) { return /^misted/i.test(e.label); })[0];
    var sun = '';
    for (var i = 1; i <= 4; i++) sun += '<span class="sunpip s' + i + (i <= lvl ? ' is-on' : '') + '"></span>';

    var waterSummary = '<p class="d-big">' + (lastWater ? 'Last watered <strong>' + esc(agoText(lastWater)) + '</strong>' : 'No watering logged') + '</p>' +
      (lastMist ? '<p class="d-small">Last misted ' + esc(agoText(lastMist)) + '.</p>' : '');

    var alsoWater = '';
    if (p.task !== 'Water') {
      alsoWater = p.alsoWatered
        ? '<div class="d-inline"><span class="d-inline-note">' + ICON.drop + ' Watered today</span><button type="button" class="btn btn-quiet" data-act="unwater" data-id="' + p.id + '" aria-label="Undo watering for ' + esc(p.name) + '">' + ICON.undo + '<span>Undo</span></button></div>'
        : '<div class="d-inline"><button type="button" class="btn btn-quiet" data-act="also-water" data-id="' + p.id + '" aria-label="Log a watering for ' + esc(p.name) + '">' + ICON.drop + '<span>Also watered</span></button></div>';
    }

    return '<div class="grab" aria-hidden="true"></div>' +
      '<div class="d-head">' +
      '<div class="portrait portrait--lg tint-' + p.id + '">' + art(p.id, moodOf(p)) + '</div>' +
      '<div class="d-title"><p class="eyebrow">' + esc(p.location) + '</p>' +
      '<h2 id="detail-title" tabindex="-1">' + esc(p.name) + '</h2>' +
      '<p class="d-species">' + esc(p.species) + '</p></div>' +
      '<button type="button" class="btn btn-quiet d-close" data-act="close" aria-label="Close details">' + ICON.close + '<span>Close</span></button>' +
      '</div>' +
      '<div class="d-next"><p class="d-next-line"><span class="q-task">' + t.icon + esc(p.task) + '</span><span class="d-due ' + (p.overdue && p.status === 'pending' ? 'is-late' : '') + '">' + esc(dueLabel(p)) + '</span></p>' +
      detailActions(p) + alsoWater + '</div>' +

      '<section class="d-sec d-light" aria-labelledby="d-light-h">' +
      '<h3 id="d-light-h"><span class="d-ico d-ico--light">' + ICON.sun + '</span>Light</h3>' +
      '<div class="d-meter"><div class="sunpips" aria-hidden="true">' + sun + '</div><p class="d-big">' + esc(p.light) + '</p></div>' +
      '<p class="sr-only">Light level ' + lvl + ' of 4.</p>' +
      '<p class="d-tip">' + esc(f.light) + '</p>' +
      histList(by.light, 'No turns or wipes logged. This spot has been working.') +
      '</section>' +

      '<section class="d-sec d-water" aria-labelledby="d-water-h">' +
      '<h3 id="d-water-h"><span class="d-ico d-ico--water">' + ICON.drop + '</span>Water</h3>' +
      waterSummary + dripStrip(entries) +
      '<p class="d-tip">' + esc(f.water) + '</p>' +
      histList(by.water, 'Nothing logged yet.') +
      '</section>' +

      '<section class="d-sec d-obs" aria-labelledby="d-obs-h">' +
      '<h3 id="d-obs-h"><span class="d-ico d-ico--obs">' + ICON.eye + '</span>Observations</h3>' +
      '<p class="d-tip">' + esc(f.obs) + '</p>' +
      histList(by.obs, 'Nothing noticed yet. Look closely on the next visit.') +
      '</section>';
  }

  /* ------------------------------------------------------------------ *
   * Render + focus management
   * ------------------------------------------------------------------ */
  function selectorFor(node) {
    if (!node || node === document.body || !node.getAttribute) return null;
    var act = node.getAttribute('data-act'), id = node.getAttribute('data-id');
    var scope = node.closest('#detail') ? '#detail' : (node.closest('#queue') ? '#queue' : '');
    if (act && id && scope) return scope + ' [data-act="' + act + '"][data-id="' + id + '"]';
    if (node.id === 'detail-title') return '#detail-title';
    return null;
  }

  function render(opts) {
    opts = opts || {};
    var sel = opts.focus || selectorFor(document.activeElement);
    renderStatus();
    el.queue.innerHTML = queueHTML();
    el.rhythm.innerHTML = rhythmHTML();
    el.detail.innerHTML = detailHTML();
    state.pulse = null;
    state.wasAllDone = summary().allDone;
    syncMode();
    if (sel) {
      var target = document.querySelector(sel);
      if (!target && opts.fallback) target = document.querySelector(opts.fallback);
      if (target) target.focus();
    }
  }

  /* On desktop the detail is a permanent side panel. On mobile it is a modal
     bottom sheet, so it gets dialog semantics, inert background and a scroll lock. */
  function syncMode() {
    var desk = isDesktop();
    var modal = !desk && state.sheetOpen;
    if (desk && state.sheetOpen) state.sheetOpen = false;
    el.detail.classList.toggle('is-open', modal);
    if (desk) {
      el.detail.removeAttribute('role');
      el.detail.removeAttribute('aria-modal');
      el.detail.setAttribute('aria-label', 'Plant details');
      el.detail.removeAttribute('aria-labelledby');
      el.detail.inert = false;
    } else {
      el.detail.setAttribute('role', 'dialog');
      el.detail.setAttribute('aria-modal', String(modal));
      el.detail.setAttribute('aria-labelledby', 'detail-title');
      el.detail.removeAttribute('aria-label');
      el.detail.inert = !modal;
    }
    [el.masthead, el.status, el.queue, el.rhythm, el.foot].forEach(function (n) { n.inert = modal; });
    el.scrim.hidden = !modal;
    document.body.classList.toggle('sheet-open', modal);
  }

  function announce(msg) {
    el.srLive.textContent = '';
    window.setTimeout(function () { el.srLive.textContent = msg; }, 30);
  }

  /* ------------------------------------------------------------------ *
   * Toast with undo
   * ------------------------------------------------------------------ */
  function hideToast() {
    window.clearTimeout(toastTimer);
    var t = el.toastRegion.firstElementChild;
    if (!t) return;
    var hadFocus = t.contains(document.activeElement);
    el.toastRegion.innerHTML = '';
    if (hadFocus) {
      var back = state.sheetOpen ? $('#detail-title') : el.queue;
      if (back) back.focus();
    }
  }

  function armToast(ms) {
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(hideToast, ms);
  }

  function showToast(message, undoFn, meta) {
    state.lastAction = undoFn ? { undo: undoFn, id: meta && meta.id, kind: meta && meta.kind } : null;
    el.toastRegion.innerHTML =
      '<div class="toast" data-toast>' +
      '<p class="toast-msg">' + esc(message) + '</p>' +
      (undoFn ? '<button type="button" class="btn btn-toast" data-act="toast-undo">' + ICON.undo + '<span>Undo</span></button>' : '') +
      '<button type="button" class="toast-x" data-act="toast-dismiss" aria-label="Dismiss message">' + ICON.close + '</button>' +
      '<span class="toast-bar" style="animation-duration:' + TOAST_MS + 'ms" aria-hidden="true"></span>' +
      '</div>';
    armToast(TOAST_MS);
  }

  el.toastRegion.addEventListener('mouseenter', function () { window.clearTimeout(toastTimer); });
  el.toastRegion.addEventListener('mouseleave', function () { if (el.toastRegion.firstElementChild) armToast(3500); });
  el.toastRegion.addEventListener('focusin', function () { window.clearTimeout(toastTimer); });
  el.toastRegion.addEventListener('focusout', function () { if (el.toastRegion.firstElementChild) armToast(3500); });

  /* ------------------------------------------------------------------ *
   * Actions
   * ------------------------------------------------------------------ */
  function scopeOf(node) { return node && node.closest('#detail') ? '#detail' : '#queue'; }

  function markDone(id, scope) {
    var p = byId(id);
    if (!p || p.status !== 'pending') return;
    p.status = 'done';
    p.doneAt = Date.now();
    var msg = TASKS[p.task].toast(p.name);
    if (summary().allDone) msg += ' That’s everything for today.';
    var undo = function () { p.status = 'pending'; p.doneAt = 0; };
    state.lastAction = { undo: undo, id: id, kind: 'care' };
    state.pulse = id;
    render({ focus: scope + ' [data-act="restore"][data-id="' + id + '"]', fallback: '#queue [data-act="restore"][data-id="' + id + '"]' });
    showToast(msg, undo, { id: id, kind: 'care' });
  }

  function snooze(id, scope) {
    var p = byId(id);
    if (!p || p.status !== 'pending') return;
    var target = snoozeTarget(p);
    p.status = 'snoozed';
    var msg = p.name + ' snoozed until ' + target + '.';
    if (summary().allDone) msg += ' Nothing else is due today.';
    var undo = function () { p.status = 'pending'; };
    state.lastAction = { undo: undo, id: id, kind: 'care' };
    state.pulse = id;
    render({ focus: scope + ' [data-act="restore"][data-id="' + id + '"]', fallback: '#queue [data-act="restore"][data-id="' + id + '"]' });
    showToast(msg, undo, { id: id, kind: 'care' });
  }

  function restore(id, scope) {
    var p = byId(id);
    if (!p || p.status === 'pending') return;
    var was = p.status;
    p.status = 'pending';
    p.doneAt = 0;
    state.lastAction = null;
    state.pulse = id;
    hideToast();
    render({ focus: scope + ' [data-act="done"][data-id="' + id + '"]', fallback: '#queue [data-act="done"][data-id="' + id + '"]' });
    announce(was === 'done' ? p.name + ' is back in the queue.' : p.name + ' is back in today’s queue.');
  }

  function alsoWater(id, scope) {
    var p = byId(id);
    if (!p || p.alsoWatered) return;
    p.alsoWatered = true;
    var msg = 'Watering logged for ' + p.name + '.';
    render({ focus: scope + ' [data-act="unwater"][data-id="' + id + '"]' });
    showToast(msg, function () { p.alsoWatered = false; }, { id: id, kind: 'water' });
  }

  function unwater(id, scope) {
    var p = byId(id);
    if (!p || !p.alsoWatered) return;
    p.alsoWatered = false;
    hideToast();
    state.lastAction = null;
    render({ focus: scope + ' [data-act="also-water"][data-id="' + id + '"]' });
    announce('Watering removed for ' + p.name + '.');
  }

  function openPlant(id, btn) {
    state.selectedId = id;
    if (!isDesktop()) {
      state.sheetOpen = true;
      state.opener = selectorFor(btn);
      render({ focus: '#detail-title' });
    } else {
      render();
    }
    announce('Showing details for ' + byId(id).name + '.');
  }

  function closeSheet() {
    if (!state.sheetOpen) return;
    state.sheetOpen = false;
    render({ focus: state.opener, fallback: '#queue' });
  }

  function reset() {
    state.plants = makePlants();
    state.selectedId = state.plants.slice().sort(function (a, b) { return b.urgency - a.urgency; })[0].id;
    state.sheetOpen = false;
    state.lastAction = null;
    hideToast();
    render();
    announce('Today started over. Four plants are waiting.');
    el.queue.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id'), scope = scopeOf(b);
    switch (act) {
      case 'open': openPlant(id, b); break;
      case 'close': closeSheet(); break;
      case 'done': markDone(id, scope); break;
      case 'snooze': snooze(id, scope); break;
      case 'restore': restore(id, scope); break;
      case 'also-water': alsoWater(id, scope); break;
      case 'unwater': unwater(id, scope); break;
      case 'reset': reset(); break;
      case 'toast-dismiss': hideToast(); break;
      case 'toast-undo':
        if (state.lastAction) {
          var la = state.lastAction;
          state.lastAction = null;
          hideToast();
          la.undo();
          state.pulse = la.id;
          var sel = la.kind === 'water'
            ? '#detail [data-act="also-water"][data-id="' + la.id + '"]'
            : (state.sheetOpen ? '#detail' : '#queue') + ' [data-act="done"][data-id="' + la.id + '"]';
          render({ focus: sel, fallback: '#queue [data-act="open"][data-id="' + la.id + '"]' });
          announce('Undone.');
        }
        break;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.sheetOpen) {
      e.preventDefault();
      closeSheet();
      return;
    }
    if (e.key === 'Tab' && state.sheetOpen && !isDesktop()) {
      var active = document.activeElement;
      if (!el.detail.contains(active)) return; // let the toast be reachable
      var f = Array.prototype.slice.call(el.detail.querySelectorAll('button:not([disabled])'));
      if (!f.length) return;
      var head = $('#detail-title');
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (active === first || active === head)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }
  });

  var onMQ = function () { syncMode(); render({ focus: null }); };
  if (desktopMQ.addEventListener) desktopMQ.addEventListener('change', onMQ);
  else if (desktopMQ.addListener) desktopMQ.addListener(onMQ);

  /* Go. */
  render({ focus: null });
})();
