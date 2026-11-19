/* ============================================================
   Relay — Operations control room
   Vanilla JS. No dependencies, no network requests.
   Seed data mirrors DATA.json and is inlined so the page also
   works when opened directly via file:// (fetch would be blocked).
   ============================================================ */
(function () {
  "use strict";

  var DATA = {
    metrics: [
      { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up", context: "vs. 1h avg" },
      { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down", context: "vs. 1h avg" },
      { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up", context: "vs. 1h avg" },
      { label: "Queue depth", value: "2,841", change: "−19%", direction: "down", context: "vs. 1h avg" }
    ],
    throughput: [31,28,24,22,20,23,34,48,62,71,76,73,68,72,80,84,79,75,82,88,77,63,52,41],
    incidents: [
      { id:"INC-2841", severity:"critical", service:"payments-api", age:"12m", owner:"M. Chen", status:"investigating", title:"Card authorization timeouts" },
      { id:"INC-2839", severity:"high", service:"event-router", age:"31m", owner:"Unassigned", status:"open", title:"EU retry queue growth" },
      { id:"INC-2837", severity:"medium", service:"search-index", age:"1h 08m", owner:"A. Silva", status:"monitoring", title:"Index freshness outside SLO" },
      { id:"INC-2832", severity:"low", service:"webhooks", age:"3h 42m", owner:"R. Patel", status:"open", title:"Elevated partner delivery lag" }
    ]
  };

  // Working copy so acknowledge updates persist for the session.
  var incidents = DATA.incidents.map(function (i) { return Object.assign({}, i); });
  var selectedId = incidents.length ? incidents[0].id : null;

  var el = {};
  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function announce(message) {
    el.liveRegion.textContent = message;
  }

  /* ----------------------------------------------------------
     Summary metrics
     Direction semantics: for latency/error/queue, "down" is good;
     for events/min, "up" is good. Encoded per metric explicitly.
     ---------------------------------------------------------- */
  var GOOD_DIRECTION = { "Events / min": "up", "P95 latency": "down", "Error rate": "down", "Queue depth": "down" };

  function arrowIcon(direction) {
    var d = direction === "up" ? "M12 5l6 8H6l6-8Z" : "M12 19l-6-8h12l-6 8Z";
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
  }

  function renderMetrics() {
    el.metrics.innerHTML = DATA.metrics.map(function (m) {
      var isGood = GOOD_DIRECTION[m.label] === m.direction;
      var tone = isGood ? "is-good" : "is-bad";
      var word = m.direction === "up" ? "increased" : "decreased";
      var accessible = m.label + ": " + m.value + ", " + word + " " + m.change + ", " + (isGood ? "favorable" : "unfavorable");
      return '' +
        '<article class="metric">' +
          '<div class="metric-label">' + escapeHtml(m.label) + '</div>' +
          '<div class="metric-value">' + escapeHtml(m.value) + '</div>' +
          '<div class="metric-foot">' +
            '<span class="trend ' + tone + '">' + arrowIcon(m.direction) + escapeHtml(m.change) + '</span>' +
            '<span class="trend-context">' + escapeHtml(m.context) + '</span>' +
            '<span class="sr-only">' + escapeHtml(accessible) + '</span>' +
          '</div>' +
        '</article>';
    }).join("");
  }

  /* ----------------------------------------------------------
     Throughput chart — inline SVG, accessible via figure caption
     ---------------------------------------------------------- */
  function renderChart() {
    var values = DATA.throughput;
    var max = Math.max.apply(null, values);
    var peak = Math.max.apply(null, values);
    var peakIndex = values.indexOf(peak);
    var W = 720, H = 190;
    var padL = 34, padR = 8, padT = 10, padB = 26;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var slot = plotW / values.length;
    var barW = slot * 0.62;

    var svg = [];
    svg.push('<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="chart-svg-title chart-svg-desc">');
    svg.push('<title id="chart-svg-title">24-hour throughput</title>');
    svg.push('<desc id="chart-svg-desc">Hourly request throughput in thousands. ' +
      'Values range from ' + Math.min.apply(null, values) + 'k to ' + max + 'k. ' +
      'Peak of ' + peak + 'k occurred at hour ' + peakIndex + ' of the 24-hour window, relative to the current hour.</desc>');

    // Horizontal grid + y labels (0, half, max)
    [0, Math.round(max / 2), max].forEach(function (v) {
      var y = padT + plotH - (v / max) * plotH;
      svg.push('<line class="chart-grid-line" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '"/>');
      svg.push('<text class="chart-axis-label" x="' + (padL - 7) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + v + 'k</text>');
    });

    // Bars
    values.forEach(function (v, i) {
      var h = (v / max) * plotH;
      var x = padL + i * slot + (slot - barW) / 2;
      var y = padT + plotH - h;
      var cls = i === peakIndex ? "chart-bar chart-peak" : "chart-bar";
      svg.push('<rect class="' + cls + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
        '" width="' + barW.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1"><title>' +
        'Hour ' + i + ': ' + v + 'k requests' + (i === peakIndex ? ' (peak)' : '') + '</title></rect>');
    });

    // X labels at 6-hour intervals
    for (var h = 0; h < 24; h += 6) {
      var x = padL + h * slot + slot / 2;
      var label = h === 0 ? "-24h" : "-" + (24 - h) + "h";
      svg.push('<text class="chart-axis-label" x="' + x.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + label + '</text>');
    }
    svg.push('</svg>');

    el.chartFigure.innerHTML = svg.join("") +
      '<figcaption class="chart-legend">' +
        '<span><span class="legend-swatch" style="background:var(--accent)"></span> Peak hour</span>' +
        '<span><span class="legend-swatch" style="background:var(--accent-dim)"></span> Other hours</span>' +
        '<span class="chart-note">Window: rolling 24h · hourly buckets</span>' +
      '</figcaption>';

    var avg = Math.round(values.reduce(function (a, b) { return a + b; }, 0) / values.length);
    el.chartStats.innerHTML =
      '<div><div class="chart-stat-value">' + peak + 'k</div><div class="chart-stat-label">Peak</div></div>' +
      '<div><div class="chart-stat-value">' + avg + 'k</div><div class="chart-stat-label">Average</div></div>';
  }

  /* ----------------------------------------------------------
     Incident table, filters, empty state
     ---------------------------------------------------------- */
  function getFilters() {
    return {
      q: el.filterSearch.value.trim().toLowerCase(),
      severity: el.filterSeverity.value,
      status: el.filterStatus.value
    };
  }

  function filteredIncidents() {
    var f = getFilters();
    return incidents.filter(function (i) {
      if (f.severity !== "all" && i.severity !== f.severity) return false;
      if (f.status !== "all" && i.status !== f.status) return false;
      if (f.q) {
        var haystack = [i.id, i.title, i.service, i.owner, i.severity, i.status].join(" ").toLowerCase();
        if (haystack.indexOf(f.q) === -1) return false;
      }
      return true;
    });
  }

  function severityMarkup(sev) {
    return '<span class="sev sev-' + sev + '"><span class="sev-dot"></span>' + escapeHtml(sev) + '</span>';
  }

  function statusMarkup(status) {
    return '<span class="status-tag is-' + status + '">' + escapeHtml(status) + '</span>';
  }

  function renderTable() {
    var list = filteredIncidents();
    el.incidentBody.innerHTML = list.map(function (i) {
      var unassigned = i.owner === "Unassigned";
      return '' +
        '<tr data-id="' + escapeHtml(i.id) + '" tabindex="0" role="button" ' +
          'aria-label="View details for ' + escapeHtml(i.id) + ': ' + escapeHtml(i.title) + '" ' +
          'aria-pressed="' + (i.id === selectedId) + '"' +
          (i.id === selectedId ? ' class="is-selected"' : '') + '>' +
          '<td>' + severityMarkup(i.severity) + '</td>' +
          '<td><span class="incident-id">' + escapeHtml(i.id) + '</span>' +
            '<span class="incident-title">' + escapeHtml(i.title) + '</span></td>' +
          '<td class="cell-mono">' + escapeHtml(i.service) + '</td>' +
          '<td class="cell-mono">' + escapeHtml(i.age) + '</td>' +
          '<td class="cell-owner' + (unassigned ? ' owner-unassigned' : '') + '">' + escapeHtml(i.owner) + '</td>' +
          '<td>' + statusMarkup(i.status) + '</td>' +
        '</tr>';
    }).join("");

    var isEmpty = list.length === 0;
    el.emptyState.hidden = !isEmpty;
    el.incidentTable.style.display = isEmpty ? "none" : "";

    var active = Object.values(getFilters()).some(function (v) { return v && v !== "all"; });
    var countText = list.length + " of " + incidents.length + " incidents" + (active ? " (filtered)" : "");
    el.incidentCount.textContent = countText;
  }

  /* ----------------------------------------------------------
     Detail panel
     ---------------------------------------------------------- */
  function buildTimeline(inc) {
    var items = [
      { time: "−" + inc.age, desc: "Incident opened by monitoring" },
      { time: "−" + inc.age, desc: "Severity set to " + inc.severity }
    ];
    if (inc.status === "investigating" || inc.status === "monitoring" || inc.status === "acknowledged") {
      items.push({ time: "recently", desc: "Acknowledged by " + (inc.owner === "Unassigned" ? "on-call" : inc.owner) });
    }
    if (inc.status === "monitoring") {
      items.push({ time: "now", desc: "Mitigation in place, observing" });
    }
    return items.map(function (t, idx) {
      return '<li class="timeline-item' + (idx === items.length - 1 ? ' is-latest' : '') + '">' +
        '<div class="timeline-time">' + escapeHtml(t.time) + '</div>' +
        '<div class="timeline-desc">' + escapeHtml(t.desc) + '</div></li>';
    }).join("");
  }

  function renderDetail() {
    var inc = incidents.find(function (i) { return i.id === selectedId; });
    if (!inc) {
      el.detailContent.innerHTML =
        '<div class="detail-empty">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Zm0 5 .9 6.5h-1.8L12 8Zm0 8.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z"/></svg>' +
          '<div>Select an incident from the table to view its details.</div>' +
        '</div>';
      return;
    }

    var acked = inc.status === "acknowledged";
    el.detailContent.innerHTML =
      '<div class="detail-body">' +
        '<div class="detail-kicker">' +
          '<span class="detail-id">' + escapeHtml(inc.id) + '</span>' +
          severityMarkup(inc.severity) +
        '</div>' +
        '<h3 class="detail-title">' + escapeHtml(inc.title) + '</h3>' +
        '<div class="detail-grid">' +
          '<div class="detail-cell"><div class="detail-cell-label">Status</div><div class="detail-cell-value">' + escapeHtml(inc.status) + '</div></div>' +
          '<div class="detail-cell"><div class="detail-cell-label">Age</div><div class="detail-cell-value">' + escapeHtml(inc.age) + ' elapsed</div></div>' +
          '<div class="detail-cell"><div class="detail-cell-label">Service</div><div class="detail-cell-value">' + escapeHtml(inc.service) + '</div></div>' +
          '<div class="detail-cell"><div class="detail-cell-label">Owner</div><div class="detail-cell-value">' + escapeHtml(inc.owner) + '</div></div>' +
        '</div>' +
        '<div class="detail-timeline">' +
          '<h3>Timeline</h3>' +
          '<ul class="timeline-list">' + buildTimeline(inc) + '</ul>' +
        '</div>' +
        '<div class="detail-actions">' +
          '<button type="button" class="btn btn-primary" id="ack-btn"' + (acked ? ' disabled' : '') + '>' +
            (acked ? 'Acknowledged' : 'Acknowledge') +
          '</button>' +
        '</div>' +
        (acked ? '<div class="ack-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/></svg>Acknowledged — on-call notified</div>' : '') +
      '</div>';

    var btn = $("ack-btn");
    if (btn && !acked) {
      btn.addEventListener("click", function () {
        var target = incidents.find(function (i) { return i.id === selectedId; });
        if (target && target.status !== "acknowledged") {
          target.status = "acknowledged";
          if (target.owner === "Unassigned") target.owner = "M. Chen";
          announce(target.id + " acknowledged. Status set to acknowledged.");
          renderTable();
          renderDetail();
        }
      });
    }
  }

  function selectIncident(id) {
    selectedId = id;
    renderTable();
    renderDetail();
  }

  function clearFilters() {
    el.filterSearch.value = "";
    el.filterSeverity.value = "all";
    el.filterStatus.value = "all";
    renderTable();
  }

  /* ----------------------------------------------------------
     Clock
     ---------------------------------------------------------- */
  function tickClock() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, "0"); }
    el.clock.textContent = p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds()) + " UTC";
  }

  /* ----------------------------------------------------------
     Wire up
     ---------------------------------------------------------- */
  function init() {
    el.metrics = $("metrics");
    el.chartFigure = $("chart-figure");
    el.chartStats = $("chart-stats");
    el.filterSearch = $("filter-search");
    el.filterSeverity = $("filter-severity");
    el.filterStatus = $("filter-status");
    el.incidentBody = $("incident-body");
    el.incidentTable = $("incident-table");
    el.incidentCount = $("incident-count");
    el.emptyState = $("empty-state");
    el.detailContent = $("detail-content");
    el.clock = $("clock");
    el.liveRegion = $("live-region");

    renderMetrics();
    renderChart();
    renderTable();
    renderDetail();
    tickClock();
    setInterval(tickClock, 1000);

    // Filter events
    el.filterSearch.addEventListener("input", renderTable);
    el.filterSeverity.addEventListener("change", renderTable);
    el.filterStatus.addEventListener("change", renderTable);
    $("clear-filters").addEventListener("click", clearFilters);
    $("empty-clear").addEventListener("click", clearFilters);

    // Row selection: click + keyboard (Enter/Space)
    el.incidentBody.addEventListener("click", function (e) {
      var row = e.target.closest("tr[data-id]");
      if (row) selectIncident(row.getAttribute("data-id"));
    });
    el.incidentBody.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var row = e.target.closest("tr[data-id]");
      if (row) { e.preventDefault(); selectIncident(row.getAttribute("data-id")); }
    });

    // Refresh button: re-render from the current data and announce.
    $("refresh-btn").addEventListener("click", function () {
      renderTable();
      renderDetail();
      announce("View refreshed.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
