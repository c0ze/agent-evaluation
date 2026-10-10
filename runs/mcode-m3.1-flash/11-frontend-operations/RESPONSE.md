# Relay — operations control room

A single-page operations dashboard built from `index.html`, `styles.css` and `app.js`.
No frameworks, no package installs, no external fonts, no remote assets and no network
requests of any kind. Open `index.html` directly from disk and it runs.

Seed content is taken verbatim from `DATA.json` (4 metrics, 24 hourly throughput values,
4 incidents). Those values are **inlined** at the top of `app.js` because `fetch()` of a
local file is blocked by CORS under `file://`; `DATA.json` remains the single source of
truth for review. Everything else on the page — impact statements, runbook steps, the
activity log, the sparkline series, and the "peak budget" annotation — is authored demo
content, marked as such in a code comment.

---

## 1. Information hierarchy

The page answers four operator questions in the order they get asked, top to bottom:

| Band | Question | Element |
| --- | --- | --- |
| Rail + top bar | *Where am I, is anything broken?* | Nav rail, environment pill, live clock, degraded status |
| Metrics | *Is the system healthy right now, and which way is it moving?* | 4 summary cards |
| Split row | *What is happening over time? Which incident is it?* | 24 h throughput chart + incident detail |
| Table | *What do I have to work through?* | Filterable incident queue |

**Three levels of emphasis, no more.** Panel titles are 12.5 px semibold; metric values
are 22 px and mono; body text is 12.5 px. There is no heading above 22 px anywhere — a
giant "Operations" headline would waste the vertical budget that an operator spends
scanning incident rows, so the page title stays at 14 px.

**Density over decoration.** A 4 px spacing scale, 1 px borders, 3–4 px radii, and a
sticky table header. Colour is reserved for meaning; panels are separated by surface tone
(`#0d0f13` page, `#14181e` panel, `#1a1f26` raised) rather than by shadows.

**One accent, used once each.** `--accent` (`#5b9bff`) marks exactly four things: the
active nav item, primary actions, selection (selected row, chart line), and the monitoring
status. It is never used decoratively.

**Severity and status are two different visual languages**, because they are two different
axes and overloading colour would collapse them:

- **Severity** = a 3 px vertical rail + label, coloured by `--sev-*`. Reads at a glance
  down a column without relying on the text.
- **Status** = a rounded outlined pill with a dot. Neutral grey (open), amber
  (investigating), blue (monitoring), green (acknowledged).

The same hue can appear in both systems without confusion because the shape differs, and
both always carry a text label — colour is never the only channel.

**Numbers align.** Every metric value, incident age, ID, service name, and chart tick uses
the mono stack with `font-variant-numeric: tabular-nums`, so digits occupy identical
widths and columns line up down the table. Age is right-aligned; the `.meta-val--num`
class applies the same treatment in the detail panel.

---

## 2. Interaction behaviour

**Incident selection.** Clicking a row — or activating the incident-ID button inside it —
swaps the detail panel and marks the row with `aria-current` plus a left accent bar. On
screens narrower than 1180 px the detail panel sits below the chart, so selecting a row
scrolls it into view. The selected incident is the one opened on load (`INC-2841`, the
critical one), so the panel is never empty on arrival.

**Filtering** is cumulative across five controls: free-text search (debounced 90 ms,
matching ID, title, service, owner and status), four severity checkboxes, and status,
service and sort selects. The sort is a select rather than clickable column headers
because it stays usable on the stacked mobile layout. Every filter change re-renders the
table, the result count, the rail badge and the detail panel.

