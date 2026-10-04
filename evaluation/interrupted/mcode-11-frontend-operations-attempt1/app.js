/* ==========================================================================
   Relay — operations control room
   Plain ES2018. No dependencies, no network calls. Data is inlined because
   fetch() of a local file is blocked on file:// origins.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Seed data (mirrors DATA.json)
     ------------------------------------------------------------------ */
  var DATA = {
    metrics: [
      { label: 'Events / min', value: '18,420', change: '+8.2%', direction: 'up', good: 'up',
        context: 'avg 17,014', spark: 18420 },
      { label: 'P95 latency', value: '184', unit: 'ms', change: '\u221212 ms', direction: 'down', good: 'down',
        context: 'SLO 250 ms', spark: 184 },
      { label: 'Error rate', value: '0.37%', unit: '', change: '+0.08 pp', direction: 'up', good: 'down',
        context: 'budget 1.00%', spark: 37 },
      { label: 'Queue depth', value: '2,841', unit: '', change: '\u221219%', direction: 'down', good: 'down',
        context: 'cap 5,000', spark: 2841 }
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
  var SEVERITY_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
  var STATUS_LABEL = { open: 'Open', investigating: 'Investigating', monitoring: 'Monitoring', acknowledged: 'Acknowledged' };
  var SORT_LABEL = { severity: 'severity', age: 'oldest first', id: 'incident id', service: 'service' };

  var IMPACT = {
    'payments-api': 'Checkout authorization timing out for roughly 4% of EU card transactions.',
    'event-router': 'Consumer backlog in eu-west-1; partner webhooks are being retried.',
    'search-index': 'Index freshness sits above the 5 minute SLO for internal search only.',
    'webhooks': 'Partner delivery lag exceeding 30s; no data loss observed.'
  };

  var RUNBOOKS = {
    'payments-api': 'RB-114',
    'event-router': 'RB-208',
    'search-index': 'RB-031',
    'webhooks': 'RB-142'
  };

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  var state = {
    severity: 'all',
    status: 'all',
    service: 'all',
    query: '',
    sort: 'severity',
    selectedId: null,
    acks: {}                 // id -> { at: 'HH:MM:SS' }
  };

  var el = {};
  function $(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------ */
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Age strings are seeded ("12m", "1h 08m"); minutes are derived for sorting. */
  function ageToMinutes(age) {
    var m = /^(\d+)h(?:\s+(\d+)m)?$/.exec(age);
    if (m) return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
    var n = parseInt(age, 10);
    return isNaN(n) ? 0 : n;
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function utcTime(date) {
    return pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds());
  }

  /* Deterministic jitter so sparklines are stable across reloads. */
  function seededSeries(seed, base, length) {
    var out = [], x = seed;
    for (var i = 0; i < length; i++) {
      x = (x * 1103515245 + 12345) % 2147483648;
      var wave = Math.sin((i / length) * Math.PI * 2) * base * 0.06;
      out.push(Math.max(1, Math.round(base * (0.86 + (x / 2147483648) * 0.28) + wave)));
    }
    return out;
  }

  function effectiveStatus(inc) {
    return state.acks[inc.id] ? 'acknowledged' : inc.status;
  }

  function announce(msg) {
    el.live.textContent = '';
    window.setTimeout(function () { el.live.textContent = msg; }, 40);
  }

  var toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { el.toast.hidden = true; }, 3200);
  }

  function icon(id, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }

  /* ------------------------------------------------------------------
     Metrics
     ------------------------------------------------------------------ */
  function renderMetrics() {
    el.metricsGrid.innerHTML = DATA.metrics.map(function (m, i) {
      /* The change is "good" when it moves the metric in the healthy direction. */
      var improving = (m.direction === 'up' && m.good === 'up') || (m.direction === 'down' && m.good === 'down');
      var deltaClass = improving ? 'metric__delta--good' : 'metric__delta--bad';
      if (!improving && m.label === 'Error rate') deltaClass += ' is-critical';

      var spark = seededSeries(7 + i * 13, m.spark, 24);
      var max = Math.max.apply(null, spark);
      var bars = spark.map(function (v, idx) {
        var h = Math.max(1, Math.round((v / max) * 22));
        return '<rect x="' + (idx * 3) + '" y="' + (22 - h) + '" width="2" height="' + h + '"' +
               (v === max ? ' class="is-peak"' : '') + '></rect>';
      }).join('');

      return '' +
        '<li class="metric">' +
          '<span class="metric__label">' + esc(m.label) + '</span>' +
          '<span class="metric__value">' + esc(m.value) +
            (m.unit ? '<small> ' + esc(m.unit) + '</small>' : '') +
          '</span>' +
          '<svg class="metric__spark" viewBox="0 0 72 22" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
            bars +
          '</svg>' +
          '<span class="metric__foot">' +
            '<span class="metric__delta ' + deltaClass + '">' +
              icon(m.direction === 'up' ? 'i-up' : 'i-down') +
              '<span>' + esc(m.change) + '</span>' +
            '</span>' +
            '<span class="metric__context">' + esc(m.context) + '</span>' +
          '</span>' +
        '</li>';
    }).join('');
  }

  /* ------------------------------------------------------------------
     Throughput chart (inline SVG)
     ------------------------------------------------------------------ */
  var HOURLY = DATA.throughput;
  var chartMax = Math.max.apply(null, HOURLY);
  var chartMean = HOURLY.reduce(function (a, b) { return a + b; }, 0) / HOURLY.length;
  var peakIndex = HOURLY.indexOf(chartMax);

  function renderChart() {
    var W = 720, H = 200;
    var padL = 30, padR = 8, padT = 10, padB = 22;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var yMax = Math.ceil(chartMax / 20) * 20;   // round axis to a clean step
    var slot = plotW / HOURLY.length;
    var barW = Math.max(4, slot - 7);

    function y(v) { return padT + plotH - (v / yMax) * plotH; }
    function hourLabel(i) { return (i + 0) % 24 === 0 ? '00:00' : (i + 1) + ':00'; }

    var parts = [];

    /* Horizontal gridlines + y ticks */
    [0, 0.5, 1].forEach(function (f) {
      var v = Math.round(yMax * f);
      parts.push('<line class="gridline' + (f === 0 ? ' gridline--base' : '') + '" x1="' + padL +
        '" y1="' + y(v).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y(v).toFixed(1) + '"></line>');
      parts.push('<text class="axis-label" x="' + (padL - 6) + '" y="' + (y(v) + 3).toFixed(1) +
        '" text-anchor="end">' + v + '</text>');
    });

    /* Incident window: hours 8-11 overlap the payments-api incident. */
    parts.push('<rect class="window-band" x="' + (padL + slot * 8).toFixed(1) + '" y="' + padT +
      '" width="' + (slot * 4).toFixed(1) + '" height="' + plotH + '"></rect>');
    parts.push('<text class="window-label" x="' + (padL + slot * 8 + 4) + '" y="' + (padT + 10) +
      '">INC-2841 onset</text>');

    /* Mean reference line */
    parts.push('<line class="meanline" x1="' + padL + '" y1="' + y(chartMean).toFixed(1) +
      '" x2="' + (W - padR) + '" y2="' + y(chartMean).toFixed(1) + '"></line>');
    parts.push('<text class="axis-label" x="' + (W - padR) + '" y="' + (y(chartMean) - 4).toFixed(1) +
      '" text-anchor="end">mean ' + chartMean.toFixed(0) + '</text>');

    /* Bars, one group per hour, with a full-height hit area for hover */
    HOURLY.forEach(function (v, i) {
      var x = padL + slot * i + (slot - barW) / 2;
      var h = Math.max(1, (v / yMax) * plotH);
      var isPeak = i === peakIndex;
      var inWindow = i >= 8 && i < 12;
      parts.push(
        '<g class="bar--group' + (inWindow ? ' is-hot' : '') + '" data-i="' + i + '">' +
          '<rect class="bar' + (isPeak ? ' is-peak' : '') + '" x="' + x.toFixed(1) + '" y="' +
            (padT + plotH - h).toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) +
            '" rx="1.5"></rect>' +
          '<rect class="hitbox" x="' + (padL + slot * i).toFixed(1) + '" y="' + padT + '" width="' +
            slot.toFixed(1) + '" height="' + plotH + '"></rect>' +
          '<title>' + hourLabel(i) + ' \u2014 ' + v + ' events</title>' +
        '</g>'
      );
    });

    /* x-axis labels every 3 hours */
    for (var i = 0; i < 24; i += 3) {
      parts.push('<text class="axis-label" x="' + (padL + slot * i + slot / 2).toFixed(1) + '" y="' +
        (H - 6) + '" text-anchor="middle">' + (i + 1) + ':00</text>');
    }

    var total = HOURLY.reduce(function (a, b) { return a + b; }, 0);
    var summary = 'Hourly event volume over 24 hours. Peak ' + chartMax + ' events at ' +
      (peakIndex + 1) + ':00, 24 hour mean ' + chartMean.toFixed(1) + ', total ' + total.toLocaleString() + ' events.';

    el.chart.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(summary) + '">' +
        parts.join('') +
      '</svg>' +
      '<table class="visually-hidden"><caption>Events ingested per hour, last 24 hours</caption><tbody>' +
        HOURLY.map(function (v, i) {
          return '<tr><th scope="row">' + (i + 1) + ':00</th><td>' + v + '</td></tr>';
        }).join('') +
      '</tbody></table>';

    el.chartTotal.textContent = total.toLocaleString() + ' events';
    el.chartCaption.innerHTML =
      'Ingestion held a <strong>' + chartMean.toFixed(0) + ' events/h</strong> mean through the window, peaking at <strong>' +
      chartMax + ' at ' + (peakIndex + 1) + ':00</strong>. Volume in the 09:00\u201312:00 band ' +
      'coincides with the payments-api incident and is flagged for review.';
  }

  /* ------------------------------------------------------------------
     Incident list
     ------------------------------------------------------------------ */
  function visibleIncidents() {
    var q = state.query.trim().toLowerCase();
    var rows = DATA.incidents.filter(function (inc) {
      if (state.severity !== 'all' && inc.severity !== state.severity) return false;
      if (state.service !== 'all' && inc.service !== state.service) return false;
      if (state.status !== 'all' && effectiveStatus(inc) !== state.status) return false;
      if (q) {
        var hay = (inc.id + ' ' + inc.title + ' ' + inc.service + ' ' + inc.owner + ' ' + effectiveStatus(inc)).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    rows.sort(function (a, b) {
      if (state.sort === 'severity') {
        var d = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (d !== 0) return d;
        return ageToMinutes(b.age) - ageToMinutes(a.age);
      }
      if (state.sort === 'age') return ageToMinutes(b.age) - ageToMinutes(a.age);
      if (state.sort === 'service') return a.service.localeCompare(b.service);
      return a.id.localeCompare(b.id);
    });

    return rows;
  }

  function renderIncidents() {
    var rows = visibleIncidents();
    var all = DATA.incidents;

    el.body.innerHTML = rows.map(function (inc) {
      var st = effectiveStatus(inc);
      var selected = inc.id === state.selectedId;
      var unassigned = inc.owner === 'Unassigned';
      return '' +
        '<tr data-id="' + esc(inc.id) + '"' + (selected ? ' class="is-selected" aria-current="true"' : '') + '>' +
          '<td class="cell-sev" data-label="Sev">' +
            '<span class="sevtag sevtag--' + inc.severity + '">' +
              '<span class="sev sev--' + inc.severity + '" aria-hidden="true"></span>' + SEVERITY_LABEL[inc.severity] +
            '</span>' +
          '</td>' +
          '<td data-label="Incident">' +
            '<button class="incident__btn" type="button" data-open="' + esc(inc.id) + '" ' +
              'aria-label="Open detail for ' + esc(inc.id) + ', ' + esc(inc.title) + '">' +
              '<span class="incident__id">' + esc(inc.id) + '</span>' +
              '<span class="incident__title" title="' + esc(inc.title) + '">' + esc(inc.title) + '</span>' +
            '</button>' +
          '</td>' +
          '<td data-label="Service"><span class="service">' + esc(inc.service) + '</span></td>' +
          '<td class="num" data-label="Age"><span class="mono">' + esc(inc.age) + '</span></td>' +
          '<td data-label="Owner"><span class="owner' + (unassigned ? ' owner--none' : '') + '">' +
            (unassigned ? '' : icon('i-user')) + esc(inc.owner) + '</span></td>' +
          '<td data-label="Status"><span class="status status--' + st + '">' +
            '<span class="status__dot" aria-hidden="true"></span>' + STATUS_LABEL[st] + '</span></td>' +
          '<td class="cell-open" data-label=""><span class="row-arrow">' + icon('i-chevron') + '</span></td>' +
        '</tr>';
    }).join('');

    /* Per-severity counts reflect the other active filters, so an operator can
       see what each chip would yield. The "All" chip is the fully-filtered
       total, which is exactly what the table below is showing. */
    var pool = all.filter(function (inc) {
      if (state.status !== 'all' && effectiveStatus(inc) !== state.status) return false;
      if (state.service !== 'all' && inc.service !== state.service) return false;
      var q = state.query.trim().toLowerCase();
      if (q) {
        var hay = (inc.id + ' ' + inc.title + ' ' + inc.service + ' ' + inc.owner).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-count]'), function (node) {
      var key = node.getAttribute('data-count');
      var n = key === 'all' ? rows.length : pool.filter(function (i) { return i.severity === key; }).length;
      node.textContent = n;
      var chip = node.closest('.chip');
      if (chip) chip.classList.toggle('is-empty', n === 0);
    });

    /* Empty state vs. table */
    var isEmpty = rows.length === 0;
    el.table.hidden = isEmpty;
    el.empty.hidden = !isEmpty;
    if (isEmpty) {
      el.empty.querySelector('.empty__body').textContent =
        all.length === 0
          ? 'No incidents are currently open.'
          : 'None of the ' + all.length + ' open incidents match this combination. ' +
            'Severity "' + (state.severity === 'all' ? 'all' : SEVERITY_LABEL[state.severity]) + '" with status "' +
            (state.status === 'all' ? 'all' : STATUS_LABEL[state.status]) + '"' +
            (state.service === 'all' ? '' : ' and service "' + state.service + '"') +
            (state.query ? ' and text "' + state.query + '"' : '') + '.';
    }

    el.resultCount.textContent = rows.length;
    el.sortLabel.textContent = SORT_LABEL[state.sort] || state.sort;
    el.railCount.textContent = all.length;

    var dirty = state.severity !== 'all' || state.status !== 'all' || state.service !== 'all' || state.query !== '';
    el.clearFilters.hidden = !dirty;

    /* Keep the selection valid against the new result set. */
    if (state.selectedId && !rows.some(function (r) { return r.id === state.selectedId; })) {
      select(rows.length ? rows[0].id : null, false);
    }
  }

  /* ------------------------------------------------------------------
     Detail panel
     ------------------------------------------------------------------ */
  function findIncident(id) {
    for (var i = 0; i < DATA.incidents.length; i++) {
      if (DATA.incidents[i].id === id) return DATA.incidents[i];
    }
    return null;
  }

  function renderDetail() {
    var inc = findIncident(state.selectedId);

    if (!inc) {
      el.detailBody.innerHTML =
        '<div class="detail__placeholder">' +
          icon('i-incident') +
          '<p>No incident selected. Choose a row in the table to review the timeline, impact, and runbook.</p>' +
        '</div>';
      return;
    }

    var st = effectiveStatus(inc);
    var mins = ageToMinutes(inc.age);
    var ack = state.acks[inc.id];
    var detected = 'T\u2212' + mins + 'm';
    var unassigned = inc.owner === 'Unassigned';

    /* Timeline is derived from the incident's own age and status. */
    var tl = [
      { text: 'Detected by anomaly rule <span class="mono">pay.auth.timeout_rate</span>', time: detected, now: false },
      { text: 'Paged on-call · ' + (unassigned ? 'awaiting acknowledgement' : esc(inc.owner) + ' paged'), time: 'T\u2212' + Math.max(1, mins - 3) + 'm', now: false }
    ];
    if (st === 'investigating' || st === 'acknowledged') {
      tl.push({ text: 'Investigator assigned · hypothesis recorded in incident channel', time: 'T\u2212' + Math.max(1, mins - 6) + 'm', now: !ack });
    }
    if (st === 'monitoring') {
      tl.push({ text: 'Mitigation applied · monitoring for regression', time: 'T\u22121m', now: true });
    }
    if (st === 'open') {
      tl.push({ text: 'Awaiting first responder acknowledgement', time: 'now', now: true });
    }
    if (ack) tl.push({ text: 'Acknowledged by you', time: ack.at + ' UTC', now: true });

    el.detailBody.innerHTML = '' +
      '<div class="detail__head">' +
        '<div class="detail__titlerow">' +
          '<div>' +
            '<div class="detail__id">' + esc(inc.id) + '</div>' +
            '<h3 class="detail__title" id="detail-heading">' + esc(inc.title) + '</h3>' +
          '</div>' +
          '<button class="iconbtn detail__close" type="button" data-close-detail aria-label="Clear selection">' +
            icon('i-close') + '</button>' +
        '</div>' +
        '<div class="detail__tags">' +
          '<span class="sevtag sevtag--' + inc.severity + '"><span class="sev sev--' + inc.severity + '" aria-hidden="true"></span>' +
            SEVERITY_LABEL[inc.severity] + '</span>' +
          '<span class="status status--' + st + '"><span class="status__dot" aria-hidden="true"></span>' + STATUS_LABEL[st] + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="detail__section">' +
        '<div class="detail__label">Impact</div>' +
        '<p class="impact">' + esc(IMPACT[inc.service] || 'Impact under assessment.') + '</p>' +
      '</div>' +

      '<div class="detail__section">' +
        '<div class="detail__label">Attributes</div>' +
        '<dl class="facts">' +
          '<dt>Service</dt><dd>' + esc(inc.service) + '</dd>' +
          '<dt>Owner</dt><dd class="' + (unassigned ? 'is-text' : '') + '">' + (unassigned ? 'Unassigned' : esc(inc.owner)) + '</dd>' +
          '<dt>Age</dt><dd>' + esc(inc.age) + '</dd>' +
          '<dt>Runbook</dt><dd>' + esc(RUNBOOKS[inc.service] || '\u2014') + '</dd>' +
        '</dl>' +
      '</div>' +

      '<div class="detail__section">' +
        '<div class="detail__label">Timeline</div>' +
        '<ol class="timeline">' +
          tl.map(function (t) {
            return '<li class="tl' + (t.now ? ' tl--now' : '') + '">' +
              '<span class="tl__dot" aria-hidden="true"></span>' +
              '<span><span class="tl__text">' + t.text + '</span><br>' +
              '<span class="tl__time">' + esc(t.time) + '</span></span></li>';
          }).join('') +
        '</ol>' +
      '</div>' +

      (ack
        ? '<div class="ack-note">' + icon('i-check') + '<span>Acknowledged at ' + esc(ack.at) + ' UTC</span></div>'
        : '') +

      '<div class="actions">' +
        (ack
          ? '<button class="btn btn--sm" type="button" data-undo-ack="' + esc(inc.id) + '">Undo acknowledgement</button>' +
            '<button class="btn btn--ghost btn--sm" type="button" data-copy-id="' + esc(inc.id) + '">' +
              icon('i-copy') + '<span>Copy ID</span></button>'
          : '<button class="btn btn--primary btn--sm" type="button" data-ack="' + esc(inc.id) + '">' +
              icon('i-check') + '<span>Acknowledge</span></button>' +
            '<button class="btn btn--ghost btn--sm" type="button" data-copy-id="' + esc(inc.id) + '">' +
              icon('i-copy') + '<span>Copy ID</span></button>'
            ) +
      '</div>';
  }

  /* ------------------------------------------------------------------
     Selection + acknowledge
     ------------------------------------------------------------------ */
  function select(id, announceIt) {
    state.selectedId = id;
    renderIncidents();
    renderDetail();
    if (announceIt && id) {
      var inc = findIncident(id);
      announce('Selected ' + id + ', ' + (inc ? inc.title : '') + ', severity ' +
        (inc ? SEVERITY_LABEL[inc.severity] : '') + ', status ' +
        (inc ? STATUS_LABEL[effectiveStatus(inc)] : '') + '.');
    }
  }

  function acknowledge(id) {
    var inc = findIncident(id);
    if (!inc || state.acks[id]) return;
    state.acks[id] = { at: utcTime(new Date()) };
    renderIncidents();
    renderDetail();
    announce('Acknowledged ' + id + '. Status is now Acknowledged, owner ' + inc.owner + '.');
    toast(id + ' acknowledged at ' + state.acks[id].at + ' UTC');
  }

  function undoAcknowledge(id) {
    if (!state.acks[id]) return;
    delete state.acks[id];
    renderIncidents();
    renderDetail();
    announce('Acknowledgement removed for ' + id + '. Status restored to ' +
      STATUS_LABEL[findIncident(id).status] + '.');
    toast(id + ' acknowledgement undone');
  }

  function copyId(id) {
    var done = function () { toast('Copied ' + id + ' to clipboard'); };
    var fail = function () { toast('Clipboard unavailable — ID is ' + id); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).then(done, fail);
    } else {
      fail();
    }
  }

  function clearFilters() {
    state.severity = 'all';
    state.status = 'all';
    state.service = 'all';
    state.query = '';
    el.statusSelect.value = 'all';
    el.serviceSelect.value = 'all';
    el.search.value = '';
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) {
      var on = c.getAttribute('data-severity') === 'all';
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderIncidents();
    announce('Filters cleared. Showing all ' + DATA.incidents.length + ' open incidents.');
  }

  function filtersAreDirty() {
    return state.severity !== 'all' || state.status !== 'all' || state.service !== 'all' || state.query !== '';
  }

  /* ------------------------------------------------------------------
     Wiring
     ------------------------------------------------------------------ */
  function renderClock() {
    var now = new Date();
    el.clock.textContent = utcTime(now);
    el.clock.setAttribute('datetime', now.toISOString());
  }

  function init() {
    el = {
      metricsGrid: $('metrics-grid'),
      chart: $('chart'),
      chartTotal: $('throughput-total'),
      chartCaption: $('chart-caption'),
      body: $('incident-body'),
      table: $('incident-table'),
      empty: $('empty-state'),
      resultCount: $('result-count'),
      sortLabel: $('sort-label'),
      railCount: $('rail-count'),
      detailBody: $('detail-body'),
      statusSelect: $('status-select'),
      serviceSelect: $('service-select'),
      sortSelect: $('sort-select'),
      search: $('global-search'),
      clearFilters: $('clear-filters'),
      clock: $('clock'),
      updatedAt: $('updated-at'),
      toast: $('toast'),
      live: $('live-region')
    };

    /* Service options come from the data, not from a hard-coded list. */
    var services = DATA.incidents.map(function (i) { return i.service; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; })
      .sort();
    el.serviceSelect.innerHTML = '<option value="all">All services</option>' +
      services.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join('');

    renderMetrics();
    renderChart();
    renderClock();
    window.setInterval(renderClock, 1000);
    el.updatedAt.textContent = utcTime(new Date()) + ' UTC';

    select(DATA.incidents[0].id, false);
    renderIncidents();
    renderDetail();

    /* Severity chips */
    $('severity-chips').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (chip) {
        state.severity = chip.getAttribute('data-severity');
        Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) {
          var on = c === chip;
          c.classList.toggle('is-active', on);
          c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        renderIncidents();
        announce('Filter: severity ' + (state.severity === 'all' ? 'all' : SEVERITY_LABEL[state.severity]) +
          '. ' + visibleIncidents().length + ' incidents shown.');
      }
    });

    /* Row click / keyboard activation / arrow-key roving */
    el.body.addEventListener('click', function (e) {
      var tr = e.target.closest('tr');
      if (tr) select(tr.getAttribute('data-id'), true);
    });

    el.body.addEventListener('keydown', function (e) {
      var current = e.target.closest('tr');
      if (!current) return;
      var rows = Array.prototype.slice.call(el.body.querySelectorAll('tr'));
      var i = rows.indexOf(current);
      var currentId = current.getAttribute('data-id');
      var targetId = null;

      if (e.key === 'ArrowDown') targetId = rows[i + 1] && rows[i + 1].getAttribute('data-id');
      else if (e.key === 'ArrowUp') targetId = rows[i - 1] && rows[i - 1].getAttribute('data-id');
      else if (e.key === 'Home') targetId = rows[0] && rows[0].getAttribute('data-id');
      else if (e.key === 'End') targetId = rows[rows.length - 1] && rows[rows.length - 1].getAttribute('data-id');
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') targetId = currentId;

      if (!targetId) return;
      e.preventDefault();

      /* Re-render first, then re-focus: selecting rebuilds the tbody, so the
         originally focused button no longer exists in the DOM. */
      select(targetId, targetId !== currentId);
      var btn = el.body.querySelector('tr[data-id="' + targetId + '"] .incident__btn');
      if (btn) btn.focus();
    });

    /* Detail panel actions */
    el.detailBody.addEventListener('click', function (e) {
      var ack = e.target.closest('[data-ack]');
      var undo = e.target.closest('[data-undo-ack]');
      var copy = e.target.closest('[data-copy-id]');
      var close = e.target.closest('[data-close-detail]');
      if (ack) acknowledge(ack.getAttribute('data-ack'));
      else if (undo) undoAcknowledge(undo.getAttribute('data-undo-ack'));
      else if (copy) copyId(copy.getAttribute('data-copy-id'));
      else if (close) select(null, false);
    });

    /* Selects */
    el.statusSelect.addEventListener('change', function () {
      state.status = el.statusSelect.value;
      renderIncidents();
      announce('Filter: status ' + (state.status === 'all' ? 'all' : STATUS_LABEL[state.status]) +
        '. ' + visibleIncidents().length + ' incidents shown.');
    });
    el.serviceSelect.addEventListener('change', function () {
      state.service = el.serviceSelect.value;
      renderIncidents();
      announce('Filter: service ' + (state.service === 'all' ? 'all' : state.service) +
        '. ' + visibleIncidents().length + ' incidents shown.');
    });
    el.sortSelect.addEventListener('change', function () {
      state.sort = el.sortSelect.value;
      renderIncidents();
      announce('Sorted by ' + (SORT_LABEL[state.sort] || state.sort) + '.');
    });

    /* Search (debounced) + "/" shortcut + Escape to clear */
    var searchTimer;
    el.search.addEventListener('input', function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        state.query = el.search.value;
        renderIncidents();
        announce(visibleIncidents().length + ' incidents match "' + state.query + '".');
      }, 160);
    });
    $('search-form').addEventListener('submit', function (e) {
      e.preventDefault();
      window.clearTimeout(searchTimer);
      state.query = el.search.value;
      renderIncidents();
    });

    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'select' || tag === 'textarea';

      if (e.key === '/' && !typing) { e.preventDefault(); el.search.focus(); el.search.select(); return; }
      if (e.key === 'Escape' && typing && e.target === el.search && el.search.value) {
        el.search.value = '';
        state.query = '';
        renderIncidents();
        return;
      }
      if (filtersAreDirty() && (e.key === 'c' || e.key === 'C') && !typing && !e.metaKey && !e.ctrlKey) {
        clearFilters();
      }
    });

    /* Clear-filter buttons */
    el.clearFilters.addEventListener('click', clearFilters);
    Array.prototype.forEach.call(document.querySelectorAll('[data-clear-filters]'), function (b) {
      b.addEventListener('click', clearFilters);
    });

    /* Header actions */
    $('refresh-btn').addEventListener('click', function () {
      el.updatedAt.textContent = utcTime(new Date()) + ' UTC';
      renderIncidents();
      toast('Refreshed — ' + DATA.incidents.length + ' open incidents');
      announce('Dashboard refreshed.');
    });
    $('export-btn').addEventListener('click', function () {
      var rows = visibleIncidents();
      var csv = 'id,severity,service,age,owner,status,title\n' + rows.map(function (i) {
        return [i.id, i.severity, i.service, '"' + i.age + '"', i.owner, effectiveStatus(i), '"' + i.title + '"'].join(',');
      }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'relay-incidents.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Exported ' + rows.length + ' incidents as CSV');
    });

    /* Rail: keep the active item in sync with the scrolled section */
    Array.prototype.forEach.call(document.querySelectorAll('.rail__item'), function (item) {
      item.addEventListener('click', function (e) {
        var href = item.getAttribute('href');
        if (!href || href === '#main') return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        history.replaceState(null, '', href);
        Array.prototype.forEach.call(document.querySelectorAll('.rail__item'), function (i) {
          i.classList.toggle('is-current', i === item);
          if (i === item) i.setAttribute('aria-current', 'page');
          else i.removeAttribute('aria-current');
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
