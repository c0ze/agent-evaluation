# Relay — design notes

Single-page, dependency-free operations dashboard. Open `index.html` directly;
`styles.css` and `app.js` are local, and the seed from `DATA.json` is embedded
verbatim in `app.js`. There are no fonts, assets, CDNs, `@import`s, or runtime
fetches/XHR — the page works fully offline over `file://`.

## Visual hierarchy

The eye is led from global state → trend → triage, top to bottom:

1. **Top status bar** — one line of system truth: a colored health dot and
   label ("Degraded · 1 critical"), active incident count, environment chip, a
   live indicator, and a UTC clock. It is sticky so context survives scrolling.
2. **Left navigation rail** — icon + label buttons (Overview, Flow, Incidents,
   Detail). The active destination carries a thin accent edge bar; no giant
   branding, just a compact "R" mark.
3. **Page heading** — deliberately small (18 px). Control-room software does
   not need a hero.
4. **Four summary metrics** — equal-weight row, each with an uppercase label, a
   large tabular numeral, and a trend line with directional context. A thin top
   border flags the metric that needs attention (`Error rate`).
5. **24-hour throughput chart** — the largest single element, an inline SVG
   built from `DATA.json.throughput`. A restrained neutral area under one
   accent line, faint horizontal gridlines, hourly x ticks, a peak annotation,
   and a row of computed stats (peak / trough / mean / last hour).
6. **Incident table + detail panel** — the working surface. The table is the
   filterable list; the detail panel is pinned to its right (stacks below on
   narrower screens) and shows the selected incident.

**Palette & density:** neutral greys (`#f2f3f5` canvas, white surfaces, dark
ink) with a single purposeful blue accent (`#2f6df0`). Severity gets its own
muted, color-coded states (critical red → low green) so the accent stays
reserved for interaction, not decoration. Deliberately avoided: glassmorphism,
gradients, oversized headings, and heavily rounded cards (radius is 4 px).
Numeric columns use a monospace stack with `tabular-nums`; age is right-aligned
so values line up vertically. Spacing is compact (10–15 px cell padding).

## Interaction behavior

- **Metrics** render from `DATA.metrics`. Trend color encodes meaning, not just
  direction: an upward move is bad only for `Error rate` (red); the other
  upward/downward moves are treated as healthy. Each carries "vs. prior 24h"
  context.
- **Chart** is generated from the throughput array: gridlines at 0/25/50/75/100,
  a baseline-filled area, a polyline, a peak dot + label, and derived stats.
  It has a static `role="img"` label describing the shape for non-visual users.
- **Incident table** is filterable three ways that compose: free-text search
  (id, service, owner, title, status), severity dropdown, and status dropdown.
  A live "N of M shown" counter and a `role="status"` live region announce
  result changes to screen readers. "Clear" / "Clear filters" reset all inputs
  and return focus to the search field.
- **Empty/filter state**: when no rows match, the table body empties and a
  centered message appears with an inline "Clear filters" button. Detail panel
  has its own placeholder ("Select an incident…") when nothing is selected.
- **Selection**: clicking a row, or pressing Enter/Space on a focused row,
  selects it — the row gains an accent inset edge, `aria-selected="true"`, and
  its full record renders in the detail panel. The most severe incident
  (`INC-2841`) is selected by default. Above 1080 px the detail panel is
  sticky; at/below it scrolls into view on selection so mobile users see it.
- **Acknowledge**: the primary button in the detail panel is a working action,
  not a stub. Clicking it mutates state — sets the incident to `acknowledged`,
  assigns it to "You (on-call)", records a UTC timestamp, disables the button
  to "Acknowledged", shows a confirmation line, updates the table's status
  chip, and announces the change via the live region. Because it is real state,
  an "Acknowledged" status filter then returns that row. The action is scoped
  to acknowledge (it does not resolve) and is explained in the panel note.
- **Nav rail** buttons smoothly scroll to and focus their target section, and
  move `aria-current="page"`. The clock ticks live.

## Accessibility choices

- **Semantic structure**: `nav`, `header`, `main`, `section` with
  `aria-labelledby`, `aside`, a real `<table>` with `<caption>`, `<th
  scope="col">`, `<dl>` for detail fields, and `role="status"` live regions.
  A skip link jumps straight to incidents.
- **Keyboard**: every interactive control is reachable. Table rows are
  `<tr tabindex="0">` with Enter/Space to select plus Arrow Up/Down to move
  between rows. Filters, clear buttons, rail buttons, and the acknowledge
  button all work by keyboard.
- **Focus**: a high-contrast `:focus-visible` outline (accent blue, lighter
  variant on the dark rail) is always present; selected rows use an inset
  outline so it is not clipped. Focus is restored to the search field after
  clearing filters and to the selected row where relevant.
- **Color is never the only signal**: severity badges combine color with a text
  label and a dot; status uses labeled text plus a dot; trends pair color with
  ▲/▼ glyphs and the numeric delta; the health state is spelled out in words.
  The SVG has a descriptive text alternative and the chart stats restate the
  key numbers.
- **Screen readers**: off-screen (`.sr-only`) labels for the search and both
  selects, an `aria-live` region for filter/ack announcements, `aria-current`
  for nav, `aria-selected` for rows, `role="img"` + label for the chart, and
  `aria-hidden` on decorative icons/dots.
- **Motion**: respects `prefers-reduced-motion` (disables smooth scrolling).
- **Forms**: `<label>` for every input, `type="search"` with `autocomplete="off"`,
  and `<noscript>` fallback text.

## Mobile (390 px)

The rail collapses to a 56 px icon-only strip; top bar hides the nonessential
clock/environment chip/active count; metrics become a 2-column grid with
smaller numerals; the lower layout stacks the detail panel beneath the table;
filter selects wrap to a 2-per-row grid and the result counter moves to its own
line; table cell padding tightens. The incident table is the one element that
can scroll horizontally — but **inside** its own `.table-wrap` container, so
the **page itself never scrolls horizontally**. All layout columns are `1fr` /
`minmax(0, 1fr)` and the shell uses `min-width: 0` to prevent content from
pushing the viewport wider than 390 px.
