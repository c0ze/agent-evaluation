const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless', '--no-sandbox', '--remote-debugging-pipe',
  `--user-data-dir=${path.join(__dirname, 'chrome-profile')}`,
  '--disable-background-networking', '--disable-component-update',
  '--disable-domain-reliability', '--disable-sync', '--disable-extensions',
  '--disable-default-apps', '--disable-breakpad', '--no-first-run',
  '--no-default-browser-check', '--metrics-recording-only',
  '--host-resolver-rules=MAP * ~NOTFOUND',
  '--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication,CertificateTransparencyComponentUpdater',
  'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });

let nextId = 0;
let buffer = '';
const pending = new Map();
const failures = [];
const runtimeErrors = [];
const networkRequests = [];
let stderr = '';
chrome.stderr.on('data', chunk => { stderr += chunk; });
chrome.stdio[4].on('data', chunk => {
  buffer += chunk;
  let delimiter;
  while ((delimiter = buffer.indexOf('\0')) >= 0) {
    const raw = buffer.slice(0, delimiter);
    buffer = buffer.slice(delimiter + 1);
    if (!raw) continue;
    const message = JSON.parse(raw);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(entry.timeout);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent') networkRequests.push(message.params.request.url);
    if (message.method === 'Fetch.requestPaused') {
      call('Fetch.failRequest', {requestId: message.params.requestId, errorReason: 'InternetDisconnected'}, message.sessionId).catch(() => {});
    }
  }
});
function call(method, params = {}, sessionId) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out: ${method}\n${stderr.slice(-2500)}`)), 15000);
    pending.set(id, { resolve, reject, timeout });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? {sessionId} : {}) }) + '\0');
  });
}
function assert(condition, label, detail) {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${detail ? ': ' + JSON.stringify(detail) : ''}`);
  if (!condition) failures.push(label);
}

