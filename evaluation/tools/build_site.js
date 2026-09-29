// Build the static evaluation site in evaluation/site from scores, runs, checks and each model's files.
// Serve the repository root (python3 -m http.server) and open /evaluation/site/index.html.
const fs = require('fs'), path = require('path');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '../..');
const EV = path.join(ROOT, 'evaluation');
const OUT = path.join(EV, 'site');
const read = (p, d) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : d);
const json = (p, d) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : d);

const scores = json(path.join(EV, 'scores.json'), { tasks: {} });
const runs = json(path.join(EV, 'runs.json'), {});
const checks = json(path.join(EV, 'checks.json'), {});
const cross = json(path.join(EV, 'crosstest.json'), {});
const fe = json(path.join(EV, 'frontend-checks.json'), {});
const report = read(path.join(EV, 'REPORT.md'), '');
const TASKS = fs.readdirSync(path.join(ROOT, '_templates')).filter(t => /^\d\d-/.test(t)).sort();
const MODELS = Object.keys(runs).filter(m => fs.existsSync(path.join(ROOT, m)));
const GROUPS = [
  ['Code', ['01', '02', '03', '04']],
  ['Writing', ['05', '06', '07', '08']],
  ['Operations', ['09', '10']],
  ['Frontend', ['11', '12', '13']],
];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = s => marked.parse(String(s ?? ''), { mangle: false, headerIds: false });
const inline = s => marked.parseInline(esc(s));
const label = m => (runs[m] && runs[m].label) || m;
const title = t => t.slice(3).replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
const score = (t, m) => scores.tasks[t] && scores.tasks[t].models[m];
const fmt = n => (n == null ? '–' : String(Math.round(n * 100) / 100));
// Colour a 0-10 score on a single-hue ramp; text stays readable in both themes.
const heat = v => (v == null ? '' : ` style="--h:${Math.max(0, Math.min(1, (v - 4) / 6)).toFixed(2)}"`);

function totals(m) {
  let sum = 0, n = 0;
  const groups = GROUPS.map(([name, nums]) => {
    let s = 0, k = 0;
    for (const t of TASKS) if (nums.includes(t.slice(0, 2)) && score(t, m)) { s += score(t, m).total; k++; }
    return { name, avg: k ? s / k : null, n: k };
  });
  for (const t of TASKS) if (score(t, m)) { sum += score(t, m).total; n++; }
  return { sum, n, avg: n ? sum / n : null, groups };
}

function page(titleText, body, depth) {
  const up = depth ? '../' : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titleText)}</title><link rel="stylesheet" href="${up}style.css"></head>
