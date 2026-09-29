'use strict';

// Offline state/markup checks using Node's built-ins. This is not a browser or
// layout test: the small DOM stand-in only exposes APIs used by the application.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'PLANTS.json'), 'utf8'));

function fixture({ saved, blockedStorage = false, day = '2026-09-30T12:00:00' } = {}) {
  const nodes = new Map();
  const events = new Map();
  const timers = new Map();
  const storage = new Map(saved ? [['moss-garden-v1', saved]] : []);
  let tick = 0;
  let clock = new Date(day).getTime();
  let document;
  class Element {
    constructor(key) {
      this.key = key; this.textContent = ''; this.hidden = false; this.style = {};
      this.dataset = {}; this.value = ''; this.listeners = {}; this.attributes = {};
      this.classList = { toggle() {} };
    }
    set innerHTML(value) {
      this.markup = value;
      if (this.key === '#plant-detail') {
        const textarea = value.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/);
        if (textarea) {
          const input = new Element('#observation');
          input.value = textarea[1]; input.dataset.focus = 'observation';
          nodes.set('#observation', input);
        }
      }
    }
    get innerHTML() { return this.markup || ''; }
    setAttribute(name, value) { this.attributes[name] = value; }
    querySelectorAll(selector) { return selector === '.day-bar' ? Array.from({ length: 7 }, () => new Element('bar')) : []; }
    querySelector(selector) { return document.querySelector(selector); }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    contains(target) { return target?.parent === this || (this.key === '#plant-dialog' && Boolean(target?.dataset.focus)); }
    focus() { document.activeElement = this; }
    append(element) { element.parent = this; }
    remove() { this.removed = true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.listeners.close?.(); }
    setSelectionRange() {}
    setCustomValidity(message) { this.validityMessage = message; }
    reportValidity() {}
  }
  document = {
    activeElement: null, hidden: false,
    querySelector(selector) {
      if (selector === '#observation' && !nodes.has(selector)) return null;
      if (!nodes.has(selector)) nodes.set(selector, new Element(selector));
      return nodes.get(selector);
    },
    createElement: tag => new Element(tag),
    addEventListener: (name, callback) => events.set(name, callback)
  };
  document.body = new Element('body');
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const context = vm.createContext({
    document, Date: ClockDate, Intl, console, performance: { now: () => tick },
    setTimeout: callback => { const id = ++tick; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id), setInterval() {},
    localStorage: {
      getItem(key) { if (blockedStorage) throw Error('blocked'); return storage.get(key) || null; },
      setItem(key, value) { if (blockedStorage) throw Error('blocked'); storage.set(key, value); }
    }
  });
  context.window = context;
  vm.runInContext(source, context);
  return {
    run: expression => vm.runInContext(expression, context),
    plain: expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context)),
    node: selector => document.querySelector(selector), storage, events, timers,
    advance: days => { clock += days * 86400000; }
  };
}

const checks = [];
function check(name, run) { run(); checks.push(name); console.log(`PASS ${name}`); }

