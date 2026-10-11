(() => {
  'use strict';

  const DATA = {
    metrics: [
      { label: 'Events / min', value: '18,420', change: '+8.2%', direction: 'up' },
      { label: 'P95 latency', value: '184 ms', change: '−12 ms', direction: 'down' },
      { label: 'Error rate', value: '0.37%', change: '+0.08 pp', direction: 'up' },
      { label: 'Queue depth', value: '2,841', change: '−19%', direction: 'down' }
    ],
    throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    incidents: [
      { id: 'INC-2841', severity: 'critical', service: 'payments-api', age: '12m', owner: 'M. Chen', status: 'investigating', title: 'Card authorization timeouts' },
      { id: 'INC-2839', severity: 'high', service: 'event-router', age: '31m', owner: 'Unassigned', status: 'open', title: 'EU retry queue growth' },
      { id: 'INC-2837', severity: 'medium', service: 'search-index', age: '1h 08m', owner: 'A. Silva', status: 'monitoring', title: 'Index freshness outside SLO' },
      { id: 'INC-2832', severity: 'low', service: 'webhooks', age: '3h 42m', owner: 'R. Patel', status: 'open', title: 'Elevated partner delivery lag' }
    ]
  };

  let selectedIncidentId = null;
  let currentFilters = { severity: '', status: '', service: '' };

  const incidentDetails = {
    'INC-2841': {
      description: 'Payment authorization requests are timing out at the gateway level. Initial investigation points to a connection pool exhaustion in the payments-api service after the v2.14.3 deploy. Affected regions: US-East, EU-West. Estimated impact: ~2.3k failed transactions/min.',
      created: '2024-01-15 14:20 UTC',
      updated: '2024-01-15 14:30 UTC',
      timeline: [
        { time: '14:20', event: 'Incident created', detail: 'Automated alert: P99 latency > 30s for /authorize' },
        { time: '14:22', event: 'Triage started', detail: 'M. Chen assigned, investigating connection pool metrics' },
        { time: '14:25', event: 'Root cause identified', detail: 'Connection pool maxed at 200, leak in retry logic v2.14.3' },
        { time: '14:28', event: 'Mitigation deployed', detail: 'Hotfix rolled back retry logic, pool recovering' },
        { time: '14:30', event: 'Status update', detail: 'Error rate dropping, monitoring for full recovery' }
      ]
    },
    'INC-2839': {
      description: 'Event router retry queue growing exponentially in EU region. Dead letter queue processing stalled due to schema validation failures on new event types. Backlog: ~47k events and climbing.',
      created: '2024-01-15 14:01 UTC',
      updated: '2024-01-15 14:28 UTC',
      timeline: [
        { time: '14:01', event: 'Incident created', detail: 'Queue depth alert: retry queue > 10k messages' },
        { time: '14:05', event: 'Investigation started', detail: 'Unassigned - on-call paged' },
        { time: '14:15', event: 'Cause identified', detail: 'New event schema v3 not handled by DLQ processor' },
        { time: '14:25', event: 'Fix in progress', detail: 'Schema validation patch deployed to staging' },
        { time: '14:28', event: 'Status update', detail: 'Patch validating, preparing production deploy' }
      ]
    },
    'INC-2837': {
      description: 'Search index freshness SLO breached. Indexer lag at 1h 08m behind real-time. Recent schema migration caused reindex backlog. Customer-facing search returning stale results.',
      created: '2024-01-15 13:24 UTC',
      updated: '2024-01-15 14:25 UTC',
      timeline: [
        { time: '13:24', event: 'Incident created', detail: 'SLO alert: index freshness > 1h' },
        { time: '13:30', event: 'Owner assigned', detail: 'A. Silva acknowledged, analyzing indexer metrics' },
        { time: '13:45', event: 'Root cause', detail: 'Schema migration v4.2 triggered full reindex of 12M docs' },
        { time: '14:10', event: 'Mitigation', detail: 'Parallel indexer workers scaled from 4 to 16' },
        { time: '14:25', event: 'Progress', detail: 'Lag reduced to 42m, ETA recovery 15:10 UTC' }
      ]
    },
    'INC-2832': {
      description: 'Partner webhook delivery latency elevated to 3h 42m average. Downstream partner API rate limiting causing queue backup. Retry logic with exponential backoff extending delivery windows.',
      created: '2024-01-15 10:50 UTC',
      updated: '2024-01-15 14:15 UTC',
      timeline: [
        { time: '10:50', event: 'Incident created', detail: 'Partner delivery lag alert: P50 > 2h' },
        { time: '11:00', event: 'Owner assigned', detail: 'R. Patel acknowledged, contacting partner engineering' },
        { time: '12:30', event: 'Partner response', detail: 'Partner confirms rate limit reduction due to their incident' },
        { time: '13:45', event: 'Workaround', detail: 'Priority queue implemented for critical webhooks' },
        { time: '14:15', event: 'Status update', detail: 'Partner restoring limits, backlog draining slowly' }
      ]
    }
  };

  function init() {
    renderMetrics();
    renderThroughputChart();
    populateServiceFilter();
    renderIncidentsTable();
    setupEventListeners();
    startClock();
  }

  function renderMetrics() {
    const container = document.querySelector('.metrics');
    container.innerHTML = DATA.metrics.map(m => `
      <div class="metric" data-metric="${m.label.toLowerCase().replace(/[^a-z]/g, '-')}">
        <div class="metric-label">${m.label}</div>
        <div class="metric-value">${m.value}</div>
        <div class="metric-trend trend-${m.direction}" aria-label="${m.direction === 'up' ? 'Up' : 'Down'} ${m.change} from previous period">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="${m.direction === 'up' ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
          <span>${m.change}</span>
        </div>
      </div>
    `).join('');
  }

  function renderThroughputChart() {
    const canvas = document.getElementById('throughput-chart');
    const ctx = canvas.getContext('2d');
    const data = DATA.throughput;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 16, right: 16, bottom: 28, left: 56 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const range = maxValue - minValue || 1;

    const yAxis = document.querySelector('.chart-y-axis');
    const xAxis = document.querySelector('.chart-x-axis');

    yAxis.innerHTML = '';
    for (let i = 4; i >= 0; i--) {
      const val = Math.round(minValue + (range * i / 4));
      const span = document.createElement('span');
      span.textContent = val.toLocaleString();
      yAxis.appendChild(span);
    }

    xAxis.innerHTML = '';
    const hourLabels = Array.from({ length: 24 }, (_, i) => {
      const h = (i + 1) % 24;
      return h === 0 ? '00' : String(h).padStart(2, '0');
    });
    hourLabels.forEach((label, i) => {
      const span = document.createElement('span');
      span.textContent = i % 3 === 0 ? label : '';
      span.style.width = `${(chartWidth / 23)}px`;
      span.style.marginLeft = i === 0 ? `${padding.left}px` : '0';
      xAxis.appendChild(span);
    });

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    data.forEach((value, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, ctx.strokeStyle + '40');
    gradient.addColorStop(1, ctx.strokeStyle + '00');

    ctx.fillStyle = gradient;
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.closePath();
    ctx.fill();

    data.forEach((value, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-elevated').trim();
      ctx.fill();
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      ctx.stroke();
    });
  }

  function populateServiceFilter() {
    const select = document.getElementById('service-filter');
    const services = [...new Set(DATA.incidents.map(i => i.service))].sort();
    services.forEach(service => {
      const option = document.createElement('option');
      option.value = service;
      option.textContent = service;
      select.appendChild(option);
    });
  }

  function getFilteredIncidents() {
    return DATA.incidents.filter(incident => {
      if (currentFilters.severity && incident.severity !== currentFilters.severity) return false;
      if (currentFilters.status && incident.status !== currentFilters.status) return false;
      if (currentFilters.service && incident.service !== currentFilters.service) return false;
      return true;
    });
  }

  function renderIncidentsTable() {
    const tbody = document.getElementById('incidents-body');
    const emptyState = document.getElementById('empty-state');
    const incidents = getFilteredIncidents();

    if (incidents.length === 0) {
      tbody.innerHTML = '';
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    tbody.innerHTML = incidents.map(incident => `
      <tr data-id="${incident.id}" ${incident.id === selectedIncidentId ? 'class="selected" aria-selected="true"' : 'aria-selected="false"'} tabindex="0" role="button" aria-label="View details for ${incident.id}: ${incident.title}">
        <td>${incident.id}</td>
        <td><span class="severity-badge severity-${incident.severity}">${incident.severity}</span></td>
        <td>${incident.service}</td>
        <td><span style="font-family: var(--mono)">${incident.age}</span></td>
        <td>${incident.owner}</td>
        <td><span class="status-badge status-${incident.status}">${incident.status}</span></td>
        <td style="color: var(--fg-muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis;">${incident.title}</td>
      </tr>
    `).join('');
  }

  function renderDetailPanel(incidentId) {
    const detailContent = document.getElementById('detail-content');
    const detailLoaded = document.getElementById('detail-loaded');

    if (!incidentId) {
      detailContent.hidden = false;
      detailLoaded.hidden = true;
      return;
    }

    const incident = DATA.incidents.find(i => i.id === incidentId);
    const details = incidentDetails[incidentId];

    if (!incident || !details) return;

    detailContent.hidden = true;
    detailLoaded.hidden = false;

    document.getElementById('detail-id').textContent = incident.id;
    document.getElementById('detail-severity').textContent = incident.severity;
    document.getElementById('detail-severity').className = `severity-badge severity-${incident.severity}`;
    document.getElementById('detail-status').textContent = incident.status;
    document.getElementById('detail-status').className = `status-badge status-${incident.status}`;
    document.getElementById('detail-age').textContent = incident.age;
    document.getElementById('detail-title').textContent = incident.title;
    document.getElementById('detail-service').textContent = incident.service;
    document.getElementById('detail-owner').textContent = incident.owner;
    document.getElementById('detail-created').textContent = details.created;
    document.getElementById('detail-updated').textContent = details.updated;
    document.getElementById('detail-description-text').textContent = details.description;

    const timelineList = document.getElementById('detail-timeline');
    timelineList.innerHTML = details.timeline.map((entry, index) => `
      <li${index === details.timeline.length - 1 ? ' style="border-left-color: var(--accent)"' : ''}>
        <span class="timeline-time">${entry.time}</span>
        <div class="timeline-content">
          <div class="timeline-event">${entry.event}</div>
          <div class="timeline-detail">${entry.detail}</div>
        </div>
      </li>
    `).join('');

    const ackBtn = document.getElementById('acknowledge-btn');
    const isAcknowledged = incident.status === 'acknowledged' || incident.status === 'investigating';
    ackBtn.textContent = isAcknowledged ? 'Acknowledged' : 'Acknowledge';
    ackBtn.disabled = isAcknowledged;
    ackBtn.setAttribute('aria-pressed', isAcknowledged.toString());
  }

  function handleIncidentSelect(incidentId) {
    const prevSelected = document.querySelector('.incidents-table tbody tr.selected');
    if (prevSelected) {
      prevSelected.classList.remove('selected');
      prevSelected.setAttribute('aria-selected', 'false');
    }

    const newSelected = document.querySelector(`.incidents-table tbody tr[data-id="${incidentId}"]`);
    if (newSelected) {
      newSelected.classList.add('selected');
      newSelected.setAttribute('aria-selected', 'true');
      newSelected.scrollIntoView({ block: 'nearest' });
    }

    selectedIncidentId = incidentId;
    renderDetailPanel(incidentId);
  }

  function handleAcknowledge() {
    if (!selectedIncidentId) return;

    const incident = DATA.incidents.find(i => i.id === selectedIncidentId);
    if (!incident || incident.status === 'acknowledged' || incident.status === 'investigating') return;

    incident.status = 'acknowledged';
    incident.owner = 'Current Operator';

    renderIncidentsTable();
    renderDetailPanel(selectedIncidentId);

    const ackBtn = document.getElementById('acknowledge-btn');
    ackBtn.textContent = 'Acknowledged';
    ackBtn.disabled = true;
    ackBtn.setAttribute('aria-pressed', 'true');

    announceToScreenReader(`${incident.id} acknowledged`);
  }

  function announceToScreenReader(message) {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'visually-hidden';
    liveRegion.textContent = message;
    document.body.appendChild(liveRegion);
    setTimeout(() => liveRegion.remove(), 1000);
  }

  function applyFilters() {
    currentFilters = {
      severity: document.getElementById('severity-filter').value,
      status: document.getElementById('status-filter').value,
      service: document.getElementById('service-filter').value
    };

    const hadSelection = selectedIncidentId !== null;
    const selectedStillVisible = hadSelection && getFilteredIncidents().some(i => i.id === selectedIncidentId);

    renderIncidentsTable();

    if (hadSelection && !selectedStillVisible) {
      selectedIncidentId = null;
      renderDetailPanel(null);
    }
  }

  function clearFilters() {
    document.getElementById('severity-filter').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('service-filter').value = '';
    currentFilters = { severity: '', status: '', service: '' };
    renderIncidentsTable();
  }

  function setupEventListeners() {
    document.querySelectorAll('.rail-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rail-item[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'page');
      });
    });

    document.getElementById('severity-filter').addEventListener('change', applyFilters);
    document.getElementById('status-filter').addEventListener('change', applyFilters);
    document.getElementById('service-filter').addEventListener('change', applyFilters);
    document.getElementById('clear-filters').addEventListener('click', clearFilters);

    document.getElementById('incidents-body').addEventListener('click', e => {
      const row = e.target.closest('tr[data-id]');
      if (row) handleIncidentSelect(row.dataset.id);
    });

    document.getElementById('incidents-body').addEventListener('keydown', e => {
      const row = e.target.closest('tr[data-id]');
      if (row && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleIncidentSelect(row.dataset.id);
      }
    });

    document.getElementById('acknowledge-btn').addEventListener('click', handleAcknowledge);

    document.getElementById('throughput-scale').addEventListener('change', renderThroughputChart);

    window.addEventListener('resize', () => {
      renderThroughputChart();
    });

    const hamburger = document.querySelector('.topbar-hamburger');
    const rail = document.querySelector('.rail');
    hamburger.addEventListener('click', () => {
      const expanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', (!expanded).toString());
      rail.classList.toggle('expanded');
    });
  }

  function startClock() {
    const timeEl = document.querySelector('.topbar-time');
    function update() {
      const now = new Date();
      timeEl.textContent = now.toISOString().substr(11, 8) + ' UTC';
    }
    update();
    setInterval(update, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();