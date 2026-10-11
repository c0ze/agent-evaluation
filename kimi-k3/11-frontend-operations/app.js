/* Relay — operations control room
   All content is seeded locally from DATA.json (embedded below so the page
   works with zero network requests, including from file://). */
"use strict";

/* ------------------------------------------------------------------ data */

const DATA = {
  metrics: [
    { label: "Events / min", value: "18,420", change: "+8.2%",   direction: "up"   },
    { label: "P95 latency",  value: "184 ms", change: "−12 ms",  direction: "down" },
    { label: "Error rate",   value: "0.37%",  change: "+0.08 pp",direction: "up"   },
    { label: "Queue depth",  value: "2,841",  change: "−19%",    direction: "down" }
  ],
  throughput: [31,28,24,22,20,23,34,48,62,71,76,73,68,72,80,84,79,75,82,88,77,63,52,41],
  incidents: [
    { id: "INC-2841", severity: "critical", service: "payments-api", age: "12m",     owner: "M. Chen",    status: "investigating", title: "Card authorization timeouts" },
    { id: "INC-2839", severity: "high",     service: "event-router", age: "31m",     owner: "Unassigned", status: "open",          title: "EU retry queue growth" },
    { id: "INC-2837", severity: "medium",   service: "search-index", age: "1h 08m",  owner: "A. Silva",   status: "monitoring",    title: "Index freshness outside SLO" },
    { id: "INC-2832", severity: "low",      service: "webhooks",     age: "3h 42m",  owner: "R. Patel",   status: "open",          title: "Elevated partner delivery lag" }
  ]
};

/* Direction that counts as an improvement for each metric label. */
const METRIC_GOOD_WHEN = {
  "Events / min": "up",
  "P95 latency":  "down",
  "Error rate":   "down",
  "Queue depth":  "down"
};

/* Supplementary detail content keyed by incident id. */
const INCIDENT_DETAIL = {
  "INC-2841": {
    started: "13:52 UTC", region: "us-east-1",
    impact: "≈ 4.1% of card authorizations timing out at the PSP edge.",
    summary: "Upstream processor latency spike is pushing authorization round trips past the 3 s client deadline. Circuit breaker is holding at 40% open; fallback processor is warming.",
    timeline: [
      { t: "13:52", text: "Alert fired: auth timeout rate > 2% for 5m" },
      { t: "13:54", text: "Paged primary on-call (M. Chen)" },
      { t: "14:01", text: "Fallback processor failover initiated" }
    ]
  },
  "INC-2839": {
    started: "13:33 UTC", region: "eu-west-1",
    impact: "EU retry queue growing ~1.2k msgs/min; no consumer errors yet.",
    summary: "A slow downstream sink in eu-west-1 is causing retries to accumulate. Consumers remain healthy; risk is memory pressure on the router nodes if growth continues past 90 minutes.",
    timeline: [
      { t: "13:33", text: "Alert fired: retry queue depth rising for 10m" },
      { t: "13:40", text: "Awaiting owner — paging secondary" }
    ]
  },
  "INC-2837": {
    started: "12:56 UTC", region: "us-east-1",
    impact: "Search results up to 9 minutes stale vs. 5-minute SLO.",
    summary: "Indexer fell behind after a bulk re-import. Lag is shrinking steadily since the import finished; monitoring until freshness returns inside SLO.",
    timeline: [
      { t: "12:56", text: "Alert fired: freshness SLO breach" },
      { t: "13:10", text: "Bulk re-import throttled by A. Silva" },
      { t: "13:48", text: "Lag trending down, moved to monitoring" }
    ]
  },
  "INC-2832": {
    started: "10:22 UTC", region: "global",
    impact: "p95 partner webhook delivery lag at 48 s (target < 30 s).",
    summary: "One partner endpoint is responding slowly, backing up the shared delivery pool. Per-partner concurrency cap applied; lag recovering gradually.",
    timeline: [
      { t: "10:22", text: "Alert fired: delivery lag above threshold" },
      { t: "10:45", text: "Concurrency cap applied by R. Patel" }
    ]
  }
};

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

/* ------------------------------------------------------------------ state */

const state = {
  query: "",
  severity: "all",
  status: "all",
  selectedId: null,
  incidents: DATA.incidents.map(i => ({ ...i }))
};

/* ---------------------------------------------------------------- helpers */

