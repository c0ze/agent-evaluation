/* Relay — operations dashboard logic
   Seeded from DATA.json (embedded at build time; no network). */

const DATA = {
  "metrics": [
    {"label":"Events / min","value":"18,420","change":"+8.2%","direction":"up"},
    {"label":"P95 latency","value":"184 ms","change":"−12 ms","direction":"down"},
    {"label":"Error rate","value":"0.37%","change":"+0.08 pp","direction":"up"},
    {"label":"Queue depth","value":"2,841","change":"−19%","direction":"down"}
  ],
  "throughput": [31,28,24,22,20,23,34,48,62,71,76,73,68,72,80,84,79,75,82,88,77,63,52,41],
  "incidents": [
    {"id":"INC-2841","severity":"critical","service":"payments-api","age":"12m","owner":"M. Chen","status":"investigating","title":"Card authorization timeouts"},
    {"id":"INC-2839","severity":"high","service":"event-router","age":"31m","owner":"Unassigned","status":"open","title":"EU retry queue growth"},
    {"id":"INC-2837","severity":"medium","service":"search-index","age":"1h 08m","owner":"A. Silva","status":"monitoring","title":"Index freshness outside SLO"},
    {"id":"INC-2832","severity":"low","service":"webhooks","age":"3h 42m","owner":"R. Patel","status":"open","title":"Elevated partner delivery lag"}
  ]
};

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const OPERATOR = "J. Okonkwo";

const state = {
  incidents: DATA.incidents.map((inc) => ({ ...inc, acknowledgedAt: null })),
  selectedId: null,
  filters: { severity: "all", status: "all", service: "all", query: "" },
};

