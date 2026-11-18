"use strict";

// Inline the supplied snapshot so a file:// page needs no data request.
const snapshot = {
  "metrics": [
    {
      "label": "Events / min",
      "value": "18,420",
      "change": "+8.2%",
      "direction": "up"
    },
    {
      "label": "P95 latency",
      "value": "184 ms",
      "change": "−12 ms",
      "direction": "down"
    },
    {
      "label": "Error rate",
      "value": "0.37%",
      "change": "+0.08 pp",
      "direction": "up"
    },
    {
      "label": "Queue depth",
      "value": "2,841",
      "change": "−19%",
      "direction": "down"
    }
  ],
  "throughput": [
    31,
    28,
    24,
    22,
    20,
    23,
    34,
    48,
    62,
    71,
    76,
    73,
    68,
    72,
    80,
    84,
    79,
    75,
    82,
    88,
    77,
    63,
    52,
    41
  ],
  "incidents": [
    {
      "id": "INC-2841",
      "severity": "critical",
      "service": "payments-api",
      "age": "12m",
      "owner": "M. Chen",
      "status": "investigating",
      "title": "Card authorization timeouts"
    },
    {
      "id": "INC-2839",
      "severity": "high",
      "service": "event-router",
      "age": "31m",
      "owner": "Unassigned",
      "status": "open",
      "title": "EU retry queue growth"
    },
    {
      "id": "INC-2837",
      "severity": "medium",
      "service": "search-index",
      "age": "1h 08m",
      "owner": "A. Silva",
      "status": "monitoring",
      "title": "Index freshness outside SLO"
    },
    {
      "id": "INC-2832",
      "severity": "low",
      "service": "webhooks",
      "age": "3h 42m",
      "owner": "R. Patel",
      "status": "open",
      "title": "Elevated partner delivery lag"
    }
  ]
};

