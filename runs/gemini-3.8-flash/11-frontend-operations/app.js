/**
 * Relay Operations Control Room - Application Engine
 * Pure Vanilla JavaScript: Local data seeding, interactive telemetry,
 * accessible filtering, sorting, keyboard navigation, and incident management.
 */

(function () {
  'use strict';

  // Seed Data fallback strictly matching DATA.json
  const SEED_DATA = {
    metrics: [
      { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up", context: "vs 1h rolling avg", status: "favorable" },
      { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down", context: "target ≤ 200 ms", status: "favorable" },
      { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up", context: "SLO budget 94.2%", status: "critical" },
      { label: "Queue depth", value: "2,841", change: "−19%", direction: "down", context: "drain rate 420/s", status: "favorable" }
    ],
    throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    incidents: [
      {
        id: "INC-2841",
        severity: "critical",
        service: "payments-api",
        age: "12m",
        owner: "M. Chen",
        status: "investigating",
        title: "Card authorization timeouts",
        impact: "High • 4.2% timeout rate on checkout",
        description: "Downstream issuer gateway latency spiked past 3,500 ms in EU-West-1. Retry queues exceeding rate ceiling. Secondary acquirer routing standby.",
        tags: ["Region: eu-west-1", "Endpoint: /v2/authorizations", "Target: stripe-gateway"],
        runbook: "RB-PAY-042: Payment Gateway Failover Protocol",
        runbookStep: "Step 1: Acknowledge alert → Step 2: Shift 50% traffic to Secondary Acquirer → Step 3: Monitor auth success rate for 5m.",
        timeline: [
          { time: "19:26 UTC", text: "Automated probe detected P99 latency > 3.5s on card authorizations" },
          { time: "19:28 UTC", text: "PagerDuty incident triggered for Payments On-Call" },
          { time: "19:30 UTC", text: "M. Chen assigned as primary incident lead; investigation underway" }
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
        impact: "Elevated • 18,200 events buffered",
        description: "Dead-letter retry partition backpressure in Dublin cluster. Consumer workers experiencing high CPU throttling after memory compaction.",
        tags: ["Region: eu-central-1", "Partition: retries-04", "Backpressure: 18.2k"],
        runbook: "RB-EVT-104: Consumer Fleet Auto-Scale & Rebalance",
        runbookStep: "Step 1: Scale consumer replica set from 12 to 24 pods → Step 2: Trigger partition rebalance → Step 3: Confirm drain rate > 1,500/s.",
        timeline: [
          { time: "19:07 UTC", text: "Dead-letter queue water level surpassed warning threshold (15k)" },
          { time: "19:12 UTC", text: "Auto-rebalancing throttled due to consumer memory pressure" }
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
        impact: "Moderate • P90 update lag 84s (target 30s)",
        description: "Elastic shard merger replication lag following bulk merchant product catalog import. Queries remain serviceable from stale replica shards.",
        tags: ["Cluster: search-prod-us", "Shard: idx-catalog-07", "Lag: 84s"],
        runbook: "RB-SRC-019: Shard Merge Concurrency Throttling",
        runbookStep: "Step 1: Adjust index.merge.scheduler.max_thread_count to 2 → Step 2: Verify CPU drop below 80%.",
        timeline: [
          { time: "18:30 UTC", text: "Freshness SLO breached 30s threshold" },
          { time: "18:42 UTC", text: "A. Silva applied concurrency clamp; shard replication recovering" }
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
        impact: "Low • Delivery SLA 99.4% (target 99.9%)",
        description: "Rate limit backoff triggered for three high-volume partner endpoints. Delivery retry queues are backing off exponentially as expected.",
        tags: ["Service: webhook-dispatcher", "FailedDeliveries: 420", "RateLimit: 429 Too Many Requests"],
        runbook: "RB-WHK-007: Partner Webhook Rate Throttling",
        runbookStep: "Step 1: Inspect 429 response headers from partner endpoints → Step 2: Apply adaptive token bucket delay.",
        timeline: [
          { time: "15:56 UTC", text: "Webhook delivery engine reported repeated HTTP 429 from partner ASN" },
          { time: "16:15 UTC", text: "R. Patel initiated rate-limit backoff policy adjustment" }
        ]
      }
    ]
  };

  // Application State
  const state = {
    metrics: [...SEED_DATA.metrics],
    throughput: [...SEED_DATA.throughput],
    incidents: JSON.parse(JSON.stringify(SEED_DATA.incidents)),
    selectedIncidentId: "INC-2841",
    activeSeverityFilter: "all",
    activeServiceFilter: "all",
    activeStatusFilter: "all",
    searchQuery: "",
    sortColumn: "severity",
    sortDirection: "asc", // For severity: crit -> high -> med -> low
    currentOperator: "M. Chen",
    isStreamPaused: false,
    focusedHourIndex: null,
    mobileActiveTab: "list" // "list" or "detail"
  };

  // Severity Weightings for Sorting
  const SEVERITY_WEIGHT = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4
  };

  // DOM Elements Cache
  const elements = {
    utcClock: document.getElementById("live-utc-clock"),
    systemHealthPill: document.getElementById("system-health-pill"),
    healthText: document.getElementById("health-text"),
    railIncidentBadge: document.getElementById("rail-incident-badge"),
    mobileIncidentCount: document.getElementById("mobile-incident-count"),
    mobileSelectedId: document.getElementById("mobile-selected-id"),
    streamStatus: document.getElementById("stream-status"),
    streamToggleBtn: document.getElementById("btn-stream-toggle"),
    streamToggleLabel: document.getElementById("stream-toggle-label"),
    soundToggleBtn: document.getElementById("btn-sound-toggle"),
    shortcutsBtn: document.getElementById("btn-shortcuts"),
    shortcutsModal: document.getElementById("shortcuts-modal"),
    closeModalBtn: document.getElementById("btn-close-modal"),
    doneModalBtn: document.getElementById("btn-modal-done"),

    // Metrics
    metricsGrid: document.getElementById("metrics-grid"),

    // Throughput Chart
    throughputSvg: document.getElementById("throughput-svg"),
    chartWrapper: document.getElementById("throughput-chart-container"),
    chartTooltip: document.getElementById("chart-tooltip"),
    tooltipHour: document.getElementById("tooltip-hour"),
    tooltipVal: document.getElementById("tooltip-val"),
    tooltipDelta: document.getElementById("tooltip-delta"),
    tpStatCurrent: document.getElementById("tp-stat-current"),
    tpStatPeak: document.getElementById("tp-stat-peak"),
    tpStatAvg: document.getElementById("tp-stat-avg"),

    // Incident Table & Filters
    searchInput: document.getElementById("incident-search-input"),
    searchClearBtn: document.getElementById("btn-search-clear"),
    resetFiltersBtn: document.getElementById("btn-reset-filters"),
    sevFilterPills: document.querySelectorAll(".filter-pill"),
    serviceSelect: document.getElementById("filter-service-select"),
    statusSelect: document.getElementById("filter-status-select"),
    filterReadout: document.getElementById("filter-readout"),
    incidentsTable: document.getElementById("incidents-table"),
    incidentsTbody: document.getElementById("incidents-tbody"),
    emptyState: document.getElementById("incidents-empty-state"),
    emptyResetBtn: document.getElementById("btn-empty-reset"),
    tableScrollContainer: document.getElementById("table-scroll-container"),

    // Incident Detail
    detailPane: document.getElementById("pane-incident-detail"),
    listPane: document.getElementById("pane-incident-list"),
    detailSevBadge: document.getElementById("detail-sev-badge"),
    detailId: document.getElementById("detail-id"),
    detailService: document.getElementById("detail-service"),
    detailTitle: document.getElementById("detail-title"),
    detailStatusPill: document.getElementById("detail-status-pill"),
    detailStatusText: document.getElementById("detail-status-text"),
    detailAge: document.getElementById("detail-age"),
    detailOwner: document.getElementById("detail-owner"),
    detailImpact: document.getElementById("detail-impact"),
    detailDesc: document.getElementById("detail-desc"),
    detailTags: document.getElementById("detail-tags"),
    detailRunbook: document.getElementById("detail-runbook"),
    detailRunbookStep: document.getElementById("detail-runbook-step"),
    timelineCount: document.getElementById("timeline-count"),
    incidentTimeline: document.getElementById("incident-timeline"),
    btnAckIncident: document.getElementById("btn-ack-incident"),
    btnAckText: document.getElementById("btn-ack-text"),
    btnResolveIncident: document.getElementById("btn-resolve-incident"),
    btnAssignSelf: document.getElementById("btn-assign-self"),

    // Mobile tabs
    mobileTabList: document.getElementById("mobile-tab-list"),
    mobileTabDetail: document.getElementById("mobile-tab-detail"),

    // Toast & Accessibility
    toastContainer: document.getElementById("toast-container"),
    srAnnouncer: document.getElementById("sr-announcer")
  };

  /* ==========================================================================
     Initialization & Local Data Loading
     ========================================================================== */

  function init() {
    // Attempt local fetch from DATA.json if possible, fallback seamlessly to SEED_DATA
    tryLoadDataJson();

    // Start Live UTC Clock
    updateClock();
    setInterval(updateClock, 1000);

    // Initial Renders
    renderThroughputChart();
    renderIncidentsTable();
    renderIncidentDetail();
    updateSystemHealthSummary();

    // Attach Event Listeners
    setupEventListeners();

    // Initialize mobile view tab if viewport is mobile
    if (window.innerWidth <= 768) {
      setMobileTab(state.mobileActiveTab);
    }
  }

  function tryLoadDataJson() {
    // Local fetch attempt: if served via http server, loads DATA.json
    // If opened via file:// protocol, catch handler ensures no breaking errors occur
    if (window.location.protocol.startsWith('http')) {
      fetch('DATA.json')
        .then(response => {
          if (!response.ok) throw new Error('Network response not ok');
          return response.json();
        })
        .then(data => {
          if (data && data.incidents && data.metrics && data.throughput) {
            state.throughput = [...data.throughput];
            // Merge incidents preserving detailed mock timelines
            data.incidents.forEach(item => {
              const existing = state.incidents.find(i => i.id === item.id);
              if (existing) {
                Object.assign(existing, item);
              } else {
                state.incidents.push({
                  ...item,
                  timeline: [{ time: "Initial", text: "Logged in cluster" }]
                });
              }
            });
            renderThroughputChart();
            renderIncidentsTable();
            renderIncidentDetail();
            updateSystemHealthSummary();
          }
        })
        .catch(() => {
          // Fallback silently to embedded SEED_DATA
        });
    }
  }

  /* ==========================================================================
     Clock & Status Bar Updates
     ========================================================================== */

  function updateClock() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hours = String(now.getUTCHours()).padStart(2, "0");
    const minutes = String(now.getUTCMinutes()).padStart(2, "0");
    const seconds = String(now.getUTCSeconds()).padStart(2, "0");
    if (elements.utcClock) {
      elements.utcClock.textContent = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  }

  function updateSystemHealthSummary() {
    const activeIncidents = state.incidents.filter(i => i.status !== "resolved");
    const critCount = activeIncidents.filter(i => i.severity === "critical").length;
    const highCount = activeIncidents.filter(i => i.severity === "high").length;
    const totalActive = activeIncidents.length;

    // Update rail badge
    if (elements.railIncidentBadge) {
      elements.railIncidentBadge.textContent = totalActive;
      elements.railIncidentBadge.setAttribute("aria-label", `${totalActive} active incidents`);
    }
    if (elements.mobileIncidentCount) {
      elements.mobileIncidentCount.textContent = totalActive;
    }

    // Update top health status bar
    if (elements.systemHealthPill && elements.healthText) {
      if (critCount > 0) {
        elements.systemHealthPill.className = "system-health-pill degraded";
        elements.healthText.textContent = `DEGRADED — ${critCount} CRITICAL INCIDENT${critCount > 1 ? "S" : ""}`;
      } else if (highCount > 0) {
        elements.systemHealthPill.className = "system-health-pill degraded";
        elements.healthText.textContent = `DEGRADED — ${highCount} HIGH PRIORITY`;
      } else if (totalActive > 0) {
        elements.systemHealthPill.className = "system-health-pill degraded";
        elements.healthText.textContent = `ELEVATED — ${totalActive} OPEN INCIDENT${totalActive > 1 ? "S" : ""}`;
      } else {
        elements.systemHealthPill.className = "system-health-pill operational";
        elements.healthText.textContent = "ALL SYSTEMS OPERATIONAL";
      }
    }
  }

  /* ==========================================================================
     Throughput Visualization (Inline SVG)
     ========================================================================== */

  function renderThroughputChart() {
    const svg = elements.throughputSvg;
    if (!svg) return;

    const data = state.throughput;
    const width = 960;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 25, left: 45 };

    const maxVal = 100; // 100k scale
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Summary calculations
    const current = data[data.length - 1];
    const peak = Math.max(...data);
    const avg = (data.reduce((a, b) => a + b, 0) / data.length).toFixed(1);

    if (elements.tpStatCurrent) elements.tpStatCurrent.textContent = `${current}k req/s`;
    if (elements.tpStatPeak) elements.tpStatPeak.textContent = `${peak}k req/s`;
    if (elements.tpStatAvg) elements.tpStatAvg.textContent = `${avg}k req/s`;

    // Calculate Coordinates
    const xStep = chartW / (data.length - 1);
    const points = data.map((val, idx) => {
      const x = padding.left + idx * xStep;
      const y = padding.top + chartH - (val / maxVal) * chartH;
      return { x, y, val, idx };
    });

    // Build SVG Elements
    let svgContent = '';

    // Horizontal Grid Lines & Y-axis labels (25, 50, 75, 100)
    const yTicks = [25, 50, 75, 100];
    yTicks.forEach(tick => {
      const y = padding.top + chartH - (tick / maxVal) * chartH;
      svgContent += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid-line" />
        <text x="${padding.left - 6}" y="${y + 3}" class="chart-axis-label" text-anchor="end">${tick}k</text>
      `;
    });

    // SLO Threshold line at 80k
    const sloY = padding.top + chartH - (80 / maxVal) * chartH;
    svgContent += `
      <line x1="${padding.left}" y1="${sloY}" x2="${width - padding.right}" y2="${sloY}" class="chart-slo-line" />
      <text x="${width - padding.right - 4}" y="${sloY - 5}" class="chart-slo-label" text-anchor="end">SLO CAPACITY (80k)</text>
    `;

    // Area Path
    let areaPathD = `M ${points[0].x} ${padding.top + chartH}`;
    points.forEach(p => {
      areaPathD += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    });
    areaPathD += ` L ${points[points.length - 1].x} ${padding.top + chartH} Z`;
    svgContent += `<path d="${areaPathD}" class="chart-area-fill" />`;

    // Hourly subtle background bars for hover targets
    const barWidth = chartW / data.length;
    points.forEach((p, idx) => {
      const barX = p.x - barWidth / 2;
      svgContent += `
        <rect x="${barX.toFixed(1)}" y="${padding.top}" width="${barWidth.toFixed(1)}" height="${chartH}"
              class="chart-data-bar" data-idx="${idx}" opacity="0.01" />
      `;
    });

    // Stroke Line Path
    let linePathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      linePathD += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
    }
    svgContent += `<path d="${linePathD}" class="chart-line-stroke" />`;

    // Data points dots
    points.forEach((p, idx) => {
      svgContent += `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--bg-canvas)" stroke="var(--accent)" stroke-width="1.5" class="chart-dot" data-idx="${idx}" />
      `;
    });

    // Cursor scrubber crosshair placeholder
    svgContent += `
      <g id="chart-scrubber-group" class="hidden">
        <line id="scrub-line" x1="0" y1="${padding.top}" x2="0" y2="${padding.top + chartH}" class="chart-cursor-line" />
        <circle id="scrub-dot" cx="0" cy="0" r="4.5" class="chart-cursor-dot" />
      </g>
    `;

    svg.innerHTML = svgContent;

    // Attach chart interactivity
    setupChartInteractivity(points, padding, chartW, chartH);
  }

  function setupChartInteractivity(points, padding, chartW, chartH) {
    const container = elements.chartWrapper;
    const tooltip = elements.chartTooltip;
    if (!container || !tooltip) return;

    function showHourTooltip(idx) {
      if (idx < 0 || idx >= points.length) return;
      state.focusedHourIndex = idx;
      const pt = points[idx];
      const hoursAgo = 24 - idx;
      const avg = state.throughput.reduce((a, b) => a + b, 0) / state.throughput.length;
      const deltaPercent = (((pt.val - avg) / avg) * 100).toFixed(1);
      const sign = deltaPercent >= 0 ? "+" : "";

      // Update Tooltip Content
      elements.tooltipHour.textContent = idx === points.length - 1 ? "Hour T-00 (Current / Now)" : `Hour T-${hoursAgo < 10 ? "0" + hoursAgo : hoursAgo}h`;
      elements.tooltipVal.textContent = `${pt.val},000 req/s`;
      elements.tooltipDelta.textContent = `${sign}${deltaPercent}% vs 24h avg`;

      // Position Tooltip
      const containerRect = container.getBoundingClientRect();
      const relativeX = (pt.x / 960) * containerRect.width;
      tooltip.style.left = `${relativeX}px`;
      tooltip.classList.remove("hidden");
      tooltip.setAttribute("aria-hidden", "false");

      // Update Cursor Indicator
      const scrubGroup = document.getElementById("chart-scrubber-group");
      const scrubLine = document.getElementById("scrub-line");
      const scrubDot = document.getElementById("scrub-dot");
      if (scrubGroup && scrubLine && scrubDot) {
        scrubGroup.classList.remove("hidden");
        scrubLine.setAttribute("x1", pt.x);
        scrubLine.setAttribute("x2", pt.x);
        scrubDot.setAttribute("cx", pt.x);
        scrubDot.setAttribute("cy", pt.y);
      }
    }

    function hideHourTooltip() {
      tooltip.classList.add("hidden");
      tooltip.setAttribute("aria-hidden", "true");
      const scrubGroup = document.getElementById("chart-scrubber-group");
      if (scrubGroup) scrubGroup.classList.add("hidden");
      state.focusedHourIndex = null;
    }

    container.onmousemove = function (e) {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const ratio = mouseX / rect.width;
      const svgX = ratio * 960;

      // Find closest point
      let closestIdx = 0;
      let minDistance = Infinity;
      points.forEach((p, idx) => {
        const dist = Math.abs(p.x - svgX);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });
      showHourTooltip(closestIdx);
    };

    container.onmouseleave = function () {
      hideHourTooltip();
    };

    // Keyboard accessibility for throughput chart (Arrow keys to scrub)
    container.onkeydown = function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const currentIdx = state.focusedHourIndex !== null ? state.focusedHourIndex : points.length - 1;
        const newIdx = Math.max(0, currentIdx - 1);
        showHourTooltip(newIdx);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const currentIdx = state.focusedHourIndex !== null ? state.focusedHourIndex : 0;
        const newIdx = Math.min(points.length - 1, currentIdx + 1);
        showHourTooltip(newIdx);
      } else if (e.key === "Escape") {
        hideHourTooltip();
      }
    };
  }

  /* ==========================================================================
     Incidents Table & Filtering
     ========================================================================== */

  function getFilteredIncidents() {
    let list = [...state.incidents];

    // Severity Filter
    if (state.activeSeverityFilter !== "all") {
      list = list.filter(item => item.severity.toLowerCase() === state.activeSeverityFilter.toLowerCase());
    }

    // Service Filter
    if (state.activeServiceFilter !== "all") {
      list = list.filter(item => item.service === state.activeServiceFilter);
    }

    // Status Filter
    if (state.activeStatusFilter !== "all") {
      list = list.filter(item => item.status.toLowerCase() === state.activeStatusFilter.toLowerCase());
    }

    // Text Search Filter (ID, Title, Service, Owner)
    if (state.searchQuery.trim() !== "") {
      const q = state.searchQuery.toLowerCase().trim();
      list = list.filter(item =>
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.service.toLowerCase().includes(q) ||
        item.owner.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (state.sortColumn === "severity") {
        comparison = (SEVERITY_WEIGHT[a.severity] || 99) - (SEVERITY_WEIGHT[b.severity] || 99);
      } else if (state.sortColumn === "id") {
        comparison = a.id.localeCompare(b.id);
      } else if (state.sortColumn === "title") {
        comparison = a.title.localeCompare(b.title);
      } else if (state.sortColumn === "service") {
        comparison = a.service.localeCompare(b.service);
      } else if (state.sortColumn === "owner") {
        comparison = a.owner.localeCompare(b.owner);
      } else if (state.sortColumn === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (state.sortColumn === "age") {
        comparison = parseAgeToMinutes(a.age) - parseAgeToMinutes(b.age);
      }

      return state.sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }

  function parseAgeToMinutes(ageStr) {
    if (!ageStr) return 0;
    let minutes = 0;
    const hourMatch = ageStr.match(/(\d+)\s*h/);
    const minMatch = ageStr.match(/(\d+)\s*m/);
    if (hourMatch) minutes += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) minutes += parseInt(minMatch[1], 10);
    return minutes;
  }

  function renderIncidentsTable() {
    const tbody = elements.incidentsTbody;
    const emptyState = elements.emptyState;
    if (!tbody) return;

    const filtered = getFilteredIncidents();
    const totalCount = state.incidents.length;

    // Update filter readout
    if (elements.filterReadout) {
      elements.filterReadout.textContent = `Showing ${filtered.length} of ${totalCount} active incidents`;
    }

    // Toggle Reset Filters button visibility
    const isFiltered = state.activeSeverityFilter !== "all" ||
      state.activeServiceFilter !== "all" ||
      state.activeStatusFilter !== "all" ||
      state.searchQuery.trim() !== "";
    if (elements.resetFiltersBtn) {
      elements.resetFiltersBtn.classList.toggle("hidden", !isFiltered);
    }

    // Update Sort Headers Aria
    const headers = document.querySelectorAll(".incidents-table th[data-sort]");
    headers.forEach(th => {
      const sortKey = th.getAttribute("data-sort");
      if (sortKey === state.sortColumn) {
        th.setAttribute("aria-sort", state.sortDirection === "asc" ? "ascending" : "descending");
      } else {
        th.setAttribute("aria-sort", "none");
      }
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    // Ensure selected incident exists in filtered list; if not, select first
    const hasSelected = filtered.some(i => i.id === state.selectedIncidentId);
    if (!hasSelected && filtered.length > 0) {
      state.selectedIncidentId = filtered[0].id;
      renderIncidentDetail();
    }

    let rowsHtml = '';
    filtered.forEach(inc => {
      const isSelected = inc.id === state.selectedIncidentId;
      const isUnassigned = inc.owner.toLowerCase() === "unassigned";

      rowsHtml += `
        <tr class="${isSelected ? "selected" : ""}"
            data-id="${inc.id}"
            tabindex="0"
            role="row"
            aria-selected="${isSelected ? "true" : "false"}">
          <td class="col-sev">
            <span class="badge-sev ${inc.severity}">${inc.severity}</span>
          </td>
          <td class="col-id tabular-num">${inc.id}</td>
          <td class="col-title" title="${escapeHtml(inc.title)}">${escapeHtml(inc.title)}</td>
          <td class="col-service">
            <span class="service-pill">${inc.service}</span>
          </td>
          <td class="col-age tabular-num">${inc.age}</td>
          <td class="col-owner">
            <span class="${isUnassigned ? "owner-unassigned" : "owner-name"}">${escapeHtml(inc.owner)}</span>
          </td>
          <td class="col-status">
            <span class="badge-status ${inc.status}">
              <span class="status-dot" aria-hidden="true"></span>
              ${inc.status}
            </span>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
    attachTableRowListeners();
  }

  function attachTableRowListeners() {
    const rows = elements.incidentsTbody.querySelectorAll("tr[data-id]");
    rows.forEach(row => {
      const id = row.getAttribute("data-id");

      row.onclick = function () {
        selectIncident(id, true);
      };

      row.onkeydown = function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectIncident(id, true);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          const next = row.nextElementSibling;
          if (next && next.focus) next.focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const prev = row.previousElementSibling;
          if (prev && prev.focus) prev.focus();
        } else if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          acknowledgeIncident(id);
        }
      };
    });
  }

  function selectIncident(id, switchTabOnMobile = false) {
    state.selectedIncidentId = id;

    // Update row selections in table without rebuilding entire DOM
    const rows = elements.incidentsTbody.querySelectorAll("tr[data-id]");
    rows.forEach(r => {
      const isSelected = r.getAttribute("data-id") === id;
      r.classList.toggle("selected", isSelected);
      r.setAttribute("aria-selected", isSelected ? "true" : "false");
    });

    renderIncidentDetail();

    // On mobile screens, automatically show detail tab when tapped
    if (switchTabOnMobile && window.innerWidth <= 768) {
      setMobileTab("detail");
    }
  }

  /* ==========================================================================
     Incident Detail Panel & Working Acknowledge Action
     ========================================================================== */

  function renderIncidentDetail() {
    const inc = state.incidents.find(i => i.id === state.selectedIncidentId);
    if (!inc) return;

    // Update Mobile header indicator
    if (elements.mobileSelectedId) {
      elements.mobileSelectedId.textContent = inc.id;
    }

    // Header Attributes
    if (elements.detailId) elements.detailId.textContent = inc.id;
    if (elements.detailTitle) elements.detailTitle.textContent = inc.title;
    if (elements.detailService) elements.detailService.textContent = inc.service;

    // Severity Badge
    if (elements.detailSevBadge) {
      elements.detailSevBadge.className = `detail-sev-badge ${inc.severity}`;
      elements.detailSevBadge.textContent = inc.severity.toUpperCase();
    }

    // Status Pill
    if (elements.detailStatusText && elements.detailStatusPill) {
      elements.detailStatusText.textContent = inc.status;
      const dot = elements.detailStatusPill.querySelector(".status-indicator-dot");
      if (dot) dot.className = `status-indicator-dot ${inc.status}`;
    }

    // Key-Values
    if (elements.detailAge) elements.detailAge.textContent = inc.age;
    if (elements.detailOwner) elements.detailOwner.textContent = inc.owner;
    if (elements.detailImpact) elements.detailImpact.textContent = inc.impact || "Nominal impact";
    if (elements.detailDesc) elements.detailDesc.textContent = inc.description || inc.title;

    // Diagnostic Tags
    if (elements.detailTags) {
      const tags = inc.tags || [`Service: ${inc.service}`];
      elements.detailTags.innerHTML = tags.map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('');
    }

    // Runbook
    if (elements.detailRunbook) elements.detailRunbook.textContent = inc.runbook || "Standard Operator Runbook";
    if (elements.detailRunbookStep) elements.detailRunbookStep.textContent = inc.runbookStep || "Inspect telemetry and follow service escalation checklist.";

    // Timeline Log
    if (elements.incidentTimeline && elements.timelineCount) {
      const timeline = inc.timeline || [];
      elements.timelineCount.textContent = `${timeline.length} entries`;
      elements.incidentTimeline.innerHTML = timeline.map((item, idx) => `
        <li class="timeline-entry ${idx === timeline.length - 1 ? 'highlight' : ''}">
          <span class="timeline-time">${item.time}</span>
          <span class="timeline-msg">${escapeHtml(item.text)}</span>
        </li>
      `).join('');
    }

    // Working Acknowledge Button State
    if (elements.btnAckIncident && elements.btnAckText) {
      const isAcked = inc.status === "acknowledged" || inc.status === "resolved";
      if (isAcked) {
        elements.btnAckIncident.className = "btn-action-ack acknowledged";
        elements.btnAckText.textContent = "✓ Acknowledged";
        elements.btnAckIncident.setAttribute("aria-label", `${inc.id} is already acknowledged`);
      } else {
        elements.btnAckIncident.className = "btn-action-ack";
        elements.btnAckText.textContent = "Acknowledge Incident";
        elements.btnAckIncident.setAttribute("aria-label", `Acknowledge incident ${inc.id}`);
      }
    }

    // Resolve Button State
    if (elements.btnResolveIncident) {
      if (inc.status === "resolved") {
        elements.btnResolveIncident.textContent = "Reopen";
      } else {
        elements.btnResolveIncident.textContent = "Resolve";
      }
    }
  }

  /**
   * Core Working Action: Acknowledge Incident
   */
  function acknowledgeIncident(id) {
    const targetId = id || state.selectedIncidentId;
    const inc = state.incidents.find(i => i.id === targetId);
    if (!inc) return;

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} UTC`;

    if (inc.status === "acknowledged") {
      showToast(`Incident ${inc.id} is already acknowledged.`, "info");
      announceLive(`Incident ${inc.id} is already acknowledged.`);
      return;
    }

    // Mutate status
    inc.status = "acknowledged";

    // Auto-claim owner if unassigned
    if (inc.owner.toLowerCase() === "unassigned") {
      inc.owner = state.currentOperator;
    }

    // Append to timeline audit log
    if (!inc.timeline) inc.timeline = [];
    inc.timeline.push({
      time: timeStr,
      text: `Acknowledged by operator ${state.currentOperator}; runbook mitigation engaged`
    });

    // Re-render UI
    renderIncidentsTable();
    renderIncidentDetail();
    updateSystemHealthSummary();

    // Show Notification Toast
    showToast(`Incident ${inc.id} acknowledged by ${state.currentOperator}`, "success");

    // Accessible Screen Reader Announcement
    announceLive(`Incident ${inc.id} acknowledged by ${state.currentOperator}. Status updated to acknowledged.`);
  }

  /**
   * Working Action: Resolve Incident
   */
  function toggleResolveIncident(id) {
    const targetId = id || state.selectedIncidentId;
    const inc = state.incidents.find(i => i.id === targetId);
    if (!inc) return;

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} UTC`;

    if (inc.status === "resolved") {
      inc.status = "investigating";
      inc.timeline.push({
        time: timeStr,
        text: `Incident reopened by operator ${state.currentOperator}`
      });
      showToast(`Incident ${inc.id} reopened`, "warning");
      announceLive(`Incident ${inc.id} reopened.`);
    } else {
      inc.status = "resolved";
      inc.timeline.push({
        time: timeStr,
        text: `Resolved by operator ${state.currentOperator}`
      });
      showToast(`Incident ${inc.id} marked as resolved`, "success");
      announceLive(`Incident ${inc.id} marked as resolved.`);
    }

    renderIncidentsTable();
    renderIncidentDetail();
    updateSystemHealthSummary();
  }

  /**
   * Working Action: Claim Ownership
   */
  function claimIncidentOwnership(id) {
    const targetId = id || state.selectedIncidentId;
    const inc = state.incidents.find(i => i.id === targetId);
    if (!inc) return;

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} UTC`;

    inc.owner = state.currentOperator;
    if (!inc.timeline) inc.timeline = [];
    inc.timeline.push({
      time: timeStr,
      text: `Ownership claimed by ${state.currentOperator}`
    });

    renderIncidentsTable();
    renderIncidentDetail();
    showToast(`Claimed ownership of ${inc.id}`, "info");
    announceLive(`Ownership of ${inc.id} assigned to ${state.currentOperator}`);
  }

  /* ==========================================================================
     Notification Toasts & Screen Reader Announcements
     ========================================================================== */

  function showToast(message, type = "info") {
    const container = elements.toastContainer;
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", "alert");

    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-title">RELAY CONSOLE</span>
        <span class="toast-msg">${escapeHtml(message)}</span>
      </div>
      <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
    `;

    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.onclick = function () {
      toast.remove();
    };

    container.appendChild(toast);

    // Auto-remove after 4.5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 4500);
  }

  function announceLive(message) {
    if (elements.srAnnouncer) {
      elements.srAnnouncer.textContent = message;
    }
  }

  /* ==========================================================================
     Mobile View Switcher (<= 768px)
     ========================================================================== */

  function setMobileTab(tab) {
    state.mobileActiveTab = tab;
    if (elements.mobileTabList && elements.mobileTabDetail) {
      elements.mobileTabList.classList.toggle("active", tab === "list");
      elements.mobileTabList.setAttribute("aria-selected", tab === "list" ? "true" : "false");
      elements.mobileTabDetail.classList.toggle("active", tab === "detail");
      elements.mobileTabDetail.setAttribute("aria-selected", tab === "detail" ? "true" : "false");
    }

    if (elements.listPane && elements.detailPane) {
      if (tab === "list") {
        elements.listPane.classList.remove("mobile-hidden");
        elements.detailPane.classList.add("mobile-hidden");
      } else {
        elements.listPane.classList.add("mobile-hidden");
        elements.detailPane.classList.remove("mobile-hidden");
      }
    }
  }

  /* ==========================================================================
     Event Handlers Setup
     ========================================================================== */

  function setupEventListeners() {
    // Search input
    if (elements.searchInput) {
      elements.searchInput.oninput = function (e) {
        state.searchQuery = e.target.value;
        if (elements.searchClearBtn) {
          elements.searchClearBtn.classList.toggle("hidden", state.searchQuery === "");
        }
        renderIncidentsTable();
      };
    }

    // Search clear button
    if (elements.searchClearBtn) {
      elements.searchClearBtn.onclick = function () {
        state.searchQuery = "";
        elements.searchInput.value = "";
        elements.searchClearBtn.classList.add("hidden");
        elements.searchInput.focus();
        renderIncidentsTable();
      };
    }

    // Severity filter buttons
    elements.sevFilterPills.forEach(pill => {
      pill.onclick = function () {
        elements.sevFilterPills.forEach(p => {
          p.classList.remove("active");
          p.setAttribute("aria-pressed", "false");
        });
        pill.classList.add("active");
        pill.setAttribute("aria-pressed", "true");
        state.activeSeverityFilter = pill.getAttribute("data-sev");
        renderIncidentsTable();
      };
    });

    // Service select
    if (elements.serviceSelect) {
      elements.serviceSelect.onchange = function (e) {
        state.activeServiceFilter = e.target.value;
        renderIncidentsTable();
      };
    }

    // Status select
    if (elements.statusSelect) {
      elements.statusSelect.onchange = function (e) {
        state.activeStatusFilter = e.target.value;
        renderIncidentsTable();
      };
    }

    // Reset filters buttons
    const resetAllFilters = function () {
      state.searchQuery = "";
      state.activeSeverityFilter = "all";
      state.activeServiceFilter = "all";
      state.activeStatusFilter = "all";

      if (elements.searchInput) elements.searchInput.value = "";
      if (elements.searchClearBtn) elements.searchClearBtn.classList.add("hidden");
      if (elements.serviceSelect) elements.serviceSelect.value = "all";
      if (elements.statusSelect) elements.statusSelect.value = "all";

      elements.sevFilterPills.forEach(pill => {
        const isAll = pill.getAttribute("data-sev") === "all";
        pill.classList.toggle("active", isAll);
        pill.setAttribute("aria-pressed", isAll ? "true" : "false");
      });

      renderIncidentsTable();
      announceLive("All filters have been reset.");
    };

    if (elements.resetFiltersBtn) elements.resetFiltersBtn.onclick = resetAllFilters;
    if (elements.emptyResetBtn) elements.emptyResetBtn.onclick = resetAllFilters;

    // Table Header Sorting
    const sortHeaders = document.querySelectorAll(".incidents-table th[data-sort]");
    sortHeaders.forEach(th => {
      const sortKey = th.getAttribute("data-sort");
      th.onclick = function () {
        if (state.sortColumn === sortKey) {
          state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
        } else {
          state.sortColumn = sortKey;
          state.sortDirection = "asc";
        }
        renderIncidentsTable();
      };
    });

    // Acknowledge Action Button Click
    if (elements.btnAckIncident) {
      elements.btnAckIncident.onclick = function () {
        acknowledgeIncident(state.selectedIncidentId);
      };
    }

    // Resolve Action Button Click
    if (elements.btnResolveIncident) {
      elements.btnResolveIncident.onclick = function () {
        toggleResolveIncident(state.selectedIncidentId);
      };
    }

    // Claim Ownership Button Click
    if (elements.btnAssignSelf) {
      elements.btnAssignSelf.onclick = function () {
        claimIncidentOwnership(state.selectedIncidentId);
      };
    }

    // Stream Toggle
    if (elements.streamToggleBtn) {
      elements.streamToggleBtn.onclick = function () {
        state.isStreamPaused = !state.isStreamPaused;
        const parent = elements.streamToggleBtn.closest(".telemetry-stream");
        if (parent) parent.classList.toggle("paused", state.isStreamPaused);

        if (state.isStreamPaused) {
          elements.streamToggleLabel.textContent = "Resume";
          elements.streamStatus.textContent = "STREAM PAUSED";
          showToast("Telemetry stream paused", "info");
        } else {
          elements.streamToggleLabel.textContent = "Pause";
          elements.streamStatus.textContent = "STREAM ACTIVE (1s)";
          showToast("Telemetry stream resumed", "info");
        }
      };
    }

    // Sound alert toggle
    if (elements.soundToggleBtn) {
      let isMuted = true;
      elements.soundToggleBtn.onclick = function () {
        isMuted = !isMuted;
        elements.soundToggleBtn.title = isMuted ? "Audible Alert Ping: Muted" : "Audible Alert Ping: Enabled";
        showToast(isMuted ? "Alert audio muted" : "Alert audio unmuted", "info");
      };
    }

    // Shortcuts modal open / close
    if (elements.shortcutsBtn) {
      elements.shortcutsBtn.onclick = function () {
        elements.shortcutsModal.classList.remove("hidden");
        elements.closeModalBtn.focus();
      };
    }
    if (elements.closeModalBtn) {
      elements.closeModalBtn.onclick = function () {
        elements.shortcutsModal.classList.add("hidden");
      };
    }
    if (elements.doneModalBtn) {
      elements.doneModalBtn.onclick = function () {
        elements.shortcutsModal.classList.add("hidden");
      };
    }
    if (elements.shortcutsModal) {
      elements.shortcutsModal.onclick = function (e) {
        if (e.target === elements.shortcutsModal) {
          elements.shortcutsModal.classList.add("hidden");
        }
      };
    }

    // Mobile view tab buttons
    if (elements.mobileTabList) {
      elements.mobileTabList.onclick = function () {
        setMobileTab("list");
      };
    }
    if (elements.mobileTabDetail) {
      elements.mobileTabDetail.onclick = function () {
        setMobileTab("detail");
      };
    }

    // Window Resize Handling for Mobile Tabs
    window.addEventListener("resize", function () {
      if (window.innerWidth > 768) {
        if (elements.listPane) elements.listPane.classList.remove("mobile-hidden");
        if (elements.detailPane) elements.detailPane.classList.remove("mobile-hidden");
      } else {
        setMobileTab(state.mobileActiveTab);
      }
    });

    // Global Keyboard Shortcuts
    document.addEventListener("keydown", function (e) {
      // Don't intercept when user is typing in inputs
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
      if (activeTag === "input" || activeTag === "select" || activeTag === "textarea") {
        if (e.key === "Escape") {
          document.activeElement.blur();
        }
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        if (elements.searchInput) elements.searchInput.focus();
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        acknowledgeIncident(state.selectedIncidentId);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        toggleResolveIncident(state.selectedIncidentId);
      } else if (e.key === "?") {
        e.preventDefault();
        elements.shortcutsModal.classList.toggle("hidden");
      } else if (e.key === "Escape") {
        if (!elements.shortcutsModal.classList.contains("hidden")) {
          elements.shortcutsModal.classList.add("hidden");
        }
      }
    });
  }

  // HTML sanitization helper
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
