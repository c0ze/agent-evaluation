"use strict";

// Embedded from DATA.json so file:// works without fetching any resource.
const SEED_DATA = {
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

const RESPONSE_CONTEXT = {
  "INC-2841": {
    description: "Card authorization requests are timing out in the payments API. The incident is under investigation.",
    guidance: "Inspect recent request traces and compare upstream provider response times. Check retry behavior before making changes."
  },
  "INC-2839": {
    description: "The EU retry queue is growing in the event routing path. This incident still needs an owner.",
    guidance: "Assign a responder, check consumer health, and inspect repeated delivery failures in the EU routing path."
  },
  "INC-2837": {
    description: "Search index freshness is outside its service-level objective. The assigned responder is monitoring the incident.",
    guidance: "Compare ingestion lag with indexing progress. Continue monitoring freshness before declaring recovery."
  },
  "INC-2832": {
    description: "Partner webhook deliveries are experiencing elevated lag. The incident remains open with an assigned owner.",
    guidance: "Check delivery retries and partner endpoint responses. Prioritize the oldest pending deliveries."
  }
};

const STORAGE_KEY = "relay.acknowledgments.v1";
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const byId = (id) => document.getElementById(id);
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const hourLabel = (hour) => `${String(hour).padStart(2, "0")}:00`;

let storageAvailable = true;
let acknowledgments = readAcknowledgments();
let selectedId = SEED_DATA.incidents[0]?.id ?? null;
let selectedHour = SEED_DATA.throughput.indexOf(Math.max(...SEED_DATA.throughput));
const filters = { search: "", severity: "all", status: "all" };

function readAcknowledgments() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const valid = {};
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      for (const incident of SEED_DATA.incidents) {
        const timestamp = stored[incident.id];
        if (typeof timestamp === "string" && Number.isFinite(Date.parse(timestamp))) {
          valid[incident.id] = timestamp;
        }
      }
    }
    return valid;
  } catch {
    storageAvailable = false;
    return {};
  }
}

function saveAcknowledgments() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(acknowledgments));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}

function incidentsWithState() {
  return SEED_DATA.incidents.map((incident) => ({
    ...incident,
    status: acknowledgments[incident.id] ? "acknowledged" : incident.status,
    acknowledgedAt: acknowledgments[incident.id] || null
  }));
}