const $ = sel => document.querySelector(sel);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function ageToMinutes(age) {
  const h = age.match(/(\d+)\s*h/);
  const m = age.match(/(\d+)\s*m(?!s)/);
  return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0);
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ------------------------------------------------------------ top status */

function updateClock() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  $("#clock").textContent = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
}

function updateActivePill() {
  const active = state.incidents.filter(i =>
    i.status !== "acknowledged" && i.status !== "resolved").length;
  const pill = $("#activePill");
  pill.textContent = active === 0 ? "All clear" : `${active} active`;
  pill.classList.toggle("is-clear", active === 0);
}

/* ---------------------------------------------------------------- metrics */

function renderMetrics() {
  $("#metrics").innerHTML = DATA.metrics.map(m => {
    const good = METRIC_GOOD_WHEN[m.label] === m.direction;
    const arrow = m.direction === "up" ? "▲" : "▼";
    return `
      <div class="metric">
        <div class="metric-label">${escapeHtml(m.label)}</div>
        <div class="metric-value">${escapeHtml(m.value)}</div>
        <div class="metric-foot">
          <span class="metric-change ${good ? "good" : "bad"}">${arrow} ${escapeHtml(m.change)}</span>
          <span class="metric-context">vs previous hour</span>
        </div>
      </div>`;
  }).join("");
}

/* ------------------------------------------------------------------ chart */

const chartCanvas = $("#chart");
const chartTip = $("#chartTip");
let chartBars = [];

function drawChart(hoverIdx = -1) {
  const values = DATA.throughput;
  const dpr = window.devicePixelRatio || 1;
  const w = chartCanvas.clientWidth;
  const h = chartCanvas.clientHeight;
  if (w === 0 || h === 0) return;

  chartCanvas.width = Math.round(w * dpr);
  chartCanvas.height = Math.round(h * dpr);
  const ctx = chartCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const padL = 34, padR = 6, padT = 8, padB = 20;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxV = Math.ceil(Math.max(...values) / 20) * 20; // nice ceiling, e.g. 100
  const peakIdx = values.indexOf(Math.max(...values));

  const border = getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#262c35";
  const mute = getComputedStyle(document.documentElement).getPropertyValue("--text-mute").trim() || "#5f6875";
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#5b9dff";

  // Gridlines + y labels
  ctx.font = "10px " + (getComputedStyle(document.body).getPropertyValue("--mono") || "monospace");
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let g = 0; g <= 4; g++) {
    const v = (maxV / 4) * g;
    const y = padT + plotH - (v / maxV) * plotH;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y + 0.5);
    ctx.lineTo(w - padR, y + 0.5);
    ctx.stroke();
    ctx.fillStyle = mute;
    ctx.fillText(String(v), padL - 6, y);
  }

  // Bars
  chartBars = [];
  const gap = Math.max(2, plotW / values.length * 0.28);
  const barW = plotW / values.length - gap;
  for (let i = 0; i < values.length; i++) {
    const x = padL + i * (plotW / values.length) + gap / 2;
    const bh = Math.max(1, (values[i] / maxV) * plotH);
    const y = padT + plotH - bh;
    chartBars.push({ x, y, w: barW, h: bh, v: values[i], hour: i });

    if (i === hoverIdx) ctx.fillStyle = accent;
    else if (i === peakIdx) ctx.fillStyle = accent;
    else ctx.fillStyle = "rgba(91, 157, 255, 0.38)";
    ctx.fillRect(x, y, barW, bh);
  }

  // X labels every 6 hours (edge labels aligned inward to avoid clipping)
  ctx.fillStyle = mute;
  ctx.textBaseline = "top";
  [0, 6, 12, 18, 23].forEach(hour => {
    const b = chartBars[hour];
    let tx = b.x + b.w / 2;
    if (hour === 0) { ctx.textAlign = "left"; tx = b.x; }
    else if (hour === 23) { ctx.textAlign = "right"; tx = b.x + b.w; }
    else ctx.textAlign = "center";
    ctx.fillText(String(hour).padStart(2, "0") + ":00", tx, padT + plotH + 6);
  });
}

function renderChartStats() {
  const values = DATA.throughput;
  const peak = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  $("#chartPeak").textContent = peak + "k";
  $("#chartAvg").textContent = avg.toFixed(1) + "k";
}

