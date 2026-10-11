(function () {
  "use strict";

  var OPERATOR = "A. Kovač";

  var SEED = {
    metrics: [
      { label: "Events / min", value: "18,420", change: "+8.2%", direction: "up", better: "none", sub: "peak 21.4k" },
      { label: "P95 latency", value: "184 ms", change: "−12 ms", direction: "down", better: "down", sub: "SLO 250 ms" },
      { label: "Error rate", value: "0.37%", change: "+0.08 pp", direction: "up", better: "down", sub: "budget 12% left" },
      { label: "Queue depth", value: "2,841", change: "−19%", direction: "down", better: "down", sub: "drain 41/s" }
    ],
    throughput: [31, 28, 24, 22, 20, 23, 34, 48, 62, 71, 76, 73, 68, 72, 80, 84, 79, 75, 82, 88, 77, 63, 52, 41],
    incidents: [
      {
        id: "INC-2841", severity: "critical", service: "payments-api", age: "12m", owner: "M. Chen",
        status: "investigating", title: "Card authorization timeouts", minutes: 12, affected: "1.2% of checkouts",
        summary: "Authorization calls to the primary PSP are timing out after 5 s. Retries are amplifying load and the circuit breaker has not yet tripped.",
        events: [
          { at: "12m ago", who: "pagerduty", what: "Page fired on 5xx ratio > 2% for payments-api" },
          { at: "10m ago", who: "M. Chen", what: "Declared incident, escalated to bridge 4431" },
          { at: "7m ago", who: "synthetics", what: "EU checkout probe failing at tokenize step" },
          { at: "3m ago", who: "M. Chen", what: "Ruled out deploy rollback — started 40 min pre-release" }
        ]
      },
      {
        id: "INC-2839", severity: "high", service: "event-router", age: "31m", owner: "Unassigned",
        status: "open", title: "EU retry queue growth", minutes: 31, affected: "8.4k messages",
        summary: "The EU retry queue is growing at roughly 90 msg/s because downstream consumers are rejecting with backpressure. No data loss observed.",
        events: [
          { at: "31m ago", who: "monitor", what: "Queue depth alert at 5k messages" },
          { at: "22m ago", who: "monitor", what: "Consumer lag 14 min, rejecting with 503" },
          { at: "9m ago", who: "runbook", what: "Suggested check: shard rebalance for eu-rt-2" }
        ]
      },
      {
        id: "INC-2837", severity: "medium", service: "search-index", age: "1h 08m", owner: "A. Silva",
        status: "monitoring", title: "Index freshness outside SLO", minutes: 68, affected: "catalogue reads",
        summary: "Replication lag has pushed index freshness past the 120 s SLO. Search results may omit very recent catalogue changes.",
        events: [
          { at: "1h 08m ago", who: "monitor", what: "Freshness SLO breach (180 s)" },
          { at: "44m ago", who: "A. Silva", what: "Paused backfill job to free write capacity" },
          { at: "18m ago", who: "A. Silva", what: "Lag recovering, moved to monitoring" }
        ]
      },
      {
        id: "INC-2832", severity: "low", service: "webhooks", age: "3h 42m", owner: "R. Patel",
        status: "open", title: "Elevated partner delivery lag", minutes: 222, affected: "3 partners",
        summary: "Outbound webhook delivery lag is 4–6 min for three partners. All deliveries eventually succeed within the retry window.",
        events: [
          { at: "3h 42m ago", who: "monitor", what: "Delivery p95 above 240 s" },
          { at: "2h 10m ago", who: "R. Patel", what: "Notified partner success contacts" }
        ]
      }
    ],
    services: [
      { name: "payments-api", note: "auth p95 5.1 s", burn: 92, state: "breach" },
      { name: "event-router", note: "consumer lag 14m", burn: 61, state: "warn" },
      { name: "search-index", note: "freshness 180 s", burn: 38, state: "warn" },
      { name: "webhooks", note: "delivery p95 4.2 m", burn: 17, state: "ok" },
      { name: "edge-gateway", note: "5xx 0.04%", burn: 6, state: "ok" },
      { name: "billing-jobs", note: "on schedule", burn: 3, state: "ok" }
    ]
  };

  var SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  var STATUS_ORDER = { open: 0, investigating: 1, monitoring: 2, acknowledged: 3 };
  var STATUS_LABEL = { open: "Open", investigating: "Investigating", monitoring: "Monitoring", acknowledged: "Acknowledged" };

  var state = {
    incidents: SEED.incidents.map(function (i) { return Object.assign({}, i); }),
    severity: "all",
    status: "all",
    query: "",
    sortKey: "severity",
    sortDir: "desc",
    selectedId: SEED.incidents[0].id,
    chartIndex: null
  };

  var $ = function (id) { return document.getElementById(id); };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function svg(tag, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) { if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, String(attrs[k])); }
    return n;
  }

  function arrow(direction) {
    return direction === "up"
      ? '<svg class="delta-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 9h-14z"/></svg>'
      : '<svg class="delta-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19l-7-9h14z"/></svg>';
  }

  function toneFor(m) {
    if (m.better === "none" || m.direction === "flat") { return "flat"; }
    return m.direction === m.better ? "good" : "bad";
  }

  function toneWord(t) { return t === "good" ? "improving" : t === "bad" ? "degrading" : "unchanged"; }

  function sparkline(seedValues, width, height) {
    var min = Math.min.apply(null, seedValues);
    var max = Math.max.apply(null, seedValues);
    var span = max - min || 1;
    var step = width / (seedValues.length - 1);
    var pts = seedValues.map(function (v, i) {
      var x = (i * step).toFixed(1);
      var y = (height - 2 - ((v - min) / span) * (height - 4)).toFixed(1);
      return x + "," + y;
    }).join(" ");
    var s = svg("svg", { class: "metric-spark", viewBox: "0 0 " + width + " " + height, width: width, height: height, "aria-hidden": "true", focusable: "false" });
    s.appendChild(svg("polyline", { points: pts, fill: "none", stroke: "currentColor", "stroke-width": 1.4, "stroke-linejoin": "round", "stroke-linecap": "round", opacity: 0.9 }));
    var last = pts.split(" ").pop().split(",");
    s.appendChild(svg("circle", { cx: last[0], cy: last[1], r: 1.9, fill: "currentColor" }));
    return s;
  }

  function renderMetrics() {
    var grid = $("metricGrid");
    grid.innerHTML = "";
    SEED.metrics.forEach(function (m, i) {
      var rnd = mulberry32(1000 + i * 77);
      var series = [];
      for (var k = 0; k < 14; k++) {
        var drift = m.direction === "up" ? k * 0.05 : -k * 0.05;
        series.push(0.5 + drift + (rnd() - 0.5) * 0.26);
      }
      var tone = toneFor(m);
      var li = document.createElement("li");
      li.className = "metric";
      li.setAttribute("aria-label", m.label + " " + m.value + ", " + m.change + " " + toneWord(tone) + ". " + m.sub);
      li.innerHTML =
        '<div class="metric-top"><span class="metric-label">' + m.label + '</span>' +
        '<span class="metric-sub">' + m.sub + '</span></div>' +
        '<p class="metric-value">' + m.value + '</p>';
      var bottom = document.createElement("div");
      bottom.className = "metric-bottom";
      var delta = document.createElement("span");
      delta.className = "delta delta-" + tone;
      delta.innerHTML = arrow(m.direction) + m.change;
      var spark = document.createElement("span");
      spark.className = "spark-slot";
      spark.style.color = tone === "bad" ? "var(--crit)" : tone === "good" ? "var(--ok)" : "var(--text-2)";
      spark.appendChild(sparkline(series, 76, 22));
      bottom.appendChild(delta);
      bottom.appendChild(spark);
      li.appendChild(bottom);
      grid.appendChild(li);
    });
  }

  function avg(arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; }

  function peakIndex(arr) {
    var idx = 0;
    for (var i = 1; i < arr.length; i++) { if (arr[i] > arr[idx]) { idx = i; } }
    return idx;
  }

  var chartGeom = { w: 0, h: 190, padL: 26, padR: 8, padT: 16, padB: 18, step: 0 };
  var chartBars = [];

  function renderChart() {
    var svgEl = $("chart");
    var wrap = svgEl.parentNode;
    var w = Math.max(280, wrap.clientWidth - 26);
    var h = window.innerWidth <= 720 ? 160 : 190;
    var data = SEED.throughput;
    var max = 100;
    var mean = avg(data);
    var peak = peakIndex(data);
    var padL = 26, padR = 8, padT = 16, padB = 18;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    var step = plotW / data.length;
    var barW = Math.max(4, Math.min(18, step - 3));

    svgEl.setAttribute("viewBox", "0 0 " + w + " " + h);
    svgEl.setAttribute("width", w);
    svgEl.setAttribute("height", h);
    while (svgEl.firstChild) { svgEl.removeChild(svgEl.firstChild); }
    chartBars = [];
    chartGeom = { w: w, h: h, padL: padL, padR: padR, padT: padT, padB: padB, step: step };

    var y = function (v) { return (padT + plotH - (v / max) * plotH).toFixed(1); };

    [0, 25, 50, 75, 100].forEach(function (v) {
      var yy = y(v);
      svgEl.appendChild(svg("line", { class: "grid-line", x1: padL, x2: w - padR, y1: yy, y2: yy }));
      var t = svg("text", { class: "axis-label", x: padL - 6, y: yy + 3, "text-anchor": "end" });
      t.textContent = v;
      svgEl.appendChild(t);
    });

    data.forEach(function (v, i) {
      var cx = padL + step * i + step / 2;
      var bh = Math.max(1.5, (v / max) * plotH);
      var cls = i === peak ? "bar bar-peak" : "bar";
      var rect = svg("rect", { class: cls, x: (cx - barW / 2).toFixed(1), y: (padT + plotH - bh).toFixed(1), width: barW.toFixed(1), height: bh.toFixed(1), rx: 1.5 });
      svgEl.appendChild(rect);
      chartBars.push({ i: i, v: v, cx: cx, top: padT + plotH - bh, bottom: padT + plotH, el: rect });
      if (i % 3 === 0) {
        var lb = svg("text", { class: "axis-label", x: cx.toFixed(1), y: h - 5, "text-anchor": "middle" });
        lb.textContent = (i < 10 ? "0" + i : i) + ":00";
        svgEl.appendChild(lb);
      }
    });

    var meanY = y(mean);
    svgEl.appendChild(svg("line", { class: "avg-line", x1: padL, x2: w - padR, y1: meanY, y2: meanY }));
    var ml = svg("text", { class: "avg-label", x: w - padR, y: (meanY - 5).toFixed(1), "text-anchor": "end" });
    ml.textContent = "mean " + mean.toFixed(0) + "k";
    svgEl.appendChild(ml);

    var pl = svg("text", { class: "peak-label", x: (padL + step * peak + step / 2).toFixed(1), y: (y(data[peak]) - 6).toFixed(1), "text-anchor": "middle" });
    pl.textContent = "peak " + data[peak] + "k";
    svgEl.appendChild(pl);

    var cursor = svg("line", { class: "chart-cursor", x1: 0, x2: 0, y1: padT - 4, y2: padT + plotH, opacity: 0 });
    svgEl.appendChild(cursor);
    chartGeom.cursor = cursor;

    $("throughputAvg").textContent = mean.toFixed(1);
    fillChartTable();
    if (state.chartIndex !== null) { paintChart(state.chartIndex); }
  }

  function fillChartTable() {
    var tb = $("chartTable").querySelector("tbody");
    tb.innerHTML = "";
    SEED.throughput.forEach(function (v, i) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.scope = "row";
      th.textContent = (i < 10 ? "0" + i : i) + ":00";
      var td = document.createElement("td");
      td.textContent = v + "k";
      tr.appendChild(th);
      tr.appendChild(td);
      tb.appendChild(tr);
    });
  }

  function paintChart(idx, spoken) {
    var g = chartGeom;
    if (!g.cursor) { return; }
    var b = chartBars[idx];
    if (!b) { return; }
    state.chartIndex = idx;
    g.cursor.setAttribute("x1", b.cx);
    g.cursor.setAttribute("x2", b.cx);
    g.cursor.setAttribute("opacity", 1);
    var peak = peakIndex(SEED.throughput);
    chartBars.forEach(function (other, i) {
      other.el.classList.toggle("bar-active", i === idx && i !== peak);
      other.el.classList.toggle("bar-peak", i === peak && i !== idx);
    });
    var hh = (idx < 10 ? "0" + idx : idx) + ":00";
    $("chartReadout").innerHTML = hh + " · <strong>" + b.v + "k</strong> events/min";
    var tip = $("chartTip");
    tip.hidden = false;
    tip.innerHTML = "<b>" + b.v + "k</b>" + hh + " – " + (idx === 23 ? "23:59" : (idx < 9 ? "0" + (idx + 1) : idx + 1) + ":00");
    var svgEl = $("chart");
    var wrap = svgEl.parentNode;
    var sr = svgEl.getBoundingClientRect();
    var wr = wrap.getBoundingClientRect();
    var scale = sr.width / g.w;
    var x = (sr.left - wr.left) + b.cx * scale;
    tip.style.left = Math.min(wrap.clientWidth - 58, Math.max(58, x)) + "px";
    tip.style.top = Math.max(54, b.top - 4) + "px";
    if (spoken) { announce(hh + " throughput " + b.v + " thousand events per minute"); }
  }

  function clearChart() {
    state.chartIndex = null;
    var g = chartGeom;
    if (g.cursor) { g.cursor.setAttribute("opacity", 0); }
    chartBars.forEach(function (b, i) {
      b.el.classList.remove("bar-active");
      b.el.classList.toggle("bar-peak", i === peakIndex(SEED.throughput));
    });
    $("chartReadout").textContent = "Hover or focus the chart, then use arrow keys";
    $("chartTip").hidden = true;
  }

  function bindChart() {
    var el = $("chart");
    var wrap = el.parentNode;

    function indexFromEvent(e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) * (chartGeom.w / r.width);
      var i = Math.floor((x - chartGeom.padL) / chartGeom.step);
      return Math.max(0, Math.min(SEED.throughput.length - 1, i));
    }

    el.addEventListener("mousemove", function (e) { paintChart(indexFromEvent(e), false); });
    el.addEventListener("mouseleave", clearChart);
    el.addEventListener("touchstart", function (e) { paintChart(indexFromEvent(e.touches[0]), false); }, { passive: true });
    el.addEventListener("touchmove", function (e) { paintChart(indexFromEvent(e.touches[0]), false); }, { passive: true });
    el.addEventListener("focus", function () {
      if (state.chartIndex === null) { paintChart(peakIndex(SEED.throughput), true); }
    });
    el.addEventListener("blur", clearChart);
    el.addEventListener("keydown", function (e) {
      var n = SEED.throughput.length;
      var i = state.chartIndex === null ? peakIndex(SEED.throughput) : state.chartIndex;
      if (e.key === "ArrowRight") { i = (i + 1) % n; }
      else if (e.key === "ArrowLeft") { i = (i - 1 + n) % n; }
      else if (e.key === "Home") { i = 0; }
      else if (e.key === "End") { i = n - 1; }
      else if (e.key === "Escape") { clearChart(); el.blur(); return; }
      else { return; }
      e.preventDefault();
      paintChart(i, true);
    });

    var t;
    window.addEventListener("resize", function () {
      window.clearTimeout(t);
      t = window.setTimeout(renderChart, 120);
    });
  }

  function filtered() {
    var q = state.query.trim().toLowerCase();
    return state.incidents.filter(function (i) {
      if (state.severity !== "all" && i.severity !== state.severity) { return false; }
      if (state.status !== "all" && i.status !== state.status) { return false; }
      if (!q) { return true; }
      return (i.id + " " + i.title + " " + i.service + " " + i.owner).toLowerCase().indexOf(q) !== -1;
    });
  }

  function sortRows(rows) {
    var k = state.sortKey;
    var dir = state.sortDir === "asc" ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var r;
      if (k === "severity") { r = SEV_ORDER[b.severity] - SEV_ORDER[a.severity]; }
      else if (k === "age") { r = b.minutes - a.minutes; }
      else if (k === "status") { r = STATUS_ORDER[b.status] - STATUS_ORDER[a.status]; }
      else if (k === "owner") { r = a.owner.localeCompare(b.owner); }
      else { r = a.id.localeCompare(b.id); }
      if (r === 0) { r = a.id.localeCompare(b.id); }
      return r * dir;
    });
  }

  function renderTable() {
    var rows = sortRows(filtered());
    var body = $("incidentBody");
    body.innerHTML = "";
    rows.forEach(function (inc) {
      var tr = document.createElement("tr");
      tr.tabIndex = inc.id === state.selectedId ? 0 : -1;
      tr.dataset.id = inc.id;
      if (inc.id === state.selectedId) { tr.setAttribute("aria-current", "true"); }
      tr.innerHTML =
        '<td class="col-sev" data-label="Severity"><span class="sev sev-' + inc.severity + '"><i></i>' + inc.severity + "</span></td>" +
        '<td class="cell-id" data-label="Incident"><span class="id">' + inc.id + '</span><span class="title">' + inc.title + "</span></td>" +
        '<td class="col-service cell-mono" data-label="Service">' + inc.service + "</td>" +
        '<td class="col-age cell-age" data-label="Age">' + inc.age + "</td>" +
        '<td class="col-owner cell-owner' + (inc.owner === "Unassigned" ? " is-unassigned" : "") + '" data-label="Owner">' + inc.owner + "</td>" +
        '<td class="col-status" data-label="Status"><span class="status status-' + inc.status + '"><i></i>' + STATUS_LABEL[inc.status] + "</span></td>";
      tr.addEventListener("click", function () { select(inc.id, false); });
      tr.addEventListener("dblclick", function () { select(inc.id, true); });
      tr.addEventListener("keydown", function (e) { return rowKeys(e, inc.id); });
      body.appendChild(tr);
    });

    var empty = rows.length === 0;
    $("emptyState").hidden = !empty;
    $("incidentTable").hidden = empty;
    if (empty) {
      var anyFilter = state.severity !== "all" || state.status !== "all" || state.query.trim() !== "";
      $("emptyDetail").textContent = anyFilter
        ? "No incident matches “" + (state.query.trim() || state.severity + " / " + state.status) + "”. Widen the filters to see the rest."
        : "No incidents are currently open.";
    }

    $("resultCount").textContent = rows.length + " of " + state.incidents.length + " shown";
    $("clearFilters").hidden = state.severity === "all" && state.status === "all" && state.query.trim() === "";
    $("railIncidentCount").textContent = state.incidents.length;
    renderRollup();
  }

  function renderRollup() {
    var c = { critical: 0, high: 0, other: 0 };
    state.incidents.forEach(function (i) {
      if (i.status === "acknowledged") { return; }
      if (i.severity === "critical") { c.critical++; }
      else if (i.severity === "high") { c.high++; }
      else { c.other++; }
    });
    var parts = [];
    if (c.critical) { parts.push(c.critical + " critical"); }
    if (c.high) { parts.push(c.high + " high"); }
    if (c.other) { parts.push(c.other + " tracked"); }
    $("statusRollup").textContent = parts.join(" · ") || "no active incidents";
  }

  function rowKeys(e, id) {
    var rows = Array.prototype.slice.call($("incidentBody").querySelectorAll("tr"));
    var idx = rows.findIndex(function (r) { return r.dataset.id === id; });
    var next = -1;
    if (e.key === "ArrowDown") { next = Math.min(rows.length - 1, idx + 1); }
    else if (e.key === "ArrowUp") { next = Math.max(0, idx - 1); }
    else if (e.key === "Home") { next = 0; }
    else if (e.key === "End") { next = rows.length - 1; }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(id, true); return; }
    else { return; }
    e.preventDefault();
    if (next >= 0 && rows[next]) {
      select(rows[next].dataset.id, false);
      rows[next].focus();
    }
  }

  function renderSevFilter() {
    var host = $("sevFilter");
    host.innerHTML = "";
    var opts = [{ v: "all", l: "All", s: "sev-flat" }].concat(
      ["critical", "high", "medium", "low"].map(function (s) {
        return { v: s, l: s[0].toUpperCase() + s.slice(1), s: "sev-" + s };
      })
    );
    opts.forEach(function (o) {
      var count = o.v === "all" ? state.incidents.length : state.incidents.filter(function (i) { return i.severity === o.v; }).length;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "seg";
      b.dataset.value = o.v;
      b.setAttribute("aria-pressed", String(state.severity === o.v));
      b.innerHTML = '<span class="sev ' + o.s + '"><i></i></span>' + o.l + ' <span class="n">' + count + "</span>";
      b.addEventListener("click", function () {
        state.severity = o.v;
        Array.prototype.forEach.call(host.children, function (c) {
          c.setAttribute("aria-pressed", String(c.dataset.value === state.severity));
        });
        renderTable();
      });
      host.appendChild(b);
    });
  }

  function renderServices() {
    var host = $("serviceGrid");
    host.innerHTML = "";
    SEED.services.forEach(function (s) {
      var color = s.burn >= 80 ? "var(--crit)" : s.burn >= 35 ? "var(--high)" : "var(--ok)";
      var li = document.createElement("li");
      li.className = "service";
      li.innerHTML =
        '<div class="service-top"><span class="service-name">' + s.name + '</span><span class="badge status status-' + (s.state === "breach" ? "open" : s.state === "warn" ? "monitoring" : "acknowledged") + '"><i></i>' + s.state + "</span></div>" +
        '<p class="service-value">' + s.burn + "%</p>" +
        '<div class="meter"><i style="width:' + s.burn + "%;background:" + color + '"></i></div>' +
        '<p class="service-sub">' + s.note + " · error budget burn</p>";
      host.appendChild(li);
    });
  }

  function selected() {
    for (var i = 0; i < state.incidents.length; i++) {
      if (state.incidents[i].id === state.selectedId) { return state.incidents[i]; }
    }
    return null;
  }

  function renderDetail(announceSelection) {
    var inc = selected();
    var empty = $("detailEmpty");
    var content = $("detailContent");
    if (!inc) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }
    empty.hidden = true;
    content.hidden = false;

    var acked = inc.status === "acknowledged";
    var events = inc.events.slice();
    if (acked && inc.ackedAt) {
      events.unshift({ at: inc.ackedAt, who: OPERATOR, what: "Acknowledged — taking ownership of the response" });
    }
    content.innerHTML =
      '<div class="detail-head">' +
        '<div class="detail-kicker">' +
          '<span class="detail-id mono">' + inc.id + "</span>" +
          '<span class="sev sev-' + inc.severity + '"><i></i>' + inc.severity + "</span>" +
        "</div>" +
        "<h3>" + inc.title + "</h3>" +
        '<span class="status status-' + inc.status + '"><i></i>' + STATUS_LABEL[inc.status] + "</span>" +
      "</div>" +
      '<dl class="detail-meta">' +
        "<div><dt>Service</dt><dd class=\"mono\">" + inc.service + "</dd></div>" +
        "<div><dt>Age</dt><dd class=\"mono\">" + inc.age + "</dd></div>" +
        "<div><dt>Owner</dt><dd>" + inc.owner + "</dd></div>" +
        "<div><dt>Impact</dt><dd>" + inc.affected + "</dd></div>" +
      "</dl>" +
      '<div class="detail-section"><h4>Assessment</h4><p>' + inc.summary + "</p></div>" +
      '<div class="detail-section"><h4>Timeline</h4><ul class="timeline">' +
        events.map(function (e) {
          return "<li><time>" + e.at + "</time><b>" + e.who + "</b> — " + e.what + "</li>";
        }).join("") +
      "</ul></div>" +
      '<div class="detail-actions">' +
        '<button class="btn btn-primary" type="button" id="ackBtn"' + (acked ? " disabled" : "") + ">Acknowledge</button>" +
        '<button class="btn" type="button" id="assignBtn"' + (inc.owner === OPERATOR ? " disabled" : "") + ">Assign to me</button>" +
        '<button class="btn btn-quiet btn-icon detail-close" type="button" id="detailClose" aria-label="Close detail panel">' +
          '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z"/></svg>' +
        "</button>" +
        '<p class="detail-ack-meta" id="ackMeta"' + (acked ? "" : " hidden") + ">" + (inc.ackedAt ? "Acknowledged " + inc.ackedAt : "") + " by " + (inc.ackedBy || OPERATOR) + "</p>" +
      "</div>";

    var ackBtn = $("ackBtn");
    if (ackBtn) {
      ackBtn.addEventListener("click", function () { acknowledge(inc.id); });
    }
    var assignBtn = $("assignBtn");
    if (assignBtn) {
      assignBtn.addEventListener("click", function () { assignToMe(inc.id); });
    }
    var closeBtn = $("detailClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        state.selectedId = null;
        Array.prototype.forEach.call($("incidentBody").querySelectorAll("tr"), function (r) {
          r.tabIndex = -1;
          r.removeAttribute("aria-current");
        });
        renderDetail(false);
        announce("Detail panel closed");
        var first = $("incidentBody").querySelector("tr");
        if (first) { first.tabIndex = 0; }
      });
    }
    if (announceSelection) {
      announce(inc.id + " selected: " + inc.title + ", " + inc.severity + ", " + inc.service + ", owner " + inc.owner + ", status " + STATUS_LABEL[inc.status]);
    }
  }

  function acknowledge(id) {
    var inc = null;
    state.incidents.forEach(function (i) { if (i.id === id) { inc = i; } });
    if (!inc || inc.status === "acknowledged") { return; }
    inc.status = "acknowledged";
    inc.owner = inc.owner === "Unassigned" ? OPERATOR : inc.owner;
    inc.ackedAt = nowLabel();
    inc.ackedBy = OPERATOR;
    inc.events.unshift({ at: inc.ackedAt, who: OPERATOR, what: "Acknowledged and claimed the incident" });
    renderTable();
    renderDetail(false);
    renderActivity();
    announce("Incident " + inc.id + " acknowledged by " + OPERATOR + ". Status set to acknowledged.");
    var focusTarget = document.querySelector('#incidentBody tr[data-id="' + id + '"]');
    if (focusTarget) { focusTarget.focus(); }
  }

  function assignToMe(id) {
    var inc = null;
    state.incidents.forEach(function (i) { if (i.id === id) { inc = i; } });
    if (!inc || inc.owner === OPERATOR) { return; }
    inc.owner = OPERATOR;
    inc.events.unshift({ at: nowLabel(), who: OPERATOR, what: "Assigned to " + OPERATOR });
    renderTable();
    renderDetail(false);
    renderActivity();
    announce(inc.id + " assigned to " + OPERATOR);
  }

  function select(id, focusPanel) {
    if (state.selectedId === id && !focusPanel) { return; }
    state.selectedId = id;
    var rows = $("incidentBody").querySelectorAll("tr");
    Array.prototype.forEach.call(rows, function (r) {
      var on = r.dataset.id === id;
      r.tabIndex = on ? 0 : -1;
      if (on) { r.setAttribute("aria-current", "true"); } else { r.removeAttribute("aria-current"); }
    });
    renderDetail(true);
    if (focusPanel) {
      var panel = $("detail");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      panel.focus({ preventScroll: true });
    }
  }

  function nowLabel() {
    var d = new Date();
    return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") + " UTC";
  }

  var liveTimer = null;
  function announce(msg) {
    var lr = $("liveRegion");
    window.clearTimeout(liveTimer);
    liveTimer = window.setTimeout(function () { lr.textContent = msg; }, 60);
  }

  function bindSort() {
    var ths = document.querySelectorAll("#incidentTable thead th[data-sort]");
    Array.prototype.forEach.call(ths, function (th) {
      th.querySelector(".th-btn").addEventListener("click", function () {
        var key = th.dataset.sort;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = key === "severity" || key === "age" ? "desc" : "asc";
        }
        Array.prototype.forEach.call(ths, function (o) { o.removeAttribute("aria-sort"); });
        th.setAttribute("aria-sort", state.sortDir === "asc" ? "ascending" : "descending");
        renderTable();
        announce("Sorted by " + key + ", " + (state.sortDir === "asc" ? "ascending" : "descending"));
      });
    });
  }

  function bindFilters() {
    $("searchInput").addEventListener("input", function (e) {
      state.query = e.target.value;
      renderTable();
    });
    $("searchInput").addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.target.value = "";
        state.query = "";
        renderTable();
      }
    });
    $("statusFilter").addEventListener("change", function (e) {
      state.status = e.target.value;
      renderTable();
    });
    var clear = function () {
      state.severity = "all";
      state.status = "all";
      state.query = "";
      $("searchInput").value = "";
      $("statusFilter").value = "all";
      renderSevFilter();
      renderTable();
      announce("Filters cleared");
    };
    $("clearFilters").addEventListener("click", clear);
    $("emptyClear").addEventListener("click", clear);
  }

  function bindShortcuts() {
    var dialog = $("shortcuts");
    var toggle = function (open) {
      dialog.hidden = open === false;
      if (!dialog.hidden) { $("shortcutsClose").focus(); }
    };
    $("shortcutsBtn").addEventListener("click", function () { toggle(!dialog.hidden); });
    $("shortcutsClose").addEventListener("click", function () { toggle(false); });

    document.addEventListener("keydown", function (e) {
      var t = e.target;
      var typing = t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA");
      if (e.key === "?") { e.preventDefault(); toggle(!dialog.hidden); return; }
      if (e.key === "Escape" && !dialog.hidden) { toggle(false); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || typing) { return; }
      if (e.key === "/") { e.preventDefault(); $("searchInput").focus(); return; }
      var rows = Array.prototype.slice.call($("incidentBody").querySelectorAll("tr"));
      if (!rows.length) { return; }
      var idx = rows.findIndex(function (r) { return r.dataset.id === state.selectedId; });
      var target = -1;
      if (e.key === "j") { target = Math.min(rows.length - 1, (idx < 0 ? -1 : idx) + 1); }
      else if (e.key === "k") { target = Math.max(0, (idx < 0 ? 0 : idx) - 1); }
      else if (e.key === "a" && idx >= 0) {
        e.preventDefault();
        acknowledge(rows[idx].dataset.id);
        return;
      } else { return; }
      e.preventDefault();
      select(rows[target].dataset.id, false);
      rows[target].focus();
    });
  }

  function renderActivity() {
    var host = $("feed");
    var items = [];
    state.incidents.forEach(function (inc) {
      inc.events.forEach(function (e) {
        items.push({ inc: inc, at: e.at, who: e.what && e.who, what: e.what, minutes: inc.minutes });
      });
    });
    items.sort(function (a, b) { return a.minutes - b.minutes; });
    host.innerHTML = "";
    items.slice(0, 9).forEach(function (it) {
      var li = document.createElement("li");
      li.className = "feed-item";
      li.innerHTML =
        '<span class="sev sev-' + it.inc.severity + '"><i></i></span>' +
        '<span class="feed-time mono">' + it.at + "</span>" +
        '<span class="feed-body"><b>' + it.inc.id + "</b> " + it.what + ' <span class="feed-who">— ' + it.who + "</span></span>";
      li.addEventListener("click", function () { select(it.inc.id, false); document.getElementById("incidents").scrollIntoView({ behavior: "smooth", block: "start" }); });
      host.appendChild(li);
    });
  }

  function bindScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".rail-link"));
    var map = {};
    links.forEach(function (l) {
      var id = l.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (el) { map[id] = l; }
    });
    if (!("IntersectionObserver" in window)) { return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        links.forEach(function (l) { l.classList.remove("is-active"); l.removeAttribute("aria-current"); });
        var link = map[en.target.id];
        if (link) { link.classList.add("is-active"); link.setAttribute("aria-current", "page"); }
      });
    }, { rootMargin: "-20% 0px -70% 0px", threshold: 0 });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  function tick() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, "0"); };
    $("clock").textContent = p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds()) + " UTC";
    $("footerStamp").textContent = "seeded " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + "Z · " + state.incidents.length + " incidents · eu-west-1";
  }

  renderMetrics();
  renderChart();
  bindChart();
  renderSevFilter();
  renderTable();
  renderDetail(true);
  renderServices();
  renderActivity();
  bindSort();
  bindFilters();
  bindShortcuts();
  bindScrollSpy();
  tick();
  window.setInterval(tick, 1000);
})();
