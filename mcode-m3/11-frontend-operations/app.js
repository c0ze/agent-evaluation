/* Relay — operations control room
   Pure DOM, no dependencies. Reads DATA.json via fetch, renders metrics,
   throughput chart, incident table, filters, and detail panel. */

(() => {
  "use strict";

  // ---------- Bootstrap -----------------------------------------------------

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const dataUrl = "DATA.json";

  // Local state
  const state = {
    metrics: [],
    throughput: [],
    incidents: [],
    filter: { severity: "all", q: "" },
    selectedId: null,
    acknowledgedIds: new Set(),
    range: "24h",
  };

  // ---------- Boot ---------------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    bindGlobalKeys();
    startClock();
    load();
  });

  async function load() {
    let data = null;
    try {
      const res = await fetch(dataUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.warn("Falling back to embedded data:", err);
      data = EMBEDDED_DATA;
    }
    state.metrics = data.metrics || [];
    state.throughput = data.throughput || [];
    state.incidents = data.incidents || [];
    render();
  }

  // Mirror of DATA.json — used when fetch() is unavailable (e.g. file://).
  const EMBEDDED_DATA = {
    metrics: [
      { label: "Events / min", value: "18,420", change: "+8.2%",   direction: "up" },
      { label: "P95 latency",  value: "184 ms",  change: "−12 ms",  direction: "down" },
      { label: "Error rate",   value: "0.37%",   change: "+0.08 pp", direction: "up" },
      { label: "Queue depth",  value: "2,841",   change: "−19%",   direction: "down" },
    ],
    throughput: [31,28,24,22,20,23,34,48,62,71,76,73,68,72,80,84,79,75,82,88,77,63,52,41],
    incidents: [
      { id: "INC-2841", severity: "critical", service: "payments-api", age: "12m",     owner: "M. Chen",    status: "investigating", title: "Card authorization timeouts" },
      { id: "INC-2839", severity: "high",     service: "event-router", age: "31m",     owner: "Unassigned", status: "open",          title: "EU retry queue growth" },
      { id: "INC-2837", severity: "medium",   service: "search-index", age: "1h 08m",  owner: "A. Silva",    status: "monitoring",    title: "Index freshness outside SLO" },
      { id: "INC-2832", severity: "low",      service: "webhooks",     age: "3h 42m",  owner: "R. Patel",    status: "open",          title: "Elevated partner delivery lag" },
    ],
  };

  // ---------- Clock --------------------------------------------------------

  function startClock() {
    const el = $("[data-clock]");
    if (!el) return;
    const fmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false, timeZone: "UTC",
    });
    const tick = () => {
      const now = new Date();
      el.textContent = `${fmt.format(now)} UTC`;
    };
    tick();
    setInterval(tick, 1000);
  }

  // ---------- Global keys (accessibility) ----------------------------------

  function bindGlobalKeys() {
    document.addEventListener("keydown", (e) => {
      // Slash focuses the search field, like many operator consoles.
      if (e.key === "/" && !isTypingTarget(e.target)) {
        const search = $("[data-search]");
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
        }
      }
      // Escape clears search & selection.
      if (e.key === "Escape") {
        const search = $("[data-search]");
        if (search && document.activeElement === search) {
          search.value = "";
          state.filter.q = "";
          applyFilters();
          search.blur();
        }
      }
    });
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
  }

  // ---------- Render: top level --------------------------------------------

  function render() {
    renderMetrics();
    renderChart();
    renderTable();
    bindFilters();
    bindChartTabs();
    // Pre-select the first incident so the detail panel is never empty on load.
    if (!state.selectedId && state.incidents.length) {
      state.selectedId = state.incidents[0].id;
    }
    renderDetail();
  }

  // ---------- Render: metrics ----------------------------------------------

  function renderMetrics() {
    const cards = $$("[data-metric]");
    cards.forEach((card, i) => {
      const m = state.metrics[i];
      if (!m) return;
      card.dataset.direction = m.direction || "";
      $("[data-metric-value]", card).textContent = m.value;
      const delta = $("[data-metric-delta]", card);
      delta.textContent = m.change;
      delta.classList.remove("metric__delta--up", "metric__delta--down");
      if (m.direction === "up")   delta.classList.add("metric__delta--up");
      if (m.direction === "down") delta.classList.add("metric__delta--down");
    });
  }

  // ---------- Render: throughput chart (inline SVG) ------------------------

  function renderChart() {
    const host = $("[data-chart]");
    if (!host) return;

    const series = state.throughput.slice();
    const max = Math.max(1, ...series);
    const W = 1000;        // viewBox width — scales fluidly with container
    const H = 160;         // chart inner height (excludes top padding)
    const padX = 8;
    const padTop = 12;
    const padBottom = 18;
    const innerW = W - padX * 2;
    const innerH = H - padTop - padBottom;
    const stepX = series.length > 1 ? innerW / (series.length - 1) : innerW;

    // Y ticks (subtle gridlines, no labels to keep density)
    const yTicks = 4;
    let gridLines = "";
    for (let i = 0; i <= yTicks; i++) {
      const y = padTop + (innerH * i) / yTicks;
      gridLines += `<line class="grid-line" x1="${padX}" x2="${W - padX}" y1="${y}" y2="${y}"/>`;
    }

    // Build path
    const pts = series.map((v, i) => {
      const x = padX + i * stepX;
      const y = padTop + innerH - (v / max) * innerH;
      return [x, y];
    });

    const linePath = pts.map((p, i) => (i === 0 ? `M${p[0]} ${p[1]}` : `L${p[0]} ${p[1]}`)).join(" ");
    const areaPath = `${linePath} L${pts[pts.length - 1][0]} ${padTop + innerH} L${pts[0][0]} ${padTop + innerH} Z`;

    // Highlight max value
    const maxIdx = series.indexOf(max);
    const peak = pts[maxIdx];

    // X labels every 6 hours (24 / 4 = 6 buckets apart)
    const xLabels = [0, 6, 12, 18, 23].map((idx) => {
      const x = padX + idx * stepX;
      const label = String(idx).padStart(2, "0") + ":00";
      return `<text class="x-tick" x="${x}" y="${H - 4}" text-anchor="middle">${label}</text>`;
    }).join("");

    const yMaxLabel = `<text class="y-tick" x="${W - padX}" y="${padTop - 1}" text-anchor="end">${max.toLocaleString()}/m</text>`;
    const yZeroLabel = `<text class="y-tick" x="${W - padX}" y="${padTop + innerH + 9}" text-anchor="end">0/m</text>`;

    // Accessible summary
    const total = series.reduce((a, b) => a + b, 0);
    const avg = series.length ? Math.round(total / series.length) : 0;
    const summary = `Throughput over the last 24 hours. Peak ${max.toLocaleString()} events per minute, average ${avg.toLocaleString()}.`;

    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${summary}">
        <defs>
          <linearGradient id="relay-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="rgba(93,214,193,0.35)"/>
            <stop offset="100%" stop-color="rgba(93,214,193,0.00)"/>
          </linearGradient>
        </defs>
        ${gridLines}
        <path class="area" d="${areaPath}"/>
        <path class="line" d="${linePath}"/>
        <circle class="dot-ring" cx="${peak[0]}" cy="${peak[1]}" r="5"/>
        <circle class="dot" cx="${peak[0]}" cy="${peak[1]}" r="2.4"/>
        ${xLabels}
        ${yMaxLabel}
        ${yZeroLabel}
      </svg>
    `;
  }

  function bindChartTabs() {
    const tabs = $$(".seg__btn");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        if (tab.getAttribute("aria-selected") === "true") return;
        tabs.forEach((t) => {
          t.classList.remove("seg__btn--active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("seg__btn--active");
        tab.setAttribute("aria-selected", "true");
        state.range = tab.dataset.range;
        // No new data available in DATA.json — re-render the chart unchanged.
        renderChart();
      });
    });
  }

  // ---------- Render: incident table + filters -----------------------------

  function bindFilters() {
    // Search
    const search = $("[data-search]");
    if (search && !search.dataset.bound) {
      search.dataset.bound = "1";
      search.addEventListener("input", (e) => {
        state.filter.q = e.target.value.trim().toLowerCase();
        applyFilters();
      });
    }

    // Severity chips
    const chips = $$(".chip");
    chips.forEach((chip) => {
      if (chip.dataset.bound) return;
      chip.dataset.bound = "1";
      chip.addEventListener("click", () => {
        if (chip.classList.contains("chip--active")) return;
        $$(".chip").forEach((c) => {
          c.classList.remove("chip--active");
        });
        chip.classList.add("chip--active");
        state.filter.severity = chip.dataset.sev;
        applyFilters();
      });
    });

    // Clear button (in empty state)
    const clear = $("[data-clear]");
    if (clear && !clear.dataset.bound) {
      clear.dataset.bound = "1";
      clear.addEventListener("click", () => {
        state.filter = { severity: "all", q: "" };
        if (search) search.value = "";
        $$(".chip").forEach((c) => c.classList.toggle("chip--active", c.dataset.sev === "all"));
        applyFilters();
      });
    }
  }

  function applyFilters() {
    const sev = state.filter.severity;
    const q = state.filter.q;
    const rows = $$("[data-tbody] tr");
    let visible = 0;
    rows.forEach((row) => {
      const rowSev = row.dataset.sev;
      const hay = (row.dataset.search || "").toLowerCase();
      const matchesSev = sev === "all" || rowSev === sev;
      const matchesQ = !q || hay.includes(q);
      const show = matchesSev && matchesQ;
      row.hidden = !show;
      if (show) visible++;
    });
    const empty = $("[data-empty]");
    if (empty) empty.hidden = visible !== 0;

    // Update count badge to reflect filtered count
    const badge = $("[data-inc-count]");
    if (badge) badge.textContent = String(visible);

    // If the selected incident got filtered out, clear selection.
    if (state.selectedId) {
      const sel = $(`[data-tbody] tr[data-id="${cssEscape(state.selectedId)}"]`);
      if (sel && sel.hidden) {
        state.selectedId = null;
        renderDetail();
      }
    }
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
  }

  function renderTable() {
    const tbody = $("[data-tbody]");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!state.incidents.length) {
      const empty = $("[data-empty]");
      if (empty) empty.hidden = false;
      const badge = $("[data-inc-count]");
      if (badge) badge.textContent = "0";
      return;
    }

    const fragments = state.incidents.map((inc) => rowHtml(inc)).join("");
    tbody.innerHTML = fragments;

    // Bind row clicks + keyboard
    $$("[data-tbody] tr").forEach((row) => {
      row.tabIndex = 0;
      row.addEventListener("click", () => selectIncident(row.dataset.id));
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectIncident(row.dataset.id);
        }
      });
    });

    // Count badge reflects total before filters
    const badge = $("[data-inc-count]");
    if (badge) badge.textContent = String(state.incidents.length);
  }

  function rowHtml(inc) {
    const isAck = state.acknowledgedIds.has(inc.id);
    const status = isAck ? "acknowledged" : inc.status;
    const statusPill = statusPillHtml(status);
    const hay = [inc.id, inc.title, inc.service, inc.owner, inc.severity, inc.status]
      .join(" ").toLowerCase();
    const selected = state.selectedId === inc.id ? " is-selected" : "";
    return `
      <tr class="${selected.trim()}" data-id="${inc.id}" data-sev="${inc.severity}" data-search="${escapeAttr(hay)}">
        <td class="col-sev" data-label="Severity">
          <span class="sev-pill sev-pill--${inc.severity}">${inc.severity}</span>
        </td>
        <td class="col-id" data-label="ID"><span class="id">${inc.id}</span></td>
        <td class="col-title" data-label="Incident"><span class="title-cell">${escapeHtml(inc.title)}</span></td>
        <td class="col-svc" data-label="Service"><span class="svc">${escapeHtml(inc.service)}</span></td>
        <td class="col-age num" data-label="Age">${escapeHtml(inc.age)}</td>
        <td class="col-owner" data-label="Owner">${escapeHtml(inc.owner)}</td>
        <td class="col-status" data-label="Status">${statusPill}</td>
      </tr>
    `;
  }

  function statusPillHtml(status) {
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return `<span class="status-pill status-pill--${status}">${label}</span>`;
  }

  function selectIncident(id) {
    state.selectedId = id;
    $$("[data-tbody] tr").forEach((row) => {
      row.classList.toggle("is-selected", row.dataset.id === id);
    });
    renderDetail();
  }

  // ---------- Render: detail panel ----------------------------------------

  function renderDetail() {
    const placeholder = $("[data-detail-placeholder]");
    const body = $("[data-detail-body]");
    if (!placeholder || !body) return;

    const inc = state.incidents.find((i) => i.id === state.selectedId);
    if (!inc) {
      placeholder.hidden = false;
      body.hidden = true;
      return;
    }

    placeholder.hidden = true;
    body.hidden = false;

    $("[data-detail-id]").textContent = inc.id;
    const sevDot = $("[data-detail-sev]");
    sevDot.className = `sev-dot sev-dot--${inc.severity}`;
    $("[data-detail-title]").textContent = inc.title;
    $("[data-detail-service]").textContent = inc.service;
    $("[data-detail-age]").textContent = inc.age;
    $("[data-detail-owner]").textContent = inc.owner;

    const isAck = state.acknowledgedIds.has(inc.id);
    const status = isAck ? "acknowledged" : inc.status;
    $("[data-detail-status]").innerHTML = statusPillHtml(status);

    const ackBtn = $("[data-acknowledge]");
    if (ackBtn) {
      ackBtn.disabled = isAck;
      ackBtn.innerHTML = isAck
        ? `<span class="btn__dot" aria-hidden="true"></span> Acknowledged`
        : `<span class="btn__dot" aria-hidden="true"></span> Acknowledge`;
    }
    const msg = $("[data-ack-msg]");
    if (msg) msg.textContent = "";
  }

  // ---------- Acknowledge --------------------------------------------------

  function bindAcknowledge() {
    const ack = $("[data-acknowledge]");
    if (!ack || ack.dataset.bound) return;
    ack.dataset.bound = "1";
    ack.addEventListener("click", () => {
      if (!state.selectedId) return;
      const wasAck = state.acknowledgedIds.has(state.selectedId);
      if (wasAck) return;
      state.acknowledgedIds.add(state.selectedId);
      // Update table row's status pill in place
      const row = $(`[data-tbody] tr[data-id="${cssEscape(state.selectedId)}"]`);
      if (row) {
        const cell = row.querySelector(".col-status");
        if (cell) cell.innerHTML = statusPillHtml("acknowledged");
      }
      renderDetail();
      const msg = $("[data-ack-msg]");
      const inc = state.incidents.find((i) => i.id === state.selectedId);
      if (msg && inc) {
        msg.textContent = `Acknowledged by Mira Okafor · ${new Date().toLocaleTimeString("en-GB", { hour12: false })}`;
      }
    });
  }

  // ---------- Tiny utilities ----------------------------------------------

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---------- Init bindings after first render -----------------------------

  // bindAcknowledge must run after the detail panel exists in the DOM (always true).
  // We use a microtask to ensure DOMContentLoaded listeners on the same page run first.
  Promise.resolve().then(() => {
    bindAcknowledge();
  });
})();