(function () {
  "use strict";

  // Inlined from DATA.json so the page does not fetch.
  const DATA = {
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

  const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
  const STATUS_RANK = { open: 0, investigating: 1, monitoring: 2, acknowledged: 3 };
  const LOWER_BETTER = new Set(["P95 latency", "Error rate", "Queue depth"]);

  const MARKS = {
    critical: "■",
    high: "▲",
    medium: "◆",
    low: "○"
  };

  const incidents = DATA.incidents.map((item) => ({
    id: item.id,
    severity: item.severity,
    service: item.service,
    age: item.age,
    owner: item.owner,
    status: item.status,
    title: item.title,
    priorStatus: null,
    ackAt: null
  }));

  const state = {
    query: "",
    severity: "all",
    service: "all",
    status: "all",
    sortKey: "severity",
    sortDir: "asc",
    selectedId: incidents[0] ? incidents[0].id : null
  };

  const values = DATA.throughput;
  const axisMax = Math.max(100, ...values);
  const peakIndex = values.indexOf(Math.max(...values));
  let pinnedHour = peakIndex;

  const barsEl = document.getElementById("bars");
  const tableEl = document.getElementById("incident-table");
  const detailEl = document.getElementById("detail");

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function labelWord(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function hourLabel(index) {
    return String(index).padStart(2, "0") + ":00";
  }

  function ageMinutes(age) {
    const hours = age.match(/(\d+)\s*h/);
    const minutes = age.match(/(\d+)\s*m/);
    return (hours ? Number(hours[1]) : 0) * 60 + (minutes ? Number(minutes[1]) : 0);
  }

  function formatUtc(date) {
    const iso = date.toISOString();
    return {
      iso: iso,
      time: iso.slice(11, 19),
      date: iso.slice(0, 10)
    };
  }

  function trendInfo(metric) {
    const rising = metric.direction === "up";
    const motion = rising ? "rising" : "falling";
    if (!LOWER_BETTER.has(metric.label)) {
      return { className: "trend-neutral", quality: "", motion: motion, arrow: rising ? "▲" : "▼" };
    }
    const good = !rising;
    return {
      className: good ? "trend-good" : "trend-bad",
      quality: good ? ", favorable" : ", unfavorable",
      motion: motion,
      arrow: rising ? "▲" : "▼"
    };
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function announce(message) {
    const el = document.getElementById("live");
    el.textContent = "";
    window.requestAnimationFrame(() => {
      el.textContent = message;
    });
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function renderMetrics() {
    const root = document.getElementById("metrics");
    root.innerHTML = DATA.metrics.map((metric) => {
      const trend = trendInfo(metric);
      return (
        '<div class="metric">' +
          '<p class="metric-label">' + escapeHtml(metric.label) + "</p>" +
          '<p class="metric-value">' + escapeHtml(metric.value) + "</p>" +
          '<p class="metric-change ' + trend.className + '">' +
            '<span aria-hidden="true">' + trend.arrow + "</span>" +
            "<span>" + escapeHtml(metric.change) + "</span>" +
            '<span class="sr-only">, ' + trend.motion + trend.quality + "</span>" +
          "</p>" +
        "</div>"
      );
    }).join("");
  }

  function renderChart() {
    const ticks = [1, 0.75, 0.5, 0.25, 0].map((part) => String(Math.round(axisMax * part)));
    document.getElementById("y-axis").innerHTML = ticks.map((tick) => "<span>" + tick + "</span>").join("");
    document.getElementById("gridlines").innerHTML = ticks.map(() => "<i></i>").join("");
    document.getElementById("scale-note").textContent = "Hourly index, 00:00–23:00 · scale 0–" + axisMax;

    barsEl.innerHTML = values.map((value, index) => {
      const height = Math.max(2, Math.round((value / axisMax) * 160));
      const peak = index === peakIndex;
      const label = hourLabel(index) + ", index " + value + (peak ? ", peak hour" : "");
      return (
        '<button type="button" class="bar-btn' + (peak ? " is-peak" : "") + '" ' +
          'data-hour="' + index + '" data-value="' + value + '" ' +
          'style="height:' + height + 'px" ' +
          'aria-label="' + escapeHtml(label) + '" ' +
          'tabindex="' + (index === pinnedHour ? "0" : "-1") + '"></button>'
      );
    }).join("");

    document.getElementById("x-axis").innerHTML = values.map((_, index) => {
      const major = index % 6 === 0;
      const show = index % 3 === 0;
      const cls = major ? "" : " minor";
      return '<span class="' + cls.trim() + '" data-hour="' + index + '">' + (show ? hourLabel(index).slice(0, 2) : "") + "</span>";
    }).join("");

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const minIndex = values.indexOf(minValue);
    const mean = (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
    const stats = [
      ["Min " + hourLabel(minIndex), String(minValue)],
      ["Max " + hourLabel(peakIndex), String(maxValue)],
      ["Mean", mean],
      ["Last " + hourLabel(values.length - 1), String(values[values.length - 1])]
    ];
    document.getElementById("chart-stats").innerHTML = stats.map((item) => {
      return "<div><span>" + escapeHtml(item[0]) + "</span><strong>" + escapeHtml(item[1]) + "</strong></div>";
    }).join("");

    paintHour(pinnedHour);
  }

  function paintHour(hour) {
    barsEl.querySelectorAll(".bar-btn").forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.hour) === hour);
    });
    document.querySelectorAll("#x-axis span").forEach((label) => {
      label.classList.toggle("on", Number(label.dataset.hour) === hour);
    });
    const value = values[hour];
    setText("readout-hour", hourLabel(hour));
    setText("readout-value", String(value));
    setText("readout-note", hour === peakIndex ? "Peak hour" : "Hourly index");
  }

  function pinHour(hour, focus) {
    pinnedHour = hour;
    barsEl.querySelectorAll(".bar-btn").forEach((button) => {
      button.tabIndex = Number(button.dataset.hour) === hour ? 0 : -1;
    });
    paintHour(hour);
    if (focus) {
      const target = barsEl.querySelector('.bar-btn[data-hour="' + hour + '"]');
      if (target) target.focus();
    }
  }

  function compareIncidents(a, b) {
    const dir = state.sortDir === "asc" ? 1 : -1;
    let result = 0;
    switch (state.sortKey) {
      case "severity":
        result = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        break;
      case "age":
        result = ageMinutes(a.age) - ageMinutes(b.age);
        break;
      case "status":
        result = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        break;
      default:
        result = String(a[state.sortKey]).localeCompare(String(b[state.sortKey]), "en", { numeric: true });
    }
    if (result === 0) result = a.id.localeCompare(b.id);
    else result *= dir;
    return result;
  }

  function filteredIncidents() {
    const query = state.query.trim().toLowerCase();
    return incidents.filter((incident) => {
      if (state.severity !== "all" && incident.severity !== state.severity) return false;
      if (state.service !== "all" && incident.service !== state.service) return false;
      if (state.status !== "all" && incident.status !== state.status) return false;
      if (!query) return true;
      const blob = [
        incident.id,
        incident.title,
        incident.service,
        incident.owner,
        incident.severity,
        incident.status,
        incident.age
      ].join(" ").toLowerCase();
      return blob.includes(query);
    }).sort(compareIncidents);
  }

  function describeFilters() {
    const parts = [];
    const query = state.query.trim();
    if (query) parts.push('search "' + query + '"');
    if (state.severity !== "all") parts.push("severity " + labelWord(state.severity));
    if (state.service !== "all") parts.push("service " + state.service);
    if (state.status !== "all") parts.push("status " + labelWord(state.status));
    if (!parts.length) return "No incidents are in this snapshot.";
    return "No incidents match " + parts.join(", ") + ".";
  }

  function cell(className, label, inner, numeric) {
    return (
      '<td class="' + className + (numeric ? " num" : "") + '" data-label="' + escapeHtml(label) + '">' +
        '<span class="cell-label">' + escapeHtml(label) + "</span>" +
        inner +
      "</td>"
    );
  }

  function severityMarkup(severity) {
    return (
      '<span class="sev sev-' + severity + '">' +
        '<span class="mark" aria-hidden="true">' + MARKS[severity] + "</span>" +
        "<span>" + labelWord(severity) + "</span>" +
      "</span>"
    );
  }

  function statusMarkup(status) {
    return '<span class="st st-' + status + '">' + labelWord(status) + "</span>";
  }

  function renderTable() {
    const rows = filteredIncidents();
    if (rows.length && !rows.some((row) => row.id === state.selectedId)) {
      state.selectedId = rows[0].id;
    }
    const body = document.getElementById("incident-rows");
    setText("result-count", "Showing " + rows.length + " of " + incidents.length + " incidents");

    if (!rows.length) {
      body.innerHTML =
        '<tr class="empty-row">' +
          '<td class="empty-cell" colspan="7">' +
            '<p class="empty-title">No matching incidents</p>' +
            '<p class="empty-copy">' + escapeHtml(describeFilters()) + "</p>" +
            '<button type="button" class="btn" id="empty-reset">Reset filters</button>' +
          "</td>" +
        "</tr>";
      return;
    }

    body.innerHTML = rows.map((incident) => {
      const selected = incident.id === state.selectedId;
      const ownerClass = incident.owner === "Unassigned" ? " owner-none" : "";
      return (
        '<tr data-id="' + escapeHtml(incident.id) + '" tabindex="' + (selected ? "0" : "-1") + '" aria-selected="' + (selected ? "true" : "false") + '">' +
          cell("col-sev", "Severity", severityMarkup(incident.severity)) +
          cell("col-id", "ID", '<span class="mono">' + escapeHtml(incident.id) + "</span>") +
          cell("col-title", "Title", escapeHtml(incident.title)) +
          cell("col-service", "Service", '<span class="mono">' + escapeHtml(incident.service) + "</span>") +
          cell("col-age", "Age", escapeHtml(incident.age), true) +
          cell("col-owner", "Owner", '<span class="' + ownerClass.trim() + '">' + escapeHtml(incident.owner) + "</span>") +
          cell("col-status", "Status", statusMarkup(incident.status)) +
        "</tr>"
      );
    }).join("");
  }

  function guidanceFor(incident) {
    if (incident.ackAt) {
      return "Acknowledged by Desk 4 at " + incident.ackAt + " UTC. Severity is unchanged.";
    }
    if (incident.owner === "Unassigned") return "No owner assigned.";
    if (incident.severity === "critical") return "Critical severity. Keep an owner on this incident.";
    if (incident.status === "monitoring") return "Owner is monitoring.";
    return "Open with the named owner.";
  }

  function fact(term, value, extraClass) {
    const cls = extraClass ? ' class="' + extraClass + '"' : "";
    return "<dt>" + term + "</dt><dd" + cls + ">" + value + "</dd>";
  }

  function renderDetail() {
    const incident = filteredIncidents().find((item) => item.id === state.selectedId);
    if (!incident) {
      const follow = filtersDirty() ? " Reset filters to see the full queue." : "";
      detailEl.innerHTML =
        '<p class="kicker">Incident</p>' +
        '<h3 id="detail-heading">No matching incident</h3>' +
        '<p class="guidance">' + escapeHtml(describeFilters()) + follow + "</p>";
      return;
    }

    const acknowledged = Boolean(incident.ackAt);
    const facts = [
      fact("Severity", severityMarkup(incident.severity)),
      fact("Service", '<span class="mono">' + escapeHtml(incident.service) + "</span>"),
      fact("Age", escapeHtml(incident.age)),
      fact("Owner", escapeHtml(incident.owner), incident.owner === "Unassigned" ? "owner-none" : ""),
      fact("Status", statusMarkup(incident.status))
    ];
    if (acknowledged) facts.push(fact("Acknowledged", escapeHtml(incident.ackAt + " UTC")));

    detailEl.innerHTML =
      '<p class="kicker">Incident</p>' +
      '<p class="detail-id">' + escapeHtml(incident.id) + "</p>" +
      '<h3 id="detail-heading">' + escapeHtml(incident.title) + "</h3>" +
      '<p class="guidance">' + escapeHtml(guidanceFor(incident)) + "</p>" +
      '<dl class="facts">' + facts.join("") + "</dl>" +
      '<button type="button" class="ack' + (acknowledged ? " is-on" : "") + '" id="ack-btn" aria-pressed="' + (acknowledged ? "true" : "false") + '" aria-describedby="ack-hint">' +
        (acknowledged ? "Undo acknowledge" : "Acknowledge") +
      "</button>" +
      '<p class="hint" id="ack-hint">Records Desk 4 at the current UTC time. Does not change severity or owner.</p>';
  }

  function activeIncidents() {
    return incidents.filter((incident) => incident.status !== "acknowledged");
  }

  function renderStatus() {
    const active = activeIncidents();
    const critical = active.filter((incident) => incident.severity === "critical").length;
    const high = active.filter((incident) => incident.severity === "high").length;
    let level = "ok";
    let label = "Nominal";
    let detail = active.length ? active.length + " active" : incidents.length + " acknowledged";
    if (critical > 0) {
      level = "bad";
      label = "Degraded";
      detail = critical + " critical active";
    } else if (high > 0) {
      level = "warn";
      label = "Elevated";
      detail = high + " high active";
    } else if (active.length > 0) {
      level = "watch";
      label = "Watching";
      detail = active.length + " active";
    }
    const health = document.getElementById("health");
    health.className = "health health-" + level;
    setText("health-label", label);
    setText("health-detail", detail);
    setText("open-count", String(active.length));
    const title = critical > 0 ? "Relay — Degraded · " + critical + " critical" : "Relay — " + label;
    if (document.title !== title) document.title = title;
  }

  function syncSort() {
    document.querySelectorAll("#incident-table th").forEach((th) => {
      const key = th.dataset.sort;
      const dir = th.querySelector(".dir");
      if (key === state.sortKey) {
        th.setAttribute("aria-sort", state.sortDir === "asc" ? "ascending" : "descending");
        dir.textContent = state.sortDir === "asc" ? "↑" : "↓";
      } else {
        th.removeAttribute("aria-sort");
        dir.textContent = "";
      }
    });
    const select = document.getElementById("sort");
    const value = state.sortKey + ":" + state.sortDir;
    if ([].some.call(select.options, (option) => option.value === value)) select.value = value;
  }

  function filtersDirty() {
    return state.query !== "" || state.severity !== "all" || state.service !== "all" || state.status !== "all";
  }

  function syncReset() {
    document.getElementById("reset-filters").disabled = !filtersDirty();
  }

  function focusSelector(selector) {
    if (!selector) return;
    const el = document.querySelector(selector);
    if (el) {
      el.focus();
      return;
    }
    const fallback = document.querySelector("#reveal-btn, #empty-reset, #q");
    if (fallback) fallback.focus();
  }

  function renderDynamic(selector) {
    renderTable();
    renderDetail();
    renderStatus();
    syncSort();
    syncReset();
    focusSelector(selector);
  }

  function resetFilters(selector) {
    state.query = "";
    state.severity = "all";
    state.service = "all";
    state.status = "all";
    document.getElementById("q").value = "";
    document.getElementById("severity").value = "all";
    document.getElementById("service").value = "all";
    document.getElementById("status").value = "all";
    renderDynamic(selector || "#q");
  }

  function scrollDetail() {
    if (!window.matchMedia("(max-width: 800px)").matches) return;
    document.getElementById("detail").scrollIntoView({
      block: "nearest",
      behavior: reducedMotion() ? "auto" : "smooth"
    });
  }

  function selectIncident(id, scroll) {
    state.selectedId = id;
    renderDynamic('#incident-table tr[data-id="' + CSS.escape(id) + '"]');
    if (scroll) scrollDetail();
  }

  function toggleAck() {
    const incident = incidents.find((item) => item.id === state.selectedId);
    if (!incident) return;
    if (incident.ackAt) {
      incident.status = incident.priorStatus || "open";
      const restored = incident.status;
      incident.priorStatus = null;
      incident.ackAt = null;
      announce(incident.id + " acknowledgement removed. Status is " + restored + ".");
    } else {
      incident.priorStatus = incident.status;
      incident.status = "acknowledged";
      incident.ackAt = formatUtc(new Date()).time;
      announce(incident.id + " acknowledged at " + incident.ackAt + " UTC. Status is acknowledged.");
    }
    renderDynamic();
    const detailId = document.querySelector(".detail-id");
    if (detailId && detailId.textContent === incident.id) {
      focusSelector("#ack-btn");
      return;
    }
    const row = document.querySelector("#incident-table tr[aria-selected='true']");
    if (row) row.focus();
    else focusSelector("#empty-reset, #q");
  }

  function bind() {
    const services = Array.from(new Set(incidents.map((incident) => incident.service))).sort();
    const serviceSelect = document.getElementById("service");
    services.forEach((service) => {
      const option = document.createElement("option");
      option.value = service;
      option.textContent = service;
      serviceSelect.appendChild(option);
    });

    document.getElementById("filters").addEventListener("submit", (event) => {
      event.preventDefault();
    });

    document.getElementById("q").addEventListener("input", (event) => {
      state.query = event.target.value;
      renderDynamic();
    });

    ["severity", "service", "status"].forEach((key) => {
      document.getElementById(key).addEventListener("change", (event) => {
        state[key] = event.target.value;
        renderDynamic();
      });
    });

    document.getElementById("sort").addEventListener("change", (event) => {
      const parts = event.target.value.split(":");
      state.sortKey = parts[0];
      state.sortDir = parts[1];
      renderDynamic();
    });

    document.getElementById("reset-filters").addEventListener("click", () => {
      resetFilters("#q");
    });

    document.querySelectorAll("#incident-table th button").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.sort;
        if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        else {
          state.sortKey = key;
          state.sortDir = "asc";
        }
        renderDynamic();
      });
    });

    tableEl.addEventListener("click", (event) => {
      if (event.target.closest("#empty-reset")) {
        resetFilters("#q");
        return;
      }
      const row = event.target.closest("tbody tr[data-id]");
      if (!row) return;
      selectIncident(row.dataset.id, true);
    });

    tableEl.addEventListener("keydown", (event) => {
      const row = event.target.closest("tbody tr[data-id]");
      if (!row) return;
      const rows = Array.from(tableEl.querySelectorAll("tbody tr[data-id]"));
      const index = rows.indexOf(row);
      let next = null;
      if (event.key === "ArrowDown") next = rows[Math.min(rows.length - 1, index + 1)];
      else if (event.key === "ArrowUp") next = rows[Math.max(0, index - 1)];
      else if (event.key === "Home") next = rows[0];
      else if (event.key === "End") next = rows[rows.length - 1];
      else if (event.key === "Enter") {
        scrollDetail();
        return;
      } else return;
      event.preventDefault();
      if (!next || next === row) return;
      selectIncident(next.dataset.id, false);
    });

    detailEl.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.id === "ack-btn") toggleAck();
    });

    barsEl.addEventListener("mouseover", (event) => {
      const button = event.target.closest(".bar-btn");
      if (!button) return;
      paintHour(Number(button.dataset.hour));
    });

    barsEl.addEventListener("mouseleave", () => {
      paintHour(pinnedHour);
    });

    barsEl.addEventListener("focusin", (event) => {
      const button = event.target.closest(".bar-btn");
      if (!button) return;
      pinHour(Number(button.dataset.hour), false);
    });

    barsEl.addEventListener("click", (event) => {
      const button = event.target.closest(".bar-btn");
      if (!button) return;
      pinHour(Number(button.dataset.hour), false);
    });

    barsEl.addEventListener("keydown", (event) => {
      const button = event.target.closest(".bar-btn");
      if (!button) return;
      const current = Number(button.dataset.hour);
      let next = null;
      if (event.key === "ArrowRight") next = Math.min(values.length - 1, current + 1);
      else if (event.key === "ArrowLeft") next = Math.max(0, current - 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = values.length - 1;
      else return;
      event.preventDefault();
      if (next === current) return;
      pinHour(next, true);
    });

    function syncRail(hash) {
      const known = ["#overview", "#throughput", "#incidents"];
      const target = known.indexOf(hash) >= 0 ? hash : "#overview";
      document.querySelectorAll(".rail-nav a").forEach((item) => {
        if (item.getAttribute("href") === target) item.setAttribute("aria-current", "location");
        else item.removeAttribute("aria-current");
      });
    }

    document.querySelectorAll(".rail a").forEach((link) => {
      link.addEventListener("click", () => {
        syncRail(link.getAttribute("href"));
      });
    });

    syncRail(window.location.hash);
  }

  function tick() {
    const now = formatUtc(new Date());
    const clock = document.getElementById("clock");
    clock.dateTime = now.iso;
    setText("clock-time", now.time);
    setText("clock-date", now.date + " UTC");
  }

  bind();
  renderMetrics();
  renderChart();
  renderDynamic();
  tick();
  window.setInterval(tick, 1000);
})();
