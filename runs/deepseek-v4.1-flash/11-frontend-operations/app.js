/* ==========================================================================
   Relay — operations control room
   Local-only application logic. Data is seeded from DATA.json; no requests
   are made and no remote resources are used.
   ========================================================================== */

(function () {
  "use strict";

  var OPERATOR = { name: "D. Okafor", initials: "DO" };

  /* Metrics, throughput and the first four incidents come from DATA.json.
     The remaining incidents extend the demo queue with realistic states. */
  var SEED = {
    metrics: [
      { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up" },
      { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down" },
      { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up" },
      { label: "Queue depth", value: "2,841", change: "−19%", direction: "down" }
    ],
    throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    incidents: [
      { id: "INC-2841", severity: "critical", service: "payments-api", age: "12m", owner: "M. Chen", status: "investigating", title: "Card authorization timeouts", region: "us-east-1", impact: "1,240 req/min", burn: "6.4×" },
      { id: "INC-2839", severity: "high", service: "event-router", age: "31m", owner: "Unassigned", status: "open", title: "EU retry queue growth", region: "eu-west-1", impact: "380 req/min", burn: "2.1×" },
      { id: "INC-2837", severity: "medium", service: "search-index", age: "1h 08m", owner: "A. Silva", status: "monitoring", title: "Index freshness outside SLO", region: "us-east-1", impact: "Search p95 +210 ms", burn: "1.3×" },
      { id: "INC-2832", severity: "low", service: "webhooks", age: "3h 42m", owner: "R. Patel", status: "open", title: "Elevated partner delivery lag", region: "us-east-1", impact: "42 partners", burn: "0.4×" }
    ],
    extraIncidents: [
      { id: "INC-2829", severity: "high", service: "auth-gateway", age: "42m", owner: "K. Novak", status: "open", title: "Token refresh failures in EU", region: "eu-west-1", impact: "610 req/min", burn: "2.8×" },
      { id: "INC-2826", severity: "medium", service: "checkout-web", age: "1h 24m", owner: "J. Park", status: "investigating", title: "Cart totals mismatch on retries", region: "us-east-1", impact: "96 checkout sessions", burn: "0.9×" },
      { id: "INC-2824", severity: "low", service: "notification-worker", age: "2h 11m", owner: "S. Ibrahim", status: "acknowledged", title: "Digest delivery backlog", region: "us-east-1", impact: "18k queued jobs", burn: "0.3×" },
      { id: "INC-2819", severity: "low", service: "search-index", age: "6h 30m", owner: "A. Silva", status: "resolved", title: "Stale shard replica", region: "us-east-1", impact: "No active impact", burn: "0.0×" },
      { id: "INC-2811", severity: "medium", service: "data-pipeline", age: "9h 12m", owner: "Unassigned", status: "open", title: "Schema drift in clickstream rollup", region: "eu-west-1", impact: "2.4k rows/min", burn: "1.1×" }
    ]
  };

  var SEVERITIES = ["critical", "high", "medium", "low"];
  var SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
  var SEVERITY_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
  var STATUSES = ["open", "investigating", "monitoring", "acknowledged", "resolved"];
  var STATUS_RANK = { open: 0, investigating: 1, monitoring: 2, acknowledged: 3, resolved: 4 };
  var STATUS_LABEL = { open: "Open", investigating: "Investigating", monitoring: "Monitoring", acknowledged: "Acknowledged", resolved: "Resolved" };

  var METRIC_META = [
    { tone: "good", context: "vs prior 24h", spark: [42, 45, 44, 49, 52, 51, 56, 59, 57, 62] },
    { tone: "good", context: "target < 200 ms", spark: [43, 41, 42, 38, 37, 36, 33, 31, 29, 27] },
    { tone: "bad", context: "SLO 0.50%", spark: [12, 14, 13, 16, 18, 17, 20, 21, 23, 25] },
    { tone: "good", context: "6 consumers · draining", spark: [46, 44, 45, 41, 39, 36, 34, 30, 27, 24] }
  ];

  var state = {
    incidents: [],
    filters: { q: "", severity: "all", status: "all", service: "all" },
    sort: { key: "severity", dir: "asc" },
    selectedId: null,
    lastUpdate: Date.now(),
    chartIndex: 0
  };

  var mobileQuery = window.matchMedia("(max-width: 759px)");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var el = {};

  /* ------------------------------------------------------------------ utils */

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function parseAge(age) {
    var hours = age.match(/(\d+)\s*h/);
    var minutes = age.match(/(\d+)\s*m/);
    var total = 0;
    if (hours) total += Number(hours[1]) * 60;
    if (minutes) total += Number(minutes[1]);
    return total || 1;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatTime(timestamp) {
    var date = new Date(timestamp);
    return pad(date.getUTCHours()) + ":" + pad(date.getUTCMinutes());
  }

  function formatHour(timestamp) {
    var date = new Date(timestamp);
    return pad(date.getUTCHours()) + ":00";
  }

  function relative(timestamp) {
    var seconds = Math.max(0, (Date.now() - timestamp) / 1000);
    if (seconds < 45) return "just now";
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return rest ? hours + "h " + pad(rest) + "m ago" : hours + "h ago";
  }

  function initials(name) {
    return String(name)
      .replace(/\./g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map(function (part) { return part.charAt(0); })
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function scrollBehavior() {
    return reducedMotion.matches ? "auto" : "smooth";
  }

  /* ------------------------------------------------------------------- data */

  function buildTimeline(incident, startedAt) {
    var minutes = incident.minutes;
    var events = [];

    function add(offset, actor, text, kind) {
      var safeOffset = Math.min(offset, Math.max(0, minutes - 0.5));
      events.push({
        at: startedAt + safeOffset * 60000,
        actor: actor,
        text: text,
        kind: kind || "note"
      });
    }

    add(0, "Relay", "alert fired — " + incident.title, "alert");
    add(0.5, "Router", "paged " + incident.service + " on-call", "page");

    if (incident.status !== "open") {
      var ackActor = incident.owner === "Unassigned" ? "On-call" : incident.owner;
      add(2, ackActor, "acknowledged the page", "ack");
    }

    if (incident.status === "investigating") {
      add(4, incident.owner === "Unassigned" ? "On-call" : incident.owner, "started investigation — trace sampling enabled", "work");
    } else if (incident.status === "monitoring") {
      add(5, incident.owner, "applied mitigation — error rate trending down", "work");
      add(9, "Relay", "entered monitoring against the service SLO", "note");
    } else if (incident.status === "resolved") {
      add(5, incident.owner, "applied mitigation — error rate recovered", "work");
      add(Math.max(6, minutes - 3), "Relay", "resolution confirmed — metrics inside SLO", "resolved");
    }

    events.sort(function (a, b) { return b.at - a.at; });
    return events;
  }

  function buildIncidents() {
    var raw = SEED.incidents.concat(SEED.extraIncidents);
    var now = Date.now();

    state.incidents = raw.map(function (incident) {
      var minutes = parseAge(incident.age);
      var startedAt = now - minutes * 60000;
      var copy = Object.assign({}, incident, {
        minutes: minutes,
        startedAt: startedAt,
        impact: incident.impact || "—",
        burn: incident.burn || "—",
        region: incident.region || "us-east-1",
        acknowledgedBy: null,
        timeline: []
      });
      copy.timeline = buildTimeline(copy, startedAt);
      var ackEvent = copy.timeline.find(function (event) { return event.kind === "ack"; });
      if (ackEvent) copy.acknowledgedBy = ackEvent.actor;
      return copy;
    });
  }

  function selectedIncident() {
    return state.incidents.find(function (incident) { return incident.id === state.selectedId; }) || null;
  }

  function activeIncidents() {
    return state.incidents.filter(function (incident) { return incident.status !== "resolved"; });
  }

  /* ----------------------------------------------------------------- render */

  function sparkline(values, tone) {
    var width = 64;
    var height = 20;
    var pad = 2;
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var span = max - min || 1;
    var points = values.map(function (value, index) {
      var x = (index / (values.length - 1)) * width;
      var y = height - pad - ((value - min) / span) * (height - pad * 2);
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");

    return '<svg class="spark spark--' + tone + '" viewBox="0 0 64 20" aria-hidden="true" focusable="false">' +
      '<polyline class="spark-line" points="' + points + '"></polyline>' +
      "</svg>";
  }

  function renderMetrics() {
    el.metricGrid.innerHTML = SEED.metrics.map(function (metric, index) {
      var meta = METRIC_META[index];
      var arrow = metric.direction === "up" ? "up" : "down";
      var favorability = meta.tone === "good" ? "favorable" : "unfavorable";

      return '<article class="metric">' +
        '<div class="metric-top">' +
          '<span class="metric-label">' + esc(metric.label) + "</span>" +
          sparkline(meta.spark, meta.tone) +
        "</div>" +
        '<p class="metric-value">' + esc(metric.value) + "</p>" +
        '<div class="metric-foot">' +
          '<span class="delta delta--' + meta.tone + '">' +
            '<svg class="icon" aria-hidden="true"><use href="#i-' + arrow + '"></use></svg>' +
            esc(metric.change) +
            '<span class="visually-hidden">, ' + favorability + '</span>' +
          "</span>" +
          '<span class="metric-context">' + esc(meta.context) + "</span>" +
        "</div>" +
      "</article>";
    }).join("");
  }

  function chartHours() {
    var now = new Date();
    var end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours());
    var hours = [];
    for (var i = 23; i >= 0; i -= 1) hours.push(end - i * 3600000);
    return hours;
  }

  function renderChart() {
    var values = SEED.throughput;
    var hours = chartHours();
    var max = 100;

    el.chartY.innerHTML = [100, 75, 50, 25, 0].map(function (tick) {
      var style = "top:" + (100 - tick) + "%";
      if (tick === 0) style += ";transform:translateY(-100%)";
      return '<span class="y-tick" style="' + style + '">' + tick + "</span>";
    }).join("");

    el.chartGrid.innerHTML = [100, 75, 50, 25].map(function (tick) {
      return '<span class="grid-line" style="top:' + (100 - tick) + '%"></span>';
    }).join("");

    el.chartBars.innerHTML = values.map(function (value, index) {
      var height = Math.max(2, (value / max) * 100);
      var time = formatHour(hours[index]);
      var isLast = index === values.length - 1;
      var label = time + " — ingest load " + value + " of 100" +
        (value > 80 ? ", above the saturation threshold" : "");
      var classes = "bar-col";
      if (value > 80) classes += " is-hot";
      if (isLast) classes += " is-now";

      return '<button class="' + classes + '" type="button" data-index="' + index + '" tabindex="-1" ' +
        'style="--h:' + height.toFixed(2) + '%" aria-label="' + esc(label) + '">' +
        '<span class="bar' + (value > 80 ? " bar--hot" : "") + (isLast ? " bar--now" : "") + '" aria-hidden="true"></span>' +
        '<span class="bar-tip" aria-hidden="true"><span>' + time + "</span><strong>" + value + "</strong></span>" +
      "</button>";
    }).join("");

    el.chartX.innerHTML = values.map(function (value, index) {
      var isLast = index === values.length - 1;
      var showLabel = index % 6 === 0 || isLast;
      var label = isLast ? "now" : formatHour(hours[index]);
      var classes = "x-label" + (isLast ? " x-label--now" : "");
      return '<span class="x-slot">' + (showLabel ? '<span class="' + classes + '">' + label + "</span>" : "") + "</span>";
    }).join("");

    var peak = Math.max.apply(null, values);
    var peakIndex = values.indexOf(peak);
    var sum = values.reduce(function (total, value) { return total + value; }, 0);

    el.statPeak.textContent = String(peak);
    el.statPeakAt.textContent = formatHour(hours[peakIndex]);
    el.statAvg.textContent = (sum / values.length).toFixed(1);
    el.statNow.textContent = String(values[values.length - 1]);
    el.statNowAt.textContent = formatHour(hours[values.length - 1]);

    setChartTabindex(values.length - 1);
    state.chartIndex = values.length - 1;
    updateChartClasses(values.length - 1);
  }

  function setChartTabindex(index) {
    var bars = el.chartBars.querySelectorAll(".bar-col");
    for (var i = 0; i < bars.length; i += 1) {
      bars[i].tabIndex = i === index ? 0 : -1;
    }
  }

  function updateChartClasses(index) {
    var bars = el.chartBars.querySelectorAll(".bar-col");
    for (var i = 0; i < bars.length; i += 1) {
      bars[i].classList.toggle("is-active", i === index);
    }
  }

  function announceChart(bar) {
    var index = Number(bar.dataset.index);
    var value = SEED.throughput[index];
    var hours = chartHours();
    state.chartIndex = index;
    setChartTabindex(index);
    updateChartClasses(index);
    el.chartStatus.textContent = formatHour(hours[index]) + " — ingest load " + value + " of 100" +
      (value > 80 ? ", above the saturation threshold" : "");
  }

  function ownerCell(owner) {
    if (!owner || owner === "Unassigned") {
      return '<span class="owner-cell owner-cell--empty">' +
        '<span class="avatar" aria-hidden="true">—</span>' +
        '<span class="owner-name">Unassigned</span></span>';
    }
    return '<span class="owner-cell">' +
      '<span class="avatar" aria-hidden="true">' + esc(initials(owner)) + "</span>" +
      '<span class="owner-name">' + esc(owner) + "</span></span>";
  }

  function statusPill(status) {
    return '<span class="status-pill status--' + status + '">' +
      '<span class="status-dot" aria-hidden="true"></span>' + STATUS_LABEL[status] + "</span>";
  }

  function incidentRow(incident) {
    var selected = incident.id === state.selectedId;
    return '<tr class="incident-row sev-' + incident.severity + (selected ? " is-selected" : "") + '" data-id="' + esc(incident.id) + '">' +
      '<td class="cell-severity"><span class="sev-badge"><span class="sev-dot" aria-hidden="true"></span>' +
        SEVERITY_LABEL[incident.severity] + "</span></td>" +
      '<td class="cell-incident"><button class="row-open" type="button" title="' + esc(incident.title) + '" ' +
        'aria-label="Open ' + esc(incident.id) + ", " + esc(incident.title) + ". " +
        SEVERITY_LABEL[incident.severity] + " severity, " + STATUS_LABEL[incident.status] + '.">' +
        '<span class="incident-id">' + esc(incident.id) + "</span>" +
        '<span class="incident-title">' + esc(incident.title) + "</span></button></td>" +
      '<td class="cell-service" title="' + esc(incident.service) + '">' + esc(incident.service) + "</td>" +
      '<td class="cell-age">' + esc(incident.age) + "</td>" +
      "<td class=\"cell-owner\">" + ownerCell(incident.owner) + "</td>" +
      '<td class="cell-status">' + statusPill(incident.status) + "</td>" +
    "</tr>";
  }

  function filteredIncidents() {
    var query = state.filters.q.trim().toLowerCase();

    return state.incidents.filter(function (incident) {
      if (state.filters.severity !== "all" && incident.severity !== state.filters.severity) return false;
      if (state.filters.status !== "all" && incident.status !== state.filters.status) return false;
      if (state.filters.service !== "all" && incident.service !== state.filters.service) return false;
      if (!query) return true;
      return [incident.id, incident.title, incident.service, incident.owner, incident.region]
        .join(" ")
        .toLowerCase()
        .indexOf(query) !== -1;
    }).sort(function (a, b) {
      var result = 0;
      switch (state.sort.key) {
        case "severity":
          result = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
          break;
        case "status":
          result = STATUS_RANK[a.status] - STATUS_RANK[b.status];
          break;
        case "age":
          result = a.minutes - b.minutes;
          break;
        case "id":
          result = Number(a.id.replace(/\D/g, "")) - Number(b.id.replace(/\D/g, ""));
          break;
        case "service":
          result = a.service.localeCompare(b.service);
          break;
        case "owner":
          result = a.owner.localeCompare(b.owner);
          break;
        default:
          result = 0;
      }
      return state.sort.dir === "asc" ? result : -result;
    });
  }

  function updateSortIndicators() {
    var buttons = document.querySelectorAll(".sort-btn");
    for (var i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      var th = button.closest("th");
      if (!th) continue;
      if (button.dataset.sort === state.sort.key) {
        th.setAttribute("aria-sort", state.sort.dir === "asc" ? "ascending" : "descending");
      } else {
        th.setAttribute("aria-sort", "none");
      }
    }
  }

  function emptyDescription() {
    var bits = [];
    if (state.filters.q.trim()) bits.push("“" + state.filters.q.trim() + "”");
    if (state.filters.severity !== "all") bits.push(SEVERITY_LABEL[state.filters.severity]);
    if (state.filters.status !== "all") bits.push(STATUS_LABEL[state.filters.status]);
    if (state.filters.service !== "all") bits.push(state.filters.service);
    return bits.length
      ? "No incident matches " + bits.join(" · ") + ". Widen the search or reset the filters."
      : "No incidents match the current filters. Widen the search or reset the filters.";
  }

  function renderTable(options) {
    var opts = options || {};
    var focusedRow = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest("tr.incident-row")
      : null;
    var focusId = focusedRow ? focusedRow.dataset.id : null;

    var rows = filteredIncidents();
    el.incidentRows.innerHTML = rows.map(incidentRow).join("");
    el.incidentTable.hidden = rows.length === 0;
    el.tableEmpty.hidden = rows.length !== 0;
    el.tableEmpty.querySelector("p").textContent = emptyDescription();

    el.resultCount.innerHTML = "<strong>" + rows.length + "</strong> of " + state.incidents.length + " incidents";
    el.clearFilters.disabled = !hasFilters();

    updateSortIndicators();
    updateSeverityTally();

    if (focusId && opts.restoreFocus !== false) {
      var buttons = el.incidentRows.querySelectorAll(".row-open");
      var restored = null;
      for (var i = 0; i < buttons.length; i += 1) {
        var row = buttons[i].closest("tr");
        if (row && row.dataset.id === focusId) { restored = buttons[i]; break; }
      }
      if (restored) restored.focus({ preventScroll: true });
      else el.searchInput.focus({ preventScroll: true });
    }
  }

  function updateSelectionStyles() {
    var rows = el.incidentRows.querySelectorAll("tr.incident-row");
    for (var i = 0; i < rows.length; i += 1) {
      rows[i].classList.toggle("is-selected", rows[i].dataset.id === state.selectedId);
    }
  }

  function renderDetail() {
    var incident = selectedIncident();

    if (!incident) {
      el.detailContent.hidden = true;
      el.detailEmpty.hidden = false;
      return;
    }

    el.detailEmpty.hidden = true;
    el.detailContent.hidden = false;

    el.detailSeverity.className = "sev-badge sev-" + incident.severity;
    el.detailSeverityText.textContent = SEVERITY_LABEL[incident.severity];
    el.detailId.textContent = incident.id;
    el.detailTitle.textContent = incident.title;
    el.detailStatus.className = "status-pill status--" + incident.status;
    el.detailStatusText.textContent = STATUS_LABEL[incident.status];
    el.detailAge.textContent = incident.age + " old";

    el.metaService.textContent = incident.service;
    el.metaRegion.textContent = incident.region;
    el.metaOwner.innerHTML = ownerCell(incident.owner);
    el.metaDetected.textContent = formatTime(incident.startedAt) + " UTC";
    el.detailImpact.textContent = incident.impact;
    el.detailBurn.textContent = incident.burn;

    var canAcknowledge = incident.status === "open" ||
      incident.status === "investigating" ||
      incident.status === "monitoring";

    el.ackBtn.disabled = !canAcknowledge;
    el.ackBtn.removeAttribute("title");
    el.ackNote.classList.remove("ack-note--done");

    if (incident.status === "resolved") {
      el.ackLabel.textContent = "Resolved";
      el.ackBtn.title = "This incident is resolved; no acknowledgement is required.";
      el.ackNote.textContent = "Resolved — no acknowledgement is required. The response is retained for review.";
      el.ackNote.classList.add("ack-note--done");
    } else if (incident.status === "acknowledged") {
      var ackEvents = incident.timeline.filter(function (event) { return event.kind === "ack"; })
        .sort(function (a, b) { return b.at - a.at; });
      var ackEvent = ackEvents[0];
      el.ackLabel.textContent = "Acknowledged";
      el.ackBtn.title = "This incident has already been acknowledged.";
      el.ackNote.textContent = "Acknowledged by " + (incident.acknowledgedBy || incident.owner) +
        (ackEvent ? " · " + formatTime(ackEvent.at) + " UTC" : " · auto-escalation stopped");
      el.ackNote.classList.add("ack-note--done");
    } else {
      el.ackLabel.textContent = "Acknowledge";
      el.ackNote.textContent = "Acknowledging stops auto-escalation and records you as the responder.";
    }

    var assignedToMe = incident.owner === OPERATOR.name;
    el.assignBtn.disabled = assignedToMe || incident.status === "resolved";
    el.assignBtn.textContent = assignedToMe ? "Assigned to you" : "Assign to me";

    el.timelineCount.textContent = incident.timeline.length + " events";
    el.timelineList.innerHTML = incident.timeline.slice().sort(function (a, b) {
      return b.at - a.at;
    }).map(function (event) {
      var isAck = event.kind === "ack";
      return '<li class="timeline-item' + (isAck ? " timeline-item--ack" : "") + '">' +
        '<span class="timeline-dot" aria-hidden="true"></span>' +
        "<div>" +
          '<p class="timeline-text"><strong>' + esc(event.actor) + "</strong> " + esc(event.text) + "</p>" +
          '<span class="timeline-time"><time datetime="' + new Date(event.at).toISOString() + '">' +
            formatTime(event.at) + " UTC</time> · " + relative(event.at) + "</span>" +
        "</div>" +
      "</li>";
    }).join("");
  }

  function updateSeverityTally() {
    var active = activeIncidents();
    el.severityTally.innerHTML = SEVERITIES.map(function (severity) {
      var count = active.filter(function (incident) { return incident.severity === severity; }).length;
      if (!count) return "";
      return '<span class="tally" style="--sev:var(--sev-' + severity + ')" title="' + count + " " +
        SEVERITY_LABEL[severity].toLowerCase() + '"><i></i><b>' + count + "</b> " +
        SEVERITY_LABEL[severity].toLowerCase() + "</span>";
    }).join("");
  }

  function updateChrome() {
    var active = activeIncidents();
    var critical = active.filter(function (incident) { return incident.severity === "critical"; }).length;
    var high = active.filter(function (incident) { return incident.severity === "high"; }).length;

    el.navBadge.textContent = String(active.length);
    el.navBadge.setAttribute("aria-label", active.length + " active incidents");
    el.incidentCount.textContent = active.length + " active";

    var label = "Nominal";
    var detail = "all clear";
    var variant = "nominal";

    if (critical > 0) {
      label = "Degraded";
      detail = critical + " critical";
      variant = "degraded";
    } else if (high > 0) {
      label = "At risk";
      detail = high + " high";
      variant = "risk";
    }

    el.globalStatusLabel.textContent = label;
    el.globalStatusDetail.textContent = detail;
    el.globalStatus.classList.toggle("is-nominal", variant === "nominal");
    el.globalStatus.classList.toggle("is-risk", variant === "risk");
    el.globalStatus.setAttribute("aria-label", "System status: " + label.toLowerCase() + ", " + detail +
      ". Jump to incidents.");
  }

  function syncSortTabindex() {
    var hideFromTabOrder = mobileQuery.matches;
    var buttons = document.querySelectorAll(".sort-btn");
    for (var i = 0; i < buttons.length; i += 1) {
      if (hideFromTabOrder) buttons[i].tabIndex = -1;
      else buttons[i].removeAttribute("tabindex");
    }
  }

  function updateLastUpdated() {
    var seconds = Math.max(0, Math.floor((Date.now() - state.lastUpdate) / 1000));
    if (seconds < 15) el.lastUpdated.textContent = "updated just now";
    else if (seconds < 60) el.lastUpdated.textContent = "updated " + seconds + "s ago";
    else el.lastUpdated.textContent = "updated " + Math.floor(seconds / 60) + "m ago";
  }

  /* -------------------------------------------------------------- behaviors */

  function hasFilters() {
    return Boolean(state.filters.q.trim()) ||
      state.filters.severity !== "all" ||
      state.filters.status !== "all" ||
      state.filters.service !== "all";
  }

  function selectIncident(id, options) {
    var opts = options || {};
    var incident = state.incidents.find(function (item) { return item.id === id; });
    if (!incident) return;

    var changed = state.selectedId !== id;
    state.selectedId = id;
    updateSelectionStyles();
    renderDetail();

    if (changed) {
      el.selectionStatus.textContent = "Showing details for " + incident.id + ": " + incident.title +
        ". Status " + STATUS_LABEL[incident.status] + ".";
    }

    if (opts.openSheet) openSheet();
  }

  function acknowledgeSelected() {
    var incident = selectedIncident();
    if (!incident) return false;

    if (incident.status === "resolved" || incident.status === "acknowledged") {
      showToast(incident.id + " is already " + STATUS_LABEL[incident.status].toLowerCase() + ".");
      return false;
    }

    var focusWasOnAction = document.activeElement === el.ackBtn;

    incident.status = "acknowledged";
    incident.acknowledgedBy = OPERATOR.name;
    if (incident.owner === "Unassigned") incident.owner = OPERATOR.name;

    incident.timeline.push({
      at: Date.now(),
      actor: OPERATOR.name,
      text: "acknowledged the incident",
      kind: "ack"
    });

    renderTable();
    renderDetail();
    updateChrome();
    showToast(incident.id + " acknowledged — " + incident.title);
    el.selectionStatus.textContent = incident.id + " acknowledged by " + OPERATOR.name + ".";

    if (focusWasOnAction) el.detailTitle.focus({ preventScroll: true });
    return true;
  }

  function assignSelected() {
    var incident = selectedIncident();
    if (!incident || incident.owner === OPERATOR.name || incident.status === "resolved") return;

    var focusWasOnAction = document.activeElement === el.assignBtn;

    incident.owner = OPERATOR.name;
    incident.timeline.push({
      at: Date.now(),
      actor: OPERATOR.name,
      text: "assigned the incident to themselves",
      kind: "note"
    });

    renderTable();
    renderDetail();
    showToast(incident.id + " assigned to " + OPERATOR.name + ".");
    el.selectionStatus.textContent = incident.id + " assigned to " + OPERATOR.name + ".";

    if (focusWasOnAction) el.detailTitle.focus({ preventScroll: true });
  }

  function showToast(message) {
    if (el.toastTimer) window.clearTimeout(el.toastTimer);
    el.toastText.textContent = message;
    el.toast.classList.add("is-visible");
    el.toastTimer = window.setTimeout(function () {
      el.toast.classList.remove("is-visible");
    }, 3800);
  }

  function openSheet() {
    if (!mobileQuery.matches || !selectedIncident()) return;
    if (el.detailPanel.classList.contains("is-open")) return;

    el.lastFocused = document.activeElement;
    el.detailPanel.classList.add("is-open");
    el.detailPanel.setAttribute("role", "dialog");
    el.detailPanel.setAttribute("aria-modal", "true");
    el.detailPanel.setAttribute("aria-labelledby", "detailTitle");
    el.sheetBackdrop.hidden = false;
    document.body.classList.add("sheet-open");

    window.setTimeout(function () {
      if (el.detailPanel.classList.contains("is-open")) {
        el.detailTitle.focus({ preventScroll: true });
      }
    }, 40);
  }

  function closeSheet(options) {
    var opts = options || {};
    if (!el.detailPanel.classList.contains("is-open")) return;

    el.detailPanel.classList.remove("is-open");
    el.detailPanel.removeAttribute("role");
    el.detailPanel.removeAttribute("aria-modal");
    el.detailPanel.removeAttribute("aria-labelledby");
    el.sheetBackdrop.hidden = true;
    document.body.classList.remove("sheet-open");

    if (opts.restoreFocus !== false) {
      var selectedRow = el.incidentRows.querySelector('tr[data-id="' + String(state.selectedId).replace(/"/g, "") + '"] .row-open');
      if (selectedRow) selectedRow.focus({ preventScroll: true });
      else if (el.lastFocused && document.contains(el.lastFocused) && el.lastFocused.getClientRects().length) {
        el.lastFocused.focus({ preventScroll: true });
      } else {
        el.searchInput.focus({ preventScroll: true });
      }
    }
  }

  function trapSheetFocus(event) {
    if (!el.detailPanel.classList.contains("is-open")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeSheet();
      return;
    }

    if (event.key !== "Tab") return;

    var focusable = Array.prototype.filter.call(
      el.detailPanel.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      function (node) {
        return node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden";
      }
    );
    if (!focusable.length) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function clearFilters(options) {
    var opts = options || {};
    state.filters = { q: "", severity: "all", status: "all", service: "all" };
    el.searchInput.value = "";
    el.severityFilter.value = "all";
    el.statusFilter.value = "all";
    el.serviceFilter.value = "all";
    renderTable({ restoreFocus: false });
    if (opts.focusSearch) el.searchInput.focus({ preventScroll: true });
  }

  function populateFilters() {
    el.severityFilter.innerHTML = '<option value="all">All severities</option>' +
      SEVERITIES.map(function (severity) {
        return '<option value="' + severity + '">' + SEVERITY_LABEL[severity] + "</option>";
      }).join("");

    el.statusFilter.innerHTML = '<option value="all">All statuses</option>' +
      STATUSES.map(function (status) {
        return '<option value="' + status + '">' + STATUS_LABEL[status] + "</option>";
      }).join("");

    var services = state.incidents.map(function (incident) { return incident.service; })
      .filter(function (service, index, all) { return all.indexOf(service) === index; })
      .sort(function (a, b) { return a.localeCompare(b); });

    el.serviceFilter.innerHTML = '<option value="all">All services</option>' +
      services.map(function (service) {
        return '<option value="' + esc(service) + '">' + esc(service) + "</option>";
      }).join("");
  }

  function isTextEntry(target) {
    return Boolean(target && target.matches &&
      target.matches("input, textarea, select, [contenteditable='true']"));
  }

  function bindEvents() {
    el.searchInput.addEventListener("input", function () {
      state.filters.q = el.searchInput.value;
      renderTable({ restoreFocus: false });
    });

    [el.severityFilter, el.statusFilter, el.serviceFilter].forEach(function (select) {
      select.addEventListener("change", function () {
        state.filters.severity = el.severityFilter.value;
        state.filters.status = el.statusFilter.value;
        state.filters.service = el.serviceFilter.value;
        renderTable({ restoreFocus: false });
      });
    });

    el.clearFilters.addEventListener("click", function () { clearFilters({ focusSearch: true }); });
    el.emptyClear.addEventListener("click", function () { clearFilters({ focusSearch: true }); });

    document.querySelectorAll(".sort-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.dataset.sort;
        if (state.sort.key === key) {
          state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        } else {
          state.sort.key = key;
          state.sort.dir = key === "age" || key === "status" ? "asc" : "asc";
        }
        renderTable({ restoreFocus: false });
      });
    });

    el.incidentRows.addEventListener("click", function (event) {
      var row = event.target.closest("tr.incident-row");
      if (!row) return;
      selectIncident(row.dataset.id, { openSheet: true });
      var button = row.querySelector(".row-open");
      if (button && event.detail > 0) button.focus({ preventScroll: true });
    });

    el.incidentRows.addEventListener("focusin", function (event) {
      var button = event.target.closest(".row-open");
      if (!button) return;
      var row = button.closest("tr.incident-row");
      if (row && state.selectedId !== row.dataset.id) selectIncident(row.dataset.id);
    });

    el.incidentRows.addEventListener("keydown", function (event) {
      var button = event.target.closest(".row-open");
      if (!button) return;
      if (["ArrowDown", "ArrowUp", "Home", "End"].indexOf(event.key) === -1) return;

      var buttons = Array.prototype.slice.call(el.incidentRows.querySelectorAll(".row-open"));
      var index = buttons.indexOf(button);
      var next = index;

      if (event.key === "ArrowDown") next = Math.min(buttons.length - 1, index + 1);
      if (event.key === "ArrowUp") next = Math.max(0, index - 1);
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = buttons.length - 1;

      if (next !== index) {
        event.preventDefault();
        buttons[next].focus();
        buttons[next].scrollIntoView({ block: "nearest" });
      }
    });

    el.chartBars.addEventListener("focusin", function (event) {
      var bar = event.target.closest(".bar-col");
      if (bar) announceChart(bar);
    });

    el.chartBars.addEventListener("keydown", function (event) {
      var bar = event.target.closest(".bar-col");
      if (!bar) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].indexOf(event.key) === -1) return;

      var bars = Array.prototype.slice.call(el.chartBars.querySelectorAll(".bar-col"));
      var index = bars.indexOf(bar);
      var next = index;

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(bars.length - 1, index + 1);
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = bars.length - 1;

      event.preventDefault();
      if (next !== index) bars[next].focus();
    });

    el.chartBars.addEventListener("click", function (event) {
      var bar = event.target.closest(".bar-col");
      if (bar) bar.focus({ preventScroll: true });
    });

    el.ackBtn.addEventListener("click", acknowledgeSelected);
    el.assignBtn.addEventListener("click", assignSelected);
    el.closeDetail.addEventListener("click", function () { closeSheet(); });
    el.sheetBackdrop.addEventListener("click", function () { closeSheet(); });
    el.detailPanel.addEventListener("keydown", trapSheetFocus);

    el.refreshBtn.addEventListener("click", function () {
      state.lastUpdate = Date.now();
      updateLastUpdated();
      el.refreshBtn.classList.add("is-spinning");
      window.setTimeout(function () { el.refreshBtn.classList.remove("is-spinning"); }, 700);
      renderMetrics();
      renderTable({ restoreFocus: false });
      renderDetail();
      showToast("Snapshot refreshed · " + new Date().toISOString().slice(11, 19) + " UTC");
    });

    el.globalStatus.addEventListener("click", function () {
      document.getElementById("incidents").scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    });

    document.querySelectorAll(".rail-item").forEach(function (item) {
      var text = item.querySelector(".rail-text");
      var label = text ? text.textContent : item.dataset.nav;
      item.title = label;
      item.addEventListener("click", function () {
        var nav = item.dataset.nav;
        if (nav === "overview") {
          window.scrollTo({ top: 0, behavior: scrollBehavior() });
        } else if (nav === "incidents") {
          document.getElementById("incidents").scrollIntoView({ behavior: scrollBehavior(), block: "start" });
        } else {
          showToast(label + " workspace is not wired in this snapshot.");
        }
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "/" && !isTextEntry(event.target) &&
        !el.detailPanel.classList.contains("is-open") &&
        !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        el.searchInput.focus();
        el.searchInput.select();
        return;
      }

      if (event.key === "Escape") {
        if (el.detailPanel.classList.contains("is-open")) {
          closeSheet();
          return;
        }
        if (document.activeElement === el.searchInput) {
          if (el.searchInput.value) {
            el.searchInput.value = "";
            state.filters.q = "";
            renderTable({ restoreFocus: false });
          } else {
            el.searchInput.blur();
          }
        }
        return;
      }

      if (event.key.toLowerCase() === "a" && !isTextEntry(event.target) &&
        !event.metaKey && !event.ctrlKey && !event.altKey && !event.repeat) {
        var incident = selectedIncident();
        if (!incident) return;
        event.preventDefault();
        acknowledgeSelected();
      }
    });

    mobileQuery.addEventListener("change", function (event) {
      syncSortTabindex();
      if (!event.matches) closeSheet({ restoreFocus: false });
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) updateLastUpdated();
    });
  }

  function startClock() {
    function tick() {
      var now = new Date();
      el.clock.textContent = pad(now.getUTCHours()) + ":" + pad(now.getUTCMinutes()) + ":" + pad(now.getUTCSeconds());
    }
    tick();
    window.setInterval(tick, 1000);
    window.setInterval(updateLastUpdated, 5000);
  }

  function cacheElements() {
    el.metricGrid = document.getElementById("metricGrid");
    el.chartY = document.getElementById("chartY");
    el.chartGrid = document.getElementById("chartGrid");
    el.chartBars = document.getElementById("chartBars");
    el.chartX = document.getElementById("chartX");
    el.chartStatus = document.getElementById("chartStatus");
    el.statPeak = document.getElementById("statPeak");
    el.statPeakAt = document.getElementById("statPeakAt");
    el.statAvg = document.getElementById("statAvg");
    el.statNow = document.getElementById("statNow");
    el.statNowAt = document.getElementById("statNowAt");

    el.incidentTable = document.getElementById("incidentTable");
    el.incidentRows = document.getElementById("incidentRows");
    el.tableEmpty = document.getElementById("tableEmpty");
    el.resultCount = document.getElementById("resultCount");
    el.clearFilters = document.getElementById("clearFilters");
    el.emptyClear = document.getElementById("emptyClear");
    el.searchInput = document.getElementById("searchInput");
    el.severityFilter = document.getElementById("severityFilter");
    el.statusFilter = document.getElementById("statusFilter");
    el.serviceFilter = document.getElementById("serviceFilter");
    el.incidentCount = document.getElementById("incidentCount");
    el.severityTally = document.getElementById("severityTally");
    el.navBadge = document.getElementById("navBadge");

    el.detailPanel = document.getElementById("detailPanel");
    el.detailEmpty = document.getElementById("detailEmpty");
    el.detailContent = document.getElementById("detailContent");
    el.detailSeverity = document.getElementById("detailSeverity");
    el.detailSeverityText = document.getElementById("detailSeverityText");
    el.detailId = document.getElementById("detailId");
    el.detailTitle = document.getElementById("detailTitle");
    el.detailStatus = document.getElementById("detailStatus");
    el.detailStatusText = document.getElementById("detailStatusText");
    el.detailAge = document.getElementById("detailAge");
    el.metaService = document.getElementById("metaService");
    el.metaRegion = document.getElementById("metaRegion");
    el.metaOwner = document.getElementById("metaOwner");
    el.metaDetected = document.getElementById("metaDetected");
    el.detailImpact = document.getElementById("detailImpact");
    el.detailBurn = document.getElementById("detailBurn");
    el.ackBtn = document.getElementById("ackBtn");
    el.ackLabel = document.getElementById("ackLabel");
    el.assignBtn = document.getElementById("assignBtn");
    el.ackNote = document.getElementById("ackNote");
    el.timelineList = document.getElementById("timelineList");
    el.timelineCount = document.getElementById("timelineCount");
    el.closeDetail = document.getElementById("closeDetail");
    el.sheetBackdrop = document.getElementById("sheetBackdrop");

    el.globalStatus = document.getElementById("globalStatus");
    el.globalStatusLabel = document.getElementById("globalStatusLabel");
    el.globalStatusDetail = document.getElementById("globalStatusDetail");
    el.clock = document.getElementById("clock");
    el.lastUpdated = document.getElementById("lastUpdated");
    el.refreshBtn = document.getElementById("refreshBtn");
    el.toast = document.getElementById("toast");
    el.toastText = document.getElementById("toastText");
    el.selectionStatus = document.getElementById("selectionStatus");
  }

  function init() {
    cacheElements();
    buildIncidents();
    populateFilters();
    startClock();
    renderMetrics();
    renderChart();
    renderTable();
    bindEvents();
    syncSortTabindex();
    updateChrome();
    updateLastUpdated();

    if (!mobileQuery.matches) {
      var first = filteredIncidents()[0];
      if (first) selectIncident(first.id);
    } else {
      renderDetail();
    }
  }

  init();
})();