(async () => {
  console.log('Browser', await call('Browser.getVersion'));
  const { targetId } = await call('Target.createTarget', {url: 'about:blank'});
  const { sessionId } = await call('Target.attachToTarget', {targetId, flatten: true});
  const cdp = (method, params) => call(method, params, sessionId);
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Network.enable');
  await cdp('Network.emulateNetworkConditions', {offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0});
  await cdp('Fetch.enable', {patterns: [{urlPattern: 'http*'}]});
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  async function ready() {
    for (let i=0; i<60; i++) {
      if (await evaluate('document.readyState === "complete"')) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Page did not load');
  }
  async function viewport(width, height) {
    await cdp('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  }
  async function capture(name) {
    const {contentSize} = await cdp('Page.getLayoutMetrics');
    const {data} = await cdp('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true, clip: {x:0,y:0,width:contentSize.width,height:contentSize.height,scale:1}});
    fs.writeFileSync(path.join(__dirname, `${name}.png`), Buffer.from(data, 'base64'));
  }
  await viewport(1440, 1000);
  await cdp('Page.navigate', {url: pathToFileURL(path.join(root, 'index.html')).href});
  await ready();
  await evaluate('localStorage.clear(); if(document.documentElement.classList.contains("reading-mode")) document.querySelector(".reading-toggle").click()');
  await capture('desktop');
  for (const width of [1440, 1280, 1024, 768, 760, 600, 390, 375, 320]) {
    await viewport(width, 844);
    const sizes = await evaluate('({viewport: innerWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll("body *")].filter(el=>{const r=el.getBoundingClientRect();return r.width && (r.right>innerWidth+1 || r.left < -1) && !el.closest("svg") && !el.classList.contains("skip-link")}).map(el=>({tag:el.tagName, class:el.className}))})');
    assert(sizes.document === width && !sizes.overflow.length, `No horizontal overflow at ${width}px`, sizes);
    if (width === 390) await capture('mobile');
  }

  await viewport(390, 844);
  const links = await evaluate('[...document.querySelectorAll("a")].map(a=>({href:a.getAttribute("href"),exists:!!document.querySelector(a.getAttribute("href"))}))');
  assert(links.every(link => link.exists), 'All navigation links have local destinations', links);
  const semantics = await evaluate('({h1:document.querySelectorAll("h1").length, lang:document.documentElement.lang, imageName:document.querySelector("svg title").textContent, fieldLabel:document.querySelector("label[for=email]").textContent})');
  assert(semantics.h1===1 && semantics.lang==='en' && !!semantics.imageName && !!semantics.fieldLabel, 'Page, figure, and form have accessible names', semantics);

  await evaluate('document.querySelector(".reading-toggle").focus()');
  await cdp('Input.dispatchKeyEvent', {type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32});
  await cdp('Input.dispatchKeyEvent', {type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32});
  const reading = await evaluate('({pressed:document.querySelector(".reading-toggle").getAttribute("aria-pressed"),art:getComputedStyle(document.querySelector(".cover-art")).display,font:getComputedStyle(document.querySelector(".cover-summary")).fontSize,columns:getComputedStyle(document.querySelector(".stories")).display,width:document.documentElement.scrollWidth})');
  assert(reading.pressed==='true' && reading.art==='none' && reading.columns==='block' && reading.width===390, 'Keyboard toggles mobile reading mode', reading);
  await capture('reading-mobile');
  await cdp('Page.reload');
  await ready();
  assert(await evaluate('document.querySelector(".reading-toggle").getAttribute("aria-pressed")==="true"'), 'Reading preference survives reload');
  await viewport(1440, 1000);
  await capture('reading-desktop');
  await evaluate('document.querySelector(".reading-toggle").click()');
  assert(await evaluate('getComputedStyle(document.querySelector(".cover-art")).display!=="none"'), 'Reading mode restores editorial artwork');

  async function submit(value) {
    await evaluate(`document.querySelector('#email').value=${JSON.stringify(value)}; document.querySelector('#subscribe-form').requestSubmit()`);
    return evaluate('({state:document.querySelector("#email-feedback").dataset.state,feedback:document.querySelector("#email-feedback").textContent,invalid:document.querySelector("#email").getAttribute("aria-invalid"),focused:document.activeElement.id,url:location.href,value:document.querySelector("#email").value})');
  }
  for (const value of ['', 'not-an-email', 'name@domain', 'two@@example.com', 'name@example.com extra']) {
    const result = await submit(value);
    assert(result.state === 'error' && result.invalid==='true' && result.focused==='email' && result.url.endsWith('/index.html'), `Invalid email handled inline (${value || 'empty'})`, result);
  }
  await evaluate('document.querySelector("#email").dispatchEvent(new Event("input", {bubbles:true}))');
  assert(await evaluate('!document.querySelector("#email-feedback").textContent && !document.querySelector("#email").hasAttribute("aria-invalid")'), 'Editing clears stale feedback');
  for (const value of ['reader@example.com', '  reader+margin@example.co.jp  ']) {
    const result = await submit(value);
    assert(result.state==='success' && result.invalid==='false' && result.value==='' && result.url.endsWith('/index.html'), 'Valid email gives success without navigation or retaining email', result);
  }
  assert(await evaluate('!JSON.stringify(localStorage).includes("example")'), 'No email saved in localStorage');
  await viewport(390, 844);
  await evaluate('document.querySelector("#subscribe").scrollIntoView({behavior:"instant"})');
  await capture('mobile-success');
  await cdp('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(await evaluate('getComputedStyle(document.documentElement).scrollBehavior==="auto"'), 'Reduced motion disables smooth scrolling');

  await cdp('Page.addScriptToEvaluateOnNewDocument', {source:'Object.defineProperty(window,"localStorage",{get(){throw new Error("Storage blocked")}})'});
  await cdp('Page.reload');
  await ready();
  assert(await evaluate('!document.querySelector(".reading-toggle").hidden && !document.querySelector("#email").disabled'), 'Controls work when storage is blocked');
  await evaluate('document.querySelector(".reading-toggle").click()');
  assert(await evaluate('document.documentElement.classList.contains("reading-mode")'), 'Reading mode works when storage is blocked');
  assert((await submit('reader@example.com')).state==='success', 'Email form works when storage is blocked');

  await cdp('Emulation.setScriptExecutionDisabled', {value:true});
  await cdp('Page.reload');
  await new Promise(resolve => setTimeout(resolve, 250));
  const noJs = await evaluate('({title:document.querySelector("h1").textContent,readingHidden:document.querySelector(".reading-toggle").hidden,inputDisabled:document.querySelector("#email").disabled,buttonDisabled:document.querySelector(".subscribe-button").disabled,noscript:getComputedStyle(document.querySelector("noscript")).display,width:document.documentElement.scrollWidth})');
  assert(noJs.readingHidden && noJs.inputDisabled && noJs.buttonDisabled && noJs.width===390, 'No-JavaScript content and safe disabled form', noJs);
  assert(!runtimeErrors.length, 'No uncaught JavaScript exceptions', runtimeErrors);
  assert(networkRequests.every(url=>url.startsWith('file:') || url.startsWith('data:')), 'Only local resources requested', [...new Set(networkRequests)]);
  if (failures.length) throw new Error('Failed: '+failures.join(', '));
  console.log('All browser checks passed.');
})().catch(error => {console.error(error); process.exitCode=1;}).finally(async () => {
  await call('Browser.close').catch(() => {});
  chrome.kill();
});