function setupChartInteractions() {
  const wrap = $("#chartWrap");

  wrap.addEventListener("mousemove", e => {
    const rect = chartCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const bar = chartBars.find(b => mx >= b.x - 2 && mx <= b.x + b.w + 2);
    if (bar) {
      drawChart(bar.hour);
      chartTip.hidden = false;
      chartTip.textContent =
        String(bar.hour).padStart(2, "0") + ":00 — " + bar.v + "k events";
      const wrapRect = wrap.getBoundingClientRect();
      const left = Math.min(Math.max(bar.x + bar.w / 2, 44), wrapRect.width - 44);
      chartTip.style.left = left + "px";
      chartTip.style.top = Math.max(bar.y - 6, 22) + "px";
    } else {
      chartTip.hidden = true;
      drawChart(-1);
    }
  });

  wrap.addEventListener("mouseleave", () => {
    chartTip.hidden = true;
    drawChart(-1);
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => drawChart(-1)).observe(wrap);
  } else {
    window.addEventListener("resize", () => drawChart(-1));
  }
}

/* --------------------------------------------------------------- incidents */

function filteredIncidents() {
  const q = state.query.trim().toLowerCase();
  return state.incidents
    .filter(i => state.severity === "all" || i.severity === state.severity)
    .filter(i => state.status === "all" || i.status === state.status)
    .filter(i => !q || [i.id, i.title, i.service, i.owner].join(" ").toLowerCase().includes(q))
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || ageToMinutes(b.age) - ageToMinutes(a.age));
}

function renderTable() {
  const rows = filteredIncidents();
  const total = state.incidents.length;

  $("#resultCount").textContent =
    rows.length === total ? `${total} incidents, sorted by severity`
                          : `${rows.length} of ${total} incidents`;

  $("#tbody").innerHTML = rows.map(i => `
    <tr class="incident-row ${i.id === state.selectedId ? "is-selected" : ""}"
        tabindex="0" data-id="${escapeHtml(i.id)}"
        aria-selected="${i.id === state.selectedId}"
        aria-label="${escapeHtml(i.id)} ${escapeHtml(i.title)}, ${i.severity}, ${i.status}">
      <td><span class="sev sev-${i.severity}"><span class="dot" aria-hidden="true"></span><span class="sev-name">${capitalize(i.severity)}</span></span></td>
      <td><span class="inc-id">${escapeHtml(i.id)}</span><span class="inc-title">${escapeHtml(i.title)}</span></td>
      <td class="hide-sm cell-dim">${escapeHtml(i.service)}</td>
      <td class="num">${escapeHtml(i.age)}</td>
      <td class="hide-md cell-dim">${escapeHtml(i.owner)}</td>
      <td><span class="status-pill status-${i.status}">${capitalize(i.status)}</span></td>
    </tr>`).join("");

  $("#emptyState").hidden = rows.length > 0;
  $(".incident-table").style.display = rows.length > 0 ? "" : "none";
}

function selectIncident(id, focusRow) {
  state.selectedId = id;
  renderTable();
  renderDetail();
  if (focusRow) {
    const row = $("#tbody").querySelector(`tr[data-id="${CSS.escape(id)}"]`);
    if (row) row.focus();
  }
}

/* ------------------------------------------------------------- detail pane */

