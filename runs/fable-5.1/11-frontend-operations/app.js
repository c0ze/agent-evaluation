/* Relay — operations control room. Plain JS, no dependencies. */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
  const SEV_LABEL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
  const STATUS_LABEL = {
    open: 'Open',
    investigating: 'Investigating',
    monitoring: 'Monitoring',
    acknowledged: 'Acknowledged',
    resolved: 'Resolved'
  };
  const STATUS_RANK = { open: 0, investigating: 1, acknowledged: 2, monitoring: 3, resolved: 4 };

  // Which direction is favourable for each seeded metric, and the comparison window.
  const METRIC_META = {
    'Events / min': { goodWhen: 'up', window: 'vs. prior hour' },
    'P95 latency': { goodWhen: 'down', window: 'vs. prior hour' },
    'Error rate': { goodWhen: 'down', window: 'vs. prior hour' },
    'Queue depth': { goodWhen: 'down', window: 'vs. prior hour' }
  };

  const OPERATOR = 'You';
  const CAPACITY_PCT = 85;       // reference line on the throughput chart
  const TOAST_MS = 8000;
  const AGE_TICK_MS = 30000;
  const THEMES = ['auto', 'light', 'dark'];
  const THEME_KEY = 'relay-theme';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const state = {
    metrics: [],
    throughput: [],
    incidents: [],
    filters: { q: '', severity: 'all', status: 'all' },
    sort: { key: 'severity', dir: 'asc' },
    selectedId: null,
    focusRowId: null,
    visibleIds: [],
    chart: { activeIndex: null, keyboard: false, layout: null }
  };

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const el = {
    sysStatus: $('#sys-status'),
    sysStatusText: $('#sys-status-text'),
    sysStatusShort: $('#sys-status-short'),
    clock: $('#clock'),
    themeToggle: $('#theme-toggle'),
    railBadge: $('#rail-incident-count'),
    metrics: $('#metrics'),
    chart: $('#chart'),
    chartWrap: $('.chart-wrap'),
    chartTip: $('#chart-tip'),
    chartStats: $('#chart-stats'),
    chartTableBody: $('#chart-table tbody'),
    incSummary: $('#inc-summary'),
    search: $('#f-search'),
    severity: $('#f-severity'),
    status: $('#f-status'),
    clear: $('#f-clear'),
    table: $('#inc-table'),
    tbody: $('#inc-body'),
    empty: $('#inc-empty'),
    emptyTitle: $('#inc-empty-title'),
    emptyText: $('#inc-empty-text'),
    emptyClear: $('#inc-empty-clear'),
    backdrop: $('#backdrop'),
    detail: $('#detail'),
    detailEmpty: $('#detail-empty'),
    detailBody: $('#detail-body'),
    detailClose: $('#detail-close'),
    detailTitle: $('#detail-h'),
    detailNote: $('#detail-note'),
    dSev: $('#d-sev'),
    dId: $('#d-id'),
    dService: $('#d-service'),
    dStatus: $('#d-status'),
    dOpened: $('#d-opened'),
    dAge: $('#d-age'),
    dOwner: $('#d-owner'),
    dAck: $('#d-ack'),
    ackBtn: $('#ack-btn'),
    copyBtn: $('#copy-btn'),
    timeline: $('#timeline'),
    toasts: $('#toasts'),
    announcer: $('#announcer'),
    loadError: $('#load-error'),
    main: $('#main')
  };

  const sheetMQ = window.matchMedia('(max-width: 719px)');
  const isSheet = () => sheetMQ.matches;

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children) {
      for (const c of [].concat(children)) {
        if (c === null || c === undefined || c === false) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k of Object.keys(attrs)) node.setAttribute(k, attrs[k]);
    return node;
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtClock = (d) => pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
  const fmtHour = (hour) => pad2(hour) + ':00';

  function parseAge(str) {
    const d = /(\d+)\s*d/.exec(str);
    const hh = /(\d+)\s*h/.exec(str);
    const m = /(\d+)\s*m/.exec(str);
    return (d ? +d[1] * 1440 : 0) + (hh ? +hh[1] * 60 : 0) + (m ? +m[1] : 0);
  }

  function formatAge(openedAt, now) {
    const mins = Math.max(0, Math.round(((now || Date.now()) - openedAt.getTime()) / 60000));
    if (mins < 60) return mins + 'm';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ' + pad2(mins % 60) + 'm';
    return Math.floor(hours / 24) + 'd ' + (hours % 24) + 'h';
  }

  function announce(text) {
    el.announcer.textContent = '';
    // Re-set on the next frame so identical messages are re-announced.
    requestAnimationFrame(() => { el.announcer.textContent = text; });
  }

  const byId = (id) => state.incidents.find((i) => i.id === id) || null;
  const activeIncidents = () => state.incidents.filter((i) => i.status !== 'resolved');

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  async function loadData() {
    // fetch() cannot read file:// URLs, so when the page is opened straight from
    // disk we go directly to the inline copy of DATA.json embedded in index.html.
    if (window.location.protocol !== 'file:') {
      try {
        const res = await fetch('DATA.json', { cache: 'no-store' });
        if (res.ok) return await res.json();
      } catch (err) {
        // Offline or blocked: fall through to the inline seed.
      }
    }
    const seed = document.getElementById('seed-data');
    if (!seed) throw new Error('No data source');
    return JSON.parse(seed.textContent);
  }

  function normalize(raw) {
    const now = Date.now();
    state.metrics = Array.isArray(raw.metrics) ? raw.metrics : [];
    state.throughput = Array.isArray(raw.throughput) ? raw.throughput.map(Number) : [];
    state.incidents = (Array.isArray(raw.incidents) ? raw.incidents : []).map((i) => {
      const openedAt = new Date(now - parseAge(i.age) * 60000);
      const inc = Object.assign({}, i, { openedAt, ack: null, timeline: [] });
      inc.timeline.push({ at: openedAt, text: 'Detected on ' + inc.service });
      if (inc.owner && inc.owner !== 'Unassigned') inc.timeline.push({ at: openedAt, text: 'Routed to ' + inc.owner });
      if (inc.status !== 'open') inc.timeline.push({ at: openedAt, text: 'Status set to ' + (STATUS_LABEL[inc.status] || inc.status) });
      return inc;
    });
  }

  // ---------------------------------------------------------------------------
  // Top bar: system status, clock, theme
  // ---------------------------------------------------------------------------

  function renderSysStatus() {
    const active = activeIncidents();
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    active.forEach((i) => { counts[i.severity] = (counts[i.severity] || 0) + 1; });

    let tone = 'ok';
    let label = 'Operational';
    if (counts.critical) { tone = 'critical'; label = 'Degraded'; }
    else if (counts.high) { tone = 'high'; label = 'Impaired'; }
    else if (counts.medium) { tone = 'medium'; label = 'Watch'; }

    const parts = [];
    if (counts.critical) parts.push(counts.critical + ' critical');
    if (counts.high) parts.push(counts.high + ' high');
    if (!parts.length && active.length) parts.push(active.length + ' active');

    el.sysStatus.dataset.tone = tone;
    el.sysStatusText.textContent = label + (parts.length ? ' · ' + parts.join(', ') : '');
    el.sysStatusShort.textContent = label + (parts.length ? ' · ' + parts[0] : '');
    el.sysStatus.title = el.sysStatusText.textContent;
    el.railBadge.textContent = active.length ? String(active.length) : '';
    el.railBadge.setAttribute('aria-label', active.length + ' active incidents');
  }

  function tickClock() {
    const d = new Date();
    el.clock.setAttribute('datetime', d.toISOString());
    el.clock.textContent = '';
    el.clock.appendChild(document.createTextNode(fmtClock(d)));
    el.clock.appendChild(h('span', { class: 'clock-sec', text: ':' + pad2(d.getUTCSeconds()) }));
    el.clock.appendChild(document.createTextNode(' UTC'));
  }

  function readTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (err) { return 'auto'; }
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme; else root.dataset.theme = theme;
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    el.themeToggle.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
    el.themeToggle.setAttribute('aria-label', 'Theme: ' + theme + '. Switch to ' + next);
    el.themeToggle.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch (err) { /* private mode etc. */ }
  }

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  function renderMetrics() {
    el.metrics.textContent = '';
    state.metrics.forEach((m) => {
      const meta = METRIC_META[m.label] || { goodWhen: 'up', window: 'vs. prior hour' };
      const tone = m.direction === meta.goodWhen ? 'good' : 'bad';
      const arrow = m.direction === 'up' ? '↑' : '↓';
      el.metrics.appendChild(
        h('li', { class: 'metric', dataset: { tone } }, [
          h('span', { class: 'metric-label', text: m.label }),
          h('span', { class: 'metric-value', text: m.value }),
          h('span', { class: 'metric-trend' }, [
            h('span', { class: 'metric-delta' }, [
              h('span', { class: 'metric-arrow', 'aria-hidden': 'true', text: arrow }),
              m.change
            ]),
            h('span', { class: 'metric-window', text: meta.window }),
            h('span', { class: 'visually-hidden', text: tone === 'good' ? ', favourable' : ', unfavourable' })
          ])
        ])
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Throughput chart (inline SVG)
  // ---------------------------------------------------------------------------

  function chartHours() {
    const n = state.throughput.length;
    const endHour = new Date().getUTCHours();
    return state.throughput.map((_, i) => (endHour - (n - 1 - i) + 24 * 10) % 24);
  }

  function chartSummary() {
    const s = state.throughput;
    if (!s.length) return null;
    let peak = 0, low = 0;
    s.forEach((v, i) => { if (v > s[peak]) peak = i; if (v < s[low]) low = i; });
    const mean = Math.round(s.reduce((a, b) => a + b, 0) / s.length);
    return { peak, low, mean, now: s.length - 1, hours: chartHours() };
  }

  function renderChartStats() {
    const sum = chartSummary();
    el.chartStats.textContent = '';
    if (!sum) return;
    const s = state.throughput;
    const item = (label, value, when) => h('div', null, [
      h('dt', { text: label }),
      h('dd', null, [value + '%', when ? h('span', { class: 'muted', text: fmtHour(when) }) : null])
    ]);
    el.chartStats.appendChild(item('Now', s[sum.now], sum.hours[sum.now]));
    el.chartStats.appendChild(item('Peak', s[sum.peak], sum.hours[sum.peak]));
    el.chartStats.appendChild(item('Low', s[sum.low], sum.hours[sum.low]));
    el.chartStats.appendChild(item('Mean', sum.mean, null));
  }

  function renderChartTable() {
    const sum = chartSummary();
    el.chartTableBody.textContent = '';
    if (!sum) return;
    state.throughput.forEach((v, i) => {
      el.chartTableBody.appendChild(
        h('tr', { class: i === sum.now ? 'is-now' : null }, [
          h('td', { text: fmtHour(sum.hours[i]) + (i === sum.now ? ' (now)' : '') }),
          h('td', { class: 'ta-right', text: v + '%' })
        ])
      );
    });
  }

  function renderChart() {
    const series = state.throughput;
    const sum = chartSummary();
    el.chart.textContent = '';
    if (!sum) return;

    const n = series.length;
    const width = Math.max(280, Math.floor(el.chart.clientWidth || 640));
    const height = 190;
    const pad = { top: 18, right: 18, bottom: 24, left: 32 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const yMax = 100;
    const slot = innerW / n;
    const barW = Math.min(24, Math.max(3, slot - 2));       // 2px surface gap, <= 24px thick
    const radius = Math.min(4, barW / 2);
    const baseline = pad.top + innerH;
    const xOf = (i) => pad.left + i * slot + (slot - barW) / 2;
    const yOf = (v) => pad.top + innerH - (v / yMax) * innerH;
    const fmt = (v) => (Math.round(v * 100) / 100).toString();

    state.chart.layout = { width, height, pad, slot, barW, xOf, yOf, baseline, n };

    const svg = svgEl('svg', {
      viewBox: '0 0 ' + width + ' ' + height,
      width, height,
      role: 'img',
      tabindex: '0',
      'aria-label': 'Throughput over the last 24 hours as percent of provisioned capacity. ' +
        'Peak ' + series[sum.peak] + '% at ' + fmtHour(sum.hours[sum.peak]) +
        ', low ' + series[sum.low] + '% at ' + fmtHour(sum.hours[sum.low]) +
        ', mean ' + sum.mean + '%, now ' + series[sum.now] + '%. ' +
        'Use the left and right arrow keys to read each hour.'
    });

    // Gridlines (solid hairlines) + y labels
    [0, 25, 50, 75, 100].forEach((v) => {
      const y = fmt(yOf(v)) ;
      svg.appendChild(svgEl('line', {
        class: v === 0 ? 'chart-axis' : 'chart-grid',
        x1: pad.left, x2: width - pad.right, y1: y, y2: y
      }));
      const t = svgEl('text', { class: 'chart-label', x: pad.left - 6, y: fmt(yOf(v) + 3.5), 'text-anchor': 'end' });
      t.textContent = String(v);
      svg.appendChild(t);
    });

    // Capacity reference line
    const capY = fmt(yOf(CAPACITY_PCT));
    svg.appendChild(svgEl('line', { class: 'chart-cap', x1: pad.left, x2: width - pad.right, y1: capY, y2: capY }));
    const capLabel = svgEl('text', { class: 'chart-cap-label', x: pad.left + 4, y: fmt(yOf(CAPACITY_PCT) - 4) });
    capLabel.textContent = 'capacity ' + CAPACITY_PCT + '%';
    svg.appendChild(capLabel);

    // Bars: rounded data-end, square baseline; full-slot transparent hit target
    series.forEach((v, i) => {
      const x = xOf(i);
      const y = yOf(v);
      const r = Math.min(radius, baseline - y);
      const g = svgEl('g', { class: 'bar' + (i === sum.now ? ' is-now' : ''), 'data-index': i });
      g.appendChild(svgEl('rect', {
        class: 'hit', x: fmt(pad.left + i * slot), y: pad.top, width: fmt(slot), height: innerH
      }));
      const d = 'M' + fmt(x) + ',' + fmt(baseline) +
        ' V' + fmt(y + r) +
        ' Q' + fmt(x) + ',' + fmt(y) + ' ' + fmt(x + r) + ',' + fmt(y) +
        ' H' + fmt(x + barW - r) +
        ' Q' + fmt(x + barW) + ',' + fmt(y) + ' ' + fmt(x + barW) + ',' + fmt(y + r) +
        ' V' + fmt(baseline) + ' Z';
      g.appendChild(svgEl('path', { class: 'mark', d }));
      svg.appendChild(g);
    });

    // Direct label: the extreme only
    const peakLabel = svgEl('text', {
      class: 'chart-peak-label',
      x: fmt(xOf(sum.peak) + barW / 2),
      y: fmt(yOf(series[sum.peak]) - 5),
      'text-anchor': 'middle'
    });
    peakLabel.textContent = series[sum.peak] + '%';
    svg.appendChild(peakLabel);

    // X labels every 4 hours, counting back from now
    for (let i = n - 1; i >= 0; i -= 4) {
      const t = svgEl('text', {
        class: 'chart-label',
        x: fmt(xOf(i) + barW / 2),
        y: height - 7,
        'text-anchor': 'middle'
      });
      t.textContent = fmtHour(sum.hours[i]);
      svg.appendChild(t);
    }

    svg.addEventListener('pointermove', onChartPointer);
    svg.addEventListener('pointerleave', () => { if (!state.chart.keyboard) setChartActive(null); });
    svg.addEventListener('focus', () => { state.chart.keyboard = true; setChartActive(state.chart.activeIndex === null ? n - 1 : state.chart.activeIndex); });
    svg.addEventListener('blur', () => { state.chart.keyboard = false; setChartActive(null); });
    svg.addEventListener('keydown', onChartKey);
    el.chart.appendChild(svg);

    if (state.chart.activeIndex !== null && state.chart.keyboard) setChartActive(state.chart.activeIndex);
  }

  function onChartPointer(e) {
    const L = state.chart.layout;
    if (!L) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (L.width / rect.width);
    const i = Math.floor((px - L.pad.left) / L.slot);
    if (i < 0 || i >= L.n) { if (!state.chart.keyboard) setChartActive(null); return; }
    state.chart.keyboard = false;
    setChartActive(i);
  }

  function onChartKey(e) {
    const L = state.chart.layout;
    if (!L) return;
    let i = state.chart.activeIndex === null ? L.n - 1 : state.chart.activeIndex;
    switch (e.key) {
      case 'ArrowLeft': case 'ArrowDown': i = Math.max(0, i - 1); break;
      case 'ArrowRight': case 'ArrowUp': i = Math.min(L.n - 1, i + 1); break;
      case 'Home': i = 0; break;
      case 'End': i = L.n - 1; break;
      case 'Escape': setChartActive(null); return;
      default: return;
    }
    e.preventDefault();
    state.chart.keyboard = true;
    setChartActive(i);
  }

  function setChartActive(index) {
    const L = state.chart.layout;
    state.chart.activeIndex = index;
    $$('.bar', el.chart).forEach((g) => g.classList.toggle('is-hot', Number(g.dataset.index) === index));
    if (index === null || !L) { el.chartTip.hidden = true; return; }

    const hours = chartHours();
    const v = state.throughput[index];
    el.chartTip.textContent = '';
    el.chartTip.appendChild(h('strong', { text: v + '%' }));
    el.chartTip.appendChild(h('span', { text: fmtHour(hours[index]) + (index === L.n - 1 ? ' · now' : '') + ' UTC' }));
    el.chartTip.hidden = false;

    const svg = $('svg', el.chart);
    const wrapRect = el.chartWrap.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const scale = svgRect.width / L.width;
    const cx = svgRect.left - wrapRect.left + (L.xOf(index) + L.barW / 2) * scale;
    const cy = svgRect.top - wrapRect.top + L.yOf(v) * scale;
    // keep the tip inside the panel horizontally
    const tipW = el.chartTip.offsetWidth;
    const clampedX = Math.min(Math.max(cx, tipW / 2 + 4), wrapRect.width - tipW / 2 - 4);
    el.chartTip.style.left = clampedX + 'px';
    el.chartTip.style.top = cy + 'px';
  }

  // ---------------------------------------------------------------------------
  // Incident table
  // ---------------------------------------------------------------------------

  const SORTERS = {
    severity: (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.openedAt - b.openedAt,
    incident: (a, b) => a.id.localeCompare(b.id),
    service: (a, b) => a.service.localeCompare(b.service),
    age: (a, b) => b.openedAt - a.openedAt,          // ascending age = newest first
    owner: (a, b) => a.owner.localeCompare(b.owner),
    status: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]
  };

  function filtersActive() {
    const f = state.filters;
    return f.q.trim() !== '' || f.severity !== 'all' || f.status !== 'all';
  }

  function visibleIncidents() {
    const f = state.filters;
    const q = f.q.trim().toLowerCase();
    const rows = state.incidents.filter((i) =>
      (f.severity === 'all' || i.severity === f.severity) &&
      (f.status === 'all' || i.status === f.status) &&
      (!q || [i.id, i.title, i.service, i.owner].some((s) => String(s).toLowerCase().includes(q)))
    );
    const cmp = SORTERS[state.sort.key] || SORTERS.severity;
    rows.sort((a, b) => (state.sort.dir === 'asc' ? 1 : -1) * cmp(a, b));
    return rows;
  }

  function statusChip(inc) {
    const chip = h('span', { class: 'status', dataset: { status: inc.status } }, [
      h('span', { class: 'status-dot', 'aria-hidden': 'true' }),
      STATUS_LABEL[inc.status] || inc.status
    ]);
    // The ack mark is only needed when the status itself does not already say so.
    if (!inc.ack || inc.status === 'acknowledged') return chip;
    const frag = document.createDocumentFragment();
    frag.appendChild(chip);
    const mark = h('span', { class: 'ack-mark', title: 'Acknowledged by ' + inc.ack.by + ' at ' + fmtClock(inc.ack.at) + ' UTC' });
    const icon = svgEl('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true', focusable: 'false' });
    icon.appendChild(svgEl('path', { d: 'm4 10.5 4 4 8-9' }));
    mark.appendChild(icon);
    mark.appendChild(h('span', { 'aria-hidden': 'true', text: 'ack' }));
    mark.appendChild(h('span', { class: 'visually-hidden', text: ', acknowledged' }));
    frag.appendChild(mark);
    return frag;
  }

  function ownerNode(owner) {
    return owner === 'Unassigned'
      ? h('span', { class: 'owner-unassigned', text: owner })
      : document.createTextNode(owner);
  }

  function buildRow(inc) {
    const tr = h('tr', { tabindex: '-1', dataset: { id: inc.id } });
    if (inc.id === state.selectedId) tr.setAttribute('aria-current', 'true');
    tr.appendChild(h('td', { class: 'col-sev' }, h('span', { class: 'sev', dataset: { sev: inc.severity }, text: SEV_LABEL[inc.severity] || inc.severity })));
    tr.appendChild(h('td', { class: 'col-inc' }, [
      h('span', { class: 'sev inc-sev-inline', dataset: { sev: inc.severity }, text: SEV_LABEL[inc.severity] || inc.severity }),
      h('span', { class: 'inc-id mono', text: inc.id }),
      h('span', { class: 'inc-title', text: inc.title }),
      h('span', { class: 'inc-sub' }, [inc.service, ' · ', ownerNode(inc.owner)])
    ]));
    tr.appendChild(h('td', { class: 'col-service', text: inc.service }));
    tr.appendChild(h('td', { class: 'col-age num', dataset: { opened: String(inc.openedAt.getTime()) }, text: formatAge(inc.openedAt) }));
    tr.appendChild(h('td', { class: 'col-owner' }, ownerNode(inc.owner)));
    tr.appendChild(h('td', { class: 'col-status' }, statusChip(inc)));
    return tr;
  }

  function renderTable() {
    const rows = visibleIncidents();
    state.visibleIds = rows.map((r) => r.id);
    el.tbody.textContent = '';
    rows.forEach((inc) => el.tbody.appendChild(buildRow(inc)));

    // Roving tabindex: one row is the tab stop.
    const stopId = [state.focusRowId, state.selectedId].find((id) => id && state.visibleIds.includes(id)) || state.visibleIds[0];
    $$('tr', el.tbody).forEach((tr) => tr.setAttribute('tabindex', tr.dataset.id === stopId ? '0' : '-1'));

    // Header sort indicators
    $$('th', el.table).forEach((th) => {
      const btn = $('.th-btn', th);
      if (btn && btn.dataset.sort === state.sort.key) th.setAttribute('aria-sort', state.sort.dir === 'asc' ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });

    renderEmptyState(rows.length);
    renderFilterCounts(rows.length);
  }

  function renderEmptyState(visibleCount) {
    const total = state.incidents.length;
    const show = visibleCount === 0;
    el.empty.hidden = !show;
    el.table.hidden = show;
    if (!show) return;

    if (total === 0) {
      el.emptyTitle.textContent = 'All clear';
      el.emptyText.textContent = 'There are no active incidents. New incidents appear here as soon as they are detected.';
      el.emptyClear.hidden = true;
      return;
    }
    const f = state.filters;
    const bits = [];
    bits.push(f.severity === 'all' ? 'No incidents' : 'No ' + f.severity + ' incidents');
    if (f.status !== 'all') bits.push('with status ' + (STATUS_LABEL[f.status] || f.status).toLowerCase());
    if (f.q.trim()) bits.push('matching “' + f.q.trim() + '”');
    el.emptyTitle.textContent = 'No incidents match';
    el.emptyText.textContent = bits.join(' ') + '. ' + total + ' active incident' + (total === 1 ? ' is' : 's are') + ' hidden by the current filters.';
    el.emptyClear.hidden = false;
  }

  function renderFilterCounts(visibleCount) {
    const total = state.incidents.length;
    const counts = { all: total, critical: 0, high: 0, medium: 0, low: 0 };
    state.incidents.forEach((i) => { counts[i.severity] = (counts[i.severity] || 0) + 1; });
    $$('[data-count]', el.severity).forEach((n) => { n.textContent = String(counts[n.dataset.count] || 0); });

    const unacked = state.incidents.filter((i) => !i.ack).length;
    if (filtersActive()) {
      el.incSummary.textContent = 'Showing ' + visibleCount + ' of ' + total;
    } else {
      el.incSummary.textContent = total + ' active · ' + unacked + ' unacknowledged';
    }
    el.clear.hidden = !filtersActive();
  }

  function refreshAges() {
    const now = Date.now();
    $$('td[data-opened]', el.tbody).forEach((td) => { td.textContent = formatAge(new Date(Number(td.dataset.opened)), now); });
    const inc = byId(state.selectedId);
    if (inc) el.dAge.textContent = formatAge(inc.openedAt, now);
  }

  function focusRow(tr) {
    if (!tr) return;
    $$('tr', el.tbody).forEach((r) => r.setAttribute('tabindex', r === tr ? '0' : '-1'));
    state.focusRowId = tr.dataset.id;
    tr.focus();
  }

  // ---------------------------------------------------------------------------
  // Selection + detail panel
  // ---------------------------------------------------------------------------

  function select(id, opts) {
    const inc = byId(id);
    if (!inc) return;
    state.selectedId = id;
    $$('tr', el.tbody).forEach((tr) => {
      if (tr.dataset.id === id) tr.setAttribute('aria-current', 'true'); else tr.removeAttribute('aria-current');
    });
    renderDetail();
    if (isSheet()) {
      el.backdrop.hidden = false;
      el.backdrop.dataset.open = 'true';
      el.detailTitle.focus({ preventScroll: true });
    } else if (opts && opts.focusPanel) {
      el.detailTitle.focus({ preventScroll: true });
    }
    announce('Selected ' + inc.id + ', ' + (SEV_LABEL[inc.severity] || inc.severity) + ', ' + inc.service + ': ' + inc.title);
  }

  function closeDetail() {
    const prevId = state.selectedId;
    state.selectedId = null;
    $$('tr[aria-current]', el.tbody).forEach((tr) => tr.removeAttribute('aria-current'));
    renderDetail();
    const row = prevId ? $('tr[data-id="' + prevId + '"]', el.tbody) : null;
    if (row) focusRow(row); else el.search.focus();
  }

  function renderDetail() {
    const inc = byId(state.selectedId);
    const open = !!inc;
    el.detailEmpty.hidden = open;
    el.detailBody.hidden = !open;
    el.detail.dataset.open = open ? 'true' : 'false';
    if (!open || !isSheet()) {
      el.backdrop.hidden = true;
      el.backdrop.dataset.open = 'false';
    }
    if (!open) return;

    el.dSev.dataset.sev = inc.severity;
    el.dSev.textContent = SEV_LABEL[inc.severity] || inc.severity;
    el.dId.textContent = inc.id;
    el.detailTitle.textContent = inc.title;
    el.dService.textContent = inc.service;
    el.dStatus.textContent = '';
    el.dStatus.appendChild(statusChip(inc));
    el.dOpened.textContent = fmtClock(inc.openedAt) + ' UTC';
    el.dAge.textContent = formatAge(inc.openedAt);
    el.dOwner.textContent = '';
    el.dOwner.appendChild(ownerNode(inc.owner));
    el.dAck.textContent = inc.ack ? fmtClock(inc.ack.at) + ' UTC · ' + inc.ack.by : '—';

    if (inc.ack) {
      el.ackBtn.textContent = 'Acknowledged';
      el.ackBtn.setAttribute('aria-disabled', 'true');
    } else {
      el.ackBtn.textContent = 'Acknowledge';
      el.ackBtn.removeAttribute('aria-disabled');
    }

    // Hidden-by-filter note
    const hidden = !state.visibleIds.includes(inc.id);
    el.detailNote.hidden = !hidden;
    el.detailNote.textContent = '';
    if (hidden) {
      el.detailNote.appendChild(document.createTextNode('This incident is hidden by the current filters.'));
      const b = h('button', { type: 'button', class: 'btn btn-sm', text: 'Show it' });
      b.addEventListener('click', () => { clearFilters(); });
      el.detailNote.appendChild(b);
    }

    el.timeline.textContent = '';
    inc.timeline.forEach((t) => {
      el.timeline.appendChild(h('li', { class: t.live ? 'is-live' : null }, [
        h('time', { datetime: t.at.toISOString(), text: fmtClock(t.at) }),
        h('span', { text: t.text })
      ]));
    });
  }

  // ---------------------------------------------------------------------------
  // Actions: acknowledge / undo / copy
  // ---------------------------------------------------------------------------

  function acknowledge(id) {
    const inc = byId(id);
    if (!inc || inc.ack) return;
    const snapshot = { status: inc.status, owner: inc.owner, timelineLen: inc.timeline.length };
    const at = new Date();
    const claimed = inc.owner === 'Unassigned';
    inc.ack = { at, by: OPERATOR };
    if (inc.status === 'open') inc.status = 'acknowledged';
    if (claimed) inc.owner = OPERATOR;
    inc.timeline.push({ at, text: 'Acknowledged by ' + OPERATOR.toLowerCase() + (claimed ? ' · assigned' : ''), live: true });

    renderSysStatus();
    renderTable();
    renderDetail();
    const msg = inc.id + ' acknowledged' + (claimed ? ' and assigned to you' : '');
    toast(msg, {
      action: 'Undo',
      onAction: () => {
        inc.ack = null;
        inc.status = snapshot.status;
        inc.owner = snapshot.owner;
        inc.timeline.length = snapshot.timelineLen;
        renderSysStatus();
        renderTable();
        renderDetail();
        announce(inc.id + ' acknowledgement undone');
        if (state.selectedId === inc.id) el.ackBtn.focus();
      }
    });
  }

  function copyId(id) {
    if (!id) return;
    const done = () => toast(id + ' copied to clipboard');
    const fail = () => toast('Clipboard is not available here');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).then(done, () => legacyCopy(id) ? done() : fail());
    } else {
      legacyCopy(id) ? done() : fail();
    }
  }

  function legacyCopy(text) {
    try {
      const ta = h('textarea', { class: 'visually-hidden', 'aria-hidden': 'true' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (err) { return false; }
  }

  // ---------------------------------------------------------------------------
  // Toasts
  // ---------------------------------------------------------------------------

  function toast(message, opts) {
    const node = h('div', { class: 'toast' }, h('span', { class: 'toast-msg', text: message }));
    let timer = null;
    const dismiss = () => { clearTimeout(timer); node.remove(); };
    if (opts && opts.action) {
      const b = h('button', { type: 'button', class: 'toast-action', text: opts.action });
      b.addEventListener('click', () => { opts.onAction(); dismiss(); });
      node.appendChild(b);
    }
    const x = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Dismiss notification' });
    const icon = svgEl('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true', focusable: 'false' });
    icon.appendChild(svgEl('path', { d: 'm5 5 10 10M15 5 5 15' }));
    x.appendChild(icon);
    x.addEventListener('click', dismiss);
    node.appendChild(x);
    el.toasts.appendChild(node);
    timer = setTimeout(dismiss, TOAST_MS);
  }

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  function setSeverity(sev) {
    state.filters.severity = sev;
    $$('button', el.severity).forEach((b) => b.setAttribute('aria-pressed', b.dataset.sev === sev ? 'true' : 'false'));
    renderTable();
    renderDetail();
  }

  function clearFilters() {
    state.filters = { q: '', severity: 'all', status: 'all' };
    el.search.value = '';
    el.status.value = 'all';
    $$('button', el.severity).forEach((b) => b.setAttribute('aria-pressed', b.dataset.sev === 'all' ? 'true' : 'false'));
    renderTable();
    renderDetail();
    announce('Filters cleared. Showing ' + state.visibleIds.length + ' incidents.');
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function bindEvents() {
    el.search.addEventListener('input', () => { state.filters.q = el.search.value; renderTable(); renderDetail(); });
    el.search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el.search.value) { e.preventDefault(); el.search.value = ''; state.filters.q = ''; renderTable(); renderDetail(); }
    });
    el.severity.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-sev]');
      if (b) setSeverity(b.dataset.sev);
    });
    el.status.addEventListener('change', () => { state.filters.status = el.status.value; renderTable(); renderDetail(); });
    el.clear.addEventListener('click', clearFilters);
    el.emptyClear.addEventListener('click', () => { clearFilters(); el.search.focus(); });

    // Sorting
    $('thead', el.table).addEventListener('click', (e) => {
      const b = e.target.closest('.th-btn');
      if (!b) return;
      const key = b.dataset.sort;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else state.sort = { key, dir: 'asc' };
      renderTable();
    });

    // Row selection (pointer)
    el.tbody.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      focusRow(tr);
      select(tr.dataset.id);
    });

    // Row navigation (keyboard)
    el.tbody.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const rows = $$('tr[data-id]', el.tbody);
      const i = rows.indexOf(tr);
      let next = null;
      switch (e.key) {
        case 'ArrowDown': next = rows[Math.min(i + 1, rows.length - 1)]; break;
        case 'ArrowUp': next = rows[Math.max(i - 1, 0)]; break;
        case 'Home': next = rows[0]; break;
        case 'End': next = rows[rows.length - 1]; break;
        case 'Enter': case ' ':
          e.preventDefault();
          select(tr.dataset.id);
          return;
        default: return;
      }
      e.preventDefault();
      focusRow(next);
    });
    el.tbody.addEventListener('focusin', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) state.focusRowId = tr.dataset.id;
    });

    // Detail panel
    el.detailClose.addEventListener('click', closeDetail);
    el.backdrop.addEventListener('click', closeDetail);
    el.ackBtn.addEventListener('click', () => {
      if (el.ackBtn.getAttribute('aria-disabled') === 'true') return;
      acknowledge(state.selectedId);
    });
    el.copyBtn.addEventListener('click', () => copyId(state.selectedId));

    // Theme
    el.themeToggle.addEventListener('click', () => {
      const cur = el.themeToggle.dataset.theme || 'auto';
      applyTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
    });

    // Global shortcuts
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'select' || tag === 'textarea' || e.target.isContentEditable;
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        el.search.focus();
        el.search.select();
      } else if (e.key === 'Escape' && state.selectedId && isSheet() && !typing) {
        closeDetail();
      }
    });

    // Layout changes
    const onMQ = () => renderDetail();
    if (sheetMQ.addEventListener) sheetMQ.addEventListener('change', onMQ); else sheetMQ.addListener(onMQ);

    if ('ResizeObserver' in window) {
      let lastW = 0;
      let raf = 0;
      new ResizeObserver(() => {
        const w = el.chart.clientWidth;
        if (w === lastW) return;
        lastW = w;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { setChartActive(null); renderChart(); });
      }).observe(el.chart);
    } else {
      window.addEventListener('resize', () => { setChartActive(null); renderChart(); });
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  function init() {
    applyTheme(readTheme());
    tickClock();
    setInterval(tickClock, 1000);

    loadData().then((raw) => {
      normalize(raw);
      renderSysStatus();
      renderMetrics();
      renderChartStats();
      renderChartTable();
      renderChart();
      renderTable();
      renderDetail();
      bindEvents();
      setInterval(refreshAges, AGE_TICK_MS);
    }).catch((err) => {
      console.error('Relay: failed to load data', err);
      $('.main-grid').hidden = true;
      el.loadError.hidden = false;
      el.sysStatusText.textContent = 'Data unavailable';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
