/* Relay ops dashboard — local only, no network. Data seeded from DATA.json. */
"use strict";
var THROUGHPUT = [31,28,24,22,20,23,34,48,62,71,76,73,68,72,80,84,79,75,82,88,77,63,52,41];
var INCIDENTS = [
  {id:"INC-2841",severity:"critical",service:"payments-api",age:"12m",owner:"M. Chen",status:"investigating",title:"Card authorization timeouts"},
  {id:"INC-2839",severity:"high",service:"event-router",age:"31m",owner:"Unassigned",status:"open",title:"EU retry queue growth"},
  {id:"INC-2837",severity:"medium",service:"search-index",age:"1h 08m",owner:"A. Silva",status:"monitoring",title:"Index freshness outside SLO"},
  {id:"INC-2832",severity:"low",service:"webhooks",age:"3h 42m",owner:"R. Patel",status:"open",title:"Elevated partner delivery lag"}
];
var selectedId = "INC-2841";

var rowsEl = document.getElementById("inc-rows");
var emptyEl = document.getElementById("empty");
var countEl = document.getElementById("inc-count");
var fSev = document.getElementById("f-sev");
var fStatus = document.getElementById("f-status");
var fQ = document.getElementById("f-q");
var detailBody = document.getElementById("detail-body");
var detailId = document.getElementById("detail-id");

function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}

function filtered(){
  var q = fQ.value.trim().toLowerCase();
  return INCIDENTS.filter(function(i){
    if(fSev.value && i.severity!==fSev.value) return false;
    if(fStatus.value && i.status!==fStatus.value) return false;
    if(q && (i.id+" "+i.title+" "+i.service+" "+i.owner).toLowerCase().indexOf(q)<0) return false;
    return true;
  });
}

function renderTable(){
  var list = filtered();
  countEl.textContent = list.length;
  emptyEl.hidden = list.length>0;
  rowsEl.innerHTML = list.map(function(i){
    var sel = i.id===selectedId ? ' aria-selected="true"' : ' aria-selected="false"';
    return '<tr tabindex="0" data-id="'+i.id+'"'+sel+'>'+
      '<td><span class="sev sev-'+i.severity+'">'+i.severity+'</span></td>'+
      '<td class="mono">'+i.id+'</td>'+
      '<td><div class="cell-title">'+esc(i.title)+'</div><div class="cell-service">'+esc(i.service)+'</div></td>'+
      '<td class="num mono">'+esc(i.age)+'</td>'+
      '<td>'+esc(i.owner)+'</td>'+
      '<td><span class="st st-'+i.status+'">'+i.status+'</span></td></tr>';
  }).join("");
  if(list.length && !list.some(function(i){return i.id===selectedId;})) selectedId = list[0].id;
  renderDetail();
}

function renderDetail(){
  var i = INCIDENTS.find(function(x){return x.id===selectedId;}) || filtered()[0];
  if(!i){ detailBody.innerHTML = '<p class="sub">No incident selected.</p>'; return; }
  selectedId = i.id; detailId.textContent = i.id;
  var acked = i.status==="acknowledged";
  detailBody.innerHTML =
    '<p class="d-title">'+esc(i.title)+'</p>'+
    '<dl style="margin:0">'+
    row("Severity",'<span class="sev sev-'+i.severity+'">'+i.severity+'</span>')+
    row("Service",'<span class="mono">'+esc(i.service)+'</span>')+
    row("Age",esc(i.age))+ row("Owner",esc(i.owner))+
    row("Status",'<span class="st st-'+i.status+'">'+i.status+'</span>')+'</dl>'+
    '<div class="d-actions"><button type="button" class="btn btn-primary" id="ack"'+(acked?" disabled":"")+'>'+
    (acked?"Acknowledged ✓":"Acknowledge")+'</button>'+
    '<button type="button" class="btn btn-ghost" id="esc-btn">Escalate</button></div>'+
    (acked?'<p class="ack-note">Acknowledged by you · just now. Status set to acknowledged.</p>':'');
  rowsEl.querySelectorAll("tr").forEach(function(tr){
    tr.setAttribute("aria-selected", tr.dataset.id===selectedId ? "true":"false");
  });
  var ack = document.getElementById("ack");
  if(ack) ack.addEventListener("click", function(){
    i.status = "acknowledged"; if(i.owner==="Unassigned") i.owner = "You (on-call)";
    if(!document.querySelector('#f-status option[value="acknowledged"]')){
      var o=document.createElement("option");o.value="acknowledged";o.textContent="Acknowledged";fStatus.appendChild(o);
    }
    renderTable();
  });
  document.getElementById("esc-btn").addEventListener("click", function(){
    i.severity = i.severity==="low" ? "medium" : i.severity==="medium" ? "high" : "critical";
    renderTable();
  });
}
function row(k,v){return '<div class="d-row"><dt>'+k+'</dt><dd>'+v+'</dd></div>';}

