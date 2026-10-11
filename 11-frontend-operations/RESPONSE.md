# Relay — design & implementation notes

A single-page operations control room built with local HTML, CSS, and vanilla
JavaScript only. No frameworks, no external fonts, no remote assets, no network
requests. All content is seeded from the embedded copy of `DATA.json`
(`<script type="application/json" id="relay-data">`), which is parsed at boot so
the page works identically over `file://` or any static host without a fetch.

## Visual hierarchy

The page reads in three descending tiers so an operator's eye lands where the
urgency is:

1. **Global state first.** The sticky top status bar carries the wordmark, the
   environment chip, and a single computed health line ("Degraded · 1 critical ·
   4 active") with a pulsing severity dot. This is the one thing an operator
   needs at a glance, so it is always visible.
2. **Trends second.** Four summary metrics sit directly under the header. Each
   card pairs a large tabular figure with a directional change chip. The chip
   color encodes *sentiment*, not raw direction: a falling P95 latency is green
   (good) while a rising error rate is red (bad), via a per-metric
   "lower-is-better" rule. A 2px left edge bar repeats that sentiment so the row
   can be scanned without reading numbers.
3. **Detail third.** The 24-hour throughput area chart gives shape to the
   numbers, and the incident workspace (table + detail panel) is where actual
   work happens. Section titles are small and quiet; the data is the loudest
   thing on screen.

Density is kept high and calm: 13–14px base type, tight 1px borders instead of
shadows or heavy rounding, a near-neutral charcoal palette, and a single muted
teal accent reserved for interactive/selected state. Severity uses a fixed
four-step ramp (red / orange / yellow / slate) with diamond markers; status uses
outlined pills. Nothing is glassy, gradient-filled, or oversized.

## Layout & responsiveness

- **≥1180px:** left navigation rail (icon + label), metrics in 4 columns, and a
  two-column workspace (incident table left, sticky detail panel right).
- **720–1180px:** rail collapses to icon-only; the detail panel drops below the
  table; metrics go 2-up at ≤900px.
- **≤720px:** the rail becomes a fixed bottom tab bar with labels; the status
  bar wraps its health line to its own row; the main column gains bottom padding
  so content never hides behind the bar.
- **≤560px:** metrics go single-column and the incident table transforms from a
  grid into stacked cards — each row becomes a labeled `label: value` block via
  `data-label` attributes — so nothing needs horizontal room.

At 390px there is no horizontal page scroll: every grid uses `minmax(0, 1fr)`,
long strings ellipsize, and the only horizontally scrollable surface would be
the table, which is replaced by cards before that becomes necessary.

## Interaction behavior

- **Selection.** Clicking a row (or pressing Enter/Space on a focused row)
  selects it: the row gains an accent left bar + tint, `aria-current="true"`,
  and the detail panel re-renders with severity, status, a metadata definition
  list, and an activity timeline. The first (most severe) incident is
  pre-selected on load so the panel is never blank.
- **Keyboard table navigation.** Rows use a roving tabindex (only the selected
  row is in the tab order). Arrow Up/Down move selection row-by-row, Home/End
  jump to first/last, Enter/Space confirm. Focus is kept on the row as selection
  moves.
- **Acknowledge.** The detail panel's primary button advances the incident's
  lifecycle: `open/investigating/monitoring → acknowledged → resolved`. Each
  step stamps a UTC time, appends a timeline entry, updates the table badge,
  recomputes the global health line, flashes the panel, and announces the change
  to assistive tech. Once resolved the button disables.
- **Filtering.** A search box (id/title/service/owner), a severity select, and a
  status select combine with AND logic. A live result count reports
  "N of M incidents" when filtered. A "Clear filters" button appears only when a
  filter is active.
- **Sorting.** The Severity and Age headers are toggle buttons that flip
  asc/desc and publish `aria-sort`; the active direction shows a small arrow.
- **Empty states.** When filters exclude everything, the table area shows a
  centered empty state with a contextual title and an inline "Clear filters"
  action; a separate message covers the (theoretical) zero-incident case. The
  detail panel has its own empty state if no incident is selected.
- **Chart hover.** Moving the pointer (or dragging a touch) across the plot
  snaps a crosshair + dot to the nearest hour and shows a tooltip with the value
  and timestamp; it hides on leave.
- **Scroll-spy nav.** Rail links smooth-scroll to sections and highlight via an
  IntersectionObserver as sections enter the viewport.

## Accessibility choices

- **Structure & landmarks:** semantic `nav` / `header` / `main` / `aside` /
  `footer`, one `h1` per page with a logical heading order, and a skip link to
  the main region.
- **Keyboard:** every interactive element (links, inputs, selects, buttons,
  sortable headers, table rows) is reachable and operable by keyboard. A single
  high-contrast `:focus-visible` ring (2px accent outline) is used everywhere;
  rows show an inset ring so focus is visible against the tinted selected state.
- **Screen readers:** the table is a real `<table>` with `scope="col"` headers
  and a `<caption>`; the selected row uses `aria-current`. The SVG chart is
  `role="img"` with a descriptive `aria-label` summarizing range and peak, and a
  visually hidden data table mirrors all 24 values for full access. Filter
  results, selection changes, and acknowledge/resolve actions are announced
  through a polite `aria-live` region; the result count is also live.
- **State without color alone:** severity pairs color with a diamond marker and
  a text label; status pills carry text; trend chips carry an arrow glyph plus
  the signed delta, so no meaning depends on hue only.
- **Numeric legibility:** all figures (metrics, ages, clock, chart stats) use
  `font-variant-numeric: tabular-nums` with a monospace stack so columns align
  and values do not jitter as they change.
- **Motion & contrast:** `prefers-reduced-motion` disables the pulse, flash, and
  transitions; `prefers-contrast: more` raises border and muted-text contrast.
  Text/background pairs stay above WCAG AA on the dark surface palette.
- **Focus management:** selection via keyboard keeps focus on the row; clearing
  filters returns focus to the search field so keyboard users are not stranded.

## Files

- `index.html` — semantic structure, inline SVG icon set, and the embedded
  `DATA.json` seed.
- `styles.css` — design tokens, layout grid, component styles, severity/status
  states, focus/empty states, and the responsive breakpoints down to 390px.
- `app.js` — data seeding, metric/chart/table/detail rendering, filtering,
  sorting, selection, the acknowledge lifecycle, keyboard navigation, the live
  clock, and scroll-spy.
