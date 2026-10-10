"use strict";

// Embedded verbatim from DATA.json so opening index.html needs no fetch or server.
const SEED = {
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

const STORAGE_KEY = "relay.acknowledgements.v1";
const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const pad = (value) => String(value).padStart(2, "0");

let acknowledgements = readAcknowledgements();
let selectedId = SEED.incidents[0]?.id ?? null;
let announcementTimer;
let storageAvailable = true;

function readAcknowledgements() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    return Object.fromEntries(SEED.incidents.flatMap(({ id }) => {
      const timestamp = stored[id];
      return typeof timestamp === "string" && Number.isFinite(Date.parse(timestamp))
        ? [[id, new Date(timestamp).toISOString()]] : [];
    }));
  } catch {
    return {};
  }
}

function persistAcknowledgements() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(acknowledgements));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}

function incidents() {
  return SEED.incidents.map((incident) => ({
    ...incident,
    status: acknowledgements[incident.id] ? "acknowledged" : incident.status,
    acknowledgedAt: acknowledgements[incident.id] || null
  }));
}

function filteredIncidents() {
  const query = $("#incident-search").value.trim().toLowerCase();
  const severity = $("#severity-filter").value;
  const status = $("#status-filter").value;
  return incidents().filter((incident) => {
    const searchable = [incident.id, incident.title, incident.service, incident.owner, incident.severity, incident.status].join(" ").toLowerCase();
    return (!query || searchable.includes(query)) &&
      (severity === "all" || incident.severity === severity) &&
      (status === "all" || incident.status === status);
  });
}

function severityTag(severity) {
  return `<span class="severity-tag severity-${escapeHTML(severity)}"><span class="severity-dot" aria-hidden="true"></span>${escapeHTML(titleCase(severity))}</span>`;
}

function statusPill(status) {
  return `<span class="status-pill status-${escapeHTML(status)}"><span class="status-dot" aria-hidden="true"></span>${escapeHTML(titleCase(status))}</span>`;
}

function renderMetrics() {
  $("#metrics").innerHTML = SEED.metrics.map((metric, index) => {
    const [number, unit] = metric.value.split(" ");
    const warning = metric.label === "Error rate" && metric.direction === "up";
    return `<article class="metric" aria-labelledby="metric-${index}">
      <h2 class="metric-label" id="metric-${index}">${escapeHTML(metric.label)}<span class="metric-number" aria-hidden="true">0${index + 1}</span></h2>
      <p class="metric-value">${escapeHTML(number)}${unit ? `<span class="metric-unit">${escapeHTML(unit)}</span>` : ""}</p>
      <div class="metric-trend"><span class="trend-value${warning ? " is-warning" : ""}"><span aria-hidden="true">${metric.direction === "up" ? "↗" : "↘"}</span><span class="sr-only">${metric.direction === "up" ? "Increased" : "Decreased"} by </span>${escapeHTML(metric.change)}</span><span>reported change</span></div>
    </article>`;
  }).join("");
}

function renderChart() {
  const values = SEED.throughput;
  const width = Math.max(200, $("#throughput-chart").clientWidth);
  const height = $("#throughput-chart").clientHeight;
  const left = 27;
  const right = 5;
  const top = 17;
  const bottom = height - 23;
  const plotWidth = width - left - right;
  const plotHeight = bottom - top;
  const step = plotWidth / values.length;
  const peak = Math.max(...values);
  const peakIndex = values.indexOf(peak);
  const maximum = Math.ceil(peak / 20) * 20;
  const ticks = [0, maximum / 2, maximum];
  const grid = ticks.map((value) => {
    const y = bottom - (value / maximum) * plotHeight;
    return `<line class="${value === 0 ? "chart-baseline" : "chart-grid"}" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"/><text class="chart-axis" x="${left - 8}" y="${y + 3}" text-anchor="end">${value}</text>`;
  }).join("");
  const bars = values.map((value, hour) => {
    const x = left + hour * step + step * .17;
    const barWidth = step * .66;
    const barHeight = (value / maximum) * plotHeight;
    const y = bottom - barHeight;
    return `<rect class="chart-bar${hour === peakIndex ? " is-peak" : ""}" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="1"><title>Sample hour ${pad(hour)}: ${value}</title></rect>${hour === peakIndex ? `<text class="peak-label" x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle">${value}</text>` : ""}`;
  }).join("");
  const axis = [0, 4, 8, 12, 16, 20, 23].map((hour) => `<text class="chart-axis" x="${left + (hour + .5) * step}" y="${height - 6}" text-anchor="middle">${pad(hour)}</text>`).join("");
  $("#throughput-chart").innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-title chart-description"><title id="chart-title">Throughput over 24 sample hours</title><desc id="chart-description">Hourly throughput ranges from ${Math.min(...values)} to ${peak}, peaking at sample hour ${pad(peakIndex)}. Values are a relative index because the source provides no units. Exact values are available below the chart.</desc>${grid}${bars}${axis}</svg>`;
  $("#peak-value").textContent = peak;
  $("#peak-hour").textContent = pad(peakIndex);
}

