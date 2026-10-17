/**
 * Relay — Operations Control Room Application
 * Pure vanilla JavaScript. Seeds from DATA.json with embedded local fallback
 * so the dashboard runs identically via HTTP server or direct file:// open.
 */

(function () {
  "use strict";

  // Exact seed data from DATA.json
  const SEED_DATA = {
    metrics: [
      { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up" },
      { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down" },
      { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up" },
      { label: "Queue depth", value: "2,841", change: "−19%", direction: "down" }
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
        title: "Card authorization timeouts"
      },
      {
        id: "INC-2839",
        severity: "high",
        service: "event-router",
        age: "31m",
        owner: "Unassigned",
        status: "open",
        title: "EU retry queue growth"
      },
      {
        id: "INC-2837",
        severity: "medium",
        service: "search-index",
        age: "1h 08m",
        owner: "A. Silva",
        status: "monitoring",
        title: "Index freshness outside SLO"
      },
      {
        id: "INC-2832",
        severity: "low",
        service: "webhooks",
        age: "3h 42m",
        owner: "R. Patel",
        status: "open",
        title: "Elevated partner delivery lag"
      }
    ]
  };

  // Contextual metadata for the four summary metrics
  const METRIC_CONTEXT = {
    "Events / min": {
      code: "M1 · INGEST",
      baseline: "1h avg: 17,024/m",
      sloText: "Nominal capacity (74%)",
      polarity: "neutral"
    },
    "P95 latency": {
      code: "M2 · LATENCY",
      baseline: "SLO: < 250 ms",
      sloText: "Healthy (−66 ms buffer)",
      polarity: "positive"
    },
    "Error rate": {
      code: "M3 · ERRORS",
      baseline: "SLO ceiling: 0.50%",
      sloText: "Elevated on payments-api",
      polarity: "negative"
    },
    "Queue depth": {
      code: "M4 · BACKLOG",
      baseline: "Draining −665/5m",
      sloText: "EU partition recovering",
      polarity: "positive"
    }
  };

  // Operational enrichment per incident for the Inspector panel
  const INCIDENT_ENRICHMENT = {
    "INC-2841": {
      impact: "Auth success −4.1% (Tier-0)",
      region: "us-east-1a / us-east-1c",
      signature: "UPSTREAM_GW_504_TIMEOUT",
      summary:
        "Upstream issuer gateway connection pool saturation causing P99 spikes above 4,000 ms on synchronous /v2/authorize calls.",
      command: "relayctl traffic shift payments-api --fallback-pool=secondary --canary=25",
      timeline: [
        { time: "12:32 UTC", actor: "ALERT-MGR", text: "Page triggered: payments-api 5xx > 0.30% for 3m.", type: "system" },
        { time: "12:35 UTC", actor: "M. Chen", text: "Joined incident channel; isolating issuer pool metrics.", type: "note" }
      ]
    },
    "INC-2839": {
      impact: "2,841 delayed events",
      region: "eu-west-1b",
      signature: "KAFKA_CONSUMER_LAG_HIGH",
      summary:
        "Retry topic partition #4 experiencing consumer rebalance stalls after downstream webhook endpoint throttling.",
      command: "relayctl queue scale event-router --region=eu-west-1 --workers=16",
      timeline: [
        { time: "12:13 UTC", actor: "ALERT-MGR", text: "Queue depth exceeded 2,500 messages in eu-west-1.", type: "system" }
      ]
    },
    "INC-2837": {
      impact: "Stale reads ~95s (SLO 60s)",
      region: "us-east-1 · global-replica",
      signature: "INDEX_COMMIT_LAG_SLO",
      summary:
        "Bulk catalog re-indexing job increased segment merge I/O pressure; replication lag stabilizing after throttle applied.",
      command: "relayctl index throttle search-index --max-merge-mb=120",
      timeline: [
        { time: "11:36 UTC", actor: "ALERT-MGR", text: "Search index freshness crossed 60s SLO threshold.", type: "system" },
        { time: "11:48 UTC", actor: "A. Silva", text: "Applied I/O throttle to bulk indexer; monitoring lag decay.", type: "note" }
      ]
    },
    "INC-2832": {
      impact: "P95 delivery 4.2s (Tier-2)",
      region: "us-west-2a",
      signature: "PARTNER_EGRESS_BACKOFF",
      summary:
        "Single enterprise receiver returning HTTP 429; exponential backoff queue holding non-critical delivery attempts.",
      command: "relayctl webhooks inspect --tenant=partner-884 --drain-rate=50",
      timeline: [
        { time: "09:02 UTC", actor: "R. Patel", text: "Verified backoff policy isolating noisy tenant queue.", type: "note" }
      ]
    }
  };

  // Application State
  const state = {
    metrics: [],
    throughput: [],
    incidents: [],
    selectedIncidentId: "INC-2841",
    inspectedHour: 23,
    showSloThreshold: true,
    chartAreaOverlay: true,
    filters: {
      search: "",
      severity: "all",
      status: "all",
      service: "all",
      unacknowledgedOnly: false
    }
  };

  // DOM References
  const dom = {
    announcer: document.getElementById("sr-announcer"),
    metricsGrid: document.getElementById("metrics-grid"),
    chartContainer: document.getElementById("throughput-chart-container"),
    chartSrTbody: document.getElementById("throughput-sr-tbody"),
    tpPeak: document.getElementById("tp-peak"),
    tpMin: document.getElementById("tp-min"),
    tpMean: document.getElementById("tp-mean"),
    tpInspectHour: document.getElementById("tp-inspect-hour"),
    tpInspectVal: document.getElementById("tp-inspect-val"),
    toggleThresholdBtn: document.getElementById("toggle-threshold-btn"),
    toggleChartModeBtn: document.getElementById("toggle-chart-mode-btn"),
    incidentTbody: document.getElementById("incident-table-body"),
    incidentsCountLabel: document.getElementById("incidents-count-label"),
    emptyState: document.getElementById("incidents-empty-state"),
    emptyStateTitle: document.getElementById("empty-state-title"),
    emptyStateDesc: document.getElementById("empty-state-desc"),
    emptyResetBtn: document.getElementById("empty-reset-btn"),
    detailPanel: document.getElementById("incident-detail-panel"),
    filterSearch: document.getElementById("filter-search"),
    filterStatus: document.getElementById("filter-status"),
    filterService: document.getElementById("filter-service"),
    filterUnackBtn: document.getElementById("filter-unack-btn"),
    clearFiltersBtn: document.getElementById("clear-filters-btn"),
    sevFilterBtns: document.querySelectorAll(".sev-filter-btn"),
    ackAllVisibleBtn: document.getElementById("ack-all-visible-btn"),
    resetDemoBtn: document.getElementById("reset-demo-btn"),
    postureDot: document.getElementById("posture-dot"),
    postureLabel: document.getElementById("posture-label"),
    topbarOpenCount: document.getElementById("topbar-open-count"),
    topbarAckCount: document.getElementById("topbar-ack-count"),
    navIncidentCount: document.getElementById("nav-incident-count"),
    utcClock: document.getElementById("utc-clock"),
    railItems: document.querySelectorAll(".rail-item")
  };

  /**
   * Escape HTML special characters to prevent injection
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Announce status changes to screen readers
   */
  function announce(message) {
    if (!dom.announcer) return;
    dom.announcer.textContent = "";
    window.requestAnimationFrame(function () {
      dom.announcer.textContent = message;
    });
  }

  /**
   * Format current UTC time string HH:MM:SS
   */
  function getUtcTimeString() {
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2, "0");
    const mm = String(now.getUTCMinutes()).padStart(2, "0");
    const ss = String(now.getUTCSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  /**
   * Format HH:MM UTC for timeline logs
   */
  function getShortUtcTime() {
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2, "0");
    const mm = String(now.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm} UTC`;
  }

  /**
   * Hydrate application state from raw data object
   */
  function hydrateState(rawData) {
    state.metrics = (rawData.metrics || []).map(function (m) {
      return Object.assign({}, m);
    });

    state.throughput = Array.isArray(rawData.throughput) ? rawData.throughput.slice() : [];

    state.incidents = (rawData.incidents || []).map(function (inc) {
      const enrich = INCIDENT_ENRICHMENT[inc.id] || {
        impact: "Tier-2 service degradation",
        region: "us-east-1",
        signature: "SERVICE_ALERT",
        summary: "Automated alert triggered by threshold breach.",
        command: `relayctl inspect ${inc.service}`,
        timeline: []
      };

      return {
        id: inc.id,
        severity: inc.severity,
        service: inc.service,
        age: inc.age,
        owner: inc.owner,
        status: inc.status,
        title: inc.title,
        acknowledged: false,
        acknowledgedAt: null,
        acknowledgedBy: null,
        impact: enrich.impact,
        region: enrich.region,
        signature: enrich.signature,
        summary: enrich.summary,
        command: enrich.command,
        timeline: enrich.timeline.map(function (entry) {
          return Object.assign({}, entry);
        })
      };
    });

    if (state.incidents.length > 0) {
      state.selectedIncidentId = state.incidents[0].id;
    }
  }

  /**
   * Load DATA.json if served over HTTP/HTTPS, falling back to identical SEED_DATA
   */
  async function loadData() {
    try {
      const response = await fetch("DATA.json");
      if (response.ok) {
        const json = await response.json();
        hydrateState(json);
        renderAll();
        return;
      }
    } catch (_) {
      // Fallback to local embedded SEED_DATA when opened via file://
    }
    hydrateState(SEED_DATA);
    renderAll();
  }

  /**
   * Render the 4 summary metric cards
   */
  function renderMetrics() {
    const html = state.metrics
      .map(function (metric) {
        const ctx = METRIC_CONTEXT[metric.label] || {
          code: "TELEMETRY",
          baseline: "Rolling 1h",
          sloText: "Nominal",
          polarity: "neutral"
        };

        const arrow = metric.direction === "up" ? "↑" : "↓";
        const polarityClass =
          ctx.polarity === "positive"
            ? "is-positive"
            : ctx.polarity === "negative"
            ? "is-negative"
            : "is-neutral";

        return `
          <article class="metric-card" role="listitem">
            <div class="metric-top">
              <span class="metric-label">${escapeHtml(metric.label)}</span>
              <span class="metric-code">${escapeHtml(ctx.code)}</span>
            </div>
            <div class="metric-main">
              <span class="metric-value tabular">${escapeHtml(metric.value)}</span>
              <span class="metric-change ${polarityClass}" aria-label="Trend ${escapeHtml(metric.direction)} ${escapeHtml(metric.change)}">
                <span aria-hidden="true">${arrow}</span>
                <span>${escapeHtml(metric.change)}</span>
              </span>
            </div>
            <div class="metric-foot">
              <span>${escapeHtml(ctx.baseline)}</span>
              <span class="metric-slo-status">${escapeHtml(ctx.sloText)}</span>
            </div>
          </article>
        `;
      })
      .join("");

    dom.metricsGrid.innerHTML = html;
  }

  /**
   * Update the inspected hour readout in the throughput header
   */
  function updateThroughputReadout(hourIndex) {
    const values = state.throughput;
    if (!values.length) return;

    const clamped = Math.max(0, Math.min(values.length - 1, hourIndex));
    state.inspectedHour = clamped;

    const val = values[clamped];
    const sum = values.reduce(function (acc, n) {
      return acc + n;
    }, 0);
    const mean = sum / values.length;
    const diffPct = Math.round(((val - mean) / mean) * 100);
    const sign = diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`;
    const hourStr = `${String(clamped).padStart(2, "0")}:00 UTC`;

    dom.tpInspectHour.textContent = hourStr;
    dom.tpInspectVal.innerHTML = `${val} <small>(${sign} vs mean)</small>`;

    // Highlight active slot in SVG
    const slotGroups = dom.chartContainer.querySelectorAll(".chart-slot-group");
    slotGroups.forEach(function (group, idx) {
      if (idx === clamped) {
        group.classList.add("is-selected");
      } else {
        group.classList.remove("is-selected");
      }
    });
  }

  /**
   * Render the 24-hour inline SVG throughput chart and screen-reader table
   */
  function renderThroughputChart() {
    const values = state.throughput;
    if (!values.length) return;

    const maxVal = Math.max.apply(null, values);
    const minVal = Math.min.apply(null, values);
    const maxHour = values.indexOf(maxVal);
    const minHour = values.indexOf(minVal);
    const sum = values.reduce(function (a, b) {
      return a + b;
    }, 0);
    const mean = (sum / values.length).toFixed(1);

    dom.tpPeak.innerHTML = `${maxVal} <small>(${String(maxHour).padStart(2, "0")}:00)</small>`;
    dom.tpMin.innerHTML = `${minVal} <small>(${String(minHour).padStart(2, "0")}:00)</small>`;
    dom.tpMean.textContent = mean;

    const svgWidth = 760;
    const svgHeight = 164;
    const padLeft = 32;
    const padRight = 14;
    const padTop = 12;
    const padBottom = 24;
    const plotWidth = svgWidth - padLeft - padRight;
    const plotHeight = svgHeight - padTop - padBottom;
    const yMax = 100;
    const sloCeiling = 80;

    function getX(index) {
      return padLeft + (index + 0.5) * (plotWidth / values.length);
    }

    function getY(val) {
      return padTop + plotHeight - (val / yMax) * plotHeight;
    }

    // Horizontal Y-axis grid lines (0, 25, 50, 75, 100)
    const yTicks = [0, 25, 50, 75, 100];
    const gridLinesSvg = yTicks
      .map(function (tick) {
        const y = getY(tick).toFixed(1);
        return `
          <line x1="${padLeft}" y1="${y}" x2="${svgWidth - padRight}" y2="${y}" class="chart-grid-line" />
          <text x="${padLeft - 6}" y="${Number(y) + 3}" text-anchor="end" class="chart-axis-text">${tick}</text>
        `;
      })
      .join("");

    // SLO Ceiling line at 80
    const sloY = getY(sloCeiling).toFixed(1);
    const thresholdSvg = state.showSloThreshold
      ? `
        <line x1="${padLeft}" y1="${sloY}" x2="${svgWidth - padRight}" y2="${sloY}" class="chart-threshold-line" />
        <text x="${svgWidth - padRight - 4}" y="${Number(sloY) - 4}" text-anchor="end" class="chart-threshold-label">SLO SOFT CEILING (80)</text>
      `
      : "";

    // Line & Area path
    const points = values.map(function (v, idx) {
      return `${getX(idx).toFixed(1)},${getY(v).toFixed(1)}`;
    });
    const linePathD = `M ${points.join(" L ")}`;
    const firstX = getX(0).toFixed(1);
    const lastX = getX(values.length - 1).toFixed(1);
    const baseLineY = getY(0).toFixed(1);
    const areaPathD = `M ${firstX},${baseLineY} L ${points.join(" L ")} L ${lastX},${baseLineY} Z`;

    const areaAndLineSvg = state.chartAreaOverlay
      ? `
        <path d="${areaPathD}" class="chart-area-path" />
        <path d="${linePathD}" class="chart-line-path" />
      `
      : "";

    // 24 Interactive hourly bars + points + X-axis labels
    const slotWidth = plotWidth / values.length;
    const barWidth = Math.max(8, slotWidth * 0.62);

    const barsSvg = values
      .map(function (val, idx) {
        const cx = getX(idx);
        const barX = (cx - barWidth / 2).toFixed(1);
        const barY = getY(val).toFixed(1);
        const barH = (getY(0) - getY(val)).toFixed(1);
        const hourLabel = `${String(idx).padStart(2, "0")}:00`;
        const isAboveSlo = val >= sloCeiling;
        const selectedClass = idx === state.inspectedHour ? "is-selected" : "";
        const showHourTick = idx % 3 === 0 || idx === 23;

        return `
          <g
            class="chart-slot-group ${selectedClass}"
            tabindex="0"
            role="button"
            data-hour="${idx}"
            aria-label="${hourLabel} UTC, throughput index ${val}${isAboveSlo ? ", above SLO soft ceiling" : ""}"
          >
            <rect
              x="${(padLeft + idx * slotWidth).toFixed(1)}"
              y="${padTop}"
              width="${slotWidth.toFixed(1)}"
              height="${plotHeight}"
              class="chart-slot-hit"
            />
            <rect
              x="${barX}"
              y="${barY}"
              width="${barWidth.toFixed(1)}"
              height="${barH}"
              rx="1"
              class="chart-bar ${isAboveSlo ? "is-above-slo" : ""}"
            />
            <circle
              cx="${cx.toFixed(1)}"
              cy="${barY}"
              r="2.6"
              class="chart-point ${isAboveSlo ? "is-above-slo" : ""}"
            />
            ${
              showHourTick
                ? `<text x="${cx.toFixed(1)}" y="${svgHeight - 6}" text-anchor="middle" class="chart-axis-text">${String(idx).padStart(2, "0")}h</text>`
                : ""
            }
          </g>
        `;
      })
      .join("");

    dom.chartContainer.innerHTML = `
      <svg
        class="throughput-svg"
        viewBox="0 0 ${svgWidth} ${svgHeight}"
        preserveAspectRatio="none"
        aria-hidden="false"
      >
        ${gridLinesSvg}
        ${ areaAndLineSvg }
        ${barsSvg}
        ${thresholdSvg}
      </svg>
    `;

    // Populate screen-reader table fallback
    dom.chartSrTbody.innerHTML = values
      .map(function (val, idx) {
        const hourLabel = `${String(idx).padStart(2, "0")}:00 UTC`;
        const statusText = val >= sloCeiling ? "Above soft ceiling (80)" : "Nominal";
        return `
          <tr>
            <td>${hourLabel}</td>
            <td>${val}</td>
            <td>${statusText}</td>
          </tr>
        `;
      })
      .join("");

    updateThroughputReadout(state.inspectedHour);
  }

  /**
   * Compute filtered incidents based on active filter state
   */
  function getFilteredIncidents() {
    const q = state.filters.search.trim().toLowerCase();
    const sev = state.filters.severity;
    const status = state.filters.status;
    const service = state.filters.service;
    const unackOnly = state.filters.unacknowledgedOnly;

    return state.incidents.filter(function (inc) {
      if (sev !== "all" && inc.severity !== sev) return false;
      if (status !== "all" && inc.status !== status) return false;
      if (service !== "all" && inc.service !== service) return false;
      if (unackOnly && inc.acknowledged) return false;

      if (q) {
        const haystack = `${inc.id} ${inc.title} ${inc.service} ${inc.owner} ${inc.severity} ${inc.status}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  /**
   * Check whether any filter is currently active
   */
  function hasActiveFilters() {
    return (
      state.filters.search.trim() !== "" ||
      state.filters.severity !== "all" ||
      state.filters.status !== "all" ||
      state.filters.service !== "all" ||
      state.filters.unacknowledgedOnly
    );
  }

  /**
   * Update severity filter badge counts & top status bar counters
   */
  function updateCountersAndPosture() {
    const counts = { all: state.incidents.length, critical: 0, high: 0, medium: 0, low: 0 };
    let openOrInvCount = 0;
    let ackedCount = 0;
    let unackedCriticalCount = 0;

    state.incidents.forEach(function (inc) {
      if (counts[inc.severity] !== undefined) {
        counts[inc.severity] += 1;
      }
      if (inc.status === "open" || inc.status === "investigating") {
        openOrInvCount += 1;
      }
      if (inc.acknowledged) {
        ackedCount += 1;
      }
      if (inc.severity === "critical" && !inc.acknowledged && inc.status !== "resolved") {
        unackedCriticalCount += 1;
      }
    });

    document.getElementById("count-sev-all").textContent = counts.all;
    document.getElementById("count-sev-critical").textContent = counts.critical;
    document.getElementById("count-sev-high").textContent = counts.high;
    document.getElementById("count-sev-medium").textContent = counts.medium;
    document.getElementById("count-sev-low").textContent = counts.low;

    dom.topbarOpenCount.textContent = openOrInvCount;
    dom.topbarAckCount.textContent = ackedCount;
    dom.navIncidentCount.textContent = state.incidents.filter(function (i) {
      return i.status !== "resolved";
    }).length;

    // System posture pill
    dom.postureDot.className = "posture-indicator";
    if (unackedCriticalCount > 0) {
      dom.postureDot.classList.add("is-critical");
      dom.postureLabel.textContent = `DEGRADED · ${unackedCriticalCount} CRITICAL UNACKED`;
    } else if (openOrInvCount > 0) {
      dom.postureDot.classList.add("is-warning");
      dom.postureLabel.textContent = `ELEVATED · ${openOrInvCount} ACTIVE IN QUEUE`;
    } else {
      dom.postureDot.classList.add("is-nominal");
      dom.postureLabel.textContent = "NOMINAL · ALL INCIDENTS MITIGATED";
    }
  }

  /**
   * Render the filterable incident table and empty state
   */
  function renderIncidentTable() {
    const filtered = getFilteredIncidents();
    const total = state.incidents.length;

    dom.incidentsCountLabel.textContent = `Showing ${filtered.length} of ${total} incidents`;
    dom.clearFiltersBtn.hidden = !hasActiveFilters();

    if (filtered.length === 0) {
      dom.incidentTbody.innerHTML = "";
      dom.emptyState.hidden = false;

      const activeParts = [];
      if (state.filters.severity !== "all") activeParts.push(`severity=${state.filters.severity}`);
      if (state.filters.status !== "all") activeParts.push(`status=${state.filters.status}`);
      if (state.filters.service !== "all") activeParts.push(`service=${state.filters.service}`);
      if (state.filters.unacknowledgedOnly) activeParts.push("unacknowledged=true");
      if (state.filters.search.trim()) activeParts.push(`query="${state.filters.search.trim()}"`);

      dom.emptyStateTitle.textContent = "No incidents match the active filter criteria.";
      dom.emptyStateDesc.textContent = activeParts.length
        ? `Active filters (${activeParts.join(", ")}) returned 0 of ${total} incidents.`
        : "No incidents in queue.";
      return;
    }

    dom.emptyState.hidden = true;

    // If current selected incident is not in filtered list, keep selection if it exists, or select first visible
    const selectedStillVisible = filtered.some(function (inc) {
      return inc.id === state.selectedIncidentId;
    });
    if (!selectedStillVisible && filtered.length > 0) {
      state.selectedIncidentId = filtered[0].id;
    }

    const rowsHtml = filtered
      .map(function (inc) {
        const isSelected = inc.id === state.selectedIncidentId;
        const sevLabel =
          inc.severity === "critical"
            ? "CRIT"
            : inc.severity === "high"
            ? "HIGH"
            : inc.severity === "medium"
            ? "MED"
            : "LOW";

        const isUnassigned = inc.owner.toLowerCase() === "unassigned";

        return `
          <tr
            class="incident-row ${isSelected ? "is-selected" : ""}"
            data-incident-id="${escapeHtml(inc.id)}"
            tabindex="0"
            aria-selected="${isSelected ? "true" : "false"}"
          >
            <td class="cell-sev">
              <span class="sev-badge sev-${escapeHtml(inc.severity)}">${sevLabel}</span>
            </td>
            <td class="cell-id">
              <div class="incident-id-line">
                <span>${escapeHtml(inc.id)}</span>
                ${inc.acknowledged ? '<span class="ack-pill" title="Acknowledged by operator">ACK</span>' : ""}
              </div>
              <div class="incident-title-line" title="${escapeHtml(inc.title)}">${escapeHtml(inc.title)}</div>
            </td>
            <td class="cell-service">
              <span class="service-tag">${escapeHtml(inc.service)}</span>
            </td>
            <td class="cell-age age-cell tabular">${escapeHtml(inc.age)}</td>
            <td class="cell-owner owner-cell ${isUnassigned ? "is-unassigned" : ""}">
              ${escapeHtml(inc.owner)}
            </td>
            <td class="cell-status">
              <span class="status-badge status-${escapeHtml(inc.status)}">${escapeHtml(inc.status)}</span>
            </td>
            <td class="cell-action action-cell">
              <button
                type="button"
                class="btn btn-compact ${inc.acknowledged ? "btn-ack-done" : ""}"
                data-ack-id="${escapeHtml(inc.id)}"
                aria-label="${inc.acknowledged ? `Acknowledged ${escapeHtml(inc.id)}` : `Acknowledge ${escapeHtml(inc.id)}`}"
              >
                ${inc.acknowledged ? "Acked ✓" : "Ack"}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    dom.incidentTbody.innerHTML = rowsHtml;
  }

  /**
   * Render the right-hand Incident Detail Inspector Panel
   */
  function renderDetailPanel() {
    const inc = state.incidents.find(function (item) {
      return item.id === state.selectedIncidentId;
    });

    if (!inc) {
      dom.detailPanel.innerHTML = `
        <div class="panel-header">
          <h2 id="detail-panel-heading" class="panel-title">Incident Inspector</h2>
        </div>
        <div class="empty-state">
          <div class="empty-state-code">INSPECTOR STANDBY</div>
          <p class="empty-state-title">No incident selected</p>
          <p class="empty-state-desc">Select an incident row in the queue to inspect telemetry, runbooks, and responder logs.</p>
        </div>
      `;
      return;
    }

    const ackButtonLabel = inc.acknowledged
      ? `Acknowledged (${inc.acknowledgedAt || "Active"}) ✓`
      : "Acknowledge Incident (A)";

    const timelineHtml = inc.timeline
      .slice()
      .reverse()
      .map(function (item) {
        return `
          <li class="activity-item ${item.type === "ack" ? "is-ack-event" : ""}">
            <div class="activity-meta">
              <span>${escapeHtml(item.actor)}</span>
              <time>${escapeHtml(item.time)}</time>
            </div>
            <div class="activity-text">${escapeHtml(item.text)}</div>
          </li>
        `;
      })
      .join("");

    dom.detailPanel.innerHTML = `
      <div class="detail-header">
        <div class="detail-top-meta">
          <div class="detail-id-group">
            <span class="detail-id" id="detail-panel-heading">${escapeHtml(inc.id)}</span>
            <span class="sev-badge sev-${escapeHtml(inc.severity)}">${escapeHtml(inc.severity)}</span>
            <span class="status-badge status-${escapeHtml(inc.status)}">${escapeHtml(inc.status)}</span>
          </div>
          <span class="panel-subtitle tabular">AGE: ${escapeHtml(inc.age)}</span>
        </div>
        <h3 class="detail-title">${escapeHtml(inc.title)}</h3>
      </div>

      <div class="detail-action-bar">
        <div class="detail-primary-actions">
          <button
            type="button"
            id="detail-ack-btn"
            class="btn ${inc.acknowledged ? "btn-ack-done" : "btn-accent"} btn-ack-main"
            data-detail-ack-id="${escapeHtml(inc.id)}"
          >
            ${escapeHtml(ackButtonLabel)}
          </button>

          <button
            type="button"
            id="detail-assign-btn"
            class="btn btn-compact"
            data-assign-id="${escapeHtml(inc.id)}"
            ${inc.owner === "J. Vance" ? "disabled" : ""}
          >
            ${inc.owner === "J. Vance" ? "Assigned to You" : "Take Ownership"}
          </button>
        </div>

        <div class="detail-secondary-actions">
          <label for="detail-status-select" class="select-label">Transition status:</label>
          <select id="detail-status-select" class="filter-select" data-status-incident-id="${escapeHtml(inc.id)}">
            <option value="open" ${inc.status === "open" ? "selected" : ""}>Open</option>
            <option value="investigating" ${inc.status === "investigating" ? "selected" : ""}>Investigating</option>
            <option value="acknowledged" ${inc.status === "acknowledged" ? "selected" : ""}>Acknowledged</option>
            <option value="monitoring" ${inc.status === "monitoring" ? "selected" : ""}>Monitoring</option>
            <option value="resolved" ${inc.status === "resolved" ? "selected" : ""}>Resolved</option>
          </select>
        </div>
      </div>

      <div class="detail-body">
        <div class="kv-grid" role="group" aria-label="Incident attributes">
          <div class="kv-cell">
            <span class="kv-key">Service</span>
            <span class="kv-val">${escapeHtml(inc.service)}</span>
          </div>
          <div class="kv-cell">
            <span class="kv-key">Owner</span>
            <span class="kv-val">${escapeHtml(inc.owner)}</span>
          </div>
          <div class="kv-cell">
            <span class="kv-key">SLO Impact</span>
            <span class="kv-val" title="${escapeHtml(inc.impact)}">${escapeHtml(inc.impact)}</span>
          </div>
          <div class="kv-cell">
            <span class="kv-key">Fault Zone</span>
            <span class="kv-val" title="${escapeHtml(inc.region)}">${escapeHtml(inc.region)}</span>
          </div>
          <div class="kv-cell">
            <span class="kv-key">Signature</span>
            <span class="kv-val" title="${escapeHtml(inc.signature)}">${escapeHtml(inc.signature)}</span>
          </div>
          <div class="kv-cell">
            <span class="kv-key">Ack State</span>
            <span class="kv-val">${inc.acknowledged ? `ACKED (${escapeHtml(inc.acknowledgedBy)})` : "UNACKNOWLEDGED"}</span>
          </div>
        </div>

        <div>
          <h4 class="detail-block-title">Telemetry &amp; Mitigation Runbook</h4>
          <div class="diagnostic-box">
            <div>${escapeHtml(inc.summary)}</div>
            <div class="runbook-cmd">
              <code id="runbook-code-text">${escapeHtml(inc.command)}</code>
              <button type="button" class="btn btn-compact" id="copy-cmd-btn" data-cmd="${escapeHtml(inc.command)}">
                Copy CLI
              </button>
            </div>
          </div>
        </div>

        <div>
          <h4 class="detail-block-title">Responder Activity Log (${inc.timeline.length})</h4>
          <ol class="activity-log">
            ${timelineHtml}
          </ol>
          <form id="incident-note-form" class="note-form">
            <label for="incident-note-input" class="sr-only">Add responder note</label>
            <input
              type="text"
              id="incident-note-input"
              class="note-input"
              placeholder="Append responder note to timeline..."
              autocomplete="off"
            />
            <button type="submit" class="btn btn-compact">Log Note</button>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Acknowledge or toggle acknowledgement on an incident
   */
  function toggleAcknowledgeIncident(incidentId) {
    const inc = state.incidents.find(function (item) {
      return item.id === incidentId;
    });
    if (!inc) return;

    const timestamp = getShortUtcTime();

    if (!inc.acknowledged) {
      inc.acknowledged = true;
      inc.acknowledgedAt = timestamp;
      inc.acknowledgedBy = "J. Vance";

      if (inc.status === "open" || inc.status === "investigating") {
        inc.status = "acknowledged";
      }
      if (inc.owner === "Unassigned") {
        inc.owner = "J. Vance";
      }

      inc.timeline.push({
        time: timestamp,
        actor: "J. Vance",
        text: `Incident acknowledged. Status set to ${inc.status.toUpperCase()}.`,
        type: "ack"
      });

      announce(`Incident ${inc.id} (${inc.title}) acknowledged by J. Vance.`);
    } else {
      inc.acknowledged = false;
      inc.acknowledgedAt = null;
      inc.acknowledgedBy = null;
      if (inc.status === "acknowledged") {
        inc.status = "investigating";
      }

      inc.timeline.push({
        time: timestamp,
        actor: "J. Vance",
        text: "Acknowledgement cleared; status returned to INVESTIGATING.",
        type: "system"
      });

      announce(`Acknowledgement cleared for incident ${inc.id}.`);
    }

    state.selectedIncidentId = inc.id;
    updateCountersAndPosture();
    renderIncidentTable();
    renderDetailPanel();
  }

  /**
   * Reset all incident filters to default
   */
  function resetAllFilters() {
    state.filters.search = "";
    state.filters.severity = "all";
    state.filters.status = "all";
    state.filters.service = "all";
    state.filters.unacknowledgedOnly = false;

    dom.filterSearch.value = "";
    dom.filterStatus.value = "all";
    dom.filterService.value = "all";
    dom.filterUnackBtn.setAttribute("aria-pressed", "false");

    dom.sevFilterBtns.forEach(function (btn) {
      const isAll = btn.getAttribute("data-sev") === "all";
      btn.classList.toggle("is-active", isAll);
      btn.setAttribute("aria-pressed", isAll ? "true" : "false");
    });

    renderIncidentTable();
    renderDetailPanel();
    announce("All incident filters reset. Showing all incidents.");
  }

  /**
   * Render all views
   */
  function renderAll() {
    renderMetrics();
    renderThroughputChart();
    updateCountersAndPosture();
    renderIncidentTable();
    renderDetailPanel();
  }

  /**
   * Bind Event Listeners
   */
  function bindEvents() {
    // Navigation rail items
    dom.railItems.forEach(function (btn) {
      btn.addEventListener("click", function () {
        dom.railItems.forEach(function (b) {
          b.classList.remove("is-active");
          b.removeAttribute("aria-current");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-current", "page");

        const targetSelector = btn.getAttribute("data-scroll-target");
        if (targetSelector) {
          const targetEl = document.querySelector(targetSelector);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      });
    });

    // Throughput Chart controls & interactive inspection
    dom.toggleThresholdBtn.addEventListener("click", function () {
      state.showSloThreshold = !state.showSloThreshold;
      dom.toggleThresholdBtn.classList.toggle("is-pressed", state.showSloThreshold);
      dom.toggleThresholdBtn.setAttribute("aria-pressed", String(state.showSloThreshold));
      renderThroughputChart();
    });

    dom.toggleChartModeBtn.addEventListener("click", function () {
      state.chartAreaOverlay = !state.chartAreaOverlay;
      dom.toggleChartModeBtn.classList.toggle("is-pressed", state.chartAreaOverlay);
      dom.toggleChartModeBtn.setAttribute("aria-pressed", String(state.chartAreaOverlay));
      renderThroughputChart();
    });

    dom.chartContainer.addEventListener("mouseover", function (e) {
      const slot = e.target.closest(".chart-slot-group");
      if (slot) {
        const hr = Number(slot.getAttribute("data-hour"));
        updateThroughputReadout(hr);
      }
    });

    dom.chartContainer.addEventListener("focusin", function (e) {
      const slot = e.target.closest(".chart-slot-group");
      if (slot) {
        const hr = Number(slot.getAttribute("data-hour"));
        updateThroughputReadout(hr);
      }
    });

    dom.chartContainer.addEventListener("keydown", function (e) {
      const slot = e.target.closest(".chart-slot-group");
      if (!slot) return;
      const currentHour = Number(slot.getAttribute("data-hour"));

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const nextHour =
          e.key === "ArrowRight"
            ? Math.min(23, currentHour + 1)
            : Math.max(0, currentHour - 1);
        updateThroughputReadout(nextHour);
        const nextEl = dom.chartContainer.querySelector(`.chart-slot-group[data-hour="${nextHour}"]`);
        if (nextEl) nextEl.focus();
      }
    });

    // Search input
    dom.filterSearch.addEventListener("input", function (e) {
      state.filters.search = e.target.value;
      renderIncidentTable();
      renderDetailPanel();
    });

    // Severity filter buttons
    dom.sevFilterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const sev = btn.getAttribute("data-sev");
        state.filters.severity = sev;
        dom.sevFilterBtns.forEach(function (b) {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-pressed", active ? "true" : "false");
        });
        renderIncidentTable();
        renderDetailPanel();
      });
    });

    // Status & Service selects
    dom.filterStatus.addEventListener("change", function (e) {
      state.filters.status = e.target.value;
      renderIncidentTable();
      renderDetailPanel();
    });

    dom.filterService.addEventListener("change", function (e) {
      state.filters.service = e.target.value;
      renderIncidentTable();
      renderDetailPanel();
    });

    // Unacknowledged toggle
    dom.filterUnackBtn.addEventListener("click", function () {
      state.filters.unacknowledgedOnly = !state.filters.unacknowledgedOnly;
      dom.filterUnackBtn.setAttribute("aria-pressed", String(state.filters.unacknowledgedOnly));
      renderIncidentTable();
      renderDetailPanel();
    });

    // Clear / Reset filters buttons
    dom.clearFiltersBtn.addEventListener("click", resetAllFilters);
    dom.emptyResetBtn.addEventListener("click", resetAllFilters);

    // Acknowledge all visible open incidents
    dom.ackAllVisibleBtn.addEventListener("click", function () {
      const visible = getFilteredIncidents();
      let count = 0;
      const timestamp = getShortUtcTime();

      visible.forEach(function (inc) {
        if (!inc.acknowledged) {
          inc.acknowledged = true;
          inc.acknowledgedAt = timestamp;
          inc.acknowledgedBy = "J. Vance";
          if (inc.status === "open" || inc.status === "investigating") {
            inc.status = "acknowledged";
          }
          if (inc.owner === "Unassigned") {
            inc.owner = "J. Vance";
          }
          inc.timeline.push({
            time: timestamp,
            actor: "J. Vance",
            text: "Bulk acknowledged via queue action.",
            type: "ack"
          });
          count += 1;
        }
      });

      if (count > 0) {
        updateCountersAndPosture();
        renderIncidentTable();
        renderDetailPanel();
        announce(`Acknowledged ${count} visible incident${count === 1 ? "" : "s"}.`);
      } else {
        announce("All visible incidents are already acknowledged.");
      }
    });

    // Incident Table row selection, inline ack, and keyboard navigation
    dom.incidentTbody.addEventListener("click", function (e) {
      const ackBtn = e.target.closest("[data-ack-id]");
      if (ackBtn) {
        e.stopPropagation();
        const ackId = ackBtn.getAttribute("data-ack-id");
        toggleAcknowledgeIncident(ackId);
        return;
      }

      const row = e.target.closest(".incident-row");
      if (row) {
        const incId = row.getAttribute("data-incident-id");
        state.selectedIncidentId = incId;
        renderIncidentTable();
        renderDetailPanel();
      }
    });

    dom.incidentTbody.addEventListener("keydown", function (e) {
      const row = e.target.closest(".incident-row");
      if (!row || e.target.closest("button")) return;

      const incId = row.getAttribute("data-incident-id");
      const allRows = Array.from(dom.incidentTbody.querySelectorAll(".incident-row"));
      const idx = allRows.indexOf(row);

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        state.selectedIncidentId = incId;
        renderIncidentTable();
        renderDetailPanel();
        const newRow = dom.incidentTbody.querySelector(`.incident-row[data-incident-id="${incId}"]`);
        if (newRow) newRow.focus();
      } else if (e.key === "ArrowDown" && idx < allRows.length - 1) {
        e.preventDefault();
        const nextRow = allRows[idx + 1];
        state.selectedIncidentId = nextRow.getAttribute("data-incident-id");
        renderIncidentTable();
        renderDetailPanel();
        const refocused = dom.incidentTbody.querySelector(
          `.incident-row[data-incident-id="${state.selectedIncidentId}"]`
        );
        if (refocused) refocused.focus();
      } else if (e.key === "ArrowUp" && idx > 0) {
        e.preventDefault();
        const prevRow = allRows[idx - 1];
        state.selectedIncidentId = prevRow.getAttribute("data-incident-id");
        renderIncidentTable();
        renderDetailPanel();
        const refocused = dom.incidentTbody.querySelector(
          `.incident-row[data-incident-id="${state.selectedIncidentId}"]`
        );
        if (refocused) refocused.focus();
      }
    });

    // Detail Inspector Panel delegated actions
    dom.detailPanel.addEventListener("click", function (e) {
      const ackBtn = e.target.closest("[data-detail-ack-id]");
      if (ackBtn) {
        const id = ackBtn.getAttribute("data-detail-ack-id");
        toggleAcknowledgeIncident(id);
        const refreshedBtn = document.getElementById("detail-ack-btn");
        if (refreshedBtn) refreshedBtn.focus();
        return;
      }

      const assignBtn = e.target.closest("[data-assign-id]");
      if (assignBtn) {
        const id = assignBtn.getAttribute("data-assign-id");
        const inc = state.incidents.find(function (item) {
          return item.id === id;
        });
        if (inc) {
          inc.owner = "J. Vance";
          inc.timeline.push({
            time: getShortUtcTime(),
            actor: "J. Vance",
            text: "Took incident ownership.",
            type: "note"
          });
          renderIncidentTable();
          renderDetailPanel();
          announce(`Assigned ${inc.id} to J. Vance.`);
        }
        return;
      }

      const copyBtn = e.target.closest("#copy-cmd-btn");
      if (copyBtn) {
        const cmd = copyBtn.getAttribute("data-cmd") || "";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(cmd).catch(function () {});
        }
        copyBtn.textContent = "Copied ✓";
        announce("Mitigation command copied to clipboard.");
        setTimeout(function () {
          if (copyBtn.isConnected) copyBtn.textContent = "Copy CLI";
        }, 1500);
      }
    });

    dom.detailPanel.addEventListener("change", function (e) {
      if (e.target.id === "detail-status-select") {
        const id = e.target.getAttribute("data-status-incident-id");
        const newStatus = e.target.value;
        const inc = state.incidents.find(function (item) {
          return item.id === id;
        });
        if (inc) {
          inc.status = newStatus;
          if (newStatus === "acknowledged") {
            inc.acknowledged = true;
            inc.acknowledgedAt = inc.acknowledgedAt || getShortUtcTime();
            inc.acknowledgedBy = inc.acknowledgedBy || "J. Vance";
          }
          inc.timeline.push({
            time: getShortUtcTime(),
            actor: "J. Vance",
            text: `Transitioned status to ${newStatus.toUpperCase()}.`,
            type: "note"
          });
          updateCountersAndPosture();
          renderIncidentTable();
          renderDetailPanel();
          announce(`Incident ${inc.id} status changed to ${newStatus}.`);
        }
      }
    });

    dom.detailPanel.addEventListener("submit", function (e) {
      if (e.target.id === "incident-note-form") {
        e.preventDefault();
        const input = document.getElementById("incident-note-input");
        const noteText = input ? input.value.trim() : "";
        if (!noteText) return;

        const inc = state.incidents.find(function (item) {
          return item.id === state.selectedIncidentId;
        });
        if (inc) {
          inc.timeline.push({
            time: getShortUtcTime(),
            actor: "J. Vance",
            text: noteText,
            type: "note"
          });
          renderDetailPanel();
          announce(`Added responder note to ${inc.id}.`);
        }
      }
    });

    // Reset Demo State button
    dom.resetDemoBtn.addEventListener("click", function () {
      hydrateState(SEED_DATA);
      resetAllFilters();
      renderAll();
      announce("Dashboard state restored to initial seed data.");
    });

    // Global operator keyboard shortcuts: '/' to focus search, 'a' to ack selected incident
    document.addEventListener("keydown", function (e) {
      const tag = (e.target.tagName || "").toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;

      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        dom.filterSearch.focus();
        dom.filterSearch.select();
      } else if ((e.key === "a" || e.key === "A") && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (state.selectedIncidentId) {
          e.preventDefault();
          toggleAcknowledgeIncident(state.selectedIncidentId);
        }
      }
    });
  }

  /**
   * Start UTC live clock tick
   */
  function startClock() {
    function tick() {
      if (dom.utcClock) {
        dom.utcClock.textContent = getUtcTimeString();
      }
    }
    tick();
    setInterval(tick, 1000);
  }

  // Initialize application
  bindEvents();
  startClock();
  loadData();
})();
