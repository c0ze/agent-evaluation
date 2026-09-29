# Relay — design response

## Visual hierarchy

The page reads top-to-bottom in operator priority order: **system state → key
numbers → trends → work queue → work item**.

1. **Top status bar** — brand, environment (`PROD`), a computed active-alert
   pill, live indicator, UTC clock, and the on-call operator. Sticky so state
   is always visible.
2. **Summary metrics** — four compact cards (Events/min, P95 latency,
   Error rate, Queue depth) with delta-vs-previous-hour context. Color encodes
   good/bad, arrows encode direction, so color is never the only signal.
3. **Throughput chart** — 24-hour hourly means as an inline SVG bar chart
   with gridlines, UTC hour ticks, and a peak annotation.
4. **Incident table** — the work queue: severity badge, incident, service,
   age, owner, status.
5. **Detail panel** — sticky on desktop; the selected incident with signals,
   timeline, and actions.

The palette is neutral gray surfaces with a single blue accent reserved for
selection, focus, links, and the peak bar. Severity/status each have distinct
hue + label pairings (never color alone), with a dark theme via CSS variables.

## Interaction behavior

- **Filters** — live text search (ID/title/service/owner) plus severity and
  status selects. The result count updates (`N of M shown`); a clear-filters
  button appears only while filtered.
- **Row selection** — click, `Enter`/`Space`, or `↑`/`↓` arrow keys move
  selection; the detail panel updates immediately. If a filter hides the
  selected row, selection moves to the first visible row.
- **Acknowledge** — sets status to Acknowledged, assigns the on-call operator
  when unassigned, appends a "just now" timeline entry, refreshes the row,
  the status-bar alert count, and disables the button with confirmation text.
- **Copy ID** — copies the incident ID with a clipboard-API fallback.
- **Chart tooltip** — hovering a bar shows its hour and value; every bar also
  carries a native `<title>` fallback.
- **Theme toggle** — light/dark switch in the rail, persisted in
  `localStorage`.
- **Empty states** — zero filter matches swap the table for an illustrated
  empty state with guidance and a clear-filters action.

## Accessibility choices

- Skip link, landmark regions (`nav`, `main`, `aside`), and a real `<table>`
  with `<th scope>` headers.
- Chart is `role="img"` with `<title>`/`<desc>` summary plus a visually
  hidden data table of all 24 values for screen readers.
- Selection and filter changes are announced through a polite `aria-live`
  region; rows expose `aria-selected`.
- Visible `:focus-visible` outlines on all interactive elements; arrow-key
  navigation in the table with a documented hint row.
- `prefers-reduced-motion` disables the live-dot pulse; numeric columns use
  tabular figures for scannability.
- Mobile (390 px): the rail becomes a horizontal strip, metrics go 2-up, and
  table rows reflow into labeled cards — no horizontal page scroll.
