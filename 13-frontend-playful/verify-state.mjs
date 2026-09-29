// Offline transition and content checks; this is not a rendering or browser test.
// Run: node verify-state.mjs
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";
import vm from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(root, "app.js"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "styles.css"), "utf8");
const fixture = JSON.parse(readFileSync(join(root, "PLANTS.json"), "utf8"));

function harness({saved = null, denied = false} = {}) {
  const nodes = new Map();
  const events = new Map();
  let document;
  let now = 100000;
  let stored = saved;
  let timerId = 0;
  const timers = new Map();

  class Element {
    constructor(id = "") {
      this.id = id;
      this.hidden = false;
      this.open = false;
      this.isConnected = true;
      this.style = {};
      this.dataset = {};
      this.attributes = {};
      this.listeners = new Map();
      this.textContent = "";
      this.innerHTML = "";
      this.classList = {toggle() {}, add() {}, remove() {}};
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    focus() { document.activeElement = this; }
    querySelector(selector) {
      const element = new Element();
      element.parent = this;
      element.dataset.action = selector.match(/data-action="([^"]+)"/)?.[1];
      element.dataset.plant = selector.match(/data-plant="([^"]+)"/)?.[1];
      return element;
    }
    append(element) { element.parent = this; }
    contains(element) { return element === this || element?.parent === this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.listeners.get("close")?.(); }
  }

  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(id, new Element(id));
  nodes.set("allDoneHeading", new Element("allDoneHeading"));
  nodes.set("completedList", new Element("completedList"));
  const brand = new Element("brand");
  const nav = ["today", "plants"].map(view => { const node = new Element(); node.dataset.view = view; return node; });
  document = {
    activeElement: new Element(), hidden: false,
    body: new Element("body"),
    querySelector(selector) {
      if (selector === ".brand") return brand;
      if (selector.startsWith("#")) return nodes.get(selector.slice(1));
      throw new Error(`Unexpected query: ${selector}`);
    },
    querySelectorAll(selector) { assert.equal(selector, ".nav-button"); return nav; },
    addEventListener(name, listener) { events.set(name, listener); }
  };
  document.body.append(nodes.get("toast"));
  const context = vm.createContext({
    document, location: {hash: ""}, history: {replaceState() {}}, window: {scrollTo() {}},
    localStorage: {
      getItem() { if (denied) throw new Error("Storage unavailable"); return stored; },
      setItem(key, value) { if (denied) throw new Error("Storage unavailable"); stored = value; }
    },
    structuredClone,
    Date: class extends Date { static now() { return now; } },
    setTimeout(callback, ms = 0) { const id = ++timerId; timers.set(id, {callback, at: now + ms}); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(source, context, {filename: "app.js"});
  return {
    run(expression) { return vm.runInContext(expression, context); },
    json(expression) { return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context)); },
    node(id) { return nodes.get(id); },
    saved() { return stored; },
    advance(ms) {
      const until = now + ms;
      while (true) {
        const next = [...timers.entries()].filter(([, task]) => task.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
      }
      now = until;
    },
    act(id, action) { vm.runInContext(`mutatePlant(plants.find(plant => plant.id === '${id}'), '${action}')`, context); }
  };
}

const app = harness();
assert.deepEqual(app.json("DATA"), fixture, "All data remains faithful to PLANTS.json");
assert.deepEqual(app.json("pendingToday().map(plant => plant.id)"), ["fern", "pothos", "cactus"]);
assert.ok(app.node("todayQueue").innerHTML.indexOf('task-fern') < app.node("todayQueue").innerHTML.indexOf('task-pothos'));
assert.match(app.node("upcomingQueue").innerHTML, /Drama/);
assert.equal((app.node("weekChart").innerHTML.match(/class="week-day /g) || []).length, 7);

for (const plant of fixture.plants) {
  app.run(`renderDetail(plants.find(plant => plant.id === '${plant.id}'))`);
  const detail = app.node("dialogContent").innerHTML;
  assert.ok(detail.includes(plant.light));
  for (const event of plant.history) assert.ok(detail.includes(event.split(" · ")[1]));
  assert.match(detail, /Last watered/);
  if (plant.history.some(event => /new |brown |noted/i.test(event))) assert.match(detail, /Observation/);
}

app.act("fern", "complete");
assert.equal(app.run("state.fern.status"), "done");
assert.equal(app.run("state.fern.history[0]"), "Today · Watered");
assert.deepEqual(app.json("pendingToday().map(plant => plant.id)"), ["pothos", "cactus"]);
app.act("pothos", "snooze");
assert.equal(app.run("state.pothos.status"), "snoozed");
assert.match(app.node("upcomingQueue").innerHTML, /Orbit/);
assert.ok(!app.node("todayQueue").innerHTML.includes("task-pothos"));
assert.match(app.node("progressText").textContent, /1 of 3 cared for · 1 snoozed/);
app.run("undoLatest()");
assert.equal(app.run("state.pothos.status"), "pending");
assert.equal(app.run("state.fern.status"), "done", "Undo touches only its plant");
app.run("undoLatest()");
assert.deepEqual(app.json("state.fern.history"), fixture.plants[0].history);
assert.deepEqual(app.json("state.pothos.history"), fixture.plants[1].history);

app.act("pothos", "water");
assert.equal(app.run("state.pothos.status"), "pending", "Watering cannot complete a rotation");
app.act("pothos", "water");
assert.equal(app.run("state.pothos.history.filter(entry => entry === 'Today · Watered').length"), 1, "Duplicate watering is prevented");
app.run("undoLatest()");
assert.deepEqual(app.json("state.pothos.history"), fixture.plants[1].history);

for (const id of ["fern", "pothos", "cactus"]) app.act(id, "complete");
assert.equal(app.run("pendingToday().length"), 0);
assert.equal(app.run("completedToday().length"), 3);
assert.match(app.node("todayQueue").innerHTML, /a little mist for Drama tomorrow/);
assert.equal(app.node("progressBar").attributes["aria-valuenow"], "3");
assert.equal(app.run("state.pothos.history[0]"), "Today · Rotated");
assert.equal(app.run("state.cactus.history[0]"), "Today · Checked soil");
const restored = harness({saved: app.saved()});
assert.equal(restored.run("completedToday().length"), 3);
assert.deepEqual(restored.json("state"), app.json("state"), "Persisted history and statuses survive a new load");

const snoozed = harness();
for (const id of ["fern", "pothos", "cactus"]) snoozed.act(id, "snooze");
assert.match(snoozed.node("todayQueue").innerHTML, /Nothing more for today/);
assert.match(snoozed.node("todayQueue").innerHTML, /3 reminders are tucked into tomorrow/);
assert.equal((snoozed.node("upcomingQueue").innerHTML.match(/class="upcoming-row"/g) || []).length, 4);
assert.equal(snoozed.node("progressBar").attributes["aria-valuenow"], "0");
assert.equal(snoozed.run("completedToday().length"), 0);
snoozed.run("pauseUndo()");
snoozed.advance(15000);
assert.equal(snoozed.node("toast").hidden, false, "A paused undo survives past the usual deadline");
snoozed.run("resumeUndo()");
snoozed.advance(12001);
assert.equal(snoozed.node("toast").hidden, true, "Undo closes when the resumed deadline expires");
snoozed.run("undoLatest()");
assert.equal(snoozed.run("snoozedToday().length"), 3, "Expired actions cannot be undone");

const denied = harness({denied: true});
assert.equal(denied.run("pendingToday().length"), 3);
denied.act("fern", "complete");
assert.equal(denied.run("state.fern.status"), "done");
assert.equal(denied.node("sessionNote").hidden, false);
denied.run("undoLatest()");
assert.equal(denied.run("state.fern.status"), "pending");
assert.equal(harness({saved: "{broken"}).run("pendingToday().length"), 3);
assert.equal(harness({saved: JSON.stringify({version: 1, plants: {fern: {status: "invented", history: []}}})}).run("pendingToday().length"), 3);

// Static checks enforce the offline contract and inspect the actual SVG source.
assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(source));
assert.ok(!/\b(?:src|href)=["']https?:/.test(html));
assert.ok(!/@import|https?:\/\//.test(css));
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /:focus-visible/);
assert.match(html, /<dialog[^>]*aria-labelledby="detailName"/);
assert.match(html, /connect-src 'none'/);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, "Static IDs are unique");
for (const [, value] of html.matchAll(/\bd="([^"]+)"/g)) assert.ok(/^[\d\s.,+\-eEaAcChHlLmMqQsStTvVzZ]*$/.test(value), `Valid SVG path vocabulary: ${value}`);
console.log("PASS: fixture fidelity, overdue-first queue, four complete detail histories, task-specific completion, watering deduplication, snooze and tomorrow list, independent stacked undo, paused/expired undo, accurate all-done states, reload persistence, denied/corrupt storage fallback, and static offline/accessibility/SVG checks.");
console.log("These checks use a minimal DOM adapter. Browser layout, native focus, and visual appearance require node verify.mjs or manual browser review.");
