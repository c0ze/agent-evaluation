/* Relay — operations control room
   Vanilla JS, no dependencies. Renders metrics, a 24h throughput chart and a
   filterable incident queue with a detail panel. */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Data
   * ------------------------------------------------------------------ */

  // Mirrors DATA.json so the page also works from file:// where fetch is blocked.
  var SEED = {
    metrics: [
      { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up" },
      { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down" },
      { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up" },
      { label: "Queue depth", value: "2,841", change: "−19%", direction: "down" }
    ],
    throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    incidents: [
      { id: "INC-2841", severity: "critical", service: "payments-api", age: "12m", owner: "M. Chen", status: "investigating", title: "Card authorization timeouts" },
      { id: "INC-2839", severity: "high", service: "event-router", age: "31m", owner: "Unassigned", status: "open", title: "EU retry queue growth" },
      { id: "INC-2837", severity: "medium", service: "search-index", age: "1h 08m", owner: "A. Silva", status: "monitoring", title: "Index freshness outside SLO" },
      { id: "INC-2832", severity: "low", service: "webhooks", age: "3h 42m", owner: "R. Patel", status: "open", title: "Elevated partner delivery lag" }
    ]
  };

  // Additional queue rows so filtering and empty states are meaningful.
  var EXTRA = [
    { id: "INC-2840", severity: "critical", service: "auth-gateway", age: "6m", owner: "K. Okafor", status: "investigating", title: "Token refresh returns 5xx" },
    { id: "INC-2838", severity: "high", service: "payments-api", age: "47m", owner: "Unassigned", status: "open", title: "Settlement upload retries exhausted" },
    { id: "INC-2836", severity: "high", service: "ledger-export", age: "1h 22m", owner: "M. Chen", status: "acknowledged", title: "Nightly export window overrun" },
    { id: "INC-2833", severity: "medium", service: "webhooks", age: "1h 54m", owner: "R. Patel", status: "acknowledged", title: "Provider outage, vendor ETA pending" },
    { id: "INC-2830", severity: "medium", service: "event-router", age: "2h 15m", owner: "A. Silva", status: "monitoring", title: "Partition lag on topic eu-2" },
    { id: "INC-2828", severity: "low", service: "notifications", age: "5h 03m", owner: "Unassigned", status: "open", title: "Digest job behind schedule" },
    { id: "INC-2825", severity: "high", service: "search-index", age: "6h 41m", owner: "Unassigned", status: "open", title: "Replica shard left unassigned" },
    { id: "INC-2821", severity: "medium", service: "payments-api", age: "8h 12m", owner: "K. Okafor", status: "monitoring", title: "Retry budget at 60 percent" },
    { id: "INC-2819", severity: "low", service: "ledger-export", age: "11h 05m", owner: "M. Chen", status: "resolved", title: "Backfill completed, awaiting review" }
  ];

  var SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  var SEVERITY_LABEL = { critical: "Crit", high: "High", medium: "Med", low: "Low" };
  var STATUS_LABEL = {
    open: "Open",
    investigating: "Investigating",
    acknowledged: "Acknowledged",
    monitoring: "Monitoring",
    resolved: "Resolved"
  };
  var OPERATOR = "A. Novak";
  var STORE_KEY = "relay.theme";

  var state = {
    metrics: [],
    throughput: [],
    incidents: [],
    filters: { q: "", severities: [], status: "all", service: "all", unassignedOnly: false, hideResolved: true },
    sort: { key: "severity", dir: "asc" },
    selectedId: null,
    focusIndex: 0,
    rows: []
  };

  var el = {};

  /* ------------------------------------------------------------------ *
   * Utilities
   * ------------------------------------------------------------------ */

  function $(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Deterministic pseudo-random so sparklines stay stable across reloads.
  function seeded(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
    return h;
  }

  function parseAge(text) {
    var m = String(text).match(/(\d+)\s*h/);
    var mm = String(text).match(/(\d+)\s*m/);
    return (m ? parseInt(m[1], 10) * 60 : 0) + (mm ? parseInt(mm[1], 10) : 0);
  }

  function formatAge(mins) {
    mins = Math.max(0, Math.round(mins));
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h >= 24) return Math.floor(h / 24) + "d " + String(h % 24).padStart(2, "0") + "h";
    if (h > 0) return h + "h " + String(m).padStart(2, "0") + "m";
    return m + "m";
  }

  /* ------------------------------------------------------------------ *
   * Data loading
   * ------------------------------------------------------------------ */

  function normalise(raw) {
    var incidents = raw.incidents.map(function (inc) {
      return {
        id: inc.id,
        severity: inc.severity,
        service: inc.service,
        title: inc.title,
        owner: inc.owner,
        status: inc.status,
        baseAge: parseAge(inc.age),
        ageMinutes: parseAge(inc.age),
        ackedBy: inc.status === "acknowledged" || inc.status === "investigating" || inc.status === "monitoring"
          ? (inc.owner === "Unassigned" ? "Relay autopilot" : inc.owner)
          : null
      };
    });

    EXTRA.forEach(function (inc) {
      incidents.push({
        id: inc.id,
        severity: inc.severity,
        service: inc.service,
        title: inc.title,
        owner: inc.owner,
        status: inc.status,
        baseAge: parseAge(inc.age),
        ageMinutes: parseAge(inc.age),
        ackedBy: inc.status === "acknowledged" || inc.status === "investigating" || inc.status === "monitoring"
          ? (inc.owner === "Unassigned" ? "Relay autopilot" : inc.owner)
          : null
      });
    });

    return {
      metrics: raw.metrics,
      throughput: raw.throughput,
      incidents: incidents
    };
  }

  function load() {
    var source = "DATA.json";
    return fetch(source, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (raw) {
        if (!raw || !raw.incidents) throw new Error("bad payload");
        return normalise(raw);
      })
      .catch(function () {
        // file:// or a static opener: fall back to the inline copy.
        return normalise(SEED);
      });
  }

  /* ------------------------------------------------------------------ *
   * Metrics
   * ------------------------------------------------------------------ */

  // Metrics where a rising number is a problem.
  var LOWER_IS_BETTER = /latency|error|depth|queue/i;

  function trendTone(metric) {
    if (metric.direction === "flat") return "neutral";
    var lowerBetter = LOWER_IS_BETTER.test(metric.label);
    var improving = lowerBetter ? metric.direction === "down" : metric.direction === "up";
    return improving ? "good" : "bad";
  }

  function sparkline(metric, index) {
    var rand = seeded(hash(metric.label) + 7);
    var n = 14;
    var pts = [];
    var level = 0.5;
    var drift = metric.direction === "up" ? 0.035 : -0.035;
    for (var i = 0; i < n; i++) {
      level = Math.min(0.92, Math.max(0.08, level + (rand() - 0.5) * 0.24 + drift));
      pts.push(level);
    }
    var w = 100, h = 22;
    var step = w / (n - 1);
    var d = pts.map(function (p, i) {
      return (i === 0 ? "M" : "L") + (i * step).toFixed(2) + " " + (h - p * h).toFixed(2);
    }).join(" ");
    var tone = trendTone(metric);
    var stroke = tone === "good" ? "var(--ok)" : tone === "bad" ? "var(--sev-critical)" : "var(--text-mute)";
    return '<svg class="metric__spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="1.4" ' +
      'vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>' +
      '</svg>';
  }

  function renderMetrics() {
    el.metrics.innerHTML = state.metrics.map(function (m, i) {
      var tone = trendTone(m);
      var arrow = m.direction === "up" ? "▲" : m.direction === "down" ? "▼" : "■";
      var rel = m.direction === "up" ? "higher" : "lower";
      return '<article class="metric">' +
        '<p class="metric__label">' + esc(m.label) + '</p>' +
        '<div class="metric__row">' +
          '<span class="metric__value">' + esc(m.value) + '</span>' +
          '<span class="metric__delta" data-tone="' + tone + '">' +
            '<span class="metric__arrow" aria-hidden="true">' + arrow + '</span>' + esc(m.change) +
          '</span>' +
        '</div>' +
        sparkline(m, i) +
        '<p class="metric__note">' + esc(rel) + ' than the 7-day baseline</p>' +
      '</article>';
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   * Throughput chart (inline SVG)
   * ------------------------------------------------------------------ */

  var CHART = { w: 720, h: 190, top: 12, bottom: 26, left: 30, right: 8 };

  function renderChart() {
    var data = state.throughput;
    var max = Math.max.apply(null, data);
    var scaleMax = Math.ceil(max / 20) * 20;
    var sum = data.reduce(function (a, b) { return a + b; }, 0);
    var mean = sum / data.length;
    var peakIndex = data.indexOf(max);

    var innerH = CHART.h - CHART.top - CHART.bottom;
    var innerW = CHART.w - CHART.left - CHART.right;
    var slot = innerW / data.length;

    function x(i) { return CHART.left + i * slot + slot / 2; }
    function y(v) { return CHART.top + innerH - (v / scaleMax) * innerH; }

    var parts = [];

    // Gridlines + y labels
    for (var g = 0; g <= 4; g++) {
      var gv = (scaleMax / 4) * g;
      var gy = y(gv);
      parts.push('<line class="grid-line" x1="' + CHART.left + '" y1="' + gy.toFixed(1) + '" x2="' + (CHART.w - CHART.right) + '" y2="' + gy.toFixed(1) + '"/>');
      parts.push('<text class="axis-label" x="' + (CHART.left - 6) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end">' + gv + "</text>");
    }

    // Mean reference
    var my = y(mean);
    parts.push('<line class="avg-line" x1="' + CHART.left + '" y1="' + my.toFixed(1) + '" x2="' + (CHART.w - CHART.right) + '" y2="' + my.toFixed(1) + '"/>');

    // Area + line
    var line = data.map(function (v, i) { return (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
    parts.push('<path class="area" d="' + line + " L" + x(data.length - 1).toFixed(1) + " " + (CHART.top + innerH) + " L" + x(0).toFixed(1) + " " + (CHART.top + innerH) + ' Z"/>');
    parts.push('<path class="line" d="' + line + '"/>');

    // Peak marker — the hour operators care about first
    parts.push('<circle class="peak-dot" cx="' + x(peakIndex).toFixed(1) + '" cy="' + y(max).toFixed(1) + '" r="3.4"/>');
    parts.push('<text class="axis-label" x="' + Math.min(x(peakIndex) + 8, CHART.w - 26).toFixed(1) + '" y="' + (y(max) - 7).toFixed(1) + '">peak ' + max + "k</text>");

    // x labels every three hours
    for (var h = 0; h < data.length; h += 3) {
      parts.push('<text class="axis-label" x="' + x(h).toFixed(1) + '" y="' + (CHART.h - 9) + '" text-anchor="middle">' + String(h).padStart(2, "0") + "</text>");
    }

    // Interactive hit areas, one per hour
    data.forEach(function (v, i) {
      var hx = (CHART.left + i * slot).toFixed(1);
      parts.push(
        '<g class="hit" tabindex="0" role="img" data-i="' + i + '" ' +
        'aria-label="Hour ' + String(i).padStart(2, "0") + ":00 UTC, " + v + ' thousand events per minute">' +
        '<rect class="bar" x="' + hx + '" y="' + CHART.top + '" width="' + slot.toFixed(1) + '" height="' + innerH + '"/>' +
        "</g>"
      );
    });

    var svg = '<svg class="chart" viewBox="0 0 ' + CHART.w + " " + CHART.h + '" role="group" ' +
      'aria-label="Hourly ingest throughput over the last 24 hours, peaking at ' + max + ' thousand events per minute, mean ' +
      mean.toFixed(1) + ' thousand.">' + parts.join("") + "</svg>";

    var existing = el.chartWrap.querySelector(".chart__plot");
    if (existing) existing.remove();
    var plot = document.createElement("div");
    plot.className = "chart__plot";
    plot.innerHTML = svg;
    el.chartWrap.appendChild(plot);
    plot.appendChild(el.chartTip);

    el.chartPeak.textContent = max + "k";
    el.chartMean.textContent = mean.toFixed(1) + "k";
    el.chartTotal.textContent = (sum / 1000).toFixed(1) + "M";

    var hits = el.chartWrap.querySelectorAll(".hit");
    Array.prototype.forEach.call(hits, function (hit) {
      hit.addEventListener("mouseenter", function () { showTip(hit); });
      hit.addEventListener("focus", function () { showTip(hit); });
      hit.addEventListener("mouseleave", hideTip);
      hit.addEventListener("blur", hideTip);
    });
  }

  function showTip(hit) {
    var i = parseInt(hit.getAttribute("data-i"), 10);
    var v = state.throughput[i];
    var slot = (CHART.w - CHART.left - CHART.right) / state.throughput.length;
    var px = (CHART.left + i * slot + slot / 2) / CHART.w;
    var py = (CHART.top + (CHART.h - CHART.top - CHART.bottom) - (v / (Math.ceil(Math.max.apply(null, state.throughput) / 20) * 20)) * (CHART.h - CHART.top - CHART.bottom)) / CHART.h;

    el.chartTip.innerHTML = "<b>" + v + "k/min</b> · " + String(i).padStart(2, "0") + ":00 UTC";
    el.chartTip.hidden = false;
    el.chartTip.style.left = (px * 100).toFixed(2) + "%";
    el.chartTip.style.top = "calc(" + (py * 100).toFixed(2) + "% - 4px)";
  }

  function hideTip() { el.chartTip.hidden = true; }

  /* ------------------------------------------------------------------ *
   * Filtering + sorting
   * ------------------------------------------------------------------ */

  function applyFilters() {
    var f = state.filters;
    var q = f.q.trim().toLowerCase();

    var rows = state.incidents.filter(function (inc) {
      if (f.severities.length && f.severities.indexOf(inc.severity) === -1) return false;
      if (f.status !== "all" && inc.status !== f.status) return false;
      if (f.service !== "all" && inc.service !== f.service) return false;
      if (f.unassignedOnly && inc.owner !== "Unassigned") return false;
      if (f.hideResolved && inc.status === "resolved") return false;
      if (q) {
        var hay = (inc.id + " " + inc.title + " " + inc.service + " " + inc.owner + " " + inc.status).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var key = state.sort.key;
    var dir = state.sort.dir === "asc" ? 1 : -1;
    rows.sort(function (a, b) {
      var av, bv;
      if (key === "severity") { av = SEVERITY_ORDER[a.severity]; bv = SEVERITY_ORDER[b.severity]; }
      else if (key === "age") { av = a.ageMinutes; bv = b.ageMinutes; }
      else if (key === "status") { av = a.status; bv = b.status; }
      else if (key === "service") { av = a.service; bv = b.service; }
      else if (key === "owner") { av = a.owner; bv = b.owner; }
      else { av = a.id; bv = b.id; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.id < b.id ? -1 : 1;
    });

    state.rows = rows;
    return rows;
  }

  function activeFilterCount() {
    var f = state.filters, n = 0;
    if (f.q.trim()) n++;
    if (f.severities.length) n++;
    if (f.status !== "all") n++;
    if (f.service !== "all") n++;
    if (f.unassignedOnly) n++;
    return n;
  }

  /* ------------------------------------------------------------------ *
   * Table
   * ------------------------------------------------------------------ */

  function statusMarkup(inc) {
    return '<span class="status" data-status="' + inc.status + '">' + STATUS_LABEL[inc.status] + "</span>";
  }

  function renderTable() {
    var rows = applyFilters();

    el.body.innerHTML = rows.map(function (inc) {
      var selected = inc.id === state.selectedId;
      var unassigned = inc.owner === "Unassigned";
      return '<tr role="row" data-id="' + inc.id + '" tabindex="' + (selected ? "0" : "-1") + '" ' +
        'aria-selected="' + (selected ? "true" : "false") + '"' +
        (inc.status === "acknowledged" ? ' class="is-acknowledged"' : "") + ">" +
        '<td role="gridcell" class="cell-sev"><span class="sev" data-sev="' + inc.severity + '">' + SEVERITY_LABEL[inc.severity] + "</span></td>" +
        '<td role="gridcell" class="cell-id"><span class="id">' + esc(inc.id) + '</span><span class="title">' + esc(inc.title) + "</span></td>" +
        '<td role="gridcell" class="cell-service">' + esc(inc.service) + "</td>" +
        '<td role="gridcell" class="age num" data-age-cell="' + inc.id + '">' + esc(formatAge(inc.ageMinutes)) + "</td>" +
        '<td role="gridcell" class="cell-owner">' + (unassigned ? '<span class="unassigned">Unassigned</span>' : esc(inc.owner)) + "</td>" +
        '<td role="gridcell" class="cell-status">' + statusMarkup(inc) + "</td>" +
        "</tr>";
    }).join("");

    var total = state.incidents.length;
    var filtersOn = activeFilterCount() > 0;
    var n = activeFilterCount();
    if (filtersOn) {
      el.resultCount.textContent = "Showing " + rows.length + " of " + total + " incidents · " +
        n + " filter" + (n === 1 ? "" : "s") + " active";
    } else if (rows.length !== total) {
      el.resultCount.textContent = "Showing " + rows.length + " of " + total + " incidents · " +
        (total - rows.length) + " resolved hidden";
    } else {
      el.resultCount.textContent = "Showing all " + total + " incidents";
    }
    el.clearFilters.hidden = !filtersOn;

    var openCount = state.incidents.filter(function (i) { return i.status !== "resolved"; }).length;
    el.railBadge.textContent = openCount;
    el.railBadge.setAttribute("data-empty", openCount === 0 ? "true" : "false");

    // Empty / clear states
    var noMatches = rows.length === 0 && filtersOn;
    var queueClear = rows.length === 0 && !filtersOn;
    el.emptyState.hidden = !noMatches;
    el.allClear.hidden = !queueClear;
    if (noMatches) el.emptyDesc.textContent = describeFilters();

    if (!rows.length) return;

    // Keep a sane focus position after re-render.
    if (state.focusIndex >= rows.length) state.focusIndex = rows.length - 1;
    var trs = el.body.querySelectorAll("tr");
    Array.prototype.forEach.call(trs, function (tr, i) {
      tr.setAttribute("tabindex", i === state.focusIndex ? "0" : "-1");
      tr.addEventListener("click", function () { state.focusIndex = i; selectIncident(inc_id(tr)); });
      tr.addEventListener("keydown", onRowKeydown);
    });
  }

  function inc_id(tr) { return tr.getAttribute("data-id"); }

  function describeFilters() {
    var f = state.filters;
    var bits = [];
    if (f.q.trim()) bits.push('"' + f.q.trim() + '"');
    if (f.severities.length) bits.push("severity " + f.severities.join("/"));
    if (f.status !== "all") bits.push("status " + STATUS_LABEL[f.status].toLowerCase());
    if (f.service !== "all") bits.push(f.service);
    if (f.unassignedOnly) bits.push("unassigned only");
    return "Nothing in the queue matches " + bits.join(" + ") + ". Widen a filter or clear them all.";
  }

  function onRowKeydown(e) {
    var tr = e.currentTarget;
    var rows = state.rows;
    var index = -1;
    Array.prototype.forEach.call(el.body.querySelectorAll("tr"), function (r, i) {
      if (r === tr) index = i;
    });
    if (index === -1) return;

    var next = null;
    if (e.key === "ArrowDown") next = Math.min(index + 1, rows.length - 1);
    else if (e.key === "ArrowUp") next = Math.max(index - 1, 0);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = rows.length - 1;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      state.focusIndex = index;
      selectIncident(inc_id(tr));
      return;
    } else return;

    e.preventDefault();
    state.focusIndex = next;
    var target = el.body.querySelectorAll("tr")[next];
    if (target) {
      Array.prototype.forEach.call(el.body.querySelectorAll("tr"), function (r) { r.setAttribute("tabindex", "-1"); });
      target.setAttribute("tabindex", "0");
      target.focus();
    }
  }

  /* ------------------------------------------------------------------ *
   * Detail panel
   * ------------------------------------------------------------------ */

  function findIncident(id) {
    for (var i = 0; i < state.incidents.length; i++) {
      if (state.incidents[i].id === id) return state.incidents[i];
    }
    return null;
  }

  function selectIncident(id, restoreFocus) {
    var hadFocus = document.activeElement && document.activeElement.tagName === "TR" &&
      document.activeElement.parentNode === el.body;
    state.selectedId = id;
    renderTable();
    renderDetail();
    if (restoreFocus !== false && hadFocus === true) {
      var again = el.body.querySelector('tr[data-id="' + id + '"]');
      if (again) {
        Array.prototype.forEach.call(el.body.querySelectorAll("tr"), function (r) { r.setAttribute("tabindex", "-1"); });
        again.setAttribute("tabindex", "0");
        again.focus();
      }
    }
  }

  function timelineFor(inc) {
    var t = [];
    t.push({ at: inc.ageMinutes, text: "<b>Alert fired</b> — " + esc(inc.title.toLowerCase()) + " on " + esc(inc.service) });
    if (inc.ackedBy) {
      t.push({ at: Math.max(0, inc.ageMinutes - Math.max(2, Math.round(inc.ageMinutes * 0.2))), text: "Acknowledged by <b>" + esc(inc.ackedBy) + "</b>" });
    } else {
      t.push({ at: Math.max(0, inc.ageMinutes - 1), text: "Routed to " + (inc.owner === "Unassigned" ? "primary on-call rotation" : esc(inc.owner)) });
    }
    if (inc.status === "investigating") t.push({ at: Math.max(0, inc.ageMinutes - Math.max(1, Math.round(inc.ageMinutes * 0.5))), text: "Mitigation in progress, runbook <b>" + esc(inc.service.toUpperCase().replace(/-/g, "_")) + "_TRIAGE</b>" });
    if (inc.status === "monitoring") t.push({ at: 1, text: "Error budget recovering, watching error rate for 30 minutes" });
    if (inc.status === "resolved") t.push({ at: 0, text: "Resolved, awaiting post-incident review" });
    return t.sort(function (a, b) { return b.at - a.at; });
  }

  function renderDetail() {
    var inc = findIncident(state.selectedId);

    if (!inc) {
      el.detail.innerHTML =
        '<div class="detail__empty">' +
        "<p>Select an incident row to see runbook links, signal history and response actions.</p>" +
        '<p class="kbd-hint">Rows are focusable — Tab to the table, then ↑ ↓ to move and Enter to open.</p>' +
        "</div>";
      return;
    }

    var ackable = inc.status === "open";
    var open_ = inc.status !== "resolved" && inc.status !== "monitoring";

    var html = "";
    html += '<div class="detail__head">' +
      '<div class="detail__topline">' +
        '<span class="sev" data-sev="' + inc.severity + '">' + SEVERITY_LABEL[inc.severity] + "</span>" +
        '<span class="detail__id">' + esc(inc.id) + "</span>" +
        '<button type="button" class="detail__close" id="detailClose" aria-label="Clear selection">×</button>' +
      "</div>" +
      '<h3 class="detail__title">' + esc(inc.title) + "</h3>" +
      "</div>";

    html += '<dl class="kv">' +
      "<dt>Service</dt><dd>" + esc(inc.service) + "</dd>" +
      "<dt>Owner</dt><dd>" + (inc.owner === "Unassigned" ? '<span class="unassigned">Unassigned</span>' : esc(inc.owner)) + "</dd>" +
      "<dt>Age</dt><dd data-age-detail>" + esc(formatAge(inc.ageMinutes)) + "</dd>" +
      "<dt>Status</dt><dd>" + statusMarkup(inc) + "</dd>" +
      "<dt>Impact</dt><dd>" + impact(inc) + "</dd>" +
      "</dl>";

    html += '<div class="detail__section"><h3>Signal history</h3><ul class="timeline">' +
      timelineFor(inc).map(function (e) {
        return '<li><time>' + (e.at <= 0 ? "now" : "−" + esc(formatAge(e.at))) + "</time><p>" + e.text + "</p></li>";
      }).join("") + "</ul></div>";

    html += '<div class="detail__section"><h3>Runbook notes</h3><ul class="notes">' +
      notes(inc).map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></div>";

    if (ackable) {
      html += '<div class="actions">' +
        '<button type="button" class="btn btn--primary" data-action="acknowledge">Acknowledge</button>' +
        (inc.owner === "Unassigned" ? '<button type="button" class="btn" data-action="assign">Assign to me</button>' : "") +
        '<button type="button" class="btn" data-action="investigate">Investigate</button>' +
        '<button type="button" class="btn btn--ghost" data-action="snooze">Snooze 30m</button>' +
        "</div>";
    } else {
      html += '<div class="ack-state">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>' +
        "<p>Acknowledged by <b>" + esc(inc.ackedBy || "operator") + "</b>. No further acknowledgement needed. " +
        (open_ ? "Keep updating status as the investigation progresses." : "This incident is closed out.") + "</p>" +
        "</div>" +
        '<div class="actions">' +
        (inc.status !== "resolved" ? '<button type="button" class="btn" data-action="investigate">Investigate</button><button type="button" class="btn btn--ghost" data-action="resolve">Resolve</button>' : '<button type="button" class="btn btn--ghost" data-action="reopen">Reopen</button>') +
        (inc.owner === "Unassigned" ? '<button type="button" class="btn btn--ghost" data-action="assign">Assign to me</button>' : "") +
        "</div>";
    }

    el.detail.innerHTML = html;
  }

  function impact(inc) {
    if (inc.severity === "critical") return "Customer-visible, paging on-call";
    if (inc.severity === "high") return "Degraded path, SLO burn elevated";
    if (inc.severity === "medium") return "Internal quality signal, no paging";
    return "Background job, informational";
  }

  function notes(inc) {
    var n = ["Check dashboard " + inc.service + " · golden signals"];
    if (/payment|ledger|auth/i.test(inc.service)) n.push("Confirm no in-flight money movement is stuck");
    if (/router|stream|event/i.test(inc.service)) n.push("Compare consumer lag across partitions before scaling");
    if (/search|index/i.test(inc.service)) n.push("Verify replica health before triggering a reindex");
    if (/webhook|notification/i.test(inc.service)) n.push("Check upstream provider status page");
    n.push("Post an update in #relay-" + inc.service.replace(/[^a-z0-9]/gi, ""));
    return n;
  }

  /* ------------------------------------------------------------------ *
   * Actions
   * ------------------------------------------------------------------ */

  function updateStatus(id, status, message) {
    var inc = findIncident(id);
    if (!inc) return;
    inc.status = status;
    if (status === "acknowledged" || status === "investigating" || status === "monitoring") {
      if (!inc.ackedBy) inc.ackedBy = OPERATOR + " (you)";
    }
    if (status === "resolved") inc.ackedBy = inc.ackedBy || OPERATOR + " (you)";
    var acted = document.activeElement && document.activeElement.classList &&
      document.activeElement.hasAttribute("data-action");
    renderTable();
    renderDetail();
    renderHealth();
    toast(message || (inc.id + " set to " + STATUS_LABEL[status].toLowerCase()), status === "resolved" ? "ok" : "info");
    if (acted === true) {
      // The pressed button no longer exists; keep focus where the operator was.
      var next = el.detail.querySelector(".actions .btn") || el.detail;
      next.focus({ preventScroll: true });
    }
  }

  function toast(title, kind, sub) {
    var t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("data-kind", kind || "info");
    t.innerHTML = "<strong>" + esc(title) + "</strong>" + (sub ? "<span>" + esc(sub) + "</span>" : "");
    el.toasts.appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity 160ms linear, transform 160ms linear";
      t.style.opacity = "0";
      t.style.transform = "translateY(4px)";
      setTimeout(function () { t.remove(); }, 180);
    }, 2600);
  }

  function renderHealth() {
    var crit = state.incidents.filter(function (i) { return i.severity === "critical" && i.status !== "resolved"; }).length;
    var high = state.incidents.filter(function (i) { return i.severity === "high" && i.status !== "resolved"; }).length;
    var st = crit ? "critical" : high ? "degraded" : "ok";
    var label = crit
      ? "Degraded · " + crit + " critical"
      : high
        ? "Degraded · " + high + " high"
        : "All services nominal";
    el.health.setAttribute("data-state", st);
    el.health.querySelector(".health__label").textContent = label;
  }

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */

  function setTheme(theme, announce) {
    document.documentElement.setAttribute("data-theme", theme);
    el.themeBtn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    el.themeBtn.setAttribute("title", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    el.themeBtn.querySelector("use").setAttribute("href", theme === "dark" ? "#i-moon" : "#i-sun");
    try { localStorage.setItem(STORE_KEY, theme); } catch (e) { /* private mode */ }
    if (announce) toast(theme === "dark" ? "Dark theme" : "Light theme", "info");
  }

  /* ------------------------------------------------------------------ *
   * Chrome: clock + age ticking
   * ------------------------------------------------------------------ */

  function startClock() {
    function paint() {
      var d = new Date();
      el.clockTime.textContent = [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()]
        .map(function (n) { return String(n).padStart(2, "0"); })
        .join(":");
    }
    paint();
    setInterval(paint, 1000);
  }

  function startAgeTicker() {
    setInterval(function () {
      state.incidents.forEach(function (inc) {
        inc.ageMinutes = inc.baseAge + Math.round((Date.now() - START) / 60000);
      });
      var cells = el.body.querySelectorAll("[data-age-cell]");
      Array.prototype.forEach.call(cells, function (c) {
        var inc = findIncident(c.getAttribute("data-age-cell"));
        if (inc) c.textContent = formatAge(inc.ageMinutes);
      });
      var d = el.detail.querySelector("[data-age-detail]");
      var sel = findIncident(state.selectedId);
      if (d && sel) d.textContent = formatAge(sel.ageMinutes);
    }, 30000);
  }

  var START = Date.now();

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  function renderSeverityChips() {
    var levels = [
      { key: "critical", label: "Critical" },
      { key: "high", label: "High" },
      { key: "medium", label: "Medium" },
      { key: "low", label: "Low" }
    ];
    el.chips.innerHTML = levels.map(function (l) {
      return '<button type="button" class="chip" data-sev="' + l.key + '" aria-pressed="false">' +
        '<span class="chip__sw" aria-hidden="true"></span>' + l.label + "</button>";
    }).join("");

    el.chips.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;
      var key = btn.getAttribute("data-sev");
      var idx = state.filters.severities.indexOf(key);
      if (idx === -1) state.filters.severities.push(key);
      else state.filters.severities.splice(idx, 1);
      btn.setAttribute("aria-pressed", idx === -1 ? "true" : "false");
      renderTable();
    });
  }

  function renderServiceOptions() {
    var services = state.incidents
      .map(function (i) { return i.service; })
      .filter(function (s, i, a) { return a.indexOf(s) === i; })
      .sort();
    el.serviceFilter.innerHTML = '<option value="all">All services</option>' +
      services.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + "</option>"; }).join("");
  }

  function syncSortHeaders() {
    var ths = el.table.querySelectorAll("thead th");
    Array.prototype.forEach.call(ths, function (th) {
      var btn = th.querySelector(".sortbtn");
      if (!btn) return;
      if (btn.getAttribute("data-sort") === state.sort.key) {
        th.setAttribute("aria-sort", state.sort.dir === "asc" ? "ascending" : "descending");
      } else {
        th.setAttribute("aria-sort", "none");
      }
    });
  }

  function bind() {
    el.searchInput.addEventListener("input", function () {
      state.filters.q = el.searchInput.value;
      renderTable();
    });

    el.statusFilter.addEventListener("change", function () {
      state.filters.status = el.statusFilter.value;
      renderTable();
    });

    el.serviceFilter.addEventListener("change", function () {
      state.filters.service = el.serviceFilter.value;
      renderTable();
    });

    el.unassignedOnly.addEventListener("change", function () {
      state.filters.unassignedOnly = el.unassignedOnly.checked;
      renderTable();
    });

    el.hideResolved.addEventListener("change", function () {
      state.filters.hideResolved = el.hideResolved.checked;
      renderTable();
    });

    function clearAll() {
      state.filters = { q: "", severities: [], status: "all", service: "all", unassignedOnly: false, hideResolved: true };
      el.searchInput.value = "";
      el.statusFilter.value = "all";
      el.serviceFilter.value = "all";
      el.unassignedOnly.checked = false;
      el.hideResolved.checked = true;
      Array.prototype.forEach.call(el.chips.querySelectorAll(".chip"), function (c) {
        c.setAttribute("aria-pressed", "false");
      });
      renderTable();
      toast("Filters cleared", "info");
    }

    el.clearFilters.addEventListener("click", clearAll);
    el.emptyClear.addEventListener("click", clearAll);

    el.table.querySelector("thead").addEventListener("click", function (e) {
      var btn = e.target.closest(".sortbtn");
      if (!btn) return;
      var key = btn.getAttribute("data-sort");
      if (state.sort.key === key) {
        state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
      } else {
        state.sort.key = key;
        state.sort.dir = key === "age" ? "desc" : "asc";
      }
      syncSortHeaders();
      renderTable();
    });

    el.detail.addEventListener("click", function (e) {
      if (e.target.id === "detailClose") {
        state.selectedId = null;
        renderTable();
        renderDetail();
        var first = el.body.querySelector('tr[tabindex="0"]');
        if (first) first.focus();
        return;
      }
      var btn = e.target.closest("[data-action]");
      if (!btn) return;
      var id = state.selectedId;
      var inc = findIncident(id);
      if (!inc) return;

      switch (btn.getAttribute("data-action")) {
        case "acknowledge":
          updateStatus(id, "acknowledged", inc.id + " acknowledged by you");
          break;
        case "investigate":
          updateStatus(id, "investigating", inc.id + " moved to investigating");
          break;
        case "resolve":
          updateStatus(id, "resolved", inc.id + " resolved");
          break;
        case "reopen":
          updateStatus(id, "open", inc.id + " reopened");
          break;
        case "assign":
          inc.owner = OPERATOR + " (you)";
          renderTable();
          renderDetail();
          toast(inc.id + " assigned to you", "ok");
          break;
        case "snooze":
          toast(inc.id + " snoozed for 30 minutes", "warn", "You will be paged again at the next escalation window.");
          break;
      }
    });

    el.themeBtn.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      setTheme(next, false);
    });

    el.notifyBtn.addEventListener("click", function () {
      var open = state.incidents.filter(function (i) { return i.status === "open"; }).length;
      toast(open + " incidents awaiting acknowledgement", open ? "warn" : "ok", "Rotation: " + OPERATOR);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== el.searchInput && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        el.searchInput.focus();
        el.searchInput.select();
      }
      if (e.key === "Escape" && document.activeElement === el.searchInput) {
        el.searchInput.value = "";
        state.filters.q = "";
        renderTable();
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Init
   * ------------------------------------------------------------------ */

  function cache() {
    el.metrics = $("metrics");
    el.chartWrap = $("chartWrap");
    el.chartTip = $("chartTip");
    el.chartPeak = $("chartPeak");
    el.chartMean = $("chartMean");
    el.chartTotal = $("chartTotal");
    el.resultCount = $("resultCount");
    el.table = $("incidentTable");
    el.body = $("incidentBody");
    el.emptyState = $("emptyState");
    el.emptyDesc = $("emptyDesc");
    el.emptyClear = $("emptyClear");
    el.allClear = $("allClear");
    el.detail = $("detailPanel");
    el.searchInput = $("searchInput");
    el.statusFilter = $("statusFilter");
    el.serviceFilter = $("serviceFilter");
    el.unassignedOnly = $("unassignedOnly");
    el.hideResolved = $("hideResolved");
    el.clearFilters = $("clearFilters");
    el.chips = $("severityChips");
    el.themeBtn = $("themeBtn");
    el.notifyBtn = $("notifyBtn");
    el.railBadge = $("railBadge");
    el.clockTime = $("clockTime");
    el.health = $("healthPill");
    el.toasts = $("toasts");
  }

  function init() {
    cache();

    var stored = null;
    try { stored = localStorage.getItem(STORE_KEY); } catch (e) { /* ignore */ }
    setTheme(stored === "light" ? "light" : "dark", false);

    startClock();

    load().then(function (data) {
      state.metrics = data.metrics;
      state.throughput = data.throughput;
      state.incidents = data.incidents;

      renderMetrics();
      renderChart();
      renderSeverityChips();
      renderServiceOptions();
      syncSortHeaders();
      renderTable();
      renderDetail();
      renderHealth();
      bind();
      startAgeTicker();

      // Pre-open the most severe unresolved incident so the panel is never blank
      // on first paint.
      if (state.rows.length) selectIncident(state.rows[0].id);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
