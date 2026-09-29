/* Relay: operations control room
   Vanilla JS, no dependencies, no network access.
   Sections: data > helpers > metrics > throughput chart > incidents (filter/sort/table)
             > detail panel + acknowledge > drawer > top bar > theme > navigation > init */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Seed data. This is a verbatim copy of DATA.json: a page opened from *
   * file:// cannot fetch() sibling files, and Relay makes no requests.  *
   * ------------------------------------------------------------------ */
  var DATA = {
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

  /* Presentation-only context that DATA.json does not carry. Everything here
     is illustrative copy keyed by incident id; the table itself is data-driven. */
  var NOTES = {
    'INC-2841': {
      impact: 'Card authorization requests are timing out at payments-api. Checkout attempts may fail or be retried by customers.',
      next: 'Check upstream acquirer latency and connection pool saturation; prepare a failover decision if timeouts persist.'
    },
    'INC-2839': {
      impact: 'The EU retry queue is growing faster than it drains. Retried events will be delivered late.',
      next: 'Assign an owner, then review consumer capacity for event-router in the EU region.'
    },
    'INC-2837': {
      impact: 'Search results are reflecting stale documents outside the freshness SLO. No data loss is expected.',
      next: 'Keep watching index lag; escalate if it is still outside SLO at the next check.'
    },
    'INC-2832': {
      impact: 'Webhook deliveries to some partners are delayed. Events are queued rather than dropped.',
      next: 'Confirm partner endpoints are healthy and notify partner support if the lag persists.'
    }
  };

  var OPERATOR = 'J. Rivera';
  var LOADED_AT = Date.now();

  var SEVERITIES = [
    { key: 'critical', label: 'Critical', rank: 0 },
    { key: 'high', label: 'High', rank: 1 },
    { key: 'medium', label: 'Medium', rank: 2 },
    { key: 'low', label: 'Low', rank: 3 }
  ];
  var SEV = {};
  SEVERITIES.forEach(function (s) { SEV[s.key] = s; });

  var STATUS_LABEL = { open: 'Open', investigating: 'Investigating', monitoring: 'Monitoring' };
  var STATUS_ORDER = ['open', 'investigating', 'monitoring'];

  /* Whether a rising number is good news depends on the metric, so the
     visual sentiment is decided here, not from arrow direction alone. */
  var METRIC_POLARITY = {
    'Events / min': 'neutral',
    'P95 latency': 'lower-is-better',
    'Error rate': 'lower-is-better',
    'Queue depth': 'lower-is-better'
  };
  var TREND_BASELINE = 'vs 24 h ago';

  var COLUMNS = [
    { key: 'severity', label: 'Severity', first: 'asc' },
    { key: 'incident', label: 'Incident', first: 'asc' },
    { key: 'service', label: 'Service', first: 'asc' },
    { key: 'age', label: 'Age', first: 'desc' },
    { key: 'owner', label: 'Owner', first: 'asc' },
    { key: 'status', label: 'Status', first: 'asc' }
  ];
  var SORT_OPTIONS = [
    { value: 'severity:asc', label: 'Severity, highest first' },
    { value: 'severity:desc', label: 'Severity, lowest first' },
    { value: 'age:desc', label: 'Age, oldest first' },
    { value: 'age:asc', label: 'Age, newest first' },
    { value: 'service:asc', label: 'Service A to Z' },
    { value: 'owner:asc', label: 'Owner A to Z' },
    { value: 'status:asc', label: 'Status A to Z' }
  ];

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  var incidents = DATA.incidents.map(function (i) {
    return Object.assign({}, i, { ageBase: parseAge(i.age), ack: null });
  });
  var byId = {};
  incidents.forEach(function (i) { byId[i.id] = i; });

  var state = {
    selectedId: null,
    stickyId: null, // keeps a just-acknowledged row visible until the filters change
    filters: { q: '', sev: [], status: 'all', unassigned: false, unacked: false },
    sort: { key: 'severity', dir: 'asc' },
    drawerOpen: false,
    lastFocus: null
  };

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === false || v == null) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    function add(kid) {
      if (kid == null || kid === false) return;
      if (Array.isArray(kid)) { kid.forEach(add); return; }
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    for (var n = 2; n < arguments.length; n++) add(arguments[n]);
    return node;
  }

  function icon(name, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function hh(i) { return pad2(i); }
  function utcHM(ms) { return new Date(ms).toISOString().slice(11, 16); }
  function utcHMS(ms) { return new Date(ms).toISOString().slice(11, 19); }
  function signed(n, digits) {
    var s = Math.abs(n).toFixed(digits || 0);
    return (n > 0 ? '+' : n < 0 ? '−' : '') + s;
  }

  function parseAge(text) {
    var d = /(\d+)\s*d/.exec(text), h = /(\d+)\s*h/.exec(text), m = /(\d+)\s*m/.exec(text);
    return (d ? +d[1] * 1440 : 0) + (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0);
  }
  function fmtAge(min) {
    if (min < 60) return min + 'm';
    var h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return h + 'h ' + pad2(m) + 'm';
    return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  }
  function ageOf(inc) { return inc.ageBase + Math.floor((Date.now() - LOADED_AT) / 60000); }

  var liveRegion = $('#live');
  function announce(msg) {
    liveRegion.textContent = '';
    window.setTimeout(function () { liveRegion.textContent = msg; }, 40);
  }

  var compactMQ = window.matchMedia('(max-width: 1179px)');
  function isCompact() { return compactMQ.matches; }

  function sevBadge(key) {
    return el('span', { class: 'sev', 'data-sev': key },
      el('span', { class: 'sev-mark', 'aria-hidden': 'true' }),
      el('span', { text: SEV[key].label }));
  }

  /* ------------------------------------------------------------------ *
   * Summary metrics
   * ------------------------------------------------------------------ */
  function sentimentOf(m) {
    if ((METRIC_POLARITY[m.label] || 'neutral') === 'neutral') return 'neutral';
    return m.direction === 'down' ? 'good' : 'bad'; // only lower-is-better metrics are registered
  }

  function renderMetrics() {
    var root = $('#metrics');
    root.replaceChildren();
    DATA.metrics.forEach(function (m) {
      var parts = /^([\d.,]+)\s*(.*)$/.exec(m.value) || [null, m.value, ''];
      var sentiment = sentimentOf(m);
      var verdict = sentiment === 'good' ? 'Improving' : sentiment === 'bad' ? 'Worsening' : '';
      root.appendChild(el('div', { class: 'metric', 'data-sentiment': sentiment },
        el('dt', { text: m.label }),
        el('dd', { class: 'metric-value' },
          el('span', { text: parts[1] }),
          parts[2] ? el('span', { class: 'metric-unit', text: parts[2] }) : null),
        el('dd', { class: 'metric-trend' },
          el('span', { class: 'trend-delta' },
            icon(m.direction === 'up' ? 'arrow-up' : 'arrow-down'),
            el('span', { text: m.change }),
            el('span', { class: 'sr-only', text: m.direction === 'up' ? ' (up)' : ' (down)' })),
          verdict ? el('span', { class: 'trend-verdict', text: verdict }) : null,
          el('span', { class: 'trend-ctx', text: TREND_BASELINE }))));
    });
  }

  /* ------------------------------------------------------------------ *
   * 24 h throughput: HTML/CSS bars, hover + keyboard inspection, table view
   * ------------------------------------------------------------------ */
  var chartState = { active: null };

  function renderChart() {
    var data = DATA.throughput;
    var max = Math.max.apply(null, data);
    var min = Math.min.apply(null, data);
    var peakIdx = data.indexOf(max);
    var lowIdx = data.indexOf(min);
    var mean = data.reduce(function (a, b) { return a + b; }, 0) / data.length;
    var axisMax = Math.ceil(max / 25) * 25;

    /* Header stats */
    var stats = $('#chart-stats');
    stats.replaceChildren(
      el('div', null, el('dt', { text: 'Peak' }), el('dd', null, String(max), el('span', { class: 'sub', text: hh(peakIdx) + ':00' }))),
      el('div', null, el('dt', { text: 'Low' }), el('dd', null, String(min), el('span', { class: 'sub', text: hh(lowIdx) + ':00' }))),
      el('div', null, el('dt', null, el('span', { class: 'legend-line', 'aria-hidden': 'true' }), 'Mean'), el('dd', { text: mean.toFixed(1) })));

    /* Chart body */
    var chart = $('#chart');
    chart.replaceChildren();

    var y = el('div', { class: 'y-axis', 'aria-hidden': 'true' });
    for (var v = 0; v <= axisMax; v += 25) {
      var tick = el('span', { text: String(v) });
      tick.style.setProperty('--p', String(v / axisMax * 100));
      y.appendChild(tick);
    }

    var plot = el('div', {
      class: 'plot', id: 'plot', tabindex: '0', role: 'group',
      'aria-label': '24-hour throughput chart. Peak ' + max + ' at ' + hh(peakIdx) + ':00 UTC, low ' + min + ' at ' + hh(lowIdx) +
        ':00 UTC, mean ' + mean.toFixed(1) + '. Use the left and right arrow keys to inspect each hour, or switch to the table view.'
    });
    for (var g = 0; g <= axisMax; g += 25) {
      var line = el('div', { class: 'grid-line' + (g === 0 ? ' base' : ''), 'aria-hidden': 'true' });
      line.style.setProperty('--p', String(g / axisMax * 100));
      plot.appendChild(line);
    }
    var meanLine = el('div', { class: 'mean-line', 'aria-hidden': 'true' });
    meanLine.style.setProperty('--m', String(mean / axisMax * 100));
    plot.appendChild(meanLine);

    var bars = el('ol', { class: 'bars', 'aria-hidden': 'true' });
    data.forEach(function (val, i) {
      var fill = el('span', { class: 'fill' });
      fill.style.setProperty('--v', String(val / axisMax * 100));
      bars.appendChild(el('li', { class: 'bar' + (i === peakIdx ? ' is-peak' : ''), 'data-i': String(i) }, fill));
    });
    plot.appendChild(bars);

    var x = el('div', { class: 'x-axis', 'aria-hidden': 'true' });
    data.forEach(function (_, i) {
      x.appendChild(el('span', { class: (i % 3 === 0 ? 't3 ' : '') + (i % 6 === 0 ? 't6' : ''), text: hh(i) }));
    });
    chart.append(y, plot, x);

    /* Readout */
    var readout = $('#chart-readout');
    function drawReadout(i) {
      readout.replaceChildren();
      if (i == null) {
        var touch = window.matchMedia('(pointer: coarse)').matches;
        readout.appendChild(el('span', { class: 'ro-hint', text: touch ? 'Tap a bar to inspect an hour' : 'Hover a bar, or focus the chart and use ← →' }));
        return null;
      }
      var val = data[i];
      var nodes = [
        el('span', { class: 'ro-time', text: hh(i) + ':00 UTC' }),
        el('span', { class: 'ro-val', text: String(val) })
      ];
      var summary = hh(i) + ':00 UTC, ' + val;
      if (i > 0) {
        var d = val - data[i - 1];
        var pct = data[i - 1] ? (d / data[i - 1] * 100) : 0;
        var deltaText = signed(d) + ' (' + signed(pct, 1) + '%) vs ' + hh(i - 1) + ':00';
        nodes.push(el('span', { text: deltaText }));
        summary += ', ' + deltaText;
      } else {
        nodes.push(el('span', { text: 'first hour in window' }));
      }
      nodes.forEach(function (n) { readout.appendChild(n); });
      return summary;
    }

    function setActive(i, speak) {
      if (chartState.active === i && !speak) return;
      chartState.active = i;
      $$('.bar', bars).forEach(function (b, idx) { b.classList.toggle('is-active', idx === i); });
      var summary = drawReadout(i);
      if (speak && summary) announce(summary);
    }
    drawReadout(null);

    function indexFromPointer(e) {
      var rect = plot.getBoundingClientRect();
      var i = Math.floor((e.clientX - rect.left) / rect.width * data.length);
      return Math.max(0, Math.min(data.length - 1, i));
    }
    plot.addEventListener('pointermove', function (e) { setActive(indexFromPointer(e)); });
    plot.addEventListener('pointerdown', function (e) { setActive(indexFromPointer(e)); });
    plot.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch' || document.activeElement === plot) return;
      setActive(null);
    });
    plot.addEventListener('focus', function () { if (chartState.active == null) setActive(peakIdx, true); });
    plot.addEventListener('blur', function () { setActive(null); });
    plot.addEventListener('keydown', function (e) {
      var i = chartState.active == null ? peakIdx : chartState.active;
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(data.length - 1, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, i - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = data.length - 1;
      else if (e.key === 'Escape') { setActive(null); return; }
      if (next == null) return;
      e.preventDefault();
      setActive(next, true);
    });

    /* Table view */
    var wrap = $('#chart-table-wrap');
    var rows = data.map(function (val, i) {
      var d = i > 0 ? val - data[i - 1] : null;
      return el('tr', null,
        el('th', { scope: 'row', text: hh(i) + ':00' }),
        el('td', { class: 'r', text: String(val) }),
        el('td', { class: 'r', text: d == null ? 'n/a' : signed(d) }));
    });
    wrap.replaceChildren(el('table', { class: 'chart-table' },
      el('caption', { class: 'sr-only', text: 'Hourly throughput index by hour, UTC' }),
      el('thead', null, el('tr', null,
        el('th', { scope: 'col', text: 'Hour (UTC)' }),
        el('th', { scope: 'col', class: 'r', text: 'Index' }),
        el('th', { scope: 'col', class: 'r', text: 'Change vs prior hour' }))),
      el('tbody', null, rows)));
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Throughput data table');

    var btnChart = $('#view-chart'), btnTable = $('#view-table');
    function setView(view) {
      var showChart = view === 'chart';
      btnChart.setAttribute('aria-pressed', String(showChart));
      btnTable.setAttribute('aria-pressed', String(!showChart));
      chart.hidden = !showChart;
      wrap.hidden = showChart;
      readout.hidden = !showChart;
    }
    btnChart.addEventListener('click', function () { setView('chart'); });
    btnTable.addEventListener('click', function () { setView('table'); });
  }

  /* ------------------------------------------------------------------ *
   * Incidents: filter, sort, table
   * ------------------------------------------------------------------ */
  var tbody = $('#incident-body');

  function filtersActive() {
    var f = state.filters;
    return !!(f.q.trim() || f.sev.length || f.status !== 'all' || f.unassigned || f.unacked);
  }

  function matches(inc) {
    var f = state.filters;
    if (f.sev.length && f.sev.indexOf(inc.severity) === -1) return false;
    if (f.status !== 'all' && inc.status !== f.status) return false;
    if (f.unassigned && inc.owner !== 'Unassigned') return false;
    if (f.unacked && inc.ack) return false;
    var q = f.q.trim().toLowerCase();
    if (q) {
      var hay = [inc.id, inc.title, inc.service, inc.owner, inc.status, inc.severity].join(' ').toLowerCase();
      return q.split(/\s+/).every(function (t) { return hay.indexOf(t) !== -1; });
    }
    return true;
  }

  var COMPARE = {
    severity: function (a, b) { return SEV[a.severity].rank - SEV[b.severity].rank; },
    incident: function (a, b) { return a.id.localeCompare(b.id, undefined, { numeric: true }); },
    service: function (a, b) { return a.service.localeCompare(b.service); },
    age: function (a, b) { return ageOf(a) - ageOf(b); },
    owner: function (a, b) { return a.owner.localeCompare(b.owner); },
    status: function (a, b) { return a.status.localeCompare(b.status); }
  };

  function visibleIncidents() {
    var dir = state.sort.dir === 'asc' ? 1 : -1;
    var primary = COMPARE[state.sort.key];
    return incidents.filter(function (i) { return matches(i) || i.id === state.stickyId; }).sort(function (a, b) {
      return dir * primary(a, b) || COMPARE.severity(a, b) || ageOf(b) - ageOf(a) || COMPARE.incident(a, b);
    });
  }

  function ownerNode(inc) {
    return inc.owner === 'Unassigned' ? el('span', { class: 'owner-none', text: 'Unassigned' }) : document.createTextNode(inc.owner);
  }

  function fillStatusCell(td, inc) {
    var wrap = el('div', { class: 'status-wrap' },
      el('span', { class: 'status', 'data-status': inc.status, text: STATUS_LABEL[inc.status] || inc.status }));
    if (inc.ack) {
      wrap.appendChild(el('span', { class: 'ack-tag', title: 'Acknowledged by ' + inc.ack.by + ' at ' + utcHM(inc.ack.at) + ' UTC' },
        icon('check'),
        el('span', { 'aria-hidden': 'true', text: 'Ack' }),
        el('span', { class: 'sr-only', text: 'Acknowledged' })));
    }
    td.replaceChildren(wrap);
  }

  function rowEl(inc) {
    var selected = inc.id === state.selectedId;
    var btn = el('button', { type: 'button', class: 'row-btn', 'aria-controls': 'detail', 'aria-current': selected ? 'true' : false },
      el('span', { class: 'inc-title', text: inc.title }),
      el('span', { class: 'inc-id', text: inc.id }));
    var statusTd = el('td', { class: 'c-status', role: 'cell' });
    fillStatusCell(statusTd, inc);
    return el('tr', { role: 'row', 'data-id': inc.id, class: selected ? 'is-selected' : false },
      el('td', { class: 'c-sev', role: 'cell' }, sevBadge(inc.severity)),
      el('td', { class: 'c-inc', role: 'cell' }, btn),
      el('td', { class: 'c-svc', role: 'cell', text: inc.service }),
      el('td', { class: 'c-age', role: 'cell' }, el('span', { 'data-age-for': inc.id, text: fmtAge(ageOf(inc)) })),
      el('td', { class: 'c-owner', role: 'cell' }, ownerNode(inc)),
      statusTd);
  }

  function describeFilters() {
    var f = state.filters, parts = [];
    if (f.q.trim()) parts.push('search “' + f.q.trim() + '”');
    if (f.sev.length) parts.push('severity ' + f.sev.map(function (k) { return SEV[k].label.toLowerCase(); }).join(' or '));
    if (f.status !== 'all') parts.push('status ' + (STATUS_LABEL[f.status] || f.status).toLowerCase());
    if (f.unassigned) parts.push('unassigned only');
    if (f.unacked) parts.push('unacknowledged only');
    return parts.join(', ');
  }

  function renderTable() {
    var rows = visibleIncidents();
    var active = document.activeElement;
    var focusedId = active && tbody.contains(active) && active.closest('tr') ? active.closest('tr').dataset.id : null;

    if (rows.length && !rows.some(function (r) { return r.id === state.selectedId; })) {
      state.selectedId = rows[0].id;
    } else if (!rows.length) {
      state.selectedId = null;
    }

    tbody.replaceChildren.apply(tbody, rows.map(rowEl));
    if (focusedId) {
      var b = tbody.querySelector('tr[data-id="' + focusedId + '"] .row-btn');
      if (b) b.focus({ preventScroll: true });
    }

    var empty = rows.length === 0;
    $('#table-wrap').hidden = empty;
    $('#table-empty').hidden = !empty;
    $('#empty-body').textContent = empty
      ? 'Nothing matches ' + describeFilters() + '. Loosen a filter or clear them to see all ' + incidents.length + ' incidents.'
      : '';

    renderCount(rows.length);
    renderSortHeaders();
    syncFilterUI();
    renderDetail();
    renderTopStatus();
  }

  function renderCount(shown) {
    var total = incidents.length;
    var unacked = incidents.filter(function (i) { return !i.ack; }).length;
    $('#incident-count').textContent = filtersActive()
      ? shown + ' of ' + total + ' incidents match'
      : total + ' incidents, ' + unacked + ' unacknowledged';
  }

  function renderSortHeaders() {
    $$('#incident-table thead th').forEach(function (th) {
      var key = th.dataset.sort;
      var active = state.sort.key === key;
      var btn = th.querySelector('.sort-btn');
      if (!btn) {
        var col = COLUMNS.filter(function (c) { return c.key === key; })[0];
        btn = el('button', { type: 'button', class: 'sort-btn', 'data-key': key }, col.label, icon('chev-down'));
        th.appendChild(btn);
      }
      btn.dataset.active = String(active);
      btn.querySelector('use').setAttribute('href', '#i-chev-' + (active && state.sort.dir === 'asc' ? 'up' : 'down'));
      if (active) th.setAttribute('aria-sort', state.sort.dir === 'asc' ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }

  function buildFilters() {
    var sevGroup = $('#f-sev');
    SEVERITIES.forEach(function (s) {
      var n = incidents.filter(function (i) { return i.severity === s.key; }).length;
      sevGroup.appendChild(el('button', { type: 'button', class: 'chip', 'data-sev': s.key, 'aria-pressed': 'false' },
        el('span', { class: 'sev-mark', 'aria-hidden': 'true' }),
        el('span', { text: s.label }),
        el('span', { class: 'chip-n', text: String(n) })));
    });

    var statusSel = $('#f-status');
    statusSel.appendChild(el('option', { value: 'all', text: 'All' }));
    STATUS_ORDER.forEach(function (k) { statusSel.appendChild(el('option', { value: k, text: STATUS_LABEL[k] })); });

    var sortSel = $('#f-sort');
    SORT_OPTIONS.forEach(function (o) { sortSel.appendChild(el('option', { value: o.value, text: o.label })); });

    function changed() { state.stickyId = null; renderTable(); }

    $('#f-q').addEventListener('input', function (e) { state.filters.q = e.target.value; changed(); });
    sevGroup.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var k = chip.dataset.sev, list = state.filters.sev, at = list.indexOf(k);
      if (at === -1) list.push(k); else list.splice(at, 1);
      changed();
    });
    $('#f-unassigned').addEventListener('click', function () { state.filters.unassigned = !state.filters.unassigned; changed(); });
    $('#f-unacked').addEventListener('click', function () { state.filters.unacked = !state.filters.unacked; changed(); });
    statusSel.addEventListener('change', function (e) { state.filters.status = e.target.value; changed(); });
    sortSel.addEventListener('change', function (e) {
      var p = e.target.value.split(':');
      state.sort = { key: p[0], dir: p[1] };
      renderTable();
    });

    function clearAll() {
      state.filters = { q: '', sev: [], status: 'all', unassigned: false, unacked: false };
      $('#f-q').value = '';
      state.stickyId = null;
      renderTable();
      announce('Filters cleared. Showing all ' + incidents.length + ' incidents.');
    }
    $('#f-clear').addEventListener('click', function () { clearAll(); $('#f-q').focus(); });
    $('#empty-clear').addEventListener('click', function () { clearAll(); $('#f-q').focus(); });

    $('#incident-table thead').addEventListener('click', function (e) {
      var btn = e.target.closest('.sort-btn');
      if (!btn) return;
      var key = btn.dataset.key;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else state.sort = { key: key, dir: COLUMNS.filter(function (c) { return c.key === key; })[0].first };
      renderTable();
      announce('Sorted by ' + key + ', ' + (state.sort.dir === 'asc' ? 'ascending' : 'descending'));
    });
  }

  function syncFilterUI() {
    var f = state.filters;
    $$('#f-sev .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(f.sev.indexOf(c.dataset.sev) !== -1)); });
    $('#f-unassigned').setAttribute('aria-pressed', String(f.unassigned));
    $('#f-unacked').setAttribute('aria-pressed', String(f.unacked));
    $('#f-status').value = f.status;
    var sortValue = state.sort.key + ':' + state.sort.dir;
    var sel = $('#f-sort');
    sel.value = sortValue;
    if (sel.value !== sortValue) sel.selectedIndex = -1;
    $('#f-clear').hidden = !filtersActive();
  }

  /* Row selection: click anywhere on a row, or Enter/Space on its button */
  tbody.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    var btn = tr.querySelector('.row-btn');
    if (!isCompact() && document.activeElement !== btn) btn.focus({ preventScroll: true });
    selectIncident(tr.dataset.id, { open: true, trigger: btn });
  });

  /* Arrow keys, Home and End move between rows */
  tbody.addEventListener('keydown', function (e) {
    var btn = e.target.closest('.row-btn');
    if (!btn) return;
    var btns = $$('.row-btn', tbody);
    var i = btns.indexOf(btn), next = null;
    if (e.key === 'ArrowDown') next = btns[Math.min(btns.length - 1, i + 1)];
    else if (e.key === 'ArrowUp') next = btns[Math.max(0, i - 1)];
    else if (e.key === 'Home') next = btns[0];
    else if (e.key === 'End') next = btns[btns.length - 1];
    if (next) { e.preventDefault(); next.focus(); }
  });

  function selectIncident(id, opts) {
    opts = opts || {};
    state.selectedId = id;
    $$('tr[data-id]', tbody).forEach(function (tr) {
      var on = tr.dataset.id === id;
      tr.classList.toggle('is-selected', on);
      var b = tr.querySelector('.row-btn');
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    renderDetail();
    if (opts.open && isCompact()) openDrawer(opts.trigger);
  }

  /* ------------------------------------------------------------------ *
   * Detail panel + acknowledge
   * ------------------------------------------------------------------ */
  var detail = $('#detail');
  var ackBtn = $('#d-ack');

  function buildTimeline(inc) {
    var t0 = LOADED_AT - inc.ageBase * 60000;
    var events = [{ t: t0, text: 'Incident opened', sub: SEV[inc.severity].label + ' on ' + inc.service }];
    if (inc.owner !== 'Unassigned') events.push({ t: t0 + Math.min(2, inc.ageBase) * 60000, text: 'Assigned to ' + inc.owner });
    if (inc.status !== 'open') events.push({ t: t0 + Math.min(5, inc.ageBase) * 60000, text: 'Status set to ' + (STATUS_LABEL[inc.status] || inc.status).toLowerCase() });
    if (inc.ack) events.push({ t: inc.ack.at, text: 'Acknowledged by ' + inc.ack.by, ack: true });
    events.sort(function (a, b) { return a.t - b.t; });
    return events;
  }

  function renderAck(inc) {
    var acked = !!inc.ack;
    ackBtn.dataset.state = acked ? 'acked' : 'open';
    $('#d-ack-label').textContent = acked ? 'Undo acknowledgement' : 'Acknowledge';
    $('#d-ack-icon').setAttribute('href', acked ? '#i-close' : '#i-check');
    var note = $('#d-ack-note');
    note.replaceChildren();
    if (acked) {
      note.appendChild(document.createTextNode('Acknowledged by '));
      note.appendChild(el('strong', { text: inc.ack.by }));
      note.appendChild(document.createTextNode(' at ' + utcHM(inc.ack.at) + ' UTC.'));
    } else {
      note.textContent = 'Not yet acknowledged. Acknowledging records you and the time on the timeline.';
    }
    var fact = $('#d-ackfact');
    fact.textContent = acked ? inc.ack.by + ', ' + utcHM(inc.ack.at) + ' UTC' : 'Not acknowledged';
  }

  function renderDetail() {
    var inc = byId[state.selectedId];
    $('#d-empty').hidden = !!inc;
    $('#d-body').hidden = !inc;
    detail.setAttribute('aria-labelledby', inc ? 'd-title' : 'd-empty-title');
    if (!inc) return;

    var sev = $('#d-sev');
    sev.dataset.sev = inc.severity;
    sev.querySelector('.sev-text').textContent = SEV[inc.severity].label;
    $('#d-id').textContent = inc.id;
    $('#d-title').textContent = inc.title;
    $('#d-service').textContent = inc.service;

    var status = $('#d-status');
    status.replaceChildren(el('span', { class: 'status', 'data-status': inc.status, text: STATUS_LABEL[inc.status] || inc.status }));
    var owner = $('#d-owner');
    owner.replaceChildren(ownerNode(inc));
    $('#d-age').textContent = fmtAge(ageOf(inc));

    var note = NOTES[inc.id] || { impact: inc.service + ' is affected.', next: 'Review recent changes to ' + inc.service + '.' };
    $('#d-impact').textContent = note.impact;
    $('#d-next').textContent = note.next;

    var list = $('#d-timeline');
    list.replaceChildren();
    buildTimeline(inc).forEach(function (ev) {
      list.appendChild(el('li', { class: ev.ack ? 'is-ack' : false },
        el('span', { class: 't', text: utcHM(ev.t) }),
        el('span', { class: 'e' }, ev.text, ev.sub ? el('span', { class: 'e-sub', text: ev.sub }) : null)));
    });

    renderAck(inc);
  }

  function toggleAck() {
    var inc = byId[state.selectedId];
    if (!inc) return;
    if (inc.ack) {
      inc.ack = null;
      announce(inc.id + ' acknowledgement undone.');
    } else {
      inc.ack = { by: OPERATOR, at: Date.now() };
      announce(inc.id + ' acknowledged by ' + OPERATOR + '.');
    }
    state.stickyId = inc.id; // do not yank the row away if an active filter would now exclude it
    var tr = tbody.querySelector('tr[data-id="' + inc.id + '"]');
    if (tr) fillStatusCell($('.c-status', tr), inc);
    renderDetail();
    renderTopStatus();
    renderCount(visibleIncidents().length);
  }
  ackBtn.addEventListener('click', toggleAck);

  /* ------------------------------------------------------------------ *
   * Drawer / sheet behaviour for the detail panel on narrower screens
   * ------------------------------------------------------------------ */
  var scrim = $('#scrim');
  var inertTargets = [$('#rail'), $('#shell'), $$('.skip-link')].reduce(function (a, b) { return a.concat(b); }, []);

  function setBackgroundInert(on) {
    inertTargets.forEach(function (n) { if (on) n.setAttribute('inert', ''); else n.removeAttribute('inert'); });
  }

  function openDrawer(trigger) {
    if (state.drawerOpen) return;
    state.drawerOpen = true;
    state.lastFocus = trigger || document.activeElement;
    detail.classList.add('is-open');
    detail.setAttribute('role', 'dialog');
    detail.setAttribute('aria-modal', 'true');
    scrim.hidden = false;
    setBackgroundInert(true);
    detail.focus({ preventScroll: true });
    detail.scrollTop = 0;
  }

  function closeDrawer(restoreFocus) {
    if (!state.drawerOpen) return;
    state.drawerOpen = false;
    detail.classList.remove('is-open');
    detail.removeAttribute('role');
    detail.removeAttribute('aria-modal');
    scrim.hidden = true;
    setBackgroundInert(false);
    if (restoreFocus !== false) {
      var target = state.lastFocus && document.contains(state.lastFocus) ? state.lastFocus : $('.row-btn', tbody);
      if (target) target.focus({ preventScroll: true });
    }
    state.lastFocus = null;
  }

  /* Keep Tab inside the drawer while it acts as a modal dialog */
  detail.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !state.drawerOpen) return;
    var focusable = $$('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])', detail)
      .filter(function (n) { return !n.disabled && !n.closest('[hidden]'); });
    if (!focusable.length) { e.preventDefault(); return; }
    var first = focusable[0], last = focusable[focusable.length - 1];
    var atDetail = document.activeElement === detail;
    if (e.shiftKey && (document.activeElement === first || atDetail)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  $('#d-close').addEventListener('click', function () { closeDrawer(true); });
  scrim.addEventListener('click', function () { closeDrawer(true); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.drawerOpen) { e.preventDefault(); closeDrawer(true); }
  });
  function onCompactChange() { if (!compactMQ.matches) closeDrawer(false); }
  if (compactMQ.addEventListener) compactMQ.addEventListener('change', onCompactChange);
  else if (compactMQ.addListener) compactMQ.addListener(onCompactChange);

  /* ------------------------------------------------------------------ *
   * Top status bar + nav badge
   * ------------------------------------------------------------------ */
  function renderTopStatus() {
    var pill = $('#sys-pill');
    var counts = {};
    incidents.forEach(function (i) { counts[i.severity] = (counts[i.severity] || 0) + 1; });
    var level = 'ok';
    for (var n = 0; n < SEVERITIES.length; n++) { if (counts[SEVERITIES[n].key]) { level = SEVERITIES[n].key; break; } }
    pill.dataset.level = level;
    if (level === 'ok') pill.removeAttribute('data-sev'); else pill.dataset.sev = level;

    var bits = [];
    SEVERITIES.slice(0, 2).forEach(function (s) { if (counts[s.key]) bits.push(counts[s.key] + ' ' + s.key); });
    var text = bits.length ? bits.join(', ') + ' open' : incidents.length ? incidents.length + ' minor open' : 'All clear';
    $('#sys-text').textContent = text;

    var unacked = incidents.filter(function (i) { return !i.ack; }).length;
    $('#sys-ack').textContent = unacked + ' unacknowledged';

    var badge = $('#rail-badge');
    badge.hidden = unacked === 0;
    badge.textContent = String(unacked);
    badge.setAttribute('aria-label', unacked + ' unacknowledged');
  }

  function startClock() {
    var clock = $('#clock');
    $('#loaded').textContent = utcHMS(LOADED_AT);
    function tick() { clock.textContent = utcHMS(Date.now()) + ' UTC'; }
    tick();
    window.setInterval(tick, 1000);
    window.setInterval(function () {
      $$('[data-age-for]').forEach(function (n) { n.textContent = fmtAge(ageOf(byId[n.dataset.ageFor])); });
      var sel = byId[state.selectedId];
      if (sel) $('#d-age').textContent = fmtAge(ageOf(sel));
    }, 20000);
  }

  /* ------------------------------------------------------------------ *
   * Theme (system preference by default, manual override remembered)
   * ------------------------------------------------------------------ */
  function effectiveTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function syncThemeButton() {
    var dark = effectiveTheme() === 'dark';
    var btn = $('#theme-toggle');
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    btn.setAttribute('title', dark ? 'Switch to light theme' : 'Switch to dark theme');
    $('#theme-icon').setAttribute('href', dark ? '#i-sun' : '#i-moon');
  }
  function initTheme() {
    $('#theme-toggle').addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('relay-theme', next); } catch (e) { /* ignore */ }
      syncThemeButton();
    });
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', syncThemeButton);
    syncThemeButton();
  }

  /* ------------------------------------------------------------------ *
   * Navigation rail: current section follows the scroll position
   * ------------------------------------------------------------------ */
  function initNav() {
    var links = $$('.rail-link');
    var ids = links.map(function (l) { return l.dataset.section; });
    function setCurrent(id) {
      links.forEach(function (l) {
        if (l.dataset.section === id) l.setAttribute('aria-current', 'location'); else l.removeAttribute('aria-current');
      });
    }
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        var current = ids[0];
        ids.forEach(function (id) {
          if (document.getElementById(id).getBoundingClientRect().top <= 110) current = id;
        });
        var doc = document.documentElement;
        if (doc.scrollHeight > window.innerHeight + 8 && window.innerHeight + window.scrollY >= doc.scrollHeight - 4) current = ids[ids.length - 1];
        setCurrent(current);
      });
    }
    links.forEach(function (l) { l.addEventListener('click', function () { setCurrent(l.dataset.section); }); });
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */
  renderMetrics();
  renderChart();
  buildFilters();
  state.selectedId = visibleIncidents()[0].id;
  renderTable();
  startClock();
  initTheme();
  initNav();
})();
