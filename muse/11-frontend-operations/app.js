/* Relay dashboard — vanilla JS. Data below is seeded from DATA.json
   (inlined so the page works offline with zero network requests). */
"use strict";

/* ---------------- Seed data (from DATA.json) ---------------- */
const METRICS = [
  { label: "Events / min", value: "18,420",  change: "+8.2%",   direction: "up",   tone: "good", base: "vs prev hr" },
  { label: "P95 latency",  value: "184 ms",  change: "−12 ms",  direction: "down", tone: "good", base: "vs prev hr" },
  { label: "Error rate",   value: "0.37%",   change: "+0.08 pp",direction: "up",   tone: "bad",  base: "vs prev hr" },
  { label: "Queue depth",  value: "2,841",   change: "−19%",    direction: "down", tone: "good", base: "vs prev hr" },
];

const THROUGHPUT = [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73,
                    68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41];

const INCIDENTS = [
  {
    id: "INC-2841", severity: "critical", service: "payments-api",
    age: "12m", owner: "M. Chen", status: "investigating",
    title: "Card authorization timeouts",
    desc: "Authorization p99 exceeded 2 s for 11 of the last 15 minutes on the us-east PSP route. Issuer approvals are succeeding on retry; no double-charges detected so far. Failover to the secondary acquirer is staged.",
    signals: [
      { k: "auth p99", v: "2.31 s", flag: "crit" },
      { k: "issuer 5xx", v: "4.1%", flag: "warn" },
      { k: "retry success", v: "96.8%", flag: "" },
    ],
    timeline: [
      { t: "12m ago", e: "Alert fired: auth p99 > 2 s (5-min window)" },
      { t: "9m ago", e: "M. Chen paged in, opened bridge" },
      { t: "4m ago", e: "Secondary acquirer warmup started", now: true },
    ],
    playbook: "RB-114",
  },
  {
    id: "INC-2839", severity: "high", service: "event-router",
    age: "31m", owner: "Unassigned", status: "open",
    title: "EU retry queue growth",
    desc: "The eu-west retry topic is growing at ~1.2k messages/min after three downstream consumers began rejecting batches with 429s. No data loss; oldest message lag is 26 minutes and climbing.",
    signals: [
      { k: "retry lag", v: "26 min", flag: "warn" },
      { k: "consumer 429s", v: "18%", flag: "warn" },
      { k: "oldest msg", v: "INC region eu-west", flag: "" },
    ],
    timeline: [
      { t: "31m ago", e: "Alert fired: retry depth > 50k" },
      { t: "22m ago", e: "Consumers scaled +4 replicas, no relief", now: true },
    ],
    playbook: "RB-087",
  },
  {
    id: "INC-2837", severity: "medium", service: "search-index",
    age: "1h 08m", owner: "A. Silva", status: "monitoring",
    title: "Index freshness outside SLO",
    desc: "Document freshness for the product catalog index drifted to 9 minutes against a 5-minute SLO after a shard rebalance stalled. Queries are healthy; only recency is affected.",
    signals: [
      { k: "freshness", v: "9.2 min", flag: "warn" },
      { k: "query p95", v: "141 ms", flag: "" },
      { k: "stalled shards", v: "2 of 48", flag: "" },
    ],
    timeline: [
      { t: "1h 08m ago", e: "Rebalance stalled on shards 17, 29" },
      { t: "44m ago", e: "A. Silva resumed rebalance manually" },
      { t: "10m ago", e: "Freshness recovering, watching SLO", now: true },
    ],
    playbook: "RB-052",
  },
  {
    id: "INC-2832", severity: "low", service: "webhooks",
    age: "3h 42m", owner: "R. Patel", status: "open",
    title: "Elevated partner delivery lag",
    desc: "Two long-tail partners are acknowledging deliveries slowly (median +400 ms), pushing the 99th percentile past the internal target. Retries are absorbing the gap; no customer impact reported.",
    signals: [
      { k: "delivery p99", v: "8.4 s", flag: "" },
      { k: "partners slow", v: "2 of 61", flag: "" },
      { k: "retry absorbs", v: "99.7%", flag: "" },
    ],
    timeline: [
      { t: "3h 42m ago", e: "p99 delivery crossed 8 s target" },
      { t: "2h 05m ago", e: "R. Patel opened ticket with partner", now: true },
    ],
    playbook: "RB-031",
  },
];

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS_LABEL = {
  open: "Open", investigating: "Investigating", monitoring: "Monitoring",
  acknowledged: "Acknowledged", resolved: "Resolved",
};

/* ---------------- State ---------------- */
const state = { q: "", severity: "all", status: "all", selectedId: INCIDENTS[0].id };

