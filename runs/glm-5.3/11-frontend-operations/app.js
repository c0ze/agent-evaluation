"use strict";

/* ---------- Seed data (from DATA.json) ---------- */

const DATA = {
  metrics: [
    { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up", good: true },
    { label: "P95 latency", value: "184 ms", change: "\u221212 ms", direction: "down", good: true },
    { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up", good: false },
    { label: "Queue depth", value: "2,841", change: "\u221219%", direction: "down", good: false }
  ],
  throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
  incidents: [
    { id: "INC-2841", severity: "critical", service: "payments-api", age: "12m", owner: "M. Chen", status: "investigating", title: "Card authorization timeouts" },
    { id: "INC-2839", severity: "high", service: "event-router", age: "31m", owner: "Unassigned", status: "open", title: "EU retry queue growth" },
    { id: "INC-2837", severity: "medium", service: "search-index", age: "1h 08m", owner: "A. Silva", status: "monitoring", title: "Index freshness outside SLO" },
    { id: "INC-2832", severity: "low", service: "webhooks", age: "3h 42m", owner: "R. Patel", status: "open", title: "Elevated partner delivery lag" }
  ]
};

const incidentState = DATA.incidents.map((i) => ({ ...i, acknowledged: false }));

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

let selectedId = incidentState.length ? incidentState[0].id : null;

/* ---------- Helpers ---------- */

const $ = (sel) => document.querySelector(sel);

function fmtStatus(status, acknowledged) {
  if (acknowledged) return "acknowledged";
  return status;
}

function ageSortKey(age) {
  const h = /(\d+)h/.exec(age);
  const m = /(\d+)m/.exec(age);
  return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
}

/* ---------- Metrics ---------- */

function renderMetrics() {
  const grid = $("#metric-grid");
  grid.innerHTML = "";
  DATA.metrics.forEach((m) => {
    const li = document.createElement("li");
    li.className = "metric";
    li.dataset.good = String(m.good);
    const arrow = m.direction === "up" ? "\u25B2" : "\u25BC";
    li.innerHTML = `
      <p class="metric-label">${m.label}</p>
      <p class="metric-value">${m.value}</p>
      <p class="metric-trend ${m.direction === "up" ? "trend-up" : "trend-down"}">
        <span class="trend-arrow" aria-hidden="true">${arrow}</span>
        <span>${m.change} vs 24h ago</span>
      </p>`;
    grid.appendChild(li);
  });
}

/* ---------- Throughput chart ---------- */

function renderChart() {
  const canvas = $("#throughput-chart");
  const peak = Math.max(...DATA.throughput);
  $("#chart-peak").textContent = `${peak},000`;

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 600;
  const cssH = canvas.clientHeight || 180;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const data = DATA.throughput;
  const padL = 34, padR = 8, padT = 8, padB = 22;
  const plotW = cssW - padL - padR;
  const plotH = cssH - padT - padB;
  const maxV = 100;

  // gridlines + y labels
  ctx.font = "10px " + getComputedStyle(document.body).getPropertyValue("--mono");
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let v = 0; v <= maxV; v += 25) {
    const y = padT + plotH - (v / maxV) * plotH;
    ctx.strokeStyle = "#e1e4e8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y + 0.5);
    ctx.lineTo(cssW - padR, y + 0.5);
    ctx.stroke();
    ctx.fillStyle = "#8b93a1";
    ctx.fillText(String(v) + "k", padL - 6, y);
  }

  // x labels: every 3 hours
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const now = new Date();
  for (let i = 0; i < data.length; i += 3) {
    const hour = (now.getHours() - (data.length - 1 - i) + 24) % 24;
    const x = padL + ((i + 0.5) / data.length) * plotW;
    ctx.fillStyle = "#8b93a1";
    ctx.fillText(String(hour).padStart(2, "0") + ":00", x, padT + plotH + 6);
  }

  // SLO floor line
  const slo = 25;
  const sloY = padT + plotH - (slo / maxV) * plotH;
  ctx.strokeStyle = "#8a6d00";
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, sloY + 0.5);
  ctx.lineTo(cssW - padR, sloY + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // bars
  const slot = plotW / data.length;
  const barW = Math.max(2, slot - 3);
  data.forEach((v, i) => {
    const x = padL + i * slot + 1.5;
    const h = (v / maxV) * plotH;
    const y = padT + plotH - h;
    ctx.fillStyle = v < slo ? "#c2352b" : "#2f6fed";
    ctx.fillRect(x, y, barW, h);
  });
}

/* ---------- Incident table ---------- */

function visibleIncidents() {
  const sev = $("#severity-filter").value;
  const st = $("#status-filter").value;
  return incidentState
    .filter((i) => (sev === "all" || i.severity === sev))
    .filter((i) => (st === "all" || fmtStatus(i.status, i.acknowledged) === st))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || ageSortKey(b.age) - ageSortKey(a.age));
}

