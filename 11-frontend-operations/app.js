(function () {
  "use strict";

  var DATA = {
    metrics: [
      { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up" },
      { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down" },
      { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up" },
      { label: "Queue depth", value: "2,841", change: "−19%", direction: "down" }
    ],
    throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    incidents: [
      { id: "INC-2841", severity: "critical", service: "payments-api", age: "12m", owner: "M. Chen", status: "investigating", title: "Card authorization timeouts",
        desc: "Authorization success rate dropped to 91% over the last 12 minutes. Timeouts concentrated in the us-east-1 gateway pool; failover to us-west-2 is staged and awaiting sign-off." },
      { id: "INC-2839", severity: "high", service: "event-router", age: "31m", owner: "Unassigned", status: "open", title: "EU retry queue growth",
        desc: "The EU retry backlog is growing at ~400 msg/min. Consumer lag is rising on two partitions; no owner has claimed the incident yet." },
      { id: "INC-2837", severity: "medium", service: "search-index", age: "1h 08m", owner: "A. Silva", status: "monitoring", title: "Index freshness outside SLO",
        desc: "Index freshness is 6 minutes behind the 5-minute SLO. Reindex is running; freshness is recovering and being watched for 30 more minutes." },
      { id: "INC-2832", severity: "low", service: "webhooks", age: "3h 42m", owner: "R. Patel", status: "open", title: "Elevated partner delivery lag",
        desc: "Partner webhook deliveries are averaging 8.4 s end-to-end versus a 5 s target. One partner endpoint is rate-limiting; backoff is applied automatically." }
    ]
  };

  var SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

  var state = {
    incidents: DATA.incidents.map(function (i) { return Object.assign({}, i); }),
    severity: "all",
    status: "all",
    query: "",
    selectedId: null
  };

  var els = {
    chart: document.getElementById("chart"),
    tbody: document.getElementById("incident-tbody"),
    count: document.getElementById("incident-count"),
    empty: document.getElementById("empty-state"),
    filterSeverity: document.getElementById("filter-severity"),
    filterStatus: document.getElementById("filter-status"),
    filterSearch: document.getElementById("filter-search"),
    clearFilters: document.getElementById("clear-filters"),
    detail: document.getElementById("detail"),
    detailEmpty: document.getElementById("detail-empty"),
    detailBody: document.getElementById("detail-body"),
    detailSev: document.getElementById("detail-sev"),
    detailId: document.getElementById("detail-id"),
    detailTitle: document.getElementById("detail-title"),
    detailService: document.getElementById("detail-service"),
    detailAge: document.getElementById("detail-age"),
    detailOwner: document.getElementById("detail-owner"),
    detailStatus: document.getElementById("detail-status"),
    detailDesc: document.getElementById("detail-desc"),
    ackBtn: document.getElementById("ack-btn"),
    resolveBtn: document.getElementById("resolve-btn"),
    ackNote: document.getElementById("ack-note"),
    clock: document.getElementById("clock")
  };

  /* ---------- Clock ---------- */

  function tickClock() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, "0"); };
    els.clock.textContent = p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds()) + " UTC";
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------- Throughput chart (inline SVG-free, pure CSS bars) ---------- */

  function renderChart() {
    var data = DATA.throughput;
    var max = Math.max.apply(null, data);
    els.chart.innerHTML = "";
    data.forEach(function (v, i) {
      var bar = document.createElement("div");
      bar.className = "chart__bar" + (v === max ? " is-peak" : "");
      bar.style.height = Math.max(4, Math.round((v / max) * 100)) + "%";
      var h = String(i).padStart(2, "0") + ":00";
      bar.title = h + " — " + v + " events/5 min";
      bar.setAttribute("aria-hidden", "true");
      els.chart.appendChild(bar);
    });
  }

  /* ---------- Incident table ---------- */

  function matchesFilters(inc) {
    if (state.severity !== "all" && inc.severity !== state.severity) return false;
    if (state.status !== "all" && inc.status !== state.status) return false;
    if (state.query) {
      var q = state.query.toLowerCase();
      var hay = (inc.id + " " + inc.title + " " + inc.service + " " + inc.owner).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function sevDot(sev) {
    return '<span class="dot dot--' + sev + '" aria-hidden="true"></span>';
  }

  function renderTable() {
    var rows = state.incidents
      .filter(matchesFilters)
      .sort(function (a, b) { return SEV_ORDER[a.severity] - SEV_ORDER[b.severity]; });

    els.tbody.innerHTML = "";
    els.count.textContent = String(rows.length);
    els.empty.hidden = rows.length !== 0;

    rows.forEach(function (inc) {
      var tr = document.createElement("tr");
      tr.tabIndex = 0;
      tr.dataset.id = inc.id;
      tr.setAttribute("aria-selected", inc.id === state.selectedId ? "true" : "false");
      if (inc.id === state.selectedId) tr.classList.add("is-selected");

      tr.innerHTML =
        '<td><span class="sev sev--' + inc.severity + '">' + sevDot(inc.severity) + inc.severity + "</span></td>" +
        '<td><div class="cell-title">' + inc.title + '</div><div class="cell-id">' + inc.id + "</div></td>" +
        '<td class="cell-service">' + inc.service + "</td>" +
        '<td class="num">' + inc.age + "</td>" +
        '<td>' + inc.owner + "</td>" +
        '<td><span class="status status--' + inc.status + '">' + inc.status + "</span></td>";

      var select = function () { selectIncident(inc.id); };
      tr.addEventListener("click", select);
      tr.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); }
      });
      els.tbody.appendChild(tr);
    });

    if (state.selectedId && !rows.some(function (r) { return r.id === state.selectedId; })) {
      state.selectedId = null;
    }
    renderDetail();
  }

  /* ---------- Detail panel ---------- */

  function renderDetail() {
    var inc = state.selectedId
      ? state.incidents.find(function (i) { return i.id === state.selectedId; })
      : null;

    if (!inc) {
      els.detailEmpty.hidden = false;
      els.detailBody.hidden = true;
      return;
    }

    els.detailEmpty.hidden = true;
    els.detailBody.hidden = false;
    els.detailSev.textContent = inc.severity;
    els.detailSev.className = "sev sev--" + inc.severity;
    els.detailId.textContent = inc.id;
    els.detailTitle.textContent = inc.title;
    els.detailService.textContent = inc.service;
    els.detailAge.textContent = inc.age;
    els.detailOwner.textContent = inc.owner;
    els.detailStatus.innerHTML = '<span class="status status--' + inc.status + '">' + inc.status + "</span>";
    els.detailDesc.textContent = inc.desc;

    var acked = inc.status === "acknowledged" || inc.status === "resolved";
    els.ackBtn.disabled = acked;
    els.ackBtn.textContent = inc.status === "acknowledged" ? "Acknowledged" : "Acknowledge";
    els.ackNote.hidden = !(inc.status === "acknowledged" || inc.status === "resolved");
    els.ackNote.textContent = inc.status === "acknowledged"
      ? "Acknowledged by operator · status updated"
      : "Resolved · closed by owner";
  }

  function selectIncident(id) {
    state.selectedId = id;
    renderTable();
    els.detail.focus({ preventScroll: false });
  }

  function acknowledge() {
    var inc = state.incidents.find(function (i) { return i.id === state.selectedId; });
    if (!inc || inc.status === "acknowledged" || inc.status === "resolved") return;
    inc.status = "acknowledged";
    if (inc.owner === "Unassigned") inc.owner = "Operator";
    renderTable();
  }

  function resolve() {
    var inc = state.incidents.find(function (i) { return i.id === state.selectedId; });
    if (!inc) return;
    inc.status = "resolved";
    renderTable();
  }

  /* ---------- Filters ---------- */

  els.filterSeverity.addEventListener("change", function () {
    state.severity = els.filterSeverity.value;
    renderTable();
  });
  els.filterStatus.addEventListener("change", function () {
    state.status = els.filterStatus.value;
    renderTable();
  });
  els.filterSearch.addEventListener("input", function () {
    state.query = els.filterSearch.value.trim();
    renderTable();
  });
  els.clearFilters.addEventListener("click", function () {
    state.severity = "all";
    state.status = "all";
    state.query = "";
    els.filterSeverity.value = "all";
    els.filterStatus.value = "all";
    els.filterSearch.value = "";
    renderTable();
    els.filterSeverity.focus();
  });

  els.ackBtn.addEventListener("click", acknowledge);
  els.resolveBtn.addEventListener("click", resolve);

  /* ---------- Init ---------- */

  renderChart();
  selectIncident(state.incidents[0].id);
})();
