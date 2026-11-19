# Relay — operations control room

Relay is a single-page operations workspace for on-call engineers who need to
read system health at a glance, scan an incident queue, and act without losing
context. It is built with plain HTML, CSS, and JavaScript; all icons are inline
SVG and the only assets are the three local files plus `DATA.json`. No fonts,
frameworks, images, or network requests are used.

## Information hierarchy

The page is ordered from broadest signal to narrowest action:

1. **Top status bar** — environment, overall degraded/nominal state, UTC clock,
   and the signed-in operator. This is the first thing an operator checks.
2. **Navigation rail** — persistent section navigation; Overview is current,
   Incidents carries the active count.
3. **Page header** — scope, live freshness, the 24-hour window, and refresh.
4. **Metric strip** — four compact KPIs with direction, delta, comparison
   context, and a small sparkline. The highest-value signal is readable in one
   pass, not buried in charts.
5. **Throughput** — the 24-hour trend directly beneath the metrics, with peak,
   average, current value, and a marked saturation threshold.
6. **Incident workspace** — the queue is the main working surface; the selected
   incident detail sits beside it on desktop so selection never requires a
   context switch.

The visual system uses a restrained charcoal palette (`#0b0e12` through
`#1f2834`), 1px borders instead of shadows, and 3–4px radii. Blue is the single
interactive accent, used for focus, selection, links, and the primary action.
Red, orange, yellow, and steel blue are reserved for severity and never used
decoratively. Type is 13px at the base with 8.5–10.5px micro-labels; values use
tabular figures and a monospace face for IDs, times, rates, and axis labels so
columns align vertically. There are no gradients, translucent glass panels, or
oversized headings.

## Interaction behavior

**Filtering and sorting.** Search matches incident ID, title, service, owner,
and region. Severity, status, and service selects combine with the search; the
footer reports the current result count, the Clear control enables only when a
filter is active, and a dedicated empty state names the active filters and
offers a reset. Column headers sort by severity, ID, service, age, owner, or
status, toggling ascending/descending and reflecting the state through
`aria-sort`. Default order is severity-first with stable ordering inside a band.

**Selection and acknowledgement.** Rows are selectable by click, Enter, or
Space; Up/Down, Home, and End move between rows. The detail panel shows status,
age, service, region, owner, detected time, impact, error-budget burn, and a
response timeline. Acknowledge changes the incident to Acknowledged, assigns it
to the operator if it was unassigned, appends a timeline event, updates the row,
header tally, and panel, and confirms with a toast. The action is disabled with
an explanatory label once acknowledged or resolved. “Assign to me” is a second
real local state change. All changes are in-memory and reset on reload; no
backend is implied.

**Throughput.** The 24 data points are plotted as a normalized 0–100 load index
(the exact DATA values), with 80 marked as saturation and values above it in
amber. Hovering shows a compact tooltip; the chart is also a single keyboard
stop with Left/Right, Home, and End navigation, a roving `tabindex`, visible
focus on the active bar, and an `aria-live` readout of each hour.

**Global behavior.** The clock is live and the refresh action re-renders the
snapshot with a toast and updated freshness text. `/` focuses search, `A`
acknowledges the selected incident, and Escape clears/leaves the search or
closes the mobile sheet. Navigation items outside the Overview workspace return
a short status message rather than dead-ending.

## Responsive behavior

- **≥1360px:** 188px labeled rail, side-by-side queue, and a sticky 330px detail
  panel.
- **1160–1359px:** the rail collapses to a 60px icon rail with native titles;
  the queue and a 316px detail panel remain side by side.
- **760–1159px:** the icon rail stays, and the detail panel moves below the
  queue in a two-column layout (incident header/metadata left, timeline right).
- **≤759px:** the rail becomes a fixed five-item bottom navigation. Metrics go
  to a 2×2 grid, the chart shortens, the table becomes a card list (the semantic
  table and its visually hidden headers remain for screen readers), and the
  detail becomes a bottom sheet.

The sheet is labelled as a dialog only while open, traps Tab, closes on
backdrop click, Escape, or the close button, and returns focus to the selected
row. Its header is sticky so the incident identity and close control remain
available while scrolling. The layout was checked at 320, 360, 390, 414, 600,
760, 768, 820, 900, 1024, 1060, 1200, 1280, 1366, 1440, and 1680px; the page
never exceeded the viewport width at any of those sizes.

## Accessibility choices

- Semantic landmarks (`header`, `nav`, `main`, `aside`), a skip link, ordered
  headings, a real table with caption, `scope="col"`, and `aria-sort`.
- Rows expose a single descriptive button per incident (ID, title, severity,
  status); the arrows move that button focus, and the row card receives a
  visible focus ring on mobile.
- Visible `:focus-visible` treatment is a 2px accent outline with offset; the
  chart draws a ring on the active bar, and focus is never removed without an
  equivalent replacement.
- Color is reinforced by text: severity labels, status labels, trend arrows and
  signs, and “above saturation” in both tooltip and accessible label. Faint text
  was raised to roughly 4.7:1 on panels, and secondary text is above 6:1; the
  primary text is over 15:1.
- Live regions announce selection, filter result counts, acknowledgements, the
  chart readout, and the toast. `aria-modal` and focus trapping are applied only
  in the mobile sheet, never to the desktop side panel.
- `prefers-reduced-motion` removes the pulse, the sheet transition, and smooth
  scrolling; all controls are native buttons, links, inputs, or selects with
  accessible names.
- The mobile sort buttons are removed from the tab order while their header is
  visually hidden, so keyboard users never land on invisible controls.

## Data and states

`DATA.json` supplies the four metrics, the 24 throughput values, and the first
four incidents verbatim. Five additional incidents extend the queue with the
same schema and realistic impact/burn/region metadata so filtering, sorting,
acknowledgement, and the resolved/acknowledged states can be exercised. The
default view shows the eight unresolved incidents plus one resolved example.
Empty states exist for no filter matches and for no selected incident; resolved
and already-acknowledged incidents show disabled actions rather than dead
buttons. Verification used headless Chrome at 1440, 1024, and 390px, including
filter, sort, acknowledge, empty-state, chart-keyboard, and mobile-sheet flows,
with no console errors or external requests.
