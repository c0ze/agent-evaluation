/*
 * Relay operations dashboard.
 *
 * The seed below is a copy of DATA.json. It is inlined rather than fetched
 * because browsers block fetch() from file:// URLs, and the page has to work
 * when it is opened straight from disk.
 */
(function () {
  'use strict';

  var DATA = {
    "metrics": [
      {"label": "Events / min", "value": "18,420", "change": "+8.2%", "direction": "up"},
      {"label": "P95 latency", "value": "184 ms", "change": "−12 ms", "direction": "down"},
      {"label": "Error rate", "value": "0.37%", "change": "+0.08 pp", "direction": "up"},
      {"label": "Queue depth", "value": "2,841", "change": "−19%", "direction": "down"}
    ],
    "throughput": [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    "incidents": [
      {"id": "INC-2841", "severity": "critical", "service": "payments-api", "age": "12m", "owner": "M. Chen", "status": "investigating", "title": "Card authorization timeouts"},
      {"id": "INC-2839", "severity": "high", "service": "event-router", "age": "31m", "owner": "Unassigned", "status": "open", "title": "EU retry queue growth"},
      {"id": "INC-2837", "severity": "medium", "service": "search-index", "age": "1h 08m", "owner": "A. Silva", "status": "monitoring", "title": "Index freshness outside SLO"},
      {"id": "INC-2832", "severity": "low", "service": "webhooks", "age": "3h 42m", "owner": "R. Patel", "status": "open", "title": "Elevated partner delivery lag"}
    ]
  };

  var SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
  var SEVERITY_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
  var STATUS_LABEL = { open: 'Open', investigating: 'Investigating', monitoring: 'Monitoring' };
  var UNASSIGNED = 'Unassigned';
  var FILTER_KEYS = ['severity', 'service', 'status', 'owner'];
  var DEFAULT_FILTERS = { text: '', severity: 'all', service: 'all', status: 'all', owner: 'all' };

  // Whether a higher value is good news. Decides the favorable / unfavorable tone.
  var HIGHER_IS_BETTER = {
    'Events / min': true,
    'P95 latency': false,
    'Error rate': false,
    'Queue depth': false
  };

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var stackedLayout = window.matchMedia('(max-width: 1359px)');

  var incidents = DATA.incidents
    .map(function (inc) {
      return Object.assign({}, inc, { ageMinutes: parseAgeMinutes(inc.age) });
    })
    .sort(function (a, b) {
      return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        b.ageMinutes - a.ageMinutes;
    });

  var state = {
    filters: Object.assign({}, DEFAULT_FILTERS),
    selectedId: incidents.length ? incidents[0].id : null,
    acked: {} // incident id -> time of acknowledgement
  };

  var rowsById = {}; // incident id -> { row, button, tag }

  /* ---------- Helpers ---------- */

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function formatNumber(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // "1h 08m" -> 68, "31m" -> 31
  function parseAgeMinutes(age) {
    var match = /(?:(\d+)h)?\s*(\d+)m/.exec(age);
    if (!match) return 0;
    return Number(match[1] || 0) * 60 + Number(match[2]);
  }

  function hoursAgoLabel(hours) {
    return hours === 0 ? 'Now' : hours + 'h ago';
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function clockTime(date, withSeconds) {
    var time = pad(date.getHours()) + ':' + pad(date.getMinutes());
    return withSeconds ? time + ':' + pad(date.getSeconds()) : time;
  }

  function findIncident(id) {
    return incidents.find(function (inc) { return inc.id === id; }) || null;
  }

  function severityBadge(severity) {
    return el('span', 'sev sev--' + severity, SEVERITY_LABEL[severity]);
  }

  /* ---------- Summary metrics ---------- */

  function renderMetrics() {
    var list = $('metrics');

    DATA.metrics.forEach(function (metric) {
      var up = metric.direction === 'up';
      var favorable = up === HIGHER_IS_BETTER[metric.label];

      var item = el('li', 'metric');
      item.appendChild(el('p', 'metric__label', metric.label));
      item.appendChild(el('p', 'metric__value', metric.value));

      var trend = el('p', 'metric__trend ' + (favorable ? 'trend--good' : 'trend--bad'));
      var arrow = el('span', '', up ? '▲' : '▼');
      arrow.setAttribute('aria-hidden', 'true');
      trend.appendChild(arrow);
      trend.appendChild(el('span', 'sr-only', up ? 'Up' : 'Down'));
      trend.appendChild(el('span', '', metric.change));
      trend.appendChild(el('span', '', favorable ? 'Favorable' : 'Unfavorable'));
      item.appendChild(trend);

      item.appendChild(el('p', 'metric__note', 'vs previous period'));
      list.appendChild(item);
    });
  }

  /* ---------- Throughput chart ---------- */

  function renderThroughput() {
    var values = DATA.throughput;
    var last = values.length - 1;
    var max = Math.max.apply(null, values);
    var min = Math.min.apply(null, values);
    var ceiling = Math.ceil(max / 20) * 20; // round top of the y-axis above the peak
    var total = values.reduce(function (sum, v) { return sum + v; }, 0);

    var stats = $('chart-stats');
    clear(stats);
    addStat(stats, 'Latest', values[last], '');
    addStat(stats, 'Peak', max, hoursAgoLabel(last - values.indexOf(max)));
    addStat(stats, 'Low', min, hoursAgoLabel(last - values.indexOf(min)));
    addStat(stats, 'Average', Math.round(total / values.length), '');

    var plot = $('chart-plot');
    clear(plot);

    var grid = el('div', 'chart-grid');
    grid.setAttribute('aria-hidden', 'true');
    for (var k = 1; k <= 4; k++) {
      var rule = el('div', 'chart-rule');
      rule.style.bottom = (k * 25) + '%';
      rule.appendChild(el('span', '', formatNumber(ceiling * k / 4)));
      grid.appendChild(rule);
    }
    plot.appendChild(grid);

    var bars = el('ol', 'bars');
    bars.setAttribute('aria-label', 'Hourly throughput, oldest first');
    values.forEach(function (value, i) {
      var label = hoursAgoLabel(last - i);
      var bar = el('li', 'bar');
      bar.style.setProperty('--v', String(value / ceiling));
      bar.title = label + ': ' + value;
      if (i === last) bar.classList.add('is-latest');
      bar.appendChild(el('span', 'sr-only', label + ': ' + value));
      bars.appendChild(bar);
    });
    plot.appendChild(bars);

    // One label every six hours, counted back from the latest bucket.
    var axis = $('chart-axis');
    clear(axis);
    values.forEach(function (value, i) {
      var hours = last - i;
      if (hours % 6 !== 0) return;
      var label = el('span', hours === 0 ? 'is-end' : '', hoursAgoLabel(hours));
      label.style.gridColumn = String(i + 1);
      axis.appendChild(label);
    });
  }

  function addStat(list, term, value, note) {
    var item = el('div');
    item.appendChild(el('dt', '', term));
    var description = el('dd', '', formatNumber(value));
    if (note) {
      description.appendChild(document.createTextNode(' '));
      description.appendChild(el('small', '', note));
    }
    item.appendChild(description);
    list.appendChild(item);
  }

  /* ---------- Filters ---------- */

  function option(value, label) {
    var node = el('option', '', label);
    node.value = value;
    return node;
  }

  function fillSelect(select, allLabel, options) {
    select.appendChild(option('all', allLabel));
    options.forEach(function (o) {
      select.appendChild(option(o.value, o.label));
    });
  }

  function fillFilterOptions() {
    fillSelect($('f-severity'), 'All severities', SEVERITY_ORDER.map(function (s) {
      return { value: s, label: SEVERITY_LABEL[s] };
    }));

    var services = incidents
      .map(function (inc) { return inc.service; })
      .filter(function (s, i, all) { return all.indexOf(s) === i; })
      .sort();
    fillSelect($('f-service'), 'All services', services.map(function (s) {
      return { value: s, label: s };
    }));

    fillSelect($('f-status'), 'All statuses', Object.keys(STATUS_LABEL).map(function (s) {
      return { value: s, label: STATUS_LABEL[s] };
    }));
  }

  function bindFilters() {
    $('f-text').addEventListener('input', function (event) {
      state.filters.text = event.target.value.trim().toLowerCase();
      applyFilters();
    });

    FILTER_KEYS.forEach(function (key) {
      $('f-' + key).addEventListener('change', function (event) {
        state.filters[key] = event.target.value;
        applyFilters();
      });
    });

    $('f-reset').addEventListener('click', resetFilters);
    $('empty-reset').addEventListener('click', resetFilters);
  }

  function filtersActive() {
    return Object.keys(DEFAULT_FILTERS).some(function (key) {
      return state.filters[key] !== DEFAULT_FILTERS[key];
    });
  }

  function resetFilters() {
    state.filters = Object.assign({}, DEFAULT_FILTERS);
    $('f-text').value = '';
    FILTER_KEYS.forEach(function (key) {
      $('f-' + key).value = 'all';
    });
    applyFilters();
    // The button that was pressed may now be hidden, so move focus to the result count.
    $('result-count').focus();
  }

  function applyFilters() {
    renderRows();
    $('f-reset').hidden = !filtersActive();
  }

  function matchesFilters(inc) {
    var f = state.filters;

    if (f.text) {
      var haystack = [inc.id, inc.title, inc.service, inc.owner, inc.age,
        SEVERITY_LABEL[inc.severity], STATUS_LABEL[inc.status]].join(' ').toLowerCase();
      if (haystack.indexOf(f.text) === -1) return false;
    }
    if (f.severity !== 'all' && inc.severity !== f.severity) return false;
    if (f.service !== 'all' && inc.service !== f.service) return false;
    if (f.status !== 'all' && inc.status !== f.status) return false;
    if (f.owner === 'assigned' && inc.owner === UNASSIGNED) return false;
    if (f.owner === 'unassigned' && inc.owner !== UNASSIGNED) return false;
    return true;
  }

  /* ---------- Incident table ---------- */

  function cell(className, label, text) {
    var td = el('td', className, text);
    td.setAttribute('role', 'cell');
    if (label) td.setAttribute('data-label', label);
    return td;
  }

  function buildRow(inc) {
    var row = el('tr');
    row.setAttribute('role', 'row');
    row.addEventListener('click', function () { selectIncident(inc.id); });

    var idCell = cell('col-id');
    var button = el('button', 'incident-link', inc.id);
    button.type = 'button';
    button.setAttribute('aria-label', inc.id + ': ' + inc.title);
    var tag = el('span', 'tag', 'Acked');
    tag.hidden = true;
    idCell.appendChild(button);
    idCell.appendChild(tag);

    var severityCell = cell('col-sev');
    severityCell.appendChild(severityBadge(inc.severity));

    [
      idCell,
      severityCell,
      cell('col-title', null, inc.title),
      cell('mono', 'Service', inc.service),
      cell('num', 'Age', inc.age),
      cell(inc.owner === UNASSIGNED ? 'is-warn' : '', 'Owner', inc.owner),
      cell('', 'Status', STATUS_LABEL[inc.status])
    ].forEach(function (td) {
      row.appendChild(td);
    });

    return { row: row, button: button, tag: tag };
  }

  function renderRows() {
    var body = $('incident-rows');
    var visible = incidents.filter(matchesFilters);

    clear(body);
    rowsById = {};
    visible.forEach(function (inc) {
      var refs = buildRow(inc);
      rowsById[inc.id] = refs;
      body.appendChild(refs.row);
    });

    var noun = incidents.length === 1 ? 'incident' : 'incidents';
    $('incident-table').hidden = visible.length === 0;
    $('empty').hidden = visible.length > 0;
    $('result-count').textContent = 'Showing ' + visible.length + ' of ' + incidents.length + ' ' + noun;
    refreshRows();
  }

  // Updates selection and acknowledgement state without rebuilding rows,
  // so a focused row button keeps focus when it is pressed.
  function refreshRows() {
    Object.keys(rowsById).forEach(function (id) {
      var refs = rowsById[id];
      var selected = id === state.selectedId;
      refs.row.classList.toggle('is-selected', selected);
      if (selected) {
        refs.button.setAttribute('aria-current', 'true');
      } else {
        refs.button.removeAttribute('aria-current');
      }
      refs.tag.hidden = !state.acked[id];
    });
  }

  function selectIncident(id) {
    state.selectedId = id;
    refreshRows();
    renderDetail();

    // On stacked layouts the detail panel sits below the table; bring it into view if it is off-screen.
    if (stackedLayout.matches) {
      var detail = $('detail');
      if (detail.getBoundingClientRect().top > window.innerHeight) {
        detail.scrollIntoView({
          block: 'start',
          behavior: prefersReducedMotion.matches ? 'auto' : 'smooth'
        });
      }
    }
  }

  /* ---------- Detail panel and acknowledgement ---------- */

  function addField(list, term, value, warn) {
    var item = el('div');
    item.appendChild(el('dt', '', term));
    item.appendChild(el('dd', warn ? 'is-warn' : '', value));
    list.appendChild(item);
  }

  function renderDetail() {
    var inc = findIncident(state.selectedId);
    var sevBadge = $('detail-sev');
    var fields = $('detail-fields');
    var ackBtn = $('ack-btn');
    clear(fields);

    if (!inc) {
      $('detail-id').textContent = '';
      sevBadge.hidden = true;
      $('detail-title').textContent = 'No incident selected';
      $('ack-state').textContent = 'Select an incident to see its details.';
      ackBtn.textContent = 'Acknowledge incident';
      ackBtn.setAttribute('aria-disabled', 'true');
      ackBtn.classList.remove('btn--done');
      return;
    }

    var ackedAt = state.acked[inc.id];

    $('detail-id').textContent = inc.id;
    sevBadge.className = 'sev sev--' + inc.severity;
    sevBadge.textContent = SEVERITY_LABEL[inc.severity];
    sevBadge.hidden = false;
    $('detail-title').textContent = inc.title;

    addField(fields, 'Service', inc.service, false);
    addField(fields, 'Owner', inc.owner, inc.owner === UNASSIGNED);
    addField(fields, 'Age', inc.age, false);
    addField(fields, 'Status', STATUS_LABEL[inc.status], false);

    $('ack-state').textContent = ackedAt
      ? 'Acknowledged by you at ' + ackedAt + '.'
      : 'Not acknowledged.';
    ackBtn.textContent = ackedAt ? 'Acknowledged' : 'Acknowledge incident';
    ackBtn.setAttribute('aria-disabled', ackedAt ? 'true' : 'false');
    ackBtn.classList.toggle('btn--done', Boolean(ackedAt));
  }

  function bindAck() {
    $('ack-btn').addEventListener('click', function () {
      var inc = findIncident(state.selectedId);
      if (!inc || state.acked[inc.id]) return;

      var time = clockTime(new Date(), true);
      state.acked[inc.id] = time;
      refreshRows();
      renderDetail();
      renderTopbar();
      $('announcer').textContent = inc.id + ' acknowledged at ' + time + '.';
    });
  }

  /* ---------- Top status bar and clock ---------- */

  function overallStatus(counts) {
    if (counts.critical) return { tone: 'critical', label: 'Critical incident open' };
    if (counts.high) return { tone: 'high', label: 'High-severity incident open' };
    if (counts.medium) return { tone: 'medium', label: 'Medium-severity incident open' };
    if (counts.low) return { tone: 'low', label: 'Low-severity incidents only' };
    return { tone: 'ok', label: 'No open incidents' };
  }

  function countItem(count, text) {
    var item = el('li');
    item.appendChild(el('strong', '', String(count)));
    item.appendChild(document.createTextNode(' ' + text));
    return item;
  }

  function renderTopbar() {
    var counts = { critical: 0, high: 0, medium: 0, low: 0 };
    var unacknowledged = 0;
    incidents.forEach(function (inc) {
      counts[inc.severity] += 1;
      if (!state.acked[inc.id]) unacknowledged += 1;
    });

    var overall = overallStatus(counts);
    var pill = $('overall');
    pill.className = 'sev sev--' + overall.tone;
    pill.textContent = overall.label;

    var list = $('counts');
    clear(list);
    SEVERITY_ORDER.forEach(function (sev) {
      list.appendChild(countItem(counts[sev], SEVERITY_LABEL[sev].toLowerCase()));
    });
    list.appendChild(countItem(unacknowledged, 'unacknowledged'));
  }

  function tickClock() {
    var now = new Date();
    var clock = $('clock');
    clock.textContent = clockTime(now, false);
    clock.setAttribute('datetime', now.toISOString());
  }

  /* ---------- Start ---------- */

  function init() {
    renderMetrics();
    renderThroughput();
    fillFilterOptions();
    bindFilters();
    bindAck();
    $('rail-count').textContent = String(incidents.length);
    renderRows();
    renderDetail();
    renderTopbar();
    tickClock();
    window.setInterval(tickClock, 15000);
  }

  init();
})();
