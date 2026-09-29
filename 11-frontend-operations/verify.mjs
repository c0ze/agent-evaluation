// Offline behavior checks. This minimal DOM adapter does not test browser layout.
// Run with: node verify.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInContext, createContext } from "node:vm";

const source = readFileSync(new URL("app.js", import.meta.url), "utf8");
const seed = JSON.parse(readFileSync(new URL("DATA.json", import.meta.url), "utf8"));
const html = readFileSync(new URL("index.html", import.meta.url), "utf8");
let passed = 0;

function check(name, callback) {
  callback();
  passed += 1;
  console.log(`PASS ${name}`);
}

function launch({ stored = "{}", storageFails = false, compact = false } = {}) {
  const elements = new Map();
  const listeners = new Map();
  let activeElement = null;
  let rows = [];
  class Element {
    constructor(selector) {
      this.selector = selector;
      this.value = selector.includes("-filter") ? "all" : "";
      this.textContent = "";
      this.attributes = {};
      this.listeners = new Map();
      this.clientWidth = compact ? 328 : 1000;
      this.clientHeight = compact ? 155 : 173;
      this.classList = { toggle: (name, on) => { this.attributes[name] = on; } };
    }
    set innerHTML(value) {
      this.markup = value;
      if (this.selector === "#incident-rows") {
        rows = [...value.matchAll(/<tr[^>]+data-incident-id="([^"]+)"/g)].map((match) => {
          const row = new Element("row");
          row.dataset = { incidentId: match[1] };
          row.button = new Element("button");
          return row;
        });
      }
    }
    get innerHTML() { return this.markup || ""; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    emit(name, event = {}) { return this.listeners.get(name)?.(event); }
    focus() { activeElement = this; }
    scrollIntoView() { this.scrolled = true; }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
    removeAttribute(key) { delete this.attributes[key]; }
    querySelector() { return this.button; }
    closest(selector) {
      if (selector === "[data-incident-id]" && this.dataset) return this;
      if (selector === "#acknowledge-incident" && this.selector === selector) return this;
      if (selector.startsWith("input,") && this.selector === "#incident-search") return this;
      return null;
    }
    reset() {
      get("#incident-search").value = "";
      get("#severity-filter").value = "all";
      get("#status-filter").value = "all";
    }
  }
  function get(selector) {
    if (!elements.has(selector)) elements.set(selector, new Element(selector));
    return elements.get(selector);
  }
  const nav = ["#overview", "#throughput", "#incidents"].map((href) => {
    const element = new Element("nav");
    element.attributes.href = href;
    return element;
  });
  const document = {
    querySelector: get,
    querySelectorAll: (selector) => selector === ".nav-link" ? nav : rows,
    addEventListener: (name, callback) => listeners.set(name, callback)
  };
  const context = createContext({
    document, Element, location: { hash: "" },
    window: { matchMedia: () => ({ matches: compact }), addEventListener: (name, callback) => listeners.set(name, callback) },
    localStorage: {
      getItem() { if (storageFails) throw new Error("Storage denied"); return stored; },
      setItem(key, value) { if (storageFails) throw new Error("Storage denied"); stored = value; }
    },
    setTimeout: () => 1, clearTimeout() {},
    ResizeObserver: class { observe() {} }
  });
  runInContext(source, context);
  const evaluate = (code) => runInContext(code, context);
  return {
    get, evaluate, nav,
    rows: () => rows,
    active: () => activeElement,
    saved: () => stored,
    set(selector, value, event = "change") { get(selector).value = value; get(selector).emit(event); },
    ids: () => JSON.parse(evaluate("JSON.stringify(filteredIncidents().map(i => i.id))")),
    click(selector) { get(selector).emit("click"); },
    select(id) { get("#incident-rows").emit("click", { target: rows.find((row) => row.dataset.incidentId === id) }); },
    acknowledge() { get("#detail-content").emit("click", { target: get("#acknowledge-incident") }); },
    key(key, target = new Element("body")) {
      let prevented = false;
      listeners.get("keydown")({ key, target, preventDefault: () => { prevented = true; } });
      return prevented;
    }
  };
}

