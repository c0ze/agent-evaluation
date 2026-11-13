(function () {
  "use strict";

  const CURRENT_OPERATOR = "K. Vance";

  // Seeded directly from DATA.json so the dashboard works completely offline
  // (including over file://) with zero network requests.
  const SEED_DATA = {
    metrics: [
      {
        label: "Events / min",
        value: "18,420",
        change: "+8.2%",
        direction: "up",
        tone: "neutral",
        slo: "avg 17.0k",
        context: "vs 24h baseline · normal ingress"
      },
      {
        label: "P95 latency",
        value: "184 ms",
        change: "−12 ms",
        direction: "down",
        tone: "favorable",
        slo: "≤ 200 ms",
        context: "vs prev hour · within target"
      },
      {
        label: "Error rate",
        value: "0.37%",
        change: "+0.08 pp",
        direction: "up",
        tone: "adverse",
        slo: "≤ 0.25%",
        context: "vs prev hour · above target"
      },
      {
        label: "Queue depth",
        value: "2,841",
        change: "−19%",
        direction: "down",
        tone: "favorable",
        slo: "cap 10k",
        context: "vs 2h peak · backlog draining"
      }
    ],
    throughput: [
      31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73,
      68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41
    ],
    incidents: [
      {
        id: "INC-2841",
        severity: "critical",
        service: "payments-api",
        age: "12m",
        owner: "M. Chen",
        status: "investigating",
        title: "Card authorization timeouts",
        region: "us-east-1 / prod-checkout",
        signal: "auth.gateway.timeout_rate > 2.5% (5m rolling)",
        impact: "4.1% of card authorization requests exceeding 3,000 ms timeout; secondary processor warm.",
        runbook: "RB-104 · Payment Gateway Failover",
        timeline: [
          { time: "-12m", text: "Alert triggered: P95 auth latency crossed 2,400 ms", kind: "system" },
          { time: "-10m", text: "Paged payments-oncall primary rotation", kind: "system" },
          { time: "-8m", text: "M. Chen started investigation on acquirer pool B", kind: "note" }
        ]
      },
      {
        id: "INC-2839",
        severity: "high",
        service: "event-router",
        age: "31m",
        owner: "Unassigned",
        status: "open",
        title: "EU retry queue growth",
        region: "eu-central-1 / ingest-mesh",
        signal: "dlq.retry_depth > 2,000 msgs for 10m",
        impact: "Dead-letter retry backlog growing on shard eu-04; non-critical webhooks delayed 4–6m.",
        runbook: "RB-219 · Router Shard Rebalance",
        timeline: [
          { time: "-31m", text: "Alert triggered: EU retry queue exceeded 2,000 messages", kind: "system" },
          { time: "-27m", text: "Autoscaler expanded consumer group from 12 to 18 pods", kind: "system" },
          { time: "-14m", text: "Awaiting operator claim and acknowledgement", kind: "system" }
        ]
      },
      {
        id: "INC-2837",
        severity: "medium",
        service: "search-index",
        age: "1h 08m",
        owner: "A. Silva",
        status: "monitoring",
        title: "Index freshness outside SLO",
        region: "us-west-2 / catalog-search",
        signal: "index.replication_lag > 180s",
        impact: "Catalog mutations delayed ~140s on read replicas; query latency and availability nominal.",
        runbook: "RB-312 · Index Compaction Throttle",
        timeline: [
          { time: "-1h 08m", text: "Alert triggered: Index replication lag exceeded 180s SLO", kind: "system" },
          { time: "-54m", text: "A. Silva throttled background segment merge on search-07", kind: "note" },
          { time: "-22m", text: "Replication lag stabilized at 142s; monitoring recovery", kind: "note" }
        ]
      },
      {
        id: "INC-2832",
        severity: "low",
        service: "webhooks",
        age: "3h 42m",
        owner: "R. Patel",
        status: "open",
        title: "Elevated partner delivery lag",
        region: "global / outbound-webhooks",
        signal: "webhook.dispatch_p95 > 1,200 ms",
        impact: "Three partner endpoints exhibiting slow TLS handshakes; exponential backoff isolating load.",
        runbook: "RB-408 · Outbound Webhook Concurrency",
        timeline: [
          { time: "-3h 42m", text: "Alert triggered: Partner delivery p95 > 1,200 ms", kind: "system" },
          { time: "-3h 15m", text: "R. Patel isolated stalls to external partner endpoints", kind: "note" },
          { time: "-1h 05m", text: "Backoff queue draining steadily; pending final ack", kind: "system" }
        ]
      }
    ]
  };

  const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
  const STATUS_RANK = { open: 0, investigating: 1, monitoring: 2, acknowledged: 3 };
  const SEVERITY_LABELS = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
  const STATUS_LABELS = {
    open: "Open",
    investigating: "Investigating",
    monitoring: "Monitoring",
    acknowledged: "Acknowledged"
  };

  const state = {
    activeView: "overview",
    chartMode: "bars",
    inspectedHour: 19,
    pinnedHour: null,
    filters: {
      query: "",
      severity: "all",
      status: "all",
      service: "all"
    },
    sort: {
      field: null,
      direction: "asc"
    },
    incidents: SEED_DATA.incidents.map((item, idx) => ({
      ...item,
      originalIndex: idx,
      previousStatus: item.status,
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      timeline: item.timeline.map((entry) => ({ ...entry }))
    })),
    selectedIncidentId: SEED_DATA.incidents[0].id
  };

  const throughputValues = SEED_DATA.throughput;
  const throughputMean = throughputValues.reduce((acc, v) => acc + v, 0) / throughputValues.length;
  const throughputMax = Math.max(...throughputValues);
  const throughputPeakHour = throughputValues.indexOf(throughputMax);
  const throughputMin = Math.min(...throughputValues);
  const throughputMinHour = throughputValues.indexOf(throughputMin);

  // DOM References
  const el = {
    navButtons: Array.from(document.querySelectorAll(".nav-item")),
    navIncidentCount: document.getElementById("nav-incident-count"),
    viewTitle: document.getElementById("view-title"),
    posturePill: document.getElementById("posture-pill"),
    postureText: document.getElementById("posture-text"),
    liveAnnouncer: document.getElementById("live-announcer"),

    metricsSection: document.getElementById("metrics-section"),
    metricsGrid: document.getElementById("metrics-grid"),

    throughputSection: document.getElementById("throughput-section"),
    throughputSummary: document.getElementById("throughput-summary"),
    readoutHour: document.getElementById("readout-hour"),
    readoutVal: document.getElementById("readout-val"),
    readoutDelta: document.getElementById("readout-delta"),
    modeBarsBtn: document.getElementById("mode-bars"),
    modeLineBtn: document.getElementById("mode-line"),
    throughputSvg: document.getElementById("throughput-svg"),
    hourlyBreakdown: document.getElementById("hourly-breakdown"),
    hourlyGrid: document.getElementById("hourly-grid"),

    incidentsSection: document.getElementById("incidents-section"),
    incidentCountSummary: document.getElementById("incident-count-summary"),
    resetFiltersBtn: document.getElementById("reset-filters-btn"),
    filterSearch: document.getElementById("filter-search"),
    severityButtons: Array.from(document.querySelectorAll(".filter-pill[data-severity]")),
    filterStatus: document.getElementById("filter-status"),
    filterService: document.getElementById("filter-service"),
    sortButtons: Array.from(document.querySelectorAll(".sort-btn[data-sort]")),
    incidentTable: document.querySelector(".incident-table"),
    incidentTbody: document.getElementById("incident-tbody"),
    tableEmptyState: document.getElementById("table-empty-state"),
    emptyTitle: document.getElementById("empty-title"),
    emptyDesc: document.getElementById("empty-desc"),
    emptyResetBtn: document.getElementById("empty-reset-btn"),

    detailSubtitle: document.getElementById("detail-subtitle"),
    detailFilterNote: document.getElementById("detail-filter-note"),
    detailBody: document.getElementById("detail-body"),
    detailEmpty: document.getElementById("detail-empty"),

    servicesSection: document.getElementById("services-section"),
    servicesGrid: document.getElementById("services-grid")
  };

  function announce(message) {
    if (!el.liveAnnouncer) return;
    el.liveAnnouncer.textContent = "";
    window.requestAnimationFrame(() => {
      el.liveAnnouncer.textContent = message;
    });
  }

  function formatHour(hour) {
    return `${String(hour).padStart(2, "0")}:00`;
  }

  function parseAgeMinutes(ageText) {
    let total = 0;
    const hourMatch = ageText.match(/(\d+)\s*h/);
    const minMatch = ageText.match(/(\d+)\s*m/);
    if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) total += parseInt(minMatch[1], 10);
    return total;
  }

  function createSvgNode(tag, attrs = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, val] of Object.entries(attrs)) {
      node.setAttribute(key, String(val));
    }
    return node;
  }

  function createSeverityIcon(severity) {
    const svg = createSvgNode("svg", {
      width: "10",
      height: "10",
      viewBox: "0 0 10 10",
      "aria-hidden": "true"
    });

    if (severity === "critical") {
      svg.appendChild(createSvgNode("polygon", { points: "5,1 9,5 5,9 1,5", fill: "currentColor" }));
    } else if (severity === "high") {
      svg.appendChild(createSvgNode("polygon", { points: "5,1.5 9,8.5 1,8.5", fill: "currentColor" }));
    } else if (severity === "medium") {
      svg.appendChild(createSvgNode("rect", { x: "2", y: "2", width: "6", height: "6", fill: "currentColor" }));
    } else {
      svg.appendChild(createSvgNode("circle", { cx: "5", cy: "5", r: "3", fill: "currentColor" }));
    }
    return svg;
  }

  function createSeverityBadge(severity) {
    const badge = document.createElement("span");
    badge.className = "severity-badge";
    badge.dataset.severity = severity;
    badge.appendChild(createSeverityIcon(severity));
    const text = document.createElement("span");
    text.textContent = SEVERITY_LABELS[severity] || severity;
    badge.appendChild(text);
    return badge;
  }

  function createStatusBadge(status) {
    const badge = document.createElement("span");
    badge.className = "status-badge";
    badge.dataset.status = status;

    const glyph = document.createElement("span");
    glyph.className = "status-badge-glyph";
    glyph.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.textContent = STATUS_LABELS[status] || status;

    badge.append(glyph, text);
    return badge;
  }

  function populateServiceFilter() {
    const services = Array.from(new Set(state.incidents.map((inc) => inc.service))).sort();
    services.forEach((service) => {
      const option = document.createElement("option");
      option.value = service;
      option.textContent = service;
      el.filterService.appendChild(option);
    });
  }

  function renderMetrics() {
    el.metricsGrid.replaceChildren();
    SEED_DATA.metrics.forEach((metric) => {
      const cell = document.createElement("article");
      cell.className = "metric-cell";

      const top = document.createElement("div");
      top.className = "metric-top";

      const label = document.createElement("span");
      label.className = "metric-label";
      label.textContent = metric.label;

      const slo = document.createElement("span");
      slo.className = "metric-slo";
      slo.textContent = metric.slo;

      top.append(label, slo);

      const valueRow = document.createElement("div");
      valueRow.className = "metric-value-row";

      const value = document.createElement("span");
      value.className = "metric-value";
      value.textContent = metric.value;

      const delta = document.createElement("span");
      delta.className = "metric-delta";
      delta.dataset.tone = metric.tone;
      const arrow = metric.direction === "up" ? "↑" : "↓";
      const srDir = document.createElement("span");
      srDir.className = "sr-only";
      srDir.textContent = metric.direction === "up" ? "up " : "down ";
      const arrowSpan = document.createElement("span");
      arrowSpan.setAttribute("aria-hidden", "true");
      arrowSpan.textContent = arrow;
      const changeSpan = document.createElement("span");
      changeSpan.textContent = metric.change;
      delta.append(srDir, arrowSpan, changeSpan);

      valueRow.append(value, delta);

      const context = document.createElement("div");
      context.className = "metric-context";
      context.textContent = metric.context;

      cell.append(top, valueRow, context);
      el.metricsGrid.appendChild(cell);
    });
  }

  function updateReadout(hour) {
    const val = throughputValues[hour];
    const diffPct = ((val - throughputMean) / throughputMean) * 100;
    const sign = diffPct >= 0 ? "+" : "−";
    const absPct = Math.abs(diffPct).toFixed(1);
    let suffix = "";
    if (hour === throughputPeakHour) suffix = " (peak)";
    else if (hour === throughputMinHour) suffix = " (trough)";

    el.readoutHour.textContent = `${formatHour(hour)} UTC`;
    el.readoutVal.textContent = String(val);
    el.readoutDelta.textContent = `${sign}${absPct}% vs avg${suffix}`;
  }

  function renderThroughputChart() {
    const svg = el.throughputSvg;
    const isCompact = window.innerWidth <= 640;
    const width = isCompact ? 360 : 840;
    const height = isCompact ? 148 : 162;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    el.throughputSummary.textContent =
      `Hourly ingress index · Mean ${throughputMean.toFixed(1)} · Peak ${throughputMax} (${formatHour(throughputPeakHour)}) · Min ${throughputMin} (${formatHour(throughputMinHour)})`;

    // Preserve title and desc nodes
    const titleNode = svg.querySelector("title");
    const descNode = svg.querySelector("desc");
    if (descNode) {
      descNode.textContent =
        `Hourly throughput values over 24 hours ranging from a minimum of ${throughputMin} at ${formatHour(throughputMinHour)} to a peak of ${throughputMax} at ${formatHour(throughputPeakHour)}, with a 24-hour mean of ${throughputMean.toFixed(1)}.`;
    }
    svg.replaceChildren();
    if (titleNode) svg.appendChild(titleNode);
    if (descNode) svg.appendChild(descNode);

    const pad = isCompact
      ? { top: 12, right: 8, bottom: 24, left: 26 }
      : { top: 12, right: 14, bottom: 24, left: 36 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const yMax = 100;

    const yFor = (val) => pad.top + plotH - (val / yMax) * plotH;
    const slotW = plotW / throughputValues.length;
    const xCenterFor = (idx) => pad.left + idx * slotW + slotW / 2;

    // Horizontal grid lines and Y ticks
    const yTicks = isCompact ? [0, 50, 100] : [0, 25, 50, 75, 100];
    yTicks.forEach((tick) => {
      const y = Math.round(yFor(tick)) + 0.5;
      svg.appendChild(createSvgNode("line", {
        x1: pad.left,
        y1: y,
        x2: width - pad.right,
        y2: y,
        class: "chart-grid-line"
      }));

      const label = createSvgNode("text", {
        x: pad.left - 6,
        y: y + 3.5,
        "text-anchor": "end",
        class: "chart-axis-text"
      });
      label.textContent = String(tick);
      svg.appendChild(label);
    });

    // Mean reference line (label drawn after data series so it stays legible)
    const meanY = Math.round(yFor(throughputMean)) + 0.5;
    svg.appendChild(createSvgNode("line", {
      x1: pad.left,
      y1: meanY,
      x2: width - pad.right,
      y2: meanY,
      class: "chart-mean-line"
    }));

    const activeHour = state.pinnedHour !== null ? state.pinnedHour : state.inspectedHour;

    // Line mode area & polyline underneath interactive targets
    if (state.chartMode === "line") {
      const points = throughputValues.map((val, idx) => `${xCenterFor(idx).toFixed(1)},${yFor(val).toFixed(1)}`);
      const firstX = xCenterFor(0).toFixed(1);
      const lastX = xCenterFor(throughputValues.length - 1).toFixed(1);
      const baseY = (pad.top + plotH).toFixed(1);
      const areaPoints = `${firstX},${baseY} ${points.join(" ")} ${lastX},${baseY}`;

      svg.appendChild(createSvgNode("polygon", {
        points: areaPoints,
        class: "chart-line-area"
      }));

      svg.appendChild(createSvgNode("polyline", {
        points: points.join(" "),
        class: "chart-line-path"
      }));
    }

    // 24 interactive hourly buckets
    const bucketEls = [];
    throughputValues.forEach((val, idx) => {
      const group = createSvgNode("g", {
        class: `chart-bucket${idx === activeHour ? " is-active" : ""}`,
        "data-hour": idx
      });

      const slotX = pad.left + idx * slotW;
      const barPad = isCompact ? Math.max(1.5, slotW * 0.16) : Math.max(3, slotW * 0.18);
      const barW = Math.max(4, slotW - barPad * 2);
      const barX = slotX + (slotW - barW) / 2;
      const barY = yFor(val);
      const barH = pad.top + plotH - barY;
      const cx = xCenterFor(idx);

      if (state.chartMode === "bars") {
        group.appendChild(createSvgNode("rect", {
          x: barX.toFixed(1),
          y: barY.toFixed(1),
          width: barW.toFixed(1),
          height: Math.max(1, barH).toFixed(1),
          rx: "1.5",
          class: `chart-bar${idx === throughputPeakHour ? " is-peak" : ""}${idx === activeHour ? " is-active" : ""}`
        }));

        group.appendChild(createSvgNode("rect", {
          x: (barX - 1.5).toFixed(1),
          y: (barY - 1.5).toFixed(1),
          width: (barW + 3).toFixed(1),
          height: (Math.max(1, barH) + 3).toFixed(1),
          rx: "2",
          class: "chart-focus-ring"
        }));
      } else {
        if (idx === activeHour) {
          group.appendChild(createSvgNode("line", {
            x1: cx.toFixed(1),
            y1: pad.top,
            x2: cx.toFixed(1),
            y2: pad.top + plotH,
            stroke: "#344663",
            "stroke-width": "1"
          }));
        }

        group.appendChild(createSvgNode("circle", {
          cx: cx.toFixed(1),
          cy: barY.toFixed(1),
          r: idx === activeHour ? "4.2" : "2.8",
          class: `chart-point${idx === activeHour ? " is-active" : ""}`
        }));

        group.appendChild(createSvgNode("circle", {
          cx: cx.toFixed(1),
          cy: barY.toFixed(1),
          r: "6.5",
          class: "chart-focus-ring"
        }));
      }

      const diffPct = ((val - throughputMean) / throughputMean) * 100;
      const diffSign = diffPct >= 0 ? "+" : "minus ";
      const hitTarget = createSvgNode("rect", {
        x: slotX.toFixed(1),
        y: pad.top,
        width: slotW.toFixed(1),
        height: plotH,
        tabindex: idx === activeHour ? "0" : "-1",
        role: "button",
        "aria-pressed": state.pinnedHour === idx ? "true" : "false",
        "aria-label": `${formatHour(idx)} UTC: throughput ${val}, ${diffSign}${Math.abs(diffPct).toFixed(1)}% versus 24-hour average`,
        class: "chart-hit-target"
      });

      const activateHour = (pin) => {
        state.inspectedHour = idx;
        if (pin) {
          state.pinnedHour = state.pinnedHour === idx ? null : idx;
        }
        updateChartSelection(idx);
      };

      hitTarget.addEventListener("mouseenter", () => {
        if (state.pinnedHour === null) {
          state.inspectedHour = idx;
          updateChartSelection(idx);
        }
      });

      hitTarget.addEventListener("focus", () => {
        state.inspectedHour = idx;
        updateChartSelection(idx);
      });

      hitTarget.addEventListener("click", () => activateHour(true));

      hitTarget.addEventListener("keydown", (event) => {
        let nextIdx = null;
        if (event.key === "ArrowRight") nextIdx = Math.min(23, idx + 1);
        else if (event.key === "ArrowLeft") nextIdx = Math.max(0, idx - 1);
        else if (event.key === "Home") nextIdx = 0;
        else if (event.key === "End") nextIdx = 23;
        else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateHour(true);
          return;
        }

        if (nextIdx !== null) {
          event.preventDefault();
          state.inspectedHour = nextIdx;
          if (state.pinnedHour !== null) state.pinnedHour = nextIdx;
          updateChartSelection(nextIdx);
          bucketEls[nextIdx].focus();
        }
      });

      group.appendChild(hitTarget);
      svg.appendChild(group);
      bucketEls.push(hitTarget);
    });

    // X-axis tick labels
    const xTicks = isCompact ? [0, 6, 12, 18, 23] : [0, 4, 8, 12, 16, 20, 23];
    xTicks.forEach((hour) => {
      const label = createSvgNode("text", {
        x: xCenterFor(hour).toFixed(1),
        y: height - 7,
        "text-anchor": "middle",
        class: "chart-axis-text"
      });
      label.textContent = isCompact ? `${String(hour).padStart(2, "0")}h` : formatHour(hour);
      svg.appendChild(label);
    });

    const meanLabel = createSvgNode("text", {
      x: width - pad.right - 2,
      y: meanY - 5,
      "text-anchor": "end",
      class: "chart-mean-label"
    });
    meanLabel.textContent = `avg ${throughputMean.toFixed(1)}`;
    svg.appendChild(meanLabel);

    updateReadout(activeHour);
    renderHourlyBreakdown(activeHour);
  }

  function updateChartSelection(activeHour) {
    updateReadout(activeHour);
    const groups = el.throughputSvg.querySelectorAll(".chart-bucket");
    groups.forEach((group, idx) => {
      const isActive = idx === activeHour;
      group.classList.toggle("is-active", isActive);
      const bar = group.querySelector(".chart-bar");
      if (bar) bar.classList.toggle("is-active", isActive);
      const pt = group.querySelector(".chart-point");
      if (pt) {
        pt.classList.toggle("is-active", isActive);
        pt.setAttribute("r", isActive ? "4.2" : "2.8");
      }
      const target = group.querySelector(".chart-hit-target");
      if (target) {
        target.setAttribute("tabindex", isActive ? "0" : "-1");
        target.setAttribute("aria-pressed", state.pinnedHour === idx ? "true" : "false");
      }
    });

    const cells = el.hourlyGrid.querySelectorAll(".hourly-cell");
    cells.forEach((cell, idx) => {
      cell.dataset.active = idx === activeHour ? "true" : "false";
    });
  }

  function renderHourlyBreakdown(activeHour) {
    el.hourlyGrid.replaceChildren();
    throughputValues.forEach((val, idx) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "hourly-cell";
      cell.dataset.active = idx === activeHour ? "true" : "false";

      const t = document.createElement("span");
      t.className = "hourly-cell-time";
      t.textContent = formatHour(idx);

      const v = document.createElement("span");
      v.className = "hourly-cell-val";
      v.textContent = String(val);

      cell.append(t, v);
      cell.addEventListener("click", () => {
        state.inspectedHour = idx;
        state.pinnedHour = idx;
        updateChartSelection(idx);
      });
      el.hourlyGrid.appendChild(cell);
    });
  }

  function hasActiveFilters() {
    return (
      state.filters.query.trim() !== "" ||
      state.filters.severity !== "all" ||
      state.filters.status !== "all" ||
      state.filters.service !== "all"
    );
  }

  function getFilteredAndSortedIncidents() {
    const query = state.filters.query.trim().toLowerCase();

    const filtered = state.incidents.filter((inc) => {
      if (state.filters.severity !== "all" && inc.severity !== state.filters.severity) {
        return false;
      }
      if (state.filters.status !== "all" && inc.status !== state.filters.status) {
        return false;
      }
      if (state.filters.service !== "all" && inc.service !== state.filters.service) {
        return false;
      }
      if (query) {
        const haystack = `${inc.id} ${inc.title} ${inc.service} ${inc.owner} ${inc.status} ${inc.severity}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    const { field, direction } = state.sort;
    if (!field) {
      return filtered.sort((a, b) => a.originalIndex - b.originalIndex);
    }

    const dir = direction === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      let cmp = 0;
      if (field === "severity") {
        cmp = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      } else if (field === "age") {
        cmp = parseAgeMinutes(a.age) - parseAgeMinutes(b.age);
      } else if (field === "service") {
        cmp = a.service.localeCompare(b.service);
      } else if (field === "status") {
        cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      }
      if (cmp === 0) cmp = a.originalIndex - b.originalIndex;
      return cmp * dir;
    });
  }

  function describeActiveFilters() {
    const parts = [];
    if (state.filters.query.trim()) parts.push(`Search "${state.filters.query.trim()}"`);
    if (state.filters.severity !== "all") parts.push(`Severity: ${SEVERITY_LABELS[state.filters.severity]}`);
    if (state.filters.status !== "all") parts.push(`Status: ${STATUS_LABELS[state.filters.status]}`);
    if (state.filters.service !== "all") parts.push(`Service: ${state.filters.service}`);
    return parts.join(" · ");
  }

  function renderPostureAndBadges() {
    const unackIncidents = state.incidents.filter((inc) => !inc.acknowledged);
    const unackCritical = unackIncidents.filter((inc) => inc.severity === "critical").length;
    const total = state.incidents.length;

    el.navIncidentCount.textContent = String(unackIncidents.length);

    if (unackCritical > 0) {
      el.posturePill.dataset.posture = "critical";
      el.postureText.textContent = `Degraded · ${unackIncidents.length} unacknowledged (${unackCritical} critical)`;
    } else if (unackIncidents.length > 0) {
      el.posturePill.dataset.posture = "elevated";
      el.postureText.textContent = `Elevated · ${unackIncidents.length} unacknowledged`;
    } else {
      el.posturePill.dataset.posture = "nominal";
      el.postureText.textContent = `Acknowledged · All ${total} triaged`;
    }
  }

  function renderIncidentTable() {
    const visible = getFilteredAndSortedIncidents();
    const total = state.incidents.length;
    const activeFilters = hasActiveFilters();

    el.resetFiltersBtn.hidden = !activeFilters;

    if (activeFilters) {
      el.incidentCountSummary.textContent = `Showing ${visible.length} of ${total} · Filtered`;
    } else {
      el.incidentCountSummary.textContent = `Showing ${visible.length} of ${total}`;
    }

    // Keep selection synchronized with visible rows when rows exist
    if (visible.length > 0 && !visible.some((inc) => inc.id === state.selectedIncidentId)) {
      state.selectedIncidentId = visible[0].id;
    }

    // Update aria-sort headers
    document.querySelectorAll(".incident-table thead th").forEach((th) => {
      const btn = th.querySelector(".sort-btn[data-sort]");
      if (!btn) return;
      const field = btn.dataset.sort;
      if (state.sort.field === field) {
        th.setAttribute("aria-sort", state.sort.direction === "asc" ? "ascending" : "descending");
      } else {
        th.setAttribute("aria-sort", "none");
      }
    });

    el.incidentTbody.replaceChildren();

    if (visible.length === 0) {
      el.incidentTable.hidden = true;
      el.tableEmptyState.hidden = false;

      if (state.filters.status === "acknowledged" && state.incidents.every((i) => !i.acknowledged)) {
        el.emptyTitle.textContent = "No acknowledged incidents yet";
        el.emptyDesc.textContent = "Acknowledge an active incident from the inspector panel, or reset filters to view open incidents.";
      } else {
        el.emptyTitle.textContent = "No incidents match the active filters";
        const activeDesc = describeActiveFilters();
        el.emptyDesc.textContent = activeDesc
          ? `Active filters: ${activeDesc}. Clear filters to restore the full queue.`
          : "Try clearing search terms or switching severity and status filters.";
      }

      renderDetailPanel(visible);
      return;
    }

    el.incidentTable.hidden = false;
    el.tableEmptyState.hidden = true;

    visible.forEach((inc, rowIndex) => {
      const tr = document.createElement("tr");
      tr.className = "incident-row";
      const isSelected = inc.id === state.selectedIncidentId;
      tr.dataset.selected = isSelected ? "true" : "false";
      tr.dataset.incidentId = inc.id;

      // 1. Severity
      const tdSev = document.createElement("td");
      tdSev.className = "col-severity";
      tdSev.appendChild(createSeverityBadge(inc.severity));

      // 2. Incident (ID + Title button)
      const tdInc = document.createElement("td");
      tdInc.className = "col-incident";
      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.className = "incident-select-btn";
      selectBtn.setAttribute("aria-pressed", isSelected ? "true" : "false");

      const idSpan = document.createElement("span");
      idSpan.className = "inc-id";
      idSpan.textContent = inc.id;

      const titleSpan = document.createElement("span");
      titleSpan.className = "inc-title";
      titleSpan.textContent = inc.title;

      selectBtn.append(idSpan, titleSpan);
      selectBtn.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const buttons = Array.from(el.incidentTbody.querySelectorAll(".incident-select-btn"));
          const nextIdx = event.key === "ArrowDown"
            ? Math.min(buttons.length - 1, rowIndex + 1)
            : Math.max(0, rowIndex - 1);
          if (nextIdx !== rowIndex && buttons[nextIdx]) {
            event.preventDefault();
            const nextId = buttons[nextIdx].closest("tr").dataset.incidentId;
            selectIncident(nextId, { focusRowButton: true });
          }
        }
      });
      tdInc.appendChild(selectBtn);

      // 3. Service
      const tdService = document.createElement("td");
      tdService.className = "col-service";
      const svcSpan = document.createElement("span");
      svcSpan.className = "service-tag";
      svcSpan.textContent = inc.service;
      tdService.appendChild(svcSpan);

      // 4. Age
      const tdAge = document.createElement("td");
      tdAge.className = "col-age";
      const ageSpan = document.createElement("span");
      ageSpan.className = "age-val";
      ageSpan.textContent = inc.age;
      tdAge.appendChild(ageSpan);

      // 5. Owner
      const tdOwner = document.createElement("td");
      tdOwner.className = "col-owner";
      const ownerSpan = document.createElement("span");
      ownerSpan.className = `owner-val${inc.owner === "Unassigned" ? " is-unassigned" : ""}`;
      ownerSpan.textContent = inc.owner;
      tdOwner.appendChild(ownerSpan);

      // 6. Status
      const tdStatus = document.createElement("td");
      tdStatus.className = "col-status";
      tdStatus.appendChild(createStatusBadge(inc.status));

      tr.append(tdSev, tdInc, tdService, tdAge, tdOwner, tdStatus);

      tr.addEventListener("click", (event) => {
        if (event.target.closest("a, input, select")) return;
        selectIncident(inc.id, { focusRowButton: false });
      });

      el.incidentTbody.appendChild(tr);
    });

    renderDetailPanel(visible);
  }

  function selectIncident(id, options = {}) {
    state.selectedIncidentId = id;
    renderIncidentTable();
    if (options.focusRowButton) {
      const btn = el.incidentTbody.querySelector(`tr[data-incident-id="${id}"] .incident-select-btn`);
      if (btn) btn.focus();
    }
  }

  function acknowledgeIncident(id) {
    const inc = state.incidents.find((item) => item.id === id);
    if (!inc || inc.acknowledged) return;

    inc.previousStatus = inc.status;
    inc.acknowledged = true;
    inc.status = "acknowledged";
    inc.acknowledgedBy = CURRENT_OPERATOR;
    inc.acknowledgedAt = "Just now";

    let noteText = `Acknowledged by ${CURRENT_OPERATOR}`;
    if (inc.owner === "Unassigned") {
      inc.owner = CURRENT_OPERATOR;
      noteText += " (auto-assigned owner)";
    }

    inc.timeline.unshift({
      time: "Now",
      text: noteText,
      kind: "ack"
    });

    renderPostureAndBadges();
    renderIncidentTable();
    renderServicesView();
    announce(`${inc.id} acknowledged by ${CURRENT_OPERATOR}`);
  }

  function reopenIncident(id) {
    const inc = state.incidents.find((item) => item.id === id);
    if (!inc || !inc.acknowledged) return;

    inc.acknowledged = false;
    inc.status = inc.previousStatus || "open";
    inc.acknowledgedBy = null;
    inc.acknowledgedAt = null;
    inc.timeline.unshift({
      time: "Now",
      text: `Reopened to ${STATUS_LABELS[inc.status]} by ${CURRENT_OPERATOR}`,
      kind: "system"
    });

    renderPostureAndBadges();
    renderIncidentTable();
    renderServicesView();
    announce(`${inc.id} reopened to ${STATUS_LABELS[inc.status]}`);
  }

  function addTimelineNote(id, rawText) {
    const text = rawText.trim();
    if (!text) return;
    const inc = state.incidents.find((item) => item.id === id);
    if (!inc) return;

    inc.timeline.unshift({
      time: "Now",
      text: `${CURRENT_OPERATOR}: ${text}`,
      kind: "note"
    });

    renderDetailPanel(getFilteredAndSortedIncidents());
    announce(`Note added to ${inc.id}`);
  }

  function renderDetailPanel(visibleIncidents) {
    if (visibleIncidents.length === 0) {
      el.detailSubtitle.textContent = "No match";
      el.detailFilterNote.hidden = true;
      el.detailBody.hidden = true;
      el.detailEmpty.hidden = false;
      return;
    }

    const inc = state.incidents.find((item) => item.id === state.selectedIncidentId) || visibleIncidents[0];
    el.detailEmpty.hidden = true;
    el.detailBody.hidden = false;
    el.detailSubtitle.textContent = inc.id;
    el.detailFilterNote.hidden = visibleIncidents.some((v) => v.id === inc.id);

    el.detailBody.replaceChildren();

    // Top block: badges + title
    const top = document.createElement("div");
    top.className = "detail-top";

    const badges = document.createElement("div");
    badges.className = "detail-badges";
    badges.append(createSeverityBadge(inc.severity), createStatusBadge(inc.status));

    const title = document.createElement("h3");
    title.className = "detail-title";
    title.textContent = inc.title;

    top.append(badges, title);

    // Actions row (Acknowledge + optional Reopen / Claim)
    const actions = document.createElement("div");
    actions.className = "detail-actions";

    const ackBtn = document.createElement("button");
    ackBtn.type = "button";
    ackBtn.className = "btn-primary";
    ackBtn.id = "acknowledge-btn";

    if (inc.acknowledged) {
      ackBtn.disabled = true;
      ackBtn.textContent = `Acknowledged · ${inc.acknowledgedAt}`;

      const reopenBtn = document.createElement("button");
      reopenBtn.type = "button";
      reopenBtn.id = "reopen-btn";
      reopenBtn.className = "btn-secondary btn-reopen";
      reopenBtn.textContent = "Reopen";
      reopenBtn.addEventListener("click", () => {
        reopenIncident(inc.id);
        const nextAck = document.getElementById("acknowledge-btn");
        if (nextAck) nextAck.focus();
      });

      actions.append(ackBtn, reopenBtn);
    } else {
      ackBtn.textContent = "Acknowledge incident";
      ackBtn.addEventListener("click", () => {
        acknowledgeIncident(inc.id);
        const reopen = document.getElementById("reopen-btn");
        if (reopen) reopen.focus();
      });
      actions.appendChild(ackBtn);

      if (inc.owner === "Unassigned") {
        const claimBtn = document.createElement("button");
        claimBtn.type = "button";
        claimBtn.className = "btn-secondary";
        claimBtn.textContent = "Claim";
        claimBtn.addEventListener("click", () => {
          inc.owner = CURRENT_OPERATOR;
          inc.timeline.unshift({
            time: "Now",
            text: `Owner claimed by ${CURRENT_OPERATOR}`,
            kind: "note"
          });
          renderIncidentTable();
          renderServicesView();
          announce(`${inc.id} assigned to ${CURRENT_OPERATOR}`);
          const nextAck = document.getElementById("acknowledge-btn");
          if (nextAck) nextAck.focus();
        });
        actions.appendChild(claimBtn);
      }
    }

    // Metadata grid
    const metaGrid = document.createElement("dl");
    metaGrid.className = "detail-meta-grid";
    metaGrid.style.margin = "0";

    const metaPairs = [
      { label: "Service", value: inc.service, mono: true },
      { label: "Owner", value: inc.owner, mono: false },
      { label: "Age", value: inc.age, mono: true },
      {
        label: "Acknowledgement",
        value: inc.acknowledged ? `${inc.acknowledgedBy} (${inc.acknowledgedAt})` : "Pending ack",
        mono: false
      },
      { label: "Region", value: inc.region, mono: true, wide: true },
      { label: "Runbook", value: inc.runbook, mono: false, wide: true }
    ];

    metaPairs.forEach((pair) => {
      const item = document.createElement("div");
      item.className = `meta-item${pair.wide ? " is-wide" : ""}`;

      const dt = document.createElement("dt");
      dt.className = "meta-item-label";
      dt.textContent = pair.label;

      const dd = document.createElement("dd");
      dd.className = `meta-item-value${pair.mono ? " mono" : ""}`;
      dd.style.margin = "0";
      dd.textContent = pair.value;
      dd.title = pair.value;

      item.append(dt, dd);
      metaGrid.appendChild(item);
    });

    // Signal block
    const signalBlock = document.createElement("div");
    signalBlock.className = "detail-block";
    const signalHeading = document.createElement("h4");
    signalHeading.className = "detail-block-title";
    signalHeading.textContent = "Trigger signal";
    const signalCode = document.createElement("div");
    signalCode.className = "detail-signal";
    signalCode.textContent = inc.signal;
    signalBlock.append(signalHeading, signalCode);

    // Impact block
    const impactBlock = document.createElement("div");
    impactBlock.className = "detail-block";
    const impactHeading = document.createElement("h4");
    impactHeading.className = "detail-block-title";
    impactHeading.textContent = "Operational impact";
    const impactText = document.createElement("p");
    impactText.className = "detail-impact-text";
    impactText.textContent = inc.impact;
    impactBlock.append(impactHeading, impactText);

    // Timeline block
    const timelineBlock = document.createElement("div");
    timelineBlock.className = "detail-block";
    const timelineHeading = document.createElement("h4");
    timelineHeading.className = "detail-block-title";
    timelineHeading.textContent = "Event timeline";

    const list = document.createElement("ul");
    list.className = "timeline-list";
    inc.timeline.forEach((entry) => {
      const li = document.createElement("li");
      li.className = `timeline-item${entry.kind === "ack" ? " is-ack" : ""}`;

      const time = document.createElement("span");
      time.className = "timeline-time";
      time.textContent = entry.time;

      const txt = document.createElement("span");
      txt.className = "timeline-text";
      txt.textContent = entry.text;

      li.append(time, txt);
      list.appendChild(li);
    });

    const noteForm = document.createElement("form");
    noteForm.className = "note-form";
    const noteLabel = document.createElement("label");
    noteLabel.className = "sr-only";
    noteLabel.setAttribute("for", "operator-note-input");
    noteLabel.textContent = "Add timeline note";

    const noteInput = document.createElement("input");
    noteInput.id = "operator-note-input";
    noteInput.type = "text";
    noteInput.className = "note-input";
    noteInput.placeholder = "Log operator note…";
    noteInput.maxLength = 140;

    const noteSubmit = document.createElement("button");
    noteSubmit.type = "submit";
    noteSubmit.className = "btn-secondary";
    noteSubmit.textContent = "Log";

    noteForm.append(noteLabel, noteInput, noteSubmit);
    noteForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!noteInput.value.trim()) return;
      addTimelineNote(inc.id, noteInput.value);
    });

    timelineBlock.append(timelineHeading, list, noteForm);

    el.detailBody.append(top, actions, metaGrid, signalBlock, impactBlock, timelineBlock);
  }

  function renderServicesView() {
    el.servicesGrid.replaceChildren();
    const serviceNames = Array.from(new Set(state.incidents.map((inc) => inc.service)));

    serviceNames.forEach((svcName) => {
      const linked = state.incidents.filter((inc) => inc.service === svcName);
      const topInc = linked.slice().sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];
      const unackCount = linked.filter((i) => !i.acknowledged).length;

      const card = document.createElement("article");
      card.className = "service-card";

      const top = document.createElement("div");
      top.className = "service-card-top";

      const name = document.createElement("span");
      name.className = "service-card-name";
      name.textContent = svcName;

      top.append(name, createSeverityBadge(topInc.severity));

      const meta = document.createElement("div");
      meta.className = "service-card-meta";

      const regionSpan = document.createElement("span");
      regionSpan.className = "mono";
      regionSpan.textContent = topInc.region;

      const countSpan = document.createElement("span");
      countSpan.textContent = unackCount > 0 ? `${unackCount} unacknowledged` : "All acknowledged";

      meta.append(regionSpan, countSpan);

      const summary = document.createElement("p");
      summary.className = "detail-impact-text";
      summary.textContent = `${topInc.id}: ${topInc.title} (${topInc.age})`;

      const btnRow = document.createElement("div");
      const filterBtn = document.createElement("button");
      filterBtn.type = "button";
      filterBtn.className = "btn-secondary";
      filterBtn.textContent = `Filter queue by ${svcName}`;
      filterBtn.addEventListener("click", () => {
        state.filters.service = svcName;
        el.filterService.value = svcName;
        setActiveView("incidents");
        renderIncidentTable();
      });
      btnRow.appendChild(filterBtn);

      card.append(top, meta, summary, btnRow);
      el.servicesGrid.appendChild(card);
    });
  }

  function setActiveView(view) {
    state.activeView = view;

    el.navButtons.forEach((btn) => {
      const isCurrent = btn.dataset.view === view;
      if (isCurrent) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });

    const titles = {
      overview: "Operations Overview",
      incidents: "Incident Queue",
      throughput: "24-Hour Throughput",
      services: "Service Health"
    };
    el.viewTitle.textContent = titles[view] || "Operations Overview";

    el.metricsSection.hidden = view === "incidents" || view === "services";
    el.throughputSection.hidden = view === "incidents" || view === "services";
    el.hourlyBreakdown.hidden = view !== "throughput";
    el.incidentsSection.hidden = view === "throughput" || view === "services";
    el.servicesSection.hidden = view !== "services";
  }

  function resetAllFilters() {
    state.filters.query = "";
    state.filters.severity = "all";
    state.filters.status = "all";
    state.filters.service = "all";

    el.filterSearch.value = "";
    el.filterStatus.value = "all";
    el.filterService.value = "all";
    el.severityButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.severity === "all" ? "true" : "false");
    });

    renderIncidentTable();
    announce("All incident filters cleared");
  }

  function bindEvents() {
    el.navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveView(btn.dataset.view);
      });
    });

    el.modeBarsBtn.addEventListener("click", () => {
      state.chartMode = "bars";
      el.modeBarsBtn.setAttribute("aria-pressed", "true");
      el.modeLineBtn.setAttribute("aria-pressed", "false");
      renderThroughputChart();
    });

    el.modeLineBtn.addEventListener("click", () => {
      state.chartMode = "line";
      el.modeBarsBtn.setAttribute("aria-pressed", "false");
      el.modeLineBtn.setAttribute("aria-pressed", "true");
      renderThroughputChart();
    });

    el.filterSearch.addEventListener("input", () => {
      state.filters.query = el.filterSearch.value;
      renderIncidentTable();
    });

    el.severityButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const sev = btn.dataset.severity;
        state.filters.severity = sev;
        el.severityButtons.forEach((b) => {
          b.setAttribute("aria-pressed", b.dataset.severity === sev ? "true" : "false");
        });
        renderIncidentTable();
      });
    });

    el.filterStatus.addEventListener("change", () => {
      state.filters.status = el.filterStatus.value;
      renderIncidentTable();
    });

    el.filterService.addEventListener("change", () => {
      state.filters.service = el.filterService.value;
      renderIncidentTable();
    });

    el.sortButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const field = btn.dataset.sort;
        if (state.sort.field === field) {
          if (state.sort.direction === "asc") {
            state.sort.direction = "desc";
          } else {
            state.sort.field = null;
            state.sort.direction = "asc";
          }
        } else {
          state.sort.field = field;
          state.sort.direction = "asc";
        }
        renderIncidentTable();
      });
    });

    el.resetFiltersBtn.addEventListener("click", () => {
      resetAllFilters();
      el.filterSearch.focus();
    });

    el.emptyResetBtn.addEventListener("click", () => {
      resetAllFilters();
      el.filterSearch.focus();
    });

    // Global operator shortcuts
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isEditing = target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );

      if (event.key === "Escape" && target === el.filterSearch && el.filterSearch.value) {
        event.preventDefault();
        el.filterSearch.value = "";
        state.filters.query = "";
        renderIncidentTable();
        return;
      }

      if (isEditing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "/") {
        if (state.activeView === "overview" || state.activeView === "incidents") {
          event.preventDefault();
          el.filterSearch.focus();
        }
      } else if (event.key.toLowerCase() === "a") {
        if (state.activeView === "overview" || state.activeView === "incidents") {
          const visible = getFilteredAndSortedIncidents();
          if (visible.length > 0 && state.selectedIncidentId) {
            const inc = state.incidents.find((i) => i.id === state.selectedIncidentId);
            if (inc && !inc.acknowledged) {
              event.preventDefault();
              acknowledgeIncident(inc.id);
            }
          }
        }
      }
    });
  }

  let lastCompactChart = window.innerWidth <= 640;
  window.addEventListener("resize", () => {
    const isCompact = window.innerWidth <= 640;
    if (isCompact !== lastCompactChart) {
      lastCompactChart = isCompact;
      renderThroughputChart();
    }
  });

  function init() {
    populateServiceFilter();
    renderMetrics();
    renderThroughputChart();
    renderPostureAndBadges();
    renderIncidentTable();
    renderServicesView();
    bindEvents();
    setActiveView("overview");
  }

  init();
})();
