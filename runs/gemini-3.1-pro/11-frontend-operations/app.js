/**
 * RELAY — Operations Control Room
 * Pure Vanilla JavaScript: Telemetry stream, state management,
 * keyboard accessibility, and real-time incident workflow.
 */

(function () {
  'use strict';

  // Fallback seed data identical to DATA.json
  const FALLBACK_DATA = {
    "metrics": [
      { "label": "Events / min", "value": "18,420", "change": "+8.2%", "direction": "up" },
      { "label": "P95 latency", "value": "184 ms", "change": "−12 ms", "direction": "down" },
      { "label": "Error rate", "value": "0.37%", "change": "+0.08 pp", "direction": "up" },
      { "label": "Queue depth", "value": "2,841", "change": "−19%", "direction": "down" }
    ],
    "throughput": [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    "incidents": [
      { "id": "INC-2841", "severity": "critical", "service": "payments-api", "age": "12m", "owner": "M. Chen", "status": "investigating", "title": "Card authorization timeouts" },
      { "id": "INC-2839", "severity": "high", "service": "event-router", "age": "31m", "owner": "Unassigned", "status": "open", "title": "EU retry queue growth" },
      { "id": "INC-2837", "severity": "medium", "service": "search-index", "age": "1h 08m", "owner": "A. Silva", "status": "monitoring", "title": "Index freshness outside SLO" },
      { "id": "INC-2832", "severity": "low", "service": "webhooks", "age": "3h 42m", "owner": "R. Patel", "status": "open", "title": "Elevated partner delivery lag" }
    ]
  };

  // Diagnostic metadata & runbooks to enrich seed data
  const INCIDENT_METADATA = {
    "INC-2841": {
      slo: "BREACHED (SLO < 200ms)",
      runbook: "RB-PAY-04: Auth Gateway Failover",
      telemetry: "POST /v1/charges/authorize: 504 Gateway Timeout rate spiked to 4.2%. Downstream issuer proxy pool unresponsive.",
      initialLog: [
        { time: "T-12m", msg: "Synthetic healthcheck failed on primary gateway cluster." },
        { time: "T-10m", msg: "PagerDuty triggered tier-1 escalation to on-call." },
        { time: "T-06m", msg: "M. Chen joined triage bridge, initial diagnostic initiated." }
      ]
    },
    "INC-2839": {
      slo: "WARNING (Queue > 20k)",
      runbook: "RB-EVT-12: Backpressure Shedding",
      telemetry: "Dead letter queue depth reached 22,400 messages across eu-west-1 consumer groups.",
      initialLog: [
        { time: "T-31m", msg: "High retry consumer backpressure detected in Frankfurt region." },
        { time: "T-22m", msg: "Automated rate limiting engaged on ingress ingress-router-04." }
      ]
    },
    "INC-2837": {
      slo: "SLO RISK (Freshness > 5m)",
      runbook: "RB-SRCH-02: Elastic Bulk Shard Recovery",
      telemetry: "Segment replication lag: 420s on cluster elastic-prod-blue. Index mutation rate exceeds write capacity.",
      initialLog: [
        { time: "T-1h 08m", msg: "Replication lag exceeded 300s SLA threshold." },
        { time: "T-45m", msg: "A. Silva assigned, throttling background compaction tasks." }
      ]
    },
    "INC-2832": {
      slo: "MONITORING (Delivery > 2s)",
      runbook: "RB-WH-09: Egress Rate Limiter Check",
      telemetry: "Delivery queue p99 latency at 2,410ms to tier-2 webhooks endpoints.",
      initialLog: [
        { time: "T-3h 42m", msg: "Webhook latency alert threshold exceeded for 3 consecutive intervals." },
        { time: "T-3h 10m", msg: "R. Patel reviewed egress socket pool health." }
      ]
    }
  };

  // Application State
  const state = {
    metrics: [],
    throughput: [],
    incidents: [],
    activityLogs: {},
    selectedIncidentId: "INC-2841",
    chartMode: "area", // 'area' or 'bars'
    filters: {
      search: "",
      severity: "all",
      status: "all",
      service: "all"
    },
    sort: {
      column: "severity",
      direction: "asc" // 'asc' or 'desc'
    }
  };

  // Severity Weight for sorting
  const SEVERITY_WEIGHT = {
    "critical": 1,
    "high": 2,
    "medium": 3,
    "low": 4
  };

  /**
   * Initialize Application
   */
  async function init() {
    try {
      // Attempt local fetch of DATA.json, fall back smoothly if running on file:// or network restricted
      const response = await fetch("DATA.json");
      if (response.ok) {
        const data = await response.json();
        loadData(data);
      } else {
        loadData(FALLBACK_DATA);
      }
    } catch (e) {
      // Local file or fetch restriction - seamlessly use fallback
      loadData(FALLBACK_DATA);
    }

    setupClock();
    setupEventListeners();
    renderAll();
  }

  /**
   * Load seed data into state
   */
  function loadData(data) {
    state.metrics = data.metrics || FALLBACK_DATA.metrics;
    state.throughput = data.throughput || FALLBACK_DATA.throughput;
    state.incidents = (data.incidents || FALLBACK_DATA.incidents).map(inc => ({ ...inc }));

    // Initialize activity logs
    state.incidents.forEach(inc => {
      const meta = INCIDENT_METADATA[inc.id] || {
        slo: "MONITORING",
        runbook: "RB-GEN-01: Standard Incident Response",
        telemetry: "Telemetry metrics within nominal tolerances.",
        initialLog: [{ time: "T-" + inc.age, msg: "Incident created." }]
      };

      state.activityLogs[inc.id] = [
        ...meta.initialLog,
        { time: "NOW", msg: `Current status: ${inc.status.toUpperCase()} (${inc.owner})` }
      ];
    });

    // Default selection
    if (state.incidents.length > 0 && !state.selectedIncidentId) {
      state.selectedIncidentId = state.incidents[0].id;
    }
  }

  /**
   * Live Clocks (UTC & Local)
   */
  function setupClock() {
    const utcEl = document.getElementById("clock-utc");
    const localEl = document.getElementById("clock-local");

    function update() {
      const now = new Date();
      if (utcEl) utcEl.textContent = now.toUTCString().slice(17, 25);
      if (localEl) {
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        localEl.textContent = `${hrs}:${mins}:${secs}`;
      }
    }
    update();
    setInterval(update, 1000);
  }

  /**
   * Render All Dashboard Modules
   */
  function renderAll() {
    renderTopStatusBar();
    renderSummaryMetrics();
    renderThroughputChart();
    renderIncidentsTable();
    renderIncidentDetail();
  }

  /**
   * Render Top Status Bar indicators
   */
  function renderTopStatusBar() {
    const railBadge = document.getElementById("rail-incident-badge");
    const headerCount = document.getElementById("incident-header-count");
    const topPill = document.getElementById("top-health-pill");
    const topDetail = document.getElementById("top-health-detail");

    const activeIncidents = state.incidents.filter(i => i.status !== "resolved");
    const critCount = state.incidents.filter(i => i.severity === "critical" && i.status !== "resolved").length;
    const highCount = state.incidents.filter(i => i.severity === "high" && i.status !== "resolved").length;

    if (railBadge) railBadge.textContent = activeIncidents.length;
    if (headerCount) headerCount.textContent = `${activeIncidents.length} Active`;

    if (critCount > 0) {
      if (topPill) {
        topPill.className = "operational-health-pill status-degraded";
        topPill.querySelector(".health-label").textContent = "SYSTEM DEGRADED";
      }
      if (topDetail) topDetail.textContent = `${critCount} CRITICAL • ${highCount} HIGH`;
    } else if (highCount > 0) {
      if (topPill) {
        topPill.className = "operational-health-pill status-degraded";
        topPill.style.backgroundColor = "var(--sev-high-bg)";
        topPill.style.borderColor = "var(--sev-high-border)";
        topPill.style.color = "var(--sev-high-fg)";
        topPill.querySelector(".health-label").textContent = "DEGRADED (HIGH)";
      }
      if (topDetail) topDetail.textContent = `${highCount} HIGH ACTIVE`;
    } else {
      if (topPill) {
        topPill.className = "operational-health-pill";
        topPill.style.backgroundColor = "var(--status-ok-bg)";
        topPill.style.borderColor = "var(--status-ok-border)";
        topPill.style.color = "var(--status-ok-fg)";
        topPill.querySelector(".health-label").textContent = "SYSTEM OPERATIONAL";
      }
      if (topDetail) topDetail.textContent = "NOMINAL • 0 CRITICAL";
    }
  }

  /**
   * Render Four Summary Metrics with Trend Context
   */
  function renderSummaryMetrics() {
    const container = document.getElementById("metrics-grid");
    if (!container) return;

    // Context metadata for each of the 4 metrics
    const METRIC_CONTEXTS = [
      {
        tag: "NORMAL",
        tagType: "tag-ok",
        trendType: "trend-neutral",
        context: "SLO Target: > 15k / min",
        sparklinePoints: [22, 24, 25, 23, 27, 30, 31, 33]
      },
      {
        tag: "WITHIN SLO",
        tagType: "tag-ok",
        trendType: "trend-positive", // Latency decrease is good
        context: "SLO Budget: < 200 ms",
        sparklinePoints: [32, 30, 29, 27, 26, 25, 24, 22]
      },
      {
        tag: "ELEVATED",
        tagType: "tag-warn",
        trendType: "trend-negative", // Error rate increase is bad
        context: "SLO Target: < 0.10% (BREACH)",
        sparklinePoints: [10, 11, 12, 14, 18, 22, 28, 34]
      },
      {
        tag: "DRAINING",
        tagType: "tag-ok",
        trendType: "trend-positive", // Queue decrease is good
        context: "Drain Rate: ~420 / min",
        sparklinePoints: [38, 36, 33, 31, 28, 24, 21, 18]
      }
    ];

    container.innerHTML = state.metrics.map((m, idx) => {
      const ctx = METRIC_CONTEXTS[idx] || METRIC_CONTEXTS[0];
      const arrow = m.direction === "up" ? "▲" : "▼";

      // Generate mini sparkline SVG
      const sparkSvg = generateSparkline(ctx.sparklinePoints, ctx.trendType);

      return `
        <article class="metric-card" aria-label="${m.label}">
          <div class="metric-card-top">
            <span class="metric-label">${escapeHtml(m.label)}</span>
            <span class="metric-status-tag ${ctx.tagType}">${ctx.tag}</span>
          </div>

          <div class="metric-card-body">
            <span class="metric-main-value font-mono">${escapeHtml(m.value)}</span>
            <span class="metric-trend-pill ${ctx.trendType}">
              <span>${arrow}</span>
              <span>${escapeHtml(m.change)}</span>
            </span>
          </div>

          <div class="metric-card-bottom">
            <span class="metric-context-text">${ctx.context}</span>
            <div class="metric-sparkline-svg" aria-hidden="true">
              ${sparkSvg}
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  /**
   * Helper to build inline SVG sparkline
   */
  function generateSparkline(points, trendType) {
    const width = 68;
    const height = 20;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = (max - min) || 1;

    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * (width - 4) + 2;
      const y = height - 3 - ((p - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    let strokeColor = "var(--text-secondary)";
    if (trendType === "trend-positive") strokeColor = "var(--status-ok-fg)";
    if (trendType === "trend-negative") strokeColor = "var(--sev-crit-fg)";

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <polyline points="${coords}" fill="none" stroke="${strokeColor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
  }

  /**
   * Render 24-Hour Throughput Visualization (Inline SVG)
   */
  function renderThroughputChart() {
    const container = document.getElementById("throughput-chart-container");
    if (!container) return;

    const data = state.throughput;
    const peakVal = Math.max(...data);
    const meanVal = (data.reduce((a, b) => a + b, 0) / data.length).toFixed(1);

    const svgWidth = 840;
    const svgHeight = 180;
    const padLeft = 45;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 30;

    const chartW = svgWidth - padLeft - padRight;
    const chartH = svgHeight - padTop - padBottom;

    // Y scale range 0 to 100k eps
    const yMax = 100;
    const getY = (val) => padTop + chartH - (val / yMax) * chartH;
    const getX = (i) => padLeft + (i / (data.length - 1)) * chartW;

    // Grid lines at 25, 50, 75, 100
    const gridYValues = [0, 25, 50, 75, 100];
    const gridLinesSvg = gridYValues.map(v => {
      const y = getY(v);
      return `
        <line x1="${padLeft}" y1="${y}" x2="${svgWidth - padRight}" y2="${y}" class="chart-grid-line" />
        <text x="${padLeft - 6}" y="${y}" class="chart-axis-label">${v}k</text>
      `;
    }).join("");

    // X Axis hourly labels: -24h, -20h, -16h, -12h, -8h, -4h, Now
    const xIntervals = [0, 4, 8, 12, 16, 20, 23];
    const xLabelsSvg = xIntervals.map(i => {
      const x = getX(i);
      const label = i === 23 ? "NOW" : `T-${24 - i}h`;
      return `
        <line x1="${x}" y1="${padTop + chartH}" x2="${x}" y2="${padTop + chartH + 4}" stroke="var(--border-strong)" stroke-width="1" />
        <text x="${x}" y="${padTop + chartH + 16}" class="chart-x-label">${label}</text>
      `;
    }).join("");

    // Baseline Mean Line
    const avgY = getY(parseFloat(meanVal));
    const meanLineSvg = `
      <line x1="${padLeft}" y1="${avgY}" x2="${svgWidth - padRight}" y2="${avgY}" class="chart-avg-line" />
      <text x="${svgWidth - padRight - 4}" y="${avgY - 5}" class="chart-avg-text" text-anchor="end">MEAN: ${meanVal}k eps</text>
    `;

    // Data elements (Area/Stroke OR Bars depending on mode)
    let dataVisualSvg = "";

    if (state.chartMode === "bars") {
      // High-Density Column Bar Chart
      const barStep = chartW / data.length;
      const barWidth = Math.max(barStep - 4, 6);

      dataVisualSvg = data.map((val, i) => {
        const x = padLeft + i * barStep + 2;
        const y = getY(val);
        const h = (padTop + chartH) - y;
        const isPeak = val === peakVal;
        const peakClass = isPeak ? "peak-bar" : "";

        return `
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}"
                class="chart-bar-rect ${peakClass}"
                data-idx="${i}" data-val="${val}" tabindex="0" role="button"
                aria-label="Hour T-${24 - i}h: ${val}k events per second" />
        `;
      }).join("");
    } else {
      // Stepped Area & Polyline with Gradient Fill
      const pts = data.map((val, i) => `${getX(i).toFixed(1)},${getY(val).toFixed(1)}`).join(" ");
      const areaPoints = `${padLeft},${padTop + chartH} ${pts} ${padLeft + chartW},${padTop + chartH}`;

      // Interactive hover dots
      const dotsSvg = data.map((val, i) => {
        const cx = getX(i);
        const cy = getY(val);
        const isPeak = val === peakVal;
        const r = isPeak ? 4.5 : 3;
        return `
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}"
                  class="chart-data-dot ${isPeak ? 'active' : ''}"
                  data-idx="${i}" data-val="${val}" tabindex="0" role="button"
                  aria-label="Hour T-${24 - i}h: ${val}k events per second" />
        `;
      }).join("");

      // Hover hit columns for easier cursor tracking
      const colStep = chartW / (data.length - 1);
      const hitColsSvg = data.map((val, i) => {
        const cx = getX(i);
        const startX = cx - colStep / 2;
        return `
          <rect x="${startX.toFixed(1)}" y="${padTop}" width="${colStep.toFixed(1)}" height="${chartH}"
                class="chart-hover-col" data-idx="${i}" data-val="${val}" />
        `;
      }).join("");

      dataVisualSvg = `
        <polygon points="${areaPoints}" class="chart-area-path" />
        <polyline points="${pts}" class="chart-stroke-path" />
        ${dotsSvg}
        ${hitColsSvg}
      `;
    }

    container.innerHTML = `
      <svg class="chart-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="throughputGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.32" />
            <stop offset="60%" stop-color="#f59e0b" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0" />
          </linearGradient>
        </defs>

        <!-- Background grid -->
        ${gridLinesSvg}
        ${xLabelsSvg}
        ${meanLineSvg}

        <!-- Primary visual -->
        ${dataVisualSvg}
      </svg>
    `;

    // Attach hover & focus handlers to chart data points
    attachChartInteractions();
  }

  /**
   * Chart hover & focus interaction
   */
  function attachChartInteractions() {
    const readout = document.getElementById("throughput-readout");
    const container = document.getElementById("throughput-chart-container");
    if (!readout || !container) return;

    const meanVal = 58.3;

    function showTelemetry(idx, val) {
      const hourStr = idx === 23 ? "CURRENT BUCKET (Now)" : `T-${24 - idx}h (${24 - idx} hours ago)`;
      const delta = (((val - meanVal) / meanVal) * 100).toFixed(1);
      const deltaSign = delta >= 0 ? `+${delta}%` : `${delta}%`;
      const deltaClass = delta >= 0 ? "accent" : "";

      readout.innerHTML = `
        <div class="readout-active">
          <div class="readout-segment">
            <span class="readout-k">WINDOW:</span>
            <span class="readout-v">${hourStr}</span>
          </div>
          <div class="readout-segment">
            <span class="readout-k">THROUGHPUT:</span>
            <span class="readout-v accent">${val},000 eps</span>
          </div>
          <div class="readout-segment">
            <span class="readout-k">VS MEAN:</span>
            <span class="readout-v ${deltaClass}">${deltaSign}</span>
          </div>
        </div>
      `;
    }

    function resetTelemetry() {
      readout.innerHTML = `
        <span class="readout-default">Hover or navigate data points across 24h timeline to inspect telemetry buckets</span>
      `;
    }

    const interactiveEls = container.querySelectorAll("[data-idx]");
    interactiveEls.forEach(el => {
      const idx = parseInt(el.getAttribute("data-idx"), 10);
      const val = parseInt(el.getAttribute("data-val"), 10);

      el.addEventListener("mouseenter", () => showTelemetry(idx, val));
      el.addEventListener("focus", () => showTelemetry(idx, val));
      el.addEventListener("mouseleave", resetTelemetry);
      el.addEventListener("blur", resetTelemetry);
    });
  }

  /**
   * Filter and Sort Incidents
   */
  function getFilteredIncidents() {
    return state.incidents.filter(inc => {
      // Search filter
      if (state.filters.search) {
        const q = state.filters.search.toLowerCase();
        const match =
          inc.id.toLowerCase().includes(q) ||
          inc.title.toLowerCase().includes(q) ||
          inc.service.toLowerCase().includes(q) ||
          inc.owner.toLowerCase().includes(q) ||
          inc.severity.toLowerCase().includes(q) ||
          inc.status.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Severity filter
      if (state.filters.severity !== "all" && inc.severity !== state.filters.severity) {
        return false;
      }

      // Status filter
      if (state.filters.status !== "all" && inc.status !== state.filters.status) {
        return false;
      }

      // Service filter
      if (state.filters.service !== "all" && inc.service !== state.filters.service) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const dir = state.sort.direction === "asc" ? 1 : -1;
      const col = state.sort.column;

      if (col === "severity") {
        return (SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity]) * dir;
      }
      if (col === "age") {
        return parseAge(a.age) > parseAge(b.age) ? dir : -dir;
      }
      if (a[col] < b[col]) return -dir;
      if (a[col] > b[col]) return dir;
      return 0;
    });
  }

  /**
   * Parse age string (e.g. '12m', '1h 08m') to minutes
   */
  function parseAge(ageStr) {
    let total = 0;
    if (ageStr.includes("h")) {
      const parts = ageStr.split("h");
      total += parseInt(parts[0], 10) * 60;
      if (parts[1] && parts[1].includes("m")) {
        total += parseInt(parts[1].replace("m", "").trim(), 10) || 0;
      }
    } else if (ageStr.includes("m")) {
      total += parseInt(ageStr.replace("m", "").trim(), 10) || 0;
    }
    return total;
  }

  /**
   * Render Filterable Incidents Table
   */
  function renderIncidentsTable() {
    const tbody = document.getElementById("incidents-tbody");
    const emptyBox = document.getElementById("table-empty-box");
    const footerStatus = document.getElementById("table-footer-status");
    const resetBtn = document.getElementById("btn-reset-filters");
    if (!tbody) return;

    const filtered = getFilteredIncidents();
    const hasActiveFilters =
      state.filters.search !== "" ||
      state.filters.severity !== "all" ||
      state.filters.status !== "all" ||
      state.filters.service !== "all";

    if (resetBtn) {
      resetBtn.style.display = hasActiveFilters ? "inline-flex" : "none";
    }

    // Update Severity Chip counts
    updateSeverityChipCounts();

    if (filtered.length === 0) {
      tbody.innerHTML = "";
      if (emptyBox) emptyBox.style.display = "flex";
      if (footerStatus) footerStatus.textContent = `Showing 0 of ${state.incidents.length} incidents`;
      renderIncidentDetail(); // Update detail view when selection is hidden
      return;
    }

    if (emptyBox) emptyBox.style.display = "none";
    if (footerStatus) {
      footerStatus.textContent = `Showing ${filtered.length} of ${state.incidents.length} incidents`;
    }

    // Check if current selection is in filtered results; if not, select first
    const isSelectedVisible = filtered.some(i => i.id === state.selectedIncidentId);
    if (!isSelectedVisible && filtered.length > 0) {
      state.selectedIncidentId = filtered[0].id;
    }

    tbody.innerHTML = filtered.map(inc => {
      const isSelected = inc.id === state.selectedIncidentId;
      const rowClass = `incident-row ${isSelected ? 'active' : ''}`;
      const unassignedClass = inc.owner.toLowerCase() === 'unassigned' ? 'unassigned' : '';

      return `
        <tr class="${rowClass}" data-id="${inc.id}" tabindex="0" role="row" aria-selected="${isSelected}">
          <td class="col-sev">
            <span class="sev-badge sev-${inc.severity}">
              <span class="sev-dot" aria-hidden="true"></span>
              <span>${inc.severity.slice(0, 4)}</span>
            </span>
          </td>
          <td class="col-id font-mono">
            <span class="incident-id-link">${inc.id}</span>
          </td>
          <td class="col-title">
            <span class="incident-summary-text">${escapeHtml(inc.title)}</span>
          </td>
          <td class="col-service font-mono">
            <span class="service-code">${escapeHtml(inc.service)}</span>
          </td>
          <td class="col-age cell-age font-mono">${escapeHtml(inc.age)}</td>
          <td class="col-owner cell-owner ${unassignedClass}">${escapeHtml(inc.owner)}</td>
          <td class="col-status">
            <span class="status-badge status-${inc.status}">${escapeHtml(inc.status)}</span>
          </td>
        </tr>
      `;
    }).join("");

    // Attach click and keyboard handlers to rows
    tbody.querySelectorAll(".incident-row").forEach(row => {
      const id = row.getAttribute("data-id");

      row.addEventListener("click", () => {
        selectIncident(id);
      });

      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectIncident(id);
        }
      });
    });

    renderIncidentDetail();
  }

  /**
   * Update count badges on Severity filter chips
   */
  function updateSeverityChipCounts() {
    const chips = document.querySelectorAll("#severity-chip-group .filter-chip");
    chips.forEach(chip => {
      const sev = chip.getAttribute("data-severity");
      let count = 0;
      if (sev === "all") {
        count = state.incidents.length;
        chip.textContent = `All (${count})`;
      } else {
        count = state.incidents.filter(i => i.severity === sev).length;
        const label = sev === "critical" ? "Critical" : sev === "high" ? "High" : sev === "medium" ? "Med" : "Low";
        chip.textContent = `${label} (${count})`;
      }
    });
  }

  /**
   * Select an incident
   */
  function selectIncident(id) {
    if (state.selectedIncidentId === id) return;
    state.selectedIncidentId = id;

    // Update table row styling
    const rows = document.querySelectorAll(".incident-row");
    rows.forEach(r => {
      const match = r.getAttribute("data-id") === id;
      r.classList.toggle("active", match);
      r.setAttribute("aria-selected", match ? "true" : "false");
    });

    renderIncidentDetail();
  }

  /**
   * Render Selected Incident Detail Inspector
   */
  function renderIncidentDetail() {
    const container = document.getElementById("detail-body-container");
    const statusBadge = document.getElementById("inspector-status-badge");
    if (!container) return;

    const incident = state.incidents.find(i => i.id === state.selectedIncidentId);

    if (!incident) {
      if (statusBadge) statusBadge.textContent = "NO SELECTION";
      container.innerHTML = `
        <div class="detail-empty-state">
          <div class="detail-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3 class="detail-empty-title">NO INCIDENT SELECTED</h3>
          <p class="detail-empty-desc">Select an incident from the queue or navigate with keyboard arrows to inspect telemetry, runbooks, and operator actions.</p>
        </div>
      `;
      return;
    }

    if (statusBadge) statusBadge.textContent = incident.id;

    const meta = INCIDENT_METADATA[incident.id] || {
      slo: "SLO RISK",
      runbook: "RB-OPS-01: General Operations",
      telemetry: "Nominal operational telemetry."
    };

    const isAcknowledged = incident.status === "acknowledged" || incident.status === "investigating";
    const isResolved = incident.status === "resolved";
    const logs = state.activityLogs[incident.id] || [];

    const ackButtonLabel = isResolved
      ? "Incident Resolved"
      : incident.status === "acknowledged"
      ? "✓ Acknowledged"
      : incident.status === "investigating"
      ? "✓ In Investigation (Acked)"
      : "Acknowledge Incident";

    const ackButtonDisabled = isResolved || incident.status === "acknowledged" || incident.status === "investigating";

    container.innerHTML = `
      <div class="inspector-card">
        
        <!-- Header: ID, Severity, Title -->
        <div class="incident-key-header">
          <div class="key-title-group">
            <div class="key-id-row">
              <span class="key-id-val">${incident.id}</span>
              <span class="sev-badge sev-${incident.severity}">
                <span class="sev-dot" aria-hidden="true"></span>
                <span>${incident.severity.toUpperCase()}</span>
              </span>
              <span class="status-badge status-${incident.status}">${incident.status}</span>
            </div>
            <h3 class="key-incident-title">${escapeHtml(incident.title)}</h3>
          </div>
        </div>

        <!-- Primary Action Area: Acknowledge & Resolve -->
        <div class="action-box">
          <button id="btn-ack-incident"
                  class="btn-acknowledge ${ackButtonDisabled ? 'is-acked' : ''}"
                  type="button"
                  ${ackButtonDisabled ? 'disabled' : ''}
                  aria-label="Acknowledge incident ${incident.id}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>${ackButtonLabel}</span>
          </button>

          ${!isResolved ? `
            <button id="btn-resolve-incident" class="btn-resolve-secondary" type="button">
              Resolve Incident
            </button>
          ` : ''}
        </div>

        <!-- Key Attributes Grid -->
        <div class="detail-attr-grid">
          <div class="attr-item">
            <span class="attr-label">SERVICE</span>
            <span class="attr-value">${escapeHtml(incident.service)}</span>
          </div>
          <div class="attr-item">
            <span class="attr-label">CURRENT OWNER</span>
            <span class="attr-value">${escapeHtml(incident.owner)}</span>
          </div>
          <div class="attr-item">
            <span class="attr-label">AGE / ELAPSED</span>
            <span class="attr-value">${escapeHtml(incident.age)}</span>
          </div>
          <div class="attr-item">
            <span class="attr-label">SLO STATUS</span>
            <span class="attr-value">${meta.slo}</span>
          </div>
        </div>

        <!-- Diagnostic Telemetry -->
        <div class="detail-diagnostics-box">
          <span class="diag-title">DIAGNOSTIC TELEMETRY</span>
          <pre class="diag-code"><code>${escapeHtml(meta.telemetry)}</code></pre>
          <div class="runbook-link-box">
            <span>RUNBOOK:</span>
            <span class="font-mono">${meta.runbook}</span>
          </div>
        </div>

        <!-- Activity Timeline / Audit Trail -->
        <div class="detail-timeline-box">
          <span class="timeline-title">ACTIVITY LOG & AUDIT TRAIL</span>
          <ul class="timeline-list">
            ${logs.map((log, i) => `
              <li class="timeline-entry">
                <span class="timeline-time">[${log.time}]</span>
                <span class="timeline-msg ${i === logs.length - 1 ? 'highlight' : ''}">${escapeHtml(log.msg)}</span>
              </li>
            `).join("")}
          </ul>
        </div>

      </div>
    `;

    // Attach Acknowledge & Resolve Listeners
    const ackBtn = document.getElementById("btn-ack-incident");
    if (ackBtn && !ackButtonDisabled) {
      ackBtn.addEventListener("click", () => acknowledgeIncident(incident.id));
    }

    const resolveBtn = document.getElementById("btn-resolve-incident");
    if (resolveBtn) {
      resolveBtn.addEventListener("click", () => resolveIncident(incident.id));
    }
  }

  /**
   * Working Acknowledge Action
   */
  function acknowledgeIncident(id) {
    const incident = state.incidents.find(i => i.id === id);
    if (!incident) return;

    if (incident.status === "acknowledged" || incident.status === "investigating") {
      showToast(`Incident ${id} is already acknowledged.`);
      return;
    }

    const prevStatus = incident.status;
    incident.status = "investigating"; // Mark under active investigation
    if (incident.owner === "Unassigned") {
      incident.owner = "M. Chen";
    }

    // Append to audit log
    const now = new Date().toUTCString().slice(17, 25) + " UTC";
    if (!state.activityLogs[id]) state.activityLogs[id] = [];
    state.activityLogs[id].push({
      time: now,
      msg: `Acknowledged by Operator M. Chen (Transitioned ${prevStatus.toUpperCase()} → INVESTIGATING).`
    });

    showToast(`✓ Acknowledged ${id}: Assigned to M. Chen`);
    renderTopStatusBar();
    renderIncidentsTable();
    renderIncidentDetail();
  }

  /**
   * Resolve Action
   */
  function resolveIncident(id) {
    const incident = state.incidents.find(i => i.id === id);
    if (!incident) return;

    incident.status = "resolved";

    const now = new Date().toUTCString().slice(17, 25) + " UTC";
    if (!state.activityLogs[id]) state.activityLogs[id] = [];
    state.activityLogs[id].push({
      time: now,
      msg: `Incident marked RESOLVED by Operator M. Chen.`
    });

    showToast(`✓ Incident ${id} resolved`);
    renderTopStatusBar();
    renderIncidentsTable();
    renderIncidentDetail();
  }

  /**
   * Toast notification feedback
   */
  function showToast(message) {
    const region = document.getElementById("toast-region");
    if (!region) return;

    const toast = document.createElement("div");
    toast.className = "toast-msg success";
    toast.textContent = message;
    region.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  /**
   * Setup Event Listeners for Filters, Sorting, Chart Modes, and Hotkeys
   */
  function setupEventListeners() {
    // 1. Search Input
    const searchInput = document.getElementById("input-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.filters.search = e.target.value.trim();
        renderIncidentsTable();
      });
    }

    // 2. Severity Chip Filters
    const severityChips = document.querySelectorAll("#severity-chip-group .filter-chip");
    severityChips.forEach(chip => {
      chip.addEventListener("click", () => {
        severityChips.forEach(c => {
          c.classList.remove("active");
          c.setAttribute("aria-checked", "false");
        });
        chip.classList.add("active");
        chip.setAttribute("aria-checked", "true");

        state.filters.severity = chip.getAttribute("data-severity");
        renderIncidentsTable();
      });
    });

    // 3. Status Select Filter
    const statusSelect = document.getElementById("select-status");
    if (statusSelect) {
      statusSelect.addEventListener("change", (e) => {
        state.filters.status = e.target.value;
        renderIncidentsTable();
      });
    }

    // 4. Service Select Filter
    const serviceSelect = document.getElementById("select-service");
    if (serviceSelect) {
      serviceSelect.addEventListener("change", (e) => {
        state.filters.service = e.target.value;
        renderIncidentsTable();
      });
    }

    // 5. Reset Filters Buttons
    const resetBtn = document.getElementById("btn-reset-filters");
    const emptyResetBtn = document.getElementById("btn-empty-reset");

    function resetFilters() {
      state.filters.search = "";
      state.filters.severity = "all";
      state.filters.status = "all";
      state.filters.service = "all";

      if (searchInput) searchInput.value = "";
      if (statusSelect) statusSelect.value = "all";
      if (serviceSelect) serviceSelect.value = "all";

      severityChips.forEach(c => {
        const isAll = c.getAttribute("data-severity") === "all";
        c.classList.toggle("active", isAll);
        c.setAttribute("aria-checked", isAll ? "true" : "false");
      });

      renderIncidentsTable();
      showToast("Filter criteria cleared.");
    }

    if (resetBtn) resetBtn.addEventListener("click", resetFilters);
    if (emptyResetBtn) emptyResetBtn.addEventListener("click", resetFilters);

    // 6. Table Column Sorting
    const sortHeaders = document.querySelectorAll(".data-table th[data-col]");
    sortHeaders.forEach(th => {
      th.addEventListener("click", () => {
        const col = th.getAttribute("data-col");
        if (state.sort.column === col) {
          state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
        } else {
          state.sort.column = col;
          state.sort.direction = "asc";
        }

        // Update ARIA sort attributes
        sortHeaders.forEach(h => {
          if (h === th) {
            h.setAttribute("aria-sort", state.sort.direction === "asc" ? "ascending" : "descending");
          } else {
            h.setAttribute("aria-sort", "none");
          }
        });

        renderIncidentsTable();
      });
    });

    // 7. Chart Rendering Mode Toggles (Area vs Bars)
    const btnArea = document.getElementById("btn-chart-mode-area");
    const btnBars = document.getElementById("btn-chart-mode-bars");

    if (btnArea && btnBars) {
      btnArea.addEventListener("click", () => {
        state.chartMode = "area";
        btnArea.classList.add("active");
        btnArea.setAttribute("aria-pressed", "true");
        btnBars.classList.remove("active");
        btnBars.setAttribute("aria-pressed", "false");
        renderThroughputChart();
      });

      btnBars.addEventListener("click", () => {
        state.chartMode = "bars";
        btnBars.classList.add("active");
        btnBars.setAttribute("aria-pressed", "true");
        btnArea.classList.remove("active");
        btnArea.setAttribute("aria-pressed", "false");
        renderThroughputChart();
      });
    }

    // 8. Manual Sync Button
    const syncBtn = document.getElementById("btn-manual-sync");
    if (syncBtn) {
      syncBtn.addEventListener("click", () => {
        showToast("Synchronized telemetry with US-EAST cluster.");
      });
    }

    // 9. Keyboard Navigation & Hotkeys
    document.addEventListener("keydown", handleKeyboardNavigation);
  }

  /**
   * Keyboard Shortcuts & Table Navigation
   */
  function handleKeyboardNavigation(e) {
    // Avoid capturing shortcuts when user is typing in search or select
    const activeTagName = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
    const isTyping = activeTagName === "input" || activeTagName === "select" || activeTagName === "textarea";

    // Shortcut: '/' to focus search
    if (e.key === "/" && !isTyping) {
      e.preventDefault();
      const searchInput = document.getElementById("input-search");
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
      return;
    }

    // Shortcut: 'Escape' to clear search / blur
    if (e.key === "Escape") {
      const searchInput = document.getElementById("input-search");
      if (searchInput && document.activeElement === searchInput) {
        searchInput.value = "";
        state.filters.search = "";
        searchInput.blur();
        renderIncidentsTable();
      }
      return;
    }

    // Shortcut: 'A' to Acknowledge selected incident
    if ((e.key === "a" || e.key === "A") && !isTyping) {
      if (state.selectedIncidentId) {
        e.preventDefault();
        acknowledgeIncident(state.selectedIncidentId);
      }
      return;
    }

    // Up / Down Arrow navigation through visible table rows
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !isTyping) {
      const visibleIncidents = getFilteredIncidents();
      if (visibleIncidents.length === 0) return;

      e.preventDefault();
      const currentIndex = visibleIncidents.findIndex(i => i.id === state.selectedIncidentId);
      let nextIndex = 0;

      if (e.key === "ArrowDown") {
        nextIndex = currentIndex < visibleIncidents.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : visibleIncidents.length - 1;
      }

      const nextIncident = visibleIncidents[nextIndex];
      if (nextIncident) {
        selectIncident(nextIncident.id);

        // Bring row into view if scrolled
        const row = document.querySelector(`.incident-row[data-id="${nextIncident.id}"]`);
        if (row) {
          row.scrollIntoView({ block: "nearest" });
          row.focus();
        }
      }
    }
  }

  /**
   * Escape HTML utility
   */
  function escapeHtml(str) {
    if (typeof str !== "string") return String(str || "");
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Start on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
