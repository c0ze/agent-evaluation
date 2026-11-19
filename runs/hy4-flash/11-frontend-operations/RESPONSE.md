# Relay — Operations control room

## What was built

A single-page, dependency-free operations dashboard in `index.html`, `styles.css`,
and `app.js`. Content is seeded from `DATA.json`; the same seed is mirrored as a
literal in `app.js` so the page also works when opened directly via `file://`
(where `fetch` is blocked) — no network requests, fonts, or remote assets are
used. All icons are inline SVG.

## Visual hierarchy

The layout follows a top-down scanning order appropriate for an operator:

1. **Navigation rail + status bar** — the rail is a slim 64px icon column on
   desktop (becomes a bottom tab bar on mobile); the 56px status bar carries
   live/region/ingest state and a UTC clock. Both are sticky so context is never
   lost while scrolling.
2. **Page heading** — a deliberately small (18px) title keeps focus on data, not
   chrome.
3. **Four summary metrics** — a single row of compact tiles. Values use
   `tabular-nums` monospace and large-but-restrained sizing for numeric
   alignment. Each tile pairs a trend chip with "vs. 1h avg" context. Trend
   color is semantic, not just directional: for latency, error rate and queue
   depth a downward move is *good* (green) and upward is *bad* (red); events/min
   uses the inverse.
4. **Throughput** — an inline SVG column chart with a 0 / half / max grid,
   hourly bars, a highlighted peak hour, and peak/average readouts.
5. **Incident table** — a dense, scannable table with severity dots, service,
   age, owner, and status. Severity is color-coded with a redundant text label.
6. **Detail panel** — a right-hand sticky panel on wide screens that moves below
   the table on narrow screens.

A restrained neutral slate palette with one cyan accent is used throughout.
Severity colors (red/amber/blue/gray) are reserved for status meaning. There are
no gradients, blur/glass effects, giant headings, or heavily rounded cards —
border radius is capped at 4px.

## Interaction behavior

- **Filtering** — a free-text search across id/title/service/owner/severity/status,
  plus severity and status dropdowns, combine with AND logic and update the table
  live. "Clear" resets all three. A result count ("N of M incidents (filtered)")
  is shown in the panel header.
- **Empty/filter state** — when nothing matches, the table is replaced by a
  labeled empty state with a one-click "Clear filters" action. This is distinct
  from the no-selection state in the detail panel.
- **Row selection** — clicking a row (or focusing it and pressing Enter/Space)
  selects it, marks it with `aria-pressed` and a left accent rule, and renders its
  detail.
- **Acknowledge** — the detail panel's primary action sets the incident status to
  `acknowledged`, assigns an unassigned incident to the on-call operator, and
  re-renders both the table and detail. The button then becomes a disabled
  "Acknowledged" state with a confirmation note.
- **Refresh** — re-renders from current data and announces the update; a live UTC
  clock ticks once per second.

## Accessibility choices

- Semantic structure: `<nav>`, `<header>`, `<main>`, `<section>` with headings,
  a real `<table>` with `<thead>`/`<tbody>`, `<caption>`, and `scope="col"` headers.
- A skip link bypasses the rail and status bar; the main region is focusable.
- Visible focus via `:focus-visible` with a 2px cyan outline and offset.
- The chart is an `role="img"` SVG with `<title>` and `<desc>` summarizing range
  and peak, plus per-bar `<title>` tooltips; the caption/legend supplies context.
- Incident rows are keyboard-operable (`tabindex="0"`, Enter/Space) and expose
  selection via `aria-pressed` and descriptive `aria-label`s.
- Filter controls have explicit accessible names. Metric trend direction and
  favorability are also given as screen-reader text, not conveyed by color alone.
- A polite `aria-live` region announces acknowledgements and refreshes.
- Color choices target sufficient contrast on the dark surface, and severity is
  always paired with a text label / shape cue.
- `prefers-reduced-motion` disables transitions.

## Responsive behavior

At ≤1080px the detail panel drops below the incidents panel. At ≤720px the rail
becomes a bottom tab bar, the status bar hides nonessential items, metrics become
a 2×2 grid, filters wrap, and the table reflows into a stacked card list using
CSS grid while retaining table semantics. At 390px there is no horizontal page
scroll; the only horizontally scrollable element on mid-size screens is the table
container itself.
