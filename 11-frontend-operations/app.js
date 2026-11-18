"use strict";

// Embedded from DATA.json so the dashboard can open directly from disk.
const snapshot = {
  metrics: [
    { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up" },
    { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down" },
    { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up" },
    { label: "Queue depth", value: "2,841", change: "−19%", direction: "down" },
  ],
  throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
  incidents: [
    { id: "INC-2841", severity: "critical", service: "payments-api", age: "12m", owner: "M. Chen", status: "investigating", title: "Card authorization timeouts" },
    { id: "INC-2839", severity: "high", service: "event-router", age: "31m", owner: "Unassigned", status: "open", title: "EU retry queue growth" },
    { id: "INC-2837", severity: "medium", service: "search-index", age: "1h 08m", owner: "A. Silva", status: "monitoring", title: "Index freshness outside SLO" },
    { id: "INC-2832", severity: "low", service: "webhooks", age: "3h 42m", owner: "R. Patel", status: "open", title: "Elevated partner delivery lag" },
  ],
};

const summaries = {
  "INC-2841": "Intermittent upstream processor timeouts are delaying card authorizations.",
  "INC-2839": "Retry volume in the EU region has outpaced queue drain. Event delivery is delayed.",
  "INC-2837": "Search indexing is running behind the freshness target. New content may take longer to appear.",
  "INC-2832": "Partner endpoints are responding slowly, extending webhook delivery times.",
};

const find = (id) => document.getElementById(id);
const titleCase = (word) => word[0].toUpperCase() + word.slice(1);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const hourLabel = (hour) => `${String(hour).padStart(2, "0")}:00 UTC`;

function renderMetrics() {
  find("metrics").innerHTML = snapshot.metrics.map((metric) => {
    const [number, unit] = metric.value.split(" ");
    const trendClass = metric.label === "Error rate" ? " is-adverse" : "";
    return `
      <div class="metric">
        <dt>${metric.label}</dt>
        <dd class="metric-number">${number}${unit ? `<span class="metric-unit"> ${unit}</span>` : ""}</dd>
        <dd class="metric-context">
          <span class="metric-trend${trendClass}">${icon(`${metric.direction}-right`)}${metric.change}</span>
          <span>vs. previous hour</span>
        </dd>
      </div>`;
  }).join("");
}

function renderChart() {
  const levels = snapshot.throughput;
  const peak = levels.indexOf(Math.max(...levels));
  const bars = find("bars");
  const label = find("chart-label");
  const value = find("chart-value");
  const hour = find("chart-hour");
  let selectedHour = peak;
  let tabStop = peak;

  bars.innerHTML = levels.map((level, index) => `
    <button class="bar" style="--level: ${level}%" type="button"
      aria-label="${hourLabel(index)}, ${level}% of capacity${index === peak ? ", peak" : ""}"
      aria-pressed="${index === selectedHour}" tabindex="${index === tabStop ? 0 : -1}"></button>
  `).join("");

  const buttons = Array.from(bars.children);

  function showHour(index) {
    label.textContent = index === peak ? "Peak throughput" : "Throughput";
    value.textContent = `${levels[index]}%`;
    hour.textContent = hourLabel(index);
  }

  function setTabStop(index) {
    buttons[tabStop].tabIndex = -1;
    buttons[index].tabIndex = 0;
    tabStop = index;
  }

  buttons.forEach((button, index) => {
    button.addEventListener("pointerenter", () => showHour(index));
    button.addEventListener("focus", () => {
      setTabStop(index);
      showHour(index);
    });
    button.addEventListener("click", () => {
      buttons[selectedHour].setAttribute("aria-pressed", "false");
      selectedHour = index;
      button.setAttribute("aria-pressed", "true");
      setTabStop(index);
      showHour(index);
    });
  });

  bars.addEventListener("pointerleave", () => {
    const focusedIndex = buttons.indexOf(document.activeElement);
    showHour(focusedIndex < 0 ? selectedHour : focusedIndex);
  });

  bars.addEventListener("focusout", (event) => {
    if (!bars.contains(event.relatedTarget)) showHour(selectedHour);
  });

  bars.addEventListener("keydown", (event) => {
    const nextHour = {
      ArrowLeft: Math.max(0, tabStop - 1),
      ArrowRight: Math.min(levels.length - 1, tabStop + 1),
      Home: 0,
      End: levels.length - 1,
    }[event.key];

    if (nextHour === undefined) return;
    event.preventDefault();
    buttons[nextHour].focus();
  });

  showHour(peak);
}

const search = find("incident-search");
const severityFilter = find("severity-filter");
const statusFilter = find("status-filter");
const rows = find("incident-rows");
const detail = find("incident-detail");
const detailContent = find("detail-content");
const detailBack = find("detail-back");
const announcements = find("announcements");
const snapshotTime = new Date(document.querySelector(".snapshot-time").dateTime);
const acknowledgementKey = (id) => `relay:${snapshotTime.toISOString()}:${id}:acknowledged`;
const utcDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const utcTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
let selectedId = snapshot.incidents[0]?.id;
let visibleIncidents = [];

function isAcknowledged(id) {
  try {
    return localStorage.getItem(acknowledgementKey(id)) === "true";
  } catch {
    return false;
  }
}

const incidents = snapshot.incidents.map((incident) => ({
  ...incident,
  status: isAcknowledged(incident.id) ? "acknowledged" : incident.status,
}));

function saveAcknowledgement(id) {
  try {
    localStorage.setItem(acknowledgementKey(id), "true");
  } catch {
    // In-memory state still applies during this visit.
  }
}

function severityBadge(severity) {
  return `<span class="severity severity-${severity}">${titleCase(severity)}</span>`;
}

function statusLabel(status) {
  return `<span class="row-status" data-status="${status}">${titleCase(status)}</span>`;
}

function incidentRow(incident) {
  return `
    <tr role="row" data-incident="${incident.id}">
      <td role="cell">
        <button class="incident-trigger" type="button" aria-controls="incident-detail">
          <span class="incident-name">${incident.title}</span>
          <span class="incident-id">${incident.id}</span>
        </button>
      </td>
      <td role="cell">${severityBadge(incident.severity)}</td>
      <td role="cell"><span class="cell-label" aria-hidden="true">Service</span><span class="service">${incident.service}</span></td>
      <td role="cell"><span class="cell-label" aria-hidden="true">Age</span><span class="age">${incident.age}</span></td>
      <td role="cell"><span class="cell-label" aria-hidden="true">Owner</span>${incident.owner}</td>
      <td role="cell">${statusLabel(incident.status)}</td>
    </tr>`;
}

function renderDetails(incident) {
  if (!incident) {
    detailContent.innerHTML = '<p class="detail-empty">No incident selected. Clear your filters to view available incidents.</p>';
    return;
  }

  const hours = Number(incident.age.match(/(\d+)h/)?.[1] ?? 0);
  const minutes = Number(incident.age.match(/(\d+)m/)?.[1] ?? 0);
  const opened = new Date(snapshotTime.getTime() - (hours * 60 + minutes) * 60_000);
  const action = incident.status === "acknowledged"
    ? `<p class="acknowledged">${icon("check")} Incident acknowledged</p>`
    : `<button class="button button-primary" type="button" id="acknowledge">${icon("check")} Acknowledge incident</button>`;

  detailContent.innerHTML = `
    <div class="detail-body">
      <div class="detail-reference">
        <span class="incident-id">${incident.id}</span>
        ${severityBadge(incident.severity)}
      </div>
      <h3 class="detail-name">${incident.title}</h3>
      <p class="detail-summary">${summaries[incident.id]}</p>
      <dl class="detail-facts">
        <div><dt>Service</dt><dd class="service">${incident.service}</dd></div>
        <div><dt>Owner</dt><dd>${incident.owner}</dd></div>
        <div><dt>Status</dt><dd>${statusLabel(incident.status)}</dd></div>
        <div><dt>Opened</dt><dd><time datetime="${opened.toISOString()}">${utcDate.format(opened)} · ${utcTime.format(opened)}</time></dd></div>
      </dl>
      <div class="detail-action">${action}</div>
    </div>`;
}

function updateSelection() {
  const selected = visibleIncidents.find((incident) => incident.id === selectedId);

  for (const row of rows.children) {
    const isSelected = row.dataset.incident === selectedId;
    row.classList.toggle("is-selected", isSelected);
    const trigger = row.querySelector(".incident-trigger");
    if (isSelected) trigger.setAttribute("aria-current", "true");
    else trigger.removeAttribute("aria-current");
  }

  renderDetails(selected);
}

function updateIncidents() {
  const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const severity = severityFilter.value;
  const status = statusFilter.value;
  const filtered = Boolean(terms.length || severity || status);

  visibleIncidents = incidents.filter((incident) => {
    const searchable = Object.values(incident).join(" ").toLowerCase();
    return (!severity || incident.severity === severity)
      && (!status || incident.status === status)
      && terms.every((term) => searchable.includes(term));
  });

  if (!visibleIncidents.some((incident) => incident.id === selectedId)) selectedId = visibleIncidents[0]?.id;

  const hasMatches = visibleIncidents.length > 0;
  rows.innerHTML = visibleIncidents.map(incidentRow).join("");
  rows.closest("table").hidden = !hasMatches;
  find("empty-incidents").hidden = hasMatches;
  find("reset-filters").hidden = !filtered || !hasMatches;
  const count = `Showing ${visibleIncidents.length} of ${incidents.length} incidents`;
  find("result-count").textContent = filtered ? count : "Ages shown at snapshot time";
  updateSelection();
  return count;
}

function applyFilters() {
  announcements.textContent = updateIncidents();
}

function clearFilters() {
  search.value = "";
  severityFilter.value = "";
  statusFilter.value = "";
  applyFilters();
  search.focus();
}

function selectIncident(event) {
  const row = event.target.closest("[data-incident]");
  if (!row) return;

  selectedId = row.dataset.incident;
  updateSelection();

  if (detailBack.getClientRects().length) {
    detail.focus({ preventScroll: true });
    detail.scrollIntoView({ block: "start" });
  } else {
    row.querySelector(".incident-trigger").focus({ preventScroll: true });
    const selected = visibleIncidents.find((incident) => incident.id === selectedId);
    announcements.textContent = `Showing details for ${selected.title}.`;
  }
}

function acknowledgeIncident(event) {
  if (!event.target.closest("#acknowledge")) return;
  const incident = incidents.find((item) => item.id === selectedId);
  if (!incident || incident.status === "acknowledged") return;

  incident.status = "acknowledged";
  saveAcknowledgement(incident.id);
  updateIncidents();

  if (selectedId === incident.id) {
    detail.focus({ preventScroll: true });
    announcements.textContent = `${incident.id} acknowledged.`;
  } else {
    const target = rows.querySelector('[aria-current="true"]') ?? search;
    target.focus();
    announcements.textContent = `${incident.id} acknowledged and removed from the current filter results.`;
  }
}

function focusSearch() {
  search.focus();
  search.select();
}

function setNavigationLocation() {
  const section = ["#throughput", "#incidents"].includes(location.hash) ? location.hash : "#overview";
  for (const link of document.querySelectorAll(".rail-nav a")) {
    if (link.hash === section) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

renderMetrics();
renderChart();
find("nav-count").textContent = incidents.length;
find("incident-count").textContent = incidents.length;
updateIncidents();
setNavigationLocation();

window.addEventListener("hashchange", setNavigationLocation);
search.form.addEventListener("submit", (event) => event.preventDefault());
search.addEventListener("input", applyFilters);
severityFilter.addEventListener("change", applyFilters);
statusFilter.addEventListener("change", applyFilters);
find("reset-filters").addEventListener("click", clearFilters);
find("clear-filters").addEventListener("click", clearFilters);
rows.addEventListener("click", selectIncident);
detailContent.addEventListener("click", acknowledgeIncident);
detailBack.addEventListener("click", () => {
  const target = rows.querySelector('[aria-current="true"]') ?? search;
  target.focus();
  target.scrollIntoView({ block: "nearest" });
});
find("search-shortcut").addEventListener("click", focusSearch);
document.addEventListener("keydown", (event) => {
  const editing = event.target.closest("input, textarea, select, [contenteditable]");
  if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey || editing) return;
  event.preventDefault();
  focusSearch();
});
