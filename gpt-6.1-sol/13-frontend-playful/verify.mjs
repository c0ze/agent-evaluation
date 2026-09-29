// Dependency-free, offline browser checks. Run: node verify.mjs
// Chrome is driven through OS pipes; no server or debugging TCP port is used.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const profile = await mkdtemp(join(root, ".browser-check-"));
const chromePath = process.env.MOSS_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chrome = spawn(chromePath, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-pipe",
  "--disable-background-networking", "--disable-component-update", "--disable-sync",
  "--disable-default-apps", "--no-first-run", "--no-default-browser-check",
  "--disable-client-side-phishing-detection", "--disable-breakpad", "--disable-crash-reporter",
  "--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication",
  "--host-resolver-rules=MAP * ~NOTFOUND", "--metrics-recording-only",
  `--user-data-dir=${profile}`, `--disk-cache-dir=${join(profile, "cache")}`, "about:blank"
], {stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"]});

let nextId = 0;
let buffer = "";
let diagnostics = "";
let sessionId;
const pending = new Map();
const exceptions = [];
const externalRequests = [];
chrome.stderr.on("data", data => { diagnostics = (diagnostics + data).slice(-8000); });
chrome.on("error", error => { for (const item of pending.values()) item.reject(error); });
chrome.on("exit", (code, signal) => { for (const item of pending.values()) item.reject(new Error(`Chrome exited (${signal || code}): ${diagnostics || "Browser launch is unavailable in this environment."}`)); });
chrome.stdio[4].on("data", data => {
  buffer += data.toString();
  let end;
  while ((end = buffer.indexOf("\0")) !== -1) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id) {
      const item = pending.get(message.id);
      if (!item) continue;
      clearTimeout(item.timeout);
      pending.delete(message.id);
      if (message.error) item.reject(new Error(JSON.stringify(message.error)));
      else item.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails);
    else if (message.method === "Log.entryAdded" && message.params.entry.level === "error") exceptions.push(message.params.entry);
    else if (message.method === "Network.requestWillBeSent" && /^https?:/.test(message.params.request.url)) externalRequests.push(message.params.request.url);
  }
});

