"use strict";

// Embedded from DATA.json so the dashboard also opens directly from disk.
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

const byId = id => document.getElementById(id);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const capitalize = word => word.charAt(0).toUpperCase() + word.slice(1);
const hourLabel = hour => String(hour).padStart(2, "0") + ":00";

function renderMetrics() {
  const icons = ["activity", "latency", "incidents", "stack"];
  byId("metrics").innerHTML = snapshot.metrics.map((metric, index) => {
    const [, number, unit] = metric.value.match(/^([\d.,]+)\s*(.*)$/);
    return `<article class="metric">
      <h2 class="metric-label">${metric.label}${icon(icons[index])}</h2>
      <p class="metric-value">${number}${unit ? `<small>${unit}</small>` : ""}</p>
      <p class="metric-trend"><span class="change ${index === 2 ? "caution" : ""}">${icon(metric.direction)}${metric.change}</span>vs prior 24h</p>
    </article>`;
  }).join("");
}

const volumes = snapshot.throughput;
const average = volumes.reduce((sum, value) => sum + value, 0) / volumes.length;
const peakHour = volumes.indexOf(Math.max(...volumes));
const plot = byId("plot");
let inspectedHour = peakHour;
let chartGeometry;
let pinnedHour = peakHour;

function updateChartReading(hour) {
  inspectedHour = Math.min(volumes.length - 1, Math.max(0, hour));
  if (!chartGeometry) return;
  const { x, y, width, bottom } = chartGeometry;
  const value = volumes[inspectedHour];
  const pointX = x(inspectedHour);
  const pointY = y(value);
  const tooltipX = Math.max(1, Math.min(width - 91, pointX - 45));
  const tooltipY = Math.max(0, pointY - 28);
  byId("reading").innerHTML = `
    <line class="guide" x1="${pointX}" x2="${pointX}" y1="${pointY}" y2="${bottom}"/>
    <circle class="point" cx="${pointX}" cy="${pointY}" r="4"/>
    <rect class="tooltip" x="${tooltipX}" y="${tooltipY}" width="90" height="19" rx="3"/>
    <text class="tooltip-text" x="${tooltipX + 45}" y="${tooltipY + 13}" text-anchor="middle">${hourLabel(inspectedHour)} · ${value}k</text>`;
  plot.setAttribute("aria-valuenow", inspectedHour);
  plot.setAttribute("aria-valuetext", `${hourLabel(inspectedHour)} UTC, ${value} thousand events`);
}

function drawChart() {
  const width = plot.clientWidth;
  const height = plot.clientHeight;
  if (!width || !height) return;
  const left = 29;
  const right = width - 18;
  const top = 16;
  const bottom = height - 22;
  const x = hour => left + hour * (right - left) / (volumes.length - 1);
  const y = volume => bottom - volume / 100 * (bottom - top);
  chartGeometry = { x, y, width, bottom, left, right };
  const axis = [0, 25, 50, 75, 100].map(value => `
    <line class="${value ? "gridline" : "axis-line"}" x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/>
    <text x="${left - 7}" y="${y(value) + 3}" text-anchor="end">${value}</text>`).join("");
  const hours = width < 480 ? [0, 6, 12, 18, 23] : [0, 4, 8, 12, 16, 20, 23];
  const labels = hours.map(hour => `<text x="${x(hour)}" y="${height - 4}" text-anchor="middle">${hourLabel(hour)}</text>`).join("");
  const points = volumes.map((volume, hour) => `${x(hour)},${y(volume)}`).join(" ");
  plot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  plot.innerHTML = `<g aria-hidden="true">
    <polygon class="volume-area" points="${left},${bottom} ${points} ${right},${bottom}"/>
    ${axis}${labels}
    <line class="avg-line" x1="${left}" x2="${right}" y1="${y(average)}" y2="${y(average)}"/>
    <polyline class="volume-line" points="${points}"/><g id="reading"></g>
  </g>`;
  updateChartReading(inspectedHour);
}