function renderDetail() {
  const panel = $("#detailPanel");
  const inc = state.incidents.find(i => i.id === state.selectedId);

  if (!inc) {
    panel.innerHTML = `
      <div class="detail-empty">
        <p class="empty-title">No incident selected</p>
        <p class="empty-sub">Select a row in the table (click, or Tab to a row and press Enter) to inspect it here.</p>
      </div>`;
    return;
  }

  const d = INCIDENT_DETAIL[inc.id] || {};
  const acknowledged = inc.status === "acknowledged" || inc.status === "resolved";
  const timeline = [...(d.timeline || [])];
  if (inc.acknowledgedAt) {
    timeline.push({ t: inc.acknowledgedAt, text: "Acknowledged by operator (you)", now: true });
  }

  panel.innerHTML = `
    <div class="detail-head">
      <span class="sev sev-${inc.severity}"><span class="dot" aria-hidden="true"></span>${capitalize(inc.severity)}</span>
      <span class="detail-id">${escapeHtml(inc.id)}</span>
    </div>
    <h2 class="detail-title" id="detailTitle">${escapeHtml(inc.title)}</h2>

    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">Service</span><span class="meta-value mono">${escapeHtml(inc.service)}</span></div>
      <div class="meta-item"><span class="meta-label">Status</span><span class="meta-value"><span class="status-pill status-${inc.status}">${capitalize(inc.status)}</span></span></div>
      <div class="meta-item"><span class="meta-label">Owner</span><span class="meta-value">${escapeHtml(inc.owner)}</span></div>
      <div class="meta-item"><span class="meta-label">Age</span><span class="meta-value mono">${escapeHtml(inc.age)}</span></div>
      <div class="meta-item"><span class="meta-label">Started</span><span class="meta-value mono">${escapeHtml(d.started || "—")}</span></div>
      <div class="meta-item"><span class="meta-label">Region</span><span class="meta-value mono">${escapeHtml(d.region || "—")}</span></div>
    </div>

    ${d.impact ? `<p class="detail-desc"><strong>Impact.</strong> ${escapeHtml(d.impact)}</p>` : ""}
    ${d.summary ? `<p class="detail-desc">${escapeHtml(d.summary)}</p>` : ""}

    <p class="detail-section-label">Timeline</p>
    <ul class="timeline">
      ${timeline.map(e => `<li class="${e.now ? "t-now" : ""}"><span class="t-time">${escapeHtml(e.t)}</span>${escapeHtml(e.text)}</li>`).join("")}
    </ul>

    <div class="detail-actions">
      <button type="button" class="btn btn-primary" id="ackBtn" ${acknowledged ? "disabled" : ""}>
        ${acknowledged ? "Acknowledged" : "Acknowledge"}
      </button>
    </div>`;

  const ackBtn = $("#ackBtn");
  if (ackBtn && !acknowledged) {
    ackBtn.addEventListener("click", () => acknowledgeIncident(inc.id));
  }
}

function acknowledgeIncident(id) {
  const inc = state.incidents.find(i => i.id === id);
  if (!inc || inc.status === "acknowledged" || inc.status === "resolved") return;

  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  inc.status = "acknowledged";
  inc.acknowledgedAt = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;

  renderTable();
  renderDetail();
  updateActivePill();
  showToast(`${inc.id} acknowledged — ${inc.title}`);
}

/* ------------------------------------------------------------------ toast */

let toastTimer = null;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

/* ------------------------------------------------------------------ events */

function setupFilters() {
  $("#search").addEventListener("input", e => {
    state.query = e.target.value;
    renderTable();
  });

  $("#severityFilter").addEventListener("click", e => {
    const btn = e.target.closest("button[data-sev]");
    if (!btn) return;
    state.severity = btn.dataset.sev;
    $("#severityFilter").querySelectorAll("button").forEach(b =>
      b.classList.toggle("is-on", b === btn));
    renderTable();
  });

  $("#statusFilter").addEventListener("change", e => {
    state.status = e.target.value;
    renderTable();
  });

  $("#clearFilters").addEventListener("click", () => {
    state.query = "";
    state.severity = "all";
    state.status = "all";
    $("#search").value = "";
    $("#statusFilter").value = "all";
    $("#severityFilter").querySelectorAll("button").forEach(b =>
      b.classList.toggle("is-on", b.dataset.sev === "all"));
    renderTable();
    $("#search").focus();
  });
}

function setupTableInteraction() {
  const tbody = $("#tbody");

  tbody.addEventListener("click", e => {
    const row = e.target.closest("tr[data-id]");
    if (row) selectIncident(row.dataset.id, false);
  });

  tbody.addEventListener("keydown", e => {
    const row = e.target.closest("tr[data-id]");
    if (!row) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectIncident(row.dataset.id, false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const rows = [...tbody.querySelectorAll("tr[data-id]")];
      const idx = rows.indexOf(row);
      const next = rows[e.key === "ArrowDown" ? idx + 1 : idx - 1];
      if (next) next.focus();
    }
  });
}

function setupRail() {
  document.querySelectorAll(".rail-item").forEach(item => {
    item.addEventListener("click", e => {
      e.preventDefault();
      document.querySelectorAll(".rail-item").forEach(i => {
        i.classList.remove("is-active");
        i.removeAttribute("aria-current");
      });
      item.classList.add("is-active");
      item.setAttribute("aria-current", "page");
    });
  });
}

/* ------------------------------------------------------------------- init */

function init() {
  updateClock();
  setInterval(updateClock, 1000);
  updateActivePill();

  renderMetrics();
  renderChartStats();
  drawChart(-1);
  setupChartInteractions();

  renderTable();
  renderDetail();
  setupFilters();
  setupTableInteraction();
  setupRail();
}

init();