<body><header class="top"><a class="brand" href="${up}index.html">Agent evaluation</a>
<nav aria-label="Tasks">${TASKS.map(t => `<a href="${up}tasks/${t}.html" title="${esc(title(t))}">${t.slice(0, 2)}</a>`).join('')}</nav></header>
<main>${body}</main><script src="${up}app.js"></script></body></html>`;
}

// ---------- index ----------
function indexPage() {
  const ranked = MODELS.map(m => ({ m, ...totals(m) })).sort((a, b) => (b.sum - a.sum));
  const cards = ranked.map(({ m, sum, n, avg, groups }, i) => {
    const r = runs[m] || {};
    return `<article class="card model">
      <div class="rank">${n ? (() => { const r = 1 + ranked.filter(x => x.sum > sum).length; return ranked.filter(x => x.sum === sum).length > 1 ? r + '=' : r; })() : '–'}</div>
      <h3>${esc(label(m))}</h3><p class="muted mono">${esc(r.model || '')}</p>
      <p class="big">${n ? fmt(sum) : '–'}<span class="muted"> / ${n * 10}</span></p>
      <p class="muted">average ${avg == null ? '–' : avg.toFixed(2)} per task</p>
      <dl class="meta">
        <dt>Effort</dt><dd>${esc(r.effort || '–')}</dd>
        <dt>Time</dt><dd>${esc(r.duration || 'not recorded')}</dd>
        <dt>Cost</dt><dd>${esc(r.cost || (r.usage ? 'tokens only' : 'not recorded'))}</dd>
        ${r.usage ? `<dt>Usage</dt><dd>${esc(r.usage)}</dd>` : ''}
        <dt>Where</dt><dd>${esc(r.where || '')}</dd>
      </dl>
      <div class="groups">${groups.map(g => `<span${heat(g.avg)} class="chip">${g.name} ${g.avg == null ? '–' : g.avg.toFixed(2)}</span>`).join('')}</div>
      ${r.notes ? `<p class="note">${esc(r.notes)}</p>` : ''}
    </article>`;
  }).join('');

  const head = `<tr><th scope="col">Task</th>${ranked.map(({ m }) => `<th scope="col">${esc(label(m))}</th>`).join('')}</tr>`;
  const rows = TASKS.map(t => {
    const best = Math.max(...MODELS.map(m => (score(t, m) ? score(t, m).total : -1)));
    return `<tr><th scope="row"><a href="tasks/${t}.html">${t.slice(0, 2)} ${esc(title(t))}</a></th>${ranked.map(({ m }) => {
      const s = score(t, m);
      return `<td class="num heat${s && s.total === best ? ' best' : ''}"${heat(s && s.total)}>${s ? fmt(s.total) : '–'}</td>`;
    }).join('')}</tr>`;
  }).join('');
  const groupRows = GROUPS.map(([name]) => `<tr class="sub"><th scope="row">${name} average</th>${ranked.map(({ groups }) => {
    const g = groups.find(x => x.name === name); return `<td class="num heat"${heat(g.avg)}>${g.avg == null ? '–' : g.avg.toFixed(2)}</td>`;
  }).join('')}</tr>`).join('');
  const totalRow = `<tr class="total"><th scope="row">Total</th>${ranked.map(({ sum, n }) => `<td class="num">${n ? fmt(sum) : '–'}</td>`).join('')}</tr>`;

  const graded = Object.keys(scores.tasks).length;
  const method = `<section class="card prose"><h2>How this was scored</h2>
    <ul>
      <li><strong>Objective checks first.</strong> A hidden 11-test contract suite for tasks 01–02; each model's own tests; each model's tests run against every other model's code and against the original files; word, character and hashtag limits; and for tasks 11–13, a headless browser at 1440 px and 390 px checking horizontal scroll, console errors and network requests.</li>
      <li><strong>Blind grading.</strong> For each task, one grader saw all submissions under random letters (a different mapping per task), with model names and paths removed. The final scores come from a five-way pass (A–E); the first, four-way pass is kept in <code>scores-4way.json</code> and shown as a repeatability check. It scored against <code>RUBRIC.md</code>, checking claims itself: rerunning tests, probing the code, counting limits, and clicking through the pages with Playwright.</li>
      <li><strong>Who graded.</strong> The graders were Claude Opus 5.5 subagents. Opus 5.5 is also one of the models graded; blinding reduces but does not remove that bias.</li>
      <li><strong>Not like-for-like.</strong> Sonnet 5.5 and Fable 5.1 ran on extra effort, Opus 5.5 on high, muse on max, mimo on its default. muse ran locally through tincan, and its cost can't be measured; token usage is shown instead. Scores are comparative within each task and anchored to the brief.</li>
    </ul><p class="muted">${graded} of ${TASKS.length} tasks graded.</p></section>`;

  const body = `<section class="hero"><h1>Thirteen tasks, ${MODELS.length} models</h1>
    <p class="lede">Each model got the same thirteen briefs as independent tasks with a fresh context. Every task is scored out of 10.</p></section>
    ${report ? `<section class="card prose report">${md(report)}</section>` : ''}
    <section class="models">${cards}</section>
    <section class="card"><h2>Scores by task</h2><div class="scroll"><table class="grid">${head}${rows}${groupRows}${totalRow}</table></div>
    <p class="muted">Highlighted cell: the best score on that task (ties all highlighted).</p></section>
    ${method}`;
  return page('Agent evaluation', body, 0);
}

// ---------- task pages ----------
const TEXT = new Set(['.md', '.py', '.txt', '.js', '.css', '.html', '.json', '.yml', '.yaml', '.toml', '.conf', '.cfg', '.ini', '.sh', '']);
function files(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (['__pycache__', 'node_modules', '.git'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      e.isDirectory() ? walk(p) : out.push(path.relative(dir, p));
    }
  })(dir);
  const order = f => (f === 'RESPONSE.md' ? 0 : f.endsWith('.md') ? 1 : f === 'TASK.md' ? 9 : 2);
  return out.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
}
function fileView(abs, rel) {
  const ext = path.extname(rel).toLowerCase();
  if (!TEXT.has(ext) && !rel.startsWith('.')) return `<p class="muted">Binary file, not shown.</p>`;
  let t = read(abs, '');
  const big = t.length > 150000; if (big) t = t.slice(0, 150000);
  const body = ext === '.md' ? `<div class="prose">${md(t)}</div>` : `<pre><code>${esc(t)}</code></pre>`;
  return body + (big ? `<p class="muted">Truncated at 150,000 characters.</p>` : '');
}

function objectiveFor(t, m) {
  const n = t.slice(0, 2), c = checks[m] || {}, items = [];
  if (n === '01' || n === '02') items.push(`Hidden contract tests: ${c.hidden_tests && c.hidden_tests.rc === 0 ? 'all 11 pass' : 'failures'}`);
  if (['01', '02', '04'].includes(n) && c[`own_tests_${n}`]) items.push(`Own tests: ${c[`own_tests_${n}`].summary}`);
  if (cross[t] && cross[t][m]) {
    const row = cross[t][m];
    const cells = Object.entries(row).map(([w, v]) => `${w === 'template' ? 'original' : label(w)}: ${v.ok ? 'pass' : v.detail}`);
    items.push(`This model's tests against each implementation — ${cells.join('; ')}`);
    const against = MODELS.filter(x => cross[t][x] && cross[t][x][m]).map(x => `${label(x)}'s tests: ${cross[t][x][m].ok ? 'pass' : cross[t][x][m].detail}`);
    items.push(`Other models' tests against this implementation — ${against.join('; ')}`);
  }
  const words = { '05': ['words_05_WEBHOOKS', 'WEBHOOKS.md ≈ %s words (700–1,100)'], '07': ['words_07_STORY', 'STORY.md ≈ %s words (800–1,100)'], '08': ['words_08_RESPONSE', 'RESPONSE.md ≈ %s words (≤ 150)'], '09': ['words_09_CUSTOMER_UPDATE', 'CUSTOMER_UPDATE.md ≈ %s words (< 180)'] }[n];
  if (words && c[words[0]] != null) items.push(words[1].replace('%s', c[words[0]]));
  const f = fe[`${m}/${t}`];
  if (f) items.push(`Browser: horizontal scroll at 390 px ${f.mobile.horizontalOverflow ? 'yes' : 'no'}; console errors ${f.desktop.consoleErrors.length + f.mobile.consoleErrors.length}; network requests ${f.desktop.remoteRequests.length + f.mobile.remoteRequests.length}`);
  return items.length ? `<ul class="checks">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
}

function taskPage(t) {
  const st = scores.tasks[t];
  const rubric = st ? st.rubric : {};
  const crit = Object.keys(rubric);
  const present = MODELS.filter(m => fs.existsSync(path.join(ROOT, m, t)));
  const ranked = st ? present.slice().sort((a, b) => ((score(t, b) || {}).total ?? -1) - ((score(t, a) || {}).total ?? -1)) : present;
  const n = t.slice(0, 2), frontend = ['11', '12', '13'].includes(n);

  const table = st ? `<div class="scroll"><table class="grid"><tr><th scope="col">Criterion (max)</th>${ranked.map(m => `<th scope="col">${esc(label(m))}</th>`).join('')}</tr>
    ${crit.map(c => `<tr><th scope="row">${esc(c)} <span class="muted">(${rubric[c]})</span></th>${ranked.map(m => { const s = score(t, m); const v = s && s.criteria[c]; return `<td class="num heat"${heat(v == null ? null : (v / rubric[c]) * 10)}>${fmt(v)}</td>`; }).join('')}</tr>`).join('')}
    <tr class="total"><th scope="row">Total (10)</th>${ranked.map(m => `<td class="num">${fmt((score(t, m) || {}).total)}</td>`).join('')}</tr></table></div>
    ${st.notes ? `<details class="notes"><summary>Grader's notes</summary><p class="muted">Letters in the grader's text: ${ranked.filter(m => score(t, m) && score(t, m).letter).map(m => `${esc(score(t, m).letter)} = ${esc(label(m))}`).sort().join(', ')}.</p><div class="prose">${md(st.notes)}</div></details>` : ''}` : `<p class="muted">Not graded yet.</p>`;

  const tabs = ranked.map((m, i) => `<button role="tab" id="tab-${i}" aria-controls="panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(label(m))}${score(t, m) ? ` <span class="pill">${fmt(score(t, m).total)}</span>` : ''}</button>`).join('');
  const panels = ranked.map((m, i) => {
    const s = score(t, m), dir = path.join(ROOT, m, t), fl = files(dir);
    const list = arr => (arr && arr.length ? `<ul>${arr.map(x => `<li>${inline(x)}</li>`).join('')}</ul>` : '<p class="muted">None noted.</p>');
    const evalCard = s ? `<section class="card eval">
        <h3>Evaluation <span class="pill big">${fmt(s.total)} / 10</span>${s.letter ? ` <span class="muted small">graded blind as submission ${esc(s.letter)}</span>` : ''}</h3>
        <p>${inline(s.summary)}</p>
        <div class="two"><div><h4>Strengths</h4>${list(s.strengths)}</div><div><h4>Weaknesses</h4>${list(s.weaknesses)}</div></div>
        <details><summary>Evidence the grader checked</summary>${list(s.evidence)}</details>
        <h4>Objective checks</h4>${objectiveFor(t, m)}
      </section>` : `<section class="card eval"><p class="muted">Not graded yet.</p>${objectiveFor(t, m)}</section>`;
    const shots = frontend ? `<section class="card"><h3>Screenshots <a class="button" href="../../../${m}/${t}/index.html" target="_blank" rel="noopener">Open the live page</a></h3>
        <div class="shots">${['desktop', 'mobile'].map(v => `<figure><a href="../../screenshots/${m}-${n}-${v}-full.png" target="_blank" rel="noopener"><img loading="lazy" src="../../screenshots/${m}-${n}-${v}.png" alt="${esc(label(m))}, ${v === 'desktop' ? '1440 px' : '390 px'} view"></a><figcaption>${v === 'desktop' ? '1440 × 900' : '390 × 844'} · click for full page</figcaption></figure>`).join('')}</div></section>` : '';
    const fileTabs = `<section class="card files"><h3>Files</h3><div class="filebar" role="tablist" aria-label="Files">${fl.map((f, j) => `<button role="tab" data-file="${i}-${j}" aria-selected="${j === 0}">${esc(f)}</button>`).join('')}</div>
        ${fl.map((f, j) => `<div class="file" id="file-${i}-${j}" ${j === 0 ? '' : 'hidden'}><p class="path mono">${esc(m)}/${esc(t)}/${esc(f)}</p>${fileView(path.join(dir, f), f)}</div>`).join('')}</section>`;
    return `<div role="tabpanel" id="panel-${i}" aria-labelledby="tab-${i}" ${i === 0 ? '' : 'hidden'}>${evalCard}${shots}${fileTabs}</div>`;
  }).join('');

  const brief = read(path.join(ROOT, '_templates', t, 'TASK.md'), '');
  const inputs = files(path.join(ROOT, '_templates', t)).filter(f => f !== 'TASK.md');
  const body = `<section class="hero"><p class="muted">Task ${n}</p><h1>${esc(title(t))}</h1></section>
    <details class="card brief" open><summary>The brief</summary><div class="prose">${md(brief)}</div>
      ${inputs.length ? `<p class="muted">Inputs given: ${inputs.map(f => `<a href="../../../_templates/${t}/${f}" target="_blank" rel="noopener" class="mono">${esc(f)}</a>`).join(', ')}</p>` : ''}</details>
    <section class="card"><h2>Scores</h2>${table}</section>
    <section><div class="tabs" role="tablist" aria-label="Models">${tabs}</div>${panels}</section>`;
  return page(`${n} ${title(t)} · Agent evaluation`, body, 1);
}

