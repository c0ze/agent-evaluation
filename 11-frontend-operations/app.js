/* ============================================================
   Relay — operations control room
   Vanilla JS. No dependencies, no network required.
   Data comes from DATA.json when served over http(s); when the
   page is opened straight from disk (file://) the same seed is
   used so the dashboard always renders.
   ============================================================ */

(function () {
  'use strict';

  var CURRENT_USER = 'A. Novak';

  /* Fallback seed — mirrors DATA.json exactly. */
  var SEED = {
    metrics: [
      { label: 'Events / min', value: '18,420', change: '+8.2%', direction: 'up' },
      { label: 'P95 latency', value: '184 ms', change: '−12 ms', direction: 'down' },
      { label: 'Error rate', value: '0.37%', change: '+0.08 pp', direction: 'up' },
      { label: 'Queue depth', value: '2,841', change: '−19%', direction: 'down' }
    ],
    throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    incidents: [
      { id: 'INC-2841', severity: 'critical', service: 'payments-api', age: '12m', owner: 'M. Chen', status: 'investigating', title: 'Card authorization timeouts' },
      { id: 'INC-2839', severity: 'high', service: 'event-router', age: '31m', owner: 'Unassigned', status: 'open', title: 'EU retry queue growth' },
      { id: 'INC-2837', severity: 'medium', service: 'search-index', age: '1h 08m', owner: 'A. Silva', status: 'monitoring', title: 'Index freshness outside SLO' },
      { id: 'INC-2832', severity: 'low', service: 'webhooks', age: '3h 42m', owner: 'R. Patel', status: 'open', title: 'Elevated partner delivery lag' }
    ]
  };

  var SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
  var STATUS_ORDER = { open: 0, investigating: 1, monitoring: 2, acknowledged: 3 };

  var state = {
    incidents: [],
    metrics: [],
    throughput: [],
    search: '',
    severity: 'all',
    service: 'all',
    status: 'all',
    unassignedOnly: false,
    sort: { key: 'severity', dir: 'desc' },
    selectedId: null,
    focusId: null,
    startedAt: Date.now()
  };

  var el = {};
  var lastChartWidth = 0;

  /* ---------- helpers ---------- */

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function byId(id) {
    for (var i = 0; i < state.incidents.length; i++) {
      if (state.incidents[i].id === id) return state.incidents[i];
    }
    return null;
  }

  /* "1h 08m" -> 68 ; "12m" -> 12 */
  function parseAge(str) {
    var m = /(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/.exec(String(str));
    var h = parseInt(m && m[1], 10) || 0;
    var mm = parseInt(m && m[2], 10) || 0;
    return h * 60 + mm;
  }

  function fmtAge(totalMin) {
    var v = Math.max(0, Math.round(totalMin));
    var h = Math.floor(v / 60);
    var m = v % 60;
    if (h === 0) return m + 'm';
    return h + 'h ' + String(m).padStart(2, '0') + 'm';
  }

  /* Live age = seeded age + wall-clock minutes since load. */
  function liveAge(inc) {
    var extra = Math.floor((Date.now() - state.startedAt) / 60000);
    return inc.baseAge + extra;
  }

  function hashNum(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) n = (n * 31 + str.charCodeAt(i)) % 100000;
    return n;
  }

  function sparkPoints(seed, direction) {
    var pts = [];
    var v = 12;
    var drift = direction === 'up' ? 0.5 : -0.5;
    for (var i = 0; i < 18; i++) {
      v += Math.sin(seed * 0.017 + i * 0.7) * 1.9 + drift;
      pts.push(Math.max(3, Math.min(23, v)));
    }
    return pts;
  }

  /* ---------- data ---------- */

  function loadData(cb) {
    if (location.protocol === 'file:') { cb(SEED); return; }
    fetch('DATA.json')
      .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
      .then(cb)
      .catch(function () { cb(SEED); });
  }

  function init(data) {
    state.metrics = data.metrics || [];
    state.throughput = data.throughput || [];
    state.incidents = (data.incidents || []).map(function (inc) {
      return {
        id: inc.id,
        severity: inc.severity,
        service: inc.service,
        title: inc.title,
        owner: inc.owner,
        status: inc.status,
        baseAge: parseAge(inc.age),
        timeline: buildTimeline(inc)
      };
    });

    state.selectedId = defaultSelection();
    state.focusId = state.selectedId;

    cacheEls();
    renderMetricCards();
    renderLegend();
    renderChart();
    populateServices();
    bindEvents();
    renderTable();
    renderDetail();
    renderStatusBars();
    startClock();
  }

  function defaultSelection() {
    var active = state.incidents.filter(function (i) { return i.status !== 'acknowledged'; });
    active.sort(function (a, b) { return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]; });
    return active.length ? active[0].id : (state.incidents[0] ? state.incidents[0].id : null);
  }

  function cacheEls() {
    el.metrics = $('metrics');
    el.legend = $('chart-legend');
    el.chartWrap = $('chart-wrap');
    el.chart = $('chart');
    el.tip = $('chart-tip');
    el.body = $('incident-body');
    el.tableEmpty = $('table-empty');
    el.table = $('incident-table');
    el.detail = $('detail-body');
    el.resultCount = $('result-count');
    el.toasts = $('toast-region');
    el.pill = $('system-pill');
    el.pillText = $('system-pill-text');
    el.railCount = $('rail-open-count');
    el.clock = $('clock');
  }

  /* ---------- metrics ---------- */

  function sentimentFor(metric) {
    var label = metric.label.toLowerCase();
    var lowerIsBetter = /latency|error|queue|depth|backlog/.test(label);
    if (metric.direction === 'down') return lowerIsBetter ? 'good' : 'bad';
    if (metric.direction === 'up') return lowerIsBetter ? 'bad' : 'good';
    return 'flat';
  }

  function renderMetricCards() {
    el.metrics.innerHTML = state.metrics.map(function (m, i) {
      var sentiment = sentimentFor(m);
      var seed = hashNum(m.label + i);
      var pts = sparkPoints(seed, m.direction);
      var w = 78, h = 26;
      var max = 26;
      var coords = pts.map(function (p, idx) {
        var x = (idx / (pts.length - 1)) * w;
        var y = h - (p / max) * h;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      var stroke = sentiment === 'good' ? 'var(--ok)' : sentiment === 'bad' ? 'var(--sev-high)' : 'var(--accent)';
      var arrow = m.direction === 'up' ? '▲' : m.direction === 'down' ? '▼' : '■';
      var word = m.direction === 'up' ? 'increased' : m.direction === 'down' ? 'decreased' : 'unchanged';

      return '' +
        '<article class="metric">' +
          '<p class="metric__label">' + esc(m.label) + '</p>' +
          '<div class="metric__row">' +
            '<span class="metric__value">' + esc(m.value) + '</span>' +
            '<span class="metric__delta metric__delta--' + sentiment + '">' +
              '<span aria-hidden="true">' + arrow + '</span>' +
              '<span class="sr-only">' + word + ' </span>' +
              esc(m.change) +
            '</span>' +
          '</div>' +
          '<div class="metric__foot">' +
            '<span class="metric__context">vs previous 24 h</span>' +
            '<svg class="metric__spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
              '<polyline points="' + coords + '" fill="none" style="stroke:' + stroke + '" stroke-width="1.4" ' +
              'stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>' +
            '</svg>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  /* ---------- chart ---------- */

  function renderLegend() {
    var vals = state.throughput;
    if (!vals.length) { el.legend.innerHTML = ''; return; }
    var peak = Math.max.apply(null, vals);
    var peakIdx = vals.indexOf(peak);
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    el.legend.innerHTML =
      '<span class="legend-item"><span class="legend-swatch legend-swatch--peak" aria-hidden="true"></span>' +
        'Peak <span class="legend-value">' + peak + '</span> at ' + hourLabel(peakIdx) + '</span>' +
      '<span class="legend-item"><span class="legend-swatch legend-swatch--avg" aria-hidden="true"></span>' +
        'Mean <span class="legend-value">' + mean.toFixed(1) + '</span></span>';
  }

  function hourLabel(i) { return String(i).padStart(2, '0') + ':00'; }

  function renderChart() {
    var vals = state.throughput;
    var host = el.chart;
    if (!vals.length) { host.innerHTML = ''; return; }

    var w = Math.max(280, Math.floor(host.clientWidth || 640));
    var h = w < 560 ? 176 : 224;
    var padL = 30, padR = 8, padT = 16, padB = 24;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    var baseline = padT + plotH;

    var peak = Math.max.apply(null, vals);
    var peakIdx = vals.indexOf(peak);
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    var scaleMax = Math.max(20, Math.ceil(peak / 20) * 20);

    var yOf = function (v) { return baseline - (v / scaleMax) * plotH; };
    var slot = plotW / vals.length;
    var barW = Math.min(20, Math.max(4, slot * 0.6));

    var svg = [];
    svg.push('<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" ' +
             'aria-label="Hourly throughput index over the last 24 hours. Mean ' + mean.toFixed(1) +
             ', peak ' + peak + ' at ' + hourLabel(peakIdx) + ', low ' + Math.min.apply(null, vals) + '.">');

    /* grid + y ticks */
    for (var t = 0; t <= 4; t++) {
      var frac = t / 4;
      var y = baseline - frac * plotH;
      svg.push('<line class="chart__grid-line" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + y.toFixed(1) + '"/>');
      svg.push('<text class="chart__tick" x="' + (padL - 7) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + Math.round(scaleMax * frac) + '</text>');
    }
    svg.push('<line class="chart__axis" x1="' + padL + '" y1="' + baseline + '" x2="' + (w - padR) + '" y2="' + baseline + '"/>');

    /* bars */
    for (var i = 0; i < vals.length; i++) {
      var bx = padL + i * slot + (slot - barW) / 2;
      var by = yOf(vals[i]);
      var bh = Math.max(1, baseline - by);
      var isPeak = i === peakIdx;
      svg.push('<g class="chart__group" data-i="' + i + '" data-x="' + (bx + barW / 2).toFixed(1) + '" data-y="' + by.toFixed(1) + '">');
      svg.push('<rect class="chart__hit" x="' + (padL + i * slot).toFixed(1) + '" y="' + padT + '" width="' + slot.toFixed(1) + '" height="' + plotH + '"/>');
      svg.push('<rect class="chart__bar' + (isPeak ? ' chart__bar--peak' : '') + '" x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) +
               '" width="' + barW.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="1.5"/>');
      svg.push('</g>');
    }

    /* mean line */
    var meanY = yOf(mean);
    svg.push('<line class="chart__avg" x1="' + padL + '" y1="' + meanY.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + meanY.toFixed(1) + '"/>');
    svg.push('<text class="chart__avg-label" x="' + (w - padR) + '" y="' + (meanY - 5).toFixed(1) + '" text-anchor="end">mean ' + mean.toFixed(1) + '</text>');

    /* x labels every 3 hours */
    for (var k = 0; k < vals.length; k += 3) {
      svg.push('<text class="chart__tick" x="' + (padL + k * slot + slot / 2).toFixed(1) + '" y="' + (baseline + 14) + '" text-anchor="middle">' + String(k).padStart(2, '0') + '</text>');
    }

    svg.push('</svg>');
    host.innerHTML = svg.join('');

    lastChartWidth = w;

    var groups = host.querySelectorAll('.chart__group');
    Array.prototype.forEach.call(groups, function (g) {
      g.addEventListener('mouseenter', showTip);
      g.addEventListener('mouseleave', hideTip);
    });
  }

  function showTip(e) {
    var g = e.currentTarget;
    var i = parseInt(g.getAttribute('data-i'), 10);
    var x = parseFloat(g.getAttribute('data-x'));
    var y = parseFloat(g.getAttribute('data-y'));
    g.classList.add('is-active');
    el.tip.innerHTML = hourLabel(i) + ' · index <b>' + state.throughput[i] + '</b>';
    el.tip.hidden = false;
    el.tip.style.left = (el.chart.offsetLeft + x) + 'px';
    el.tip.style.top = (el.chart.offsetTop + y - 8) + 'px';
  }

  function hideTip(e) {
    e.currentTarget.classList.remove('is-active');
    el.tip.hidden = true;
  }

  /* ---------- filtering + sorting ---------- */

  function visibleIncidents() {
    var q = state.search.trim().toLowerCase();
    var list = state.incidents.filter(function (inc) {
      if (state.severity !== 'all' && inc.severity !== state.severity) return false;
      if (state.status !== 'all' && inc.status !== state.status) return false;
      if (state.service !== 'all' && inc.service !== state.service) return false;
      if (state.unassignedOnly && inc.owner !== 'Unassigned') return false;
      if (q) {
        var hay = (inc.id + ' ' + inc.title + ' ' + inc.service + ' ' + inc.owner + ' ' + inc.severity + ' ' + inc.status).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    /* "desc" always means "most significant first": worst severity / oldest age. */
    var key = state.sort.key;
    var desc = state.sort.dir === 'desc';
    list.sort(function (a, b) {
      var r;
      if (key === 'age') {
        r = liveAge(a) - liveAge(b);
      } else {
        r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (r === 0) r = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      }
      if (r === 0) r = a.id < b.id ? -1 : 1;
      /* age: desc = oldest first (reverse of raw minutes).
         severity: desc = critical first (rank 0 ascending). */
      if (key === 'age') return desc ? -r : r;
      return desc ? r : -r;
    });
    return list;
  }

  function filtersActive() {
    return state.severity !== 'all' || state.status !== 'all' || state.service !== 'all' ||
           state.unassignedOnly || state.search.trim() !== '';
  }

  /* ---------- table ---------- */

  function renderTable() {
    var list = visibleIncidents();
    var total = state.incidents.length;

    el.resultCount.textContent = filtersActive()
      ? 'Showing ' + list.length + ' of ' + total + ' incidents'
      : list.length + ' incidents · ' + activeCount() + ' active';

    /* Keep exactly one row tabbable so the grid stays reachable after filtering. */
    if (!state.focusId || !list.some(function (i) { return i.id === state.focusId; })) {
      state.focusId = list.length ? list[0].id : null;
    }
    if (state.selectedId && !list.some(function (i) { return i.id === state.selectedId; })) {
      state.selectedId = null;
    }

    el.tableEmpty.hidden = list.length !== 0;
    el.table.hidden = list.length === 0;

    el.body.innerHTML = list.map(function (inc) {
      var selected = inc.id === state.selectedId;
      var acked = inc.status === 'acknowledged';
      var tabIndex = inc.id === state.focusId ? '0' : '-1';
      return '' +
        '<tr class="' + (selected ? 'is-selected ' : '') + (acked ? 'is-acked' : '') + '"' +
            ' data-id="' + esc(inc.id) + '" tabindex="' + tabIndex + '"' +
            ' role="row" aria-selected="' + (selected ? 'true' : 'false') + '">' +
          '<td class="col-sev" data-label="Severity">' + sevMarkup(inc.severity) + '</td>' +
          '<td class="col-id cell-id" data-label="ID">' + esc(inc.id) + '</td>' +
          '<td class="cell-main" data-label="Incident">' +
            '<div class="cell-title">' + esc(inc.title) + '</div>' +
            '<div class="cell-service">' + esc(inc.service) + '</div>' +
          '</td>' +
          '<td class="col-age cell-age" data-label="Age">' + fmtAge(liveAge(inc)) + '</td>' +
          '<td class="col-owner" data-label="Owner">' +
            '<span class="cell-owner' + (inc.owner === 'Unassigned' ? ' is-unassigned' : '') + '">' + esc(inc.owner) + '</span>' +
          '</td>' +
          '<td class="col-status" data-label="Status">' + statusMarkup(inc.status) + '</td>' +
          '<td class="col-act" data-label="Action">' + ackButton(inc) + '</td>' +
        '</tr>';
    }).join('');

    var ths = el.table.querySelectorAll('th');
    Array.prototype.forEach.call(ths, function (th) {
      var btn = th.querySelector('.th-sort');
      if (!btn) return;
      if (btn.getAttribute('data-sort') === state.sort.key) {
        th.setAttribute('aria-sort', state.sort.dir === 'asc' ? 'ascending' : 'descending');
      } else {
        th.removeAttribute('aria-sort');
      }
    });
  }

  function sevMarkup(sev) {
    return '<span class="sev sev--' + sev + '"><span class="sev__dot" aria-hidden="true"></span>' + esc(sev) + '</span>';
  }

  function statusMarkup(status) {
    return '<span class="status status--' + status + '"><span class="status__dot" aria-hidden="true"></span>' + esc(status) + '</span>';
  }

  function ackButton(inc) {
    if (inc.status === 'acknowledged') {
      return '<button class="btn row-ack" type="button" data-ack="' + esc(inc.id) + '" disabled>Acknowledged</button>';
    }
    return '<button class="btn row-ack" type="button" data-ack="' + esc(inc.id) + '">Ack</button>';
  }

  function activeCount() {
    return state.incidents.filter(function (i) { return i.status !== 'acknowledged'; }).length;
  }

  /* ---------- detail ---------- */

  function buildTimeline(inc) {
    var age = parseAge(inc.age);
    var items = [];
    items.push({ m: age, text: 'Alert fired — ' + inc.title, key: true });
    if (inc.owner === 'Unassigned') {
      items.push({ m: Math.max(0, age - 3), text: 'Auto-routed to on-call queue · no owner claimed' });
    } else {
      items.push({ m: Math.max(0, age - 3), text: 'Routed to ' + inc.owner });
    }
    if (inc.status === 'investigating') {
      items.push({ m: Math.max(0, age - 6), text: 'Investigation started · runbook RB-14 attached' });
    } else if (inc.status === 'monitoring') {
      items.push({ m: Math.max(0, age - 9), text: 'Mitigation applied · watching for regression' });
    } else if (inc.status === 'open') {
      items.push({ m: Math.max(0, age - 8), text: 'Triage pending · awaiting first response' });
    }
    items.push({ m: Math.max(0, age - Math.min(20, Math.floor(age / 2))), text: 'Correlated signals attached from ' + inc.service });
    return items;
  }

  function signalsFor(inc) {
    var n = parseInt(String(inc.id).replace(/\D/g, ''), 10) || 1000;
    var boost = { critical: 180, high: 95, medium: 40, low: 12 }[inc.severity] || 20;
    var p95 = 148 + boost + (n % 47);
    var err = ((n % 23) / 10 + (boost / 120)).toFixed(2);
    var affected = 1200 + (n % 41) * 68;
    return [
      { name: 'p95 latency', value: p95 + ' ms', level: p95 > 300 ? 'is-bad' : p95 > 220 ? 'is-warn' : '', pct: Math.min(100, p95 / 5) },
      { name: 'Error rate', value: err + '%', level: parseFloat(err) > 1.5 ? 'is-bad' : parseFloat(err) > 0.5 ? 'is-warn' : '', pct: Math.min(100, parseFloat(err) * 40) },
      { name: 'Affected requests', value: affected.toLocaleString('en-US'), level: '', pct: Math.min(100, affected / 60) }
    ];
  }

  function renderDetail() {
    var inc = byId(state.selectedId);
    if (!inc) {
      el.detail.innerHTML =
        '<div class="empty">' +
          '<p class="empty__title">No incident selected</p>' +
          '<p class="empty__body">Pick a row from the incident table to inspect signals, timeline, ' +
          'and ownership. Keyboard: ↑ ↓ to move, Enter to open.</p>' +
        '</div>';
      return;
    }

    var acked = inc.status === 'acknowledged';
    var signals = signalsFor(inc);

    var html = '' +
      '<div class="detail__head">' +
        '<div>' +
          '<p class="detail__id">' + esc(inc.id) + '</p>' +
          '<h3 class="detail__title">' + esc(inc.title) + '</h3>' +
        '</div>' +
        '<div class="detail__badges">' +
          '<span class="badge badge--' + inc.severity + '"><span class="badge__dot" aria-hidden="true"></span>' + esc(inc.severity) + '</span>' +
          '<span class="status status--' + inc.status + '">' +
            '<span class="status__dot" aria-hidden="true"></span>' + esc(inc.status) + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="detail__section">' +
        '<p class="detail__label">Details</p>' +
        '<dl class="kv">' +
          '<dt>Service</dt><dd class="is-text">' + esc(inc.service) + '</dd>' +
          '<dt>Owner</dt><dd class="is-text">' + esc(inc.owner) + '</dd>' +
          '<dt>Age</dt><dd>' + fmtAge(liveAge(inc)) + '</dd>' +
          '<dt>Region</dt><dd class="is-text">us-east-1</dd>' +
        '</dl>' +
      '</div>' +

      '<div class="detail__section">' +
        '<p class="detail__label">Signals</p>' +
        '<div class="signals">' +
          signals.map(function (s) {
            return '<div class="signal">' +
                '<span class="signal__name">' + esc(s.name) + '</span>' +
                '<span class="signal__value ' + s.level + '">' + esc(s.value) + '</span>' +
              '</div>' +
              '<div class="signal__bar" aria-hidden="true"><span style="width:' + s.pct.toFixed(0) + '%"></span></div>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="detail__section">' +
        '<p class="detail__label">Timeline</p>' +
        '<ol class="timeline">' +
          inc.timeline.map(function (t) {
            return '<li class="timeline__item' + (t.key ? ' is-key' : '') + '">' +
              '<p class="timeline__time">T−' + fmtAge(t.m) + '</p>' +
              '<p class="timeline__text">' + esc(t.text) + '</p>' +
            '</li>';
          }).join('') +
        '</ol>' +
      '</div>' +

      '<div class="detail__actions">' +
        '<div class="detail__actions-row">' +
          '<button class="btn btn--primary btn--block" type="button" data-ack="' + esc(inc.id) + '"' +
            (acked ? ' disabled' : '') + '>' + (acked ? 'Acknowledged' : 'Acknowledge') + '</button>' +
          '<button class="btn btn--block" type="button" data-assign="' + esc(inc.id) + '"' +
            (inc.owner === CURRENT_USER ? ' disabled' : '') + '>' +
            (inc.owner === CURRENT_USER ? 'Assigned to you' : 'Assign to me') + '</button>' +
        '</div>' +
        '<p class="detail__note">' +
          (acked ? 'Acknowledged by ' + esc(inc.owner) + ' · page silenced'
                 : 'Acknowledging pages ' + esc(inc.owner === 'Unassigned' ? CURRENT_USER : inc.owner) + ' and starts the SLA clock') +
        '</p>' +
      '</div>';

    el.detail.innerHTML = html;
  }

  /* ---------- actions ---------- */

  function acknowledge(id, fromDetail) {
    var inc = byId(id);
    if (!inc || inc.status === 'acknowledged') return;
    var claimed = inc.owner === 'Unassigned';
    inc.status = 'acknowledged';
    if (claimed) inc.owner = CURRENT_USER;
    inc.timeline.unshift({ m: 0, text: 'Acknowledged by ' + CURRENT_USER + (claimed ? ' · ownership claimed' : ''), key: true });
    toast('<b>' + esc(inc.id) + '</b> acknowledged' + (claimed ? ' · assigned to ' + CURRENT_USER : ''));
    state.focusId = id;
    renderTable();
    renderDetail();
    renderStatusBars();
    restoreFocus(id, fromDetail);
  }

  function assignToMe(id, fromDetail) {
    var inc = byId(id);
    if (!inc || inc.owner === CURRENT_USER) return;
    inc.owner = CURRENT_USER;
    inc.timeline.unshift({ m: 0, text: 'Ownership claimed by ' + CURRENT_USER });
    toast('<b>' + esc(inc.id) + '</b> assigned to ' + CURRENT_USER);
    state.focusId = id;
    renderTable();
    renderDetail();
    restoreFocus(id, fromDetail);
  }

  /* Re-rendering replaces the row/button, so put focus back where the operator was. */
  function restoreFocus(id, fromDetail) {
    if (fromDetail) {
      var panel = $('detail');
      if (panel) panel.focus();
      return;
    }
    var row = el.body.querySelector('tr[data-id="' + id + '"]');
    if (row) row.focus();
  }

  function selectIncident(id) {
    state.selectedId = id;
    state.focusId = id;
    renderTable();
    renderDetail();
    var row = el.body.querySelector('tr[data-id="' + id + '"]');
    if (row) row.focus();
  }

  function toast(html) {
    var node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = html;
    el.toasts.appendChild(node);
    setTimeout(function () {
      node.style.transition = 'opacity 160ms linear';
      node.style.opacity = '0';
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 180);
    }, 3200);
  }

  function renderStatusBars() {
    var crit = state.incidents.filter(function (i) { return i.severity === 'critical' && i.status !== 'acknowledged'; }).length;
    var high = state.incidents.filter(function (i) { return i.severity === 'high' && i.status !== 'acknowledged'; }).length;
    var active = activeCount();

    el.pill.className = 'status-pill ' + (crit ? 'is-degraded' : high ? 'is-attention' : 'is-clear');
    el.pillText.textContent = crit
      ? 'Degraded · ' + crit + ' critical'
      : high ? 'Attention · ' + high + ' high'
      : 'All clear · ' + active + ' active';
    el.railCount.textContent = String(active);
  }

  function startClock() {
    function tick() {
      var d = new Date();
      el.clock.textContent = String(d.getUTCHours()).padStart(2, '0') + ':' +
        String(d.getUTCMinutes()).padStart(2, '0') + ' UTC';
    }
    tick();
    setInterval(tick, 20000);
    /* ages advance every minute */
    setInterval(function () {
      renderTable();
      renderDetail();
    }, 60000);
  }

  /* ---------- events ---------- */

  function populateServices() {
    var sel = $('f-service');
    var seen = {};
    state.incidents.forEach(function (i) { seen[i.service] = true; });
    Object.keys(seen).sort().forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
  }

  function bindEvents() {
    var searchTimer = null;
    $('search').addEventListener('input', function (e) {
      var v = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.search = v;
        renderTable();
        renderDetail();
      }, 120);
    });

    $('f-severity').addEventListener('change', function (e) { state.severity = e.target.value; renderTable(); renderDetail(); });
    $('f-status').addEventListener('change', function (e) { state.status = e.target.value; renderTable(); renderDetail(); });
    $('f-service').addEventListener('change', function (e) { state.service = e.target.value; renderTable(); renderDetail(); });

    $('f-unassigned').addEventListener('click', function (e) {
      state.unassignedOnly = !state.unassignedOnly;
      e.currentTarget.setAttribute('aria-pressed', state.unassignedOnly ? 'true' : 'false');
      renderTable();
      renderDetail();
    });

    function clearFilters() {
      state.search = '';
      state.severity = 'all';
      state.status = 'all';
      state.service = 'all';
      state.unassignedOnly = false;
      $('search').value = '';
      $('f-severity').value = 'all';
      $('f-status').value = 'all';
      $('f-service').value = 'all';
      $('f-unassigned').setAttribute('aria-pressed', 'false');
      renderTable();
      renderDetail();
    }
    $('f-clear').addEventListener('click', clearFilters);
    el.tableEmpty.querySelector('[data-clear-filters]').addEventListener('click', clearFilters);

    el.table.querySelectorAll('.th-sort').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-sort');
        if (state.sort.key === key) {
          state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sort.key = key;
          state.sort.dir = 'desc'; /* severity: highest first · age: oldest first */
        }
        renderTable();
      });
    });

    el.body.addEventListener('click', function (e) {
      var ackBtn = e.target.closest('[data-ack]');
      if (ackBtn) { e.stopPropagation(); acknowledge(ackBtn.getAttribute('data-ack')); return; }
      var row = e.target.closest('tr[data-id]');
      if (row) selectIncident(row.getAttribute('data-id'));
    });

    el.body.addEventListener('keydown', function (e) {
      var row = e.target.closest('tr[data-id]');
      if (!row) return;
      var id = row.getAttribute('data-id');

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectIncident(id);
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        acknowledge(id);
        return;
      }
      var dir = e.key === 'ArrowDown' || e.key === 'j' ? 1
              : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0;
      if (dir === 0) {
        if (e.key === 'Home' || e.key === 'End') {
          var list = visibleIncidents();
          if (!list.length) return;
          e.preventDefault();
          var target = e.key === 'Home' ? list[0] : list[list.length - 1];
          state.focusId = target.id;
          renderTable();
          var t = el.body.querySelector('tr[data-id="' + target.id + '"]');
          if (t) t.focus();
        }
        return;
      }
      e.preventDefault();
      var list2 = visibleIncidents();
      var idx = list2.findIndex(function (i) { return i.id === id; });
      var next = list2[Math.min(list2.length - 1, Math.max(0, idx + dir))];
      if (!next) return;
      state.focusId = next.id;
      renderTable();
      var nr = el.body.querySelector('tr[data-id="' + next.id + '"]');
      if (nr) nr.focus();
    });

    el.detail.addEventListener('click', function (e) {
      var ackBtn = e.target.closest('[data-ack]');
      if (ackBtn && !ackBtn.disabled) { acknowledge(ackBtn.getAttribute('data-ack'), true); return; }
      var assignBtn = e.target.closest('[data-assign]');
      if (assignBtn && !assignBtn.disabled) { assignToMe(assignBtn.getAttribute('data-assign'), true); }
    });

    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
        e.preventDefault();
        $('search').focus();
      }
    });

    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(function () {
        var w = Math.floor(el.chart.clientWidth || 0);
        if (Math.abs(w - lastChartWidth) > 8) renderChart();
      });
      ro.observe(el.chart);
    } else {
      window.addEventListener('resize', function () {
        var w = Math.floor(el.chart.clientWidth || 0);
        if (Math.abs(w - lastChartWidth) > 8) renderChart();
      });
    }
  }

  loadData(init);
})();