function hourAtPointer(event) {
  const { left, right } = chartGeometry;
  const cursor = event.clientX - plot.getBoundingClientRect().left;
  return Math.round((cursor - left) / (right - left) * (volumes.length - 1));
}
plot.addEventListener("pointermove", event => {
  if (chartGeometry && event.pointerType !== "touch") updateChartReading(hourAtPointer(event));
});
plot.addEventListener("pointerleave", () => updateChartReading(pinnedHour));
plot.addEventListener("click", event => {
  if (!chartGeometry) return;
  updateChartReading(hourAtPointer(event));
  pinnedHour = inspectedHour;
});
plot.addEventListener("keydown", event => {
  const keys = { ArrowLeft: inspectedHour - 1, ArrowDown: inspectedHour - 1, ArrowRight: inspectedHour + 1, ArrowUp: inspectedHour + 1, Home: 0, End: volumes.length - 1 };
  if (!Object.hasOwn(keys, event.key)) return;
  event.preventDefault();
  updateChartReading(keys[event.key]);
  pinnedHour = inspectedHour;
});

const incidents = snapshot.incidents;
const acknowledged = new Set();
const storagePrefix = "relay:2026-11-19:ack:";
const search = byId("search");
const severityFilter = byId("severity");
const narrow = window.matchMedia("(max-width: 760px)");
let selectedId = incidents[0].id;

function loadAcknowledgements() {
  try {
    for (const incident of incidents) {
      if (localStorage.getItem(storagePrefix + incident.id) === "1") acknowledged.add(incident.id);
      else acknowledged.delete(incident.id);
    }
  } catch {
    // Some browsers restrict storage for file URLs. In-memory updates still work.
  }
}

function severityBadge(level) {
  const strength = ["low", "medium", "high", "critical"].indexOf(level) + 1;
  const bars = [1, 2, 3, 4].map(bar => `<i class="${bar <= strength ? "filled" : ""}"></i>`).join("");
  return `<span class="severity ${level}"><span class="signal" aria-hidden="true">${bars}</span>${capitalize(level)}</span>`;
}
const statusOf = incident => acknowledged.has(incident.id) ? "acknowledged" : incident.status;
function statusLabel(incident) {
  const status = statusOf(incident);
  return `<span class="status-line"><i class="status-dot ${status}" aria-hidden="true"></i>${capitalize(status)}</span>`;
}
function ownerLabel(owner) {
  if (owner === "Unassigned") return '<span class="owner unassigned"><span class="avatar vacant" aria-hidden="true">–</span>Unassigned</span>';
  const [first, last] = owner.split(" ");
  return `<span class="owner"><span class="avatar ${last.toLowerCase()}" aria-hidden="true">${first[0] + last[0]}</span>${owner}</span>`;
}
function renderDetail(incident) {
  const content = byId("detail-content");
  if (!incident) {
    content.innerHTML = '<div class="detail-empty"><h3>No incident selected</h3><p>Clear or adjust the queue filters to inspect an incident.</p></div>';
    return;
  }
  const isAcknowledged = acknowledged.has(incident.id);
  content.innerHTML = `
    <div class="detail-ident"><span class="detail-id">${incident.id} · ${incident.age} ago</span>${severityBadge(incident.severity)}</div>
    <h3>${incident.title}</h3>
    <dl>
      <div><dt>Service</dt><dd class="service">${incident.service}</dd></div>
      <div><dt>Owner</dt><dd>${incident.owner}</dd></div>
      <div><dt>Status</dt><dd>${statusLabel(incident)}</dd></div>
    </dl>
    <button class="ack" id="acknowledge" type="button" aria-disabled="${isAcknowledged}">${icon("check")}${isAcknowledged ? "Acknowledged" : "Acknowledge incident"}</button>`;
}