rowsEl.addEventListener("click", function(e){
  var tr = e.target.closest("tr"); if(tr){ selectedId = tr.dataset.id; renderDetail(); }
});
rowsEl.addEventListener("keydown", function(e){
  var tr = e.target.closest("tr"); if(!tr) return;
  if(e.key==="Enter"||e.key===" "){ e.preventDefault(); selectedId = tr.dataset.id; renderDetail(); }
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){
    e.preventDefault();
    var sib = e.key==="ArrowDown" ? tr.nextElementSibling : tr.previousElementSibling;
    if(sib) sib.focus();
  }
});
[fSev,fStatus].forEach(function(el){ el.addEventListener("change", renderTable); });
fQ.addEventListener("input", renderTable);
document.getElementById("clear-filters").addEventListener("click", function(){
  fSev.value=""; fStatus.value=""; fQ.value=""; renderTable(); fQ.focus();
});

/* Throughput canvas with HiDPI scaling + text fallback */
(function(){
  var c = document.getElementById("chart");
  var dpr = Math.min(window.devicePixelRatio||1, 2);
  function draw(){
    var w = c.clientWidth, h = 180;
    c.width = w*dpr; c.height = h*dpr;
    var x = c.getContext("2d"); x.scale(dpr,dpr);
    x.clearRect(0,0,w,h);
    var max = 100, n = THROUGHPUT.length;
    var gap = 4, bw = (w-gap*(n-1))/n;
    var peak = THROUGHPUT.indexOf(Math.max.apply(null,THROUGHPUT));
    THROUGHPUT.forEach(function(v,i){
      var bh = (v/max)*(h-24);
      x.fillStyle = i===peak ? "#b3261e" : "#0b5fff";
      if(i>peak-4 && i<peak && THROUGHPUT[i]<THROUGHPUT[i+1]) x.fillStyle = "#0b5fff";
      var bx = i*(bw+gap), by = h-16-bh;
      x.beginPath();
      if(x.roundRect) x.roundRect(bx,by,bw,bh,[2,2,0,0]); else x.rect(bx,by,bw,bh);
      x.fill();
      if(i%6===0||i===peak){ x.fillStyle="#5f6368"; x.font="10px ui-monospace,monospace"; x.textAlign="center"; x.fillText(v+"k",bx+bw/2,by-4); }
    });
    x.fillStyle="#e2e2de"; x.fillRect(0,h-16,w,1);
  }
  draw();
  var t; window.addEventListener("resize", function(){ clearTimeout(t); t=setTimeout(draw,150); });
})();

/* Clock */
(function(){
  var el = document.getElementById("clock");
  function tick(){
    var d = new Date();
    var s = d.toISOString().slice(11,16)+" UTC";
    el.textContent = s; el.setAttribute("datetime", d.toISOString());
  }
  tick(); setInterval(tick, 30000);
})();

renderTable();