function command(method, params = {}, inPage = true) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}\n${diagnostics}`)); }, 12000);
    pending.set(id, {resolve, reject, timeout});
    chrome.stdio[3].write(JSON.stringify({id, method, params, ...(inPage && sessionId ? {sessionId} : {})}) + "\0");
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(expression) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(expression)) return;
    await delay(25);
  }
  throw new Error(`Condition never became true: ${expression}`);
}

async function reload() {
  await command("Page.reload");
  await waitFor("document.readyState === 'complete' && typeof pendingToday === 'function' && document.querySelector('#todayQueue').children.length > 0");
}

async function click(selector) {
  await evaluate(`(() => { const button = document.querySelector(${JSON.stringify(selector)}); if (!button) throw new Error('Missing button'); button.focus(); button.click(); })()`);
}

async function key(key, code, modifiers = 0) {
  const keyCode = {Tab: 9, Enter: 13, Escape: 27}[key];
  await command("Input.dispatchKeyEvent", {type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers});
  await command("Input.dispatchKeyEvent", {type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers});
}

async function screenshot(name) {
  await mkdir(join(root, "previews"), {recursive: true});
  const layout = await command("Page.getLayoutMetrics");
  const size = layout.cssContentSize;
  const result = await command("Page.captureScreenshot", {format: "png", captureBeyondViewport: true, clip: {x: 0, y: 0, width: size.width, height: size.height, scale: 1}});
  await writeFile(join(root, "previews", name), Buffer.from(result.data, "base64"));
}

try {
  const target = await command("Target.createTarget", {url: "about:blank"}, false);
  sessionId = (await command("Target.attachToTarget", {targetId: target.targetId, flatten: true}, false)).sessionId;
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Log.enable");
  await command("Network.enable");
  await command("Network.setBlockedURLs", {urls: ["http://*", "https://*", "ws://*", "wss://*"]});
  await command("Emulation.setDeviceMetricsOverride", {width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false});
  await command("Page.navigate", {url: pathToFileURL(join(root, "index.html")).href});
  await waitFor("document.readyState === 'complete' && typeof pendingToday === 'function'");
  await evaluate("localStorage.removeItem(STORAGE_KEY)");
  await reload();

  const fixture = JSON.parse(await readFile(join(root, "PLANTS.json"), "utf8"));
  assert.deepEqual(await evaluate("DATA"), fixture, "Embedded data matches the provided fixture exactly");
  assert.equal(await evaluate("pendingToday().length"), 3);
  assert.equal(await evaluate("document.querySelector('#todayQueue article').getAttribute('aria-labelledby')"), "task-fern");
  assert.equal(await evaluate("document.querySelector('#upcomingQueue').textContent.includes('Drama')"), true);
  assert.equal(await evaluate("document.querySelectorAll('.week-day').length"), 7);
  assert.equal(await evaluate("[...document.querySelectorAll('.week-bar')].every(bar => bar.getBoundingClientRect().height > 0)"), true, "CSP permits the chart's local style values");
  await screenshot("desktop.png");

  // Native modal semantics and keyboard focus containment.
  await click('[data-action="details"][data-plant="fern"]');
  assert.equal(await evaluate("dialog.open && document.activeElement.id === 'closeDialog'"), true);
  assert.equal(await evaluate("document.querySelector('#dialogContent').textContent.includes('Low, indirect') && document.querySelector('#dialogContent').textContent.includes('Sep 16') && document.querySelector('#dialogContent').textContent.includes('New frond')"), true);
  await key("Tab", "Tab", 8);
  assert.equal(await evaluate("dialog.contains(document.activeElement) && document.activeElement.dataset.action === 'snooze'"), true, "Shift-Tab wraps within the modal");
  await key("Tab", "Tab");
  assert.equal(await evaluate("document.activeElement.id"), "closeDialog");
  await key("Tab", "Tab");
  assert.equal(await evaluate("document.activeElement.dataset.action"), "water");
  await key("Enter", "Enter");
  assert.equal(await evaluate("state.fern.status"), "done");
  assert.equal(await evaluate("state.fern.history[0]"), "Today · Watered");
  assert.equal(await evaluate("dialog.contains(toast) && !toast.hidden"), true, "Undo remains reachable in the modal top layer");
  await screenshot("details.png");
  await click("#undoButton");
  assert.equal(await evaluate("state.fern.status"), "pending");
  assert.deepEqual(await evaluate("state.fern.history"), fixture.plants[0].history);
  await key("Escape", "Escape");
  assert.equal(await evaluate("dialog.open"), false);
  assert.equal(await evaluate("document.activeElement.dataset.plant"), "fern");

  // Correct task semantics, reordering, chart changes, and stacked undo.
  await click('[data-action="complete"][data-plant="fern"]');
  assert.equal(await evaluate("document.activeElement.dataset.plant"), "pothos", "Focus moves to the next task when a row disappears");
  await click('[data-action="snooze"][data-plant="pothos"]');
  assert.equal(await evaluate("state.pothos.status"), "snoozed");
  assert.equal(await evaluate("document.querySelector('#upcomingQueue').textContent.includes('Orbit')"), true);
  assert.equal(await evaluate("document.querySelector('.week-day.is-today .week-number').textContent"), "2");
  await click("#undoButton");
  await click("#undoButton");
  assert.equal(await evaluate("pendingToday().length"), 3);
  assert.deepEqual(await evaluate("state.fern.history"), fixture.plants[0].history);
  assert.deepEqual(await evaluate("state.pothos.history"), fixture.plants[1].history);

  // Extra watering does not complete an unrelated rotation reminder.
  await click('[data-action="details"][data-plant="pothos"]');
  await click('#dialogContent [data-action="water"]');
  assert.equal(await evaluate("state.pothos.status"), "pending");
  assert.equal(await evaluate("state.pothos.history[0]"), "Today · Watered");
  await click('#dialogContent [data-action="water"]');
  assert.equal(await evaluate("state.pothos.history.filter(entry => entry === 'Today · Watered').length"), 1);
  await click("#undoButton");
  await key("Escape", "Escape");

  for (const id of ["fern", "pothos", "cactus"]) await click(`[data-action="complete"][data-plant="${id}"]`);
  assert.equal(await evaluate("pendingToday().length"), 0);
  assert.equal(await evaluate("completedToday().length"), 3);
  assert.equal(await evaluate("document.querySelector('#allDoneHeading') !== null"), true);
  assert.equal(await evaluate("state.pothos.history[0]"), "Today · Rotated");
  assert.equal(await evaluate("state.cactus.history[0]"), "Today · Checked soil");
  await click("#dismissToast");
  await screenshot("all-done.png");
  await reload();
  assert.equal(await evaluate("completedToday().length"), 3, "Care persists on reload");
  await click('[data-view="plants"]');
  assert.equal(await evaluate("document.querySelectorAll('.collection-plant').length"), 4);
  assert.equal(await evaluate("document.activeElement.id"), "plantsHeading");
  await screenshot("my-plants.png");

  // All snoozed is settled for today, with honest completion and tomorrow's list.
  await evaluate("localStorage.removeItem(STORAGE_KEY); history.replaceState(null, '', '#today')");
  await reload();
  for (const id of ["fern", "pothos", "cactus"]) await click(`[data-action="snooze"][data-plant="${id}"]`);
  assert.equal(await evaluate("completedToday().length"), 0);
  assert.equal(await evaluate("document.querySelector('#progressText').textContent"), "0 of 3 cared for · 3 snoozed");
  assert.equal(await evaluate("document.querySelectorAll('.upcoming-row').length"), 4);
  assert.equal(await evaluate("document.querySelector('#allDoneHeading').textContent"), "Nothing more for today.");

  // Focus pauses the undo deadline; leaving resumes its remaining duration.
  await evaluate("undoStack.forEach(entry => {entry.expires = Date.now() + 120}); document.querySelector('#undoButton').focus()");
  await delay(180);
  assert.equal(await evaluate("toast.hidden"), false);
  await evaluate("document.querySelector('#todayHeading').focus()");
  await delay(400);
  assert.equal(await evaluate("toast.hidden"), true);

  await evaluate("localStorage.setItem(STORAGE_KEY, '{corrupt')");
  await reload();
  assert.equal(await evaluate("pendingToday().length"), 3, "Corrupted storage falls back to the fixture");

  // Responsive layouts and reduced-motion are exercised in the real renderer.
  for (const width of [320, 390, 768, 1024, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", {width, height: 844, deviceScaleFactor: 1, mobile: width < 700});
    assert.equal(await evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth"), true, `No horizontal overflow at ${width}px`);
    if (width === 390) await screenshot("mobile.png");
  }
  await command("Emulation.setEmulatedMedia", {features: [{name: "prefers-reduced-motion", value: "reduce"}]});
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.primary-button')).transitionDuration"), "0s");
  assert.equal(await evaluate("getComputedStyle(document.documentElement).scrollBehavior"), "auto");

  // A denied storage API still allows the entire interaction model.
  await command("Page.addScriptToEvaluateOnNewDocument", {source: "Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('Unavailable', 'SecurityError'); }});"});
  await reload();
  assert.equal(await evaluate("pendingToday().length"), 3);
  await click('[data-action="complete"][data-plant="fern"]');
  assert.equal(await evaluate("state.fern.status"), "done");
  assert.equal(await evaluate("storageAvailable"), false);
  await click("#undoButton");
  assert.equal(await evaluate("state.fern.status"), "pending");
  assert.equal(await evaluate("document.querySelector('#saveStatus').textContent"), "Care is saved for this visit only.");

  assert.deepEqual(externalRequests, [], "No external requests were attempted by the app");
  assert.deepEqual(exceptions, [], "No runtime or browser console errors");
  console.log("PASS: exact fixture, overdue priority, all four details, keyboard modal and focus, task completion, watering, snooze, stacked/paused/expired undo, persistence and storage fallback, both all-done cases, 5 responsive widths, reduced motion, and zero external requests or console errors.");
  console.log("Browser previews are saved in previews/.");
} finally {
  for (const item of pending.values()) clearTimeout(item.timeout);
  pending.clear();
  chrome.kill("SIGTERM");
  await delay(300);
  await rm(profile, {recursive: true, force: true});
}