check('Embedded plant and week data exactly match PLANTS.json', () => {
  assert.deepEqual(fixture().plain('PLANT_DATA'), seed);
});
check('Initial queue prioritizes Frida, includes three due tasks, and separates Drama', () => {
  const app = fixture();
  const queue = app.node('#today-queue').innerHTML;
  assert(queue.indexOf('Frida') < queue.indexOf('Orbit'));
  assert(queue.indexOf('Orbit') < queue.indexOf('Dot'));
  assert(!queue.includes('Drama'));
  assert(queue.includes('2 days overdue'));
  assert.equal(app.node('#queue-count').textContent, 3);
  assert(app.node('#upcoming-queue').innerHTML.includes('Drama'));
  assert.equal(app.node('#all-done').hidden, true);
  assert.equal(app.node('#week-total').textContent, 16);
});
check('Watering updates queue, history, weekly rhythm, persistence, and undo', () => {
  const app = fixture();
  app.run("act('complete', 'fern')");
  assert.equal(app.run("isDone(plantById('fern'))"), true);
  assert.equal(app.node('#queue-count').textContent, 2);
  assert.equal(app.node('#week-total').textContent, 17);
  assert.equal(app.run("historyFor(plantById('fern'))[0].label"), 'Watered');
  const reloaded = fixture({ saved: app.storage.get('moss-garden-v1') });
  assert.equal(reloaded.run("isDone(plantById('fern'))"), true);
  app.run('undo([...receipts.keys()][0])');
  assert.equal(app.node('#queue-count').textContent, 3);
  assert.equal(app.node('#week-total').textContent, 16);
  assert.equal(app.run('state.entries.length'), 0);
});
check('Snooze moves care to tomorrow without claiming completion; undo restores overdue state', () => {
  const app = fixture();
  app.run("act('snooze', 'fern')");
  assert(!app.node('#today-queue').innerHTML.includes('Frida'));
  assert(app.node('#upcoming-queue').innerHTML.includes('Frida'));
  assert(app.node('#upcoming-queue').innerHTML.includes('Snoozed'));
  assert.equal(app.run('state.entries.length'), 0);
  assert.equal(app.node('#week-total').textContent, 16);
  app.run('undo([...receipts.keys()][0])');
  assert(app.node('#today-queue').innerHTML.includes('2 days overdue'));
});
check('Each plant has its correct action; rapid actions retain independent undo paths', () => {
  const app = fixture();
  app.run("act('complete', 'fern'); act('complete', 'pothos'); act('complete', 'cactus')");
  assert.equal(app.node('#queue-count').textContent, 0);
  assert.equal(app.node('#all-done').hidden, false);
  assert.deepEqual(app.plain('state.entries.map(entry => entry.label)'), ['Watered', 'Rotated', 'Checked soil']);
  assert.equal(app.run('receipts.size'), 3);
  assert.equal(app.node('#week-total').textContent, 19);
  app.run('undo([...receipts.keys()][1])');
  assert(app.node('#today-queue').innerHTML.includes('Orbit'));
  assert.equal(app.node('#queue-count').textContent, 1);
  assert.equal(app.node('#all-done').hidden, true);
  assert.equal(app.node('#week-total').textContent, 18);
});
check('All-snoozed state explains what is deferred and keeps every plant reachable', () => {
  const app = fixture();
  app.run("act('snooze', 'fern'); act('snooze', 'pothos'); act('snooze', 'cactus')");
  assert.equal(app.node('#all-done').hidden, false);
  assert(app.node('#done-description').textContent.includes('3 plants are snoozed'));
  for (const plant of seed.plants) assert(app.node('#plant-collection').innerHTML.includes(plant.name));
  assert.equal(app.node('#completed-section').hidden, true);
});
check('Tomorrow’s tasks return after midnight; completed tasks stay completed', () => {
  const app = fixture();
  app.run("act('snooze', 'fern'); act('complete', 'pothos')");
  app.advance(1);
  app.run('renderAll()');
  assert.equal(app.run("dueText(plantById('fern'))"), 'Today');
  assert.equal(app.run("dueText(plantById('calathea'))"), 'Today');
  assert.equal(app.run("isDone(plantById('pothos'))"), true);
  assert(app.node('#today-queue').innerHTML.includes('Drama'));
});
check('Details include source light, watering, observation history, and safe note entry', () => {
  const app = fixture();
  app.run("openDetail('fern')");
  assert(app.node('#plant-detail').innerHTML.includes('Low, indirect'));
  assert(app.node('#plant-detail').innerHTML.includes('Last watered Sep 16'));
  assert(app.node('#plant-detail').innerHTML.includes('New frond'));
  app.node('#observation').value = '<img src=x onerror=alert(1)> A new frond!';
  app.events.get('submit')({ target: { id: 'observation-form' }, preventDefault() {} });
  assert(app.node('#plant-detail').innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert(!app.node('#plant-detail').innerHTML.includes('<img src=x'));
  assert.equal(app.node('#observation').value, '');
  assert.equal(app.node('#week-total').textContent, 16);
  app.run('undo([...receipts.keys()][0])');
  assert.equal(app.run('state.entries.length'), 0);
});
check('Independent watering does not complete a rotation and prevents duplicate water logs', () => {
  const app = fixture();
  app.run("act('water', 'pothos'); act('water', 'pothos')");
  assert.equal(app.run('state.entries.length'), 1);
  assert.equal(app.run("isDone(plantById('pothos'))"), false);
  assert.equal(app.node('#queue-count').textContent, 3);
});
check('Early care works and a repeated completion cannot double-count', () => {
  const app = fixture();
  app.run("act('complete', 'calathea'); act('complete', 'calathea')");
  assert.equal(app.run('state.entries.length'), 1);
  assert.equal(app.node('#upcoming-section').hidden, true);
  assert.equal(app.node('#week-total').textContent, 17);
});
check('Undo expires, but pauses while the receipt is hovered', () => {
  const app = fixture();
  app.run("act('complete', 'fern')");
  app.run('receipts.values().next().value.element.listeners.pointerenter()');
  assert.equal(app.run('receipts.values().next().value.timer'), null);
  app.run('receipts.values().next().value.element.listeners.pointerleave()');
  const timer = app.run('receipts.values().next().value.timer');
  app.timers.get(timer)();
  assert.equal(app.run('receipts.size'), 0);
  assert.equal(app.run("isDone(plantById('fern'))"), true);
});
check('Unavailable or malformed storage leaves a usable application', () => {
  const app = fixture({ blockedStorage: true });
  app.run("act('complete', 'fern')");
  assert.equal(app.node('#queue-count').textContent, 2);
  assert(app.node('#storage-status').textContent.includes('unavailable'));
  const corrupt = fixture({ saved: '{broken' });
  assert.equal(corrupt.node('#queue-count').textContent, 3);
  const invalid = fixture({ saved: JSON.stringify({ version: 1, anchorDay: '2026-09-31', tasks: {}, entries: [] }) });
  assert.equal(invalid.node('#queue-count').textContent, 3);
});
check('Static accessibility and offline boundaries are present', () => {
  assert(html.includes('<html lang="en">'));
  assert(html.includes('class="skip-link"'));
  assert(html.includes('<dialog id="plant-dialog" aria-labelledby="detail-name"'));
  assert(html.includes('aria-live="polite"'));
  assert(css.includes(':focus-visible'));
  assert(css.includes('prefers-reduced-motion: reduce'));
  assert(css.includes('forced-colors: active'));
  assert(html.includes("connect-src 'none'"));
  assert(!/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/.test(source));
  assert(!/(?:src|href)=["']https?:/.test(html));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'Static IDs must be unique');
  for (const match of html.matchAll(/<use href="#([^"]+)"/g)) assert(ids.includes(match[1]), `Missing SVG symbol ${match[1]}`);
});

console.log(`\n${checks.length} offline checks passed. Browser rendering and real keyboard interaction require manual verification.`);