function filteredIncidents() {
  const search = filters.search.trim().toLocaleLowerCase();
  return incidentsWithState()
    .filter((incident) => {
      const searchable = [incident.id, incident.title, incident.service, incident.owner].join(" ").toLocaleLowerCase();
      return (!search || searchable.includes(search)) &&
        (filters.severity === "all" || incident.severity === filters.severity) &&
        (filters.status === "all" || incident.status === filters.status);
    })
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function badge(type, value) {
  return element("span", `${type}-badge ${type}-${value}`, capitalize(value));
}

function renderMetrics() {
  const fragment = document.createDocumentFragment();
  SEED_DATA.metrics.forEach((metric) => {
    const card = element("article", "metric");
    const label = element("h2", "metric-label", metric.label);
    const value = element("p", "metric-value");
    const [number, unit] = metric.value.split(" ");
    value.append(document.createTextNode(number));
    if (unit) value.append(element("span", "metric-unit", unit));
    const trend = element("p", "metric-trend");
    const change = element("span", `metric-change${metric.label === "Error rate" ? " is-caution" : ""}`);
    const arrow = element("span", "", metric.direction === "up" ? "↗" : "↘");
    arrow.setAttribute("aria-hidden", "true");
    change.append(arrow, document.createTextNode(metric.change));
    const direction = element("span", "sr-only", `${metric.direction === "up" ? "Increase" : "Decrease"} of `);
    change.prepend(direction);
    trend.append(change, element("span", "trend-context", "vs. prior period"));
    card.append(label, value, trend);
    fragment.append(card);
  });
  byId("metrics").replaceChildren(fragment);
}

function renderChart() {
  const bars = document.createDocumentFragment();
  const values = document.createDocumentFragment();
  SEED_DATA.throughput.forEach((value, hour) => {
    const item = element("li");
    const button = element("button", "chart-bar");
    button.type = "button";
    button.dataset.hour = String(hour);
    button.setAttribute("aria-label", `${hourLabel(hour)} to ${hourLabel(hour + 1)} UTC: ${value} relative volume`);
    button.title = `${hourLabel(hour)}–${hourLabel(hour + 1)} UTC · ${value} relative volume`;
    const fill = element("span", "chart-bar-fill");
    fill.style.height = `${value}%`;
    fill.setAttribute("aria-hidden", "true");
    button.append(fill);
    item.append(button);
    bars.append(item);
    const pair = element("div");
    pair.append(element("dt", "", hourLabel(hour)), element("dd", "", String(value)));
    values.append(pair);
  });
  byId("chart-bars").replaceChildren(bars);
  byId("hour-values").replaceChildren(values);
  const peak = Math.max(...SEED_DATA.throughput);
  const peakHour = SEED_DATA.throughput.indexOf(peak);
  const average = SEED_DATA.throughput.reduce((sum, value) => sum + value, 0) / SEED_DATA.throughput.length;
  byId("chart-peak").textContent = `Peak ${peak} · ${hourLabel(peakHour)}`;
  byId("chart-average").textContent = `24h average ${average.toFixed(1)}`;
  selectHour(selectedHour);
}

function selectHour(hour, focus = false) {
  selectedHour = hour;
  const buttons = byId("chart-bars").querySelectorAll("button");
  buttons.forEach((button, index) => {
    button.tabIndex = index === hour ? 0 : -1;
    button.setAttribute("aria-pressed", String(index === hour));
  });
  const readout = byId("chart-readout");
  readout.replaceChildren(
    document.createTextNode(`${hourLabel(hour)}–${hourLabel(hour + 1)} UTC · `),
    element("strong", "", String(SEED_DATA.throughput[hour])),
    document.createTextNode(" volume")
  );
  if (focus) buttons[hour].focus({ preventScroll: true });
}

function cell(className, label, content) {
  const node = element("td", className);
  node.setAttribute("role", "cell");
  const mobileLabel = element("span", "cell-label", label);
  mobileLabel.setAttribute("aria-hidden", "true");
  node.append(mobileLabel, typeof content === "string" ? document.createTextNode(content) : content);
  return node;
}

function renderRows(incidents) {
  const fragment = document.createDocumentFragment();
  for (const incident of incidents) {
    const row = element("tr", "incident-row");
    row.setAttribute("role", "row");
    row.dataset.incidentId = incident.id;
    const select = element("button", "incident-select");
    select.type = "button";
    select.dataset.selectId = incident.id;
    select.setAttribute("aria-controls", "incident-detail");
    select.setAttribute("aria-label", `View ${incident.id}: ${incident.title}`);
    select.append(element("span", "incident-id", incident.id), element("span", "incident-title", incident.title));
    const incidentCell = element("td", "cell-incident");
    incidentCell.setAttribute("role", "cell");
    incidentCell.append(select);
    row.append(
      incidentCell,
      cell("cell-severity", "Severity", badge("severity", incident.severity)),
      cell("cell-service", "Service", incident.service),
      cell("cell-age", "Age", incident.age),
      cell(`cell-owner${incident.owner === "Unassigned" ? " is-unassigned" : ""}`, "Owner", incident.owner),
      cell("cell-status", "Status", badge("status", incident.status))
    );
    fragment.append(row);
  }
  byId("incident-rows").replaceChildren(fragment);
  syncSelection();
}

function syncSelection() {
  byId("incident-rows").querySelectorAll("tr").forEach((row) => {
    const selected = row.dataset.incidentId === selectedId;
    row.classList.toggle("is-selected", selected);
    row.querySelector("button").setAttribute("aria-pressed", String(selected));
  });
}

function utcTime(timestamp) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(timestamp));
}

function activityEntry(title, context, className = "") {
  const item = element("li", className);
  item.append(element("strong", "", title), element("span", "", context));
  return item;
}