/* ---------------- Helpers ---------------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function announce(msg) { $("announcer").textContent = msg; }
function pad(n) { return String(n).padStart(2, "0"); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---------------- Status bar: clock + alert count ---------------- */
function tickClock() {
  const d = new Date();
  const s = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
  const el = $("clock");
  el.textContent = s;
  el.setAttribute("datetime", d.toISOString());
}

function refreshAlertPill() {
  const n = INCIDENTS.filter((i) =>
    (i.severity === "critical" || i.severity === "high") &&
    (i.status === "open" || i.status === "investigating")).length;
  $("alertCount").textContent = n === 0 ? "All clear" : `${n} active alert${n === 1 ? "" : "s"}`;
  const pill = $("alertPill");
  pill.classList.toggle("is-clear", n === 0);
  const dot = pill.querySelector(".dot");
  dot.classList.toggle("dot-clear", n === 0);
  dot.classList.toggle("dot-alert", n !== 0);
  $("railBadge").textContent = String(INCIDENTS.filter((i) => i.status !== "resolved").length);
}

/* ---------------- Metrics ---------------- */
function renderMetrics() {
  $("metricsList").innerHTML = METRICS.map((m) => `
    <li class="metric">
      <div class="metric-label">${esc(m.label)}</div>
      <div class="metric-value">${esc(m.value)}</div>
      <div class="metric-delta ${esc(m.tone)}">
        <span class="arrow" aria-hidden="true">${m.direction === "up" ? "▲" : "▼"}</span>
        ${esc(m.change)} <span class="metric-base">· ${esc(m.base)}</span>
      </div>
    </li>`).join("");
}

/* ---------------- Throughput chart (inline SVG) ---------------- */
function hourLabel(offsetH) {
  const d = new Date(Date.now() - offsetH * 3600_000);
  return `${pad(d.getUTCHours())}:00`;
}

function renderChart() {
  const W = 720, H = 220, PL = 36, PR = 8, PT = 12, PB = 26;
  const max = 100;
  const cw = W - PL - PR, ch = H - PT - PB;
  const n = THROUGHPUT.length;
  const slot = cw / n, barW = Math.max(2, slot - 4);
  const peakIdx = THROUGHPUT.indexOf(Math.max(...THROUGHPUT));
  const x = (i) => PL + i * slot + (slot - barW) / 2;
  const y = (v) => PT + ch - (v / max) * ch;

  let grid = "";
  for (const t of [0, 25, 50, 75, 100]) {
    const gy = y(t);
    grid += `<line class="chart-grid" x1="${PL}" y1="${gy}" x2="${W - PR}" y2="${gy}"/>` +
            `<text class="chart-tick" x="${PL - 6}" y="${gy + 3}" text-anchor="end">${t}k</text>`;
  }
  let bars = "";
  THROUGHPUT.forEach((v, i) => {
    const ago = n - 1 - i;
    bars += `<g><title>${hourLabel(ago)} UTC — ${v}k events/min</title>` +
      `<rect class="chart-bar${i === peakIdx ? " peak" : ""}" data-i="${i}" ` +
      `x="${x(i).toFixed(1)}" y="${y(v).toFixed(1)}" width="${barW.toFixed(1)}" ` +
      `height="${(PT + ch - y(v)).toFixed(1)}" rx="1"/></g>`;
  });
  let xticks = "";
  [0, 6, 12, 18, 23].forEach((i) => {
    xticks += `<text class="chart-tick" x="${(PL + i * slot + slot / 2).toFixed(1)}" ` +
      `y="${H - 8}" text-anchor="middle">${hourLabel(n - 1 - i)}</text>`;
  });

  const svgNS = "http://www.w3.org/2000/svg";
  const wrap = $("chartWrap");
  const old = wrap.querySelector("svg");
  if (old) old.remove();
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-labelledby", "chartTitle chartDesc");
  svg.innerHTML = `<title id="chartTitle">Throughput over the last 24 hours</title>` +
    `<desc id="chartDesc">Hourly mean events per minute in thousands, ranging ` +
    `from ${Math.min(...THROUGHPUT)}k to ${Math.max(...THROUGHPUT)}k, peaking at ` +
    `${hourLabel(n - 1 - peakIdx)} UTC.</desc>${grid}${bars}${xticks}`;
  wrap.insertBefore(svg, $("chartTip"));

  $("peakNote").innerHTML =
    `Peak <strong>${THROUGHPUT[peakIdx]}k</strong> · ${hourLabel(n - 1 - peakIdx)} UTC`;

  // Screen-reader data table
  $("chartDataTable").querySelector("tbody").innerHTML = THROUGHPUT.map((v, i) =>
    `<tr><td>${hourLabel(n - 1 - i)} UTC</td><td>${v}</td></tr>`).join("");

  // Hover tooltip
  const tip = $("chartTip");
  svg.addEventListener("mousemove", (e) => {
    const r = e.target;
    if (!(r instanceof SVGRectElement) || !r.dataset.i) { tip.hidden = true; return; }
    const i = Number(r.dataset.i);
    tip.textContent = `${hourLabel(n - 1 - i)} UTC · ${THROUGHPUT[i]}k/min`;
    const box = wrap.getBoundingClientRect();
    tip.style.left = `${e.clientX - box.left}px`;
    tip.style.top = `${e.clientY - box.top - 4}px`;
    tip.hidden = false;
  });
  svg.addEventListener("mouseleave", () => { tip.hidden = true; });
}

