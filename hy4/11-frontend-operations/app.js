/* Relay — operations control room
 * No frameworks, no build, no network. The dashboard is seeded inline from
 * DATA.json (the object below is a verbatim copy of that file) so the page
 * works when opened directly via file:// without any fetch/XHR request.
 */
(function () {
  "use strict";

  var DATA = {
    "metrics": [
      {"label":"Events / min","value":"18,420","change":"+8.2%","direction":"up"},
      {"label":"P95 latency","value":"184 ms","change":"−12 ms","direction":"down"},
      {"label":"Error rate","value":"0.37%","change":"+0.08 pp","direction":"up"},
      {"label":"Queue depth","value":"2,841","change":"−19%","direction":"down"}
    ],
    "throughput": [31,28,24,22,20,23,34,48,62,71,76,73,68,72,80,84,79,75,82,88,77,63,52,41],
    "incidents": [
      {"id":"INC-2841","severity":"critical","service":"payments-api","age":"12m","owner":"M. Chen","status":"investigating","title":"Card authorization timeouts"},
      {"id":"INC-2839","severity":"high","service":"event-router","age":"31m","owner":"Unassigned","status":"open","title":"EU retry queue growth"},
      {"id":"INC-2837","severity":"medium","service":"search-index","age":"1h 08m","owner":"A. Silva","status":"monitoring","title":"Index freshness outside SLO"},
      {"id":"INC-2832","severity":"low","service":"webhooks","age":"3h 42m","owner":"R. Patel","status":"open","title":"Elevated partner delivery lag"}
    ]
  };

  /* State is a working copy so acknowledge mutates real state. */
  var incidents = DATA.incidents.map(function (i) {
    return {
      id: i.id, severity: i.severity, service: i.service, age: i.age,
      owner: i.owner, status: i.status, title: i.title, ackAt: null
    };
  });

  var selectedId = null;
  var filters = { search: "", severity: "all", status: "all" };

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  /* ---------- Metrics ---------- */
  function renderMetrics() {
    /* Context + "bad direction" logic: up is bad for error rate, good for
       throughput; down is good everywhere else. */
    var badForUp = { "Error rate": true };
    var context = {
      "Events / min": "vs. prior 24h",
      "P95 latency": "vs. prior 24h",
      "Error rate": "vs. prior 24h",
      "Queue depth": "vs. prior 24h"
    };
    var html = DATA.metrics.map(function (m) {
      var isBad = m.direction === "up" && badForUp[m.label];
      var flagged = isBad || m.label === "Error rate";
      var arrow = m.direction === "up" ? "▲" : "▼";
      var cls = isBad ? "trend-bad" : (m.direction === "up" ? "trend-up" : "trend-down");
      return '<article class="metric' + (flagged ? ' is-flagged' : '') + '">' +
        '<div class="metric-label">' + esc(m.label) + '</div>' +
        '<div class="metric-value">' + esc(m.value) + '</div>' +
        '<div class="metric-trend ' + cls + '">' +
          '<span class="trend-arrow" aria-hidden="true">' + arrow + '</span>' +
          '<span>' + esc(m.change) + '</span>' +
          '<span class="metric-context">' + esc(context[m.label]) + '</span>' +
        '</div>' +
      '</article>';
    }).join("");
    $("overview").innerHTML = html;
  }

  /* ---------- 24h throughput chart (inline SVG) ---------- */
  function renderChart() {
    var vals = DATA.throughput;
    var W = 760, H = 190;
    var padL = 34, padR = 12, padT = 12, padB = 26;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var maxV = 100;
    var step = plotW / (vals.length - 1);
    var x = function (i) { return padL + i * step; };
    var y = function (v) { return padT + (1 - v / maxV) * plotH; };

    var parts = [];

    /* horizontal gridlines + y-axis labels */
    [100, 75, 50, 25, 0].forEach(function (g) {
      var gy = y(g);
      parts.push('<line class="grid-line" x1="' + padL + '" y1="' + gy.toFixed(1) +
                 '" x2="' + (W - padR) + '" y2="' + gy.toFixed(1) + '"/>');
      parts.push('<text class="axis-label" x="' + (padL - 8) + '" y="' + (gy + 3).toFixed(1) +
                 '" text-anchor="end">' + g + '</text>');
    });

    /* x-axis hour labels every 4 hours + last point */
    var labelIdx = [0, 4, 8, 12, 16, 20, 23];
    labelIdx.forEach(function (i) {
      var lx = x(i);
      var anchor = i === 0 ? "start" : (i === 23 ? "end" : "middle");
      var hh = (i < 10 ? "0" : "") + i + ":00";
      parts.push('<text class="axis-label" x="' + lx.toFixed(1) + '" y="' + (H - 8) +
                 '" text-anchor="' + anchor + '">' + hh + '</text>');
    });

    /* area + line */
    var linePts = vals.map(function (v, i) { return x(i).toFixed(1) + "," + y(v).toFixed(1); });
    var baseline = (padT + plotH).toFixed(1);
    var areaD = "M" + x(0).toFixed(1) + "," + baseline +
                " L" + linePts.join(" L") +
                " L" + x(vals.length - 1).toFixed(1) + "," + baseline + " Z";
    parts.push('<path class="chart-area" d="' + areaD + '"/>');
    parts.push('<polyline class="chart-line" points="' + linePts.join(" ") + '"/>');

    /* peak marker + annotation */
    var peak = Math.max.apply(null, vals);
    var peakIdx = vals.indexOf(peak);
    parts.push('<circle class="chart-dot" cx="' + x(peakIdx).toFixed(1) +
               '" cy="' + y(peak).toFixed(1) + '" r="3.5"/>');
    var pkx = Math.min(x(peakIdx) - 4, W - padR - 70);
    parts.push('<text class="chart-peak-label" x="' + pkx.toFixed(1) +
               '" y="' + (y(peak) - 9).toFixed(1) + '">Peak ' + peak + 'k · 19:00</text>');

    $("throughput-chart").innerHTML = parts.join("");

    /* summary stats */
    var min = Math.min.apply(null, vals);
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    var stats = [
      ["Peak", peak + "k / min"],
      ["Trough", min + "k / min"],
      ["24h mean", mean.toFixed(1) + "k / min"],
      ["Last hour", vals[vals.length - 1] + "k / min"]
    ];
    $("chart-stats").innerHTML = stats.map(function (s) {
      return '<div><div class="cstat-label">' + s[0] + '</div>' +
             '<div class="cstat-value">' + s[1] + '</div></div>';
    }).join("");
  }

  /* ---------- Filtering ---------- */
  function getVisible() {
    var q = filters.search.trim().toLowerCase();
    return incidents.filter(function (i) {
      if (filters.severity !== "all" && i.severity !== filters.severity) return false;
      if (filters.status !== "all" && i.status !== filters.status) return false;
      if (q) {
        var hay = [i.id, i.service, i.owner, i.title, i.status].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function sevBadge(sev) {
    return '<span class="sev sev--' + sev + '">' + esc(sev) + '</span>';
  }
  function statusCell(st) {
    return '<span class="status status--' + st + '"><span class="status-dot" aria-hidden="true"></span>' +
           esc(st.charAt(0).toUpperCase() + st.slice(1)) + '</span>';
  }

  function renderIncidents(restoreFocus) {
    var visible = getVisible();
    var tbody = $("incident-rows");
    var empty = $("incidents-empty");

    tbody.innerHTML = visible.map(function (i) {
      var unassigned = i.owner === "Unassigned";
      return '<tr data-id="' + esc(i.id) + '" tabindex="0" aria-selected="' +
        (i.id === selectedId) + '" class="' + (i.id === selectedId ? "is-selected" : "") + '">' +
        '<td><span class="cell-id">' + esc(i.id) + '</span>' +
            '<span class="cell-title">' + esc(i.title) + '</span></td>' +
        '<td>' + sevBadge(i.severity) + '</td>' +
        '<td><span class="cell-service">' + esc(i.service) + '</span></td>' +
        '<td class="cell-age">' + esc(i.age) + '</td>' +
        '<td><span class="cell-owner' + (unassigned ? ' is-unassigned' : '') + '">' + esc(i.owner) + '</span></td>' +
        '<td>' + statusCell(i.status) + '</td>' +
      '</tr>';
    }).join("");

    empty.hidden = visible.length !== 0;
    $("result-count").textContent = visible.length + " of " + incidents.length + " shown";

    if (restoreFocus && selectedId) {
      var row = tbody.querySelector('tr[data-id="' + selectedId + '"]');
      if (row) row.focus();
    }
  }

  /* ---------- Detail panel ---------- */
  function renderDetail() {
    var el = $("detail-content");
    var i = incidents.filter(function (x) { return x.id === selectedId; })[0];

    if (!i) {
      el.innerHTML = '<div class="detail-placeholder">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1"/><line x1="9" y1="4" x2="9" y2="20"/></svg>' +
        '<div>Select an incident to view its detail.</div></div>';
      return;
    }

    var acknowledged = i.status === "acknowledged";
    var unassigned = i.owner === "Unassigned";
    var rows = [
      ["Service", esc(i.service), ""],
      ["Severity", esc(i.severity.charAt(0).toUpperCase() + i.severity.slice(1)), ""],
      ["Age", esc(i.age), ""],
      ["Owner", esc(i.owner), unassigned ? " is-unassigned" : ""],
      ["Status", esc(i.status.charAt(0).toUpperCase() + i.status.slice(1)), ""]
    ];

    var html =
      '<div class="detail-body">' +
        '<div class="detail-kicker">' + esc(i.id) + '</div>' +
        '<h3 class="detail-title">' + esc(i.title) + '</h3>' +
        '<div class="detail-sev-row">' + sevBadge(i.severity) + statusCell(i.status) + '</div>' +
        '<dl class="detail-grid">' +
          rows.map(function (r) {
            return '<div class="detail-row"><dt>' + r[0] + '</dt><dd class="' + r[2].trim() + '">' + r[1] + '</dd></div>';
          }).join("") +
        '</dl>' +
        '<p class="detail-note">Acknowledging assigns this incident to you (on-call) and records it in the triage log. It does not resolve the incident.</p>' +
        '<div class="detail-actions">' +
          '<button type="button" class="btn-primary" id="ack-btn"' + (acknowledged ? ' disabled' : '') + '>' +
            (acknowledged ? 'Acknowledged' : 'Acknowledge incident') +
          '</button>' +
        '</div>' +
        (acknowledged ? '<p class="ack-msg" role="status">Acknowledged' +
            (i.ackAt ? ' at ' + esc(i.ackAt) : '') + ' · assigned to you (on-call).</p>' : '') +
      '</div>';
    el.innerHTML = html;

    var btn = $("ack-btn");
    if (btn && !acknowledged) {
      btn.addEventListener("click", function () { acknowledge(i.id); });
    }
  }

  function acknowledge(id) {
    var i = incidents.filter(function (x) { return x.id === id; })[0];
    if (!i || i.status === "acknowledged") return;
    i.status = "acknowledged";
    i.owner = "You (on-call)";
    i.ackAt = new Date().toISOString().slice(11, 16) + " UTC";
    renderIncidents(false);
    renderDetail();
    $("sr-status").textContent = i.id + " acknowledged and assigned to you.";
  }

  function selectIncident(id, fromRow) {
    selectedId = id;
    renderIncidents(false);
    renderDetail();
    if (!fromRow) {
      /* keep detail visible on small screens */
      if (window.innerWidth <= 1080) {
        $("detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }

  /* ---------- Status bar ---------- */
  function updateHealth() {
    var critical = incidents.filter(function (i) {
      return i.severity === "critical" && i.status !== "resolved";
    }).length;
    var active = incidents.filter(function (i) { return i.status !== "resolved"; }).length;
    var dot = $("health-dot"), label = $("health");
    if (critical > 0) {
      dot.className = "health-dot health--warn";
      label.textContent = "Degraded · " + critical + " critical";
    } else {
      dot.className = "health-dot health--ok";
      label.textContent = "All systems nominal";
    }
    $("active-count").textContent = active;
  }

  function tickClock() {
    var t = new Date().toISOString().slice(11, 19);
    $("clock").textContent = t + " UTC";
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    /* table: click + keyboard selection */
    var tbody = $("incident-rows");
    tbody.addEventListener("click", function (e) {
      var tr = e.target.closest("tr[data-id]");
      if (tr) selectIncident(tr.getAttribute("data-id"), true);
    });
    tbody.addEventListener("keydown", function (e) {
      var tr = e.target.closest("tr[data-id]");
      if (!tr) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectIncident(tr.getAttribute("data-id"), true);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr[data-id]"));
        var idx = rows.indexOf(tr);
        var next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
        if (next >= 0 && next < rows.length) rows[next].focus();
      }
    });

    /* filters */
    $("search").addEventListener("input", function (e) {
      filters.search = e.target.value; renderIncidents(false);
      $("sr-status").textContent = $("result-count").textContent;
    });
    $("severity").addEventListener("change", function (e) {
      filters.severity = e.target.value; renderIncidents(false);
      $("sr-status").textContent = $("result-count").textContent;
    });
    $("status").addEventListener("change", function (e) {
      filters.status = e.target.value; renderIncidents(false);
      $("sr-status").textContent = $("result-count").textContent;
    });
    function clearFilters() {
      filters = { search: "", severity: "all", status: "all" };
      $("search").value = ""; $("severity").value = "all"; $("status").value = "all";
      renderIncidents(false);
      $("sr-status").textContent = "Filters cleared. " + $("result-count").textContent;
      $("search").focus();
    }
    $("clear-filters").addEventListener("click", clearFilters);
    $("empty-clear").addEventListener("click", clearFilters);

    /* nav rail: scroll + focus target, reflect current */
    Array.prototype.forEach.call(document.querySelectorAll(".rail-btn"), function (btn) {
      btn.addEventListener("click", function () {
        var target = document.querySelector(btn.getAttribute("data-target"));
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        target.focus({ preventScroll: true });
        Array.prototype.forEach.call(document.querySelectorAll(".rail-btn"), function (b) {
          b.removeAttribute("aria-current");
        });
        btn.setAttribute("aria-current", "page");
      });
    });
  }

  /* ---------- Init ---------- */
  renderMetrics();
  renderChart();
  renderIncidents(false);
  renderDetail();
  updateHealth();
  bindEvents();
  tickClock();
  setInterval(tickClock, 1000);

  /* default selection: the most severe incident */
  selectIncident(incidents[0].id, true);
})();
