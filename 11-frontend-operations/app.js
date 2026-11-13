/* Relay — operations dashboard.
 * Plain DOM, no dependencies, no requests. All content is seeded from the
 * JSON block in index.html (a verbatim copy of DATA.json).
 * Data values are always inserted as text nodes, never as HTML.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- helpers

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function applyAttrs(node, attrs) {
    if (!attrs) return;
    for (const key of Object.keys(attrs)) {
      const value = attrs[key];
      if (value === false || value === null || value === undefined) continue;
      if (key === 'text') node.textContent = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else node.setAttribute(key, value === true ? '' : String(value));
    }
  }

  function appendKids(node, kids) {
    for (const kid of kids) {
      if (kid === null || kid === undefined || kid === false) continue;
      node.append(kid);
    }
    return node;
  }

  const h = (tag, attrs, ...kids) => {
    const node = document.createElement(tag);
    applyAttrs(node, attrs);
    return appendKids(node, kids);
  };

  const s = (tag, attrs, ...kids) => {
    const node = document.createElementNS(SVG_NS, tag);
    applyAttrs(node, attrs);
    return appendKids(node, kids);
  };

  function icon(name, extraClass) {
    return s('svg', {
      class: 'icon' + (extraClass ? ' ' + extraClass : ''),
      viewBox: '0 0 16 16', width: 16, height: 16,
      'aria-hidden': 'true', focusable: 'false'
    }, s('use', { href: '#i-' + name }));
  }

  const cap = (str) => String(str).charAt(0).toUpperCase() + String(str).slice(1);
  const pad2 = (n) => String(n).padStart(2, '0');
  const hourLabel = (i) => pad2(i) + ':00';
  const utcTime = (date) => date.toISOString().slice(11, 19);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const fmtNum = (n) => (Math.round(n * 10) / 10).toLocaleString('en-US');
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmtNum(Math.abs(n));

  const wideLayout = window.matchMedia('(min-width: 1100px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ----------------------------------------------------------------- domain

  const SEVERITIES = ['critical', 'high', 'medium', 'low'];
  const SEV_LEVEL = { critical: 4, high: 3, medium: 2, low: 1 };
  const STATUSES = ['open', 'acknowledged', 'investigating', 'monitoring'];

  // DATA.json gives a direction for each metric but not whether that direction
  // is desirable, so polarity lives here. Unlisted metrics stay neutral.
  const LOWER_IS_BETTER = new Set(['P95 latency', 'Error rate', 'Queue depth']);

  const state = {
    metrics: [],
    throughput: [],
    incidents: [],
    selectedId: null,
    filters: { q: '', severities: new Set(), status: 'all', unackedOnly: false },
    log: [],                // session actions, newest first
    chart: { index: null, active: false, geometry: null },
    chartView: 'chart',
    loadFailed: false       // seed unreadable: say "unknown", never "all clear"
  };

  function loadSeed() {
    const node = document.getElementById('seed-data');
    const data = JSON.parse(node.textContent);
    const list = (value) => (Array.isArray(value) ? value : []);
    state.metrics = list(data.metrics);
    state.throughput = list(data.throughput).map(Number).filter(Number.isFinite);
    state.incidents = list(data.incidents).map((inc) => Object.assign({}, inc, { ack: null }));
    state.selectedId = state.incidents.length ? state.incidents[0].id : null;
  }

  const byId = (id) => state.incidents.find((inc) => inc.id === id) || null;

  function matches(inc, skipSeverity) {
    const f = state.filters;
    if (f.q) {
      const hay = [inc.id, inc.title, inc.service, inc.owner, inc.status, inc.severity]
        .join(' ').toLowerCase();
      const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.every((term) => hay.includes(term))) return false;
    }
    if (!skipSeverity && f.severities.size && !f.severities.has(inc.severity)) return false;
    if (f.status !== 'all' && inc.status !== f.status) return false;
    if (f.unackedOnly && inc.ack) return false;
    return true;
  }

  const visibleIncidents = () => state.incidents.filter((inc) => matches(inc, false));

  function filtersActive() {
    const f = state.filters;
    return Boolean(f.q || f.severities.size || f.status !== 'all' || f.unackedOnly);
  }

  // --------------------------------------------------------- announcements

  let announceTimer = 0;
  function announce(message, delay) {
    const live = $('#live');
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      live.textContent = '';
      // A fresh text node on the next frame makes repeated messages re-announce.
      window.requestAnimationFrame(() => { live.textContent = message; });
    }, delay || 0);
  }

  // ------------------------------------------------------- shared fragments

  function sevBars(severity) {
    const level = SEV_LEVEL[severity] || 0;
    const svg = s('svg', {
      class: 'sev-bars', viewBox: '0 0 15 12', width: 15, height: 12,
      'aria-hidden': 'true', focusable: 'false'
    });
    for (let i = 0; i < 4; i += 1) {
      const height = 3 + i * 3;
      svg.append(s('rect', {
        x: i * 4, y: 12 - height, width: 3, height,
        class: i < level ? 'on' : 'off'
      }));
    }
    return svg;
  }

  function sevBadge(severity) {
    const known = SEV_LEVEL[severity] ? severity : 'unknown';
    return h('span', { class: 'sev sev-' + known }, sevBars(severity),
      h('span', { class: 'sev-label', text: cap(severity || 'Unknown') }));
  }

  function statusTag(inc) {
    return h('span', { class: 'status' },
      h('span', { class: 'tag tag-' + inc.status, text: cap(inc.status) }),
      inc.ack && inc.status !== 'acknowledged'
        ? h('span', { class: 'ack-mark', title: 'Acknowledged by you' },
          icon('check'), h('span', { class: 'vh', text: 'Acknowledged by you' }))
        : null);
  }

  function ownerNode(inc) {
    const unassigned = !inc.owner || /^unassigned$/i.test(inc.owner);
    return h('span', { class: unassigned ? 'owner owner-none' : 'owner', text: inc.owner || 'Unassigned' });
  }

  // ----------------------------------------------------------------- topbar

  function renderTopbar() {
    const host = $('#top-status');
    const active = state.incidents;
    const unacked = active.filter((inc) => !inc.ack).length;
    host.replaceChildren();

    if (state.loadFailed) {
      host.append(h('span', { class: 'top-item' }, h('strong', { text: 'Status unknown' }),
        h('span', { class: 'top-count', text: 'data unavailable' })));
    } else if (!active.length) {
      host.append(h('span', { class: 'top-item' }, icon('check'), h('strong', { text: 'No active incidents' })));
    } else {
      const worst = SEVERITIES.find((sev) => active.some((inc) => inc.severity === sev)) || active[0].severity;
      const worstCount = active.filter((inc) => inc.severity === worst).length;
      host.append(
        h('span', { class: 'top-item top-worst' },
          h('span', { class: 'top-label', text: 'Highest' }),
          sevBadge(worst),
          h('span', { class: 'top-count num', text: '×' + worstCount })),
        h('span', { class: 'top-item top-active' },
          h('span', { class: 'top-label', text: 'Active' }),
          h('strong', { class: 'num', text: String(active.length) })),
        h('span', { class: 'top-item' + (unacked ? ' needs-ack' : '') },
          h('span', { class: 'top-label', text: 'Unacked' }),
          h('strong', { class: 'num', text: String(unacked) }))
      );
    }

    const badge = $('#rail-badge');
    badge.hidden = unacked === 0;
    badge.replaceChildren(
      document.createTextNode(String(unacked)),
      h('span', { class: 'vh', text: ' unacknowledged' }));
  }

  function startClock() {
    const node = $('#clock');
    const tick = () => {
      const now = new Date();
      node.textContent = utcTime(now);
      node.setAttribute('datetime', now.toISOString());
    };
    tick();
    window.setInterval(tick, 1000);
  }

  function initTheme() {
    const btn = $('#theme-btn');
    const root = document.documentElement;
    const osDark = window.matchMedia('(prefers-color-scheme: dark)');
    const current = () => root.getAttribute('data-theme') || (osDark.matches ? 'dark' : 'light');
    const label = () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      btn.title = 'Switch to ' + next + ' theme';
    };
    btn.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('relay-theme', next); } catch (e) { /* session only */ }
      label();
      renderChart();
      announce(cap(next) + ' theme on.');
    });
    osDark.addEventListener('change', label);
    label();
  }

  // ---------------------------------------------------------------- metrics

  function renderMetrics() {
    const host = $('#metric-list');
    host.replaceChildren();
    if (!state.metrics.length) {
      host.append(h('li', { class: 'metric metric-empty', text: state.loadFailed ? 'Metrics unavailable.' : 'No summary metrics in the seed data.' }));
      return;
    }
    for (const metric of state.metrics) {
      const parts = /^([−+-]?[\d.,]+)\s*(.*)$/.exec(String(metric.value)) || [null, String(metric.value), ''];
      const up = metric.direction === 'up';
      const down = metric.direction === 'down';
      let tone = 'neutral';
      let word = up ? 'Rising' : down ? 'Falling' : 'Steady';
      if (LOWER_IS_BETTER.has(metric.label) && (up || down)) {
        tone = down ? 'good' : 'bad';
        word = down ? 'Improving' : 'Worsening';
      }
      host.append(h('li', { class: 'metric' },
        h('span', { class: 'metric-label', text: metric.label }),
        h('span', { class: 'metric-value' },
          h('span', { class: 'metric-num', text: parts[1] }),
          parts[2] ? h('span', { class: 'metric-unit', text: parts[2] }) : null),
        h('span', { class: 'trend trend-' + tone },
          up || down ? icon(up ? 'up' : 'down') : null,
          h('span', { class: 'vh', text: up ? 'up ' : down ? 'down ' : '' }),
          h('span', { class: 'trend-change num', text: metric.change || '' }),
          h('span', { class: 'trend-word', text: word }))));
    }
  }

  // ------------------------------------------------------------------ chart

  function niceScale(maxValue) {
    const raw = Math.max(maxValue, 1) / 4;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((c) => c >= raw);
    return { step, max: step * Math.ceil(Math.max(maxValue, 1) / step) };
  }

  function renderChartStats() {
    const host = $('#chart-stats');
    const data = state.throughput;
    host.replaceChildren();
    if (!data.length) return;
    const peak = data.indexOf(Math.max(...data));
    const low = data.indexOf(Math.min(...data));
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const stat = (label, value, at) => h('div', null,
      h('dt', { text: label }),
      h('dd', null, h('strong', { class: 'num', text: value }),
        at ? h('span', { class: 'num', text: ' ' + at }) : null));
    host.append(
      stat('Peak', fmtNum(data[peak]), hourLabel(peak)),
      stat('Low', fmtNum(data[low]), hourLabel(low)),
      stat('Mean', fmtNum(mean)));
  }

  function renderChartTable() {
    const body = $('#chart-table tbody');
    body.replaceChildren();
    state.throughput.forEach((value, i) => {
      body.append(h('tr', null,
        h('th', { scope: 'row', class: 'num', text: hourLabel(i) }),
        h('td', { class: 'num', text: fmtNum(value) }),
        h('td', { class: 'num', text: i === 0 ? '—' : signed(value - state.throughput[i - 1]) })));
    });
  }

  function renderChart() {
    const host = $('#chart');
    const data = state.throughput;
    const n = data.length;
    host.replaceChildren();
    state.chart.geometry = null;

    if (!n) {
      host.removeAttribute('role');
      host.removeAttribute('tabindex');
      host.append(h('p', { class: 'chart-empty', text: state.loadFailed ? 'Throughput unavailable.' : 'No throughput samples in the seed data.' }));
      return;
    }

    const W = host.clientWidth;
    const H = host.clientHeight;
    if (W < 80 || H < 60) return;   // hidden (table view) or not laid out yet

    const m = { l: 32, r: 16, t: 20, b: 24 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const scale = niceScale(Math.max(...data));
    const stepX = n > 1 ? pw / (n - 1) : 0;
    const x = (i) => m.l + (n > 1 ? i * stepX : pw / 2);
    const y = (v) => m.t + ph - (v / scale.max) * ph;
    const r1 = (v) => Math.round(v * 10) / 10;

    const svg = s('svg', {
      class: 'chart-svg', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H,
      'aria-hidden': 'true', focusable: 'false'
    });

    // Gridlines and y-axis ticks (recessive hairlines).
    for (let v = 0; v <= scale.max + 1e-9; v += scale.step) {
      const yy = Math.round(y(v)) + 0.5;
      svg.append(
        s('line', { class: v === 0 ? 'axis' : 'grid', x1: m.l, x2: W - m.r, y1: yy, y2: yy }),
        s('text', { class: 'tick', x: m.l - 8, y: yy, dy: '0.32em', 'text-anchor': 'end', text: fmtNum(v) }));
    }

    // X-axis ticks: every 3 h when there is room, otherwise every 6 h.
    const every = stepX * 3 >= 52 ? 3 : 6;
    let lastTick = 0;
    for (let i = 0; i < n; i += every) {
      svg.append(s('text', {
        class: 'tick', x: x(i), y: H - 6,
        'text-anchor': i === 0 ? 'start' : 'middle', text: hourLabel(i)
      }));
      lastTick = i;
    }
    if (lastTick !== n - 1 && (n - 1 - lastTick) * stepX >= 52) {
      svg.append(s('text', { class: 'tick', x: x(n - 1), y: H - 6, 'text-anchor': 'end', text: hourLabel(n - 1) }));
    }

    // Area wash + 2px line.
    const points = data.map((v, i) => r1(x(i)) + ',' + r1(y(v)));
    svg.append(
      s('path', { class: 'area', d: 'M' + r1(x(0)) + ',' + r1(y(0)) + ' L' + points.join(' L') + ' L' + r1(x(n - 1)) + ',' + r1(y(0)) + ' Z' }),
      s('path', { class: 'line', d: 'M' + points.join(' L') }));

    // Selective direct labels: the peak and the most recent hour only.
    const peak = data.indexOf(Math.max(...data));
    const marker = (i) => s('circle', { class: 'dot', cx: r1(x(i)), cy: r1(y(data[i])), r: 4 });
    const peakAnchor = x(peak) < m.l + 16 ? 'start' : x(peak) > W - m.r - 16 ? 'end' : 'middle';
    svg.append(marker(peak), s('text', {
      class: 'point-label', x: r1(x(peak)), y: r1(y(data[peak]) - 9), 'text-anchor': peakAnchor, text: fmtNum(data[peak])
    }));
    if (peak !== n - 1) {
      const last = n - 1;
      // Sit below the end point when the line arrives from above, otherwise above it.
      const below = n > 1 && data[last - 1] > data[last] && y(data[last]) + 18 < m.t + ph;
      svg.append(marker(last), s('text', {
        class: 'point-label', x: r1(x(last)), y: r1(y(data[last]) + (below ? 17 : -9)),
        'text-anchor': 'end', text: fmtNum(data[last])
      }));
    }

    // Crosshair layer (driven by pointer and keyboard).
    const cross = s('g', { class: 'cross', visibility: 'hidden' },
      s('line', { class: 'cross-line', y1: m.t, y2: m.t + ph }),
      s('circle', { class: 'cross-dot', r: 4.5 }));
    svg.append(cross);
    host.append(svg);

    host.setAttribute('role', 'slider');
    host.setAttribute('tabindex', '0');
    host.setAttribute('aria-orientation', 'horizontal');
    host.setAttribute('aria-label', 'Throughput by hour. Arrow keys step through the 24 hourly values.');
    host.setAttribute('aria-valuemin', '0');
    host.setAttribute('aria-valuemax', String(n - 1));

    state.chart.geometry = { m, pw, ph, W, H, stepX, x, y, cross, n };
    if (state.chart.index === null || state.chart.index > n - 1) state.chart.index = n - 1;
    paintCrosshair();
  }

  function paintCrosshair() {
    const g = state.chart.geometry;
    const host = $('#chart');
    const tip = $('#chart-tip');
    host.classList.toggle('is-inspecting', Boolean(g) && state.chart.active);
    if (!g) { tip.hidden = true; return; }
    const i = state.chart.index;
    const value = state.throughput[i];
    host.setAttribute('aria-valuenow', String(i));
    host.setAttribute('aria-valuetext', hourLabel(i) + ', ' + fmtNum(value));

    if (!state.chart.active) {
      g.cross.setAttribute('visibility', 'hidden');
      tip.hidden = true;
      return;
    }
    const cx = g.x(i);
    const cy = g.y(value);
    g.cross.setAttribute('visibility', 'visible');
    const line = g.cross.firstChild;
    line.setAttribute('x1', Math.round(cx) + 0.5);
    line.setAttribute('x2', Math.round(cx) + 0.5);
    g.cross.lastChild.setAttribute('cx', cx);
    g.cross.lastChild.setAttribute('cy', cy);

    tip.replaceChildren();
    appendKids(tip, [
      h('strong', { class: 'num', text: fmtNum(value) }),
      h('span', { class: 'num', text: hourLabel(i) }),
      i > 0 ? h('span', { class: 'tip-delta num', text: signed(value - state.throughput[i - 1]) + ' vs ' + hourLabel(i - 1) }) : null]);
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = cx + 10;
    if (left + tw > g.W - 4) left = cx - 10 - tw;
    const top = clamp(cy - th - 10, 2, g.H - th - 2);
    tip.style.transform = 'translate(' + Math.round(clamp(left, 2, g.W - tw - 2)) + 'px,' + Math.round(top) + 'px)';
  }

  function initChart() {
    const host = $('#chart');
    const indexFromEvent = (event) => {
      const g = state.chart.geometry;
      if (!g || g.n < 2) return 0;
      const rect = host.getBoundingClientRect();
      return clamp(Math.round((event.clientX - rect.left - g.m.l) / g.stepX), 0, g.n - 1);
    };
    const show = (index) => {
      state.chart.index = index;
      state.chart.active = true;
      paintCrosshair();
    };
    host.addEventListener('pointermove', (event) => { if (state.chart.geometry) show(indexFromEvent(event)); });
    host.addEventListener('pointerdown', (event) => { if (state.chart.geometry) show(indexFromEvent(event)); });
    host.addEventListener('pointerleave', () => {
      state.chart.active = document.activeElement === host && host.matches(':focus-visible');
      paintCrosshair();
    });
    host.addEventListener('focus', () => {
      if (!state.chart.geometry) return;
      if (host.matches(':focus-visible')) show(state.chart.index);
    });
    host.addEventListener('blur', () => { state.chart.active = false; paintCrosshair(); });
    host.addEventListener('keydown', (event) => {
      const g = state.chart.geometry;
      if (!g) return;
      const moves = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -6, PageUp: 6 };
      let next = null;
      if (event.key in moves) next = state.chart.index + moves[event.key];
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = g.n - 1;
      else if (event.key === 'Escape') { state.chart.active = false; paintCrosshair(); return; }
      if (next === null) return;
      event.preventDefault();
      show(clamp(next, 0, g.n - 1));
    });

    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(renderChart);
    };
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(host);
    else window.addEventListener('resize', schedule);

    const setView = (view) => {
      state.chartView = view;
      $('#view-chart').setAttribute('aria-pressed', String(view === 'chart'));
      $('#view-table').setAttribute('aria-pressed', String(view === 'table'));
      $('#chart-wrap').hidden = view !== 'chart';
      $('#chart-table-wrap').hidden = view !== 'table';
      if (view === 'chart') renderChart();
    };
    $('#view-chart').addEventListener('click', () => setView('chart'));
    $('#view-table').addEventListener('click', () => setView('table'));
  }

  // ---------------------------------------------------------------- filters

  function renderFilterControls() {
    // Severity chips. Counts respect the other filters so they predict the result.
    const chips = $('#f-sev');
    const focusedSev = chips.contains(document.activeElement) ? document.activeElement.dataset.sev : null;
    chips.replaceChildren();
    for (const sev of SEVERITIES) {
      const count = state.incidents.filter((inc) => inc.severity === sev && matches(inc, true)).length;
      chips.append(h('button', {
        type: 'button', class: 'chip', dataset: { sev },
        'aria-pressed': String(state.filters.severities.has(sev))
      }, sevBadge(sev), h('span', { class: 'chip-count num', text: String(count) }),
      h('span', { class: 'vh', text: count === 1 ? ' incident' : ' incidents' })));
    }
    if (focusedSev) {
      const again = chips.querySelector('[data-sev="' + focusedSev + '"]');
      if (again) again.focus();
    }

    // Status options: the known lifecycle plus anything else present in the data.
    const select = $('#f-status');
    const extra = state.incidents.map((inc) => inc.status).filter((st) => !STATUSES.includes(st));
    const options = ['all'].concat(STATUSES, Array.from(new Set(extra)));
    if (select.options.length !== options.length) {
      select.replaceChildren(...options.map((value) =>
        h('option', { value, text: value === 'all' ? 'All statuses' : cap(value) })));
    }
    select.value = state.filters.status;

    $('#f-q').value = state.filters.q;
    $('#f-unacked').checked = state.filters.unackedOnly;
    $('#f-clear').hidden = !filtersActive();
  }

  function clearFilters(focusTarget) {
    state.filters = { q: '', severities: new Set(), status: 'all', unackedOnly: false };
    renderIncidents();
    renderDetail();
    announce('Filters cleared. ' + countSentence());
    if (focusTarget) focusTarget.focus();
  }

  function countSentence() {
    const shown = visibleIncidents().length;
    const total = state.incidents.length;
    return shown + ' of ' + total + (total === 1 ? ' incident' : ' incidents') + ' shown.';
  }

  function onFilterChange() {
    // If the filter change orphaned focus (e.g. Clear button hid itself), keep it in the form.
    renderIncidents();
    renderDetail();
    announce(countSentence(), 350);
  }

  function initFilters() {
    $('#filters').addEventListener('submit', (event) => event.preventDefault());
    $('#f-q').addEventListener('input', (event) => {
      state.filters.q = event.target.value.trim();
      onFilterChange();
    });
    $('#f-sev').addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (!chip) return;
      const set = state.filters.severities;
      if (set.has(chip.dataset.sev)) set.delete(chip.dataset.sev); else set.add(chip.dataset.sev);
      onFilterChange();
    });
    $('#f-status').addEventListener('change', (event) => {
      state.filters.status = event.target.value;
      onFilterChange();
    });
    $('#f-unacked').addEventListener('change', (event) => {
      state.filters.unackedOnly = event.target.checked;
      onFilterChange();
    });
    $('#f-clear').addEventListener('click', () => clearFilters($('#f-q')));
  }

  // --------------------------------------------------------- incident table

  function activeFilterSummary() {
    const f = state.filters;
    const parts = [];
    if (f.q) parts.push('search “' + f.q + '”');
    if (f.severities.size) {
      parts.push('severity ' + SEVERITIES.filter((sev) => f.severities.has(sev)).map(cap).join(' or '));
    }
    if (f.status !== 'all') parts.push('status ' + cap(f.status));
    if (f.unackedOnly) parts.push('unacknowledged only');
    return parts.join(' · ');
  }

  function incidentRow(inc) {
    const selected = inc.id === state.selectedId;
    return h('tr', { role: 'row', class: selected ? 'is-selected' : null, dataset: { id: inc.id } },
      h('td', { role: 'cell', class: 'c-sev' }, sevBadge(inc.severity)),
      h('th', { role: 'rowheader', scope: 'row', class: 'c-inc' },
        h('button', {
          type: 'button', class: 'row-btn', dataset: { id: inc.id },
          'aria-current': selected ? 'true' : null, 'aria-controls': 'detail'
        },
        h('span', { class: 'inc-id mono', text: inc.id }),
        h('span', { class: 'inc-title', text: inc.title }))),
      h('td', { role: 'cell', class: 'c-svc mono', text: inc.service }),
      h('td', { role: 'cell', class: 'c-age num', 'data-label': 'Age', text: inc.age }),
      h('td', { role: 'cell', class: 'c-owner', 'data-label': 'Owner' }, ownerNode(inc)),
      h('td', { role: 'cell', class: 'c-status' }, statusTag(inc)));
  }

  function renderIncidents() {
    const body = $('#inc-body');
    const table = $('#inc-table');
    const empty = $('#inc-empty');
    const rows = visibleIncidents();
    const total = state.incidents.length;
    const active = document.activeElement;
    const focusedId = body.contains(active) && active.dataset ? active.dataset.id : null;
    const focusWasInEmpty = empty.contains(active);

    renderFilterControls();
    $('#inc-count').textContent = total ? rows.length + ' of ' + total : '';

    body.replaceChildren(...rows.map(incidentRow));
    table.hidden = rows.length === 0;
    empty.hidden = rows.length !== 0;
    empty.replaceChildren();

    if (state.loadFailed) {
      empty.append(icon('incidents', 'empty-icon'),
        h('p', { class: 'empty-title', text: 'Incident data unavailable' }),
        h('p', { class: 'empty-text', text: 'The seed data could not be read, so incident status is unknown. This is not an all-clear.' }));
    } else if (!total) {
      empty.append(icon('check', 'empty-icon'),
        h('p', { class: 'empty-title', text: 'No active incidents' }),
        h('p', { class: 'empty-text', text: 'Nothing is open right now. New incidents will be listed here.' }));
    } else if (!rows.length) {
      empty.append(icon('filter', 'empty-icon'),
        h('p', { class: 'empty-title', text: 'No incidents match these filters' }),
        h('p', { class: 'empty-text', text: 'Active: ' + activeFilterSummary() + '. ' + total + (total === 1 ? ' incident is' : ' incidents are') + ' hidden.' }),
        h('button', { type: 'button', class: 'btn', id: 'empty-clear', text: 'Clear filters' }));
    }

    if (focusedId) {
      const again = body.querySelector('.row-btn[data-id="' + focusedId + '"]');
      (again || $('#f-q')).focus();
    } else if (focusWasInEmpty && rows.length) {
      $('#f-q').focus();
    }
  }

  function paintSelection() {
    for (const tr of $$('#inc-body tr')) {
      const selected = tr.dataset.id === state.selectedId;
      tr.classList.toggle('is-selected', selected);
      const btn = $('.row-btn', tr);
      if (selected) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
    }
  }

  function selectIncident(id, options) {
    const inc = byId(id);
    if (!inc) return;
    const changed = state.selectedId !== id;
    state.selectedId = id;
    paintSelection();
    renderDetail();
    if (changed) announce('Showing ' + inc.id + ', ' + inc.title + '.');
    // Below the two-column breakpoint the panel sits under the table, so bring it to the user.
    if (options && options.reveal && !wideLayout.matches) revealDetail();
  }

  function revealDetail() {
    const title = $('#detail-title');
    if (!title) return;
    title.focus({ preventScroll: true });
    $('#detail').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function initTable() {
    const body = $('#inc-body');
    body.addEventListener('click', (event) => {
      const tr = event.target.closest('tr[data-id]');
      if (tr) selectIncident(tr.dataset.id, { reveal: true });
    });
    body.addEventListener('keydown', (event) => {
      const btn = event.target.closest('.row-btn');
      if (!btn) return;
      const buttons = $$('.row-btn', body);
      const at = buttons.indexOf(btn);
      let next = null;
      if (event.key === 'ArrowDown') next = buttons[at + 1];
      else if (event.key === 'ArrowUp') next = buttons[at - 1];
      else if (event.key === 'Home') next = buttons[0];
      else if (event.key === 'End') next = buttons[buttons.length - 1];
      else return;
      event.preventDefault();
      if (next) next.focus();
    });
    $('#inc-empty').addEventListener('click', (event) => {
      if (event.target.closest('#empty-clear')) clearFilters($('#f-q'));
    });
  }

  // ------------------------------------------------------------ detail panel

  function renderDetail() {
    const host = $('#detail-body');
    const stepper = $('#detail-stepper');
    const panel = $('#detail');
    const inc = byId(state.selectedId);
    const active = document.activeElement;
    const focusKey = panel.contains(active) && active.dataset ? active.dataset.focusKey : null;

    host.replaceChildren();
    stepper.replaceChildren();

    if (!inc) {
      host.append(h('div', { class: 'empty' }, icon('detail', 'empty-icon'),
        h('p', { class: 'empty-title', text: state.incidents.length ? 'No incident selected' : 'Nothing to inspect' }),
        h('p', { class: 'empty-text', text: state.incidents.length
          ? 'Choose a row in the incident table to see its details here.'
          : state.loadFailed ? 'Incident data could not be read.' : 'There are no active incidents.' })));
      return;
    }

    const visible = visibleIncidents();
    const at = visible.findIndex((item) => item.id === inc.id);
    const hidden = at === -1;

    stepper.append(
      h('span', { class: 'stepper-pos num', text: hidden ? 'Filtered out' : (at + 1) + ' of ' + visible.length }),
      h('button', {
        type: 'button', class: 'icon-btn', 'aria-label': 'Previous incident',
        dataset: { focusKey: 'prev', step: '-1' }, disabled: hidden || at <= 0
      }, icon('chev-up')),
      h('button', {
        type: 'button', class: 'icon-btn', 'aria-label': 'Next incident',
        dataset: { focusKey: 'next', step: '1' }, disabled: hidden || at >= visible.length - 1
      }, icon('chev-down')));

    const ackTime = inc.ack ? utcTime(inc.ack.at) + ' UTC' : null;
    const row = (term, ...value) => h('div', null, h('dt', { text: term }), h('dd', null, ...value));

    appendKids(host, [
      h('div', { class: 'detail-top' }, sevBadge(inc.severity), h('span', { class: 'mono detail-id', text: inc.id })),
      h('h3', { class: 'detail-title', id: 'detail-title', tabindex: '-1', text: inc.title }),
      hidden ? h('p', { class: 'notice' },
        h('span', { text: 'Not in the table: hidden by the current filters. ' }),
        h('button', { type: 'button', class: 'link-btn', dataset: { focusKey: 'clear', action: 'clear' }, text: 'Clear filters' })) : null,
      h('dl', { class: 'kv' },
        row('Service', h('span', { class: 'mono', text: inc.service })),
        row('Status', statusTag(inc)),
        row('Owner', ownerNode(inc)),
        row('Age', h('span', { class: 'num', text: inc.age })),
        row('Acknowledged', inc.ack
          ? h('span', { class: 'num', text: ackTime + ' by you' })
          : h('span', { class: 'muted', text: 'Not yet' })))]);

    const actions = h('div', { class: 'actions' });
    if (inc.ack) {
      actions.append(
        h('p', { class: 'ack-state' }, icon('check'), h('span', { text: 'Acknowledged' })),
        h('button', { type: 'button', class: 'btn', dataset: { focusKey: 'primary', action: 'undo' }, text: 'Undo' }));
    } else {
      actions.append(
        h('button', {
          type: 'button', class: 'btn btn-primary', 'aria-keyshortcuts': 'A',
          dataset: { focusKey: 'primary', action: 'ack' }
        }, h('span', { text: 'Acknowledge' }), h('kbd', { 'aria-hidden': 'true', text: 'A' })),
        h('p', { class: 'hint', text: inc.status === 'open'
          ? 'Marks it as seen by you and moves status from Open to Acknowledged.'
          : 'Marks it as seen by you. Status stays ' + cap(inc.status) + '.' }));
    }
    host.append(actions);

    const entries = state.log.filter((entry) => entry.id === inc.id);
    host.append(h('h3', { class: 'sub-head', text: 'Session activity' }));
    if (entries.length) {
      host.append(h('ol', { class: 'log' }, ...entries.map((entry) => h('li', null,
        h('time', { class: 'num', datetime: entry.at.toISOString(), text: utcTime(entry.at) }),
        h('span', { text: entry.text })))));
    } else {
      host.append(h('p', { class: 'muted log-empty', text: 'No actions on this incident yet. Changes last until the page reloads.' }));
    }

    host.append(h('button', {
      type: 'button', class: 'btn back-btn', dataset: { focusKey: 'back', action: 'back' }, text: 'Back to incident list'
    }));

    if (focusKey) {
      const fallback = { prev: 'next', next: 'prev' }[focusKey];
      const usable = (key) => {
        const node = key ? panel.querySelector('[data-focus-key="' + key + '"]') : null;
        return node && !node.disabled ? node : null;
      };
      (usable(focusKey) || usable(fallback) || $('#detail-title')).focus();
    }
  }

  function acknowledge(id) {
    const inc = byId(id);
    if (!inc || inc.ack) return;
    const at = new Date();
    inc.ack = { at, previousStatus: inc.status };
    let text = 'Acknowledged by you';
    if (inc.status === 'open') {
      inc.status = 'acknowledged';
      text += ' · status Open → Acknowledged';
    }
    state.log.unshift({ id, at, text });
    renderAfterAction();
    announce(inc.id + ' acknowledged.');
  }

  function undoAcknowledge(id) {
    const inc = byId(id);
    if (!inc || !inc.ack) return;
    const restored = inc.ack.previousStatus;
    let text = 'Acknowledgement undone';
    if (inc.status !== restored) text += ' · status back to ' + cap(restored);
    inc.status = restored;
    inc.ack = null;
    state.log.unshift({ id, at: new Date(), text });
    renderAfterAction();
    announce(inc.id + ' acknowledgement undone.');
  }

  function renderAfterAction() {
    renderTopbar();
    renderIncidents();
    renderDetail();
  }

  function initDetail() {
    const panel = $('#detail');
    panel.addEventListener('click', (event) => {
      const stepBtn = event.target.closest('[data-step]');
      if (stepBtn) {
        const visible = visibleIncidents();
        const at = visible.findIndex((item) => item.id === state.selectedId);
        const next = visible[at + Number(stepBtn.dataset.step)];
        if (next) selectIncident(next.id);
        return;
      }
      const actionBtn = event.target.closest('[data-action]');
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;
      if (action === 'ack') acknowledge(state.selectedId);
      else if (action === 'undo') undoAcknowledge(state.selectedId);
      else if (action === 'clear') clearFilters();
      else if (action === 'back') {
        const rowBtn = $('#inc-body .row-btn[data-id="' + state.selectedId + '"]') || $('#f-q');
        rowBtn.focus({ preventScroll: true });
        $('#incidents').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      }
    });

    // "A" acknowledges, but only while focus is inside the incident table or the
    // detail panel and never while typing, so it cannot fire by accident elsewhere.
    const onShortcut = (event) => {
      if (event.key !== 'a' && event.key !== 'A') return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.target.closest('input, select, textarea, [contenteditable]')) return;
      const rowBtn = event.target.closest('.row-btn');
      const id = rowBtn ? rowBtn.dataset.id : state.selectedId;
      const inc = byId(id);
      if (!inc) return;
      event.preventDefault();
      if (inc.ack) { announce(inc.id + ' is already acknowledged.'); return; }
      if (rowBtn && id !== state.selectedId) selectIncident(id);
      acknowledge(id);
    };
    $('#inc-body').addEventListener('keydown', onShortcut);
    panel.addEventListener('keydown', onShortcut);
  }

  // -------------------------------------------------------------- navigation

  function initNav() {
    const links = $$('.rail a');
    const targets = links.map((link) => document.getElementById(link.hash.slice(1)));
    let lockUntil = 0;

    const setCurrent = (link) => {
      for (const item of links) {
        if (item === link) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
      }
    };

    const spy = () => {
      if (Date.now() < lockUntil) return;
      // A section becomes current once its top comes within reach of the top bar.
      const line = $('.topbar').offsetHeight + 96;
      // On the wide layout the detail panel is pinned beside the content, so it
      // never becomes the "current" scroll position.
      const candidates = targets.filter((target) => !(wideLayout.matches && target.id === 'detail'));
      let current = candidates[0];
      for (const target of candidates) {
        if (target.getBoundingClientRect().top <= line) current = target;
      }
      const doc = document.documentElement;
      if (doc.scrollHeight > window.innerHeight + 4 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2) {
        current = candidates[candidates.length - 1];
      }
      setCurrent(links[targets.indexOf(current)]);
    };

    for (const link of links) {
      link.addEventListener('click', () => {
        setCurrent(link);
        lockUntil = Date.now() + 900;   // let the scroll settle before the spy takes over
      });
    }
    let frame = 0;
    window.addEventListener('scroll', () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(spy);
    }, { passive: true });
    wideLayout.addEventListener('change', spy);
    spy();
  }

  // ------------------------------------------------------------------- boot

  function boot() {
    initTheme();
    startClock();
    try {
      loadSeed();
    } catch (error) {
      state.loadFailed = true;
      const banner = $('#load-error');
      banner.textContent = 'Seed data could not be read, so nothing below reflects real status. Check the JSON block in index.html against DATA.json.';
      banner.hidden = false;
    }
    renderTopbar();
    renderMetrics();
    renderChartStats();
    renderChartTable();
    initChart();
    renderChart();
    initFilters();
    initTable();
    initDetail();
    renderIncidents();
    renderDetail();
    initNav();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
