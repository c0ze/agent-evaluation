// Screenshot and check each model's frontend tasks (11-13) at desktop and phone width.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const MODELS = process.argv.slice(2).length ? process.argv.slice(2) : ['mimo', 'sonnet-5.5', 'fable-5.1', 'opus-5.5'];
const TASKS = ['11-frontend-operations', '12-frontend-editorial', '13-frontend-playful'];
const OUT = path.join(ROOT, 'evaluation/screenshots');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const results = {};
  for (const m of MODELS) for (const t of TASKS) {
    const key = `${m}/${t}`, r = results[key] = {};
    for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: label === 'mobile', hasTouch: label === 'mobile' });
      const page = await ctx.newPage(), errors = [], remote = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text().slice(0, 200)); });
      page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 200)));
      page.on('request', q => { if (!q.url().startsWith(base) && !q.url().startsWith('data:')) remote.push(q.url()); });
      const url = `${base}/${m}/${t}/index.html`;
      const resp = await page.goto(url, { waitUntil: 'load' }).catch(e => null);
      await page.waitForTimeout(2500);
      const m1 = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, height: document.documentElement.scrollHeight, title: document.title }));
      const short = t.slice(0, 2);
      await page.screenshot({ path: `${OUT}/${m}-${short}-${label}.png` });
      await page.screenshot({ path: `${OUT}/${m}-${short}-${label}-full.png`, fullPage: true, clip: { x: 0, y: 0, width: vp.width, height: Math.min(m1.height, 6000) } }).catch(() => {});
      r[label] = { status: resp ? resp.status() : 'failed', ...m1, horizontalOverflow: m1.scrollWidth > m1.innerWidth + 1, consoleErrors: errors, remoteRequests: remote };
      await ctx.close();
    }
    console.log(key, 'desktop overflow', r.desktop.horizontalOverflow, '| 390 overflow', r.mobile.horizontalOverflow, '| errors', r.desktop.consoleErrors.length + r.mobile.consoleErrors.length, '| remote', r.desktop.remoteRequests.length + r.mobile.remoteRequests.length, '| title', r.desktop.title);
  }
  fs.writeFileSync(path.join(ROOT, 'evaluation/frontend-checks.json'), JSON.stringify(results, null, 1));
  await browser.close(); server.close();
})();
