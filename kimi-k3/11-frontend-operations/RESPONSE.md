# Relay — response notes

## Information hierarchy

The page is ordered the way an operator triages: **status first, then health,
then work items.**

1. **Top status bar** — environment tag (`prod · us-east-1`), a live UTC clock,
   and an active-incident pill that flips to "All clear" (green) when nothing
   is unacknowledged. Sticky, so context never scrolls away.
2. **Summary metrics** — four cards from `DATA.json`, each with a tabular-nums
   monospace value, a directional delta, and "vs previous hour" context. Deltas
   are colored by *whether the direction is good for that metric* (error rate
   up = red; p95 latency down = green), not merely by direction.
3. **Throughput** — the only visualization above the fold, since volume shape
   explains most incidents. Peak/average stats sit in the header for scanning.
4. **Incidents + detail** — the working surface. The table is sorted by
   severity then age; the detail panel is sticky beside it on wide screens and
   stacks below it on narrow ones.

Visual restraint follows the brief: a single blue accent, used only for
interactive/active/peak states; 1px borders and 5px radii instead of cards
with shadows or glass effects; compact 12–13.5px type; severity communicated
by muted red/amber/yellow/gray dots plus text (never color alone).

## Interaction behavior

- **Filters** — text search (id, title, service, owner), a severity segmented
  control, and a status dropdown compose together; a result count
  ("2 of 4 incidents") is announced via `aria-live`. Filtering to zero rows
  swaps the table for an empty state with a working **Clear filters** button.
- **Selection** — clicking a row (or focusing it and pressing Enter/Space)
  loads the detail panel; ArrowUp/ArrowDown move between rows. The selected
  row gets an accent inset bar and `aria-selected`.
- **Acknowledge** — the detail panel's primary action sets the incident's
  status to `acknowledged`, updates the row pill, appends a timestamped
  timeline entry, decrements the top-bar active count, disables the button,
  and fires a toast (also an `aria-live` region). Acknowledged incidents keep
  their history; nothing is deleted.
- **Chart** — canvas bars redrawn at devicePixelRatio with a hover tooltip
  (hour + value), peak bar highlighted in the accent, and a ResizeObserver
  for fluid resizing.

## Accessibility choices

- Semantic landmarks (`nav`, `header`, `main`, `aside`, labeled `section`s),
  a real `<table>` with `<th scope="col">`, and a skip link.
- Every interactive element has a visible `:focus-visible` outline (accent
  blue, 2px, offset). Rows are `tabindex="0"` with an `aria-label` summarizing
  the incident, so the row is understandable without reading every cell.
- The canvas has `role="img"` and an `aria-label` summarizing range and peak;
  decorative SVG icons are `aria-hidden`.
- On very narrow screens the severity word is visually collapsed to a dot but
  remains in the accessibility tree (clip, not `display:none`), and the row
  `aria-label` still carries the severity.
- `prefers-reduced-motion` disables transitions; contrast on all text passes
  WCAG AA for the dark theme.

## Responsive behavior

- ≥1180px: rail + 4-up metrics + table/detail side by side.
- ≤1180px: owner column drops; ≤980px: detail stacks below the table, metrics
  go 2×2; ≤760px: the rail becomes a fixed bottom bar (icons + labels) and the
  page keeps bottom padding so content is never obscured.
- At 390px everything fits without page-level horizontal scrolling: severity
  collapses to a dot with a shortened "Sev" header, titles ellipsize, and the
  table container (not the page) is the only element allowed to scroll.

## Data

`DATA.json` is embedded verbatim into `app.js` (plus clearly separated
per-incident enrichment: impact, summary, timeline) so the page runs with zero
network requests, including from `file://`. `node --check` passes, and the
layout, acknowledge flow, and empty state were verified with headless-browser
screenshots at 1440px, 900px, and 390px.