function renderRows(visible) {
  $("#incident-rows").innerHTML = visible.map((incident) => `<tr role="row" class="incident-row${incident.id === selectedId ? " is-selected" : ""}" data-incident-id="${escapeHTML(incident.id)}">
    <td role="cell" data-label="Incident"><button type="button" class="incident-select" aria-pressed="${incident.id === selectedId}" aria-controls="incident-detail" aria-label="Inspect ${escapeHTML(incident.id)}: ${escapeHTML(incident.title)}"><span class="incident-id">${escapeHTML(incident.id)}</span><span class="incident-title">${escapeHTML(incident.title)}</span></button></td>
    <td role="cell" data-label="Severity">${severityTag(incident.severity)}</td>
    <td role="cell" data-label="Service"><span class="service-name">${escapeHTML(incident.service)}</span></td>
    <td role="cell" data-label="Age" class="age-cell">${escapeHTML(incident.age)}</td>
    <td role="cell" data-label="Owner"${incident.owner === "Unassigned" ? ' class="unassigned"' : ""}>${escapeHTML(incident.owner)}</td>
    <td role="cell" data-label="Status">${statusPill(incident.status)}</td>
  </tr>`).join("");
}

function renderDetail(visible) {
  const incident = visible.find((item) => item.id === selectedId);
  $("#detail-index").textContent = incident ? `${pad(visible.indexOf(incident) + 1)} / ${pad(visible.length)}` : "— / —";
  if (!incident) {
    $("#detail-content").innerHTML = `<div class="detail-empty"><svg class="icon" aria-hidden="true"><use href="#icon-incidents"/></svg><p>No incident selected.<br>Adjust your filters to return to the queue.</p></div>`;
    return;
  }
  const acknowledgement = incident.acknowledgedAt;
  const note = acknowledgement
    ? "Acknowledgement is recorded. The incident remains in the active queue; acknowledgement does not mean it is resolved."
    : incident.owner === "Unassigned"
      ? "This incident has no assigned owner. Acknowledge it to record that it has been seen; ownership remains unassigned."
      : `${incident.owner} is the assigned owner. Acknowledge this incident to record that it has been seen; ownership stays with them.`;
  const time = acknowledgement ? new Date(acknowledgement) : null;
  const timeLabel = time ? time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const fullTime = time ? time.toLocaleString() : "";
  $("#detail-content").innerHTML = `<div class="detail-body">
    <div class="detail-kicker"><span class="incident-id">${escapeHTML(incident.id)}</span>${severityTag(incident.severity)}</div>
    <h3 class="detail-title">${escapeHTML(incident.title)}</h3>
    <dl class="detail-meta"><div><dt>Service</dt><dd class="service-name">${escapeHTML(incident.service)}</dd></div><div><dt>Status</dt><dd>${statusPill(incident.status)}</dd></div><div><dt>Owner</dt><dd${incident.owner === "Unassigned" ? ' class="unassigned"' : ""}>${escapeHTML(incident.owner)}</dd></div><div><dt>Reported age</dt><dd class="age-cell">${escapeHTML(incident.age)}</dd></div></dl>
    <div class="detail-note"><h4>${acknowledgement ? "Acknowledgement recorded" : "Operator handoff"}</h4><p>${escapeHTML(note)}</p></div>
    <button type="button" class="acknowledge-button" id="acknowledge-incident"${acknowledgement ? " disabled" : ""}><svg class="icon" aria-hidden="true"><use href="#icon-check"/></svg>${acknowledgement ? "Acknowledged" : "Acknowledge incident"}</button>
    <p class="action-hint">${storageAvailable ? "Saved in this browser · local demo" : "Saved for this session only"}</p>
  </div><div class="activity"><h4 class="activity-heading">Latest activity</h4><p class="activity-entry"><span class="status-dot" aria-hidden="true"></span><span>${acknowledgement ? "Acknowledged locally" : `Snapshot · ${escapeHTML(titleCase(incident.status))}`}</span>${time ? `<time datetime="${escapeHTML(acknowledgement)}" title="${escapeHTML(fullTime)}" aria-label="${escapeHTML(fullTime)}">${escapeHTML(timeLabel)}</time>` : ""}</p></div>`;
}

