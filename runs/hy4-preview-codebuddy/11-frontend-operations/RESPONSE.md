# Relay — operations control room

Built with local HTML, CSS, and vanilla JS only. No frameworks, installs, fonts,
remote assets, or network calls. Files: `index.html`, `styles.css`, `app.js`, plus
this note. Content is seeded from `DATA.json`.

## Visual hierarchy

Three tiers, so an operator can answer "is anything wrong, what is it, what do I do"
in that order:

1. **Status (top bar + rail).** The rail is the constant frame (product mark, five
   destinations, current on-call). The top bar carries the single global verdict —
   a status pill that recomputes from incident state (`Degraded · 1 critical` →
   `Attention · 1 high` → `All clear · 2 active`) — plus UTC clock, search, and range.
2. **Scanning (metrics + throughput).** Four metrics at equal weight: label, big
   tabular number, delta chip, sparkline, and a `vs previous 24 h` baseline. Below,
   the 24-hour throughput chart occupies full width because it is the only element
   that needs horizontal room to be legible.
3. **Acting (incidents + detail).** The incident table is the largest surface and
   sits beside a persistent detail panel, so triage never loses context.

Palette: neutral slate foundation (`#0b0e13` → `#1b232e`), one accent (teal
`#2dd4bf`) reserved for selection, primary action, and the peak bar. Severity and
status use a small functional set (red / amber / yellow / slate, plus green and blue
status dots) and are always paired with a text label, never colour alone. Every
number uses `font-variant-numeric: tabular-nums` and a mono stack so columns align
and ages don't jitter as they tick. Spacing is 4/8/12 px, radius is 4–6 px, and
there is no glass, gradient, or oversized type.

Chart: inline SVG (semantic-ish, scales with its container) with gridlines, y ticks,
hourly bars, a dashed mean line, the peak bar picked out in accent, a hover tooltip,
and an `aria-label` summary. The viewBox is re-rendered to the container's pixel
width on resize so labels stay crisp instead of stretching.

## Interaction behaviour

- **Filters** — search (id, title, service, owner, severity, status), severity,
  service, status, and an "Unassigned only" toggle. They compose; results and the
  count line update live, and `Clear` (or the button inside the empty state) resets
  everything.
- **Sorting** — severity and age headers. First click shows the most actionable
  order (worst severity first, oldest first); clicking again reverses.
- **Selection** — clicking a row (or Enter/Space on a focused row) loads the detail
  panel: metadata, three impact signals with proportional bars, a newest-first
  timeline, and the actions. Selection is dropped if filters hide the row, which
  puts the panel into its own empty state rather than showing stale data.
- **Acknowledge** — the working action. It sets status to `acknowledged`, claims the
  incident if the owner is `Unassigned`, prepends a timeline entry, updates the row
  badge, the status pill, and the rail count, and confirms via toast. It is
  reachable three ways: the row `Ack` button, the primary button in the panel, or
  the `A` key. Once acknowledged the control becomes a disabled `Acknowledged`
  button — idempotent, no dead click. `Assign to me` is a separate, smaller
  ownership action so acknowledging doesn't silently imply ownership.
- **Ages tick** every minute (seeded age + elapsed wall clock) and the clock updates
  every 20 s, so the room feels live without noisy animation.

## Keyboard

`/` focuses search from anywhere. Inside the grid: `↑/↓` or `j/k` move, `Home/End`
jump, `Enter` opens, `A` acknowledges. Focus follows re-renders — after
acknowledging, the focused row (or the detail panel, if that's where the action was
invoked) keeps focus instead of dropping to the body.

## Accessibility

- Landmarks (`nav`, `header`, `main`, `aside`), one `h1`, and a skip link.
- The table is a `role="grid"` with `aria-selected` rows and a single tabbable row
  (roving tabindex), so arrow keys work as expected and Tab doesn't walk 4 rows.
- Sortable headers expose `aria-sort`; the chip exposes `aria-pressed`; icon-only
  controls have `sr-only` labels; decorative icons are `aria-hidden`.
- Two polite live regions: the result count and the toast status region. Changes
  caused by an action are announced without hijacking focus.
- Delta chips spell out "increased/decreased" for screen readers; the chart carries
  a text alternative with mean, peak hour, and low.
- Visible `:focus-visible` ring on every interactive element, including rows and the
  chart tooltip trigger states; `prefers-reduced-motion` disables animation.

## Responsive

≤980 px the detail panel stacks under the table and metrics go 2-up. ≤860 px the
rail becomes an icon-only horizontal bar and the top bar wraps. ≤700 px the table is
rebuilt as stacked cards (labels via `data-label` pseudo-elements) with the ack
button per card. Verified at 390 px: `scrollWidth === clientWidth`, no element
extends past the viewport, chart re-renders to ~330 px, and nothing needs horizontal
page scrolling.

## Data

`app.js` fetches `DATA.json` when served over http(s) and falls back to an identical
embedded seed when opened directly from disk (`file://`), which blocks fetch. The
seed is kept byte-identical in content to `DATA.json`. Timeline entries and impact
signals are derived deterministically from the incident id, service, and status, so
the panel is never empty and never invents contradictions (e.g. an unassigned
incident shows a routing-not-claimed entry).

## Verification

Headless-Chrome smoke pass: 4 metric cards with sparklines, 24 bars with one peak,
sorting and all five filters, the empty state, acknowledge from row / panel /
keyboard, assign-to-me, focus restoration, tooltip, `/` shortcut, and a 390 px
layout check with zero horizontal overflow.
