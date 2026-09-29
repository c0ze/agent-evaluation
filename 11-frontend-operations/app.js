/* Relay — operations control room
 * Plain JavaScript, no dependencies, no network requests.
 *
 * SEED mirrors DATA.json verbatim. It is embedded (rather than fetched) so the
 * page works when opened straight from disk (file://), where fetch() of a
 * sibling file is blocked, and so the page makes no requests at all.
 */
(function () {
  "use strict";

  var SEED = {
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

  /* ---------------------------------------------------------------- config */

  var OPERATOR = "You";
  var SEVERITIES = ["critical", "high", "medium", "low"];
  var SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
  var STATUSES = ["open", "acknowledged", "investigating", "monitoring"];
  var STATUS_LABEL = {
    open: "Open — needs ack",
    acknowledged: "Acknowledged",
    investigating: "Investigating",
    monitoring: "Monitoring"
  };
  // Which direction is favourable for each metric (drives trend colour + wording).
  var METRIC_GOOD_WHEN = {
    // "Events / min" is volume, not quality: shown without a verdict.
    "P95 latency": "down",
    "Error rate": "down",
    "Queue depth": "down"
  };
  var CAPACITY_THRESHOLD = 85; // % of provisioned capacity that triggers scale-out

  // Distinct glyph per severity so state never relies on colour alone.
  var SEV_GLYPH = {
    critical: '<svg class="sev-glyph" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M5 0.5 9.5 9.5H0.5z"/></svg>',
    high: '<svg class="sev-glyph" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M5 0.5 9.5 5 5 9.5 0.5 5z"/></svg>',
    medium: '<svg class="sev-glyph" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><rect x="1" y="1" width="8" height="8" rx="1"/></svg>',
    low: '<svg class="sev-glyph" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><circle cx="5" cy="5" r="4"/></svg>'
  };

  /* ------------------------------------------------------------- utilities */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(d) { return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()); }

  function parseAge(str) {
    var h = /(\d+)\s*h/.exec(str), m = /(\d+)\s*m/.exec(str);
    return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0);
  }
  function formatAge(min) {
    min = Math.max(0, Math.floor(min));
    if (min < 60) return min + "m";
    return Math.floor(min / 60) + "h " + pad(min % 60) + "m";
  }
  function spokenAge(min) {
    min = Math.max(0, Math.floor(min));
    var h = Math.floor(min / 60), m = min % 60, out = [];
    if (h) out.push(h + (h === 1 ? " hour" : " hours"));
    if (m || !h) out.push(m + (m === 1 ? " minute" : " minutes"));
    return out.join(" ");
  }

  var announcer = $("#announcer");
  function announce(msg) {
    // Clear first so repeated identical messages are still read out.
    announcer.textContent = "";
    window.setTimeout(function () { announcer.textContent = msg; }, 40);
  }

  var narrowMq = window.matchMedia("(max-width: 1180px)");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ----------------------------------------------------------------- state */

  var loadedAt = Date.now();

  var incidents = SEED.incidents.map(function (s) {
    var ageMin = parseAge(s.age);
    var opened = new Date(loadedAt - ageMin * 60000);
    var inc = {
      id: s.id,
      severity: s.severity,
      service: s.service,
      owner: s.owner,
      status: s.status,
      title: s.title,
      openedAt: opened,
      ack: null,
      timeline: [{ at: opened, text: "Opened on " + s.service }]
    };
    if (s.owner && s.owner !== "Unassigned") {
      inc.timeline.push({ at: null, text: "Owned by " + s.owner });
    }
    if (s.status !== "open") {
      inc.timeline.push({ at: null, text: "Status set to " + s.status });
    }
    return inc;
  });

  var state = {
    query: "",
    severities: SEVERITIES.slice(),
    status: "all",
    sort: { key: "severity", dir: "desc" },
    selectedId: null
  };

  function ageOf(inc) { return (Date.now() - inc.openedAt.getTime()) / 60000; }
  function needsAck(inc) { return inc.status === "open"; }
  function byId(id) {
    for (var i = 0; i < incidents.length; i++) if (incidents[i].id === id) return incidents[i];
    return null;
  }

  function filtersActive() {
    return state.query.trim() !== "" || state.severities.length !== SEVERITIES.length || state.status !== "all";
  }

  function visibleIncidents() {
    var q = state.query.trim().toLowerCase();
    var list = incidents.filter(function (inc) {
      if (state.severities.indexOf(inc.severity) === -1) return false;
      if (state.status !== "all" && inc.status !== state.status) return false;
      if (q) {
        var hay = [inc.id, inc.title, inc.service, inc.owner, inc.status, inc.severity].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    var dir = state.sort.dir === "asc" ? 1 : -1;
    list.sort(function (a, b) {
      var d;
      if (state.sort.key === "age") d = ageOf(a) - ageOf(b);
      else d = SEV_RANK[a.severity] - SEV_RANK[b.severity] || ageOf(a) - ageOf(b);
      return d * dir;
    });
    return list;
  }

  /* ------------------------------------------------------------ status bar */

  function renderStatusBar() {
    var active = incidents;
    var crit = active.filter(function (i) { return i.severity === "critical"; }).length;
    var high = active.filter(function (i) { return i.severity === "high"; }).length;
    var unacked = active.filter(needsAck).length;

    var level = crit ? "critical" : high ? "high" : "ok";
    var headline = crit ? "Degraded" : high ? "At risk" : "Nominal";
    var parts = [];
    if (crit) parts.push(crit + " critical");
    parts.push(active.length + " active");
    parts.push(unacked ? unacked + " awaiting ack" : "all acknowledged");

    $("#system-state").innerHTML =
      '<span class="state-dot" data-level="' + level + '" aria-hidden="true"></span>' +
      '<span class="state-text">' + headline + ' <span>· ' + esc(parts.join(" · ")) + "</span></span>";

    var badge = $("#rail-open-count");
    badge.textContent = unacked ? String(unacked) : "";
    badge.setAttribute("aria-label", unacked + " awaiting acknowledgement");
  }

  function tickClock() {
    var d = new Date();
    var el = $("#utc-clock");
    el.textContent = pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds());
    el.setAttribute("datetime", d.toISOString());
    var mins = Math.floor((Date.now() - loadedAt) / 60000);
    $("#refreshed").textContent = mins < 1 ? "just now" : mins + "m ago";
  }

  /* --------------------------------------------------------------- metrics */

  function renderMetrics() {
    $("#metric-list").innerHTML = SEED.metrics.map(function (m) {
      var match = /^([\d.,]+)\s*(.*)$/.exec(m.value);
      var num = match ? match[1] : m.value;
      var unit = match ? match[2] : "";
      var good = METRIC_GOOD_WHEN[m.label];
      var tone = !good ? "neutral" : good === m.direction ? "good" : "bad";
      var arrow = m.direction === "up" ? "▲" : "▼";
      var verdict = tone === "good" ? "favourable" : tone === "bad" ? "unfavourable" : "";
      var spokenChange = m.change.replace(/^[+\u2212-]\s*/, "").replace("pp", "percentage points");
      return (
        '<li class="metric">' +
          '<span class="metric-label">' + esc(m.label) + "</span>" +
          '<span class="metric-value">' + esc(num) +
            (unit ? '<span class="metric-unit">' + esc(unit) + "</span>" : "") +
          "</span>" +
          '<span class="metric-trend">' +
            '<span class="trend-delta" data-tone="' + tone + '">' +
              '<span class="trend-arrow" aria-hidden="true">' + arrow + "</span>" +
              '<span aria-hidden="true">' + esc(m.change) + "</span>" +
              '<span class="visually-hidden">' + (m.direction === "up" ? "up " : "down ") + esc(spokenChange) +
                (verdict ? ", " + verdict : "") + "</span>" +
            "</span>" +
            '<span class="trend-ctx">vs prior 24 h' + (tone === "bad" ? " · worse" : tone === "good" ? " · better" : "") + "</span>" +
          "</span>" +
        "</li>"
      );
    }).join("");
  }

  /* ------------------------------------------------------------ throughput */

  var chart = {
    el: $("#chart"),
    active: null,
    data: SEED.throughput,
    startHour: 0
  };

  function hourLabel(i) { return pad((chart.startHour + i) % 24) + ":00"; }
  function hourRange(i) { return hourLabel(i) + "–" + pad((chart.startHour + i + 1) % 24) + ":00"; }

  function computeStartHour() {
    var h = new Date().getUTCHours();
    chart.startHour = (h - (chart.data.length - 1) + 24 * 2) % 24;
  }

  function throughputStats() {
    var d = chart.data, max = 0, min = 0, sum = 0;
    for (var i = 0; i < d.length; i++) {
      if (d[i] > d[max]) max = i;
      if (d[i] < d[min]) min = i;
      sum += d[i];
    }
    var over = d.filter(function (v) { return v >= CAPACITY_THRESHOLD; }).length;
    return { max: max, min: min, avg: Math.round(sum / d.length), over: over };
  }

  function renderThroughputText() {
    var s = throughputStats(), d = chart.data;
    $("#throughput-summary").textContent =
      "Peak " + d[s.max] + "% at " + hourLabel(s.max) +
      " · low " + d[s.min] + "% at " + hourLabel(s.min) +
      " · avg " + s.avg + "% of capacity";

    var head = "<thead><tr><th scope=\"row\">Hour (UTC)</th>", body = "<tbody><tr><th scope=\"row\">% capacity</th>";
    d.forEach(function (v, i) {
      head += '<th scope="col">' + hourLabel(i).slice(0, 2) + "</th>";
      body += "<td>" + v + "</td>";
    });
    var table = $("#throughput-table");
    var captionHTML = table.querySelector("caption").outerHTML;
    table.innerHTML = captionHTML + head + "</tr></thead>" + body + "</tr></tbody>";
  }

  function renderChart() {
    var d = chart.data;
    var fig = chart.el;
    var width = Math.max(260, Math.floor(fig.clientWidth - parseFloat(getComputedStyle(fig).paddingLeft) - parseFloat(getComputedStyle(fig).paddingRight)));
    var height = window.matchMedia("(max-width: 720px)").matches ? 140 : 168;
    var m = { top: 10, right: 4, bottom: 20, left: 30 };
    var iw = width - m.left - m.right;
    var ih = height - m.top - m.bottom;
    var slot = iw / d.length;
    var gap = Math.max(1, Math.min(4, slot * 0.22));
    var bw = slot - gap;
    var y = function (v) { return m.top + ih - (v / 100) * ih; };
    var labelEvery = width < 480 ? 6 : 3;
    var s = throughputStats();

    var svg = [];
    svg.push('<svg class="chart-svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + " " + height + '"' +
      ' role="slider" tabindex="0" aria-label="Hourly throughput, last 24 hours. Use left and right arrow keys to inspect each hour."' +
      ' aria-valuemin="0" aria-valuemax="' + (d.length - 1) + '" aria-describedby="throughput-summary">');

    // grid + y labels
    svg.push('<g class="chart-grid" aria-hidden="true">');
    [0, 25, 50, 75, 100].forEach(function (t) {
      var yy = Math.round(y(t)) + 0.5;
      svg.push('<line x1="' + m.left + '" x2="' + (width - m.right) + '" y1="' + yy + '" y2="' + yy + '"/>');
      svg.push('<text x="' + (m.left - 6) + '" y="' + (yy + 3.5) + '" text-anchor="end">' + t + (t === 100 ? "%" : "") + "</text>");
    });
    svg.push("</g>");

    // cursor (active column background)
    svg.push('<rect class="chart-cursor" id="chart-cursor" x="0" y="' + m.top + '" width="' + slot + '" height="' + ih + '" visibility="hidden" aria-hidden="true"/>');

    // bars
    svg.push('<g aria-hidden="true">');
    d.forEach(function (v, i) {
      var x = m.left + i * slot + gap / 2;
      var cls = "chart-bar" + (v >= CAPACITY_THRESHOLD ? " is-over" : "") + (i === d.length - 1 ? " is-now" : "");
      svg.push('<rect class="' + cls + '" data-i="' + i + '" x="' + x.toFixed(2) + '" y="' + y(v).toFixed(2) +
        '" width="' + bw.toFixed(2) + '" height="' + (ih - (y(v) - m.top)).toFixed(2) + '" rx="1"/>');
    });
    svg.push("</g>");

    // threshold line
    var ty = Math.round(y(CAPACITY_THRESHOLD)) + 0.5;
    svg.push('<g aria-hidden="true"><line class="chart-threshold" x1="' + m.left + '" x2="' + (width - m.right) + '" y1="' + ty + '" y2="' + ty + '"/>' +
      '<text class="chart-threshold-label" x="' + (m.left + 4) + '" y="' + (ty - 4) + '">' + CAPACITY_THRESHOLD + "% scale-out</text></g>");

    // x labels
    svg.push('<g class="chart-x" aria-hidden="true">');
    d.forEach(function (v, i) {
      var isLast = i === d.length - 1;
      if (i % labelEvery !== 0 && !isLast) return;
      if (!isLast && d.length - 1 - i < labelEvery / 2) return; // avoid colliding with "Now"
      var x = m.left + i * slot + slot / 2;
      svg.push('<text x="' + x.toFixed(1) + '" y="' + (height - 5) + '" text-anchor="middle">' + (isLast ? "Now" : hourLabel(i).slice(0, 2)) + "</text>");
    });
    svg.push("</g></svg>");

    fig.innerHTML =
      svg.join("") +
      '<figcaption class="chart-foot">' +
        '<span class="chart-readout" id="chart-readout"></span>' +
        '<span class="chart-legend" aria-hidden="true">' +
          '<span><i class="swatch"></i>% of provisioned capacity</span>' +
          '<span><i class="swatch swatch-over"></i>At or above threshold (' + s.over + " h)</span>" +
        "</span>" +
      "</figcaption>";

    chart.geom = { m: m, slot: slot, width: width };
    bindChart();
    setChartActive(chart.active);
  }

  // The slider role announces aria-valuetext changes itself, so no extra
  // live-region message is needed while scrubbing.
  function setChartActive(i) {
    var d = chart.data;
    chart.active = i;
    var shown = i == null ? d.length - 1 : i;
    var svg = $(".chart-svg", chart.el);
    var cursor = $("#chart-cursor", chart.el);
    $$(".chart-bar", chart.el).forEach(function (b) {
      b.classList.toggle("is-active", +b.getAttribute("data-i") === i);
    });
    if (i == null) {
      cursor.setAttribute("visibility", "hidden");
    } else {
      cursor.setAttribute("x", (chart.geom.m.left + i * chart.geom.slot).toFixed(2));
      cursor.setAttribute("width", chart.geom.slot.toFixed(2));
      cursor.setAttribute("visibility", "visible");
    }
    var v = d[shown];
    var isNow = shown === d.length - 1;
    var note = v >= CAPACITY_THRESHOLD ? " · above scale-out threshold" : "";
    $("#chart-readout", chart.el).innerHTML =
      "<strong>" + (isNow ? "Current hour, since " + hourLabel(shown) : hourRange(shown)) + " UTC</strong> · " + v + "% capacity" + esc(note);
    var valueText = (isNow ? "Current hour, since " + hourLabel(shown) : hourRange(shown)) + " UTC, " + v + " percent of capacity" + note.replace(" · ", ", ");
    svg.setAttribute("aria-valuenow", String(shown));
    svg.setAttribute("aria-valuetext", valueText);
  }

  function bindChart() {
    var svg = $(".chart-svg", chart.el);
    function indexFromEvent(e) {
      var rect = svg.getBoundingClientRect();
      var x = e.clientX - rect.left - chart.geom.m.left;
      var i = Math.floor(x / chart.geom.slot);
      return Math.max(0, Math.min(chart.data.length - 1, i));
    }
    svg.addEventListener("pointermove", function (e) { setChartActive(indexFromEvent(e)); });
    svg.addEventListener("pointerdown", function (e) { setChartActive(indexFromEvent(e)); });
    svg.addEventListener("pointerleave", function () {
      if (document.activeElement !== svg) setChartActive(null);
    });
    svg.addEventListener("blur", function () { setChartActive(null); });
    svg.addEventListener("focus", function () {
      if (chart.active == null) setChartActive(chart.data.length - 1);
    });
    svg.addEventListener("keydown", function (e) {
      var last = chart.data.length - 1;
      var cur = chart.active == null ? last : chart.active;
      var next = null;
      switch (e.key) {
        case "ArrowLeft": case "ArrowDown": next = Math.max(0, cur - 1); break;
        case "ArrowRight": case "ArrowUp": next = Math.min(last, cur + 1); break;
        case "Home": next = 0; break;
        case "End": next = last; break;
        case "PageUp": next = Math.min(last, cur + 6); break;
        case "PageDown": next = Math.max(0, cur - 6); break;
        default: return;
      }
      e.preventDefault();
      setChartActive(next);
    });
  }

  /* --------------------------------------------------------------- filters */

  function renderFilterControls() {
    var sevCounts = {};
    SEVERITIES.forEach(function (s) { sevCounts[s] = 0; });
    incidents.forEach(function (i) { sevCounts[i.severity]++; });

    var seg = $("#f-severity");
    if (!seg.children.length) {
      seg.innerHTML = SEVERITIES.map(function (s) {
        return '<label class="seg-opt" data-sev="' + s + '">' +
          '<input type="checkbox" name="severity" value="' + s + '" checked>' +
          "<span>" + SEV_GLYPH[s] + cap(s) + ' <span class="seg-count" data-count="' + s + '"></span></span>' +
          "</label>";
      }).join("");
    }
    SEVERITIES.forEach(function (s) {
      var c = $('[data-count="' + s + '"]', seg);
      c.textContent = sevCounts[s];
      c.parentNode.parentNode.querySelector("input").setAttribute("aria-label", cap(s) + ", " + sevCounts[s] + " incidents");
    });

    var statusCounts = {};
    incidents.forEach(function (i) { statusCounts[i.status] = (statusCounts[i.status] || 0) + 1; });
    var sel = $("#f-status");
    var current = sel.value || "all";
    sel.innerHTML = '<option value="all">All statuses (' + incidents.length + ")</option>" +
      STATUSES.map(function (s) {
        return '<option value="' + s + '">' + esc(STATUS_LABEL[s]) + " (" + (statusCounts[s] || 0) + ")</option>";
      }).join("");
    sel.value = current;

    $("#f-clear").disabled = !filtersActive();
  }

  function describeFilters() {
    var bits = [];
    if (state.query) bits.push("search “" + state.query + "”");
    if (state.severities.length === 0) bits.push("no severities selected");
    else if (state.severities.length !== SEVERITIES.length) bits.push("severity " + state.severities.join(", "));
    if (state.status !== "all") bits.push("status " + STATUS_LABEL[state.status].toLowerCase());
    return bits;
  }

  /* ----------------------------------------------------------------- table */

  function sortDescription() {
    var desc = state.sort.dir === "desc";
    return state.sort.key === "age"
      ? (desc ? "oldest first" : "newest first")
      : (desc ? "most severe first" : "least severe first");
  }

  function sevChip(sev) {
    return '<span class="sev" data-sev="' + sev + '">' + SEV_GLYPH[sev] + cap(sev) + "</span>";
  }
  function statusChip(status) {
    return '<span class="status" data-status="' + status + '">' + esc(STATUS_LABEL[status] || cap(status)) + "</span>";
  }

  function renderTable(opts) {
    opts = opts || {};
    var list = visibleIncidents();
    var body = $("#inc-body");

    body.innerHTML = list.map(function (inc) {
      var sel = inc.id === state.selectedId;
      var age = ageOf(inc);
      return (
        '<tr role="row" data-id="' + inc.id + '"' + (sel ? ' class="is-selected"' : "") + ">" +
          '<td role="cell" class="col-sev">' + sevChip(inc.severity) + "</td>" +
          '<td role="cell" class="col-id">' +
            '<button type="button" class="inc-link" data-id="' + inc.id + '"' + (sel ? ' aria-current="true"' : "") +
              ' aria-label="' + esc(inc.id + ", " + inc.title + ", " + inc.severity + " severity") + '">' +
              '<span class="inc-id">' + inc.id + "</span>" +
              '<span class="inc-title">' + esc(inc.title) + "</span>" +
            "</button>" +
          "</td>" +
          '<td role="cell" class="col-svc"><span class="svc">' + esc(inc.service) + "</span></td>" +
          '<td role="cell" class="col-age num"><span class="age" data-age-for="' + inc.id + '" title="Opened ' + hhmm(inc.openedAt) + ' UTC">' +
            '<span aria-hidden="true">' + formatAge(age) + '</span><span class="visually-hidden">' + spokenAge(age) + " old</span></span></td>" +
          '<td role="cell" class="col-owner"><span class="owner' + (inc.owner === "Unassigned" ? " is-unassigned" : "") + '">' + esc(inc.owner) + "</span></td>" +
          '<td role="cell" class="col-status">' + statusChip(inc.status) + "</td>" +
        "</tr>"
      );
    }).join("");

    // Result count + empty state
    var total = incidents.length;
    $("#result-count").textContent =
      (filtersActive() ? "Showing " + list.length + " of " + total : total + " active") +
      " · " + sortDescription();

    var empty = $("#empty");
    var table = $("#inc-table");
    if (list.length === 0) {
      empty.hidden = false;
      table.querySelector("tbody").hidden = true;
      var bits = describeFilters();
      $("#empty-body").textContent = bits.length
        ? "Filtered by " + bits.join(" · ") + ". " + total + " incidents are hidden."
        : "There are no active incidents.";
    } else {
      empty.hidden = true;
      table.querySelector("tbody").hidden = false;
    }

    // Sort indicators
    $$("#inc-table th[aria-sort]").forEach(function (th) {
      var key = th.querySelector(".sort").getAttribute("data-sort");
      th.setAttribute("aria-sort", key === state.sort.key ? (state.sort.dir === "asc" ? "ascending" : "descending") : "none");
    });

    $("#f-clear").disabled = !filtersActive();

    if (opts.announce) {
      announce(list.length === 0 ? "No incidents match these filters." : list.length + " of " + total + " incidents shown.");
    }
  }

  function tickAges() {
    $$("[data-age-for]").forEach(function (el) {
      var inc = byId(el.getAttribute("data-age-for"));
      if (!inc) return;
      var a = ageOf(inc);
      el.firstChild.textContent = formatAge(a);
      el.lastChild.textContent = spokenAge(a) + " old";
    });
    var da = $("#detail-age");
    if (da) {
      var inc = byId(state.selectedId);
      if (inc) da.textContent = formatAge(ageOf(inc)) + " (opened " + hhmm(inc.openedAt) + " UTC)";
    }
  }

  /* ---------------------------------------------------------------- detail */

  function renderDetail(opts) {
    opts = opts || {};
    var panel = $("#detail");
    var inc = byId(state.selectedId);

    if (!inc) {
      panel.innerHTML =
        '<h3 id="detail-heading" class="visually-hidden">Incident detail</h3>' +
        '<div class="detail-empty"><p>No incident selected</p><p>Choose an incident from the list to see its details and actions.</p></div>';
      return;
    }

    var hiddenByFilter = visibleIncidents().indexOf(inc) === -1;
    var action;
    if (needsAck(inc)) {
      action =
        '<button type="button" class="btn btn-primary btn-block" id="ack-btn">Acknowledge ' + inc.id + "</button>" +
        '<p class="hint">' +
        (inc.owner === "Unassigned"
          ? "Assigns the incident to you and stops escalation paging."
          : "Stops escalation paging. " + esc(inc.owner) + " stays the owner.") +
        "</p>";
    } else {
      var who = inc.ack ? inc.ack.by : inc.owner;
      var when = inc.ack ? " at " + hhmm(inc.ack.at) + " UTC" : "";
      action =
        '<div class="ack-done" id="ack-done" tabindex="-1">' +
          '<svg class="ack-check" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.8 8.2 7 10.4l4.2-4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          "<div><strong>Acknowledged</strong> by " + esc(who) + esc(when) + "." +
          (inc.ack ? "" : " Paging has stopped; status is " + esc(inc.status) + ".") + "</div>" +
        "</div>" +
        (inc.ack ? '<button type="button" class="btn btn-quiet ack-undo" id="ack-undo">Undo acknowledgement</button>' : "");
    }

    var timeline = inc.timeline.map(function (t, idx) {
      var isNew = opts.flashLast && idx === inc.timeline.length - 1;
      return '<li' + (isNew ? ' class="is-new"' : "") + '><time' + (t.at ? ' datetime="' + t.at.toISOString() + '"' : "") + ">" +
        (t.at ? hhmm(t.at) : "—") + "</time><span>" + esc(t.text) + "</span></li>";
    }).join("");

    panel.innerHTML =
      '<div class="detail-head">' +
        '<div class="detail-kicker"><span class="detail-id">' + inc.id + "</span>" + sevChip(inc.severity) + "</div>" +
        '<h3 class="detail-title" id="detail-heading" tabindex="-1">' + esc(inc.title) + "</h3>" +
        (hiddenByFilter ? '<p class="detail-note">Hidden from the list by current filters.</p>' : "") +
      "</div>" +
      '<dl class="detail-fields">' +
        "<dt>Status</dt><dd>" + statusChip(inc.status) + "</dd>" +
        "<dt>Service</dt><dd><span class=\"svc\">" + esc(inc.service) + "</span></dd>" +
        "<dt>Owner</dt><dd><span class=\"owner" + (inc.owner === "Unassigned" ? " is-unassigned" : "") + "\">" + esc(inc.owner) + "</span></dd>" +
        '<dt>Age</dt><dd class="age" id="detail-age">' + formatAge(ageOf(inc)) + " (opened " + hhmm(inc.openedAt) + " UTC)</dd>" +
      "</dl>" +
      '<div class="detail-action">' + action + "</div>" +
      '<div class="detail-section"><h4>Activity</h4><ol class="timeline">' + timeline + "</ol></div>";

    var ackBtn = $("#ack-btn");
    if (ackBtn) ackBtn.addEventListener("click", function () { acknowledge(inc.id); });
    var undo = $("#ack-undo");
    if (undo) undo.addEventListener("click", function () { undoAcknowledge(inc.id); });
  }

  /* ---------------------------------------------------------- acknowledge */

  function acknowledge(id) {
    var inc = byId(id);
    if (!inc || !needsAck(inc)) return;
    var now = new Date();
    inc.ack = { by: OPERATOR, at: now, prevStatus: inc.status, prevOwner: inc.owner };
    inc.status = "acknowledged";
    var msg = "Acknowledged by " + OPERATOR;
    if (inc.owner === "Unassigned") {
      inc.owner = OPERATOR;
      msg += " (now owner)";
    }
    inc.timeline.push({ at: now, text: msg, ack: true });

    refreshAll({ flashLast: true });
    var done = $("#ack-done");
    if (done) done.focus();
    announce(inc.id + " acknowledged" + (inc.ack.prevOwner === "Unassigned" ? " and assigned to you." : "."));
  }

  function undoAcknowledge(id) {
    var inc = byId(id);
    if (!inc || !inc.ack) return;
    inc.status = inc.ack.prevStatus;
    inc.owner = inc.ack.prevOwner;
    inc.timeline = inc.timeline.filter(function (t) { return !t.ack; });
    inc.ack = null;

    refreshAll();
    var btn = $("#ack-btn");
    if (btn) btn.focus();
    announce("Acknowledgement of " + inc.id + " undone. Status is open.");
  }

  /* ------------------------------------------------------------- selection */

  function select(id, opts) {
    opts = opts || {};
    state.selectedId = id;
    $$("#inc-body tr").forEach(function (tr) {
      var on = tr.getAttribute("data-id") === id;
      tr.classList.toggle("is-selected", on);
      var b = tr.querySelector(".inc-link");
      if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    });
    renderDetail();

    // In the stacked (single-column) layout the detail panel sits below the
    // list; bring it into view and move focus there when explicitly activated.
    if (opts.reveal && narrowMq.matches) {
      var head = $("#detail-heading");
      $("#detail").scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
      if (head) head.focus({ preventScroll: true });
    }
  }

  function refreshAll(detailOpts) {
    renderStatusBar();
    renderFilterControls();
    renderTable();
    renderDetail(detailOpts);
  }

  /* ---------------------------------------------------------------- events */

  function bindEvents() {
    var q = $("#f-query");
    q.addEventListener("input", function () {
      state.query = q.value;
      renderTable({ announce: true });
      renderDetail();
    });
    q.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && q.value) {
        e.preventDefault();
        q.value = "";
        state.query = "";
        renderTable({ announce: true });
        renderDetail();
      }
    });

    $("#f-severity").addEventListener("change", function () {
      state.severities = $$('#f-severity input:checked').map(function (i) { return i.value; });
      renderTable({ announce: true });
      renderDetail();
    });

    $("#f-status").addEventListener("change", function (e) {
      state.status = e.target.value;
      renderTable({ announce: true });
      renderDetail();
    });

    $("#filters").addEventListener("submit", function (e) { e.preventDefault(); });

    function clearFilters() {
      state.query = "";
      state.severities = SEVERITIES.slice();
      state.status = "all";
      q.value = "";
      $$('#f-severity input').forEach(function (i) { i.checked = true; });
      $("#f-status").value = "all";
      renderTable({ announce: true });
      renderDetail();
      q.focus();
    }
    $("#f-clear").addEventListener("click", clearFilters);
    $("#empty-clear").addEventListener("click", clearFilters);

    // Sorting
    $$("#inc-table .sort").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-sort");
        if (state.sort.key === key) state.sort.dir = state.sort.dir === "desc" ? "asc" : "desc";
        else state.sort = { key: key, dir: "desc" };
        renderTable();
        announce("Sorted by " + key + ", " + sortDescription() + ".");
      });
    });

    // Row selection: the ID button is the accessible control; the whole row is
    // a larger pointer target that forwards to it.
    var body = $("#inc-body");
    body.addEventListener("click", function (e) {
      var tr = e.target.closest("tr[data-id]");
      if (!tr) return;
      var fromButton = !!e.target.closest(".inc-link");
      select(tr.getAttribute("data-id"), { reveal: fromButton || narrowMq.matches });
      if (!fromButton && !narrowMq.matches) tr.querySelector(".inc-link").focus();
    });
    body.addEventListener("keydown", function (e) {
      if (!e.target.classList.contains("inc-link")) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
      var links = $$("#inc-body .inc-link");
      var i = links.indexOf(e.target);
      var next = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : links.length - 1;
      if (next < 0 || next >= links.length) return;
      e.preventDefault();
      links[next].focus();
      select(links[next].getAttribute("data-id"));
    });

    // "/" jumps to search (unless the user is typing somewhere).
    document.addEventListener("keydown", function (e) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      if (t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      q.focus();
      q.select();
    });

    // Rail: move focus to the target section heading for keyboard users.
    $$(".rail a.rail-link").forEach(function (a) {
      a.addEventListener("click", function () {
        $$(".rail a.rail-link").forEach(function (o) { o.removeAttribute("aria-current"); });
        a.setAttribute("aria-current", "page");
        var target = document.querySelector(a.getAttribute("href"));
        if (target && target.tabIndex < 0 && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      });
    });

    // Redraw chart on resize.
    var rafId = 0;
    var redraw = function () {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(renderChart);
    };
    if ("ResizeObserver" in window) {
      var lastW = 0;
      new ResizeObserver(function (entries) {
        var w = Math.round(entries[0].contentRect.width);
        if (w !== lastW) { lastW = w; redraw(); }
      }).observe(chart.el);
    } else {
      window.addEventListener("resize", redraw);
    }
  }

  /* ------------------------------------------------------------------ init */

  function init() {
    // Explicit table roles keep row/cell semantics when the phone layout
    // switches table elements to display:block/flex.
    var t = $("#inc-table");
    t.setAttribute("role", "table");
    $$("thead, tbody", t).forEach(function (g) { g.setAttribute("role", "rowgroup"); });
    $$("thead tr", t).forEach(function (r) { r.setAttribute("role", "row"); });
    $$("thead th", t).forEach(function (th) { th.setAttribute("role", "columnheader"); });

    // Default selection: the most severe incident still awaiting acknowledgement,
    // so the primary action is in view on load.
    var waiting = incidents.filter(needsAck).sort(function (a, b) { return SEV_RANK[b.severity] - SEV_RANK[a.severity]; });
    state.selectedId = (waiting[0] || incidents[0] || {}).id || null;

    computeStartHour();
    renderMetrics();
    renderThroughputText();
    renderChart();
    refreshAll();
    bindEvents();
    tickClock();

    window.setInterval(tickClock, 1000);
    window.setInterval(tickAges, 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
