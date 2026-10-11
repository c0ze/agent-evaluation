# Relay — Operations Console: Design Response

## Information hierarchy

The layout is a three-region control room: a dark navigation rail on the left,
a main content column, and a persistent incident detail panel on the right.

1. **Navigation rail.** Compact dark rail with the Relay mark, five section
   links (Overview active), and the signed-in operator at the bottom. Below
   900 px it collapses into a horizontal, scrollable top strip so it never
   squeezes the content column.
2. **Top status bar.** Region/cluster context line, the page title, and a
   live status region ("All systems nominal") with a running clock in
   tabular monospace figures — an operator's at-a-glance health check.
3. **Summary metrics.** Four cards (Events/min, P95 latency, Error rate,
   Queue depth) seeded from `DATA.json`. Each pairs a large tabular-nums
   value with a small trend line ("+8.2% vs 24h ago"). Trends are colored
   by *goodness*, not raw direction: error rate rising is red, queue depth
   falling is red (drain means upstream stall), throughput up is green.
4. **Throughput chart.** A DPR-aware canvas bar chart of the 24 hourly
   buckets, with y-axis gridlines, hour labels derived from the real clock,
   a dashed amber SLO floor, and bars that turn red below the floor. It has
   a text alternative via `role="img"` + `aria-label` and resizes with the
   window.
5. **Incidents table.** Sortable-by-construction order (severity, then
   age descending) with columns for severity badge, id+title, service,
   age, owner, and status. Two filters (severity, status) narrow it, and
   a live count ("3 of 4 incidents shown") is announced politely.
6. **Detail panel.** Sticky right-hand panel mirroring the selected
   incident with a definition list and the acknowledge action; on mobile
   it docks below the table.

## Interaction behavior

- **Selection.** Clicking any row (or its title button) or focusing a row and
  pressing Enter/Space selects the incident; the row gets
  `aria-selected="true"`, an accent tint, and a left inset bar. The first
  incident is selected on load so the panel is never empty.
- **Acknowledge.** The accent button flips the incident's status to
  "acknowledged" (✓, green), re-renders its table row and the detail list,
  disables itself, and leaves a persistent confirmation note
  ("Acknowledged by you · INC-2841") in a `role="status"` region so screen
  readers announce it without stealing focus.
- **Filtering.** Both selects work together; if the current selection is
  filtered out, selection follows the first visible row. When nothing
  matches, the table hides and a purposeful empty state appears with a
  "Clear filters" button that resets both selects and returns focus to the
  severity filter (a visible focus ring lands somewhere sensible).
- **Live regions.** The clock and status bar sit in an `aria-live="polite"`
  region; the table count has its own polite live region.

## Accessibility choices

- **Keyboard.** Everything is reachable by keyboard: nav links, selects,
  rows (tabindex + Enter/Space), title buttons, and action buttons. A skip
  link jumps to `#main`.
- **Focus visibility.** A global `:focus-visible` rule draws a 2 px accent
  outline with 2 px offset; nothing relies on color alone for focus.
- **Semantics.** Real `<table>` with `<caption>` and `scope="col"` headers,
  `<dl>` for detail metadata, landmark `nav`/`main`/`aside` regions, and
  visually-hidden labels for the filter selects.
- **Color-independent meaning.** Severity uses text badges (colored but
  always readable text: CRITICAL/HIGH/…), statuses use glyph prefixes
  (○ ◔ ◑ ✓), chart alerts are documented in the text alternative. All pair
  color with a second cue.
- **Motion.** `prefers-reduced-motion` disables transitions/animations;
  there are no auto-moving elements beyond the seconds clock.
- **Contrast.** Text colors meet WCAG AA against their backgrounds; the
  neutral palette reserves a single blue accent for interactive/selected
  states.

## Responsive behavior (390 px verified)

- 900 px breakpoint: rail becomes a horizontal top nav, detail panel docks
  below main; no horizontal page scroll.
- 560 px breakpoint: metrics stay a 2×2 grid, the chart shrinks, and the
  table drops the Service and Owner columns (data remains in the detail
  panel) so it fits 390 px with zero horizontal page scroll.
- The page was tested at 390×844: no horizontal overflow, all controls
  remain tappable and visible.

## Files

- `index.html` — structure and semantic landmarks
- `styles.css` — layout, tokens, states, responsive rules
- `app.js` — data seeding, rendering, filtering, selection, acknowledge
- No network requests, frameworks, external fonts, or remote assets.
