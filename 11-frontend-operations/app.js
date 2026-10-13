// Relay — seeded from DATA.json (embedded; no network requests)
const METRICS = [
  { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up", goodWhen: "up", context: "vs prior hour · <strong>16,980</strong> avg yesterday" },
  { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down", goodWhen: "down", context: "vs prior hour · SLO <strong>250 ms</strong>" },
  { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up", goodWhen: "down", context: "vs prior hour · budget <strong>0.50%</strong>" },
  { label: "Queue depth", value: "2,841", change: "−19%", direction: "down", goodWhen: "down", context: "vs prior hour · draining since <strong>18:10</strong>" },
];
const THROUGHPUT = [31,28,24,22,20,23,34,48,62,71,76,73,68,72,80,84,79,75,82,88,77,63,52,41];

let incidents = [
  { id:"INC-2841", severity:"critical", service:"payments-api", age:"12m", ageMin:12, owner:"M. Chen", status:"investigating", title:"Card authorization timeouts",
    started:"19:41 UTC", impact:"~4.1% of card authorizations timing out in EU-West. Checkout conversion down 1.8 pp in the last 10 minutes.",
    description:"Timeout rate on POST /authorize crossed 2% at 19:38 and peaked at 6.4%. Correlates with a connection-pool change in payments-api 4.12.1; no deploy in the last hour on the downstream acquirer.",
    timeline:[["19:38","Alert fired — timeout rate > 2% for 3 min"],["19:41","M. Chen acknowledged page and opened investigation"],["19:47","Pool size raised 40 → 80; timeouts plateaued"]] },
  { id:"INC-2839", severity:"high", service:"event-router", age:"31m", ageMin:31, owner:"Unassigned", status:"open", title:"EU retry queue growth",
    started:"19:22 UTC", impact:"Retry queue in EU growing ~900 msg/min. Downstream consumers are healthy; no data loss, but delivery delay is rising.",
    description:"Dead-letter ingress is normal, but the retry queue depth has grown from 1.2k to 18k since 19:05. Suspected back-pressure from a single noisy tenant.",
    timeline:[["19:05","Queue depth crossed 5k threshold"],["19:22","Incident opened automatically"],["19:30","Tenant-level breakdown requested from platform"]] },
  { id:"INC-2837", severity:"medium", service:"search-index", age:"1h 08m", ageMin:68, owner:"A. Silva", status:"monitoring", title:"Index freshness outside SLO",
    started:"18:45 UTC", impact:"Search results stale by up to 14 minutes (SLO: 5 min). No query errors; relevance may be slightly degraded for new listings.",
    description:"Indexer lag rose after a shard rebalance. Lag is now falling steadily after adding two indexer workers.",
    timeline:[["18:45","Freshness SLO breach detected"],["18:52","A. Silva took ownership"],["19:20","Two workers added; lag peaked and began falling"]] },
  { id:"INC-2832", severity:"low", service:"webhooks", age:"3h 42m", ageMin:222, owner:"R. Patel", status:"open", title:"Elevated partner delivery lag",
    started:"16:11 UTC", impact:"Median webhook delivery lag 38s (normal ~6s) for 3 partners. Deliveries still succeed on retry; no drops observed.",
    description:"A small set of partner endpoints are responding slowly (p95 12s). Relay retries are succeeding; partners have been notified.",
    timeline:[["16:11","Delivery lag alert fired"],["16:25","R. Patel confirmed partner-side slowness"],["18:00","Partners notified; monitoring"]] },
];

const $ = (s, r=document) => r.querySelector(s);
let selectedId = "INC-2841";

function changeClass(m){ return m.direction === m.goodWhen ? `change-${m.direction}-good` : `change-${m.direction}-bad`; }
function arrow(d){ return d === "up" ? "↑" : "↓"; }
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function renderMetrics(){
  $("#metricsGrid").innerHTML = METRICS.map(m => `
    <article class="metric" role="listitem">
      <p class="metric-label">${m.label}</p>
      <div class="metric-row"><span class="metric-value num">${m.value}</span>
      <span class="metric-change ${changeClass(m)}" aria-label="Change ${m.change}">${arrow(m.direction)} ${m.change}</span></div>
      <p class="metric-context">${m.context}</p>
    </article>`).join("");
}

function renderChart(){
  const svg = $("#throughputChart");
  const W=720,H=220, padL=36,padR=10,padT=14,padB=22, iw=W-padL-padR, ih=H-padT-padB, max=100;
  const pts = THROUGHPUT.map((v,i)=>[padL + (i/(THROUGHPUT.length-1))*iw, padT + ih - (v/max)*ih]);
  const line = pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
  const area = line + ` L${pts[pts.length-1][0].toFixed(1)},${padT+ih} L${pts[0][0].toFixed(1)},${padT+ih} Z`;
  const avg = THROUGHPUT.reduce((a,b)=>a+b,0)/THROUGHPUT.length;
  const avgY = padT + ih - (avg/max)*ih;
  const peakI = THROUGHPUT.indexOf(Math.max(...THROUGHPUT));
  let grid="";
  [0,25,50,75,100].forEach(v=>{ const y=padT+ih-(v/max)*ih; grid+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="#e3e7e3" stroke-width="1"/><text x="${padL-6}" y="${y+4}" text-anchor="end" font-size="10" fill="#6b766d" font-family="ui-monospace,monospace">${v}</text>`; });
  svg.innerHTML = `<title id="chartTitle">24-hour throughput</title><desc id="chartDesc">Throughput is low overnight at 20,000 to 28,000, rises through the morning to about 76,000, stays between 68,000 and 88,000 through the afternoon with a peak of 88,000 at 19:00, then falls to 41,000 by 23:00.</desc>
    ${grid}
    <line x1="${padL}" y1="${avgY}" x2="${W-padR}" y2="${avgY}" stroke="#6b766d" stroke-width="1" stroke-dasharray="5 4"/>
    <text x="${W-padR}" y="${avgY-5}" text-anchor="end" font-size="10" fill="#6b766d">avg ${avg.toFixed(1)}k</text>
    <path d="${area}" fill="#0f766e" opacity="0.12"/>
    <path d="${line}" fill="none" stroke="#0f766e" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${pts[peakI][0]}" cy="${pts[peakI][1]}" r="4" fill="#fff" stroke="#0f766e" stroke-width="2"/>
    <text x="${pts[peakI][0]}" y="${pts[peakI][1]-10}" text-anchor="middle" font-size="11" font-weight="700" fill="#1a1e1b">88k · 19:00</text>
    ${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="2" fill="#0f766e" opacity="${i===peakI?0:0.55}"/>`).join("")}`;
}

function filtered(){
  const q = $("#searchInput").value.trim().toLowerCase();
  const sev = $("#severityFilter").value, st = $("#statusFilter").value;
  return incidents.filter(inc =>
    (sev==="all" || inc.severity===sev) &&
    (st==="all" || inc.status===st) &&
    (!q || [inc.id,inc.title,inc.service,inc.owner,inc.severity,inc.status].join(" ").toLowerCase().includes(q))
  );
}

function renderTable(){
  const rows = filtered();
  const tbody = $("#incidentTbody");
  $("#incidentCountText").textContent = rows.length === incidents.length ? `${incidents.length} incidents` : `${rows.length} of ${incidents.length} incidents`;
  $("#railIncidentCount").textContent = String(incidents.filter(i=>i.status!=="acknowledged").length);
  $("#emptyState").hidden = rows.length !== 0;
  tbody.innerHTML = rows.map(inc => `
    <tr tabindex="0" data-id="${inc.id}" class="${inc.id===selectedId?"is-selected":""}" aria-selected="${inc.id===selectedId}" aria-label="${inc.id}: ${inc.title}, ${inc.severity}, ${inc.status}">
      <td><span class="sev sev-${inc.severity}">${cap(inc.severity)}</span></td>
      <td><span class="incident-id">${inc.id}</span><span class="incident-title">${inc.title}</span></td>
      <td class="service-cell">${inc.service}</td>
      <td class="num">${inc.age}</td>
      <td class="owner-cell">${inc.owner}</td>
      <td><span class="status-pill status-${inc.status}">${cap(inc.status)}</span></td>
    </tr>`).join("");
  tbody.querySelectorAll("tr").forEach(tr => {
    tr.addEventListener("click", () => selectIncident(tr.dataset.id, false));
    tr.addEventListener("keydown", e => {
      if(e.key==="Enter" || e.key===" "){ e.preventDefault(); selectIncident(tr.dataset.id, false); }
      if(e.key==="ArrowDown" || e.key==="ArrowUp"){
        e.preventDefault();
        const all=[...tbody.querySelectorAll("tr")]; const i=all.indexOf(tr);
        const next = e.key==="ArrowDown" ? all[i+1] : all[i-1];
        if(next){ next.focus(); selectIncident(next.dataset.id, false); }
      }
    });
  });
}

function renderDetail(){
  const inc = incidents.find(i=>i.id===selectedId) || incidents[0];
  if(!inc) return;
  selectedId = inc.id;
  $("#detailId").textContent = inc.id;
  $("#detailService").textContent = inc.service;
  $("#detailTitle").textContent = inc.title;
  const sev = $("#detailSeverity");
  sev.textContent = cap(inc.severity); sev.className = "sev sev-" + inc.severity;
  const st = $("#detailStatus");
  st.textContent = cap(inc.status); st.className = "status-pill status-" + inc.status;
  $("#detailAge").textContent = inc.age;
  $("#detailOwner").textContent = inc.owner;
  $("#detailStarted").textContent = inc.started;
  $("#detailImpact").textContent = inc.impact;
  $("#detailDescription").textContent = inc.description;
  $("#detailTimeline").innerHTML = inc.timeline.map((t,i,arr)=>`<li class="${i===arr.length-1?"is-latest":""}"><time>${t[0]}</time><strong>${t[1].split("—")[0]}</strong>${t[1].includes("—") ? " — " + t[1].split("—")[1] : ""}</li>`).join("");
  const ack = $("#ackBtn");
  if(inc.status==="acknowledged"){ ack.disabled = true; ack.textContent = "✓ Acknowledged"; }
  else { ack.disabled = false; ack.textContent = "Acknowledge incident"; }
  $("#ackNote").textContent = inc.status==="acknowledged" ? `${inc.id} acknowledged — on-call has confirmed ownership.` : "";
  $("#assignBtn").textContent = inc.owner === "You (Operator)" ? "Assigned to you" : "Assign to me";
}

function selectIncident(id, focusDetail){
  selectedId = id;
  renderTable(); renderDetail();
  const inc = incidents.find(i=>i.id===id);
  $("#liveRegion").textContent = inc ? `Selected ${inc.id}: ${inc.title}` : "";
  if(focusDetail) $("#detailTitle").focus?.();
}

function acknowledge(){
  const inc = incidents.find(i=>i.id===selectedId);
  if(!inc || inc.status==="acknowledged") return;
  inc.status = "acknowledged";
  if(inc.owner === "Unassigned") inc.owner = "You (Operator)";
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2,"0"), mm = String(now.getUTCMinutes()).padStart(2,"0");
  inc.timeline.push([`${hh}:${mm}`, `Acknowledged by operator — monitoring for recovery`]);
  renderTable(); renderDetail();
  showToast(`${inc.id} acknowledged — ${inc.title}`);
  $("#liveRegion").textContent = `${inc.id} acknowledged.`;
}

function showToast(msg){
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(showToast._t); showToast._t = setTimeout(()=>{ t.hidden = true; }, 4200);
}

function clearFilters(){
  $("#searchInput").value=""; $("#severityFilter").value="all"; $("#statusFilter").value="all";
  renderTable(); $("#searchInput").focus();
}

function tickClock(){
  const d = new Date();
  const s = [d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()].map(n=>String(n).padStart(2,"0")).join(":");
  const el = $("#clock"); el.textContent = s + " UTC"; el.dateTime = d.toISOString();
}

document.addEventListener("DOMContentLoaded", () => {
  renderMetrics(); renderChart(); renderTable(); renderDetail(); tickClock();
  setInterval(tickClock, 1000);
  ["searchInput","severityFilter","statusFilter"].forEach(id=>{
    $("#"+id).addEventListener("input", renderTable);
    $("#"+id).addEventListener("change", renderTable);
  });
  $("#filterForm").addEventListener("submit", e=>e.preventDefault());
  $("#clearFiltersBtn").addEventListener("click", clearFilters);
  $("#emptyResetBtn").addEventListener("click", clearFilters);
  $("#ackBtn").addEventListener("click", acknowledge);
  $("#assignBtn").addEventListener("click", () => {
    const inc = incidents.find(i=>i.id===selectedId); if(!inc) return;
    inc.owner = "You (Operator)"; renderTable(); renderDetail(); showToast(`${inc.id} assigned to you.`);
  });
  $("#refreshBtn").addEventListener("click", () => { tickClock(); showToast("Data refreshed — showing latest snapshot."); });
});
