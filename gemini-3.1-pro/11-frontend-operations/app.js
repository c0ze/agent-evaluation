/**
 * RELAY - Operations Control Room
 * High-density operations dashboard for expert operators.
 * Vanilla JavaScript (ES6+), zero external libraries or network calls.
 */

(function () {
  'use strict';

  // Seed realistic content matching DATA.json
  const SEED_DATA = {
    metrics: [
      { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up", baseline: "17,020", slo: "> 15,000 / min" },
      { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down", baseline: "196 ms", slo: "< 250 ms" },
      { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up", baseline: "0.29%", slo: "< 0.10% (Breached)" },
      { label: "Queue depth", value: "2,841", change: "−19%", direction: "down", baseline: "3,507", slo: "Cap: 25,000 msgs" }
    ],
    throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    incidents: [
      {
        id: "INC-2841",
        severity: "critical",
        service: "payments-api",
        age: "12m",
        ageMinutes: 12,
        owner: "M. Chen",
        status: "investigating",
        title: "Card authorization timeouts",
        synopsis: "Downstream payment gateway handshake latency exceeds timeout threshold of 1.2s. 3 out of 8 authorization pods are rejecting connections. Ingestion queue is buffering retries.",
        slo: "Auth Latency > 1200ms (Breached)",
        runbook: "RB-PAY-204 (Gateway Circuit Breaker Recovery)",
        errors: "418 err/min (+340%)",
        replicas: "3 / 8 hosts failing healthcheck",
        upstream: "checkout-web, subscription-worker",
        timeline: [
          { time: "19:26:45 UTC", event: "Automated alert triggered: SLO breach latency > 1200ms", author: "System Monitor" },
          { time: "19:28:10 UTC", event: "Paged on-call engineer M. Chen", author: "PagerDuty" },
          { time: "19:30:22 UTC", event: "Status moved to Investigating. Began drain on US-East pod pool.", author: "M. Chen" }
        ]
      },
      {
        id: "INC-2839",
        severity: "high",
        service: "event-router",
        age: "31m",
        ageMinutes: 31,
        owner: "Unassigned",
        status: "open",
        title: "EU retry queue growth",
        synopsis: "Cross-region Kafka mirror maker experiencing partition rebalance lag. Inbound event buffer growing at 140 msgs/sec in frankfurt-dc01 cluster.",
        slo: "Queue Lag > 5,000 msgs",
        runbook: "RB-EVT-102 (Kafka Mirror Partition Rebalance)",
        errors: "140 uncommitted offsets/sec",
        replicas: "Broker node-04 CPU > 92%",
        upstream: "audit-logger, analytics-consumer",
        timeline: [
          { time: "19:07:30 UTC", event: "Buffer depth crossed warning threshold (3,000 msgs)", author: "System Monitor" },
          { time: "19:12:15 UTC", event: "Incident created with severity High. Unassigned.", author: "Ops Auto-triage" }
        ]
      },
      {
        id: "INC-2837",
        severity: "medium",
        service: "search-index",
        age: "1h 08m",
        ageMinutes: 68,
        owner: "A. Silva",
        status: "monitoring",
        title: "Index freshness outside SLO",
        synopsis: "Elasticsearch indexing queue worker saturated by bulk catalog sync. Mutation delta lag currently 4.8 minutes against 2.0 minute SLO target.",
        slo: "Freshness SLO: 120s (Current: 288s)",
        runbook: "RB-SRC-044 (Elasticsearch Bulk Index Throttle)",
        errors: "Bulk ingestion throttled at 429",
        replicas: "Cluster health YELLOW (1 unassigned replica shard)",
        upstream: "catalog-api, product-search",
        timeline: [
          { time: "18:30:00 UTC", event: "Hourly product catalog bulk ingest started", author: "Cron Scheduler" },
          { time: "18:39:12 UTC", event: "Freshness SLO warning triggered. A. Silva acknowledged.", author: "A. Silva" },
          { time: "19:00:00 UTC", event: "Throttled bulk batch size from 500 to 200. Monitoring recovery.", author: "A. Silva" }
        ]
      },
      {
        id: "INC-2832",
        severity: "low",
        service: "webhooks",
        age: "3h 42m",
        ageMinutes: 222,
        owner: "R. Patel",
        status: "open",
        title: "Elevated partner delivery lag",
        synopsis: "Outbound webhook dispatch latency elevated for 2 external partner endpoints returning intermittent HTTP 504. Backoff queue is handling retries cleanly.",
        slo: "Dispatch P95: 5.4s (SLO: 10.0s)",
        runbook: "RB-WH-012 (Partner Rate Limit Backoff)",
        errors: "6.2% retry rate on partner-hook-vendor",
        replicas: "Worker pool nominal (12/12 active)",
        upstream: "billing-lifecycle, notification-service",
        timeline: [
          { time: "15:56:00 UTC", event: "Partner endpoint acme-corp returning 504 Gateway Timeout", author: "Webhook Dispatcher" },
          { time: "16:15:30 UTC", event: "Exponential backoff active. Incident logged as Low severity.", author: "R. Patel" }
        ]
      }
    ]
  };

  // Application State
  const state = {
    metrics: JSON.parse(JSON.stringify(SEED_DATA.metrics)),
    throughput: [...SEED_DATA.throughput],
    incidents: JSON.parse(JSON.stringify(SEED_DATA.incidents)),
    selectedId: "INC-2841",
    filters: {
      severity: "all",
      status: "all",
      service: "all",
      searchQuery: ""
    },
    sort: {
      column: "severity",
      direction: "asc"
    },
    audioMuted: true,
    lastSyncTime: new Date()
  };

  // Severity Weight for sorting
  const SEVERITY_WEIGHT = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4
  };

  // DOM Elements
  const dom = {
    liveAnnouncer: document.getElementById("live-announcer"),
    utcClock: document.getElementById("live-utc-clock"),
    statusHeadline: document.getElementById("status-headline"),
    statusHeadlineText: document.getElementById("status-headline-text"),
    statusQueueMetric: document.getElementById("status-queue-metric"),
    statusIncidentMetric: document.getElementById("status-incident-metric"),
    btnRefresh: document.getElementById("btn-refresh"),
    btnAudioToggle: document.getElementById("btn-audio-toggle"),
    btnToggleRail: document.getElementById("btn-toggle-rail"),
    btnShortcuts: document.getElementById("btn-shortcuts"),
    shortcutsDialog: document.getElementById("shortcuts-dialog"),
    btnCloseShortcuts: document.getElementById("btn-close-shortcuts"),
    btnDismissShortcuts: document.getElementById("btn-dismiss-shortcuts"),
    navIncidentCount: document.getElementById("nav-incident-count"),

    // Throughput Chart
    tpSvg: document.getElementById("throughput-svg"),
    chartWrapper: document.getElementById("throughput-chart-wrapper"),
    chartTooltip: document.getElementById("chart-tooltip"),
    tpStatPeak: document.getElementById("tp-stat-peak"),
    tpStatMean: document.getElementById("tp-stat-mean"),
    tpStatMin: document.getElementById("tp-stat-min"),
    tpStatCurrent: document.getElementById("tp-stat-current"),

    // Incident Table & Filters
    incidentCounterTag: document.getElementById("incident-counter-tag"),
    searchInput: document.getElementById("incident-search-input"),
    btnClearSearch: document.getElementById("btn-clear-search"),
    severityPills: document.getElementById("severity-filter-pills"),
    selectStatusFilter: document.getElementById("select-status-filter"),
    selectServiceFilter: document.getElementById("select-service-filter"),
    btnResetFilters: document.getElementById("btn-reset-filters"),
    tableContainer: document.getElementById("table-container"),
    tableBody: document.getElementById("incident-table-body"),
    emptyState: document.getElementById("incident-empty-state"),
    emptyStateDetail: document.getElementById("empty-state-detail"),
    btnEmptyReset: document.getElementById("btn-empty-reset"),

    // Detail Panel
    detailPanel: document.getElementById("incident-detail-panel"),
    btnCloseDetail: document.getElementById("btn-close-detail"),
    detailSevBadge: document.getElementById("detail-sev-badge"),
    detailStatusBadge: document.getElementById("detail-status-badge"),
    detailIdText: document.getElementById("detail-id-text"),
    detailTitleText: document.getElementById("detail-title-text"),
    btnAcknowledgeAction: document.getElementById("btn-acknowledge-action"),
    btnAckLabel: document.getElementById("btn-ack-label"),
    detailStatusSelect: document.getElementById("detail-status-select"),
    btnEscalate: document.getElementById("btn-escalate"),
    detailServiceText: document.getElementById("detail-service-text"),
    detailAgeText: document.getElementById("detail-age-text"),
    detailOwnerText: document.getElementById("detail-owner-text"),
    btnAssignSelf: document.getElementById("btn-assign-self"),
    detailSloText: document.getElementById("detail-slo-text"),
    detailSynopsisText: document.getElementById("detail-synopsis-text"),
    detailRunbookText: document.getElementById("detail-runbook-text"),
    detailTelErrors: document.getElementById("detail-tel-errors"),
    detailTelReplicas: document.getElementById("detail-tel-replicas"),
    detailTimelineList: document.getElementById("detail-timeline-list"),
    formOperatorNote: document.getElementById("form-operator-note"),
    inputOperatorNote: document.getElementById("input-operator-note")
  };

  /**
   * Screen reader announcer
   */
  function announce(message) {
    if (dom.liveAnnouncer) {
      dom.liveAnnouncer.textContent = "";
      setTimeout(() => {
        dom.liveAnnouncer.textContent = message;
      }, 50);
    }
  }

  /**
   * Format UTC Date for clock
   */
  function updateClock() {
    const now = new Date();
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    dom.utcClock.textContent = `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Renders the 4 summary metrics cards and sparklines
   */
  function renderMetrics() {
    state.metrics.forEach((metric, index) => {
      const valEl = document.getElementById(`val-metric-${index}`);
      const badgeEl = document.getElementById(`badge-metric-${index}`);
      const sparkEl = document.getElementById(`spark-metric-${index}`);

      if (valEl) valEl.textContent = metric.value;
      if (badgeEl) {
        const valSpan = badgeEl.querySelector(".badge-val");
        if (valSpan) valSpan.textContent = metric.change;
      }

      // Generate SVG sparkline
      if (sparkEl) {
        let sparkPoints = [];
        if (index === 0) sparkPoints = [12, 14, 13, 15, 16, 14, 17, 19, 18, 20];
        if (index === 1) sparkPoints = [22, 21, 20, 18, 17, 19, 16, 15, 14, 12];
        if (index === 2) sparkPoints = [4, 5, 4, 6, 5, 7, 8, 9, 11, 14];
        if (index === 3) sparkPoints = [24, 23, 21, 20, 18, 17, 16, 15, 14, 12];

        const min = Math.min(...sparkPoints);
        const max = Math.max(...sparkPoints);
        const range = max - min || 1;
        const width = 80;
        const height = 20;

        const pointsAttr = sparkPoints.map((val, i) => {
          const x = (i / (sparkPoints.length - 1)) * width;
          const y = height - 2 - ((val - min) / range) * (height - 4);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");

        const strokeColor = index === 2 ? "#ef4444" : index === 1 ? "#10b981" : "#38bdf8";

        sparkEl.innerHTML = `
          <polyline points="${pointsAttr}" fill="none" stroke="${strokeColor}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
        `;
      }
    });
  }

  /**
   * 24-Hour Throughput Visualization (SVG Bar & Line Chart)
   */
  function renderThroughputChart() {
    const data = state.throughput;
    const peak = Math.max(...data);
    const min = Math.min(...data);
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = (sum / data.length).toFixed(1);
    const current = data[data.length - 1];

    dom.tpStatPeak.textContent = `${peak} k/s`;
    dom.tpStatMin.textContent = `${min} k/s`;
    dom.tpStatMean.textContent = `${mean} k/s`;
    dom.tpStatCurrent.textContent = `${current} k/s`;

    const svgWidth = 840;
    const svgHeight = 220;
    const padLeft = 46;
    const padRight = 24;
    const padTop = 22;
    const padBottom = 34;

    const chartW = svgWidth - padLeft - padRight;
    const chartH = svgHeight - padTop - padBottom;

    // Y Axis scaling (0 to 100 k/s)
    const yMax = 100;
    const getY = (val) => padTop + chartH - (val / yMax) * chartH;
    const getX = (i) => padLeft + (i / (data.length - 1)) * chartW;

    let svgHtml = '';

    // Horizontal Grid Lines & Y-axis labels
    const gridYValues = [0, 25, 50, 75, 100];
    gridYValues.forEach(val => {
      const y = getY(val);
      svgHtml += `
        <line x1="${padLeft}" y1="${y}" x2="${svgWidth - padRight}" y2="${y}" class="chart-grid-line" />
        <text x="${padLeft - 8}" y="${y + 3}" text-anchor="end" class="chart-axis-text">${val}k</text>
      `;
    });

    // 24h Mean Baseline
    const meanY = getY(parseFloat(mean));
    svgHtml += `
      <line x1="${padLeft}" y1="${meanY}" x2="${svgWidth - padRight}" y2="${meanY}" class="chart-mean-line" />
      <text x="${svgWidth - padRight + 4}" y="${meanY + 3}" class="chart-axis-text" fill="#94a3b8">AVG</text>
    `;

    // Bar Columns (width ~20px each)
    const barWidth = Math.floor(chartW / data.length) - 5;
    data.forEach((val, i) => {
      const xCenter = padLeft + (i + 0.5) * (chartW / data.length);
      const x = xCenter - barWidth / 2;
      const y = getY(val);
      const h = (padTop + chartH) - y;
      const isLatest = i === data.length - 1;

      svgHtml += `
        <rect class="chart-bar-rect ${isLatest ? 'latest-bar' : ''}" 
              x="${x.toFixed(1)}" y="${y.toFixed(1)}" 
              width="${barWidth}" height="${h.toFixed(1)}" 
              rx="1.5"
              data-index="${i}" data-val="${val}"
              aria-label="Hour T-${23 - i}: ${val} k ops/sec" />
      `;
    });

    // Area & Line Path
    const points = data.map((val, i) => {
      const x = padLeft + (i + 0.5) * (chartW / data.length);
      const y = getY(val);
      return { x, y, val, i };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`;

    svgHtml += `<path d="${areaD}" class="chart-area-path" />`;
    svgHtml += `<path d="${pathD}" class="chart-line-path" />`;

    // Data dots
    points.forEach(p => {
      svgHtml += `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" 
                class="chart-dot" 
                data-index="${p.i}" data-val="${p.val}" />
      `;
    });

    // X-Axis Hour Labels (every 4 hours)
    for (let i = 0; i < data.length; i += 4) {
      const x = padLeft + (i + 0.5) * (chartW / data.length);
      const label = i === 23 ? 'NOW' : `T-${23 - i}h`;
      svgHtml += `
        <text x="${x.toFixed(1)}" y="${padTop + chartH + 18}" text-anchor="middle" class="chart-axis-text">${label}</text>
      `;
    }
    // Also label the latest (T-0) explicitly
    const lastX = padLeft + (23.5) * (chartW / data.length);
    svgHtml += `
      <text x="${lastX.toFixed(1)}" y="${padTop + chartH + 18}" text-anchor="middle" class="chart-axis-text" font-weight="700" fill="#38bdf8">NOW</text>
    `;

    dom.tpSvg.innerHTML = svgHtml;

    // Attach chart hover and touch listeners
    bindChartInteractions(points, mean);
  }

  /**
   * Tooltip handler for chart
   */
  function bindChartInteractions(points, meanVal) {
    const bars = dom.tpSvg.querySelectorAll(".chart-bar-rect, .chart-dot");
    const tooltip = dom.chartTooltip;

    const showTip = (target) => {
      const idx = parseInt(target.getAttribute("data-index"), 10);
      const val = target.getAttribute("data-val");
      const p = points[idx];
      const hourLabel = idx === 23 ? "Current Interval (T-0)" : `T-${23 - idx} hours ago`;
      const delta = (val - meanVal).toFixed(1);
      const deltaSign = delta >= 0 ? `+${delta}` : delta;
      const deltaColor = delta >= 0 ? "#38bdf8" : "#94a3b8";

      tooltip.innerHTML = `
        <div class="tt-hour">${hourLabel}</div>
        <div class="tt-value">${val},000 ops / sec</div>
        <div class="tt-delta" style="color: ${deltaColor}">
          ${deltaSign} k/s (${((delta / meanVal) * 100).toFixed(1)}% vs 24h mean)
        </div>
      `;
      tooltip.classList.add("visible");

      const rect = dom.chartWrapper.getBoundingClientRect();
      const svgRect = dom.tpSvg.getBoundingClientRect();
      const scaleX = svgRect.width / 840;
      const scaleY = svgRect.height / 220;

      const leftPx = (p.x * scaleX) + (svgRect.left - rect.left);
      const topPx = (p.y * scaleY) + (svgRect.top - rect.top);

      tooltip.style.left = `${leftPx}px`;
      tooltip.style.top = `${topPx}px`;
    };

    bars.forEach(el => {
      el.addEventListener("mouseenter", () => showTip(el));
      el.addEventListener("mouseleave", () => tooltip.classList.remove("visible"));
      el.addEventListener("touchstart", (e) => {
        e.preventDefault();
        showTip(el);
      }, { passive: false });
    });

    dom.chartWrapper.addEventListener("mouseleave", () => tooltip.classList.remove("visible"));
  }

  /**
   * Filters and sorts incident list based on active state
   */
  function getFilteredIncidents() {
    let list = [...state.incidents];

    // Filter by Severity
    if (state.filters.severity !== "all") {
      list = list.filter(inc => inc.severity.toLowerCase() === state.filters.severity.toLowerCase());
    }

    // Filter by Status
    if (state.filters.status !== "all") {
      list = list.filter(inc => inc.status.toLowerCase() === state.filters.status.toLowerCase());
    }

    // Filter by Service
    if (state.filters.service !== "all") {
      list = list.filter(inc => inc.service.toLowerCase() === state.filters.service.toLowerCase());
    }

    // Filter by Search Query
    if (state.filters.searchQuery.trim() !== "") {
      const q = state.filters.searchQuery.toLowerCase().trim();
      list = list.filter(inc =>
        inc.id.toLowerCase().includes(q) ||
        inc.service.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.owner.toLowerCase().includes(q) ||
        inc.status.toLowerCase().includes(q) ||
        inc.severity.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA, valB;
      const col = state.sort.column;

      if (col === "severity") {
        valA = SEVERITY_WEIGHT[a.severity] || 99;
        valB = SEVERITY_WEIGHT[b.severity] || 99;
      } else if (col === "age") {
        valA = a.ageMinutes || 0;
        valB = b.ageMinutes || 0;
      } else {
        valA = (a[col] || "").toString().toLowerCase();
        valB = (b[col] || "").toString().toLowerCase();
      }

      if (valA < valB) return state.sort.direction === "asc" ? -1 : 1;
      if (valA > valB) return state.sort.direction === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }

  /**
   * Renders the Incident Table
   */
  function renderIncidentTable() {
    const filtered = getFilteredIncidents();

    // Update filter badge counts
    updateFilterCounts();

    // Check empty state
    if (filtered.length === 0) {
      dom.tableBody.innerHTML = '';
      dom.emptyState.classList.remove("hidden");
      dom.incidentCounterTag.textContent = "0 matches";

      const constraints = [];
      if (state.filters.severity !== "all") constraints.push(`Severity: ${state.filters.severity}`);
      if (state.filters.status !== "all") constraints.push(`Status: ${state.filters.status}`);
      if (state.filters.service !== "all") constraints.push(`Service: ${state.filters.service}`);
      if (state.filters.searchQuery) constraints.push(`Query: "${state.filters.searchQuery}"`);

      dom.emptyStateDetail.textContent = constraints.length > 0
        ? `No active incidents match criteria (${constraints.join(" • ")}).`
        : "No incidents in queue.";
      return;
    }

    dom.emptyState.classList.add("hidden");
    dom.incidentCounterTag.textContent = `${filtered.length} active`;

    let rowsHtml = '';
    filtered.forEach(inc => {
      const isSelected = inc.id === state.selectedId;
      const isAck = inc.status.toLowerCase() === "acknowledged";
      const sevSymbol = inc.severity === "critical" ? "⬢" : inc.severity === "high" ? "▲" : inc.severity === "medium" ? "◼" : "●";

      rowsHtml += `
        <tr class="${isSelected ? 'selected' : ''}" 
            data-id="${inc.id}" 
            tabindex="0" 
            role="row" 
            aria-selected="${isSelected}">
          <td class="td-severity">
            <span class="badge sev-badge-${inc.severity}">
              <span class="badge-symbol">${sevSymbol}</span>
              ${inc.severity}
            </span>
          </td>
          <td class="td-id">${inc.id}</td>
          <td class="td-service">${inc.service}</td>
          <td class="td-title">${inc.title}</td>
          <td class="td-age">${inc.age}</td>
          <td class="td-owner ${inc.owner === 'Unassigned' ? 'unassigned' : ''}">
            ${inc.owner}
          </td>
          <td class="td-status">
            <span class="status-badge ${inc.status.toLowerCase()}">
              ${inc.status}
            </span>
          </td>
          <td class="td-actions">
            <button class="btn-table-ack ${isAck ? 'is-ack' : ''}" 
                    data-action="ack" 
                    data-id="${inc.id}" 
                    aria-label="Acknowledge incident ${inc.id}">
              ${isAck ? '✓ ACK' : 'ACK'}
            </button>
          </td>
        </tr>
      `;
    });

    dom.tableBody.innerHTML = rowsHtml;

    // Attach row events
    const rows = dom.tableBody.querySelectorAll("tr");
    rows.forEach(row => {
      row.addEventListener("click", (e) => {
        // If clicked on ACK button inside row
        const ackBtn = e.target.closest("[data-action='ack']");
        if (ackBtn) {
          e.stopPropagation();
          const incId = ackBtn.getAttribute("data-id");
          acknowledgeIncident(incId);
          return;
        }

        const incId = row.getAttribute("data-id");
        selectIncident(incId);
      });

      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectIncident(row.getAttribute("data-id"));
        } else if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          acknowledgeIncident(row.getAttribute("data-id"));
        }
      });
    });

    // Update overall system health indicator in top status bar
    updateSystemHealthHeadline();
  }

  /**
   * Updates count numbers on filter buttons and reset button visibility
   */
  function updateFilterCounts() {
    const allCount = state.incidents.length;
    const critCount = state.incidents.filter(i => i.severity === "critical").length;
    const highCount = state.incidents.filter(i => i.severity === "high").length;
    const medCount = state.incidents.filter(i => i.severity === "medium").length;
    const lowCount = state.incidents.filter(i => i.severity === "low").length;

    const countAll = document.getElementById("count-sev-all");
    const countCrit = document.getElementById("count-sev-critical");
    const countHigh = document.getElementById("count-sev-high");
    const countMed = document.getElementById("count-sev-medium");
    const countLow = document.getElementById("count-sev-low");

    if (countAll) countAll.textContent = allCount;
    if (countCrit) countCrit.textContent = critCount;
    if (countHigh) countHigh.textContent = highCount;
    if (countMed) countMed.textContent = medCount;
    if (countLow) countLow.textContent = lowCount;

    if (dom.navIncidentCount) dom.navIncidentCount.textContent = allCount;
    if (dom.statusIncidentMetric) dom.statusIncidentMetric.textContent = `${allCount} TOTAL`;

    // Reset button visibility
    const isFiltered = state.filters.severity !== "all" ||
                       state.filters.status !== "all" ||
                       state.filters.service !== "all" ||
                       state.filters.searchQuery !== "";

    if (dom.btnResetFilters) {
      if (isFiltered) dom.btnResetFilters.classList.remove("hidden");
      else dom.btnResetFilters.classList.add("hidden");
    }
  }

  /**
   * Updates top status bar headline based on active incidents status
   */
  function updateSystemHealthHeadline() {
    const criticals = state.incidents.filter(i => i.severity === "critical");
    const unAckCrit = criticals.filter(i => i.status !== "acknowledged" && i.status !== "resolved");

    if (unAckCrit.length > 0) {
      dom.statusHeadline.className = "system-health-pill critical";
      dom.statusHeadlineText.textContent = `${unAckCrit.length} CRITICAL INCIDENT ACTIVE`;
    } else if (criticals.length > 0 && criticals.every(i => i.status === "acknowledged")) {
      dom.statusHeadline.className = "system-health-pill acknowledged";
      dom.statusHeadlineText.textContent = `CRITICAL INCIDENT ACKNOWLEDGED`;
    } else {
      dom.statusHeadline.className = "system-health-pill nominal";
      dom.statusHeadlineText.textContent = `ALL PRIMARY SYSTEMS NOMINAL`;
    }
  }

  /**
   * Select an incident and update the detail panel
   */
  function selectIncident(id) {
    state.selectedId = id;
    renderIncidentTable();
    renderDetailPanel();

    dom.detailPanel.classList.remove("closed");
    dom.detailPanel.setAttribute("aria-hidden", "false");
  }

  /**
   * Render the detail panel with the currently selected incident
   */
  function renderDetailPanel() {
    const inc = state.incidents.find(i => i.id === state.selectedId);
    if (!inc) return;

    dom.detailIdText.textContent = inc.id;
    dom.detailTitleText.textContent = inc.title;

    // Severity Badge
    const sevSymbol = inc.severity === "critical" ? "⬢" : inc.severity === "high" ? "▲" : inc.severity === "medium" ? "◼" : "●";
    dom.detailSevBadge.className = `badge sev-badge-${inc.severity}`;
    dom.detailSevBadge.innerHTML = `<span class="badge-symbol">${sevSymbol}</span> ${inc.severity.toUpperCase()}`;

    // Status Badge
    dom.detailStatusBadge.className = `badge status-badge-${inc.status.toLowerCase()}`;
    dom.detailStatusBadge.textContent = inc.status.toUpperCase();
    dom.detailStatusSelect.value = inc.status;

    // Acknowledge Button State
    const isAck = inc.status.toLowerCase() === "acknowledged";
    if (isAck) {
      dom.btnAcknowledgeAction.classList.add("is-acknowledged");
      dom.btnAckLabel.textContent = "✓ Acknowledged";
      dom.btnAcknowledgeAction.setAttribute("aria-pressed", "true");
    } else {
      dom.btnAcknowledgeAction.classList.remove("is-acknowledged");
      dom.btnAckLabel.textContent = "Acknowledge Incident";
      dom.btnAcknowledgeAction.setAttribute("aria-pressed", "false");
    }

    // Grid data
    dom.detailServiceText.textContent = inc.service;
    dom.detailAgeText.textContent = inc.age;
    dom.detailOwnerText.textContent = inc.owner;
    dom.detailSloText.textContent = inc.slo || "SLO Breach under investigation";
    dom.detailSynopsisText.textContent = inc.synopsis || "Investigating telemetry degradation across cluster pods.";
    dom.detailRunbookText.textContent = inc.runbook || "RB-GEN-001 (General Triage Playbook)";
    dom.detailTelErrors.textContent = inc.errors || "Elevated rate";
    dom.detailTelReplicas.textContent = inc.replicas || "Replicas under inspection";

    // Render Timeline
    renderTimeline(inc);
  }

  /**
   * Render timeline items in detail panel
   */
  function renderTimeline(inc) {
    if (!inc.timeline || inc.timeline.length === 0) {
      dom.detailTimelineList.innerHTML = '<li class="timeline-item"><div class="timeline-content">No events logged yet.</div></li>';
      return;
    }

    let itemsHtml = '';
    inc.timeline.slice().reverse().forEach(t => {
      const isAckEvent = t.event.toLowerCase().includes("acknowledged");
      itemsHtml += `
        <li class="timeline-item ${isAckEvent ? 'ack' : ''}">
          <span class="timeline-dot" aria-hidden="true"></span>
          <div class="timeline-meta">
            <span class="timeline-time">${t.time}</span>
            <span class="timeline-author">// ${t.author}</span>
          </div>
          <div class="timeline-content">${t.event}</div>
        </li>
      `;
    });

    dom.detailTimelineList.innerHTML = itemsHtml;
  }

  /**
   * WORKING ACKNOWLEDGE ACTION
   */
  function acknowledgeIncident(id) {
    const inc = state.incidents.find(i => i.id === id);
    if (!inc) return;

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')} UTC`;

    if (inc.status === "acknowledged") {
      // Toggle back to investigating
      inc.status = "investigating";
      inc.timeline.push({
        time: timeStr,
        event: "Acknowledgment cleared; status reset to investigating.",
        author: "J. Mercer (Operator)"
      });
      announce(`Incident ${inc.id} status returned to investigating`);
    } else {
      // Acknowledge action
      inc.status = "acknowledged";
      if (inc.owner === "Unassigned") {
        inc.owner = "J. Mercer";
      }
      inc.timeline.push({
        time: timeStr,
        event: "Incident acknowledged by Console Operator J. Mercer. Escalation paused.",
        author: "J. Mercer (Operator)"
      });
      announce(`Incident ${inc.id} successfully acknowledged`);
    }

    // Refresh UI
    renderIncidentTable();
    if (state.selectedId === id) {
      renderDetailPanel();
    }
  }

  /**
   * Change status of an incident
   */
  function changeIncidentStatus(id, newStatus) {
    const inc = state.incidents.find(i => i.id === id);
    if (!inc || inc.status === newStatus) return;

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')} UTC`;

    inc.status = newStatus;
    inc.timeline.push({
      time: timeStr,
      event: `Operational status manually changed to ${newStatus.toUpperCase()}.`,
      author: "J. Mercer (Operator)"
    });

    announce(`Incident ${inc.id} status updated to ${newStatus}`);
    renderIncidentTable();
    renderDetailPanel();
  }

  /**
   * Assign incident to current operator
   */
  function assignToSelf(id) {
    const inc = state.incidents.find(i => i.id === id);
    if (!inc) return;

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')} UTC`;

    inc.owner = "J. Mercer";
    inc.timeline.push({
      time: timeStr,
      event: "Ownership taken by Console Operator J. Mercer.",
      author: "J. Mercer (Operator)"
    });

    announce(`Incident ${inc.id} assigned to J. Mercer`);
    renderIncidentTable();
    renderDetailPanel();
  }

  /**
   * Post custom operator note
   */
  function postOperatorNote(id, noteText) {
    const inc = state.incidents.find(i => i.id === id);
    if (!inc || !noteText.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')} UTC`;

    inc.timeline.push({
      time: timeStr,
      event: noteText.trim(),
      author: "J. Mercer (Note)"
    });

    announce(`Operational note added to ${inc.id}`);
    renderDetailPanel();
  }

  /**
   * Setup Event Listeners
   */
  function bindEvents() {
    // Acknowledge Action Button in detail panel
    dom.btnAcknowledgeAction.addEventListener("click", () => {
      acknowledgeIncident(state.selectedId);
    });

    // Detail Panel Status Dropdown
    dom.detailStatusSelect.addEventListener("change", (e) => {
      changeIncidentStatus(state.selectedId, e.target.value);
    });

    // Take ownership button
    dom.btnAssignSelf.addEventListener("click", () => {
      assignToSelf(state.selectedId);
    });

    // Escalate Button
    dom.btnEscalate.addEventListener("click", () => {
      const inc = state.incidents.find(i => i.id === state.selectedId);
      if (inc) {
        inc.timeline.push({
          time: new Date().toTimeString().split(" ")[0] + " UTC",
          event: "Incident escalated to Senior Incident Commander and SRE Escalation Rota.",
          author: "J. Mercer (Operator)"
        });
        announce(`Incident ${inc.id} escalated`);
        renderDetailPanel();
      }
    });

    // Close detail panel
    dom.btnCloseDetail.addEventListener("click", () => {
      dom.detailPanel.classList.add("closed");
      dom.detailPanel.setAttribute("aria-hidden", "true");
      announce("Incident detail panel closed");
    });

    // Note submission form
    dom.formOperatorNote.addEventListener("submit", (e) => {
      e.preventDefault();
      const note = dom.inputOperatorNote.value;
      postOperatorNote(state.selectedId, note);
      dom.inputOperatorNote.value = "";
    });

    // Search Input
    dom.searchInput.addEventListener("input", (e) => {
      state.filters.searchQuery = e.target.value;
      if (e.target.value) {
        dom.btnClearSearch.classList.remove("hidden");
      } else {
        dom.btnClearSearch.classList.add("hidden");
      }
      renderIncidentTable();
    });

    // Clear search button
    dom.btnClearSearch.addEventListener("click", () => {
      dom.searchInput.value = "";
      state.filters.searchQuery = "";
      dom.btnClearSearch.classList.add("hidden");
      dom.searchInput.focus();
      renderIncidentTable();
    });

    // Severity Filter Pills
    dom.severityPills.addEventListener("click", (e) => {
      const pill = e.target.closest("[data-filter='severity']");
      if (!pill) return;

      dom.severityPills.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");

      state.filters.severity = pill.getAttribute("data-value");
      renderIncidentTable();
    });

    // Status Filter Select
    dom.selectStatusFilter.addEventListener("change", (e) => {
      state.filters.status = e.target.value;
      renderIncidentTable();
    });

    // Service Filter Select
    dom.selectServiceFilter.addEventListener("change", (e) => {
      state.filters.service = e.target.value;
      renderIncidentTable();
    });

    // Reset Filters Button
    const resetAllFilters = () => {
      state.filters.severity = "all";
      state.filters.status = "all";
      state.filters.service = "all";
      state.filters.searchQuery = "";

      dom.searchInput.value = "";
      dom.btnClearSearch.classList.add("hidden");
      dom.selectStatusFilter.value = "all";
      dom.selectServiceFilter.value = "all";

      dom.severityPills.querySelectorAll(".pill").forEach(p => {
        if (p.getAttribute("data-value") === "all") p.classList.add("active");
        else p.classList.remove("active");
      });

      renderIncidentTable();
      announce("All filters reset to defaults");
    };

    dom.btnResetFilters.addEventListener("click", resetAllFilters);
    dom.btnEmptyReset.addEventListener("click", resetAllFilters);

    // Sortable Table Column Headers
    const thButtons = document.querySelectorAll(".th-sort-btn");
    thButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const th = btn.closest(".th-sortable");
        const sortCol = th.getAttribute("data-sort");

        if (state.sort.column === sortCol) {
          state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
        } else {
          state.sort.column = sortCol;
          state.sort.direction = "asc";
        }

        // Update ARIA sort attributes on all th
        document.querySelectorAll(".th-sortable").forEach(header => {
          if (header === th) {
            header.setAttribute("aria-sort", state.sort.direction === "asc" ? "ascending" : "descending");
          } else {
            header.setAttribute("aria-sort", "none");
          }
        });

        renderIncidentTable();
      });
    });

    // Refresh Telemetry Button
    dom.btnRefresh.addEventListener("click", () => {
      state.lastSyncTime = new Date();
      // Slight simulated jitter on latest throughput
      const latestVal = 40 + Math.floor(Math.random() * 5);
      state.throughput[state.throughput.length - 1] = latestVal;
      renderThroughputChart();
      renderMetrics();
      renderIncidentTable();
      announce("Telemetry refreshed and synchronized with cluster.");
    });

    // Audio Mute Toggle
    dom.btnAudioToggle.addEventListener("click", () => {
      state.audioMuted = !state.audioMuted;
      dom.btnAudioToggle.setAttribute("aria-pressed", (!state.audioMuted).toString());
      announce(state.audioMuted ? "Alarms muted" : "Alarms unmuted");
    });

    // Mobile Rail Toggle
    dom.btnToggleRail.addEventListener("click", () => {
      const rail = document.querySelector(".nav-rail");
      if (rail) {
        const isShown = rail.style.display === "flex";
        rail.style.display = isShown ? "none" : "flex";
      }
    });

    // Keyboard Shortcuts Dialog
    dom.btnShortcuts.addEventListener("click", () => dom.shortcutsDialog.showModal());
    dom.btnCloseShortcuts.addEventListener("click", () => dom.shortcutsDialog.close());
    dom.btnDismissShortcuts.addEventListener("click", () => dom.shortcutsDialog.close());

    // Global Keyboard Navigation
    document.addEventListener("keydown", (e) => {
      // If typing inside an input/select/textarea, ignore shortcuts except Escape
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (['input', 'textarea', 'select'].includes(activeTag)) {
        if (e.key === "Escape") {
          document.activeElement.blur();
        }
        return;
      }

      // / to focus search
      if (e.key === "/") {
        e.preventDefault();
        dom.searchInput.focus();
        return;
      }

      // ? to toggle shortcuts dialog
      if (e.key === "?") {
        e.preventDefault();
        if (dom.shortcutsDialog.open) dom.shortcutsDialog.close();
        else dom.shortcutsDialog.showModal();
        return;
      }

      // R to refresh
      if (e.key === "r" || e.key === "R") {
        dom.btnRefresh.click();
        return;
      }

      // Esc to close detail panel
      if (e.key === "Escape") {
        if (dom.shortcutsDialog.open) {
          dom.shortcutsDialog.close();
        } else if (!dom.detailPanel.classList.contains("closed")) {
          dom.btnCloseDetail.click();
        }
        return;
      }

      // A to acknowledge selected incident
      if (e.key === "a" || e.key === "A") {
        if (state.selectedId) {
          e.preventDefault();
          acknowledgeIncident(state.selectedId);
        }
        return;
      }

      // Arrow navigation across rows
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        navigateIncidentRows(e.key === "ArrowDown" ? 1 : -1);
      }
    });
  }

  /**
   * Keyboard Arrow navigation across incident rows
   */
  function navigateIncidentRows(delta) {
    const filtered = getFilteredIncidents();
    if (filtered.length === 0) return;

    const currentIndex = filtered.findIndex(i => i.id === state.selectedId);
    let nextIndex = currentIndex + delta;

    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= filtered.length) nextIndex = filtered.length - 1;

    const nextId = filtered[nextIndex].id;
    selectIncident(nextId);

    // Focus corresponding DOM row
    const targetRow = dom.tableBody.querySelector(`tr[data-id="${nextId}"]`);
    if (targetRow) {
      targetRow.focus();
      targetRow.scrollIntoView({ block: "nearest" });
    }
  }

  /**
   * Asynchronous loader attempting fetch, falling back to local seed data
   */
  async function loadData() {
    try {
      const response = await fetch("./DATA.json");
      if (response.ok) {
        const jsonData = await response.json();
        if (jsonData.metrics) state.metrics = jsonData.metrics;
        if (jsonData.throughput) state.throughput = jsonData.throughput;
        if (jsonData.incidents) {
          // Merge with detailed timeline data from SEED_DATA
          state.incidents = jsonData.incidents.map(inc => {
            const seedMatch = SEED_DATA.incidents.find(s => s.id === inc.id);
            return {
              ...seedMatch,
              ...inc,
              timeline: seedMatch ? seedMatch.timeline : [
                { time: "19:26:00 UTC", event: `Incident ${inc.id} detected`, author: "System Monitor" }
              ]
            };
          });
        }
      }
    } catch (err) {
      // Fetch may fail in file:// protocol sandbox; SEED_DATA is ready
      console.log("Using embedded seed data fallback");
    }
  }

  /**
   * Initialization
   */
  async function init() {
    await loadData();
    renderMetrics();
    renderThroughputChart();
    renderIncidentTable();
    renderDetailPanel();
    bindEvents();
    updateClock();
    setInterval(updateClock, 1000);

    // Window resize observer for SVG chart redraw
    window.addEventListener("resize", () => {
      renderThroughputChart();
    });
  }

  // Boot on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