let app = launch();
check("embedded snapshot exactly matches DATA.json", () => {
  assert.deepEqual(JSON.parse(app.evaluate("JSON.stringify(SEED)")), seed);
});
check("initial queue, selected detail, and four metric values", () => {
  assert.equal(app.rows().length, 4);
  assert.match(app.get("#detail-content").innerHTML, /Card authorization timeouts/);
  assert.match(app.get("#result-count").textContent, /4 of 4/);
  for (const metric of seed.metrics) assert.ok(app.get("#metrics").innerHTML.includes(metric.value.split(" ")[0]));
});
check("severity filters include each seeded severity", () => {
  for (const incident of seed.incidents) {
    app.set("#severity-filter", incident.severity);
    assert.deepEqual(app.ids(), [incident.id]);
  }
  app.click("#clear-filters");
});
check("search matches ID, title, service, owner, and case-insensitive input", () => {
  for (const query of ["2841", "AUTHORIZATION", "payments-api", "chen"]) {
    app.set("#incident-search", query, "input");
    assert.deepEqual(app.ids(), ["INC-2841"]);
  }
  app.click("#clear-filters");
});
check("combined filters produce a useful empty state and clear stale detail", () => {
  app.set("#status-filter", "open");
  app.set("#severity-filter", "critical");
  assert.deepEqual(app.ids(), []);
  assert.equal(app.get("#empty-state").hidden, false);
  assert.equal(app.get(".incident-table").hidden, true);
  assert.match(app.get("#detail-content").innerHTML, /No incident selected/);
  app.click("#clear-empty-filters");
  assert.equal(app.ids().length, 4);
  assert.equal(app.active(), app.get("#incident-search"));
});
check("malicious search text stays data and safely yields no results", () => {
  app.set("#incident-search", '<img src=x onerror="alert(1)">', "input");
  assert.deepEqual(app.ids(), []);
  assert.doesNotMatch(app.get("#detail-content").innerHTML, /onerror/);
  app.click("#clear-filters");
});
check("selection updates detail and pressed state", () => {
  app.select("INC-2839");
  assert.match(app.get("#detail-content").innerHTML, /EU retry queue growth/);
  const selected = app.rows().filter((row) => row.button.attributes["aria-pressed"] === "true");
  assert.equal(selected.length, 1);
  assert.equal(selected[0].dataset.incidentId, "INC-2839");
});
check("acknowledge updates status, count, owner, and local activity", () => {
  app.acknowledge();
  assert.match(app.get("#detail-content").innerHTML, /Acknowledged locally/);
  assert.match(app.get("#detail-content").innerHTML, /Unassigned/);
  assert.match(app.get("#unacknowledged-count").textContent, /^3 /);
  assert.equal(JSON.parse(app.evaluate("JSON.stringify(incidents())")).find((item) => item.id === "INC-2839").status, "acknowledged");
  assert.match(app.get("#detail-content").innerHTML, /id="acknowledge-incident" disabled/);
});
check("acknowledgement is idempotent", () => {
  const before = app.saved();
  app.acknowledge();
  assert.equal(app.saved(), before);
});
check("acknowledgement persists across application reload", () => {
  app = launch({ stored: app.saved() });
  app.set("#status-filter", "acknowledged");
  assert.deepEqual(app.ids(), ["INC-2839"]);
});
check("acknowledging inside a status filter removes the row and selects the next match", () => {
  app.click("#reset-demo");
  app.set("#status-filter", "open");
  assert.deepEqual(app.ids(), ["INC-2839", "INC-2832"]);
  app.acknowledge();
  assert.deepEqual(app.ids(), ["INC-2832"]);
  assert.match(app.get("#detail-content").innerHTML, /Elevated partner delivery lag/);
  app.acknowledge();
  assert.deepEqual(app.ids(), []);
  assert.match(app.get("#detail-content").innerHTML, /No incident selected/);
});
check("all-acknowledged queue stays active and reports no remaining acknowledgements", () => {
  app.click("#clear-filters");
  for (const incident of seed.incidents) {
    app.select(incident.id);
    app.acknowledge();
  }
  assert.equal(app.ids().length, 4);
  assert.equal(app.get("#unacknowledged-count").textContent, "All acknowledged");
});
check("reset restores original statuses and clears stored acknowledgements", () => {
  app.click("#reset-demo");
  assert.deepEqual(JSON.parse(app.saved()), {});
  assert.match(app.get("#unacknowledged-count").textContent, /^4 /);
  assert.equal(app.evaluate("incidents()[0].status"), "investigating");
});
check("corrupt, unexpected, and invalid stored values recover safely", () => {
  for (const stored of ["invalid json", "null", "[]", '{"INC-2841":"bad date"}', '{"UNKNOWN":"2026-01-01"}']) {
    const recovered = launch({ stored });
    assert.equal(recovered.evaluate("incidents()[0].status"), "investigating");
  }
});
check("unavailable storage preserves session action and reports the limitation", () => {
  const blocked = launch({ storageFails: true });
  blocked.acknowledge();
  assert.equal(blocked.evaluate("incidents()[0].status"), "acknowledged");
  assert.match(blocked.get("#announcement").textContent, /session only/);
  assert.match(blocked.get("#detail-content").innerHTML, /session only/);
});
check("slash focuses search without hijacking text input; Escape clears filters", () => {
  assert.equal(app.key("/"), true);
  assert.equal(app.active(), app.get("#incident-search"));
  assert.equal(app.key("/", app.get("#incident-search")), false);
  app.set("#incident-search", "payments", "input");
  app.key("Escape", app.get("#incident-search"));
  assert.equal(app.ids().length, 4);
});
check("compact selection focuses and scrolls to detail", () => {
  const mobile = launch({ compact: true });
  mobile.select("INC-2837");
  assert.equal(mobile.active(), mobile.get("#incident-detail"));
  assert.equal(mobile.get("#incident-detail").scrolled, true);
  assert.match(mobile.get("#detail-content").innerHTML, /Index freshness outside SLO/);
});
check("all 24 chart samples, accessible values, and peak are correct at both chart widths", () => {
  for (const compact of [false, true]) {
    const chartApp = launch({ compact });
    const chart = chartApp.get("#throughput-chart").innerHTML;
    assert.equal((chart.match(/<rect /g) || []).length, 24);
    assert.equal(chartApp.get("#peak-value").textContent, 88);
    assert.equal(chartApp.get("#peak-hour").textContent, "19");
    for (const [hour, value] of seed.throughput.entries()) {
      assert.ok(chart.includes(`Sample hour ${String(hour).padStart(2, "0")}: ${value}`));
    }
    for (const match of chart.matchAll(/<rect[^>]+x="([\d.]+)"[^>]+width="([\d.]+)"/g)) {
      assert.ok(Number(match[1]) + Number(match[2]) <= chartApp.get("#throughput-chart").clientWidth);
    }
    assert.equal((chartApp.get("#hourly-values").innerHTML.match(/class="hourly-sample"/g) || []).length, 24);
  }
});
check("document IDs are unique, controls have labels, and all assets are local", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const control of ["incident-search", "severity-filter", "status-filter"]) assert.ok(html.includes(`for="${control}"`));
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    assert.ok(!/^https?:\/\//.test(match[1]));
  }
  assert.ok(html.includes("connect-src 'none'"));
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
});

console.log(`\n${passed} offline checks passed. Browser rendering and assistive-technology checks are not simulated.`);