function renderQueue() {
  const query = search.value.trim().toLowerCase();
  const severity = severityFilter.value;
  const visible = incidents.filter(incident => {
    const searchable = [incident.id, incident.title, incident.service, incident.owner, incident.severity, incident.age, statusOf(incident)].join(" ").toLowerCase();
    return (!severity || incident.severity === severity) && searchable.includes(query);
  });
  if (!visible.some(incident => incident.id === selectedId)) selectedId = visible[0]?.id ?? null;
  byId("incident-rows").innerHTML = visible.map(incident => {
    const selected = incident.id === selectedId;
    return `<tr role="row" data-id="${incident.id}" class="${selected ? "selected" : ""}">
      <td role="cell"><button class="incident-button" type="button" aria-controls="detail"${selected ? ' aria-current="true"' : ""}><span class="row-id">${incident.id}</span><span class="row-title">${incident.title}</span></button></td>
      <td role="cell">${severityBadge(incident.severity)}</td>
      <td role="cell" class="service">${incident.service}</td>
      <td role="cell" class="age">${incident.age}</td>
      <td role="cell">${ownerLabel(incident.owner)}</td>
      <td role="cell">${statusLabel(incident)}</td>
      <td role="cell"><svg class="icon row-chevron" aria-hidden="true"><use href="#i-right"/></svg></td>
    </tr>`;
  }).join("");
  renderDetail(visible.find(incident => incident.id === selectedId));
  byId("queue-count").textContent = visible.length;
  byId("result-count").textContent = `Showing ${visible.length} of ${incidents.length} incidents`;
  byId("empty").hidden = visible.length > 0;
  byId("reset").hidden = !visible.length || (!search.value && !severity);
}

function resetFilters() {
  search.value = "";
  severityFilter.value = "";
  renderQueue();
  search.focus();
}
byId("reset").addEventListener("click", resetFilters);
byId("reset-empty").addEventListener("click", resetFilters);
search.addEventListener("input", renderQueue);
severityFilter.addEventListener("change", renderQueue);
byId("incident-rows").addEventListener("click", event => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  selectedId = row.dataset.id;
  renderQueue();
  if (narrow.matches) {
    byId("detail").focus();
    byId("detail").scrollIntoView({ block: "start" });
  } else {
    byId("incident-rows").querySelector('[aria-current="true"]').focus({ preventScroll: true });
  }
  byId("announcement").textContent = `Showing details for ${selectedId}.`;
});
byId("detail-content").addEventListener("click", event => {
  if (!event.target.closest("#acknowledge") || !selectedId || acknowledged.has(selectedId)) return;
  const id = selectedId;
  acknowledged.add(id);
  try { localStorage.setItem(storagePrefix + id, "1"); } catch { /* Session state is sufficient when storage is restricted. */ }
  renderQueue();
  if (selectedId === id) byId("acknowledge").focus({ preventScroll: true });
  else search.focus();
  byId("announcement").textContent = `${id} acknowledged. Incident status updated.`;
});
window.addEventListener("storage", event => {
  if (event.key !== null && !event.key.startsWith(storagePrefix)) return;
  loadAcknowledgements();
  renderQueue();
});

function setNav() {
  const hash = location.hash || "#overview";
  for (const link of document.querySelectorAll(".rail nav a")) {
    if (link.hash === hash) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", setNav);
const help = byId("help");
byId("help-open").addEventListener("click", () => help.showModal());
byId("help-close").addEventListener("click", () => help.close());
document.addEventListener("keydown", event => {
  if (help.open || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key === "/" && !event.target.closest("input, select, textarea, [contenteditable=true]")) {
    event.preventDefault();
    search.focus();
    search.select();
  } else if (event.key === "Escape" && document.activeElement === search) {
    event.preventDefault();
    search.value = "";
    renderQueue();
  }
});

renderMetrics();
loadAcknowledgements();
renderQueue();
setNav();
byId("average").textContent = average.toFixed(1) + "k";
drawChart();
new ResizeObserver(drawChart).observe(plot);
