/* ==========================================================================
   Relay — operations control room
   Vanilla JS. No frameworks, no build step, no network requests.
   Seed content is inlined below from DATA.json (fetching a local file over
   file:// is blocked by CORS, so the values are copied verbatim and DATA.json
   stays the single source of truth for review).
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------- seed -- */
  var SEED = {
    metrics: [
      { label: 'Events / min', value: '18,420', change: '+8.2%', direction: 'up', good: true, context: 'vs 1h ago', spark: [62, 64, 63, 66, 69, 68, 72, 75, 73, 78, 76, 81] },
      { label: 'P95 latency', value: '184 ms', change: '−12 ms', direction: 'down', good: true, context: 'vs 1h ago', spark: [214, 209, 211, 203, 199, 201, 195, 191, 194, 188, 186, 184] },
      { label: 'Error rate', value: '0.37%', change: '+0.08 pp', direction: 'up', good: false, context: 'vs 1h ago', spark: [0.22, 0.24, 0.23, 0.26, 0.25, 0.29, 0.28, 0.31, 0.3, 0.34, 0.33, 0.37] },
      { label: 'Queue depth', value: '2,841', change: '−19%', direction: 'down', good: true, context: 'vs 1h ago', spark: [3520, 3410, 3380, 3260, 3190, 3150, 3040, 2990, 2960, 2905, 2872, 2841] }
    ],
    throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    incidents: [
      { id: 'INC-2841', severity: 'critical', service: 'payments-api', age: '12m', owner: 'M. Chen', status: 'investigating', title: 'Card authorization timeouts',
        impact: 'Card authorization is timing out for 4.1% of requests in eu-west-1. Checkout completion is down; settlement retries are draining the queue.',
        detected: 'anomaly probe · eu-west-1', runbook: ['Freeze payments-api deploys', 'Check upstream issuer gateway latency', 'Shift 20% traffic to us-east-1', 'Post status update if > 5 min'] },
      { id: 'INC-2839', severity: 'high', service: 'event-router', age: '31m', owner: 'Unassigned', status: 'open', title: 'EU retry queue growth',
        impact: 'The EU retry queue is growing 3.2k msg/min with no owner. Dead-letter rate is holding at 0.1%, so no data loss yet.',
        detected: 'queue depth alert', runbook: ['Claim the incident', 'Scale event-router consumers to 24', 'Inspect poison messages in DLQ'] },
      { id: 'INC-2837', severity: 'medium', service: 'search-index', age: '1h 08m', owner: 'A. Silva', status: 'monitoring', title: 'Index freshness outside SLO',
        impact: 'Index freshness is 9m against a 5m SLO. Read traffic is unaffected; filter facets may lag by up to 9 minutes.',
        detected: 'SLO burn-rate alert', runbook: ['Confirm shard lag on primaries', 'Trigger a catch-up reindex', 'Extend the SLO window if behind on backlog'] },
      { id: 'INC-2832', severity: 'low', service: 'webhooks', age: '3h 42m', owner: 'R. Patel', status: 'open', title: 'Elevated partner delivery lag',
        impact: 'Partner delivery lag is p95 24s against a 10s objective. Two partners are affected; no delivery failures recorded.',
        detected: 'latency SLO report', runbook: ['Identify lagging partner endpoints', 'Verify signing certificate rotation', 'Open vendor ticket if lag exceeds 1h'] }
    ]
  };

  var SEV = {
    critical: { label: 'Critical', rank: 0, color: '#ff5f5a' },
    high:     { label: 'High',     rank: 1, color: '#ff9c3c' },
    medium:   { label: 'Medium',   rank: 2, color: '#e3c04d' },
    low:      { label: 'Low',      rank: 3, color: '#7b8ca3' }
  };
  var SEV_ORDER = ['critical', 'high', 'medium', 'low'];

  var STATUS = {
    open:          { label: 'Open' },
    investigating: { label: 'Investigating' },
    monitoring:    { label: 'Monitoring' },
    acknowledged:  { label: 'Acknowledged' },
    resolved:      { label: 'Resolved' }
  };

  /* --------------------------------------------------------- utilities -- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ageToMinutes(age) {
    var m = /^(\d+)\s*m/.exec(age);
    if (m) return parseInt(m[1], 10);
    var hm = /^(\d+)h\s*(\d+)m/.exec(age);
    if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
    return 0;
  }
  function clockTime(ts) {
    return CLOCK_FMT ? CLOCK_FMT.format(new Date(ts)) : fallbackTime(ts, false);
  }
  function hourLabel(ts) {
    return HOUR_FMT ? HOUR_FMT.format(new Date(ts)) : fallbackTime(ts, true);
  }
  function fallbackTime(ts, hoursOnly) {
    var d = new Date(ts);
    var hh = ('0' + d.getHours()).slice(-2);
    if (hoursOnly) return hh;
    return hh + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
  /* The console is presented in Tokyo time; keep every rendered time in that
     zone rather than whatever the viewer's machine happens to use. */
  var TZ = 'Asia/Tokyo';
  var HOUR_FMT = null;
  var CLOCK_FMT = null;
  try {
    HOUR_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false });
    CLOCK_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch (err) {
    HOUR_FMT = null;
    CLOCK_FMT = null;
  }
  function thousands(n) { return n.toLocaleString('en-US'); }

  /* ------------------------------------------------------------- state -- */
  var incidents = SEED.incidents.map(function (inc) {
    return {
      severity: inc.severity,
      service: inc.service,
      age: inc.age,
      owner: inc.owner,
      status: inc.status,
      title: inc.title,
      id: inc.id,
      ageMinutes: ageToMinutes(inc.age),
      impact: inc.impact,
      detectedBy: inc.detected,
      runbook: inc.runbook,
      events: [],
      ackedAt: null,
      ackedBy: null,
      prevStatus: null
    };
  });
  SEED.incidents.forEach(function (raw, i) { incidents[i].events = buildEvents(incidents[i]); });

  var state = {
    query: '',
    severities: new Set(),
    status: 'all',
    service: 'all',
    sort: 'severity',
    range: 24,
    selectedId: 'INC-2841',
    cursor: null
  };

  var els = {
    metrics: $('#metrics'),
    chartHost: $('#chart-host'),
    chartFrame: $('#chart-frame'),
    chartReadout: $('#chart-readout'),
    chartAnnouncer: $('#chart-announcer'),
    sevChips: $('#sev-chips'),
    statusSel: $('#filter-status'),
    serviceSel: $('#filter-service'),
    sortSel: $('#sort'),
    search: $('#incident-search'),
    tbody: $('#inc-tbody'),
    table: $('#inc-table'),
    empty: $('#empty-state'),
    emptyTitle: $('#empty-title'),
    emptyBody: $('#empty-body'),
    count: $('#incidents-count'),
    summary: $('#filter-summary'),
    summaryText: $('#filter-summary-text'),
    clearFilters: $('#clear-filters'),
    emptyClear: $('#empty-clear'),
    detailBody: $('#detail-body'),
    detailSub: $('#detail-sub'),
    detailAnnouncer: $('#detail-announcer'),
    railBadge: $('#rail-open-count'),
    sysStatus: $('#system-status-detail'),
    clock: $('#clock'),
    footClock: $('#foot-clock'),
    toast: $('#toast'),
    toastText: $('#toast-text'),
    toastUndo: $('#toast-undo')
  };

  /* ============================================================ metrics == */
  function sparkPath(values, w, h, pad) {
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var span = (max - min) || 1;
    var step = (w - pad * 2) / (values.length - 1);
    var pts = values.map(function (v, i) {
      var x = pad + i * step;
      var y = pad + (h - pad * 2) * (1 - (v - min) / span);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    return 'M' + pts.join(' L');
  }

  function renderMetrics() {
    els.metrics.innerHTML = SEED.metrics.map(function (m) {
      var trendClass = m.good ? 'trend--good' : 'trend--bad';
      var arrow = m.direction === 'up' ? '#i-up' : '#i-down';
      var stroke = m.good ? '#43c07f' : '#ff9c3c';
      return '' +
        '<article class="metric">' +
          '<h3 class="metric-label">' + esc(m.label) + '</h3>' +
          '<p class="metric-value num">' + esc(m.value) + '</p>' +
          '<div class="metric-spark" aria-hidden="true">' +
            '<svg class="icon" viewBox="0 0 60 26" preserveAspectRatio="none">' +
              '<path d="' + sparkPath(m.spark, 60, 26, 2) + '" fill="none" stroke="' + stroke + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.8"/>' +
            '</svg>' +
          '</div>' +
          '<p class="trend ' + trendClass + '">' +
            '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><use href="' + arrow + '"/></svg>' +
            '<span class="trend-change num">' + esc(m.change) + '</span>' +
            '<span class="trend-context">' + esc(m.context) + '</span>' +
          '</p>' +
        '</article>';
    }).join('');
  }

  /* ============================================================== chart == */
  var CH = { w: 760, h: 236, t: 12, r: 16, b: 24, l: 36, yMax: 100, peak: 80 };

  function series() {
    return SEED.throughput.slice(-state.range);
  }

  function buildChart() {
    var data = series();
    var n = data.length;
    var innerW = CH.w - CH.l - CH.r;
    var innerH = CH.h - CH.t - CH.b;
    var x = function (i) { return CH.l + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1)); };
    var y = function (v) { return CH.t + innerH * (1 - v / CH.yMax); };

    var ticks = [0, 25, 50, 75, 100];
    var grid = ticks.map(function (t) {
      var yy = y(t).toFixed(1);
      return '<line class="grid-line' + (t === 0 ? ' grid-line--base' : '') + '" x1="' + CH.l + '" y1="' + yy + '" x2="' + (CH.w - CH.r) + '" y2="' + yy + '"/>' +
             '<text class="tick-label tick-label--y" x="' + (CH.l - 7) + '" y="' + (parseFloat(yy) + 3.2).toFixed(1) + '">' + t + 'k</text>';
    }).join('');

    var step = n > 12 ? 3 : (n > 6 ? 2 : 1);
    var xLabels = data.map(function (v, i) {
      if (i % step !== 0 && i !== n - 1) return '';
      var ts = Date.now() - (n - 1 - i) * 3600 * 1000;
      var label = i === n - 1 ? 'now' : hourLabel(ts) + ':00';
      return '<text class="tick-label tick-label--x" x="' + x(i).toFixed(1) + '" y="' + (CH.h - 8) + '">' + label + '</text>';
    }).join('');

    var line = data.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    var area = line + ' L' + x(n - 1).toFixed(1) + ' ' + y(0).toFixed(1) + ' L' + x(0).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';

    var peakIdx = data.indexOf(Math.max.apply(null, data));
    var peak = '<line class="peak-line" x1="' + CH.l + '" y1="' + y(CH.peak).toFixed(1) + '" x2="' + (CH.w - CH.r) + '" y2="' + y(CH.peak).toFixed(1) + '"/>' +
               '<text class="peak-label" x="' + (CH.w - CH.r) + '" y="' + (y(CH.peak) - 4).toFixed(1) + '" text-anchor="end">peak budget 80k</text>' +
               '<circle class="now-dot" cx="' + x(peakIdx).toFixed(1) + '" cy="' + y(data[peakIdx]).toFixed(1) + '" r="3"/>';

    var last = n - 1;
    var desc = 'Hourly events per minute over the last ' + state.range + ' hours. Lowest ' +
      Math.min.apply(null, data) + 'k, highest ' + Math.max.apply(null, data) + 'k, latest ' + data[last] + 'k.';

    els.chartHost.innerHTML =
      '<svg viewBox="0 0 ' + CH.w + ' ' + CH.h + '" role="img" aria-labelledby="chart-svg-title chart-svg-desc" preserveAspectRatio="xMidYMid meet">' +
        '<title id="chart-svg-title">Events per minute, last ' + state.range + ' hours</title>' +
        '<desc id="chart-svg-desc">' + esc(desc) + '</desc>' +
        '<g aria-hidden="true">' +
          grid + xLabels + peak +
          '<path class="area" d="' + area + '"/>' +
          '<path class="line" d="' + line + '"/>' +
        '</g>' +
        '<g class="cursor" aria-hidden="true" style="display:none">' +
          '<line class="cursor-line" x1="0" y1="' + CH.t + '" x2="0" y2="' + (CH.t + innerH) + '"/>' +
          '<circle class="cursor-dot" cx="0" cy="0" r="3.5"/>' +
        '</g>' +
        '<rect class="hit" x="' + CH.l + '" y="' + CH.t + '" width="' + innerW + '" height="' + innerH + '" data-hit="1"/>' +
      '</svg>' +
      dataTable(data);

    state.cursor = null;
  }

  function dataTable(data) {
    var n = data.length;
    var rows = data.map(function (v, i) {
      var ts = Date.now() - (n - 1 - i) * 3600 * 1000;
      return '<tr><td>' + hourLabel(ts) + ':00</td><td>' + v + ',000</td></tr>';
    }).reverse().join('');
    return '<table class="sr-only"><caption>Events per minute by hour, last ' + state.range + ' hours</caption>' +
      '<thead><tr><th scope="col">Hour</th><th scope="col">Events per minute</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function pointFromEvent(evt) {
    var svg = els.chartHost.querySelector('svg');
    if (!svg) return null;
    var rect = svg.getBoundingClientRect();
    if (!rect.width) return null;
    var scale = CH.w / rect.width;
    var vx = (evt.clientX - rect.left) * scale;
    var n = state.range;
    var innerW = CH.w - CH.l - CH.r;
    var rel = (vx - CH.l) / innerW;
    var idx = Math.round(rel * (n - 1));
    if (idx < 0 || idx > n - 1) return null;
    var data = series();
    return { index: idx, value: data[idx], time: clockTime(Date.now() - (n - 1 - idx) * 3600 * 1000) };
  }

  function showCursor(pt) {
    if (!pt) return;
    var data = series();
    var n = data.length;
    var innerW = CH.w - CH.l - CH.r;
    var innerH = CH.h - CH.t - CH.b;
    var cx = CH.l + (innerW * pt.index) / (n - 1);
    var cy = CH.t + innerH * (1 - pt.value / CH.yMax);
    var g = els.chartHost.querySelector('.cursor');
    if (!g) return;
    g.style.display = '';
    g.querySelector('.cursor-line').setAttribute('x1', cx.toFixed(1));
    g.querySelector('.cursor-line').setAttribute('x2', cx.toFixed(1));
    g.querySelector('.cursor-dot').setAttribute('cx', cx.toFixed(1));
    g.querySelector('.cursor-dot').setAttribute('cy', cy.toFixed(1));
    state.cursor = pt.index;
    els.chartReadout.innerHTML = '<b>' + pt.value + ',000</b> events/min at ' + pt.time;
  }

  function clearCursor() {
    var g = els.chartHost.querySelector('.cursor');
    if (g) g.style.display = 'none';
    state.cursor = null;
    els.chartReadout.textContent = 'Events per minute, hourly';
  }

  function announceCursor(pt) {
    els.chartAnnouncer.textContent = pt.value.toLocaleString('en-US') + ' events per minute at ' + pt.time;
  }

  function cursorFromIndex(i) {
    var data = series();
    var n = data.length;
    var idx = Math.max(0, Math.min(n - 1, i));
    return { index: idx, value: data[idx], time: clockTime(Date.now() - (n - 1 - idx) * 3600 * 1000) };
  }

  function bindChart() {
    els.chartFrame.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      showCursor(pointFromEvent(e));
    });
    els.chartFrame.addEventListener('pointerleave', clearCursor);
    els.chartFrame.addEventListener('keydown', function (e) {
      var n = state.range;
      var cur = state.cursor == null ? n - 1 : state.cursor;
      var next = null;
      if (e.key === 'ArrowRight') next = cur + 1;
      else if (e.key === 'ArrowLeft') next = cur - 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      else if (e.key === 'Escape') { clearCursor(); return; }
      else return;
      e.preventDefault();
      var pt = cursorFromIndex(next);
      showCursor(pt);
      announceCursor(pt);
    });
    els.chartFrame.addEventListener('blur', clearCursor);

    var segs = document.querySelectorAll('.seg');
    Array.prototype.forEach.call(segs, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(segs, function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        state.range = parseInt(btn.getAttribute('data-range'), 10);
        buildChart();
        clearCursor();
      });
    });
  }

  /* ============================================================== table == */
  /* Activity log stays newest-first no matter which order events are added. */
  function addEvent(inc, ev) {
    inc.events.push(ev);
    inc.events.sort(function (a, b) { return b.t - a.t; });
  }

  function buildEvents(inc) {
    var base = Date.now() - inc.ageMinutes * 60000;
    var out = [{ t: base, text: 'Detected by ' + inc.detectedBy, event: true }];
    out.push({ t: base + 90000, text: 'Alert routed to on-call rotation' });
    if (inc.severity === 'critical' || inc.severity === 'high') {
      out.push({ t: base + 210000, text: 'Escalated to severity bridge · status set to ' + STATUS[inc.status].label.toLowerCase() });
    }
    if (inc.status === 'monitoring') {
      out.push({ t: Date.now() - 12 * 60000, text: 'Mitigation applied · watching recovery', event: true });
    }
    if (inc.owner === 'Unassigned') {
      out.push({ t: Date.now() - 5 * 60000, text: 'No owner after 5 minutes' });
    }
    return out.sort(function (a, b) { return b.t - a.t; });
  }

  function isMatch(inc) {
    if (state.severities.size && !state.severities.has(inc.severity)) return false;
    if (state.status !== 'all' && inc.status !== state.status) return false;
    if (state.service !== 'all' && inc.service !== state.service) return false;
    if (state.query) {
      var q = state.query.toLowerCase();
      var hay = (inc.id + ' ' + inc.title + ' ' + inc.service + ' ' + inc.owner + ' ' + STATUS[inc.status].label).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function sortRows(list) {
    var bySeverity = function (a, b) { return SEV[a.severity].rank - SEV[b.severity].rank || a.ageMinutes - b.ageMinutes; };
    var copy = list.slice();
    if (state.sort === 'severity') copy.sort(bySeverity);
    else if (state.sort === 'age-desc') copy.sort(function (a, b) { return a.ageMinutes - b.ageMinutes; });
    else if (state.sort === 'age-asc') copy.sort(function (a, b) { return b.ageMinutes - a.ageMinutes; });
    else if (state.sort === 'service') copy.sort(function (a, b) { return a.service.localeCompare(b.service) || bySeverity(a, b); });
    return copy;
  }

  function sevTag(sev) {
    return '<span class="sev sev--' + sev + '"><span class="sev-rail" aria-hidden="true"></span>' + SEV[sev].label + '</span>';
  }

  function statusTag(status) {
    return '<span class="status status--' + status + '"><span class="dot" aria-hidden="true"></span>' + STATUS[status].label + '</span>';
  }

  function rowHTML(inc) {
    var selected = inc.id === state.selectedId;
    var owner = inc.owner === 'Unassigned'
      ? '<span class="owner-unassigned">Unassigned</span>'
      : '<span class="avatar avatar--xs" aria-hidden="true">' + esc(inc.owner.split(' ')[1].charAt(0)) + '</span>' + esc(inc.owner);
    return '' +
      '<tr data-id="' + esc(inc.id) + '"' + (selected ? ' class="is-selected" aria-current="true"' : '') + ' style="--sev: ' + SEV[inc.severity].color + '">' +
        '<td class="col-sev" data-label="Severity">' + sevTag(inc.severity) + '</td>' +
        '<td class="col-inc cell-primary">' +
          '<button type="button" class="inc-id" data-select="' + esc(inc.id) + '" aria-describedby="row-hint-' + esc(inc.id) + '">' + esc(inc.id) + '</button>' +
          '<span class="inc-title" id="row-hint-' + esc(inc.id) + '">' + esc(inc.title) + '</span>' +
        '</td>' +
        '<td class="col-svc" data-label="Service"><span class="inc-svc">' + esc(inc.service) + '</span></td>' +
        '<td class="col-age" data-label="Age"><span class="inc-age">' + esc(inc.age) + '</span></td>' +
        '<td class="col-own" data-label="Owner"><span class="inc-owner">' + owner + '</span></td>' +
        '<td class="col-st" data-label="Status">' + statusTag(inc.status) + '</td>' +
      '</tr>';
  }

  function renderTable() {
    var matched = sortRows(incidents.filter(isMatch));
    var filtered = state.severities.size > 0 || state.status !== 'all' || state.service !== 'all' || state.query !== '';

    els.tbody.innerHTML = matched.map(rowHTML).join('');

    var total = incidents.length;
    var urgent = incidents.filter(function (i) {
      return (i.severity === 'critical' || i.severity === 'high') && i.status !== 'acknowledged';
    }).length;
    els.count.textContent = filtered
      ? matched.length + ' of ' + total + ' incidents match'
      : total + ' active · ' + urgent + ' urgent · ' +
        (incidents.filter(function (i) { return i.status === 'acknowledged'; }).length) + ' acknowledged';

    // Empty / filter state
    els.empty.hidden = matched.length > 0;
    els.table.hidden = matched.length === 0;
    if (matched.length === 0) {
      els.emptyTitle.textContent = total === 0 ? 'No active incidents' : 'No incidents match these filters';
      els.emptyBody.textContent = total === 0
        ? 'Nothing is currently paged. The table will populate as new alerts arrive.'
        : 'Nothing matches ' + describeFilters() + '. Clear the filters to see all ' + total + ' incidents.';
    }

    els.summary.hidden = !filtered;
    if (filtered) {
      els.summaryText.innerHTML = 'Showing <b>' + matched.length + '</b> of ' + total + ' incidents · ' + describeFilters();
    }

    renderSeverityChips();
    renderChrome();
  }

  function describeFilters() {
    var parts = [];
    if (state.severities.size) {
      parts.push('severity ' + Array.from(state.severities).map(function (s) { return SEV[s].label.toLowerCase(); }).sort().join(' + '));
    }
    if (state.status !== 'all') parts.push('status ' + STATUS[state.status].label.toLowerCase());
    if (state.service !== 'all') parts.push('service ' + state.service);
    if (state.query) parts.push('search “' + state.query + '”');
    return parts.length ? parts.join(', ') : 'no filters';
  }

  function renderSeverityChips() {
    SEV_ORDER.forEach(function (sev) {
      var input = els.sevChips.querySelector('input[value="' + sev + '"]');
      if (!input) return;
      var count = incidents.filter(function (i) { return i.severity === sev; }).length;
      input.checked = state.severities.has(sev);
      var badge = input.closest('.chip-filter').querySelector('.chip-count');
      if (badge) badge.textContent = count;
    });
  }

  function renderChrome() {
    var open = incidents.filter(function (i) { return i.status !== 'acknowledged' && i.status !== 'resolved'; });
    var urgent = open.filter(function (i) { return i.severity === 'critical' || i.severity === 'high'; });
    els.railBadge.textContent = open.length;
    els.sysStatus.textContent = urgent.length ? urgent.length + ' urgent' : 'all clear';
  }

  /* ============================================================= detail == */
  function renderDetail() {
    var inc = incidents.filter(function (i) { return i.id === state.selectedId; })[0];

    if (!inc) {
      els.detailSub.textContent = 'Select a row to inspect';
      els.detailBody.innerHTML =
        '<div class="empty empty--inline">' +
          '<span class="empty-mark" aria-hidden="true">' +
            '<svg class="icon" viewBox="0 0 16 16"><use href="#i-incident"/></svg>' +
          '</span>' +
          '<p class="empty-title">No incident selected</p>' +
          '<p class="empty-body">Choose an incident from the table to see impact, runbook steps and the activity log.</p>' +
        '</div>';
      return;
    }

    var visible = isMatch(inc);
    els.detailSub.textContent = SEV[inc.severity].label + ' · ' + inc.service;

    var ackLabel = inc.status === 'acknowledged' ? 'Acknowledged ' + clockTime(inc.ackedAt) : 'Acknowledge';
    var ackBtn = inc.status === 'acknowledged'
      ? '<button type="button" class="btn btn--ok" disabled aria-disabled="true">' +
          '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><use href="#i-check"/></svg>' + ackLabel + '</button>'
      : '<button type="button" class="btn btn--primary" data-ack="' + esc(inc.id) + '">' +
          '<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><use href="#i-check"/></svg>Acknowledge</button>';

    var timeline = inc.events.map(function (ev) {
      return '<li class="tl-item' + (ev.event ? ' tl-item--event' : '') + '">' +
        '<span class="tl-time">' + clockTime(ev.t) + '</span>' +
        '<span class="tl-body">' + ev.text + (ev.actor ? ' <span class="tl-actor">· ' + esc(ev.actor) + '</span>' : '') + '</span>' +
      '</li>';
    }).join('');

    var runbook = inc.runbook.map(function (step, i) {
      return '<li class="runbook-step"><b>' + (i + 1) + '</b><span>' + esc(step) + '</span></li>';
    }).join('');

    els.detailBody.innerHTML = '' +
      '<div class="detail-title-row">' +
        sevTag(inc.severity) +
        '<span class="detail-id">' + esc(inc.id) + '</span>' +
        (visible ? '' : '<span class="pill pill--status" title="Hidden by the current filters">filtered out</span>') +
      '</div>' +
      '<h3 class="detail-title" id="detail-incident-title">' + esc(inc.title) + '</h3>' +
      '<p class="detail-impact">' + esc(inc.impact) + '</p>' +

      '<div class="meta-grid">' +
        metaCell('Service', '<span class="inc-svc">' + esc(inc.service) + '</span>') +
        metaCell('Status', statusTag(inc.status)) +
        metaCell('Age', esc(inc.age), true) +
        metaCell('Owner', inc.owner === 'Unassigned' ? '<span class="owner-unassigned">Unassigned</span>' : esc(inc.owner)) +
      '</div>' +

      '<div class="detail-actions">' + ackBtn +
        '<button type="button" class="btn" data-assign="' + esc(inc.id) + '"' + (inc.owner === 'A. Rivera' ? ' disabled aria-disabled="true"' : '') + '>Assign to me</button>' +
        '<button type="button" class="btn btn--ghost" data-runbook-toggle aria-expanded="false">Runbook</button>' +
      '</div>' +
      '<p class="detail-note">Acknowledging stops paging the on-call rotation and records you as the incident owner.</p>' +

      '<p class="section-label" id="runbook-label" hidden>Runbook</p>' +
      '<div class="runbook" id="runbook-panel" hidden><ol>' + runbook + '</ol></div>' +

      '<p class="section-label">Activity</p>' +
      '<ul class="timeline">' + timeline + '</ul>';
  }

  function metaCell(key, val, numeric) {
    return '<div class="meta-cell"><p class="meta-key">' + key + '</p>' +
      '<p class="meta-val' + (numeric ? ' meta-val--num' : '') + '">' + val + '</p></div>';
  }

  function selectIncident(id, opts) {
    var inc = incidents.filter(function (i) { return i.id === id; })[0];
    if (!inc) return;
    var changed = state.selectedId !== id;
    state.selectedId = id;
    if (changed) {
      renderDetail();
      renderTable();
      els.detailAnnouncer.textContent = 'Detail panel now shows ' + id + ', ' + SEV[inc.severity].label.toLowerCase() +
        ' severity, ' + inc.title + ', status ' + STATUS[inc.status].label + ', owner ' + inc.owner + '.';
    }
    if (opts && opts.scroll && window.matchMedia('(max-width: 1180px)').matches) {
      els.detailBody.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function acknowledge(id) {
    var inc = incidents.filter(function (i) { return i.id === id; })[0];
    if (!inc || inc.status === 'acknowledged') return;

    inc.prevStatus = inc.status;
    inc.prevOwner = inc.owner;
    inc.status = 'acknowledged';
    inc.ackedAt = Date.now();
    inc.ackedBy = 'A. Rivera';
    inc.owner = 'A. Rivera';
    addEvent(inc, { t: inc.ackedAt, text: 'Acknowledged — paging stopped', actor: 'A. Rivera', event: true });
    addEvent(inc, { t: inc.ackedAt - 2000, text: 'Took ownership of the incident', actor: 'A. Rivera' });

    renderDetail();
    renderTable();
    els.detailAnnouncer.textContent = id + ' acknowledged. Paging stopped, owner A. Rivera.';

    showToast(id + ' acknowledged · paging stopped', function undo() {
      inc.status = inc.prevStatus || 'open';
      inc.owner = inc.prevOwner || 'Unassigned';
      inc.prevStatus = null;
      inc.prevOwner = null;
      inc.ackedAt = null;
      inc.ackedBy = null;
      inc.events = inc.events.filter(function (ev) { return !/Acknowledged|Took ownership/.test(ev.text); });
      renderDetail();
      renderTable();
      els.detailAnnouncer.textContent = 'Acknowledgement undone for ' + id + '. Status is ' + STATUS[inc.status].label + '.';
    });
  }

  function assignToMe(id) {
    var inc = incidents.filter(function (i) { return i.id === id; })[0];
    if (!inc || inc.owner === 'A. Rivera') return;
    addEvent(inc, { t: Date.now(), text: 'Assigned to A. Rivera', event: true });
    renderDetail();
    renderTable();
    els.detailAnnouncer.textContent = id + ' assigned to A. Rivera.';
    showToast(id + ' assigned to you', null);
  }

  /* ============================================================== toast == */
  var toastTimer = null;
  var pendingUndo = null;

  function showToast(message, onUndo) {
    clearTimeout(toastTimer);
    pendingUndo = onUndo || null;
    els.toastText.textContent = message;
    els.toastUndo.hidden = !onUndo;
    els.toast.hidden = false;
    toastTimer = setTimeout(function () { pendingUndo = null; hideToast(); }, onUndo ? 7000 : 3200);
  }
  function hideToast() { els.toast.hidden = true; }

  /* =========================================================== controls == */
  function buildControls() {
    var services = [];
    incidents.forEach(function (i) { if (services.indexOf(i.service) === -1) services.push(i.service); });
    services.sort();
    services.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      els.serviceSel.appendChild(opt);
    });

    els.sevChips.innerHTML = SEV_ORDER.map(function (sev) {
      return '<label class="chip-filter chip-filter--' + sev + '">' +
        '<input type="checkbox" value="' + sev + '">' +
        '<span class="dot" aria-hidden="true"></span>' +
        '<span class="chip-label">' + SEV[sev].label + '</span>' +
        '<span class="chip-count">0</span>' +
        '<span class="sr-only"> severity</span>' +
      '</label>';
    }).join('');

    els.sevChips.addEventListener('change', function (e) {
      var input = e.target;
      if (!input || input.type !== 'checkbox') return;
      if (input.checked) state.severities.add(input.value);
      else state.severities.delete(input.value);
      renderTable();
      renderDetail();
      els.detailAnnouncer.textContent = describeFilters() + '. ' +
        incidents.filter(isMatch).length + ' incidents match.';
    });

    els.statusSel.addEventListener('change', function () { state.status = els.statusSel.value; renderTable(); renderDetail(); });
    els.serviceSel.addEventListener('change', function () { state.service = els.serviceSel.value; renderTable(); renderDetail(); });
    els.sortSel.addEventListener('change', function () { state.sort = els.sortSel.value; renderTable(); });

    var t = null;
    els.search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { state.query = els.search.value.trim(); renderTable(); renderDetail(); }, 90);
    });
    els.search.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.search.value) {
        e.preventDefault();
        els.search.value = '';
        state.query = '';
        renderTable();
        renderDetail();
      }
    });

    function clearAll() {
      state.severities.clear();
      state.query = '';
      state.status = 'all';
      state.service = 'all';
      els.search.value = '';
      els.statusSel.value = 'all';
      els.serviceSel.value = 'all';
      renderTable();
      renderDetail();
      els.detailAnnouncer.textContent = 'Filters cleared. ' + incidents.length + ' incidents shown.';
    }
    els.clearFilters.addEventListener('click', clearAll);
    els.emptyClear.addEventListener('click', function () { clearAll(); els.search.focus(); });

    els.toastUndo.addEventListener('click', function () {
      var fn = pendingUndo;
      pendingUndo = null;
      hideToast();
      if (fn) fn();
    });

    // Table interactions
    els.tbody.addEventListener('click', function (e) {
      var idBtn = e.target.closest('[data-select]');
      var row = e.target.closest('tr[data-id]');
      if (!row) return;
      selectIncident(row.getAttribute('data-id'), { scroll: !!idBtn });
    });

    els.tbody.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var btn = e.target.closest('[data-select]');
      if (!btn) return;
      var buttons = Array.prototype.slice.call(els.tbody.querySelectorAll('[data-select]'));
      var i = buttons.indexOf(btn);
      var next = e.key === 'ArrowDown' ? i + 1 : i - 1;
      if (next < 0 || next >= buttons.length) return;
      e.preventDefault();
      buttons[next].focus();
      selectIncident(buttons[next].getAttribute('data-select'));
    });

    // Detail actions
    els.detailBody.addEventListener('click', function (e) {
      var ack = e.target.closest('[data-ack]');
      if (ack) return acknowledge(ack.getAttribute('data-ack'));

      var assign = e.target.closest('[data-assign]');
      if (assign) return assignToMe(assign.getAttribute('data-assign'));

      var rb = e.target.closest('[data-runbook-toggle]');
      if (rb) {
        var panel = $('#runbook-panel');
        var open = rb.getAttribute('aria-expanded') === 'true';
        rb.setAttribute('aria-expanded', open ? 'false' : 'true');
        panel.hidden = open;
        var label = $('#runbook-label');
        if (label) label.hidden = open;
      }
    });

    // Global shortcuts
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'select' || tag === 'textarea' || e.target.isContentEditable;
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        els.search.focus();
        els.search.select();
      }
    });
  }

  /* =============================================================== clock == */
  function startClock() {
    function tick() {
      var now = Date.now();
      var s = clockTime(now);
      if (els.clock) {
        els.clock.textContent = s;
        els.clock.setAttribute('datetime', new Date(now).toISOString());
      }
      if (els.footClock) els.footClock.textContent = s;
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ================================================================ boot == */
  function init() {
    renderMetrics();
    buildControls();
    buildChart();
    bindChart();
    renderTable();
    renderDetail();
    startClock();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
