
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
