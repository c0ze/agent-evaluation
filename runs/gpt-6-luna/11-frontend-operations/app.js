/* Offline seed mirrors DATA.json so the dashboard runs without fetch or network access. */
const seed = {
  metrics: [
    { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up" },
    { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down" },
    { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up" },
    { label: "Queue depth", value: "2,841", change: "−19%", direction: "down" }
  ],
  throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
  incidents: [
    { id: "INC-2841", severity: "critical", service: "payments-api", age: "12m", owner: "M. Chen", status: "investigating", title: "Card authorization timeouts" },
    { id: "INC-2839", severity: "high", service: "event-router", age: "31m", owner: "Unassigned", status: "open", title: "EU retry queue growth" },
    { id: "INC-2837", severity: "medium", service: "search-index", age: "1h 08m", owner: "A. Silva", status: "monitoring", title: "Index freshness outside SLO" },
    { id: "INC-2832", severity: "low", service: "webhooks", age: "3h 42m", owner: "R. Patel", status: "open", title: "Elevated partner delivery lag" }
  ]
};

const incidents = seed.incidents.map(function (incident) { return Object.assign({}, incident); });
let selectedId = incidents[0] ? incidents[0].id : null;
let toastTimer = null;

const metricGrid = document.getElementById("metric-grid");
const incidentRows = document.getElementById("incident-rows");
const detailContent = document.getElementById("detail-content");
const detailEmpty = document.getElementById("detail-empty");
const emptyState = document.getElementById("empty-state");
const tableScroll = document.querySelector(".table-scroll");
const searchInput = document.getElementById("incident-search");
const severityFilter = document.getElementById("severity-filter");
const statusFilter = document.getElementById("status-filter");

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
  });
}

function renderMetrics() {
  metricGrid.innerHTML = seed.metrics.map(function (metric, index) {
    const isWatch = metric.label === "Error rate";
    const trendClass = isWatch ? " is-watch" : "";
    const arrow = metric.direction === "up" ? "↑" : "↓";
    const context = isWatch ? "above baseline" : "vs previous hour";
    return '<article class="metric-card"><div class="metric-top"><p class="metric-label">' + escapeHTML(metric.label) + '</p><span class="metric-index">0' + (index + 1) + '</span></div><p class="metric-value">' + escapeHTML(metric.value) + '</p><div class="metric-bottom"><span class="metric-trend' + trendClass + '"><span class="trend-arrow" aria-hidden="true">' + arrow + '</span>' + escapeHTML(metric.change) + '</span><span class="metric-context">' + context + '</span></div></article>';
  }).join("");
}

function renderThroughput() {
  const chart = document.getElementById("throughput-chart");
  const metric = seed.metrics.find(function (item) { return item.label === "Events / min"; });
  const currentRate = Number(metric.value.replace(/[^0-9.]/g, ""));
  const lastValue = seed.throughput[seed.throughput.length - 1];
  const scale = currentRate / lastValue;
  const xStart = 63;
  const xEnd = 744;
  const yTop = 20;
  const yBottom = 208;
  const maxRate = 42000;
  const points = seed.throughput.map(function (value, index) {
    const x = xStart + ((xEnd - xStart) * index / (seed.throughput.length - 1));
    const y = yBottom - ((value * scale) / maxRate) * (yBottom - yTop);
    return { x: x, y: y };
  });
  const linePath = points.map(function (point, index) { return (index === 0 ? "M" : "L") + point.x.toFixed(1) + " " + point.y.toFixed(1); }).join(" ");
  const areaPath = linePath + " L" + xEnd + " " + yBottom + " L" + xStart + " " + yBottom + " Z";
  const gridValues = [40000, 30000, 20000, 10000, 0];
  const grid = gridValues.map(function (value) {
    const y = yBottom - (value / maxRate) * (yBottom - yTop);
    const label = value === 0 ? "0" : Math.round(value / 1000) + "k";
    return '<line class="chart-grid" x1="' + xStart + '" y1="' + y + '" x2="' + xEnd + '" y2="' + y + '"></line><text class="chart-axis-label" x="' + (xStart - 11) + '" y="' + (y + 3) + '" text-anchor="end">' + label + '</text>';
  }).join("");
  const timeLabels = [
    { x: xStart, text: "24h ago", anchor: "start" },
    { x: xStart + (xEnd - xStart) * .25, text: "18h ago", anchor: "middle" },
    { x: xStart + (xEnd - xStart) * .5, text: "12h ago", anchor: "middle" },
    { x: xStart + (xEnd - xStart) * .75, text: "6h ago", anchor: "middle" },
    { x: xEnd, text: "Now", anchor: "end" }
  ].map(function (label) {
    return '<text class="chart-time-label" x="' + label.x + '" y="245" text-anchor="' + label.anchor + '">' + label.text + '</text>';
  }).join("");
  const latest = points[points.length - 1];
  chart.insertAdjacentHTML("beforeend", grid + '<path class="chart-area" d="' + areaPath + '"></path><path class="chart-line" d="' + linePath + '"></path><circle class="chart-current-dot" cx="' + latest.x + '" cy="' + latest.y + '" r="4.5"></circle>' + timeLabels);
  document.getElementById("chart-current").textContent = metric.value + " / min";
}

function labelStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getVisibleIncidents() {
  const query = searchInput.value.trim().toLowerCase();
  const severity = severityFilter.value;
  const status = statusFilter.value;
  return incidents.filter(function (incident) {
    const matchesQuery = !query || [incident.id, incident.title, incident.service, incident.owner, incident.status].join(" ").toLowerCase().includes(query);
    const matchesSeverity = severity === "all" || incident.severity === severity;
    const matchesStatus = status === "all" || incident.status === status;
    return matchesQuery && matchesSeverity && matchesStatus;
  });
}

function renderIncidentRows(visible) {
  if (visible.length === 0) {
    incidentRows.innerHTML = "";
    emptyState.hidden = false;
    tableScroll.hidden = true;
  } else {
    emptyState.hidden = true;
    tableScroll.hidden = false;
    incidentRows.innerHTML = visible.map(function (incident) {
      const severity = escapeHTML(incident.severity);
      const status = escapeHTML(incident.status);
      const selected = incident.id === selectedId ? " is-selected" : "";
      return '<tr class="' + selected.trim() + '" data-id="' + escapeHTML(incident.id) + '"><td data-label="Incident"><button class="incident-button" type="button" data-select-incident="' + escapeHTML(incident.id) + '" aria-pressed="' + (incident.id === selectedId) + '"><span class="incident-id">' + escapeHTML(incident.id) + '</span><span class="incident-title">' + escapeHTML(incident.title) + '</span></button></td><td data-label="Severity"><span class="severity-label severity-' + severity + '"><span class="severity-dot" aria-hidden="true"></span>' + escapeHTML(incident.severity) + '</span></td><td data-label="Service"><span class="service-name">' + escapeHTML(incident.service) + '</span></td><td data-label="Age"><span class="age-value">' + escapeHTML(incident.age) + '</span></td><td data-label="Owner"><span class="owner-value">' + escapeHTML(incident.owner) + '</span></td><td data-label="Status"><span class="status-label status-' + status + '">' + escapeHTML(labelStatus(incident.status)) + '</span></td></tr>';
    }).join("");
  }
  const countText = "Showing " + visible.length + " of " + incidents.length + " incidents";
  document.getElementById("visible-count").textContent = countText;
  const activeCount = incidents.filter(function (incident) { return incident.status !== "resolved"; }).length;
  document.getElementById("active-incident-count").textContent = activeCount;
  document.getElementById("nav-incident-count").textContent = activeCount;
  document.getElementById("system-condition-label").textContent = activeCount ? "Action required" : "All clear";
}