function renderIncidents() {
  const visible = filteredIncidents();
  if (!visible.some((incident) => incident.id === selectedId)) selectedId = visible[0]?.id ?? null;
  renderRows(visible);
  renderDetail(visible);
  $("#empty-state").hidden = visible.length !== 0;
  $(".incident-table").hidden = visible.length === 0;
  $("#result-count").textContent = `Showing ${visible.length} of ${SEED.incidents.length} incidents`;
  $("#incident-total").textContent = SEED.incidents.length;
  const unacknowledged = incidents().filter((incident) => !incident.acknowledgedAt).length;
  $("#unacknowledged-count").textContent = unacknowledged === 0 ? "All acknowledged" : `${unacknowledged} need${unacknowledged === 1 ? "s" : ""} acknowledgement`;
  $("#clear-filters").disabled = !$("#incident-search").value && $("#severity-filter").value === "all" && $("#status-filter").value === "all";
}

function selectIncident(id) {
  selectedId = id;
  document.querySelectorAll(".incident-row").forEach((row) => {
    const selected = row.dataset.incidentId === id;
    row.classList.toggle("is-selected", selected);
    row.querySelector("button").setAttribute("aria-pressed", String(selected));
  });
  renderDetail(filteredIncidents());
  if (window.matchMedia("(max-width: 1260px)").matches) {
    $("#incident-detail").focus({ preventScroll: true });
    $("#incident-detail").scrollIntoView({ block: "start" });
  } else {
    announce(`${id} selected. Incident detail updated.`);
  }
}

function announce(message) {
  clearTimeout(announcementTimer);
  $("#announcement").textContent = message;
  announcementTimer = setTimeout(() => { $("#announcement").textContent = ""; }, 6000);
}

function clearFilters() {
  $("#filters").reset();
  renderIncidents();
  $("#incident-search").focus({ preventScroll: true });
}

$("#filters").addEventListener("submit", (event) => event.preventDefault());
$("#incident-search").addEventListener("input", renderIncidents);
$("#severity-filter").addEventListener("change", renderIncidents);
$("#status-filter").addEventListener("change", renderIncidents);
$("#clear-filters").addEventListener("click", clearFilters);
$("#clear-empty-filters").addEventListener("click", clearFilters);
$("#back-to-queue").addEventListener("click", () => {
  const target = $(".incident-row.is-selected .incident-select") || $("#incident-search");
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "center" });
});
$("#incident-rows").addEventListener("click", (event) => {
  const row = event.target.closest("[data-incident-id]");
  if (row) selectIncident(row.dataset.incidentId);
});
$("#detail-content").addEventListener("click", (event) => {
  if (!event.target.closest("#acknowledge-incident") || !selectedId || acknowledgements[selectedId]) return;
  const id = selectedId;
  acknowledgements[id] = new Date().toISOString();
  persistAcknowledgements();
  renderIncidents();
  $("#incident-detail").focus({ preventScroll: true });
  announce(`${id} acknowledged. ${storageAvailable ? "Saved in this browser." : "Browser storage is unavailable; saved for this session only."}`);
});
$("#reset-demo").addEventListener("click", () => {
  acknowledgements = {};
  persistAcknowledgements();
  selectedId = SEED.incidents[0]?.id ?? null;
  $("#filters").reset();
  renderIncidents();
  announce("Demo reset. Original incident statuses and the full queue restored.");
});

document.addEventListener("keydown", (event) => {
  const editing = event.target instanceof Element && event.target.closest("input, select, textarea, [contenteditable='true']");
  if (event.key === "/" && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    $("#incident-search").focus();
  }
  if (event.key === "Escape" && event.target === $("#incident-search")) clearFilters();
});

function updateNavigation() {
  const hash = location.hash || "#overview";
  document.querySelectorAll(".nav-link").forEach((link) => {
    const current = link.getAttribute("href") === hash;
    link.classList.toggle("is-current", current);
    if (current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}
window.addEventListener("hashchange", updateNavigation);
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    acknowledgements = readAcknowledgements();
    renderIncidents();
  }
});

renderMetrics();
$("#hourly-values").innerHTML = SEED.throughput.map((value, hour) => `<div class="hourly-sample"><span>Hour ${pad(hour)}</span><strong>${value}</strong></div>`).join("");
$("#critical-count").textContent = `${SEED.incidents.filter((incident) => incident.severity === "critical").length} critical incident`;
$("#service-count").textContent = new Set(SEED.incidents.map((incident) => incident.service)).size;
renderIncidents();
renderChart();
updateNavigation();
if (typeof ResizeObserver === "function") {
  new ResizeObserver(renderChart).observe($("#throughput-chart"));
} else {
  window.addEventListener("resize", renderChart);
}
