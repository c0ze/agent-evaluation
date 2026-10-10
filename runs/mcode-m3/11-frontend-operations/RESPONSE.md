# Relay — response notes

A single-file operations dashboard built from `DATA.json` with only HTML, CSS, and
JavaScript. This document explains the visual hierarchy, the interaction model,
and the accessibility choices, plus how to run the page.

## Files

- `index.html` — semantic markup, one root layout with a navigation rail, top
  status bar, and a main column that holds metrics, the throughput chart, and
  the incident split.
- `styles.css` — design tokens, layout, and responsive rules. No external
  assets, no fonts, no images.
- `app.js` — fetches `DATA.json` (with an embedded mirror as a fallback so the
  page still works when opened from the file system), renders every section,
  and wires up filtering, selection, and the acknowledge action.
- `DATA.json` — seed metrics, throughput series, and incidents.

## Hierarchy

The page reads top-to-bottom and left-to-right like a control-room panel.

1. **Navigation rail (56 px).** Always-visible anchors that orient the
   operator. The active item uses the accent surface; other items stay neutral
   until hover or focus.
2. **Top status bar.** Environment badge, live UTC clock, and operator
   identity. The bar is sticky so the time and env are never more than one
   glance away.
3. **Four summary metrics.** Each card has a 2 px severity rail on the left
   (amber for up, green for down), a label, a large tabular-numeric value, and
   a delta line with a direction arrow.
4. **Throughput panel.** A 24-bucket series rendered as an inline SVG line +
   area chart with subtle grid lines, a peak marker, hour ticks, and the
   max/zero reference labels on the right edge. A segmented control lets the
   operator switch the visible range; the chart re-renders from the same data
   since `DATA.json` only ships one series.
5. **Incident panel — split.** A filterable table on the left and the detail
   pane on the right. At ≤880 px the detail pane moves above the table so
   touch users see context first.

## Visual direction

- **Palette.** A near-black neutral stack (`--bg`, `--bg-1`, `--bg-2`, `--bg-3`)
  with a single cyan accent (`--accent`) used for selection, focus rings,
  live signals, and the chart line. Severity is communicated with desaturated
  red, orange, amber, and blue — never neon.
- **Type.** System UI font for body and labels, system mono for IDs, service
  names, ages, the clock, and chart ticks. Tabular numerals
  (`font-variant-numeric: tabular-nums`) are applied everywhere a number
  appears so columns of digits line up at the decimal.
- **Spacing & radii.** 4–8 px gaps between cards and rows, 2–4 px corner
  radii. No glassmorphism, no gradients on chrome, no oversized headlines.
- **Severity states.** Pills with a small leading dot use color + label so
  the state is never color-only.

## Interaction model

- **Row selection.** Clicking a row (or pressing Enter / Space while focused
  on it) opens that incident in the detail panel. The selected row gets an
  inset accent stripe and a tinted background.
- **Search.** Type into the filter input to fuzzy-match across ID, title,
  service, owner, severity, and status. `/` focuses the input from anywhere;
  `Esc` clears it.
- **Severity chips.** Click a chip to scope the table to one severity. The
  count badge updates to the visible count. The detail panel clears its
  selection when the selected row is hidden by a filter.
- **Empty state.** When filters hide every row, an empty card appears with
  a clear-filters action so the operator is never stranded.
- **Acknowledge.** The primary button in the detail panel flips the
  incident's status to `acknowledged`, updates the row's status pill, locks
  the button, and writes a confirmation line into a polite live region.
- **Range tabs.** Switch the throughput chart between 1h / 24h / 7d. With
  only one series in the data the chart re-renders unchanged, but the
  control still behaves correctly and updates `aria-selected`.

## Accessibility

- **Skip link.** A "Skip to main content" link appears on first tab.
- **Keyboard.** Every interactive element is reachable by Tab. Visible
  focus uses a 2 px accent outline with a 1 px offset. The rail uses
  `aria-current="page"` on the active item; the chart tabs use a tablist
  with `aria-selected`; severity chips form a labelled group; the search
  field is labelled; the table is wrapped in a focusable region.
- **Row semantics.** Rows are keyboard-activatable (Enter / Space) and use
  `tabindex="0"` so screen reader users can land on them.
- **Status announcements.** The acknowledge message and the clock live in
  `role="status" aria-live="polite"` regions so changes are announced
  without stealing focus.
- **Color independence.** Severity is conveyed by both color and label.
  Trend arrows are paired with color so up/down still reads in greyscale.
- **Reduced motion.** The pulse on the env dot, the row hover, and
  selection transitions are disabled when
  `prefers-reduced-motion: reduce` is set.

## Responsive behavior

- **≥1100 px.** Metrics in one row of four, split layout with table + 340 px
  detail pane.
- **880–1099 px.** Detail pane narrows to 300 px.
- **≤880 px.** Metrics become two columns, the detail pane stacks above the
  table, the rail collapses, and the top bar trims secondary text.
- **≤640 px.** The rail hides entirely, filters wrap to full width, and the
  table re-flows into stacked rows with `data-label` captions — useful at
  the 390 px target width without horizontal page scroll.
- **390 px hard cap.** Two-up metric grid, 17–18 px metric values, compact
  chips, and the chart drops to 140 px tall. No fixed widths force overflow.

## Running

Open `index.html` in a browser, or serve the directory with any static
server:

```sh
python3 -m http.server 8080
```

The page will fetch `DATA.json` automatically. If the browser blocks the
request — for example when opening the file directly via `file://` — the
script falls back to an embedded copy of the same data so the UI still
renders and is fully interactive.