/* ---------------- Incident table + filters ---------------- */
function filteredIncidents() {
  const q = state.q.trim().toLowerCase();
  return INCIDENTS
    .filter((i) => state.severity === "all" || i.severity === state.severity)
    .filter((i) => state.status === "all" || i.status === state.status)
    .filter((i) => !q || [i.id, i.title, i.service, i.owner]
      .join(" ").toLowerCase().includes(q))
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}

function isFiltered() {
  return state.q.trim() !== "" || state.severity !== "all" || state.status !== "all";
}

function renderTable() {
  const rows = filteredIncidents();
  const tbody = $("incidentRows");
  tbody.innerHTML = rows.map((i) => `
    <tr tabindex="0" data-id="${esc(i.id)}"
        class="${i.id === state.selectedId ? "is-selected" : ""}"
        aria-selected="${i.id === state.selectedId ? "true" : "false"}">
      <td class="cell-severity" data-label="Severity">
        <span class="sev-badge sev-${esc(i.severity)}">${esc(i.severity)}</span>
      </td>
      <td class="cell-incident" data-label="Incident">
        <div class="cell-title">${esc(i.title)}</div>
        <div class="cell-id">${esc(i.id)}</div>
      </td>
      <td class="cell-service" data-label="Service">${esc(i.service)}</td>
      <td class="cell-age num" data-label="Age">${esc(i.age)}</td>
      <td class="cell-owner${i.owner === "Unassigned" ? " unassigned" : ""}" data-label="Owner">${esc(i.owner)}</td>
      <td class="cell-status" data-label="Status">
        <span class="status-pill status-${esc(i.status)}">${esc(STATUS_LABEL[i.status])}</span>
      </td>
    </tr>`).join("");

  const total = INCIDENTS.length;
  $("incidentCount").textContent =
    rows.length === total && !isFiltered() ? `${total} shown`
    : `${rows.length} of ${total} shown`;

  const empty = rows.length === 0;
  $("emptyState").hidden = !empty;
  $("incidentTable").style.display = empty ? "none" : "";
  $("clearFiltersTop").hidden = !isFiltered();

  if (rows.length > 0 && !rows.some((i) => i.id === state.selectedId)) {
    selectIncident(rows[0].id, { silent: true });
  }
}

function clearFilters() {
  state.q = ""; state.severity = "all"; state.status = "all";
  $("searchInput").value = "";
  $("severityFilter").value = "all";
  $("statusFilter").value = "all";
  renderTable();
  renderDetail();
  announce("Filters cleared.");
}

/* ---------------- Detail panel ---------------- */
function getSelected() {
  return INCIDENTS.find((i) => i.id === state.selectedId) || null;
}

function renderDetail() {
  const i = getSelected();
  const ack = $("ackButton");
  if (!i) {
    $("detailSev").textContent = "—";
    $("detailSev").className = "sev-badge";
    $("detailId").textContent = "—";
    $("detailTitle").textContent = "Select an incident";
    $("detailService").textContent = "—";
    $("detailAge").textContent = "—";
    $("detailOwner").textContent = "—";
    $("detailStatus").textContent = "—";
    $("detailDesc").textContent = "Choose a row in the incident table to inspect it here.";
    $("detailSignals").innerHTML = "";
    $("detailTimeline").innerHTML = "";
    ack.disabled = true;
    ack.textContent = "Acknowledge";
    return;
  }
  const sev = $("detailSev");
  sev.textContent = i.severity;
  sev.className = `sev-badge sev-${i.severity}`;
  $("detailId").textContent = i.id;
  $("detailTitle").textContent = i.title;
  $("detailService").textContent = i.service;
  $("detailAge").textContent = i.age;
  $("detailOwner").textContent = i.owner;
  const st = $("detailStatus");
  st.textContent = STATUS_LABEL[i.status];
  st.className = `status-pill status-${i.status}`;
  $("detailDesc").textContent = i.desc;
  $("detailPlaybook").textContent = i.playbook;
  $("detailSignals").innerHTML = i.signals.map((s) =>
    `<li><span>${esc(s.k)}</span><b class="${esc(s.flag)}">${esc(s.v)}</b></li>`).join("");
  $("detailTimeline").innerHTML = i.timeline.map((t) =>
    `<li class="${t.now ? "is-now" : ""}">${esc(t.e)}<time>${esc(t.t)}</time></li>`).join("");

  const done = i.status === "acknowledged" || i.status === "resolved";
  ack.disabled = done;
  ack.textContent = i.status === "acknowledged" ? "Acknowledged ✓"
    : i.status === "resolved" ? "Resolved" : "Acknowledge";
  ack.setAttribute("aria-label", done ? `Incident ${i.id} already ${STATUS_LABEL[i.status].toLowerCase()}`
    : `Acknowledge incident ${i.id}`);
}

