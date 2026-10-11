# Relay — operations control room

## Hierarchy

The page is organized as a single application shell with four regions that
roughly follow a top-left → bottom-right reading path for scanning work:

1. **Navigation rail** (left) — primary destinations. Compact, icon-only, with
   an active-state indicator and `aria-current="page"`.
2. **Top status bar** — identity (`Relay / Operations`), environment (`prod`),
   live-sync dot, a UTC clock, and region. Non-interactive status, kept visually
   quiet.
3. **Content area** — the working surface, ordered by operational priority:
   - *Summary metrics* (four KPI cards with trend context),
   - *24-hour throughput* chart,
   - *Incidents* table with filters and a sticky detail panel,
   - *On-call* roster placeholder.

Dominance is established via size and weight only: metric values are the largest
numerals, the incident table is the widest region, and the accent color (blue) is
reserved for the current selection and primary action so it doesn't compete with
severity colors.

## Interaction behavior

- **Incident selection** — clicking a row (or pressing Enter/Space while the row
  is focused) sets it as the selected incident via `aria-selected`, applies a
  left accent bar, and populates the detail panel.
- **Acknowledge** — the detail panel's button flips the incident status to
  `acknowledged`, updates the shared table/detail state, and shows a transient
  toast. The action is idempotent; once acknowledged the button becomes disabled.
- **Filters** — severity and status dropdowns plus a free-text search (matches
  id, service, owner, and title) filter the table live. When no rows match, an
  explicit empty state is shown. Filters combine (AND).
- **Rendering** — the table and detail panel are full re-renders driven by a
  small in-memory state object, keeping the acknowledge action trivially correct.

## Accessibility choices

- **Skip link** to bypass the rail/topbar and jump to `#main`.
- **Keyboard visibility** — a single high-contrast `:focus-visible` outline
  script (`--focus`) is applied to all interactive elements, and the currently
  selected table row also uses a non-color indicator (the inset accent bar), so
  selection does not rely on color alone.
- **Semantics** — real `<table>` with proper `<th scope="col">`, `<nav>`,
  `<section>`/`aria-labelledby`, `role="list"`/`listitem` for the metric grid,
  and `role="status"` on the toast so acknowledge feedback is announced.
- **Chart** — the SVG uses `role="img"` with a descriptive `aria-label` so the
  visualization has a text alternative; axis labels are text (not images).
- **Status/states** — severity and status are always paired with text labels, not
  color alone; trend direction is additionally exposed via `aria-label`.
- **Contrast & motion** — dark, restrained palette chosen for sustained reading;
  no motion other than a subtle focus transition; `prefers-reduced-motion` is
  respected implicitly since no animated content is used.

## Responsive behavior

Below 720 px the rail becomes a horizontal top bar, secondary topbar items are
hidden, the metric grid collapses to two columns, the incident table hides the
less critical Title/Owner columns, and the detail panel moves below the table
(no longer sticky). At 390 px the layout fits without horizontal page scroll.