function renderDetail() {
  const incident = incidents.find(function (item) { return item.id === selectedId; });
  if (!incident) {
    detailContent.innerHTML = "";
    detailEmpty.hidden = false;
    return;
  }
  detailEmpty.hidden = true;
  const acknowledged = incident.status === "acknowledged";
  const summary = incident.status === "monitoring"
    ? "The service is being monitored while the team confirms recovery and checks for a stable return to baseline."
    : incident.status === "investigating"
      ? "The on-call owner is investigating the impact and tracing the affected production path."
      : acknowledged
        ? "This incident has been acknowledged by the on-call team and is queued for active investigation."
        : "This incident is open and awaiting an on-call response. Review the affected service and acknowledge to take ownership.";
  const message = incident.ackMessage || "";
  detailContent.innerHTML = '<div class="detail-header"><div><p class="detail-overline">' + escapeHTML(incident.id) + ' <span aria-hidden="true">·</span> INCIDENT</p><h3 id="detail-heading">' + escapeHTML(incident.title) + '</h3></div><span class="severity-label severity-' + escapeHTML(incident.severity) + ' detail-status"><span class="severity-dot" aria-hidden="true"></span>' + escapeHTML(incident.severity) + '</span></div><div class="detail-service"><span class="detail-service-label">Affected service</span><span class="detail-service-name">' + escapeHTML(incident.service) + '</span></div><p class="detail-summary">' + summary + '</p><dl class="detail-facts"><div class="detail-fact"><dt>Age</dt><dd>' + escapeHTML(incident.age) + '</dd></div><div class="detail-fact"><dt>Owner</dt><dd>' + escapeHTML(incident.owner) + '</dd></div><div class="detail-fact"><dt>Response state</dt><dd>' + escapeHTML(labelStatus(incident.status)) + '</dd></div><div class="detail-fact"><dt>Severity</dt><dd>' + escapeHTML(incident.severity.toUpperCase()) + '</dd></div></dl><div class="detail-actions"><button class="acknowledge-button" id="acknowledge-button" type="button" ' + (acknowledged ? 'aria-disabled="true"' : "") + '><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.2 3.2 3.1L13 4.5"/></svg>' + (acknowledged ? "Acknowledged" : "Acknowledge incident") + '</button><p class="detail-message" id="detail-message" role="status">' + escapeHTML(message) + '</p></div>';
  const acknowledgeButton = document.getElementById("acknowledge-button");
  acknowledgeButton.addEventListener("click", acknowledgeSelected);
}

function render() {
  const visible = getVisibleIncidents();
  if (selectedId && !visible.some(function (incident) { return incident.id === selectedId; })) {
    selectedId = visible[0] ? visible[0].id : null;
  }
  renderIncidentRows(visible);
  renderDetail();
}

function acknowledgeSelected() {
  const incident = incidents.find(function (item) { return item.id === selectedId; });
  if (!incident || incident.status === "acknowledged") return;
  incident.status = "acknowledged";
  if (incident.owner === "Unassigned") incident.owner = "On-call";
  incident.ackMessage = "Acknowledged by AR just now. Response state updated.";
  render();
  if (selectedId === incident.id) {
    document.getElementById("acknowledge-button").focus();
  } else if (selectedId) {
    const selectedIncidentButton = document.querySelector('.incident-button[aria-pressed="true"]');
    if (selectedIncidentButton) selectedIncidentButton.focus();
  } else {
    document.getElementById("empty-clear").focus();
  }
  showToast(incident.id + " acknowledged and assigned to " + incident.owner + ".");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(function () { toast.hidden = true; }, 3600);
}

function clearFilters() {
  searchInput.value = "";
  severityFilter.value = "all";
  statusFilter.value = "all";
  selectedId = incidents[0] ? incidents[0].id : null;
  render();
  searchInput.focus();
}

function updateClock() {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
  document.getElementById("sync-time").textContent = time + " UTC";
}

renderMetrics();
renderThroughput();
render();
updateClock();
window.setInterval(updateClock, 30000);

searchInput.addEventListener("input", render);
severityFilter.addEventListener("change", render);
statusFilter.addEventListener("change", render);
document.getElementById("clear-filters").addEventListener("click", clearFilters);
document.getElementById("empty-clear").addEventListener("click", clearFilters);
document.querySelectorAll(".nav-link").forEach(function (link) {
  link.addEventListener("click", function () {
    document.querySelectorAll(".nav-link").forEach(function (item) {
      item.classList.remove("is-active");
      item.removeAttribute("aria-current");
    });
    link.classList.add("is-active");
    link.setAttribute("aria-current", "page");
  });
});

incidentRows.addEventListener("click", function (event) {
  const button = event.target.closest("[data-select-incident]");
  if (!button) return;
  selectedId = button.getAttribute("data-select-incident");
  render();
});
document.addEventListener("keydown", function (event) {
  if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && document.activeElement !== searchInput && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && document.activeElement === searchInput && searchInput.value) {
    searchInput.value = "";
    render();
  }
});
