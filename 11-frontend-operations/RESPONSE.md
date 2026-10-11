# Relay — operations control room

A single-page control-room console built with plain HTML, CSS and JavaScript. No
frameworks, no build step, no external fonts, images, or network requests — the
only files needed are `index.html`, `styles.css`, and `app.js`. All content is
seeded from `DATA.json` (metrics, the 24 throughput buckets, the incident list)
and is inlined in `app.js` so the page also works when opened directly from disk
(`file://`), where a `fetch()` of `DATA.json` would be blocked.

## Hierarchy

The page is a 216 px nav rail + a single scrolling column, so operators always
keep the same orienting frame while moving through the data.

1. **Top status bar** — region, a live-feed state pill, the incident roll-up
   (`1 critical · 1 high · 2 tracked`) and a UTC clock. It answers "what needs me
   right now?" before any detail is read.
2. **Signals** — four metric cards. Each carries the value in large tabular
   figures, a delta chip with a directional arrow, a short operational note
   (SLO, budget, drain rate) and a 12-point sparkline for trend context. Colour
   on the delta is *semantic*, not decorative: down is good for latency and queue
   depth, up is bad for error rate, and events/min is neutral — the same arrow
   shape never implies "good" or "bad" by itself.
3. **Throughput — last 24 hours** — a bar chart (inline SVG) with 25k gridlines,
   a dashed 24 h mean, an explicit peak label, hour axis, and a live readout.
   Peak and mean are called out so the shape of the day is readable without
   hovering.
4. **Incidents** — the working surface: filters, then a dense sortable table,
   then the detail panel that holds the response action.
5. **Activity and service health** — supporting context, deliberately below the
   triage surface.

The detail panel is docked beside the table on wide screens (sticky, so it stays
with the operator) and stacks below it under 1180 px.

## Interaction behaviour

- **Table**: rows are selectable with mouse, `Enter`/`Space` while a row has
  focus, and `J`/`K` from anywhere. `↑`/`↓`/`Home`/`End` move within the table.
  Selection is marked with a left accent bar, a tinted row and `aria-current`.
- **Sorting**: every column header is a button that toggles direction and sets
  `aria-sort`; severity defaults to critical-first, age to newest-first.
- **Filtering**: free-text search (id, title, service, owner), a severity
  segmented control with live counts, and a status select. The result count
  ("4 of 4 shown") updates in the section header, a "Clear filters" button
  appears as soon as a filter is active, and the empty state explains what did
  not match instead of just showing a blank table.
- **Detail panel**: severity, id, title, status, service, age, owner, impact, a
  short assessment, and a chronological timeline.
  **Acknowledge** sets the status to `acknowledged`, stamps the timeline with the
  operator name and time, disables itself, updates the row badge, the top-bar
  roll-up and the activity feed, and announces the change in a live region.
  **Assign to me** claims an unassigned incident (the primary case in the data:
  INC-2839). A close button returns to the empty detail state on small screens.
- **Chart**: hovering, touch-dragging, or focusing the SVG and pressing
  `←`/`→`/`Home`/`End` moves a cursor, updates the readout, and shows a tooltip.
  Focus starts on the peak value so the first read is meaningful.
- **Shortcuts**: `/` focuses search, `J`/`K` change the selected incident,
  `A` acknowledges the selected one, `?` opens the shortcut reference, `Esc`
  closes it or clears search.
- **Rail**: anchors scroll to each section; an IntersectionObserver keeps the
  active item, `aria-current`, and the incident count in sync with what is on
  screen.

## Accessibility

- **Semantics first**: one `h1`, `h2` per section, real `<table>` with `scope`d
  headers and a caption, `<nav>`, `<main>`, `<aside>`, `dl` for the metadata
  pairs, `<time>` in the timeline. Severity and status are never colour-only —
  each carries a text label and a shape-coded dot.
- **Keyboard**: a skip link jumps past the rail; a visible `:focus-visible` ring
  (2 px accent, 2 px offset) on every control; roving `tabindex` in the table so
  only the selected row is in the tab order; the chart is reachable as a single
  stop and read with arrow keys; all actions are reachable without a pointer.
- **Screen readers**: an `aria-live` region announces selection, acknowledgement,
  assignment, filter clearing, sorting and chart values; the SVG chart also has a
  visually hidden data table (all 24 hours) and a descriptive label; the
  shortcuts panel is a labelled dialog; icon-only buttons have `sr-only` text or
  `aria-label`s; metric cards expose their value plus the meaning of the delta.
- **No motion dependence**: the live-feed pulse, hover transitions and smooth
  scrolling are all disabled under `prefers-reduced-motion`.
- **Contrast**: body text and muted labels on the panel backgrounds sit above
  4.5:1, and severity colours are only used for small text or shapes on solid
  backgrounds so they stay legible.

## Responsive behaviour

| Width | Behaviour |
| --- | --- |
| ≥ 1181 px | Rail + wide table + docked detail panel |
| ≤ 1180 px | Service and owner columns collapse out; detail panel moves under the table |
| ≤ 900 px | Rail becomes a bottom navigation bar; main content gains bottom padding so it is never hidden under the bar; metrics move to two columns |
| ≤ 720 px | Table headers hide and rows become labelled cards (`Severity`, `Service`, `Age`, `Owner`, `Status` labels are re-inserted above each value); detail actions become sticky |
| ≤ 420 px | Metrics stack to one column; controls take the full width |

Verified at 390 px: `documentElement.scrollWidth` equals the viewport width
(378 = 378), no element crosses either edge, and the overflow check across every
element reports no offenders. There is no horizontal page scroll and no
hidden-by-`overflow` content.

## Files

- `index.html` — structure, inline SVG icons, shortcuts dialog.
- `styles.css` — design tokens (neutral greys, one blue accent, four severity
  colours), layout, components, responsive rules.
- `app.js` — seeded data, rendering, filtering, sorting, selection,
  acknowledgement, chart drawing and keyboard behaviour.
- `RESPONSE.md` — this document.