function selectIncident(id, opts = {}) {
  state.selectedId = id;
  document.querySelectorAll("#incidentRows tr").forEach((tr) => {
    const on = tr.dataset.id === id;
    tr.classList.toggle("is-selected", on);
    tr.setAttribute("aria-selected", on ? "true" : "false");
  });
  renderDetail();
  if (!opts.silent) {
    const i = getSelected();
    if (i) announce(`Selected ${i.id}, ${i.title}, ${i.severity}, ${STATUS_LABEL[i.status]}.`);
  }
}

function acknowledge() {
  const i = getSelected();
  if (!i || i.status === "acknowledged" || i.status === "resolved") return;
  i.status = "acknowledged";
  if (i.owner === "Unassigned") i.owner = "D. Reyes";
  i.timeline = i.timeline.map((t) => ({ ...t, now: false }));
  i.timeline.push({ t: "just now", e: "Acknowledged by D. Reyes (you)", now: true });
  renderTable();
  renderDetail();
  refreshAlertPill();
  announce(`${i.id} acknowledged. Status is now Acknowledged.`);
}

async function copyId() {
  const i = getSelected();
  if (!i) return;
  try {
    await navigator.clipboard.writeText(i.id);
    announce(`${i.id} copied to clipboard.`);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = i.id;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); announce(`${i.id} copied to clipboard.`); }
    catch { announce(`Copy failed. Incident ID is ${i.id}.`); }
    ta.remove();
  }
}

/* ---------------- Theme ---------------- */
function initTheme() {
  let theme = "light";
  try { theme = localStorage.getItem("relay-theme") || "light"; } catch { /* private mode */ }
  document.documentElement.dataset.theme = theme;
  $("themeToggle").setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  $("themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    $("themeToggle").setAttribute("aria-pressed", next === "dark" ? "true" : "false");
    try { localStorage.setItem("relay-theme", next); } catch { /* ignore */ }
    announce(`${cap(next)} theme enabled.`);
  });
}

/* ---------------- Events ---------------- */
function initEvents() {
  $("searchInput").addEventListener("input", (e) => {
    state.q = e.target.value;
    renderTable();
  });
  $("severityFilter").addEventListener("change", (e) => {
    state.severity = e.target.value;
    renderTable();
    announce(`${filteredIncidents().length} incidents match.`);
  });
  $("statusFilter").addEventListener("change", (e) => {
    state.status = e.target.value;
    renderTable();
    announce(`${filteredIncidents().length} incidents match.`);
  });
  $("filterForm").addEventListener("submit", (e) => e.preventDefault());
  $("clearFiltersTop").addEventListener("click", clearFilters);
  $("clearFiltersEmpty").addEventListener("click", clearFilters);

  const tbody = $("incidentRows");
  tbody.addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) selectIncident(tr.dataset.id);
  });
  tbody.addEventListener("keydown", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectIncident(tr.dataset.id);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const rows = [...tbody.querySelectorAll("tr[data-id]")];
      const idx = rows.indexOf(tr);
      const next = e.key === "ArrowDown" ? rows[idx + 1] : rows[idx - 1];
      if (next) { next.focus(); selectIncident(next.dataset.id); }
    }
  });

  $("ackButton").addEventListener("click", acknowledge);
  $("copyButton").addEventListener("click", copyId);

  // Rail active-state follows in-page navigation
  const links = [...document.querySelectorAll(".rail-list .rail-link")];
  links.forEach((a) => a.addEventListener("click", () => {
    links.forEach((l) => { l.classList.remove("is-active"); l.removeAttribute("aria-current"); });
    a.classList.add("is-active");
    a.setAttribute("aria-current", "page");
  }));
}

/* ---------------- Boot ---------------- */
function init() {
  const d = new Date();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  $("pageDate").textContent =
    `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} · US-East primary · all regions reporting`;

  renderMetrics();
  renderChart();
  renderTable();
  renderDetail();
  refreshAlertPill();
  tickClock();
  setInterval(tickClock, 1000);
  initTheme();
  initEvents();
}

document.addEventListener("DOMContentLoaded", init);
