(() => {
  'use strict';

  /* =========================================================================
     Seed Data — Directly seeded from DATA.json (zero network requests)
     ========================================================================= */
  const SEED_DATA = {
    metrics: [
      { label: 'Events / min', value: '18,420', change: '+8.2%', direction: 'up' },
      { label: 'P95 latency', value: '184 ms', change: '−12 ms', direction: 'down' },
      { label: 'Error rate', value: '0.37%', change: '+0.08 pp', direction: 'up' },
      { label: 'Queue depth', value: '2,841', change: '−19%', direction: 'down' }
    ],
    throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    incidents: [
      {
        id: 'INC-2841',
        severity: 'critical',
        service: 'payments-api',
        age: '12m',
        owner: 'M. Chen',
        status: 'investigating',
        title: 'Card authorization timeouts'
      },
      {
        id: 'INC-2839',
        severity: 'high',
        service: 'event-router',
        age: '31m',
        owner: 'Unassigned',
        status: 'open',
        title: 'EU retry queue growth'
      },
      {
        id: 'INC-2837',
        severity: 'medium',
        service: 'search-index',
        age: '1h 08m',
        owner: 'A. Silva',
        status: 'monitoring',
        title: 'Index freshness outside SLO'
      },
      {
        id: 'INC-2832',
        severity: 'low',
        service: 'webhooks',
        age: '3h 42m',
        owner: 'R. Patel',
        status: 'open',
        title: 'Elevated partner delivery lag'
      }
    ]
  };

  /* Metric semantic presentation metadata */
  const METRIC_META = {
    'Events / min': {
      tone: 'neutral',
      slo: 'Cap 40k/m',
      context: '1h avg 17,024 · steady'
    },
    'P95 latency': {
      tone: 'good',
      slo: 'SLO <250 ms',
      context: '1h avg 196 ms · in SLO'
    },
    'Error rate': {
      tone: 'warn',
      slo: 'SLO <0.50%',
      context: '1h avg 0.29% · auth spike'
    },
    'Queue depth': {
      tone: 'good',
      slo: 'Limit 10k',
      context: '1h avg 3,507 · draining'
    }
  };

  /* Enriched operational context keyed by incident ID */
  const INCIDENT_CONTEXT = {
    'INC-2841': {
      region: 'us-east-1 / eu-west-1',
      sloImpact: '3.4x error budget burn',
      runbook: 'RB-PAY-014',
      openedUtc: '23:30 UTC',
      summary:
        'Upstream acquirer gateway connections timing out after 4,000 ms on 3.8% of card authorization requests. Circuit breaker partially tripped on shard B; fallback issuer routing is active.',
      timeline: [
        { time: '23:30 UTC', actor: 'Alertmanager', type: 'alert', message: 'Triggered P1 alert: payments-api auth timeout ratio > 2.5% for 3m.' },
        { time: '23:32 UTC', actor: 'Relay Router', type: 'system', message: 'Auto-assigned to M. Chen (Payments primary on-call).' },
        { time: '23:36 UTC', actor: 'M. Chen', type: 'note', message: 'Isolated elevated SYN retransmits to acquirer-edge-02; shifting 40% traffic to secondary pool.' }
      ]
    },
    'INC-2839': {
      region: 'eu-west-1',
      sloImpact: 'Delivery latency +410 ms',
      runbook: 'RB-EVT-009',
      openedUtc: '23:11 UTC',
      summary:
        'Dead-letter retry partition in eu-west-1 grew from 620 to 2,841 pending envelopes following downstream consumer restarts. Consumer lag is flattening but requires an assigned owner.',
      timeline: [
        { time: '23:11 UTC', actor: 'Alertmanager', type: 'alert', message: 'Triggered P2 alert: event-router EU retry queue depth > 2,500.' },
        { time: '23:19 UTC', actor: 'Autoscaler', type: 'system', message: 'Scaled eu-router-worker deployment from 12 to 18 replicas.' }
      ]
    },
    'INC-2837': {
      region: 'us-east-1',
      sloImpact: 'Freshness lag 94 s (SLO 60 s)',
      runbook: 'RB-SRCH-022',
      openedUtc: '22:34 UTC',
      summary:
        'Incremental segment merges on search-index shard 04 delayed document visibility past the 60-second SLO threshold during nightly catalog backfill. Backfill throttled to 35%.',
      timeline: [
        { time: '22:34 UTC', actor: 'Alertmanager', type: 'alert', message: 'Triggered P3 alert: search-index p99 commit lag exceeded 60 s.' },
        { time: '22:45 UTC', actor: 'A. Silva', type: 'note', message: 'Throttled backfill ingestion rate; merge backlog declining by ~8 s/min.' }
      ]
    },
    'INC-2832': {
      region: 'global-edge',
      sloImpact: 'Non-critical partner tier',
      runbook: 'RB-WHK-004',
      openedUtc: '20:00 UTC',
      summary:
        'Webhook dispatcher experiencing elevated p95 delivery duration (14.2 s) for 6 partner endpoints returning HTTP 429 rate-limit responses. Exponential backoff is isolating healthy endpoints.',
      timeline: [
        { time: '20:00 UTC', actor: 'Alertmanager', type: 'alert', message: 'Triggered P4 alert: partner webhook p95 delivery lag > 10 s.' },
        { time: '20:22 UTC', actor: 'R. Patel', type: 'note', message: 'Confirmed isolated 429s from 6 external partner hosts; no internal queue saturation.' }
      ]
    }
  };

  const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  const SEVERITY_LABELS = { critical: 'CRIT', high: 'HIGH', medium: 'MED', low: 'LOW' };
  const STATUS_ORDER = { open: 0, investigating: 1, monitoring: 2, acknowledged: 3 };

  /* =========================================================================
     Application State
     ========================================================================= */
  const state = {
    incidents: SEED_DATA.incidents.map((inc) => {
      const ctx = INCIDENT_CONTEXT[inc.id] || {
        region: 'prod-global',
        sloImpact: 'Under evaluation',
        runbook: 'RB-GEN-001',
        openedUtc: '23:00 UTC',
        summary: inc.title,
        timeline: []
      };
      return {
        ...inc,
        ageMinutes: parseAgeToMinutes(inc.age),
        acknowledged: false,
        acknowledgedAt: null,
        acknowledgedBy: null,
        previousStatus: inc.status,
        region: ctx.region,
        sloImpact: ctx.sloImpact,
        runbook: ctx.runbook,
        openedUtc: ctx.openedUtc,
        summary: ctx.summary,
        timeline: ctx.timeline.map((item) => ({ ...item }))
      };
    }),
    selectedIncidentId: SEED_DATA.incidents[0].id,
    filters: {
      query: '',
      severity: 'all',
      status: 'all',
      service: 'all',
      unackOnly: false
    },
    sort: {
      key: 'severity',
      dir: 'asc'
    },
    throughputMode: 'chart', // 'chart' | 'table'
    selectedHour: 19, // Peak hour (88k) selected initially
    activeNav: 'overview'
  };

  /* =========================================================================
     DOM References
     ========================================================================= */
  const els = {
    navRail: document.getElementById('nav-rail'),
    railBackdrop: document.getElementById('rail-backdrop'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    railCloseBtn: document.getElementById('rail-close-btn'),
    railServicesList: document.getElementById('rail-services-list'),
    railUnackCount: document.getElementById('rail-unack-count'),
    statusScopeLabel: document.getElementById('status-scope-label'),
    systemHealthPill: document.getElementById('system-health-pill'),
    healthText: document.getElementById('health-text'),
    utcClock: document.getElementById('utc-clock'),

    metricsGrid: document.getElementById('metrics-grid'),

    throughputSection: document.getElementById('throughput-section'),
    throughputSvg: document.getElementById('throughput-svg'),
    throughputInspect: document.getElementById('throughput-inspect'),
    throughputStats: document.getElementById('throughput-stats'),
    throughputChartWrap: document.getElementById('throughput-chart-wrap'),
    throughputTableWrap: document.getElementById('throughput-table-wrap'),
    throughputTablesGrid: document.getElementById('throughput-tables-grid'),
    viewChartBtn: document.getElementById('view-chart-btn'),
    viewTableBtn: document.getElementById('view-table-btn'),

    incidentsSection: document.getElementById('incidents-section'),
    incidentCountLabel: document.getElementById('incident-count-label'),
    clearFiltersTopBtn: document.getElementById('clear-filters-top-btn'),
    incidentSearch: document.getElementById('incident-search'),
    severityFilterGroup: document.getElementById('severity-filter-group'),
    statusFilter: document.getElementById('status-filter'),
    serviceFilter: document.getElementById('service-filter'),
    activeFiltersBar: document.getElementById('active-filters-bar'),
    incidentTable: document.getElementById('incident-table'),
    incidentTbody: document.getElementById('incident-tbody'),
    tableEmptyState: document.getElementById('table-empty-state'),
    emptyStateTitle: document.getElementById('empty-state-title'),
    emptyStateDesc: document.getElementById('empty-state-desc'),
    emptyResetBtn: document.getElementById('empty-reset-btn'),

    detailIdSubtitle: document.getElementById('detail-id-subtitle'),
    detailBody: document.getElementById('detail-body'),

    shortcutsOpenBtn: document.getElementById('shortcuts-open-btn'),
    shortcutsModal: document.getElementById('shortcuts-modal'),
    shortcutsCloseBtn: document.getElementById('shortcuts-close-btn'),
    liveAnnouncer: document.getElementById('live-announcer')
  };

  /* =========================================================================
     Utilities
     ========================================================================= */
  function parseAgeToMinutes(ageStr) {
    let total = 0;
    const hMatch = ageStr.match(/(\d+)\s*h/);
    const mMatch = ageStr.match(/(\d+)\s*m/);
    if (hMatch) total += parseInt(hMatch[1], 10) * 60;
    if (mMatch) total += parseInt(mMatch[1], 10);
    return total;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatHour(hourIndex) {
    return `${String(hourIndex).padStart(2, '0')}:00`;
  }

  function getCurrentUtcTime(includeSeconds) {
    const iso = new Date().toISOString();
    return includeSeconds ? iso.slice(11, 19) : `${iso.slice(11, 16)} UTC`;
  }

  function announce(message) {
    els.liveAnnouncer.textContent = '';
    window.requestAnimationFrame(() => {
      els.liveAnnouncer.textContent = message;
    });
  }

  function getUniqueServices() {
    const seen = new Set();
    const list = [];
    for (const inc of state.incidents) {
      if (!seen.has(inc.service)) {
        seen.add(inc.service);
        list.push(inc.service);
      }
    }
    return list;
  }

  function getFilteredAndSortedIncidents() {
    const { query, severity, status, service, unackOnly } = state.filters;
    const q = query.trim().toLowerCase();

    const filtered = state.incidents.filter((inc) => {
      if (severity !== 'all' && inc.severity !== severity) return false;
      if (status !== 'all' && inc.status !== status) return false;
      if (service !== 'all' && inc.service !== service) return false;
      if (unackOnly && inc.acknowledged) return false;
      if (q) {
        const haystack = `${inc.id} ${inc.title} ${inc.service} ${inc.owner} ${inc.severity} ${inc.status}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const { key, dir } = state.sort;
    const factor = dir === 'asc' ? 1 : -1;

    filtered.sort((a, b) => {
      let cmp = 0;
      if (key === 'severity') {
        cmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (cmp === 0) cmp = a.ageMinutes - b.ageMinutes;
      } else if (key === 'age') {
        cmp = a.ageMinutes - b.ageMinutes;
      } else if (key === 'status') {
        cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      } else {
        cmp = String(a[key]).localeCompare(String(b[key]));
      }
      return cmp * factor;
    });

    return filtered;
  }

  function hasActiveFilters() {
    const f = state.filters;
    return Boolean(f.query.trim() || f.severity !== 'all' || f.status !== 'all' || f.service !== 'all' || f.unackOnly);
  }

  /* =========================================================================
     Rendering: Summary Metrics
     ========================================================================= */
  function renderMetrics() {
    els.metricsGrid.innerHTML = SEED_DATA.metrics
      .map((m) => {
        const meta = METRIC_META[m.label] || { tone: 'neutral', slo: '', context: '' };
        const arrow = m.direction === 'up' ? '↑' : '↓';
        const srDir = m.direction === 'up' ? 'up' : 'down';
        return `
          <article class="metric-cell">
            <div class="metric-top">
              <span class="metric-label">${escapeHtml(m.label)}</span>
              ${meta.slo ? `<span class="metric-slo mono">${escapeHtml(meta.slo)}</span>` : ''}
            </div>
            <div class="metric-primary">
              <span class="metric-value">${escapeHtml(m.value)}</span>
              <span class="metric-delta tone-${meta.tone}" aria-label="Trend ${srDir} ${escapeHtml(m.change)}">
                <span aria-hidden="true">${arrow}</span>
                <span>${escapeHtml(m.change)}</span>
              </span>
            </div>
            <div class="metric-context">${escapeHtml(meta.context)}</div>
          </article>
        `;
      })
      .join('');
  }

  /* =========================================================================
     Rendering: 24-Hour Throughput Visualization (Inline SVG + Data Tables)
     ========================================================================= */
  const THROUGHPUT_STATS = (() => {
    const data = SEED_DATA.throughput;
    const sum = data.reduce((acc, v) => acc + v, 0);
    const avg = sum / data.length;
    let maxVal = -Infinity;
    let maxIdx = 0;
    let minVal = Infinity;
    let minIdx = 0;
    data.forEach((v, i) => {
      if (v > maxVal) {
        maxVal = v;
        maxIdx = i;
      }
      if (v < minVal) {
        minVal = v;
        minIdx = i;
      }
    });
    return { avg, maxVal, maxIdx, minVal, minIdx, latestVal: data[data.length - 1] };
  })();

  function renderThroughputStats() {
    const { avg, maxVal, maxIdx, minVal, minIdx } = THROUGHPUT_STATS;
    els.throughputStats.innerHTML = `
      <span>Peak <strong>${maxVal}k</strong> (${formatHour(maxIdx)})</span>
      <span>Avg <strong>${avg.toFixed(1)}k</strong></span>
      <span>Min <strong>${minVal}k</strong> (${formatHour(minIdx)})</span>
    `;
  }

  function updateThroughputInspect() {
    const h = state.selectedHour;
    const val = SEED_DATA.throughput[h];
    const diffPct = Math.round(((val - THROUGHPUT_STATS.avg) / THROUGHPUT_STATS.avg) * 100);
    const diffStr = diffPct >= 0 ? `+${diffPct}%` : `${diffPct}%`;
    const tag =
      h === THROUGHPUT_STATS.maxIdx
        ? ' · Peak'
        : h === THROUGHPUT_STATS.minIdx
        ? ' · Min'
        : h === SEED_DATA.throughput.length - 1
        ? ' · Latest'
        : '';

    els.throughputInspect.innerHTML = `${formatHour(h)} UTC · <strong>${val}k</strong> · ${diffStr} vs avg${tag}`;
  }

  function renderThroughputChart() {
    const data = SEED_DATA.throughput;
    const svgNS = 'http://www.w3.org/2000/svg';
    const measuredW = els.throughputChartWrap ? Math.round(els.throughputChartWrap.clientWidth) : 0;
    const W = Math.max(320, measuredW || 760);
    const isNarrow = W < 520;
    const H = isNarrow ? 142 : 158;
    const pad = isNarrow
      ? { top: 12, right: 44, bottom: 24, left: 28 }
      : { top: 12, right: 54, bottom: 24, left: 34 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;
    const yMax = 100;
    const yTicks = [0, 25, 50, 75, 100];
    const xTicks = isNarrow ? [0, 6, 12, 18, 23] : [0, 4, 8, 12, 16, 20, 23];

    els.throughputSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    // Preserve title and desc
    const titleEl = els.throughputSvg.querySelector('title');
    const descEl = els.throughputSvg.querySelector('desc');
    els.throughputSvg.innerHTML = '';
    if (titleEl) els.throughputSvg.appendChild(titleEl);
    if (descEl) els.throughputSvg.appendChild(descEl);

    const el = (tag, attrs) => {
      const node = document.createElementNS(svgNS, tag);
      for (const [k, v] of Object.entries(attrs)) {
        node.setAttribute(k, String(v));
      }
      return node;
    };

    // Horizontal gridlines & Y labels
    yTicks.forEach((tick) => {
      const y = pad.top + plotH - (tick / yMax) * plotH;
      els.throughputSvg.appendChild(
        el('line', {
          x1: pad.left,
          x2: W - pad.right,
          y1: y.toFixed(1),
          y2: y.toFixed(1),
          class: 'chart-grid-line'
        })
      );
      const txt = el('text', {
        x: pad.left - 6,
        y: (y + 3.5).toFixed(1),
        'text-anchor': 'end',
        class: 'chart-axis-text'
      });
      txt.textContent = String(tick);
      els.throughputSvg.appendChild(txt);
    });

    // 24h average dashed reference line
    const avgY = pad.top + plotH - (THROUGHPUT_STATS.avg / yMax) * plotH;
    els.throughputSvg.appendChild(
      el('line', {
        x1: pad.left,
        x2: W - pad.right,
        y1: avgY.toFixed(1),
        y2: avgY.toFixed(1),
        class: 'chart-avg-line'
      })
    );
    const avgLbl = el('text', {
      x: W - pad.right + 5,
      y: (avgY + 3.5).toFixed(1),
      class: 'chart-avg-label'
    });
    avgLbl.textContent = `AVG ${THROUGHPUT_STATS.avg.toFixed(0)}`;
    els.throughputSvg.appendChild(avgLbl);

    // 24 interactive bar groups with roving tabindex
    const step = plotW / data.length;
    const gap = isNarrow ? Math.max(2, step * 0.24) : Math.max(5, step * 0.24);
    const barW = Math.max(5, step - gap);

    data.forEach((val, i) => {
      const xSlot = pad.left + i * step;
      const xBar = xSlot + (step - barW) / 2;
      const barH = Math.max(2, (val / yMax) * plotH);
      const yBar = pad.top + plotH - barH;
      const isSelected = i === state.selectedHour;

      const diffPct = Math.round(((val - THROUGHPUT_STATS.avg) / THROUGHPUT_STATS.avg) * 100);
      const diffWord = diffPct >= 0 ? `+${diffPct}%` : `${diffPct}%`;
      const g = el('g', {
        class: `chart-bar-group${isSelected ? ' is-selected' : ''}`,
        role: 'button',
        tabindex: isSelected ? '0' : '-1',
        'data-hour': i,
        'aria-label': `${formatHour(i)} UTC: ${val}k events, ${diffWord} vs 24h average${i === THROUGHPUT_STATS.maxIdx ? ', peak hour' : ''}`
      });

      // Invisible full-column hit target
      g.appendChild(
        el('rect', {
          x: xSlot.toFixed(1),
          y: pad.top,
          width: step.toFixed(1),
          height: plotH,
          class: 'chart-bar-hit'
        })
      );

      // Keyboard focus outline rect
      g.appendChild(
        el('rect', {
          x: (xBar - 2).toFixed(1),
          y: pad.top,
          width: (barW + 4).toFixed(1),
          height: plotH,
          rx: 1,
          class: 'chart-bar-focus-ring'
        })
      );

      // Data bar
      g.appendChild(
        el('rect', {
          x: xBar.toFixed(1),
          y: yBar.toFixed(1),
          width: barW.toFixed(1),
          height: barH.toFixed(1),
          class: 'chart-bar-rect'
        })
      );

      // Crisp 2px top cap
      g.appendChild(
        el('rect', {
          x: xBar.toFixed(1),
          y: yBar.toFixed(1),
          width: barW.toFixed(1),
          height: 2,
          class: 'chart-bar-cap'
        })
      );

      g.addEventListener('mouseenter', () => selectThroughputHour(i, false));
      g.addEventListener('click', () => selectThroughputHour(i, true));
      g.addEventListener('focus', () => selectThroughputHour(i, false));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const next = (i + 1) % data.length;
          selectThroughputHour(next, true);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prev = (i - 1 + data.length) % data.length;
          selectThroughputHour(prev, true);
        } else if (e.key === 'Home') {
          e.preventDefault();
          selectThroughputHour(0, true);
        } else if (e.key === 'End') {
          e.preventDefault();
          selectThroughputHour(data.length - 1, true);
        }
      });

      els.throughputSvg.appendChild(g);
    });

    // X-axis hour ticks
    xTicks.forEach((h) => {
      const cx = pad.left + h * step + step / 2;
      const txt = el('text', {
        x: cx.toFixed(1),
        y: H - 7,
        'text-anchor': 'middle',
        class: 'chart-axis-text'
      });
      txt.textContent = formatHour(h);
      els.throughputSvg.appendChild(txt);
    });

    updateThroughputInspect();
  }

  function selectThroughputHour(hourIndex, moveFocus) {
    state.selectedHour = hourIndex;
    const groups = els.throughputSvg.querySelectorAll('.chart-bar-group');
    groups.forEach((g, idx) => {
      const active = idx === hourIndex;
      g.classList.toggle('is-selected', active);
      g.setAttribute('tabindex', active ? '0' : '-1');
      if (active && moveFocus) {
        g.focus();
      }
    });
    updateThroughputInspect();
  }

  function renderThroughputTables() {
    const data = SEED_DATA.throughput;
    const halves = [
      { label: '00:00–11:00 UTC', start: 0, end: 12 },
      { label: '12:00–23:00 UTC', start: 12, end: 24 }
    ];

    els.throughputTablesGrid.innerHTML = halves
      .map((half) => {
        const rows = [];
        for (let i = half.start; i < half.end; i++) {
          const val = data[i];
          const diffPct = Math.round(((val - THROUGHPUT_STATS.avg) / THROUGHPUT_STATS.avg) * 100);
          const diffStr = diffPct >= 0 ? `+${diffPct}%` : `${diffPct}%`;
          const isPeak = i === THROUGHPUT_STATS.maxIdx;
          rows.push(`
            <tr class="${isPeak ? 'is-peak' : ''}">
              <td class="mono">${formatHour(i)}</td>
              <td class="num mono">${val}k${isPeak ? ' ★' : ''}</td>
              <td class="num mono">${diffStr}</td>
            </tr>
          `);
        }
        return `
          <table class="data-table throughput-data-table">
            <caption class="sr-only">Throughput ${half.label}</caption>
            <thead>
              <tr>
                <th scope="col">Hour (UTC)</th>
                <th scope="col" class="num">Volume</th>
                <th scope="col" class="num">vs Avg</th>
              </tr>
            </thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        `;
      })
      .join('');
  }

  /* =========================================================================
     Rendering: Navigation Rail & Top Status Bar
     ========================================================================= */
  function renderRailAndStatusBar() {
    const unackIncidents = state.incidents.filter((i) => !i.acknowledged);
    const unackCount = unackIncidents.length;
    const critUnack = unackIncidents.filter((i) => i.severity === 'critical').length;
    const highUnack = unackIncidents.filter((i) => i.severity === 'high').length;

    // Sidebar badge
    els.railUnackCount.textContent = String(unackCount);
    els.railUnackCount.classList.toggle('is-clear', unackCount === 0);

    // Top status bar health pill
    els.systemHealthPill.classList.remove('is-elevated', 'is-stable');
    if (critUnack > 0) {
      els.healthText.textContent = `Degraded · ${critUnack} CRIT · ${unackCount} unack`;
    } else if (unackCount > 0) {
      els.systemHealthPill.classList.add('is-elevated');
      const lead = highUnack > 0 ? `${highUnack} HIGH · ` : '';
      els.healthText.textContent = `Monitoring · ${lead}${unackCount} unack`;
    } else {
      els.systemHealthPill.classList.add('is-stable');
      els.healthText.textContent = 'All incidents acknowledged';
    }

    // Scope label in top status bar
    if (state.filters.service !== 'all') {
      els.statusScopeLabel.textContent = state.filters.service;
    } else if (state.filters.unackOnly) {
      els.statusScopeLabel.textContent = 'Unacknowledged queue';
    } else {
      els.statusScopeLabel.textContent = 'All services';
    }

    // Nav rail active state
    document.querySelectorAll('.rail-item[data-nav]').forEach((btn) => {
      const isCurrent = btn.dataset.nav === state.activeNav && state.filters.service === 'all';
      btn.classList.toggle('is-active', isCurrent);
      if (isCurrent) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    // Rail services list with live highest unacknowledged severity indicator
    const services = getUniqueServices();
    els.railServicesList.innerHTML = services
      .map((svc) => {
        const svcIncidents = state.incidents.filter((i) => i.service === svc);
        const activeSvc = svcIncidents.filter((i) => !i.acknowledged);
        let dotClass = 'sev-ok';
        if (activeSvc.length > 0) {
          activeSvc.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
          dotClass = `sev-${activeSvc[0].severity}`;
        }
        const isSelected = state.filters.service === svc;
        return `
          <li>
            <button
              type="button"
              class="rail-item${isSelected ? ' is-active' : ''}"
              data-service-nav="${escapeHtml(svc)}"
              aria-pressed="${isSelected ? 'true' : 'false'}"
            >
              <span class="rail-service-dot ${dotClass}" aria-hidden="true"></span>
              <span class="rail-item-label mono">${escapeHtml(svc)}</span>
              <span class="rail-badge mono${activeSvc.length === 0 ? ' is-clear' : ''}">${activeSvc.length}</span>
            </button>
          </li>
        `;
      })
      .join('');
  }

  /* =========================================================================
     Rendering: Filter Bar, Incident Table & Empty States
     ========================================================================= */
  function populateServiceFilterOptions() {
    const services = getUniqueServices();
    const current = state.filters.service;
    els.serviceFilter.innerHTML =
      '<option value="all">Service: All</option>' +
      services.map((s) => `<option value="${escapeHtml(s)}">Service: ${escapeHtml(s)}</option>`).join('');
    els.serviceFilter.value = current;
  }

  function renderSeverityPills() {
    const counts = { all: state.incidents.length, critical: 0, high: 0, medium: 0, low: 0 };
    state.incidents.forEach((inc) => {
      counts[inc.severity] = (counts[inc.severity] || 0) + 1;
    });

    const buttons = els.severityFilterGroup.querySelectorAll('.filter-pill');
    buttons.forEach((btn) => {
      const sev = btn.dataset.severity;
      const isActive = state.filters.severity === sev;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      const label = sev === 'all' ? 'All' : SEVERITY_LABELS[sev];
      btn.innerHTML = `${label} <span class="pill-count">${counts[sev] || 0}</span>`;
    });
  }

  function renderActiveFilterChips() {
    const chips = [];
    const f = state.filters;

    if (f.query.trim()) {
      chips.push({ key: 'query', label: `Search: "${f.query.trim()}"` });
    }
    if (f.severity !== 'all') {
      chips.push({ key: 'severity', label: `Severity: ${SEVERITY_LABELS[f.severity]}` });
    }
    if (f.status !== 'all') {
      chips.push({ key: 'status', label: `Status: ${f.status}` });
    }
    if (f.service !== 'all') {
      chips.push({ key: 'service', label: `Service: ${f.service}` });
    }
    if (f.unackOnly) {
      chips.push({ key: 'unackOnly', label: 'Queue: Unacknowledged only' });
    }

    const active = chips.length > 0;
    els.clearFiltersTopBtn.hidden = !active;
    els.activeFiltersBar.hidden = !active;

    if (!active) {
      els.activeFiltersBar.innerHTML = '';
      return;
    }

    els.activeFiltersBar.innerHTML = chips
      .map(
        (c) => `
          <span class="filter-chip">
            <span>${escapeHtml(c.label)}</span>
            <button
              type="button"
              class="filter-chip-remove"
              data-clear-filter="${c.key}"
              aria-label="Remove filter ${escapeHtml(c.label)}"
            >×</button>
          </span>
        `
      )
      .join('');
  }

  function renderSortHeaders() {
    const ths = els.incidentTable.querySelectorAll('thead th');
    ths.forEach((th) => {
      const btn = th.querySelector('.sort-btn');
      if (!btn) return;
      const isSorted = btn.dataset.sort === state.sort.key;
      const indicator = btn.querySelector('.sort-indicator');
      btn.classList.toggle('is-sorted', isSorted);
      if (isSorted) {
        th.setAttribute('aria-sort', state.sort.dir === 'asc' ? 'ascending' : 'descending');
        indicator.textContent = state.sort.dir === 'asc' ? '↑' : '↓';
      } else {
        th.setAttribute('aria-sort', 'none');
        indicator.textContent = '';
      }
    });
  }

  function renderIncidentTable() {
    const visible = getFilteredAndSortedIncidents();
    const total = state.incidents.length;

    els.incidentCountLabel.textContent =
      visible.length === total ? `${total} of ${total}` : `${visible.length} of ${total} shown`;

    renderSeverityPills();
    renderActiveFilterChips();
    renderSortHeaders();

    // Sync select controls
    els.statusFilter.value = state.filters.status;
    els.serviceFilter.value = state.filters.service;

    if (visible.length === 0) {
      els.incidentTbody.innerHTML = '';
      els.incidentTable.hidden = true;
      els.tableEmptyState.hidden = false;

      if (state.filters.unackOnly && state.incidents.every((i) => i.acknowledged)) {
        els.emptyStateTitle.textContent = 'All active incidents have been acknowledged.';
        els.emptyStateDesc.textContent = 'Switch back to all incidents to inspect acknowledged records or add follow-up notes.';
      } else {
        els.emptyStateTitle.textContent = 'No incidents match the current filters.';
        const activeSummary = [];
        if (state.filters.query.trim()) activeSummary.push(`search "${state.filters.query.trim()}"`);
        if (state.filters.severity !== 'all') activeSummary.push(`severity ${SEVERITY_LABELS[state.filters.severity]}`);
        if (state.filters.status !== 'all') activeSummary.push(`status ${state.filters.status}`);
        if (state.filters.service !== 'all') activeSummary.push(`service ${state.filters.service}`);
        els.emptyStateDesc.textContent = activeSummary.length
          ? `0 of ${total} incidents matched ${activeSummary.join(', ')}.`
          : 'Clear active filters to restore the full queue.';
      }
      renderDetailPanel(visible);
      return;
    }

    els.incidentTable.hidden = false;
    els.tableEmptyState.hidden = true;

    // Ensure selectedIncidentId points to a visible incident (or keep if visible)
    const selectedVisible = visible.some((inc) => inc.id === state.selectedIncidentId);
    if (!selectedVisible) {
      state.selectedIncidentId = visible[0].id;
    }

    els.incidentTbody.innerHTML = visible
      .map((inc) => {
        const isSelected = inc.id === state.selectedIncidentId;
        const sevLabel = SEVERITY_LABELS[inc.severity];
        const unassignedClass = inc.owner === 'Unassigned' ? ' is-unassigned' : '';
        return `
          <tr
            class="incident-row${isSelected ? ' is-selected' : ''}"
            data-incident-id="${escapeHtml(inc.id)}"
            tabindex="0"
            aria-selected="${isSelected ? 'true' : 'false'}"
          >
            <td data-col="severity">
              <span class="sev-badge sev-${escapeHtml(inc.severity)}" aria-label="Severity ${escapeHtml(inc.severity)}">
                <span class="sev-glyph" aria-hidden="true"></span>
                <span>${sevLabel}</span>
              </span>
            </td>
            <td data-col="incident">
              <div class="incident-cell-stack">
                <span class="incident-id">${escapeHtml(inc.id)}</span>
                <span class="incident-title">${escapeHtml(inc.title)}</span>
              </div>
            </td>
            <td data-col="service">
              <span class="service-tag">${escapeHtml(inc.service)}</span>
            </td>
            <td data-col="age" class="num">
              <span class="age-cell">${escapeHtml(inc.age)}</span>
            </td>
            <td data-col="owner">
              <span class="owner-text${unassignedClass}">${escapeHtml(inc.owner)}</span>
            </td>
            <td data-col="status">
              <span class="status-badge status-${escapeHtml(inc.status)}">
                <span class="status-dot" aria-hidden="true"></span>
                <span>${escapeHtml(inc.status)}</span>
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    renderDetailPanel(visible);
  }

  /* =========================================================================
     Rendering: Incident Detail Panel
     ========================================================================= */
  function renderDetailPanel(visibleList) {
    const visible = visibleList || getFilteredAndSortedIncidents();

    if (visible.length === 0) {
      els.detailIdSubtitle.textContent = 'No selection';
      els.detailBody.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-code mono">NO INCIDENT SELECTED</div>
          <p class="empty-state-title">Nothing to inspect in this filtered view.</p>
          <p class="empty-state-desc">Reset filters to view incident telemetry, timeline activity, and acknowledgement controls.</p>
          <div class="empty-state-actions">
            <button type="button" class="btn btn-primary" data-action="reset-filters">Show all incidents</button>
          </div>
        </div>
      `;
      return;
    }

    const inc = state.incidents.find((i) => i.id === state.selectedIncidentId) || visible[0];
    if (!inc) return;

    els.detailIdSubtitle.textContent = inc.id;
    const sevLabel = SEVERITY_LABELS[inc.severity];
    const ackStatusText = inc.acknowledged ? `${inc.acknowledgedBy} · ${inc.acknowledgedAt}` : 'Pending';

    const ackBannerHtml = inc.acknowledged
      ? `
        <div class="ack-banner" role="status">
          <span>Acknowledged by <strong>${escapeHtml(inc.acknowledgedBy)}</strong> at <span class="mono">${escapeHtml(inc.acknowledgedAt)}</span></span>
        </div>
      `
      : '';

    const timelineHtml = inc.timeline
      .map(
        (ev) => `
          <li class="timeline-item${ev.type === 'ack' ? ' is-ack' : ev.type === 'alert' ? ' is-alert' : ''}">
            <div class="timeline-head">
              <span class="mono">${escapeHtml(ev.time)}</span>
              <span class="timeline-actor">${escapeHtml(ev.actor)}</span>
            </div>
            <div class="timeline-msg">${escapeHtml(ev.message)}</div>
          </li>
        `
      )
      .join('');

    els.detailBody.innerHTML = `
      <div class="detail-top-meta">
        <span class="sev-badge sev-${escapeHtml(inc.severity)}">
          <span class="sev-glyph" aria-hidden="true"></span>
          <span>${sevLabel}</span>
        </span>
        <span class="status-badge status-${escapeHtml(inc.status)}">
          <span class="status-dot" aria-hidden="true"></span>
          <span>${escapeHtml(inc.status)}</span>
        </span>
        <span class="detail-id mono">${escapeHtml(inc.id)}</span>
      </div>

      <h3 class="detail-title">${escapeHtml(inc.title)}</h3>
      <p class="detail-summary">${escapeHtml(inc.summary)}</p>

      ${ackBannerHtml}

      <div class="detail-actions">
        ${
          inc.acknowledged
            ? `<button type="button" class="btn btn-acknowledged" disabled aria-disabled="true">Acknowledged</button>
               <button type="button" class="btn" data-action="reopen" data-incident-id="${escapeHtml(inc.id)}">Reopen incident</button>`
            : `<button type="button" class="btn btn-primary" data-action="acknowledge" data-incident-id="${escapeHtml(inc.id)}">Acknowledge incident</button>`
        }
        ${
          inc.owner !== 'On-call (You)'
            ? `<button type="button" class="btn" data-action="assign-me" data-incident-id="${escapeHtml(inc.id)}">Assign to me</button>`
            : ''
        }
      </div>

      <dl class="kv-grid">
        <div class="kv-item">
          <dt class="kv-label">Service</dt>
          <dd class="kv-value mono">${escapeHtml(inc.service)}</dd>
        </div>
        <div class="kv-item">
          <dt class="kv-label">Owner</dt>
          <dd class="kv-value${inc.owner === 'Unassigned' ? ' owner-text is-unassigned' : ''}">${escapeHtml(inc.owner)}</dd>
        </div>
        <div class="kv-item">
          <dt class="kv-label">Age / Opened</dt>
          <dd class="kv-value mono">${escapeHtml(inc.age)} · ${escapeHtml(inc.openedUtc)}</dd>
        </div>
        <div class="kv-item">
          <dt class="kv-label">Acknowledged</dt>
          <dd class="kv-value mono">${escapeHtml(ackStatusText)}</dd>
        </div>
        <div class="kv-item">
          <dt class="kv-label">Region</dt>
          <dd class="kv-value mono">${escapeHtml(inc.region)}</dd>
        </div>
        <div class="kv-item">
          <dt class="kv-label">SLO Impact</dt>
          <dd class="kv-value">${escapeHtml(inc.sloImpact)}</dd>
        </div>
        <div class="kv-item">
          <dt class="kv-label">Runbook</dt>
          <dd class="kv-value mono">${escapeHtml(inc.runbook)}</dd>
        </div>
        <div class="kv-item">
          <dt class="kv-label">Status</dt>
          <dd class="kv-value" style="text-transform:capitalize;">${escapeHtml(inc.status)}</dd>
        </div>
      </dl>

      <div class="detail-subsection">
        <h4 class="subsection-title">Activity timeline</h4>
        <ol class="timeline-list">
          ${timelineHtml}
        </ol>
      </div>

      <form class="note-form" id="operator-note-form" data-incident-id="${escapeHtml(inc.id)}">
        <label for="operator-note-input" class="sr-only">Add operator note to ${escapeHtml(inc.id)}</label>
        <input
          type="text"
          id="operator-note-input"
          class="note-input"
          placeholder="Log operator note to timeline…"
          maxlength="240"
          autocomplete="off"
        >
        <button type="submit" class="btn">Log note</button>
      </form>
    `;
  }

  /* =========================================================================
     State Mutations & Operator Actions
     ========================================================================= */
  function selectIncident(id) {
    if (state.selectedIncidentId === id) return;
    state.selectedIncidentId = id;
    renderIncidentTable();
    const inc = state.incidents.find((i) => i.id === id);
    if (inc) {
      announce(`Selected ${inc.id}: ${inc.title}, severity ${inc.severity}, status ${inc.status}.`);
    }
  }

  function acknowledgeIncident(id) {
    const inc = state.incidents.find((i) => i.id === id);
    if (!inc || inc.acknowledged) return;

    const nowUtc = getCurrentUtcTime(false);
    inc.previousStatus = inc.status;
    inc.acknowledged = true;
    inc.status = 'acknowledged';
    inc.acknowledgedAt = nowUtc;
    inc.acknowledgedBy = 'On-call (You)';

    if (inc.owner === 'Unassigned') {
      inc.owner = 'On-call (You)';
    }

    inc.timeline.unshift({
      time: nowUtc,
      actor: 'On-call (You)',
      type: 'ack',
      message: `Acknowledged ${inc.id}. Status changed from ${inc.previousStatus} to acknowledged.`
    });

    renderRailAndStatusBar();
    renderIncidentTable();
    announce(`Incident ${inc.id} acknowledged at ${nowUtc}.`);
  }

  function reopenIncident(id) {
    const inc = state.incidents.find((i) => i.id === id);
    if (!inc || !inc.acknowledged) return;

    const nowUtc = getCurrentUtcTime(false);
    inc.acknowledged = false;
    inc.status = inc.previousStatus || 'open';
    inc.acknowledgedAt = null;
    inc.acknowledgedBy = null;

    inc.timeline.unshift({
      time: nowUtc,
      actor: 'On-call (You)',
      type: 'system',
      message: `Reopened ${inc.id}. Status restored to ${inc.status}.`
    });

    renderRailAndStatusBar();
    renderIncidentTable();
    announce(`Incident ${inc.id} reopened with status ${inc.status}.`);
  }

  function assignIncidentToMe(id) {
    const inc = state.incidents.find((i) => i.id === id);
    if (!inc || inc.owner === 'On-call (You)') return;

    const prevOwner = inc.owner;
    const nowUtc = getCurrentUtcTime(false);
    inc.owner = 'On-call (You)';
    inc.timeline.unshift({
      time: nowUtc,
      actor: 'On-call (You)',
      type: 'note',
      message: `Reassigned owner from ${prevOwner} to On-call (You).`
    });

    renderIncidentTable();
    announce(`Assigned ${inc.id} to On-call (You).`);
  }

  function addOperatorNote(id, message) {
    const trimmed = message.trim();
    if (!trimmed) return;
    const inc = state.incidents.find((i) => i.id === id);
    if (!inc) return;

    const nowUtc = getCurrentUtcTime(false);
    inc.timeline.unshift({
      time: nowUtc,
      actor: 'On-call (You)',
      type: 'note',
      message: trimmed
    });

    renderDetailPanel();
    announce(`Logged operator note on ${inc.id}.`);
  }

  function resetAllFilters() {
    state.filters = {
      query: '',
      severity: 'all',
      status: 'all',
      service: 'all',
      unackOnly: false
    };
    state.activeNav = 'overview';
    els.incidentSearch.value = '';
    renderRailAndStatusBar();
    renderIncidentTable();
    announce('All incident filters cleared.');
  }

  /* =========================================================================
     Mobile Navigation Drawer & Shortcuts Modal
     ========================================================================= */
  function openMobileDrawer() {
    els.navRail.classList.add('is-open');
    els.railBackdrop.hidden = false;
    els.mobileMenuBtn.setAttribute('aria-expanded', 'true');
    els.railCloseBtn.focus();
  }

  function closeMobileDrawer(restoreFocus) {
    els.navRail.classList.remove('is-open');
    els.railBackdrop.hidden = true;
    els.mobileMenuBtn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      els.mobileMenuBtn.focus();
    }
  }

  function openShortcutsModal() {
    els.shortcutsModal.hidden = false;
    els.shortcutsCloseBtn.focus();
  }

  function closeShortcutsModal() {
    if (els.shortcutsModal.hidden) return;
    els.shortcutsModal.hidden = true;
    els.shortcutsOpenBtn.focus();
  }

  /* =========================================================================
     Event Binding
     ========================================================================= */
  function bindEvents() {
    // Mobile drawer
    els.mobileMenuBtn.addEventListener('click', openMobileDrawer);
    els.railCloseBtn.addEventListener('click', () => closeMobileDrawer(true));
    els.railBackdrop.addEventListener('click', () => closeMobileDrawer(true));

    // Shortcuts modal
    els.shortcutsOpenBtn.addEventListener('click', () => {
      closeMobileDrawer(false);
      openShortcutsModal();
    });
    els.shortcutsCloseBtn.addEventListener('click', closeShortcutsModal);
    els.shortcutsModal.addEventListener('click', (e) => {
      if (e.target === els.shortcutsModal) closeShortcutsModal();
    });

    // Rail primary nav
    document.querySelectorAll('.rail-item[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        state.activeNav = target;
        state.filters.service = 'all';

        if (target === 'overview') {
          state.filters.unackOnly = false;
          renderRailAndStatusBar();
          renderIncidentTable();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (target === 'incidents') {
          state.filters.unackOnly = true;
          renderRailAndStatusBar();
          renderIncidentTable();
          els.incidentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (target === 'throughput') {
          state.filters.unackOnly = false;
          renderRailAndStatusBar();
          renderIncidentTable();
          els.throughputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        closeMobileDrawer(false);
      });
    });

    // Rail service filter shortcuts
    els.railServicesList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-service-nav]');
      if (!btn) return;
      const svc = btn.dataset.serviceNav;
      state.filters.service = state.filters.service === svc ? 'all' : svc;
      state.filters.unackOnly = false;
      state.activeNav = 'overview';
      renderRailAndStatusBar();
      renderIncidentTable();
      els.incidentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      closeMobileDrawer(false);
      announce(state.filters.service === 'all' ? 'Cleared service filter.' : `Filtered incidents by ${svc}.`);
    });

    // Throughput view toggle (Chart / Data)
    els.viewChartBtn.addEventListener('click', () => {
      state.throughputMode = 'chart';
      els.viewChartBtn.classList.add('is-active');
      els.viewChartBtn.setAttribute('aria-pressed', 'true');
      els.viewTableBtn.classList.remove('is-active');
      els.viewTableBtn.setAttribute('aria-pressed', 'false');
      els.throughputChartWrap.hidden = false;
      els.throughputTableWrap.hidden = true;
      renderThroughputChart();
    });

    els.viewTableBtn.addEventListener('click', () => {
      state.throughputMode = 'table';
      els.viewTableBtn.classList.add('is-active');
      els.viewTableBtn.setAttribute('aria-pressed', 'true');
      els.viewChartBtn.classList.remove('is-active');
      els.viewChartBtn.setAttribute('aria-pressed', 'false');
      els.throughputChartWrap.hidden = true;
      els.throughputTableWrap.hidden = false;
    });

    // Search filter
    els.incidentSearch.addEventListener('input', (e) => {
      state.filters.query = e.target.value;
      renderIncidentTable();
    });

    // Severity pills
    els.severityFilterGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      state.filters.severity = btn.dataset.severity;
      renderIncidentTable();
      announce(`Filtered severity: ${state.filters.severity}.`);
    });

    // Status & service selects
    els.statusFilter.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      if (e.target.value === 'acknowledged') {
        state.filters.unackOnly = false;
      }
      renderRailAndStatusBar();
      renderIncidentTable();
    });

    els.serviceFilter.addEventListener('change', (e) => {
      state.filters.service = e.target.value;
      renderRailAndStatusBar();
      renderIncidentTable();
    });

    // Active filter chip removal
    els.activeFiltersBar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-clear-filter]');
      if (!btn) return;
      const key = btn.dataset.clearFilter;
      if (key === 'query') {
        state.filters.query = '';
        els.incidentSearch.value = '';
      } else if (key === 'unackOnly') {
        state.filters.unackOnly = false;
        state.activeNav = 'overview';
      } else {
        state.filters[key] = 'all';
      }
      renderRailAndStatusBar();
      renderIncidentTable();
    });

    // Reset filter buttons
    els.clearFiltersTopBtn.addEventListener('click', resetAllFilters);
    els.emptyResetBtn.addEventListener('click', resetAllFilters);

    // Table sorting
    els.incidentTable.querySelector('thead').addEventListener('click', (e) => {
      const btn = e.target.closest('.sort-btn');
      if (!btn) return;
      const key = btn.dataset.sort;
      if (state.sort.key === key) {
        state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.key = key;
        state.sort.dir = 'asc';
      }
      renderIncidentTable();
    });

    // Table row selection (click & keyboard)
    els.incidentTbody.addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-incident-id]');
      if (!row) return;
      selectIncident(row.dataset.incidentId);
    });

    els.incidentTbody.addEventListener('keydown', (e) => {
      const row = e.target.closest('tr[data-incident-id]');
      if (!row) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectIncident(row.dataset.incidentId);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const rows = Array.from(els.incidentTbody.querySelectorAll('tr[data-incident-id]'));
        const idx = rows.indexOf(row);
        const nextIdx = e.key === 'ArrowDown' ? Math.min(rows.length - 1, idx + 1) : Math.max(0, idx - 1);
        const targetRow = rows[nextIdx];
        if (targetRow) {
          selectIncident(targetRow.dataset.incidentId);
          const refreshedRow = els.incidentTbody.querySelector(`tr[data-incident-id="${targetRow.dataset.incidentId}"]`);
          if (refreshedRow) refreshedRow.focus();
        }
      }
    });

    // Detail panel actions (delegated)
    els.detailBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.incidentId;

      if (action === 'acknowledge' && id) {
        acknowledgeIncident(id);
      } else if (action === 'reopen' && id) {
        reopenIncident(id);
      } else if (action === 'assign-me' && id) {
        assignIncidentToMe(id);
      } else if (action === 'reset-filters') {
        resetAllFilters();
      }
    });

    // Operator note submit (delegated)
    els.detailBody.addEventListener('submit', (e) => {
      const form = e.target.closest('#operator-note-form');
      if (!form) return;
      e.preventDefault();
      const input = form.querySelector('#operator-note-input');
      if (!input) return;
      addOperatorNote(form.dataset.incidentId, input.value);
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Escape') {
        if (!els.shortcutsModal.hidden) {
          closeShortcutsModal();
          return;
        }
        if (els.navRail.classList.contains('is-open')) {
          closeMobileDrawer(true);
          return;
        }
        if (document.activeElement === els.incidentSearch) {
          if (els.incidentSearch.value) {
            state.filters.query = '';
            els.incidentSearch.value = '';
            renderIncidentTable();
          } else {
            els.incidentSearch.blur();
          }
        }
        return;
      }

      if (isEditing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '/') {
        e.preventDefault();
        els.incidentSearch.focus();
        els.incidentSearch.select();
      } else if (e.key === '?') {
        e.preventDefault();
        if (els.shortcutsModal.hidden) openShortcutsModal();
        else closeShortcutsModal();
      } else if (e.key === 'j' || e.key === 'k') {
        const visible = getFilteredAndSortedIncidents();
        if (visible.length === 0) return;
        const idx = visible.findIndex((i) => i.id === state.selectedIncidentId);
        const nextIdx =
          e.key === 'j'
            ? Math.min(visible.length - 1, idx + 1)
            : Math.max(0, idx - 1);
        selectIncident(visible[nextIdx].id);
      } else if (e.key === 'a') {
        const visible = getFilteredAndSortedIncidents();
        if (visible.some((i) => i.id === state.selectedIncidentId)) {
          acknowledgeIncident(state.selectedIncidentId);
        }
      }
    });
    // Re-render SVG at native container width on resize for crisp typography
    let resizeTimer = null;
    let lastChartWidth = els.throughputChartWrap ? Math.round(els.throughputChartWrap.clientWidth) : 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (state.throughputMode !== 'chart') return;
        const nextW = Math.round(els.throughputChartWrap.clientWidth);
        if (nextW > 0 && Math.abs(nextW - lastChartWidth) >= 12) {
          lastChartWidth = nextW;
          renderThroughputChart();
        }
      }, 120);
    });
  }

  /* =========================================================================
     UTC Clock & Initialization
     ========================================================================= */
  function startUtcClock() {
    const tick = () => {
      els.utcClock.textContent = getCurrentUtcTime(true);
    };
    tick();
    window.setInterval(tick, 1000);
  }

  function init() {
    renderMetrics();
    renderThroughputStats();
    renderThroughputChart();
    renderThroughputTables();
    populateServiceFilterOptions();
    renderRailAndStatusBar();
    renderIncidentTable();
    bindEvents();
    startUtcClock();
  }

  init();
})();
