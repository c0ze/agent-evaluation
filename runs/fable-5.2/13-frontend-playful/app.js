/* Moss — a gentle plant-care companion.
 * Plain JavaScript, no dependencies, no network requests.
 *
 * The data below mirrors PLANTS.json exactly. It is embedded rather than
 * fetched so the page works when opened straight from disk (file://) and
 * makes no requests at all. Everything on screen is rendered from it.
 */
(() => {
  'use strict';

  const DATA = {
    plants: [
      { id: 'fern', name: 'Frida', species: 'Boston fern', location: 'Bathroom', task: 'Water', due: '2 days overdue', urgency: 4, light: 'Low, indirect', history: ['Sep 19 · Misted', 'Sep 16 · Watered', 'Sep 12 · New frond'] },
      { id: 'pothos', name: 'Orbit', species: 'Golden pothos', location: 'Bookshelf', task: 'Rotate', due: 'Today', urgency: 2, light: 'Medium, indirect', history: ['Sep 20 · Watered', 'Sep 14 · Rotated', 'Sep 10 · Wiped leaves'] },
      { id: 'cactus', name: 'Dot', species: 'Bunny ears cactus', location: 'South window', task: 'Check soil', due: 'Today', urgency: 1, light: 'Bright, direct', history: ['Sep 08 · Watered', 'Sep 01 · New pad noted', 'Aug 22 · Rotated'] },
      { id: 'calathea', name: 'Drama', species: 'Calathea orbifolia', location: 'Bedroom', task: 'Mist', due: 'Tomorrow', urgency: 0, light: 'Medium, filtered', history: ['Sep 21 · Misted', 'Sep 18 · Watered', 'Sep 15 · Brown edge noted'] }
    ],
    week: [1, 3, 2, 4, 2, 1, 3]
  };

  /* PLANTS.json does not say which day is "today". The week is read as
   * Monday–Sunday with today on Tuesday: its count (3) matches the three
   * jobs that are due or overdue today. Change TODAY to move the marker. */
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const TODAY = 1;
  const TOAST_MS = 8000;

  /* ---------- small helpers ---------- */

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many = one + 's') => (n === 1 ? one : many);
  const NUMS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const word = (n) => NUMS[n] || String(n);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const possessive = (name) => name + (/s$/i.test(name) ? '’' : '’s');
  const listNames = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);

  const desktop = window.matchMedia('(min-width: 1160px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- copy keyed by task, with safe fallbacks ---------- */

  const TASKS = {
    water: { ask: (n) => `Water ${n}`, button: 'Watered', log: 'Watered', said: (n) => `${n} watered.`, past: 'watered', icon: 'drop' },
    rotate: { ask: (n) => `Rotate ${n}`, button: 'Rotated', log: 'Rotated', said: (n) => `${n} rotated.`, past: 'rotated', icon: 'turn' },
    'check soil': { ask: (n) => `Check ${possessive(n)} soil`, button: 'Soil checked', log: 'Soil checked', said: (n) => `${possessive(n)} soil checked.`, past: 'soil checked', icon: 'check' },
    mist: { ask: (n) => `Mist ${n}`, button: 'Misted', log: 'Misted', said: (n) => `${n} misted.`, past: 'misted', icon: 'drop' }
  };
  const taskOf = (p) => TASKS[p.task.toLowerCase()] || {
    ask: (n) => `${p.task}: ${n}`, button: 'Done', log: p.task, said: (n) => `${n}: ${p.task.toLowerCase()} done.`, past: 'done', icon: 'check'
  };

  /* A line of personality per plant. Unknown plants simply go without. */
  const MOODS = {
    fern: 'Crisping at the tips and telling everyone about it.',
    pothos: 'Leaning hard at the window. A quarter turn evens things out.',
    cactus: 'Almost certainly fine. Poke a finger in the soil to be sure.',
    calathea: 'Not due until tomorrow. Has opinions anyway.'
  };

  const TINTS = ['leaf', 'sun', 'blush', 'lilac'];

  /* ---------- icons (inline SVG, inherit currentColor) ---------- */

  const ICONS = {
    drop: '<path d="M12 3.5c3.2 4 5.5 6.9 5.5 10a5.5 5.5 0 0 1-11 0c0-3.1 2.3-6 5.5-10z"/>',
    turn: '<path d="M4.5 11a7.5 7.5 0 0 1 13.3-3.8M19 3.5v4h-4M19.5 13a7.5 7.5 0 0 1-13.3 3.8M5 20.5v-4h4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    moon: '<path d="M19.5 14.2A7.8 7.8 0 0 1 9.8 4.5a7.8 7.8 0 1 0 9.7 9.7z"/>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
    chevron: '<path d="M6 9.5l6 6 6-6"/>',
    undo: '<path d="M8.5 7.5L4 12l4.5 4.5M4.5 12h9.5a5 5 0 0 1 0 10h-2"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    back: '<path d="M9 6l-6 6 6 6M3.5 12H21"/>'
  };
  const icon = (name, cls = '') =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

  /* ---------- plant illustrations (inline SVG, drawn by hand) ---------- */

  const heart = (x, y, r, s = 1, gold = false) =>
    `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path class="lf" d="M0-7C5-14 16-7 0 11-16-7-5-14 0-7Z"/>${gold ? '<path class="lf-gold" d="M-3-3C0-7 7-3 1 5Z"/>' : ''}</g>`;
  const orb = (x, y, r, s = 1) =>
    `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><ellipse class="lf" rx="15" ry="19"/><path class="lf-vein" d="M0-16V16M0-9-10-13M0-9 10-13M0-1-12.5-5M0-1 12.5-5M0 7-11.5 4M0 7 11.5 4M0 13.5-7 11.5M0 13.5 7 11.5"/></g>`;
  const dots = (pts) => pts.map(([x, y]) => `<circle class="spine" cx="${x}" cy="${y}" r="1.5"/>`).join('');
  const fronds = ['M60 84C50 56 32 46 12 58', 'M60 84C54 48 42 28 24 23', 'M60 84C60 54 59 30 57 9', 'M60 84C66 48 80 28 97 25', 'M60 84C70 56 90 48 109 60'];

  const ART = {
    fern: `
      <g class="foliage">
        ${fronds.map((d, i) => `<path class="frond${i % 2 ? ' frond--b' : ''}" d="${d}"/><path class="frond-rib" d="${d}"/>`).join('')}
      </g>
      <rect class="pot pot--clay" x="33" y="78" width="54" height="11" rx="5.5"/>
      <path class="pot pot--clay" d="M39 89C30 102 34 122 46 126H74C86 122 90 102 81 89Z"/>
      <path class="pot-mark" d="M45 100c-2 7 0 14 4 19"/>`,
    pothos: `
      <g class="foliage">
        <path class="vine" d="M50 68C30 60 20 78 23 104M70 68C92 60 102 74 98 97M57 68C56 54 50 42 44 33M63 68C66 52 74 40 80 31"/>
        ${heart(23, 106, 8, 1.05, true)}${heart(20, 86, -22)}${heart(31, 68, -55, 0.95, true)}
        ${heart(98, 99, -8, 1.05)}${heart(102, 80, 24, 1, true)}${heart(90, 64, 58, 0.95)}
        ${heart(43, 31, 150, 1.05)}${heart(81, 29, -150, 1.05, true)}${heart(60, 45, 180, 0.9)}
        ${heart(50, 54, 118, 0.85, true)}${heart(71, 52, -120, 0.85)}
      </g>
      <rect class="pot pot--sun" x="40" y="66" width="40" height="58" rx="9"/>
      <path class="pot-band" d="M40 84h40v7H40z"/>
      <circle class="pot-foot" cx="48" cy="126" r="3"/><circle class="pot-foot" cx="72" cy="126" r="3"/>`,
    cactus: `
      <g class="foliage">
        <ellipse class="pad pad--b" cx="43" cy="31" rx="10.5" ry="15" transform="rotate(-18 43 31)"/>
        <ellipse class="pad pad--b" cx="78" cy="30" rx="11.5" ry="16.5" transform="rotate(16 78 30)"/>
        <ellipse class="pad pad--c" cx="88" cy="60" rx="6" ry="8.5" transform="rotate(42 88 60)"/>
        <ellipse class="pad" cx="60" cy="63" rx="21" ry="27"/>
        ${dots([[52, 48], [64, 46], [71, 58], [58, 60], [48, 66], [62, 73], [72, 73], [53, 79], [40, 25], [46, 33], [40, 38], [76, 22], [82, 31], [75, 36], [88, 59]])}
      </g>
      <path class="pot pot--plum" d="M30 90H90C90 113 78 125 60 125S30 113 30 90Z"/>
      <rect class="pot pot--plum" x="27" y="85" width="66" height="9" rx="4.5"/>
      <path class="pot-mark" d="M38 101c2 8 6 13 12 16"/>`,
    calathea: `
      <g class="foliage">
        <path class="vine" d="M60 86C56 72 44 62 37 52M60 86C60 66 60 50 60 40M60 86C66 72 78 62 86 52"/>
        ${orb(33, 44, -32)}${orb(88, 44, 34)}${orb(60, 27, 4, 1.05)}${orb(58, 60, -8, 0.8)}
      </g>
      <rect class="pot pot--blush" x="37" y="83" width="46" height="9" rx="4.5"/>
      <path class="pot pot--blush" d="M41 92H79L75 115H45Z"/>
      <path class="pot-band" d="M43 100h34l-1 6H44z"/>
      <rect class="pot-foot" x="50" y="115" width="20" height="5"/>
      <rect class="pot-foot" x="42" y="120" width="36" height="6" rx="3"/>`,
    generic: `
      <g class="foliage">
        <path class="vine" d="M60 86V52"/>
        ${heart(48, 50, 120, 1.6)}${heart(72, 46, -120, 1.6)}
      </g>
      <rect class="pot pot--clay" x="36" y="82" width="48" height="10" rx="5"/>
      <path class="pot pot--clay" d="M41 92H79L74 126H46Z"/>`
  };
  const art = (p, cls = '') =>
    `<svg class="plant ${cls}" viewBox="0 0 120 130" aria-hidden="true" focusable="false">${ART[p.id] || ART.generic}</svg>`;

  /* ---------- state ---------- */

  let uid = 0;
  const kindOf = (what) => {
    if (/water|mist/i.test(what)) return 'water';
    if (/rotat|wip|repot|fed|feed|fertil|prun|trim|soil check|check/i.test(what)) return 'care';
    return 'note';
  };
  const KIND_LABEL = { water: 'Water', care: 'Care', note: 'Noticed' };
  const KIND_ICON = { water: 'drop', care: 'turn', note: 'eye' };

  const parseEntry = (line) => {
    const [when, ...rest] = String(line).split(' · ');
    const what = rest.join(' · ') || when;
    return { key: ++uid, when: rest.length ? when : '', what, kind: kindOf(what), mine: false };
  };

  const groupOf = (p) => (/overdue/i.test(p.due) ? 'overdue' : /today/i.test(p.due) ? 'today' : 'later');

  function freshState() {
    return {
      plants: DATA.plants.map((p, i) => ({
        ...p,
        history: p.history.map(parseEntry),
        group: groupOf(p),
        tint: TINTS[i % TINTS.length],
        status: 'queue', // 'queue' | 'done' | 'snoozed'
        doneEntry: null,
        wateredExtra: null
      })),
      open: null, // id of the plant whose details are showing
      fresh: null // id of the plant just handled, for a one-off flourish
    };
  }

  let state = freshState();
  const byId = (id) => state.plants.find((p) => p.id === id);
  const inQueue = () => state.plants.filter((p) => p.status === 'queue').sort((a, b) => b.urgency - a.urgency);
  const dueToday = () => state.plants.filter((p) => p.group !== 'later');
  const openId = () => {
    if (!desktop.matches) return state.open;
    if (state.open && byId(state.open)) return state.open;
    const first = inQueue()[0] || state.plants[0];
    return first ? first.id : null;
  };

  /* ---------- rendering: pieces ---------- */

  function badge(p) {
    if (p.status === 'done') return `<span class="badge badge--done">${icon('check')}${esc(cap(taskOf(p).past))} today</span>`;
    if (p.status === 'snoozed') return `<span class="badge badge--snoozed">${icon('moon')}Snoozed to tomorrow</span>`;
    if (p.group === 'overdue') return `<span class="badge badge--overdue">${icon('clock')}${esc(cap(p.due))}</span>`;
    if (p.group === 'today') return `<span class="badge badge--today">Due today</span>`;
    return `<span class="badge badge--later">Due ${esc(p.due.toLowerCase())}</span>`;
  }

  function actionButtons(p, where) {
    const t = taskOf(p);
    const fk = (a) => `${a}:${p.id}${where === 'pane' ? ':pane' : ''}`;
    if (p.status !== 'queue') {
      return `<button type="button" class="btn" data-action="restore" data-id="${esc(p.id)}" data-fk="${fk('restore')}">${icon('back')}Put back<span class="vh"> ${esc(p.name)} in today’s queue</span></button>`;
    }
    const done = `<button type="button" class="btn btn--primary" data-action="done" data-id="${esc(p.id)}" data-fk="${fk('done')}">${icon(t.icon)}${esc(t.button)}<span class="vh">: ${esc(p.name)}</span></button>`;
    // Snoozing only makes sense for something that is actually due.
    const snooze = p.group === 'later' ? '' :
      `<button type="button" class="btn" data-action="snooze" data-id="${esc(p.id)}" data-fk="${fk('snooze')}">${icon('moon')}Snooze<span class="vh"> ${esc(p.name)} until tomorrow</span></button>`;
    return done + snooze;
  }

  function detailsToggle(p) {
    const open = openId() === p.id;
    return `<button type="button" class="btn btn--quiet toggle" data-action="toggle" data-id="${esc(p.id)}" data-fk="toggle:${esc(p.id)}"
      aria-expanded="${open}" aria-controls="${desktop.matches ? 'detail-pane' : 'detail-' + esc(p.id)}"><span class="toggle__long">Light, water &amp; history</span><span class="toggle__short">Details</span><span class="vh"> for ${esc(p.name)}</span>${icon('chevron', 'toggle__chev')}</button>`;
  }

  function lightMeter(p) {
    const level = /bright|high|full/i.test(p.light) ? 3 : /medium|moderate|partial/i.test(p.light) ? 2 : 1;
    return `<span class="meter" aria-hidden="true">${[1, 2, 3].map((n) => `<i class="${n <= level ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  function detailBody(p, level) {
    const lastWater = p.history.find((e) => /watered/i.test(e.what));
    const isWaterTask = p.task.toLowerCase() === 'water';
    const logged = !!p.wateredExtra;
    const waterToggle = isWaterTask ? '' :
      `<button type="button" class="chip-btn" data-action="log-water" data-id="${esc(p.id)}" data-fk="water:${esc(p.id)}" aria-pressed="${logged}">${icon(logged ? 'check' : 'drop')}Watered today<span class="vh">: ${esc(p.name)}</span></button>`;
    return `
      <dl class="facts">
        <div class="fact fact--light">
          <dt>${icon('sun')}Light</dt>
          <dd><span class="fact__value">${esc(p.light)}</span>${lightMeter(p)}<span class="fact__sub">${esc(p.location)}</span></dd>
        </div>
        <div class="fact fact--water">
          <dt>${icon('drop')}Water</dt>
          <dd><span class="fact__value">${lastWater ? `Last watered ${esc(lastWater.when ? lastWater.when.toLowerCase() === 'today' ? 'today' : lastWater.when : 'recently')}` : 'No watering logged yet'}</span>${waterToggle}</dd>
        </div>
      </dl>
      <h${level} class="detail__heading" id="hist-${esc(p.id)}">History and observations</h${level}>
      <ol class="timeline" aria-labelledby="hist-${esc(p.id)}">
        ${p.history.map((e) => `
          <li class="tl tl--${e.kind}${e.when === 'Today' ? ' tl--new' : ''}">
            <span class="tl__icon">${icon(KIND_ICON[e.kind])}</span>
            <span class="tl__what">${esc(e.what)}</span>
            <span class="tl__meta"><span class="tl__kind">${KIND_LABEL[e.kind]}</span> · ${esc(e.when || 'Undated')}</span>
            ${e.mine ? `<button type="button" class="icon-btn" data-action="remove-note" data-id="${esc(p.id)}" data-key="${e.key}" data-fk="rm:${e.key}">${icon('close')}<span class="vh">Remove observation “${esc(e.what)}”</span></button>` : ''}
          </li>`).join('')}
      </ol>
      <form class="note" data-form="note" data-id="${esc(p.id)}" autocomplete="off">
        <label for="note-${esc(p.id)}">Noticed something about ${esc(p.name)}?</label>
        <div class="note__row">
          <input id="note-${esc(p.id)}" name="note" type="text" maxlength="60" placeholder="New leaf, odd spot, a lean…" data-fk="note:${esc(p.id)}">
          <button type="submit" class="btn btn--small">Add<span class="vh"> observation</span></button>
        </div>
      </form>`;
  }

  function card(p, variant) {
    const t = taskOf(p);
    const open = openId() === p.id;
    const inline = open && !desktop.matches;
    const thirsty = p.status === 'queue' && p.group === 'overdue';
    const title = p.status === 'queue' ? t.ask(p.name) : p.name;
    const sub = p.status === 'done' ? `${cap(t.past)} today` : p.status === 'snoozed' ? `${p.task} · back tomorrow` : `${p.species} · ${p.location}`;
    const fresh = state.fresh === p.id ? ' is-fresh' : '';
    return `
      <li class="card card--${variant} tint-${p.tint}${open ? ' is-open' : ''}${fresh}" data-card="${esc(p.id)}" style="view-transition-name: card-${esc(p.id)}">
        <div class="card__main">
          <div class="stage${thirsty ? ' is-thirsty' : ''}">${art(p)}${fresh && p.status === 'done' ? '<i class="splash" aria-hidden="true"></i>' : ''}</div>
          <div class="card__text">
            ${variant === 'row' || variant === 'tray' ? '' : `<p class="card__badge">${badge(p)}</p>`}
            <h4 class="card__title">${esc(title)}</h4>
            <p class="card__meta">${esc(sub)}</p>
            ${variant === 'hero' && MOODS[p.id] ? `<p class="card__mood">${esc(MOODS[p.id])}</p>` : ''}
          </div>
        </div>
        <div class="card__actions">${actionButtons(p, 'card')}${detailsToggle(p)}</div>
        ${inline ? `<div class="card__detail" id="detail-${esc(p.id)}" role="group" aria-label="${esc(p.name)} details">
          ${variant !== 'hero' && MOODS[p.id] ? `<p class="card__mood">${esc(MOODS[p.id])}</p>` : ''}${detailBody(p, 5)}</div>` : ''}
      </li>`;
  }

  /* ---------- rendering: regions ---------- */

  function renderGreeting() {
    const due = dueToday();
    const left = due.filter((p) => p.status === 'queue');
    const overdue = left.filter((p) => p.group === 'overdue');
    const done = due.filter((p) => p.status === 'done').length;
    const snoozed = due.filter((p) => p.status === 'snoozed').length;
    let line;
    if (overdue.length) {
      const rest = left.length - overdue.length;
      line = `${listNames(overdue.map((p) => p.name))} first${rest ? `, then ${word(rest)} more.` : '.'}`;
    } else if (left.length) {
      line = `${cap(word(left.length))} small ${plural(left.length, 'job')} left today.`;
    } else if (done) {
      line = snoozed ? 'Nothing more today. The rest can wait.' : 'That’s everyone. Go be a person.';
    } else {
      line = 'Today has been postponed.';
    }
    const bits = [DAYS[TODAY], `${done} of ${due.length - snoozed} done`];
    if (snoozed) bits.push(`${snoozed} snoozed`);
    $('#greeting').innerHTML = `
      <h1 class="headline">${esc(line)}</h1>
      <p class="tally">${bits.map(esc).join(' <span aria-hidden="true">·</span> ')}</p>`;
  }

  function allDone() {
    const due = dueToday();
    const done = due.filter((p) => p.status === 'done');
    const snoozed = due.filter((p) => p.status === 'snoozed');
    const hasTomorrow = TODAY + 1 < DATA.week.length;
    const early = state.plants.filter((p) => p.group === 'later' && p.status === 'done');
    const ahead = state.plants.filter((p) => p.group === 'later' && p.status === 'queue');
    const tomorrowJobs = hasTomorrow ? DATA.week[TODAY + 1] + snoozed.length - early.length : 0;

    const rows = [];
    if (done.length) {
      rows.push(`<li>${icon('check')}<span><strong>Done today:</strong> ${esc(listNames(done.map((p) => `${p.name} (${taskOf(p).past})`)))}.</span></li>`);
    }
    snoozed.forEach((p) => {
      const n = (p.due.match(/\d+/) || [])[0];
      const nag = p.group === 'overdue' && n ? ` That will make it ${Number(n) + 1} days overdue, so start there.` : '';
      rows.push(`<li>${icon('moon')}<span><strong>Back tomorrow:</strong> ${esc(taskOf(p).ask(p.name).toLowerCase().replace(p.name.toLowerCase(), p.name))}.${esc(nag)}</span>
        <button type="button" class="btn btn--small" data-action="restore" data-id="${esc(p.id)}" data-fk="restore:${esc(p.id)}:next">Do it now<span class="vh">: ${esc(p.name)}</span></button></li>`);
    });
    if (hasTomorrow) {
      rows.push(`<li>${icon('clock')}<span><strong>Tomorrow:</strong> ${tomorrowJobs > 0 ? `${word(tomorrowJobs)} ${plural(tomorrowJobs, 'job')} waiting` : 'nothing waiting'}${ahead.length ? `, starting with ${esc(listNames(ahead.map((p) => p.name)))}. Get ahead below if you like` : ''}.</span></li>`);
      const rest = DATA.week.slice(TODAY + 1).map((n, i) => ({ n: n + (i === 0 ? snoozed.length - early.length : 0), day: DAYS[TODAY + 1 + i] }));
      const busiest = rest.reduce((a, b) => (b.n > a.n ? b : a), rest[0]);
      // Tomorrow already has its own line; only flag a busier day further out.
      if (busiest && busiest.n > 1 && busiest.day !== DAYS[TODAY + 1]) {
        rows.push(`<li>${icon('sun')}<span><strong>Heads up:</strong> ${esc(busiest.day)} is the busy one this week, with ${word(busiest.n)} jobs.</span></li>`);
      }
    }

    const title = !done.length ? 'Nothing left for today.' : snoozed.length ? 'That’s today sorted.' : 'Everyone’s looked after.';
    const lede = done.length
      ? `${cap(word(done.length))} ${plural(done.length, 'plant')} cared for${snoozed.length ? `, ${word(snoozed.length)} snoozed` : ''}. The watering can may rest.`
      : `All ${word(snoozed.length)} of today’s jobs moved to tomorrow. No judgement, but the plants did notice.`;

    return `
      <div class="alldone" id="alldone" tabindex="-1" data-fk="alldone" role="group" aria-labelledby="alldone-title">
        <div class="sill" aria-hidden="true">
          <i class="sill__sun"></i>
          <div class="sill__row">${state.plants.map((p) => art(p, p.status === 'snoozed' ? 'is-waiting' : 'is-happy')).join('')}</div>
          <i class="sill__shelf"></i>
        </div>
        <h3 class="alldone__title" id="alldone-title">${esc(title)}</h3>
        <p class="alldone__lede">${esc(lede)}</p>
        <ul class="next">${rows.join('')}</ul>
      </div>`;
  }

  function renderQueue() {
    const q = inQueue();
    const overdue = q.filter((p) => p.group === 'overdue');
    const today = q.filter((p) => p.group === 'today');
    const later = q.filter((p) => p.group === 'later');
    const parts = [];

    if (overdue.length) {
      parts.push(`<section class="group group--overdue" aria-labelledby="g-overdue">
        <h3 class="group__title" id="g-overdue"><span class="group__flag">Overdue</span> Start here</h3>
        <ol class="cards">${overdue.map((p) => card(p, 'hero')).join('')}</ol></section>`);
    }
    if (today.length) {
      parts.push(`<section class="group" aria-labelledby="g-today">
        <h3 class="group__title" id="g-today">Due today <span class="group__count">${today.length}</span></h3>
        <ol class="cards">${today.map((p) => card(p, 'row')).join('')}</ol></section>`);
    }
    if (!overdue.length && !today.length) parts.push(allDone());
    if (later.length) {
      parts.push(`<section class="group group--later" aria-labelledby="g-later">
        <h3 class="group__title" id="g-later">Tomorrow, if you’re feeling keen</h3>
        <ol class="cards">${later.map((p) => card(p, 'later')).join('')}</ol></section>`);
    }
    $('#queue-body').innerHTML = parts.join('');
  }

  function renderPane() {
    const pane = $('#detail-pane');
    const p = desktop.matches ? byId(openId()) : null;
    if (!p) { pane.hidden = true; pane.innerHTML = ''; return; }
    const thirsty = p.status === 'queue' && p.group === 'overdue';
    pane.hidden = false;
    pane.innerHTML = `
      <article class="sheet tint-${p.tint}">
        <div class="sheet__stage stage${thirsty ? ' is-thirsty' : ''}">${art(p)}<i class="sheet__shelf" aria-hidden="true"></i></div>
        <div class="sheet__head">
          <p class="card__badge">${badge(p)}</p>
          <h2 class="sheet__name" id="pane-name" tabindex="-1" data-fk="pane-name">${esc(p.name)}</h2>
          <p class="card__meta">${esc(p.species)} · ${esc(p.location)}</p>
          ${MOODS[p.id] ? `<p class="card__mood">${esc(MOODS[p.id])}</p>` : ''}
        </div>
        <div class="card__actions sheet__actions">${actionButtons(p, 'pane')}</div>
        ${detailBody(p, 3)}
      </article>`;
  }

  function weekModel() {
    const due = dueToday();
    const snoozed = due.filter((p) => p.status === 'snoozed').length;
    const done = due.filter((p) => p.status === 'done').length;
    const early = state.plants.filter((p) => p.group === 'later' && p.status === 'done').length;
    return DATA.week.map((n, i) => {
      const day = DAYS[i];
      if (i < TODAY) return { day, when: 'past', pebbles: Array(n).fill('done'), text: `${day}: ${n} ${plural(n, 'job')}, done.` };
      if (i === TODAY) {
        const total = Math.max(n, due.length) - snoozed;
        const d = Math.min(done, total);
        return { day, when: 'today', pebbles: [...Array(d).fill('done'), ...Array(total - d).fill('todo')],
          text: `${day}, today: ${d} of ${total} done${snoozed ? `, ${snoozed} snoozed to tomorrow` : ''}.` };
      }
      if (i === TODAY + 1) {
        const d = Math.min(early, n);
        return { day, when: 'future', pebbles: [...Array(d).fill('done'), ...Array(n - d).fill('todo'), ...Array(snoozed).fill('moved')],
          text: `${day}: ${n} ${plural(n, 'job')}${d ? `, ${d} done early` : ''}${snoozed ? `, plus ${snoozed} snoozed from today` : ''}.` };
      }
      return { day, when: 'future', pebbles: Array(n).fill('todo'), text: `${day}: ${n} ${plural(n, 'job')}.` };
    });
  }

  function renderRhythm() {
    const days = weekModel();
    const snoozed = dueToday().filter((p) => p.status === 'snoozed').length;
    const ahead = days.slice(TODAY + 1);
    const busiest = ahead.reduce((a, b) => (b.pebbles.length > a.pebbles.length ? b : a), ahead[0]);
    let note = '';
    if (snoozed && days[TODAY + 1]) note = `Tomorrow just grew to ${word(days[TODAY + 1].pebbles.length)} ${plural(days[TODAY + 1].pebbles.length, 'job')}.`;
    else if (busiest) note = `${busiest.day} is the big one: ${word(busiest.pebbles.length)} ${plural(busiest.pebbles.length, 'job')}.`;
    const total = DATA.week.reduce((a, b) => a + b, 0);
    const pop = state.fresh && byId(state.fresh) && byId(state.fresh).status === 'done';

    $('#rhythm').innerHTML = `
      <div class="rhythm__head">
        <h2 class="section-title" id="rhythm-title">This week’s rhythm</h2>
        <p class="rhythm__total"><strong>${total}</strong> jobs</p>
      </div>
      <p class="rhythm__note">${esc(note)}</p>
      <ol class="week" aria-label="Care jobs for each day, Monday to Sunday">
        ${days.map((d) => {
          const lastDone = d.pebbles.lastIndexOf('done');
          return `
          <li class="day day--${d.when}">
            <span class="day__stack" aria-hidden="true">${d.pebbles.map((s, j) => `<i class="peb peb--${s}${pop && d.when !== 'past' && j === lastDone ? ' peb--pop' : ''}"></i>`).join('')}</span>
            <span class="day__label" aria-hidden="true">${d.when === 'today' ? 'Today' : d.day.slice(0, 3)}</span>
            <span class="vh">${esc(d.text)}</span>
          </li>`;
        }).join('')}
      </ol>
      <ul class="legend" aria-label="Key">
        <li><i class="peb peb--done" aria-hidden="true"></i>Done</li>
        <li><i class="peb peb--todo" aria-hidden="true"></i>To do</li>
        <li><i class="peb peb--moved" aria-hidden="true"></i>Snoozed in</li>
      </ul>`;
  }

  function renderTray() {
    const done = state.plants.filter((p) => p.status === 'done');
    const snoozed = state.plants.filter((p) => p.status === 'snoozed');
    const tray = $('#tray');
    if (!done.length && !snoozed.length) {
      tray.innerHTML = `
        <h2 class="section-title" id="tray-title">Handled</h2>
        <p class="tray__empty">Nothing yet. Finished and snoozed plants rest here, and can be put back any time.</p>`;
      return;
    }
    tray.innerHTML = `
      <h2 class="section-title" id="tray-title">Handled</h2>
      ${done.length ? `<h3 class="tray__label" id="t-done">Done today</h3>
        <ul class="cards cards--tray" aria-labelledby="t-done">${done.map((p) => card(p, 'tray')).join('')}</ul>` : ''}
      ${snoozed.length ? `<h3 class="tray__label" id="t-snz">Snoozed until tomorrow</h3>
        <ul class="cards cards--tray" aria-labelledby="t-snz">${snoozed.map((p) => card(p, 'tray')).join('')}</ul>` : ''}`;
  }

  function render() {
    renderGreeting();
    renderQueue();
    renderPane();
    renderRhythm();
    renderTray();
  }

  /* ---------- focus + announcements ---------- */

  const focusKey = (key) => {
    const el = key && document.querySelector(`[data-fk="${CSS.escape(key)}"]`);
    if (el) el.focus({ preventScroll: false });
    return !!el;
  };
  const focusFirst = (...keys) => keys.some(focusKey);

  const live = $('#live');
  let liveTimer = 0;
  function announce(msg) {
    // Clear first so repeating the same sentence is still announced.
    live.textContent = '';
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = msg; }, 60);
  }

  /* Re-render, then put focus somewhere sensible. `keys` is a list of
   * candidates; when omitted the previously focused control is kept. */
  function commit(keys) {
    const active = document.activeElement;
    const keep = active && active.dataset ? active.dataset.fk : null;
    const apply = () => {
      render();
      if (keys) focusFirst(...keys);
      else if (keep) focusKey(keep);
    };
    if (document.startViewTransition && !reducedMotion.matches) {
      // A skipped transition (e.g. two quick actions) rejects `ready`; the DOM update still runs.
      document.startViewTransition(apply).ready.catch(() => {});
    } else {
      apply();
    }
  }

  /* ---------- toast with undo ---------- */

  const toastEl = $('#toast');
  let toast = null; // { msg, undo, timer }

  function showToast(msg, undo) {
    hideToast();
    toast = { msg, undo, timer: 0 };
    toastEl.innerHTML = `
      <p class="toast__msg">${esc(msg)}</p>
      <button type="button" class="toast__undo" data-action="undo" data-fk="undo">${icon('undo')}Undo</button>
      <button type="button" class="toast__close" data-action="dismiss" data-fk="dismiss">${icon('close')}<span class="vh">Dismiss</span></button>
      <i class="toast__timer" aria-hidden="true"></i>`;
    toastEl.hidden = false;
    armToast();
  }
  function armToast() {
    if (!toast) return;
    clearTimeout(toast.timer);
    toastEl.classList.remove('is-held');
    // Restart the shrinking bar.
    const bar = $('.toast__timer', toastEl);
    if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
    toast.timer = setTimeout(hideToast, TOAST_MS);
  }
  function holdToast() {
    if (!toast) return;
    clearTimeout(toast.timer);
    toastEl.classList.add('is-held');
  }
  function hideToast() {
    if (!toast) return;
    clearTimeout(toast.timer);
    const hadFocus = toastEl.contains(document.activeElement);
    toast = null;
    toastEl.hidden = true;
    toastEl.innerHTML = '';
    if (hadFocus) focusFirst('alldone') || $('#queue').focus();
  }
  toastEl.addEventListener('pointerenter', holdToast);
  toastEl.addEventListener('pointerleave', () => { if (!toastEl.contains(document.activeElement)) armToast(); });
  toastEl.addEventListener('focusin', holdToast);
  toastEl.addEventListener('focusout', (e) => { if (!toastEl.contains(e.relatedTarget)) armToast(); });

  /* ---------- actions ---------- */

  /* Where focus should land once a plant leaves the queue: the next plant
   * still waiting, else the previous one, else the all-done panel. */
  function nextAfter(id) {
    const q = inQueue();
    const i = q.findIndex((p) => p.id === id);
    const isDue = (x) => x.group !== 'later';
    const next = q.slice(i + 1).find(isDue) || q.slice(0, i).find(isDue) || q[i + 1] || q[i - 1];
    return next ? next.id : null;
  }

  function leaveQueue(p, status) {
    const t = taskOf(p);
    const nextId = nextAfter(p.id);
    const prevOpen = state.open;
    let entry = null;
    if (status === 'done') {
      entry = { key: ++uid, when: 'Today', what: t.log, kind: kindOf(t.log), mine: false };
      p.history.unshift(entry);
      p.doneEntry = entry;
    }
    p.status = status;
    state.fresh = p.id;
    // Details follow the work: on desktop the pane moves to the next plant.
    if (desktop.matches) state.open = nextId || p.id;
    else if (state.open === p.id) state.open = null;

    let msg;
    if (status === 'done') msg = t.said(p.name);
    else {
      const n = (p.due.match(/\d+/) || [])[0];
      msg = `${p.name} snoozed until tomorrow.` + (p.group === 'overdue' && n ? ` That makes ${Number(n) + 1} days overdue.` : '');
    }
    const undo = () => {
      putBack(p);
      state.open = prevOpen;
      state.fresh = null;
      announce(`Undone. ${p.name} is back in today’s queue.`);
      commit([`done:${p.id}`]);
    };
    showToast(msg, undo);
    const stillDue = dueToday().some((x) => x.status === 'queue');
    announce(`${msg} ${stillDue ? '' : 'Nothing else is due today. '}Undo is available for a few seconds; Control or Command Z also works.`);
    commit(nextId && stillDue ? [`done:${nextId}`, `toggle:${nextId}`] : ['alldone', nextId ? `done:${nextId}` : 'reset']);
  }

  function putBack(p) {
    if (p.doneEntry) {
      p.history = p.history.filter((e) => e !== p.doneEntry);
      p.doneEntry = null;
    }
    p.status = 'queue';
  }

  const actions = {
    done: (p) => leaveQueue(p, 'done'),
    snooze: (p) => leaveQueue(p, 'snoozed'),

    restore(p) {
      putBack(p);
      state.fresh = null;
      if (desktop.matches) state.open = p.id;
      hideToast();
      announce(`${p.name} is back in today’s queue.`);
      commit([`done:${p.id}`]);
    },

    toggle(p) {
      if (desktop.matches) {
        state.open = p.id;
        announce(`Showing details for ${p.name}.`);
      } else {
        state.open = state.open === p.id ? null : p.id;
      }
      state.fresh = null;
      commit([`toggle:${p.id}`]);
    },

    'log-water'(p) {
      if (p.wateredExtra) {
        p.history = p.history.filter((e) => e !== p.wateredExtra);
        p.wateredExtra = null;
        announce(`Removed today’s watering for ${p.name}.`);
      } else {
        p.wateredExtra = { key: ++uid, when: 'Today', what: 'Watered', kind: 'water', mine: false };
        p.history.unshift(p.wateredExtra);
        announce(`Logged a watering for ${p.name} today.`);
      }
      state.fresh = null;
      commit([`water:${p.id}`]);
    },

    'remove-note'(p, el) {
      const key = Number(el.dataset.key);
      p.history = p.history.filter((e) => e.key !== key);
      state.fresh = null;
      announce('Observation removed.');
      commit([`note:${p.id}`]);
    },

    undo() {
      if (!toast) return;
      const { undo } = toast;
      hideToast();
      undo();
    },

    dismiss: () => hideToast(),

    reset() {
      hideToast();
      state = freshState();
      announce('Started the day over. All four plants are back in the queue.');
      commit(['reset']);
    }
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el) {
      const p = el.dataset.id ? byId(el.dataset.id) : null;
      if (el.dataset.id && !p) return;
      actions[el.dataset.action](p, el);
      return;
    }
    // Pointer convenience on wide screens: clicking a card's body shows it in the pane.
    // The Details button remains the real, keyboard-reachable control.
    const cardEl = e.target.closest('[data-card]');
    if (cardEl && desktop.matches && !e.target.closest('button, input, a, label, .card__detail')) {
      const p = byId(cardEl.dataset.card);
      if (p && openId() !== p.id) { state.open = p.id; state.fresh = null; commit(); }
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form="note"]');
    if (!form) return;
    e.preventDefault();
    const p = byId(form.dataset.id);
    const text = form.elements.note.value.trim().replace(/\s+/g, ' ');
    if (!p) return;
    if (!text) { form.elements.note.focus(); return; }
    p.history.unshift({ key: ++uid, when: 'Today', what: text, kind: 'note', mine: true });
    state.fresh = null;
    announce(`Observation added for ${p.name}: ${text}.`);
    commit([`note:${p.id}`]);
  });

  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches && e.target.matches('input, textarea');
    // Ctrl/Cmd+Z undoes the last care action while the toast is up.
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z' && toast && !typing) {
      e.preventDefault();
      actions.undo();
      return;
    }
    if (e.key === 'Escape') {
      const detail = e.target.closest && e.target.closest('.card__detail');
      if (detail && !desktop.matches && state.open) {
        const id = state.open;
        state.open = null;
        commit([`toggle:${id}`]);
      } else if (toast) {
        hideToast();
      }
    }
  });

  desktop.addEventListener('change', () => { state.fresh = null; render(); });

  render();
})();