function renderDetail() {
  const incident = incidentsWithState().find((item) => item.id === selectedId);
  byId("detail-content").hidden = !incident;
  byId("detail-empty").hidden = Boolean(incident);
  byId("incident-detail").setAttribute("aria-labelledby", incident ? "detail-heading" : "detail-empty-heading");
  document.querySelector(".detail-selection-label").textContent = incident ? "Selected" : "No selection";
  if (!incident) return;

  const context = RESPONSE_CONTEXT[incident.id];
  byId("detail-id").textContent = incident.id;
  byId("detail-heading").textContent = incident.title;
  byId("detail-description").textContent = context.description;
  const severity = byId("detail-severity");
  severity.className = `severity-badge severity-${incident.severity}`;
  severity.textContent = capitalize(incident.severity);
  byId("detail-service").textContent = incident.service;
  const status = byId("detail-status");
  status.className = `status-badge status-${incident.status}`;
  status.textContent = capitalize(incident.status);
  byId("detail-age").textContent = incident.age;
  byId("detail-owner").textContent = incident.owner;
  byId("detail-avatar").textContent = incident.owner === "Unassigned" ? "—" : incident.owner.split(" ").map((word) => word[0]).join("");
  byId("detail-guidance").textContent = context.guidance;

  const original = SEED_DATA.incidents.find((item) => item.id === incident.id);
  const entries = [
    activityEntry("Incident detected", `${incident.age} ago · ${incident.service}`),
    activityEntry(`Snapshot: ${capitalize(original.status)}`, original.owner === "Unassigned" ? "Owner unassigned" : `Owner: ${original.owner}`)
  ];
  if (incident.acknowledgedAt) entries.push(activityEntry("Acknowledged by you", `${utcTime(incident.acknowledgedAt)} UTC · on this device`, "ack-event"));
  byId("detail-activity").replaceChildren(...entries);
  byId("acknowledge").disabled = Boolean(incident.acknowledgedAt);
  byId("acknowledge-label").textContent = incident.acknowledgedAt ? "Incident acknowledged" : "Acknowledge incident";
  byId("acknowledge-note").textContent = incident.acknowledgedAt
    ? (storageAvailable ? "Saved on this device. The incident remains active." : "Saved for this session. The incident remains active.")
    : "Records that you have seen this incident.";
  byId("undo-acknowledge").hidden = !incident.acknowledgedAt;
}

function refreshIncidents() {
  const previouslyFocusedId = document.activeElement?.dataset.selectId;
  const incidents = filteredIncidents();
  if (!incidents.some((incident) => incident.id === selectedId)) selectedId = incidents[0]?.id ?? null;
  renderRows(incidents);
  renderDetail();
  const empty = incidents.length === 0;
  byId("incident-table").hidden = empty;
  byId("incidents-empty").hidden = !empty;
  const searching = filters.search.trim();
  byId("empty-description").textContent = searching
    ? `No results for “${searching}” with these filters. Try a service, incident ID, or owner.`
    : "No incidents match these severity and status filters. Try a broader combination.";
  byId("filter-summary").textContent = `${incidents.length} of ${SEED_DATA.incidents.length} incidents shown`;
  byId("reset-filters").disabled = !filters.search && filters.severity === "all" && filters.status === "all";
  document.querySelector(".search-field").classList.toggle("has-query", Boolean(filters.search));
  if (previouslyFocusedId) {
    const button = [...byId("incident-rows").querySelectorAll("button")].find((item) => item.dataset.selectId === previouslyFocusedId);
    (button || byId("incident-search")).focus({ preventScroll: true });
  }
}

function selectIncident(id, moveToDetail = false) {
  if (!filteredIncidents().some((incident) => incident.id === id)) return;
  selectedId = id;
  syncSelection();
  renderDetail();
  if (moveToDetail) {
    byId("detail-heading").focus({ preventScroll: true });
    byId("incident-detail").scrollIntoView({ block: "start", behavior: "instant" });
  } else {
    const button = [...byId("incident-rows").querySelectorAll("button")].find((item) => item.dataset.selectId === id);
    button.focus({ preventScroll: true });
    byId("announcements").textContent = `${id} selected. Details updated.`;
  }
}

function clearFilters() {
  filters.search = "";
  filters.severity = "all";
  filters.status = "all";
  byId("incident-search").value = "";
  byId("severity-filter").value = "all";
  byId("status-filter").value = "all";
  refreshIncidents();
  byId("incident-search").focus({ preventScroll: true });
}