const CSS = `
:root{--bg:#f7f7f5;--surface:#fff;--ink:#1c1d1f;--muted:#62656b;--line:#e3e3df;--accent:#2f6fde;--accent-ink:#fff;--good:47 155 94;--code:#f2f2ef}
@media (prefers-color-scheme:dark){:root{--bg:#141517;--surface:#1c1e21;--ink:#e8e8e6;--muted:#a0a3a8;--line:#2e3135;--accent:#7aa7ff;--accent-ink:#0d1320;--good:84 196 128;--code:#232529}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}code,pre,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em}
.top{position:sticky;top:0;z-index:5;display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--line)}
.brand{font-weight:650;color:var(--ink);text-decoration:none}.top nav{display:flex;gap:2px;flex-wrap:wrap}
.top nav a{padding:3px 8px;border-radius:6px;text-decoration:none;color:var(--muted);font-variant-numeric:tabular-nums}.top nav a:hover{background:var(--code);color:var(--ink)}
main{max-width:1180px;margin:0 auto;padding:16px}
.hero h1{margin:.2em 0;font-size:1.8rem;letter-spacing:-.01em}.lede{color:var(--muted);max-width:70ch}
.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:14px 0}
h2{font-size:1.15rem;margin:0 0 10px}h3{font-size:1.02rem;margin:0 0 8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}h4{margin:12px 0 4px;font-size:.92rem}
.muted{color:var(--muted)}.note{color:var(--muted);font-size:.9em;margin-top:10px}
.models{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:14px 0}
.model{position:relative;margin:0}.rank{position:absolute;top:14px;right:16px;font-size:1.4rem;font-weight:700;color:var(--muted)}
.big{font-size:1.9rem;font-weight:700;margin:.2em 0 0;font-variant-numeric:tabular-nums}
.meta{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:10px 0;font-size:.9em}.meta dt{color:var(--muted)}.meta dd{margin:0}
.groups{display:flex;gap:6px;flex-wrap:wrap}.chip{padding:2px 8px;border-radius:99px;font-size:.82em;font-variant-numeric:tabular-nums;background:rgb(var(--good) / calc(.08 + var(--h,0) * .35))}
.scroll{overflow-x:auto}table.grid{border-collapse:collapse;width:100%;font-size:.92em}
.grid th,.grid td{border-bottom:1px solid var(--line);padding:7px 10px;text-align:left;white-space:nowrap}
.grid th[scope=col]{font-weight:600;color:var(--muted)}.num{text-align:right!important;font-variant-numeric:tabular-nums}
.heat{background:rgb(var(--good) / calc(var(--h,0) * .38))}.best{font-weight:750;box-shadow:inset 0 0 0 2px rgb(var(--good) / .9)}
tr.sub th{font-weight:500;color:var(--muted)}tr.total th,tr.total td{font-weight:700;border-top:2px solid var(--line)}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:18px 0 0}
.tabs button,.filebar button{font:inherit;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:8px;padding:7px 12px;cursor:pointer}
.tabs button[aria-selected=true]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.filebar{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}.filebar button{padding:4px 9px;font-size:.85em;font-family:ui-monospace,Menlo,monospace}
.filebar button[aria-selected=true]{border-color:var(--accent);box-shadow:inset 0 -2px 0 var(--accent)}
.pill{display:inline-block;padding:1px 8px;border-radius:99px;background:var(--code);color:var(--ink);font-size:.82em;font-variant-numeric:tabular-nums}.pill.big{font-size:.95em;font-weight:700}
.tabs button[aria-selected=true] .pill{background:rgb(255 255 255 / .25);color:inherit}
button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media (max-width:700px){.two{grid-template-columns:1fr}}
.eval ul,.checks{margin:4px 0;padding-left:20px}.checks{font-size:.9em;color:var(--muted)}
details summary{cursor:pointer;font-weight:600}.brief summary{font-size:1.05rem}
.prose{max-width:80ch;overflow-wrap:anywhere}.prose table{border-collapse:collapse;display:block;overflow-x:auto;font-size:.92em}.prose th,.prose td{border:1px solid var(--line);padding:4px 8px;vertical-align:top}
pre{background:var(--code);padding:12px;border-radius:8px;overflow:auto;max-height:70vh;line-height:1.45}
.prose code{background:var(--code);padding:1px 4px;border-radius:4px}.prose pre code{background:none;padding:0}
.path{color:var(--muted);margin:0 0 6px}
.shots{display:grid;grid-template-columns:3fr 1fr;gap:12px;align-items:start}@media (max-width:700px){.shots{grid-template-columns:1fr}}
.shots img{width:100%;height:auto;border:1px solid var(--line);border-radius:8px;display:block}figure{margin:0}figcaption{color:var(--muted);font-size:.82em;margin-top:4px}
.button{font-size:.85rem;font-weight:500;text-decoration:none;border:1px solid var(--line);border-radius:7px;padding:3px 10px}
.report{border-left:3px solid var(--accent)}.small{font-size:.8rem;font-weight:400}
`;
const JS = `
document.querySelectorAll('.tabs').forEach(bar => {
  const tabs = [...bar.querySelectorAll('[role=tab]')];
  const pick = t => { tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute('aria-controls')).hidden = !on; }); t.focus(); history.replaceState(null, '', '#' + t.textContent.trim().split(' ').slice(0, -1).join('-').toLowerCase() || t.id); };
  tabs.forEach((t, i) => { t.addEventListener('click', () => pick(t)); t.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); pick(tabs[(i + d + tabs.length) % tabs.length]); } }); });
  const want = location.hash.slice(1); const hit = tabs.find(t => t.textContent.trim().toLowerCase().startsWith(want.replace(/-/g, ' '))); if (want && hit) pick(hit);
});
document.querySelectorAll('.filebar').forEach(bar => bar.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  bar.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', x === b));
  const [p] = b.dataset.file.split('-'); bar.parentElement.querySelectorAll('.file').forEach(f => { f.hidden = f.id !== 'file-' + b.dataset.file; });
}));
`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'tasks'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'style.css'), CSS);
fs.writeFileSync(path.join(OUT, 'app.js'), JS);
fs.writeFileSync(path.join(OUT, 'index.html'), indexPage());
for (const t of TASKS) fs.writeFileSync(path.join(OUT, 'tasks', `${t}.html`), taskPage(t));
console.log(`site: ${TASKS.length} task pages, ${MODELS.length} models, ${Object.keys(scores.tasks).length} graded tasks -> ${path.relative(ROOT, OUT)}`);