function renderTable() {
  const tbody = $("#incident-rows");
  const empty = $("#empty-state");
  const rows = visibleIncidents();
  const table = $(".incident-table");
  const count = $("#table-count");

  tbody.innerHTML = "";
  const anyMatch = rows.length > 0;
  table.hidden = !anyMatch;
  empty.hidden = anyMatch;
  count.textContent = anyMatch
    ? `${rows.length} of ${incidentState.length} incidents shown`
    : `0 of ${incidentState.length} incidents shown`;

  rows.forEach((i) => {
    const status = fmtStatus(i.status, i.acknowledged);
    const tr = document.createElement("tr");
    tr.className = "incident-row";
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.setAttribute("aria-selected", String(i.id === selectedId));
    tr.dataset.id = i.id;
    tr.setAttribute("aria-label", `${i.severity} incident ${i.id}: ${i.title}. Select for details.`);
    tr.innerHTML = `
      <td><span class="badge badge-${i.severity}">${i.severity}</span></td>
      <td><button class="incident-link" type="button">${i.id} · ${i.title}</button></td>
      <td class="service">${i.service}</td>
      <td class="num age">${i.age}</td>
      <td class="owner">${i.owner}</td>
      <td><span class="status status-${status}">${status}</span></td>`;
    tbody.appendChild(tr);
  });
}

/* ---------- Detail panel ---------- */

function currentIncident() {
  return incidentState.find((i) => i.id === selectedId) || null;
}

function renderDetail() {
  const inc = currentIncident();
  const list = $("#detail-list");
  const title = $("#detail-heading");
  const idP = $("#detail-id");
  const ackBtn = $("#ack-button");
  const note = $("#detail-note");

  if (!inc) {
    title.textContent = "No incident selected";
    idP.textContent = "—";
    list.innerHTML = "";
    ackBtn.disabled = true;
    note.textContent = "";
    return;
  }

  title.textContent = inc.title;
  idP.textContent = `${inc.id} · ${inc.service}`;
  const status = fmtStatus(inc.status, inc.acknowledged);
  list.innerHTML = `
    <div class="detail-row"><dt>Severity</dt><dd><span class="badge badge-${inc.severity}">${inc.severity}</span></dd></div>
    <div class="detail-row"><dt>Status</dt><dd><span class="status status-${status}">${status}</span></dd></div>
    <div class="detail-row"><dt>Age</dt><dd class="mono">${inc.age}</dd></div>
    <div class="detail-row"><dt>Owner</dt><dd>${inc.owner}</dd></div>`;

  ackBtn.disabled = inc.acknowledged;
  ackBtn.textContent = inc.acknowledged ? "Acknowledged" : "Acknowledge";
  ackBtn.setAttribute("aria-describedby", "detail-note");
  note.textContent = inc.acknowledged ? `Acknowledged by you · ${inc.id}` : "";
}

/* ---------- Events ---------- */

function selectIncident(id) {
  selectedId = id;
  renderTable();
  renderDetail();
}

function bindEvents() {
  const tbody = $("#incident-rows");

  tbody.addEventListener("click", (e) => {
    const tr = e.target.closest("tr.incident-row");
    if (!tr) return;
    selectIncident(tr.dataset.id);
  });

  tbody.addEventListener("keydown", (e) => {
    const tr = e.target.closest("tr.incident-row");
    if (!tr) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectIncident(tr.dataset.id);
    }
  });

  $("#severity-filter").addEventListener("change", () => {
    renderTable();
    const rows = visibleIncidents();
    if (!rows.some((i) => i.id === selectedId)) {
      selectedId = rows.length ? rows[0].id : null;
      renderDetail();
    }
  });

  $("#status-filter").addEventListener("change", () => {
    renderTable();
    const rows = visibleIncidents();
    if (!rows.some((i) => i.id === selectedId)) {
      selectedId = rows.length ? rows[0].id : null;
      renderDetail();
    }
  });

  $("#clear-filters").addEventListener("click", () => {
    $("#severity-filter").value = "all";
    $("#status-filter").value = "all";
    renderTable();
    renderDetail();
    $("#severity-filter").focus();
  });

  $("#ack-button").addEventListener("click", () => {
    const inc = currentIncident();
    if (!inc || inc.acknowledged) return;
    inc.acknowledged = true;
    renderTable();
    renderDetail();
  });
}

/* ---------- Clock ---------- */

function tickClock() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  $("#clock").textContent = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
}

/* ---------- Init ---------- */

function init() {
  renderMetrics();
  renderChart();
  renderTable();
  renderDetail();
  bindEvents();
  tickClock();
  setInterval(tickClock, 1000);
  window.addEventListener("resize", () => {
    clearTimeout(window.__chartResize);
    window.__chartResize = setTimeout(renderChart, 120);
  });
}

document.addEventListener("DOMContentLoaded", init);