const el = {
  body: document.getElementById("incident-body"),
  table: document.getElementById("incident-table"),
  tableMeta: document.getElementById("table-meta"),
  empty: document.getElementById("empty-state"),
  detailBody: document.getElementById("detail-body"),
  detailPanel: document.getElementById("detail"),
  chart: document.getElementById("throughput-chart"),
  chartX: document.getElementById("chart-x"),
  filterSeverity: document.getElementById("filter-severity"),
  filterStatus: document.getElementById("filter-status"),
  filterService: document.getElementById("filter-service"),
  filterQuery: document.getElementById("filter-query"),
  filterReset: document.getElementById("filter-reset"),
  emptyReset: document.getElementById("empty-reset"),
  toast: document.getElementById("toast"),
  clock: document.getElementById("clock"),
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function titleCase(value) {
  return value
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function severityBadge(severity) {
  return `<span class="sev" data-sev="${esc(severity)}"><span class="sev-dot" aria-hidden="true"></span>${esc(severity)}</span>`;
}

function statusTag(status) {
  return `<span class="status-tag" data-status="${esc(status)}">${esc(status)}</span>`;
}

function ownerCell(owner) {
  if (!owner || owner === "Unassigned") {
    return `<span class="owner-unassigned">Unassigned</span>`;
  }
  return esc(owner);
}

function getFiltered() {
  const { severity, status, service, query } = state.filters;
  const q = query.trim().toLowerCase();

  return state.incidents
    .filter((inc) => severity === "all" || inc.severity === severity)
    .filter((inc) => status === "all" || inc.status === status)
    .filter((inc) => service === "all" || inc.service === service)
    .filter((inc) => {
      if (!q) return true;
      return [inc.id, inc.title, inc.owner, inc.service, inc.status, inc.severity]
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => {
      const sev = SEV_RANK[a.severity] - SEV_RANK[b.severity];
      if (sev !== 0) return sev;
      return a.id.localeCompare(b.id);
    });
}

function renderServiceOptions() {
  const services = [...new Set(state.incidents.map((inc) => inc.service))].sort();
  const current = state.filters.service;
  el.filterService.innerHTML =
    `<option value="all">All</option>` +
    services.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  el.filterService.value = services.includes(current) ? current : "all";
  state.filters.service = el.filterService.value;
}

function renderTable() {
  const rows = getFiltered();
  const total = state.incidents.length;

  el.tableMeta.textContent =
    rows.length === total
      ? `Showing ${rows.length} of ${total} incidents`
      : `Showing ${rows.length} of ${total} incidents · filtered`;

  if (rows.length === 0) {
    el.body.innerHTML = "";
    el.table.hidden = true;
    el.empty.hidden = false;
    return;
  }

  el.table.hidden = false;
  el.empty.hidden = true;

  el.body.innerHTML = rows
    .map((inc) => {
      const selected = inc.id === state.selectedId ? " is-selected" : "";
      return `
      <tr class="incident-row${selected}" data-id="${esc(inc.id)}" tabindex="0" role="button" aria-pressed="${inc.id === state.selectedId}" aria-label="${esc(inc.severity)} incident ${esc(inc.id)}: ${esc(inc.title)}">
        <td data-label="Sev">${severityBadge(inc.severity)}</td>
        <td data-label="ID">${esc(inc.id)}</td>
        <td class="title-cell" data-label="Title">${esc(inc.title)}</td>
        <td data-label="Service">${esc(inc.service)}</td>
        <td data-label="Age">${esc(inc.age)}</td>
        <td data-label="Owner">${ownerCell(inc.owner)}</td>
        <td data-label="Status">${statusTag(inc.status)}</td>
      </tr>`;
    })
    .join("");
}

function renderDetail() {
  const inc = state.incidents.find((i) => i.id === state.selectedId);

  if (!inc) {
    el.detailBody.innerHTML = `<p class="detail-placeholder">Select an incident from the table to inspect details and acknowledge.</p>`;
    return;
  }

  const acked = inc.status === "acknowledged";
  const ackLabel = acked
    ? "Acknowledged"
    : "Acknowledge";
  const ackClass = acked ? "btn btn-primary is-acked" : "btn btn-primary";

  el.detailBody.innerHTML = `
    <div class="detail-head">
      <div>
        <h3 class="detail-title">${esc(inc.title)}</h3>
        <div class="detail-ids">
          ${severityBadge(inc.severity)}
          <span>${esc(inc.id)}</span>
          ${statusTag(inc.status)}
        </div>
      </div>
      <div class="detail-actions">
        <button type="button" class="${ackClass}" id="btn-ack" data-id="${esc(inc.id)}" ${acked ? "disabled" : ""}>${ackLabel}</button>
      </div>
    </div>
    <dl class="detail-kv">
      <div><dt>Service</dt><dd>${esc(inc.service)}</dd></div>
      <div><dt>Age</dt><dd>${esc(inc.age)}</dd></div>
      <div><dt>Owner</dt><dd>${inc.owner === "Unassigned" ? '<span class="owner-unassigned">Unassigned</span>' : esc(inc.owner)}</dd></div>
      <div><dt>Status</dt><dd>${esc(inc.status)}</dd></div>
    </dl>
    <p class="detail-note">${detailNote(inc)}</p>
    ${acked ? `<p class="detail-ack-banner">Acknowledged by ${esc(OPERATOR)}${inc.acknowledgedAt ? ` at ${esc(inc.acknowledgedAt)}` : ""}. Ownership recorded; follow-up remains required.</p>` : ""}
  `;
}

function detailNote(inc) {
  const notes = {
    "INC-2841":
      "Authorization attempts to the card network are exceeding the 2 s client timeout on the EU path. Retry budget is nearly exhausted. Mitigation: shift traffic to the secondary acquirer and confirm issuer-side latency.",
    "INC-2839":
      "Retry queue depth in eu-west-1 is growing past the 5k watermark. Downstream consumers are healthy; drain rate is below ingest rate. Mitigation: scale consumers and temporarily shed non-critical retry classes.",
    "INC-2837":
      "Search index freshness is at 14 minutes against a 10 minute SLO. Ingest pipeline is lagging after a shard rebalance. Mitigation: verify primary assignment and increase flush frequency.",
    "INC-2832":
      "Partner webhook delivery lag is elevated for three high-volume endpoints. No message loss observed. Mitigation: confirm partner rate limits and enable backoff on 429 responses.",
  };
  return notes[inc.id] || "No runbook note attached. Collect signals from the service dashboard and assign an owner.";
}

function selectIncident(id) {
  state.selectedId = id;
  renderTable();
  renderDetail();
}

function acknowledge(id) {
  const inc = state.incidents.find((i) => i.id === id);
  if (!inc || inc.status === "acknowledged") return;

  inc.status = "acknowledged";
  if (!inc.owner || inc.owner === "Unassigned") {
    inc.owner = OPERATOR;
  }
  inc.acknowledgedAt = formatTime(new Date());

  renderTable();
  renderDetail();
  showToast(`${inc.id} acknowledged · owner ${inc.owner}`);
}

function showToast(message) {
  el.toast.hidden = false;
  el.toast.textContent = message;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    el.toast.hidden = true;
  }, 3200);
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function tickClock() {
  el.clock.textContent = formatTime(new Date());
}

/* 24h throughput chart — inline SVG, semantic title/desc */
function renderChart() {
  const values = DATA.throughput;
  const n = values.length;
  const w = 720;
  const h = 180;
  const padX = 8;
  const padY = 14;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const xAt = (i) => padX + (i * (w - padX * 2)) / (n - 1);
  const yAt = (v) => padY + (1 - (v - min) / span) * (h - padY * 2);

  const points = values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`);
  const line = `M ${points.join(" L ")}`;
  const area = `${line} L ${xAt(n - 1).toFixed(1)},${h - padY} L ${xAt(0).toFixed(1)},${h - padY} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((t) => {
      const y = padY + t * (h - padY * 2);
      return `<line x1="${padX}" y1="${y.toFixed(1)}" x2="${w - padX}" y2="${y.toFixed(1)}" stroke="#252b31" stroke-width="1" />`;
    })
    .join("");

  const peakIdx = values.indexOf(max);
  const peakDot = `<circle cx="${xAt(peakIdx).toFixed(1)}" cy="${yAt(max).toFixed(1)}" r="3" fill="#3d8bfd" />`;
  const peakLabel = `<text x="${Math.min(xAt(peakIdx) + 6, w - 40).toFixed(1)}" y="${Math.max(yAt(max) - 6, 12).toFixed(1)}" fill="#8b949d" font-size="10" font-family="ui-monospace, Menlo, Consolas, monospace">${max}k</text>`;

  const hourLabels = values.map((_, i) => {
    if (i % 3 !== 0) return "";
    return `<text x="${xAt(i).toFixed(1)}" y="${h - 2}" fill="#5c666f" font-size="9" text-anchor="middle" font-family="ui-monospace, Menlo, Consolas, monospace">${String(i).padStart(2, "0")}</text>`;
  }).join("");

  const desc = `Hourly throughput (thousands of events) over 24 hours. Values from ${min}k at hour ${values.indexOf(min)} to ${max}k at hour ${peakIdx}.`;

  el.chart.innerHTML = `
    <title id="chart-title">Throughput over 24 hours</title>
    <desc id="chart-desc">${esc(desc)}</desc>
    ${gridLines}
    <path d="${area}" fill="#3d8bfd" fill-opacity="0.10" />
    <path d="${line}" fill="none" stroke="#3d8bfd" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    ${peakDot}
    ${peakLabel}
    ${hourLabels}
  `;

  el.chartX.innerHTML = ["00", "03", "06", "09", "12", "15", "18", "21"]
    .map((label) => `<span>${label}</span>`)
    .join("");
}

function resetFilters() {
  state.filters = { severity: "all", status: "all", service: "all", query: "" };
  el.filterSeverity.value = "all";
  el.filterStatus.value = "all";
  el.filterService.value = "all";
  el.filterQuery.value = "";
  renderTable();
}

function bindEvents() {
  el.filterSeverity.addEventListener("change", () => {
    state.filters.severity = el.filterSeverity.value;
    renderTable();
  });
  el.filterStatus.addEventListener("change", () => {
    state.filters.status = el.filterStatus.value;
    renderTable();
  });
  el.filterService.addEventListener("change", () => {
    state.filters.service = el.filterService.value;
    renderTable();
  });
  el.filterQuery.addEventListener("input", () => {
    state.filters.query = el.filterQuery.value;
    renderTable();
  });
  el.filterReset.addEventListener("click", resetFilters);
  el.emptyReset.addEventListener("click", () => {
    resetFilters();
    el.filterQuery.focus();
  });

  el.body.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    selectIncident(row.dataset.id);
  });

  el.body.addEventListener("keydown", (e) => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectIncident(row.dataset.id);
      el.detailPanel.focus();
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const rows = [...el.body.querySelectorAll("tr[data-id]")];
      const idx = rows.indexOf(row);
      const next = e.key === "ArrowDown" ? rows[idx + 1] : rows[idx - 1];
      if (next) next.focus();
    }
  });

  el.detailBody.addEventListener("click", (e) => {
    const btn = e.target.closest("#btn-ack");
    if (!btn) return;
    acknowledge(btn.dataset.id);
  });
}

function init() {
  renderServiceOptions();
  renderChart();
  renderTable();
  renderDetail();
  bindEvents();
  tickClock();
  setInterval(tickClock, 1000);
}

init();
