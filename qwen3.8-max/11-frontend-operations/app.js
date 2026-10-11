(function () {
  "use strict";

  var dataEl = document.getElementById("relay-data");
  var DATA = JSON.parse(dataEl.textContent);

  var SEVERITY = {
    critical: { label: "Critical", rank: 4 },
    high: { label: "High", rank: 3 },
    medium: { label: "Medium", rank: 2 },
    low: { label: "Low", rank: 1 }
  };

  var STATUS_LABEL = {
    open: "Open",
    investigating: "Investigating",
    monitoring: "Monitoring",
    acknowledged: "Acknowledged",
    resolved: "Resolved"
  };

  var LOWER_IS_BETTER = { "P95 latency": true, "Error rate": true, "Queue depth": true };

  var IMPACT = {
    critical: "Customer-facing · SLO breach",
    high: "Degraded · at-risk SLO",
    medium: "Internal · trending",
    low: "Minor · background"
  };

  var state = {
    incidents: DATA.incidents.map(enrich),
    q: "",
    sev: "all",
    status: "all",
    sort: { key: "severity", dir: "desc" },
    selectedId: null
  };

  function enrich(inc) {
    var o = Object.assign({}, inc);
    o.acknowledgedAt = null;
    o.resolvedAt = null;
    o.region = "us-east-1";
    o.impact = IMPACT[inc.severity] || "—";
    o.ageMin = parseAge(inc.age);
    o.timeline = [
      { t: "Alert fired · " + inc.service, m: "auto · " + inc.age + " ago", now: false },
      { t: "Status set to " + STATUS_LABEL[inc.status], m: "system", now: true }
    ];
    return o;
  }

  function parseAge(s) {
    var m = /(\d+)\s*h/i.exec(s);
    var mm = /(\d+)\s*m/i.exec(s);
    return (m ? parseInt(m[1], 10) * 60 : 0) + (mm ? parseInt(mm[1], 10) : 0);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtAge(mins) {
    if (mins < 60) return mins + "m";
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return h + "h " + String(m).padStart(2, "0") + "m";
  }

  var $ = function (id) { return document.getElementById(id); };

  function announce(msg) {
    var live = $("live");
    live.textContent = "";
    window.setTimeout(function () { live.textContent = msg; }, 30);
  }

  function arrow(dir) {
    var up = dir === "up";
    return '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">' +
      '<path d="' + (up ? "M6 2.5 10 8H2L6 2.5Z" : "M6 9.5 2 4h8L6 9.5Z") + '" fill="currentColor"/></svg>';
  }

  function renderMetrics() {
    var host = $("metrics");
    host.innerHTML = DATA.metrics.map(function (m) {
      var goodWhenDown = !!LOWER_IS_BETTER[m.label];
      var isDown = m.direction === "down";
      var good = goodWhenDown ? isDown : !isDown;
      var sentiment = good ? "good" : "bad";
      return '' +
        '<article class="metric" data-sentiment="' + sentiment + '">' +
          '<div class="metric__top">' +
            '<span class="metric__label">' + esc(m.label) + '</span>' +
          '</div>' +
          '<div class="metric__value num">' + esc(m.value) + '</div>' +
          '<div class="metric__foot">' +
            '<span class="chip chip--' + sentiment + '">' + arrow(m.direction) + esc(m.change) + '</span>' +
            '<span class="metric__note">vs prev hour</span>' +
          '</div>' +
        '</article>';
    }).join("");
  }

  var CH = { W: 720, H: 230, padL: 34, padR: 14, padT: 14, padB: 26 };
  var series = DATA.throughput;
  var maxY = Math.ceil(Math.max.apply(null, series) / 10) * 10;

  function cx(i) {
    var step = (CH.W - CH.padL - CH.padR) / (series.length - 1);
    return CH.padL + step * i;
  }
  function cy(v) {
    var plotH = CH.H - CH.padT - CH.padB;
    return CH.padT + plotH - (v / maxY) * plotH;
  }
  function hourLabel(i) {
    return String(i).padStart(2, "0") + ":00";
  }

  function renderChart() {
    var plotBottom = CH.H - CH.padB;
    var linePts = series.map(function (v, i) { return cx(i) + "," + cy(v); }).join(" ");
    var areaPath = "M" + cx(0) + "," + plotBottom + " L" +
      series.map(function (v, i) { return cx(i) + "," + cy(v); }).join(" L") +
      " L" + cx(series.length - 1) + "," + plotBottom + " Z";

    var gridVals = [];
    for (var g = 0; g <= maxY; g += maxY / 3) gridVals.push(g);

    var grid = gridVals.map(function (v) {
      var y = cy(v);
      return '<line class="grid-line" x1="' + CH.padL + '" y1="' + y + '" x2="' + (CH.W - CH.padR) + '" y2="' + y + '"/>' +
        '<text class="axis-label" x="' + (CH.padL - 8) + '" y="' + (y + 3) + '" text-anchor="end">' + v + '</text>';
    }).join("");

    var xlabels = series.map(function (v, i) {
      if (i % 3 !== 0 && i !== series.length - 1) return "";
      return '<text class="axis-label" x="' + cx(i) + '" y="' + (CH.H - 8) + '" text-anchor="middle">' + hourLabel(i) + '</text>';
    }).join("");

    var svg =
      '<svg viewBox="0 0 ' + CH.W + ' ' + CH.H + '" role="img" ' +
        'aria-label="Throughput over the last 24 hours, ranging from ' + Math.min.apply(null, series) +
        'k to ' + Math.max.apply(null, series) + 'k events per minute, peaking at 19:00.">' +
        grid + xlabels +
        '<path class="area-fill" d="' + areaPath + '"/>' +
        '<polyline class="line-stroke" points="' + linePts + '"/>' +
        '<line class="crosshair" id="crosshair" x1="0" y1="' + CH.padT + '" x2="0" y2="' + plotBottom + '" opacity="0"/>' +
        '<circle class="hover-dot" id="hover-dot" cx="0" cy="0" r="4" opacity="0"/>' +
        '<rect id="chart-hit" x="' + CH.padL + '" y="' + CH.padT + '" width="' + (CH.W - CH.padL - CH.padR) + '" height="' + (CH.H - CH.padT - CH.padB) + '" fill="transparent"/>' +
      '</svg>';

    var chart = $("chart");
    chart.insertAdjacentHTML("afterbegin", svg);

    var sum = series.reduce(function (a, b) { return a + b; }, 0);
    $("chart-peak").textContent = Math.max.apply(null, series) + "k";
    $("chart-avg").textContent = Math.round(sum / series.length) + "k";

    buildChartA11yTable();
    wireChartHover();
  }

  function buildChartA11yTable() {
    var rows = series.map(function (v, i) {
      return "<tr><th scope=\"row\">" + hourLabel(i) + "</th><td>" + v + "k events/min</td></tr>";
    }).join("");
    var wrap = document.createElement("div");
    wrap.className = "sr-only";
    wrap.innerHTML = "<table><caption>Throughput data, last 24 hours</caption><tbody>" + rows + "</tbody></table>";
    $("throughput").appendChild(wrap);
  }

  function wireChartHover() {
    var svg = $("chart").querySelector("svg");
    var hit = $("chart-hit");
    var tip = $("chart-tip");
    var cross = $("crosshair");
    var hd = $("hover-dot");

    function move(clientX) {
      var rect = svg.getBoundingClientRect();
      var svgX = (clientX - rect.left) * (CH.W / rect.width);
      var step = (CH.W - CH.padL - CH.padR) / (series.length - 1);
      var i = Math.round((svgX - CH.padL) / step);
      i = Math.max(0, Math.min(series.length - 1, i));
      var x = cx(i), y = cy(series[i]);

      cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("opacity", "1");
      hd.setAttribute("cx", x); hd.setAttribute("cy", y); hd.setAttribute("opacity", "1");

      var px = (x / CH.W) * rect.width;
      var py = (y / CH.H) * rect.height;
      tip.hidden = false;
      tip.style.left = px + "px";
      tip.style.top = py + "px";
      tip.innerHTML = "<b>" + series[i] + "k</b> <span>" + hourLabel(i) + "</span>";
    }
    function leave() {
      tip.hidden = true;
      cross.setAttribute("opacity", "0");
      hd.setAttribute("opacity", "0");
    }
    hit.addEventListener("mousemove", function (e) { move(e.clientX); });
    hit.addEventListener("mouseleave", leave);
    hit.addEventListener("touchstart", function (e) { if (e.touches[0]) move(e.touches[0].clientX); }, { passive: true });
    hit.addEventListener("touchmove", function (e) { if (e.touches[0]) move(e.touches[0].clientX); }, { passive: true });
    hit.addEventListener("touchend", leave);
  }

  function matches(inc) {
    if (state.sev !== "all" && inc.severity !== state.sev) return false;
    if (state.status !== "all" && inc.status !== state.status) return false;
    if (state.q) {
      var hay = (inc.id + " " + inc.title + " " + inc.service + " " + inc.owner).toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function comparator(a, b) {
    var key = state.sort.key, dir = state.sort.dir === "asc" ? 1 : -1;
    var d;
    if (key === "age") d = (a.ageMin - b.ageMin) * dir;
    else d = (SEVERITY[a.severity].rank - SEVERITY[b.severity].rank) * dir;
    if (d !== 0) return d;
    return (SEVERITY[b.severity].rank - SEVERITY[a.severity].rank);
  }

  function visible() {
    return state.incidents.filter(matches).sort(comparator);
  }

  function renderTable() {
    var list = visible();
    var tbody = $("rows");
    tbody.innerHTML = list.map(function (inc) {
      var sel = inc.id === state.selectedId;
      return '' +
        '<tr data-id="' + inc.id + '" class="' + (sel ? "is-selected" : "") + '" tabindex="' + (sel ? "0" : "-1") + '" ' +
          (sel ? 'aria-current="true"' : "") + '>' +
          '<td class="col-sev" data-label="Severity"><span class="sev sev--' + inc.severity + '"><span class="sev__dot" aria-hidden="true"></span>' + SEVERITY[inc.severity].label + '</span></td>' +
          '<td class="col-inc" data-label="Incident"><span class="cell-inc"><span class="cell-inc__title">' + esc(inc.title) + '</span><span class="cell-inc__id">' + esc(inc.id) + '</span></span></td>' +
          '<td class="col-svc" data-label="Service"><span class="svc">' + esc(inc.service) + '</span></td>' +
          '<td class="col-age" data-label="Age">' + esc(inc.age) + '</td>' +
          '<td class="col-own" data-label="Owner"><span class="own' + (inc.owner === "Unassigned" ? " own--none" : "") + '">' + esc(inc.owner) + '</span></td>' +
          '<td class="col-status" data-label="Status"><span class="badge badge--' + inc.status + '">' + STATUS_LABEL[inc.status] + '</span></td>' +
        '</tr>';
    }).join("");

    var total = state.incidents.length;
    var filtered = state.q || state.sev !== "all" || state.status !== "all";
    var count = $("result-count");
    count.textContent = list.length === total
      ? total + " incident" + (total !== 1 ? "s" : "")
      : list.length + " of " + total + " incident" + (total !== 1 ? "s" : "");

    var empty = $("empty");
    var isFilteredEmpty = list.length === 0 && filtered;
    empty.hidden = list.length !== 0;
    $("empty-clear").hidden = !isFilteredEmpty;
    if (list.length === 0) {
      $("empty-title").textContent = total === 0 ? "No incidents" : (filtered ? "No incidents match these filters" : "No incidents");
      $("empty-sub").textContent = total === 0 ? "Nothing is currently being tracked." : (filtered ? "Try broadening your search or clearing filters." : "All quiet.");
    }

    var clearVisible = !!filtered;
    $("clear").hidden = !clearVisible;
    $("clear").classList.toggle("btn--clear", clearVisible);

    if (!list.some(function (i) { return i.id === state.selectedId; })) {
      state.selectedId = list.length ? list[0].id : null;
    }
    syncRoving();
    renderDetail();
    renderGlobalStatus();
  }

  function syncRoving() {
    var rows = $("rows").querySelectorAll("tr");
    if (!rows.length) return;
    var found = false;
    rows.forEach(function (r) {
      var sel = r.getAttribute("data-id") === state.selectedId;
      r.classList.toggle("is-selected", sel);
      r.tabIndex = sel ? 0 : -1;
      if (sel) { r.setAttribute("aria-current", "true"); found = true; }
      else r.removeAttribute("aria-current");
    });
    if (!found) { rows[0].tabIndex = 0; }
  }

  function byId(id) {
    for (var i = 0; i < state.incidents.length; i++) if (state.incidents[i].id === id) return state.incidents[i];
    return null;
  }

  function renderDetail() {
    var host = $("detail-inner");
    var inc = state.selectedId ? byId(state.selectedId) : null;

    if (!inc) {
      host.innerHTML = '<div class="detail__empty">' +
        '<h3 id="detail-h" class="sr-only">Incident details</h3>' +
        '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false" style="color:var(--text-4)"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
        '<p>Select an incident to view details</p></div>';
      return;
    }

    var isAck = inc.status === "acknowledged";
    var isRes = inc.status === "resolved";
    var primaryLabel = isRes ? "Resolved" : (isAck ? "Resolve incident" : "Acknowledge");
    var primaryDisabled = isRes ? "disabled" : "";

    var timeline = inc.timeline.map(function (t, i) {
      var last = i === inc.timeline.length - 1;
      return '<li class="' + (last ? "tl--now" : "") + '"><div class="tl__t">' + esc(t.t) + '</div><div class="tl__m">' + esc(t.m) + '</div></li>';
    }).join("");

    host.innerHTML = '' +
      '<div class="detail__head">' +
        '<div class="detail__eyebrow">' +
          '<span class="sev sev--' + inc.severity + '"><span class="sev__dot" aria-hidden="true"></span>' + SEVERITY[inc.severity].label + '</span>' +
          '<span class="badge badge--' + inc.status + '">' + STATUS_LABEL[inc.status] + '</span>' +
        '</div>' +
        '<h3 class="detail__title" id="detail-h">' + esc(inc.title) + '</h3>' +
        '<div class="detail__id">' + esc(inc.id) + ' · opened ' + esc(inc.age) + ' ago</div>' +
      '</div>' +
      '<div class="detail__body">' +
        '<dl class="dl">' +
          '<dt>Service</dt><dd class="detail__value">' + esc(inc.service) + '</dd>' +
          '<dt>Owner</dt><dd>' + (inc.owner === "Unassigned" ? '<span class="own--none">Unassigned</span>' : esc(inc.owner)) + '</dd>' +
          '<dt>Region</dt><dd class="detail__value">' + esc(inc.region) + '</dd>' +
          '<dt>Age</dt><dd class="detail__value">' + esc(inc.age) + '</dd>' +
          '<dt>Impact</dt><dd>' + esc(inc.impact) + '</dd>' +
        '</dl>' +
        '<div class="tl__h">Activity</div>' +
        '<ul class="tl">' + timeline + '</ul>' +
      '</div>' +
      '<div class="detail__actions">' +
        '<button class="btn btn--primary btn--block" type="button" id="ack" ' + primaryDisabled + '>' +
          (isRes ? checkIcon() : ackIcon()) + '<span>' + primaryLabel + '</span>' +
        '</button>' +
        '<p class="detail__hint">' + detailHint(inc) + '</p>' +
      '</div>';

    var btn = $("ack");
    if (btn && !isRes) btn.addEventListener("click", function () { advance(inc); });
  }

  function detailHint(inc) {
    if (inc.status === "resolved") return "Closed " + (inc.resolvedAt || "") + " · no further action";
    if (inc.status === "acknowledged") return "Acknowledged " + (inc.acknowledgedAt || "") + " · ready to resolve";
    return "Acknowledging notifies the on-call channel";
  }
  function ackIcon() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 12.5 9 17.5 20 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function checkIcon() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12.5l2.5 2.5L16 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function nowUTC() {
    var d = new Date();
    return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") + " UTC";
  }

  function advance(inc) {
    if (inc.status === "resolved") return;
    if (inc.status === "acknowledged") {
      inc.status = "resolved";
      inc.resolvedAt = nowUTC();
      inc.timeline.push({ t: "Incident resolved", m: "you · " + inc.resolvedAt, now: true });
      announce(inc.id + " resolved");
    } else {
      inc.status = "acknowledged";
      inc.acknowledgedAt = nowUTC();
      inc.timeline.push({ t: "Acknowledged by you", m: "you · " + inc.acknowledgedAt, now: true });
      announce(inc.id + " acknowledged");
    }
    inc.timeline.forEach(function (t, i, arr) { t.now = i === arr.length - 1; });

    renderTable();
    var inner = $("detail-inner");
    inner.classList.remove("ackflash");
    void inner.offsetWidth;
    inner.classList.add("ackflash");
  }

  function renderGlobalStatus() {
    var active = state.incidents.filter(function (i) { return i.status !== "resolved"; });
    var crit = active.filter(function (i) { return i.severity === "critical"; }).length;
    var high = active.filter(function (i) { return i.severity === "high"; }).length;
    var dot = $("global-status-dot");
    var txt = $("global-status-text");
    dot.className = "pulse";
    if (crit > 0) {
      dot.classList.add("pulse--crit");
      txt.textContent = "Degraded · " + crit + " critical · " + active.length + " active";
    } else if (high > 0) {
      dot.classList.add("pulse--high");
      txt.textContent = "Attention · " + high + " high · " + active.length + " active";
    } else if (active.length > 0) {
      dot.classList.add("pulse--high");
      txt.textContent = "Monitoring · " + active.length + " active";
    } else {
      dot.classList.add("pulse--ok");
      txt.textContent = "All systems nominal";
    }
  }

  function select(id, focusRow) {
    state.selectedId = id;
    syncRoving();
    renderDetail();
    var inc = byId(id);
    if (inc) announce("Selected " + inc.id + ", " + SEVERITY[inc.severity].label + ", " + STATUS_LABEL[inc.status]);
    if (focusRow) {
      var row = $("rows").querySelector('tr[data-id="' + id + '"]');
      if (row) row.focus();
    }
  }

  function wireTable() {
    var tbody = $("rows");
    tbody.addEventListener("click", function (e) {
      var tr = e.target.closest("tr");
      if (tr && tr.dataset.id) select(tr.dataset.id, false);
    });
    tbody.addEventListener("keydown", function (e) {
      var tr = e.target.closest("tr");
      if (!tr) return;
      var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
      var idx = rows.indexOf(tr);
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault(); select(tr.dataset.id, true);
      } else if (e.key === "ArrowDown") {
        e.preventDefault(); var n = rows[idx + 1]; if (n) select(n.dataset.id, true);
      } else if (e.key === "ArrowUp") {
        e.preventDefault(); var p = rows[idx - 1]; if (p) select(p.dataset.id, true);
      } else if (e.key === "Home") {
        e.preventDefault(); if (rows[0]) select(rows[0].dataset.id, true);
      } else if (e.key === "End") {
        e.preventDefault(); var l = rows[rows.length - 1]; if (l) select(l.dataset.id, true);
      }
    });
  }

  function wireFilters() {
    var q = $("q"), sev = $("f-sev"), status = $("f-status");
    q.addEventListener("input", function () { state.q = q.value.trim(); renderTable(); });
    sev.addEventListener("change", function () { state.sev = sev.value; renderTable(); });
    status.addEventListener("change", function () { state.status = status.value; renderTable(); });

    function clearAll() {
      state.q = ""; state.sev = "all"; state.status = "all";
      q.value = ""; sev.value = "all"; status.value = "all";
      renderTable();
      announce("Filters cleared");
      q.focus();
    }
    $("clear").addEventListener("click", clearAll);
    $("empty-clear").addEventListener("click", clearAll);

    document.querySelectorAll(".th-sort").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.dataset.sort;
        if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        else state.sort = { key: key, dir: key === "age" ? "asc" : "desc" };
        updateSortHeaders();
        renderTable();
      });
    });
  }

  function updateSortHeaders() {
    document.querySelectorAll(".itable thead th").forEach(function (th) {
      var btn = th.querySelector(".th-sort");
      if (!btn) return;
      if (btn.dataset.sort === state.sort.key) th.setAttribute("aria-sort", state.sort.dir === "asc" ? "ascending" : "descending");
      else th.setAttribute("aria-sort", "none");
    });
  }

  function wireNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".rail__link"));
    links.forEach(function (a) {
      a.addEventListener("click", function () {
        links.forEach(function (l) { l.classList.remove("is-active"); l.removeAttribute("aria-current"); });
        a.classList.add("is-active"); a.setAttribute("aria-current", "page");
      });
    });

    var sections = ["overview", "throughput", "incidents"].map(function (id) { return document.getElementById(id); });
    if ("IntersectionObserver" in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var id = en.target.id;
            links.forEach(function (l) {
              var on = l.dataset.nav === id;
              l.classList.toggle("is-active", on);
              if (on) l.setAttribute("aria-current", "page"); else l.removeAttribute("aria-current");
            });
          }
        });
      }, { rootMargin: "-72px 0px -60% 0px", threshold: 0 });
      sections.forEach(function (s) { if (s) obs.observe(s); });
    }
  }

  function startClock() {
    var el = $("clock");
    function tick() {
      var d = new Date();
      var t = String(d.getUTCHours()).padStart(2, "0") + ":" +
              String(d.getUTCMinutes()).padStart(2, "0") + ":" +
              String(d.getUTCSeconds()).padStart(2, "0");
      el.textContent = t;
      el.setAttribute("datetime", d.toISOString());
    }
    tick();
    window.setInterval(tick, 1000);
  }

  function init() {
    renderMetrics();
    renderChart();
    wireTable();
    wireFilters();
    wireNav();
    startClock();
    state.selectedId = visible().length ? visible()[0].id : null;
    updateSortHeaders();
    renderTable();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