const $ = (id) => document.getElementById(id);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`;
const titleCase = (value) => value[0].toUpperCase() + value.slice(1);
const hourLabel = (hour) => String(hour).padStart(2, "0") + ":00";
const announce = (message) => { $("announcement").textContent = message; };

function renderMetrics() {
  const icons = ["pulse", "gauge", "error", "layers"];
  $("metrics").innerHTML = snapshot.metrics.map((metric, index) => {
    const [, number, unit] = metric.value.match(/^([\d.,]+)(.*)$/);
    const adverse = metric.label === "Error rate" && metric.direction === "up";
    return `<article class="metric">
      <div class="metric-head"><h2>${metric.label}</h2>${icon(icons[index])}</div>
      <p class="metric-value">${number}<span class="metric-unit">${unit}</span></p>
      <p class="metric-context"><span class="delta${adverse ? " adverse" : ""}">${icon("arrow-" + metric.direction)}${metric.change}</span> vs prior 24h</p>
    </article>`;
  }).join("");
}

function updateClock() {
  const now = new Date();
  const time = $("utc-clock");
  const utc = now.toISOString().slice(11, 16) + " UTC";
  time.textContent = utc;
  time.dateTime = now.toISOString();
  time.setAttribute("aria-label", "Current time " + utc);
}
renderMetrics();
updateClock();
setInterval(updateClock, 15000);

// The index uses one sample per hour in the reference day.
const plot = $("plot");
let windowHours = 24;
let inspectedHour = null;
let chartGeometry;
plot.tabIndex = 0;
plot.setAttribute("role", "slider");
plot.setAttribute("aria-label", "Hourly throughput samples, UTC");
plot.setAttribute("aria-valuemax", "23");

function drawChart() {
  const values = snapshot.throughput.slice(-windowHours);
  const start = snapshot.throughput.length - values.length;
  const peak = Math.max(...values);
  const peakHour = start + values.indexOf(peak);
  const end = snapshot.throughput.length - 1;
  $("last-value").textContent = values.at(-1);
  $("last-hour").textContent = hourLabel(end) + " UTC";
  $("peak-value").textContent = peak;
  $("peak-hour").textContent = hourLabel(peakHour) + " UTC";

  const w = Math.max(100, plot.clientWidth);
  const h = plot.clientHeight;
  const left = 29, right = w - 6, top = 9, bottom = h - 21;
  const x = (hour) => left + (right - left) * (hour - start) / (end - start);
  const y = (value) => bottom - (bottom - top) * value / 100;
  chartGeometry = { start, end, x, y, left, right, top, bottom, w };
  const path = values.map((value, i) => `${i ? "L" : "M"}${x(i + start).toFixed(2)} ${y(value).toFixed(2)}`).join(" ");
  const bands = [0, 25, 50, 75, 100].map((value) =>
    `<line class="grid-line" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/>
     <text class="axis" text-anchor="end" x="${left - 7}" y="${y(value) + 3}">${value}</text>`
  ).join("");
  const step = windowHours === 24 ? (w < 440 ? 6 : 4) : windowHours === 12 ? (w < 440 ? 4 : 2) : (w < 440 ? 2 : 1);
  const hours = Array.from({ length: windowHours }, (_, i) => start + i).filter((hour) =>
    hour === start || hour === end || ((hour - start) % step === 0 && x(end) - x(hour) >= 42)
  );
  const ticks = hours.map((hour) => {
    const align = hour === start ? "start" : hour === end ? "end" : "middle";
    return `<line class="x-grid" x1="${x(hour)}" x2="${x(hour)}" y1="${top}" y2="${bottom}"/>
      <text class="axis" text-anchor="${align}" x="${x(hour)}" y="${h - 3}">${hourLabel(hour)}</text>`;
  }).join("");
  const area = `${path} L${right} ${bottom} H${left} Z`;
  plot.innerHTML = `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse">
      <path d="M-1 1 1-1 M0 6 6 0 M5 7 7 5" stroke="#83e4be" stroke-opacity=".15" stroke-width="1"/>
    </pattern></defs>
    ${ticks}${bands}
    <path d="${area}" fill="#83e4be" fill-opacity=".055"/><path d="${area}" fill="url(#hatch)"/>
    <path d="${path}" fill="none" stroke="#83e4be" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(peakHour)}" cy="${y(peak)}" r="3.2" fill="#17201d" stroke="#b3e6ce" stroke-width="1.6"/>
    <circle cx="${x(end)}" cy="${y(values.at(-1))}" r="4.1" fill="#83e4be" stroke="#233a30" stroke-width="2"/>
    <g id="chart-cursor"></g>
  </svg>`;
  plot.setAttribute("aria-valuemin", String(start));
  updateCursor();
}

function updateCursor() {
  const { start, end, x, y, top, bottom, w } = chartGeometry;
  const hour = inspectedHour === null ? end : Math.max(start, Math.min(end, inspectedHour));
  const value = snapshot.throughput[hour];
  plot.setAttribute("aria-valuenow", String(hour));
  plot.setAttribute("aria-valuetext", `${hourLabel(hour)} UTC, throughput index ${value}`);
  const cursor = $("chart-cursor");
  if (inspectedHour === null) {
    cursor.replaceChildren();
    return;
  }
  const cx = x(hour), cy = y(value);
  const boxLeft = Math.min(Math.max(cx - 42, 0), w - 85);
  const boxTop = cy < 28 ? cy + 10 : cy - 27;
  cursor.innerHTML = `<line class="point-line" x1="${cx}" x2="${cx}" y1="${top}" y2="${bottom}"/>
    <circle cx="${cx}" cy="${cy}" r="3.5" stroke="#83e4be" stroke-width="2" fill="#17201d"/>
    <rect x="${boxLeft}" y="${boxTop}" width="85" height="20" rx="3" fill="#23332c" stroke="#597b69"/>
    <text class="readout" x="${boxLeft + 42.5}" y="${boxTop + 14}" text-anchor="middle">${hourLabel(hour)} · ${value}</text>`;
}
function inspectPointer(event) {
  const { start, end, left, right } = chartGeometry;
  const offset = event.clientX - plot.getBoundingClientRect().left;
  inspectedHour = Math.max(start, Math.min(end, Math.round(start + (offset - left) / (right - left) * (end - start))));
  updateCursor();
}
plot.addEventListener("pointermove", inspectPointer);
plot.addEventListener("pointerdown", inspectPointer);
plot.addEventListener("pointerleave", () => {
  if (document.activeElement !== plot) { inspectedHour = null; updateCursor(); }
});
plot.addEventListener("focus", () => { inspectedHour ??= chartGeometry.end; updateCursor(); });
plot.addEventListener("blur", () => { inspectedHour = null; updateCursor(); });
plot.addEventListener("keydown", (event) => {
  const { start, end } = chartGeometry;
  const current = inspectedHour ?? end;
  const positions = { ArrowLeft: current - 1, ArrowDown: current - 1, ArrowRight: current + 1, ArrowUp: current + 1, Home: start, End: end };
  if (!Object.hasOwn(positions, event.key)) return;
  event.preventDefault();
  inspectedHour = Math.max(start, Math.min(end, positions[event.key]));
  updateCursor();
});
document.querySelectorAll("[data-hours]").forEach((button) => {
  button.addEventListener("click", () => {
    windowHours = Number(button.dataset.hours);
    inspectedHour = null;
    document.querySelectorAll("[data-hours]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    drawChart();
    announce(`Showing the last ${windowHours} hours. Peak index ${$("peak-value").textContent} at ${$("peak-hour").textContent}.`);
  });
});
drawChart();
new ResizeObserver(drawChart).observe(plot);

const incidents = snapshot.incidents;
const storageKey = "relay.acknowledgements.v1";
function readAcknowledgements() {
  try {
    const ids = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return new Set(incidents.filter((item) => Array.isArray(ids) && ids.includes(item.id)).map((item) => item.id));
  } catch {
    return new Set();
  }
}
let acknowledged = readAcknowledgements();
let selectedId = incidents[0]?.id;
const searchInput = $("search-input");
const severityFilter = $("severity-filter");
const compactDetail = matchMedia("(max-width: 1080px)");
const statusOf = (item) => acknowledged.has(item.id) ? "acknowledged" : item.status;

function severityBadge(severity) {
  const rank = ["low", "medium", "high", "critical"].indexOf(severity) + 1;
  const bars = Array.from({ length: 4 }, (_, i) => `<i class="${i < rank ? "lit" : ""}"></i>`).join("");
  return `<span class="severity-badge ${severity}"><span class="severity-bars" aria-hidden="true">${bars}</span>${titleCase(severity)}</span>`;
}
function statusLabel(item) {
  const status = statusOf(item);
  return `<span class="status ${status}">${titleCase(status)}</span>`;
}
function matchingIncidents() {
  const words = searchInput.value.toLowerCase().trim().split(/\s+/);
  return incidents.filter((item) => {
    const haystack = [item.id, item.title, item.service, item.owner, item.age, item.severity, statusOf(item)].join(" ").toLowerCase();
    return (severityFilter.value === "all" || severityFilter.value === item.severity) && words.every((word) => haystack.includes(word));
  });
}
function rowFor(item) {
  const selected = item.id === selectedId;
  return `<tr role="row" data-id="${item.id}" class="${selected ? "selected" : ""}">
    <td role="cell" class="incident-cell"><button aria-controls="incident-detail" ${selected ? 'aria-current="true"' : ""} class="row-select"><span class="incident-id">${item.id}</span><span class="incident-title">${item.title}</span></button></td>
    <td role="cell" class="severity-cell">${severityBadge(item.severity)}</td>
    <td role="cell"><span class="mobile-key">Service</span><span class="service">${item.service}</span></td>
    <td role="cell"><span class="mobile-key">Age</span><span class="age">${item.age}</span></td>
    <td role="cell"><span class="mobile-key">Owner</span><span class="owner${item.owner === "Unassigned" ? " unassigned" : ""}">${item.owner}</span></td>
    <td role="cell"><span class="mobile-key">Status</span>${statusLabel(item)}</td>
  </tr>`;
}
function renderDetail(item) {
  $("back-link").hidden = !item;
  if (!item) {
    $("detail-body").innerHTML = `<div class="empty">${icon("detail")}<h3>No incident selected</h3><p>Matching incidents appear here when selected.</p></div>`;
    return;
  }
  const done = acknowledged.has(item.id);
  $("detail-body").innerHTML = `<div class="detail-content">
    <div class="detail-meta"><span class="incident-id">${item.id}</span>${severityBadge(item.severity)}</div>
    <h3>${item.title}</h3>
    <dl class="detail-fields">
      <div><dt>Service</dt><dd class="service">${item.service}</dd></div>
      <div><dt>Owner</dt><dd>${item.owner}</dd></div>
      <div><dt>Age</dt><dd class="age">${item.age}</dd></div>
      <div><dt>Status</dt><dd>${statusLabel(item)}</dd></div>
    </dl>
    <button class="ack" id="acknowledge" ${done ? "disabled" : ""}>${icon("check")}${done ? "Acknowledged" : "Acknowledge incident"}</button>
  </div>`;
  if (!done) $("acknowledge").addEventListener("click", acknowledge);
}
function renderQueue() {
  const visible = matchingIncidents();
  const current = visible.find((item) => item.id === selectedId) || visible[0];
  selectedId = current?.id;
  $("incident-rows").innerHTML = visible.map(rowFor).join("");
  $("queue-count").textContent = String(visible.length).padStart(2, "0");
  $("result-count").textContent = `Showing ${visible.length} of ${incidents.length} incidents`;
  $("queue-empty").hidden = visible.length > 0;
  $("incident-table").hidden = visible.length === 0;
  document.querySelector(".selection-key").hidden = !current;
  renderDetail(current);
}
function selectRow(id) {
  selectedId = id;
  const row = document.querySelector(`tr[data-id="${id}"]`);
  document.querySelectorAll("tr[data-id]").forEach((item) => {
    item.classList.toggle("selected", item === row);
    const button = item.querySelector(".row-select");
    if (item === row) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
  const selected = incidents.find((item) => item.id === id);
  renderDetail(selected);
  if (compactDetail.matches) $("incident-detail").focus();
  else row.querySelector("button").focus({ preventScroll: true });
  announce(`Selected ${id}, ${selected.title}.`);
}
function acknowledge() {
  const id = selectedId;
  if (!id || acknowledged.has(id)) return;
  const stored = readAcknowledgements();
  acknowledged = new Set([...stored, ...acknowledged, id]);
  try { localStorage.setItem(storageKey, JSON.stringify([...acknowledged])); } catch { /* Keep the change in this page session. */ }
  renderQueue();
  if (selectedId) $("incident-detail").focus({ preventScroll: true });
  else $("reset-filters").focus();
  announce(`${id} acknowledged.`);
}
$("incident-rows").addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (row) selectRow(row.dataset.id);
});
searchInput.addEventListener("input", renderQueue);
severityFilter.addEventListener("change", renderQueue);
$("reset-filters").addEventListener("click", () => {
  searchInput.value = "";
  severityFilter.value = "all";
  renderQueue();
  searchInput.focus();
});
$("back-link").addEventListener("click", (event) => {
  const selected = document.querySelector(".selected .row-select");
  if (selected) { event.preventDefault(); selected.focus(); }
});
window.addEventListener("storage", (event) => {
  if (event.key === storageKey || event.key === null) {
    acknowledged = readAcknowledgements();
    renderQueue();
  }
});
renderQueue();

const navLinks = [...document.querySelectorAll(".rail nav a")];
function markNav(hash) {
  navLinks.forEach((link) => {
    if (link.hash === hash) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}
function syncNav() {
  const hash = navLinks.some((link) => link.hash === location.hash) ? location.hash : "#overview";
  markNav(hash);
}
syncNav();
window.addEventListener("hashchange", syncNav);
navLinks.forEach((link) => link.addEventListener("click", () => markNav(link.hash)));
const criticalTotal = incidents.filter((item) => item.severity === "critical").length;
$("critical-count").textContent = `${criticalTotal} critical incident${criticalTotal === 1 ? "" : "s"}`;
$("critical-shortcut").addEventListener("click", () => {
  searchInput.value = "";
  severityFilter.value = "critical";
  renderQueue();
  location.hash = "incidents";
  $("incidents").focus();
  markNav("#incidents");
});

const help = $("shortcuts");
let helpTrigger;
function openHelp() { helpTrigger = document.activeElement; help.showModal(); }
$("shortcut-button").addEventListener("click", openHelp);
$("close-shortcuts").addEventListener("click", () => help.close());
help.addEventListener("close", () => {
  if (helpTrigger && helpTrigger !== document.body && helpTrigger.isConnected) helpTrigger.focus();
});
document.addEventListener("keydown", (event) => {
  if (help.open || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  if (event.target.closest("input, textarea, select, [contenteditable='true']")) return;
  if (event.key === "/") {
    event.preventDefault();
    searchInput.focus();
    markNav("#incidents");
  } else if (event.key === "?") {
    event.preventDefault();
    openHelp();
  }
});
