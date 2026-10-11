(function () {
  "use strict";

  var state = {
    incidents: [],
    filters: { severity: "all", status: "all", query: "" },
    selectedId: null
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function loadData() {
    return fetch("DATA.json", { cache: "no-store" })
      .then(function (r) { return r.json(); });
  }

  /* ----- metrics ----- */
  function renderMetrics(metrics) {
    metrics.forEach(function (m, i) {
      var value = document.querySelector('[data-metric="' + i + '"]');
      if (!value) return;
      value.textContent = m.value;
      var trend = value.nextElementSibling;
      trend.textContent = m.change;
      trend.className = "trend " + (m.direction === "up" ? "trend-up" : "trend-down");
      trend.setAttribute("aria-label", (m.direction === "up" ? "up " : "down ") + m.change);
    });
  }

  /* ----- throughput chart ----- */
  function renderChart(data) {
    var svg = document.getElementById("spark");
    if (!svg) return;
    svg.textContent = "";

    var W = 720, H = 220;
    var PL = 44, PR = 16, PT = 16, PB = 28;
    var iw = W - PL - PR, ih = H - PT - PB;
    var max = Math.max.apply(null, data);
    var min = Math.min.apply(null, data);
    var range = (max - min) || 1;

    function x(i) { return PL + (i / (data.length - 1)) * iw; }
    function y(v) { return PT + ih - ((v - min) / range) * ih; }

    var ns = "http://www.w3.org/2000/svg";
    function make(tag, attrs) {
      var n = document.createElementNS(ns, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    }

    var gridStep = 4;
    var i;
    for (i = 0; i <= gridStep; i++) {
      var gv = min + (max - min) * (i / gridStep);
      var gy = y(gv);
      svg.appendChild(make("line", { x1: PL, y1: gy, x2: W - PR, y2: gy, "class": "gridline" }));
      var t = make("text", { x: PL - 8, y: gy + 3, "class": "label", "text-anchor": "end" });
      t.textContent = Math.round(gv);
      svg.appendChild(t);
    }

    var points = data.map(function (v, i) { return [x(i), y(v)]; });

    var areaPath = "M" + points[0][0] + "," + y(min) + " L" +
      points.map(function (p) { return p[0] + "," + p[1]; }).join(" L") +
      " L" + points[points.length - 1][0] + "," + y(min) + " Z";
    svg.appendChild(make("path", { d: areaPath, "class": "area" }));

    var linePath = "M" + points.map(function (p) { return p[0] + "," + p[1]; }).join(" L");
    svg.appendChild(make("path", { d: linePath, "class": "line" }));

    svg.appendChild(make("circle", { cx: points[points.length - 1][0], cy: points[points.length - 1][1], r: 3.5, "class": "dot" }));

    var labelL = make("text", { x: PL, y: H - 8, "class": "label" });
    labelL.textContent = "00:00";
    svg.appendChild(labelL);
    var labelM = make("text", { x: PL + iw / 2, y: H - 8, "class": "label", "text-anchor": "middle" });
    labelM.textContent = "12:00";
    svg.appendChild(labelM);
    var labelR = make("text", { x: W - PR, y: H - 8, "class": "label", "text-anchor": "end" });
    labelR.textContent = "24:00";
    svg.appendChild(labelR);
  }

  /* ----- incidents ----- */
  function normalizeStatus(status) {
    return status ? status.toLowerCase() : "";
  }

  function matchesFilters(inc) {
    var q = state.filters.query.trim().toLowerCase();
    if (q) {
      var hay = (inc.id + " " + inc.service + " " + inc.owner + " " + inc.title).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (state.filters.severity !== "all" && inc.severity !== state.filters.severity) return false;
    if (state.filters.status !== "all" && normalizeStatus(inc.status) !== state.filters.status) return false;
    return true;
  }

  function renderTable() {
    var body = document.getElementById("incident-body");
    var empty = document.getElementById("empty-state");
    body.textContent = "";

    var visible = state.incidents.filter(matchesFilters);
    empty.hidden = visible.length > 0;

    visible.forEach(function (inc) {
      var tr = document.createElement("tr");
      tr.tabIndex = 0;
      tr.setAttribute("data-id", inc.id);
      tr.setAttribute("aria-selected", state.selectedId === inc.id ? "true" : "false");
      if (state.selectedId === inc.id) tr.className = "is-selected";

      var sevCell = document.createElement("td");
      var sev = el("span", "sev sev-" + inc.severity, inc.severity);
      sevCell.appendChild(sev);

      var svc = document.createElement("td");
      svc.textContent = inc.service;

      var title = document.createElement("td");
      title.textContent = inc.title;

      var age = document.createElement("td");
      age.textContent = inc.age;
      age.className = "num";

      var owner = document.createElement("td");
      owner.textContent = inc.owner;

      var status = document.createElement("td");
      var st = el("span", "status status-" + normalizeStatus(inc.status), inc.status);
      status.appendChild(st);

      tr.appendChild(sevCell);
      tr.appendChild(svc);
      tr.appendChild(title);
      tr.appendChild(age);
      tr.appendChild(owner);
      tr.appendChild(status);

      body.appendChild(tr);
    });

    renderDetail();
  }

  function renderDetail() {
    var detailBody = document.getElementById("detail-body");
    detailBody.textContent = "";

    if (!state.selectedId) {
      detailBody.appendChild(el("p", "detail-placeholder", "Select an incident to view details."));
      return;
    }

    var inc = state.incidents.find(function (i) { return i.id === state.selectedId; });
    if (!inc) {
      detailBody.appendChild(el("p", "detail-placeholder", "Select an incident to view details."));
      return;
    }

    detailBody.appendChild(el("h3", "detail-title", inc.title));
    detailBody.appendChild(el("div", "detail-id", inc.id));

    var sevLine = el("div", "detail-row");
    sevLine.appendChild(el("span", null, "Severity"));
    var sevVal = el("span", "sev sev-" + inc.severity, inc.severity);
    sevLine.appendChild(sevVal);
    detailBody.appendChild(sevLine);

    var svcLine = el("div", "detail-row");
    svcLine.appendChild(el("span", null, "Service"));
    svcLine.appendChild(el("span", null, inc.service));
    detailBody.appendChild(svcLine);

    var ageLine = el("div", "detail-row");
    ageLine.appendChild(el("span", null, "Age"));
    ageLine.appendChild(el("span", null, inc.age));
    detailBody.appendChild(ageLine);

    var ownerLine = el("div", "detail-row");
    ownerLine.appendChild(el("span", null, "Owner"));
    ownerLine.appendChild(el("span", null, inc.owner));
    detailBody.appendChild(ownerLine);

    var statusLine = el("div", "detail-row");
    statusLine.appendChild(el("span", null, "Status"));
    statusLine.appendChild(el("span", "status status-" + normalizeStatus(inc.status), inc.status));
    detailBody.appendChild(statusLine);

    var btn = el("button", "ack-btn", "Acknowledge");
    btn.type = "button";
    if (normalizeStatus(inc.status) === "acknowledged") {
      btn.classList.add("is-acked");
      btn.textContent = "Acknowledged";
      btn.disabled = true;
    }
    btn.addEventListener("click", function () { acknowledge(inc.id); });
    detailBody.appendChild(btn);
  }

  function acknowledge(id) {
    var inc = state.incidents.find(function (i) { return i.id === id; });
    if (!inc) return;
    inc.status = "acknowledged";
    renderTable();
    if (document.getElementById("status-filter").value === "all" ||
        document.getElementById("status-filter").value === "acknowledged") {
      selectRow(id);
    }
    var orig = inc.owner;
    showToast("Acknowledged " + id + (orig && orig !== "Unassigned" ? " (" + orig + ")" : ""));
  }

  function selectRow(id) {
    state.selectedId = id;
    var rows = document.querySelectorAll("#incident-body tr");
    rows.forEach(function (r) {
      var selected = r.getAttribute("data-id") === id;
      r.classList.toggle("is-selected", selected);
      r.setAttribute("aria-selected", selected ? "true" : "false");
    });
    renderDetail();
  }

  function showToast(msg) {
    var existing = document.querySelector(".toast");
    if (existing) existing.remove();
    var t = el("div", "toast", msg);
    t.setAttribute("role", "status");
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  /* ----- clock ----- */
  function tick() {
    var now = new Date();
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var str = pad(now.getUTCHours()) + ":" + pad(now.getUTCMinutes()) + " UTC";
    var clock = document.getElementById("clock");
    if (clock) clock.textContent = str;
  }

  /* ----- events ----- */
  function bind() {
    document.getElementById("sev-filter").addEventListener("change", function (e) {
      state.filters.severity = e.target.value;
      renderTable();
    });
    document.getElementById("status-filter").addEventListener("change", function (e) {
      state.filters.status = e.target.value;
      renderTable();
    });
    document.getElementById("search-filter").addEventListener("input", function (e) {
      state.filters.query = e.target.value;
      renderTable();
    });

    document.getElementById("incident-body").addEventListener("click", function (e) {
      var tr = e.target.closest("tr");
      if (tr && tr.getAttribute("data-id")) selectRow(tr.getAttribute("data-id"));
    });
    document.getElementById("incident-body").addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        var tr = e.target.closest("tr");
        if (tr && tr.getAttribute("data-id")) {
          e.preventDefault();
          selectRow(tr.getAttribute("data-id"));
        }
      }
    });
  }

  /* ----- init ----- */
  function init() {
    bind();
    tick();
    setInterval(tick, 30000);

    loadData()
      .then(function (data) {
        state.incidents = data.incidents;
        renderMetrics(data.metrics);
        renderChart(data.throughput);
        renderTable();
      })
      .catch(function () {
        var body = document.getElementById("incident-body");
        body.appendChild(el("tr"));
        document.getElementById("empty-state").hidden = false;
        document.getElementById("empty-state").textContent = "Unable to load incident data.";
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();