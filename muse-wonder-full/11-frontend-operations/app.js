"use strict";
/* Relay — seeded from DATA.json. Embedded (not fetched) so the page works
   from file:// with zero network requests. Detail copy extends each seed
   incident with realistic operator context. */
const DATA = {
  metrics: [
    { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up", goodWhen: "up", context: "vs previous hour" },
    { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down", goodWhen: "down", context: "vs previous hour" },
    { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up", goodWhen: "down", context: "vs previous hour · SLO 0.50%" },
    { label: "Queue depth", value: "2,841", change: "−19%", direction: "down", goodWhen: "down", context: "vs previous hour" }
  ],
  throughput: [31,28,24,22,20,23,34,48,62,71,76,73,68,72,80,84,79,75,82,88,77,63,52,41],
  incidents: [
    { id: "INC-2841", severity: "critical", service: "payments-api", age: "12m", owner: "M. Chen", status: "investigating", title: "Card authorization timeouts",
      started: "14:20 UTC", impact: "~4.1% of card authorizations timing out at the gateway; retries succeeding for most shoppers.",
      next: "Fail traffic to the secondary gateway region if timeouts exceed 5% for 10 minutes." },
    { id: "INC-2839", severity: "high", service: "event-router", age: "31m", owner: "Unassigned", status: "open", title: "EU retry queue growth",
      started: "14:01 UTC", impact: "EU retry queue growing at ~900 msgs/min; no event loss, delivery delayed up to 9 minutes.",
      next: "Needs an owner. Check router partition 7 consumer lag before scaling consumers." },
    { id: "INC-2837", severity: "medium", service: "search-index", age: "1h 08m", owner: "A. Silva", status: "monitoring", title: "Index freshness outside SLO",
      started: "13:24 UTC", impact: "New listings take 14 min to appear in search (SLO 5 min). Existing results unaffected.",
      next: "Backfill running at reduced rate; re-check freshness at 15:00 UTC." },
    { id: "INC-2832", severity: "low", service: "webhooks", age: "3h 42m", owner: "R. Patel", status: "open", title: "Elevated partner delivery lag",
      started: "10:50 UTC", impact: "Partner webhook p95 delivery at 42s (baseline 6s). All deliveries eventually succeed.",
      next: "Partner endpoint latency suspected; awaiting partner status update." }
  ]
};

const state = { incidents: DATA.incidents.map(i => ({ ...i })), selectedId: "INC-2841" };
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Clock (top status bar) */
function tickClock() {
  const now = new Date(), el = $("#clock");
  el.textContent = now.toISOString().slice(11, 16) + " UTC";
  el.dateTime = now.toISOString();
}
tickClock(); setInterval(tickClock, 30000);

/* Metrics */
$("#metricList").innerHTML = DATA.metrics.map(m => {
  const arrow = m.direction === "up" ? "▲" : "▼";
  const tone = m.direction === m.goodWhen ? "good" : "bad";
  const word = m.direction === "up" ? "up" : "down";
  return `<li class="metric"><p class="metric__label">${esc(m.label)}</p>
    <p class="metric__value">${esc(m.value)}</p>
    <p class="metric__trend"><span class="trend trend--${tone}"><span aria-hidden="true">${arrow}</span> ${esc(m.change)}<span class="visually-hidden"> (${word})</span></span><span>${esc(m.context)}</span></p></li>`;
}).join("");

/* Throughput: inline SVG line chart + data table */
(function renderChart() {
  const d = DATA.throughput, W = 720, H = 220, pad = { l: 34, r: 10, t: 14, b: 24 };
  const max = Math.max(...d), min = Math.min(...d), peakH = d.indexOf(max);
  const avg = Math.round(d.reduce((a, b) => a + b, 0) / d.length);
  const x = i => pad.l + (i / (d.length - 1)) * (W - pad.l - pad.r);
  const y = v => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const pts = d.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${pad.l},${y(0)} ${pts} ${x(d.length - 1)},${y(0)}`;
  const grid = [0, 25, 50, 75, 100].map(v =>
    `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#d6d8d2" stroke-width="1"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#52585e">${v}</text>`).join("");
  const hours = [0, 6, 12, 18, 23].map(h =>
    `<text x="${x(h)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#52585e">${String(h).padStart(2, "0")}:00</text>`).join("");
  $("#chartSvg").innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart of throughput over 24 hours. Peak ${max} thousand events per minute at ${String(peakH).padStart(2, "0")}:00, low ${min} thousand, average ${avg} thousand.">
      ${grid}<polygon points="${area}" fill="#0b6e5d" opacity="0.10"/>
      <polyline points="${pts}" fill="none" stroke="#0b6e5d" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${x(peakH)}" cy="${y(max)}" r="3.5" fill="#0b6e5d"/>
      <text x="${x(peakH)}" y="${y(max) - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#08503f">peak ${max}k</text>
      <circle cx="${x(23)}" cy="${y(d[23])}" r="3.5" fill="#fff" stroke="#0b6e5d" stroke-width="2"/>${hours}</svg>`;
  $("#chartMeta").textContent = `Peak ${max}k/min at ${String(peakH).padStart(2, "0")}:00 · Avg ${avg}k · Now ${d[23]}k`;
  $("#chartCaption").textContent = `Thousands of events per minute by hour (UTC). Overnight low of ${min}k, evening peak of ${max}k at ${String(peakH).padStart(2, "0")}:00.`;
  $("#chartTable tbody").innerHTML = d.map((v, i) =>
    `<tr><td>${String(i).padStart(2, "0")}:00</td><td class="num">${v}</td></tr>`).join("");
})();

/* Incidents: filter, render, select, acknowledge */
const els = { q: $("#q"), sev: $("#fSeverity"), status: $("#fStatus"), body: $("#incidentBody"),
  empty: $("#emptyState"), count: $("#resultCount"), table: $("#incidentTable") };

function filtered() {
  const q = els.q.value.trim().toLowerCase();
  return state.incidents.filter(i =>
    (!els.sev.value || i.severity === els.sev.value) &&
    (!els.status.value || i.status === els.status.value) &&
    (!q || [i.id, i.title, i.service, i.owner].join(" ").toLowerCase().includes(q)));
}
function renderTable() {
  const rows = filtered();
  els.body.innerHTML = rows.map(i => `<tr data-id="${i.id}" class="${i.id === state.selectedId ? "is-selected" : ""}">
    <td><button type="button" class="inc__id" data-select="${i.id}" aria-current="${i.id === state.selectedId}">${esc(i.id)}</button>
        <span class="inc__title">${esc(i.title)}</span></td>
    <td><span class="badge badge--${i.severity}">${esc(i.severity)}</span></td>
    <td class="mono">${esc(i.service)}</td><td class="num">${esc(i.age)}</td>
    <td>${esc(i.owner)}</td><td><span class="status status--${i.status}">${esc(i.status)}</span></td></tr>`).join("");
  els.empty.hidden = rows.length > 0;
  els.table.hidden = rows.length === 0;
  els.count.textContent = `${rows.length} of ${state.incidents.length} incidents shown`;
  const crit = state.incidents.filter(i => i.severity === "critical" && i.status !== "acknowledged").length;
  $("#criticalCount").textContent = `${crit} critical`;
}
function renderDetail() {
  const i = state.incidents.find(x => x.id === state.selectedId), box = $("#detailBody");
  $("#detailId").textContent = i ? i.id : "";
  if (!i) { box.innerHTML = `<p class="detail__empty">Select an incident ID in the table to see its detail here.</p>`; return; }
  const acked = i.status === "acknowledged";
  box.innerHTML = `<span class="badge badge--${i.severity}">${esc(i.severity)}</span>
    <p class="detail__title">${esc(i.title)}</p>
    <dl><dt>Service</dt><dd class="mono">${esc(i.service)}</dd><dt>Status</dt><dd>${esc(i.status)}</dd>
    <dt>Owner</dt><dd>${esc(i.owner)}</dd><dt>Age</dt><dd>${esc(i.age)}</dd><dt>Started</dt><dd>${esc(i.started)}</dd></dl>
    <p class="detail__desc">${esc(i.impact)}</p>
    <p class="detail__next"><strong>Next step</strong>${esc(i.next)}</p>
    <button type="button" class="btn" id="ackBtn" ${acked ? "disabled" : ""}>${acked ? "Acknowledged ✓" : "Acknowledge incident"}</button>
    ${i.ackNote ? `<p class="detail__ack-note">${esc(i.ackNote)}</p>` : ""}`;
  const btn = $("#ackBtn");
  if (btn && !acked) btn.addEventListener("click", () => {
    i.status = "acknowledged";
    if (i.owner === "Unassigned") i.owner = "You (operator)";
    i.ackNote = `Acknowledged by ${i.owner} at ${new Date().toISOString().slice(11, 16)} UTC. Pager silenced for this incident.`;
    $("#ackLive").textContent = `${i.id} acknowledged. Status updated in the table.`;
    renderTable(); renderDetail(); $("#ackBtn").focus();
  });
}
function clearFilters() { els.q.value = ""; els.sev.value = ""; els.status.value = ""; renderTable(); els.q.focus(); }

els.body.addEventListener("click", e => {
  const b = e.target.closest("[data-select]");
  if (b) { state.selectedId = b.dataset.select; renderTable(); renderDetail(); }
});
["input", "change"].forEach(ev => $("#filters").addEventListener(ev, renderTable));
$("#filters").addEventListener("submit", e => e.preventDefault());
$("#clearFilters").addEventListener("click", clearFilters);
$("#emptyClear").addEventListener("click", clearFilters);
renderTable(); renderDetail();