**Filter and empty states.** Whenever any filter is active, a blue summary bar appears
reading "Showing *N* of 4 incidents · severity low, status investigating" with a *Clear
filters* button, so the current query is never implicit. When nothing matches, the table
is replaced by an empty state that **names the filters that caused it** ("Nothing matches
severity low, status investigating. Clear the filters to see all 4 incidents.") rather
than a generic "No results". A second empty state covers the genuinely-no-incidents case
("Nothing is currently paged"). The count line is a `role="status"` region, so result
changes are announced.

**Acknowledge** is the primary action in the detail panel. It is a real state change, not
a toast-and-forget: status becomes *Acknowledged* in the detail panel **and** in the table
row, the button becomes a disabled confirmation with a timestamp ("✓ Acknowledged
19:01:48") instead of disappearing, ownership transfers to the signed-in operator, the
activity log gains two timestamped entries, the rail badge decrements, and the top-bar
summary recount. A toast offers **Undo**, which restores the previous status *and* the
previous owner, removes the log entries, and re-increments the badge. The undo window is
7 s; the toast auto-dismisses after 3 s when there is nothing to undo.

Supporting actions: *Assign to me* (disabled once you already own it) and *Runbook*, a
disclosure that expands numbered steps and keeps the section label hidden when collapsed
so no dangling heading is left behind.

**Chart.** 6 h / 12 h / 24 h segmented control re-slices the real series; the y-axis is
pinned to 0–100k so the ranges stay comparable. Pointer movement scrubs a crosshair and
updates a monospace readout. A dashed "peak budget 80k" reference line and a dot on the
observed peak give the line a reference without needing a second axis. The SVG scales
with the container (fixed `viewBox`), so no resize handler is needed.

**Clock and times** are formatted in `Asia/Tokyo` to match the "JST" label, rather than
silently following the viewer's machine timezone. All seeded times are derived from each
incident's age, so the log stays plausible as the page sits open.

**Keyboard.** `/` focuses search; `Escape` clears the search field or drops the chart
cursor; `↑`/`↓` move between incident rows once focus is inside the table; `Tab` order
follows the visual order (skip link → rail → search → chart → filters → rows).

**Motion** is limited to a 150 ms background transition and the toast entrance, and all of
it is disabled under `prefers-reduced-motion: reduce`.

---

## 3. Accessibility

- **Landmarks and headings.** `<nav aria-label="Primary">`, `<header>`, `<main>`, and one
  `<h1>`. Each panel is an `<section>`/`<aside>` with `aria-labelledby` pointing at its
  heading, so landmark navigation exposes "Throughput", "Incident detail", "Incidents".
- **Skip link** to `#main-content`; `main` takes `tabindex="-1"` so the jump lands with
  focus.
- **Focus is always visible.** A single `:focus-visible` rule gives a 2 px accent outline
  with a 2 px offset on every interactive element. The severity chips are checkboxes, so
  they use `:has(input:focus-visible)` to put the ring on the chip, not the hidden input.
  Verified by test: a real `Tab` press yields `solid 2px rgb(91,155,255)`.
- **The table is a real `<table>`** with a `<caption>`, `<thead>`, `<th scope="col">` and
  a row-header-adjacent ID button — not a grid of divs. The mobile stacked-card layout is
  a CSS `display` change, which is why the sticky header and row semantics survive.
- **Colour is never the only signal.** Severity and status always carry text; the empty
  state, the filter summary, the acknowledgement toast and the disabled confirm state all
  announce in words.
- **Live regions, deliberately scoped.** There is no `aria-live` on the whole detail
  panel — re-rendering it would re-announce everything on every keystroke. Instead a
  dedicated `role="status"` line announces changes tersely: "Detail panel now shows
  INC-2832, low severity, Elevated partner delivery lag, status Open, owner R. Patel."
  Separate polite regions cover filter results, selection, acknowledgement/undo and chart
  scrubbing.
- **The chart is not image-only.** The `<svg>` is `role="img"` with `<title>` and
  `<desc>` carrying the range, min, max and latest value; the cursor layer and hit
  rectangle are `aria-hidden`; and a visually-hidden `<table>` lists every hour and value
  so the full series is available to screen readers. Keyboard scrubbing announces the
  focused hour in a polite region, so the interaction is not mouse-only.
- **Disclosure semantics.** The runbook toggle is a `<button>` with `aria-expanded`
  driving the panel's `hidden` state.
- **Motion and contrast.** `prefers-reduced-motion` is honoured. Contrast was measured
  rather than eyeballed: primary text is 14.6:1 on panel surfaces, mid-tone 7.0:1, and the
  muted tone was lightened from an initial `#6d7889` (3.98:1 — a real AA failure) to
  `#8791a0` (5.6:1 on panel, 4.7:1 on the raised chip-hover surface) so every label, axis
  tick and field caption clears AA. The smallest text is 9.5 px uppercase, used only for
  column headers, field labels and axis ticks, each paired with an 11.5–12.5 px value.

---

## 4. Responsive behaviour

Verified in a headless Chromium at 390 × 844: `documentElement.scrollWidth` = 390 =
`clientWidth`, and **no element's bounding box crosses the viewport edge** — checked
element-by-element, not just the page, since `overflow-x: hidden` on `body` would
otherwise hide a real overflow (it did, initially, for the clipped `<th>` elements).

| Width | Layout |
| --- | --- |
| ≥ 1181 px | 212 px rail, 4 metrics across, chart + detail side by side, detail panel sticky |
| 901–1180 px | Rail collapses to a 60 px icon strip; detail panel drops below the chart |
| 721–900 px | Metrics go 2 × 2; operator name and clock drop out |
| ≤ 720 px | Rail becomes a fixed bottom tab bar; table becomes stacked cards, each cell labelled via `::before { content: attr(data-label) }`; toolbar becomes a 2-column grid |
| ≤ 400 px | Sparklines hidden, single-column toolbar, tighter chart padding |

The table's `<thead>` is clipped rather than removed on mobile, so column context stays
available to assistive tech even though the visual layout is card-based.

---

## 5. How this was verified

Behaviour was driven in headless Chromium over the DevTools Protocol — real clicks, real
`Tab`/`ArrowLeft` key events, and computed-style and bounding-box measurements — with
**45 assertions covering**: metric/chart/table/detail rendering; default, filtered and
empty states; filter-summary copy; clear-all; row selection and its announcement;
acknowledge → row/status/owner/badge/log/toast → undo restoring the exact prior state;
runbook disclosure in both directions; search; chart range re-slicing and keyboard
scrubbing; focus-ring presence; the 390 px overflow audit above; and a contrast audit
that measures every rendered text node against its effective composited background —
**121 text nodes, 0 below WCAG AA**. All 45 pass, with no console errors.

## Known scope limits

The nav links other than Incidents are placeholders pointing at the page's own sections;
acknowledgement is not persisted across reload; the throughput series is static seed data
rather than a live feed; and service avatars show an initial rather than a real person.