function acknowledgeIncident(undo = false) {
  const id = selectedId;
  if (!id || (!undo && acknowledgments[id])) return;
  if (undo) delete acknowledgments[id];
  else acknowledgments[id] = new Date().toISOString();
  saveAcknowledgments();
  refreshIncidents();
  const remainsVisible = selectedId === id;
  const message = undo ? `${id} acknowledgment undone. Original status restored.` : `${id} acknowledged. The incident remains active.`;
  byId("announcements").textContent = message + (remainsVisible ? "" : " It no longer matches the current filters.") + (storageAvailable ? "" : " Browser storage is unavailable; changes last for this session.");
  // Keep focus on an available action when acknowledgment changes the filter result.
  if (!remainsVisible) byId("incident-search").focus({ preventScroll: true });
  else (undo ? byId("acknowledge") : byId("undo-acknowledge")).focus({ preventScroll: true });
}

function wireInteractions() {
  document.querySelector(".filters").addEventListener("submit", (event) => event.preventDefault());
  byId("incident-search").addEventListener("input", (event) => {
    filters.search = event.target.value;
    refreshIncidents();
  });
  byId("severity-filter").addEventListener("change", (event) => {
    filters.severity = event.target.value;
    refreshIncidents();
  });
  byId("status-filter").addEventListener("change", (event) => {
    filters.status = event.target.value;
    refreshIncidents();
  });
  byId("reset-filters").addEventListener("click", clearFilters);
  byId("empty-reset").addEventListener("click", clearFilters);
  byId("incident-rows").addEventListener("click", (event) => {
    const row = event.target.closest("[data-incident-id]");
    if (row) selectIncident(row.dataset.incidentId, matchMedia("(max-width: 1199px)").matches);
  });
  byId("acknowledge").addEventListener("click", () => acknowledgeIncident());
  byId("undo-acknowledge").addEventListener("click", () => acknowledgeIncident(true));

  byId("chart-bars").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-hour]");
    if (button) selectHour(Number(button.dataset.hour));
  });
  byId("chart-bars").addEventListener("keydown", (event) => {
    const button = event.target.closest("button[data-hour]");
    if (!button) return;
    const hour = Number(button.dataset.hour);
    let next = hour;
    if (event.key === "ArrowRight") next = Math.min(hour + 1, SEED_DATA.throughput.length - 1);
    else if (event.key === "ArrowLeft") next = Math.max(hour - 1, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = SEED_DATA.throughput.length - 1;
    else return;
    event.preventDefault();
    selectHour(next, true);
  });
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const editing = event.target.closest("input, textarea, select, [contenteditable='true']");
    if (event.key === "/" && !editing) {
      event.preventDefault();
      byId("incident-search").focus();
    } else if (event.key === "Escape" && event.target === byId("incident-search")) {
      event.preventDefault();
      byId("incident-search").value = "";
      filters.search = "";
      refreshIncidents();
    }
  });
  const links = [...document.querySelectorAll(".rail-link")];
  const syncNavigation = () => {
    const current = ["#overview", "#throughput", "#incidents"].includes(location.hash) ? location.hash : "#overview";
    links.forEach((link) => {
      if (link.getAttribute("href") === current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };
  window.addEventListener("hashchange", syncNavigation);
  syncNavigation();
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      const focusedAction = ["acknowledge", "undo-acknowledge"].includes(document.activeElement?.id);
      acknowledgments = readAcknowledgments();
      refreshIncidents();
      if (focusedAction) (selectedId ? byId("detail-heading") : byId("incident-search")).focus({ preventScroll: true });
      byId("announcements").textContent = "Acknowledgments updated from another local tab.";
    }
  });
}

renderMetrics();
renderChart();
refreshIncidents();
byId("rail-count").textContent = String(SEED_DATA.incidents.length);
byId("incident-total").textContent = String(SEED_DATA.incidents.length);
const criticalCount = SEED_DATA.incidents.filter((incident) => incident.severity === "critical").length;
byId("critical-summary").textContent = `${criticalCount} critical incident${criticalCount === 1 ? "" : "s"}`;
wireInteractions();
