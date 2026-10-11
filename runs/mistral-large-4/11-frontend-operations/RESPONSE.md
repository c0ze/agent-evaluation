# Relay — Operations Control Room

## Deliverables

- `index.html` — single-page dashboard markup
- `styles.css` — all styling, including responsive breakpoints
- `app.js` — data seeding, rendering, filtering, selection, acknowledge
- `DATA.json` — seed data (metrics, 24 h throughput series, incidents)

No frameworks, external fonts, remote assets, or network requests are used.

## Hierarchy

```
.shell (flex row)
├── .rail            fixed-width navigation rail (brand, nav buttons, system status)
└── .main
    ├── .topbar      sticky status bar (title, environment, UTC clock, Live pill)
    └── .content
        ├── .metrics          4 summary metric cards (label / value / delta)
        ├── .chart-panel      24-hour throughput bar chart + time axis
        └── .split (grid)
            ├── .incidents    filter bar + incident table + empty state
            └── .detail       selected incident detail panel + actions
```

The layout is a classic control-room shell: a narrow icon rail on the left, a
sticky top status bar, and a single scrolling content column. Content sections
stack vertically; the incident table and detail panel sit side-by-side on wide
screens and stack below 1080 px.

## Interaction behavior

- **Throughput chart**: 24 hourly bars rendered as flex `div`s (heights
  proportional to value, peak bar highlighted in the accent color). Pure CSS
  bars keep it dependency-free; hovering a bar shows a `title` tooltip with the
  hour and value. The container carries a `role="img"` label for assistive tech.
- **Incident table**: rows are sorted by severity (critical → low). Clicking a
  row (or focusing it and pressing Enter/Space) selects it, highlights it, and
  populates the detail panel. The row is keyboard-focusable (`tabindex="0"`).
- **Filters**: severity dropdown, status dropdown, and a free-text search
  (matches ID, title, service, owner) combine conjunctively. The header count
  reflects the filtered row count. When no rows match, an empty state with a
  "Clear filters" button appears.
- **Acknowledge**: the primary action in the detail panel sets the incident
  status to `acknowledged`, assigns "Operator" if the owner was Unassigned,
  updates the table/status pill, and disables the button with an explanatory
  note. A secondary "Mark resolved" action sets status to `resolved`.
- **Clock**: the top bar shows a live UTC clock, updated every second.

## Accessibility choices

- Semantic landmarks: `nav[aria-label]`, `header`, `main`, `section[aria-label]`,
  `aside[aria-label]`, and a real `<table>` with `scope="col"` headers.
- Visible keyboard focus everywhere via `:focus-visible` outlines in the accent
  color (inset outline for table rows so it doesn't clip).
- Severity is conveyed by both a colored dot and a text label (never color
  alone); statuses are text pills.
- Numeric columns use `font-variant-numeric: tabular-nums` and monospace fonts
  for stable digit alignment.
- The chart is decorative-plus-informative: bars are `aria-hidden` and the
  container exposes a text summary via `role="img"` + `aria-label`.
- The detail panel is focusable (`tabindex="-1"`) and receives focus on
  selection so keyboard/screen-reader users land in context.
- All controls are native `button`/`select`/`input` elements with associated
  visible labels; the acknowledge button exposes its disabled state natively.
- Color contrast: body text `#d7dce2` on `#101214` (~13:1); dimmed text stays
  above 4.5:1 against panel backgrounds.

## Responsive behavior

- ≥1080 px: 4 metric columns; table and detail side-by-side.
- ≤1080 px: 2 metric columns; detail panel stacks under the table.
- ≤720 px: rail narrows, clock hides, padding tightens.
- ≤420 px (incl. 390 px): metrics stay at 2 columns with smaller numerals,
  chart shortens, filters wrap, table cell padding shrinks, and the detail meta
  grid collapses to one column. The table wrapper scrolls horizontally *within
  its panel* (`overflow-x: auto` on `.table-wrap`), so the page itself never
  scrolls horizontally at 390 px.

## Visual direction

Calm, high-density, dark control-room aesthetic: near-black neutrals
(`#101214`–`#1f232a`), hairline borders, 3–4 px radii, compact 10–14 px spacing,
one restrained blue accent (`#4da3ff`) reserved for interactive/selected states,
and a fixed severity palette (red / amber / yellow / gray). No gradients,
glassmorphism, or decorative effects; typography is system sans with monospace
for all numerics and identifiers.
