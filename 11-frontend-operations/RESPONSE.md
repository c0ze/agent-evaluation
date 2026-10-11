# Relay — operations control room

Files: `index.html`, `styles.css`, `app.js`, `RESPONSE.md`, plus the supplied
`DATA.json`. Everything is local: system font stacks, inline SVG icons, no
frameworks, no package installs, no remote assets, no network calls at runtime.

## Visual direction

Calm, high-density control-room software. One neutral surface hierarchy
(`--bg` → `--surface` → `--surface-2`) with a single purposeful accent (blue)
used only for interactive state, selection and the primary action. Severity and
status carry their own small reserved colours (critical red, high amber, medium
yellow, low neutral; open/acknowledged/resolved), so colour is always
informational, never decorative. No glassmorphism, no gradients, no oversized
headings; radii are 3–5 px and spacing runs on a 4 px rhythm.

Numeric alignment is treated as a first-class concern: every figure in the
metric row, the table age column and the chart axis uses
`font-variant-numeric: tabular-nums` in a monospace stack, the table uses
`table-layout: fixed` with declared column widths, and ages are
right-aligned so digits line up down the column.

Two themes are provided from one token set (`data-theme="dark"` by default,
toggled in the status bar and persisted to `localStorage`).

## Information hierarchy

1. **Status bar** — breadcrumb plus the single most important fact: current
   system health (`All services nominal` / `Degraded · n critical`). A UTC
   clock ticks every second; the on-call operator and notification shortcut sit
   at the far right.
2. **Navigation rail** — persistent primary navigation with an unresolved-incident
   count badge on the Incidents entry. Collapses to icons at ≤1240 px and to a
   horizontal strip at ≤860 px.
3. **Four summary metrics** — value, delta with direction arrow, and a 14-point
   sparkline for trend context. Trend tone is semantic, not naive: for latency,
   error rate and queue depth a downward movement is judged good (green) and
   upward bad (red), the reverse of throughput.
4. **24-hour throughput chart** — inline SVG built from `DATA.json`: gridlines
   with y-axis labels, an area-and-line series, a dashed mean reference line,
   x-axis labels every three hours, and an explicit peak annotation so the
   busiest hour is readable without hovering.
5. **Incident queue** (primary work surface) — sortable grid: severity, incident
   (id + title), service, age, owner, status. Sorted critical-first by default.
6. **Detail panel** (right rail) — context and actions for the selected row.
   Scanning order is therefore: *is anything wrong? → how bad? → what is it? →
   what do I do about it?*

## Interaction behaviour

- **Filtering** — a search box (matches id, title, service, owner, status),
  multi-select severity chips, status and service selects, an *Unassigned only*
  toggle and a *Hide resolved* toggle (on by default, so the queue shows work
  that still needs someone). The count line states exactly what is on screen,
  e.g. `Showing 3 of 13 incidents · 2 filters active`, and a **Clear filters**
  button appears whenever a filter is active.
- **Sorting** — clicking any column header sorts it; clicking again reverses.
  Age sorts numerically (parsed from `12m` / `1h 08m`) and defaults to
  descending (oldest, i.e. longest-neglected, first). `aria-sort` follows the
  active column.
- **Selection** — clicking a row opens it in the detail panel; the selected row
  shows an accent inset rule and a tinted background. A close control clears the
  selection and returns the panel to its prompt state.
- **Acknowledge** — the primary action, enabled only while an incident is
  `open`. Pressing it moves the incident to `Acknowledged`, records
  *acknowledged by you*, updates the row, the health pill and the rail badge,
  replaces the button group with an acknowledgement confirmation, and raises a
  toast. Related actions behave the same way: **Investigate**, **Resolve**,
  **Reopen**, **Assign to me** (offered when the owner is `Unassigned`) and
  **Snooze 30m**.
- **Liveness** — ages tick upward on a 30 s cadence and the chart exposes a
  hover/focus tooltip for any hour.
- **Empty and filter states** — three distinct rests: a no-match state that names
  the active filters and offers to clear them, an all-clear state when nothing
  is unresolved, and a detail-panel prompt when no row is selected.

## Accessibility choices

- Semantics: one `<h1>`, landmark regions (`nav`, `header`, `main`, `aside`), a
  real `<table>` with `role="grid"`, `role="row"`/`gridcell"`/`columnheader"`
  and `aria-selected` on rows. Buttons are `<button>`s; filters are labelled
  controls (visible labels or `.sr-only`).
- Keyboard: skip link; full grid navigation with ↑/↓/Home/End and Enter/Space to
  open, using a roving tabindex so the queue is a single tab stop. Chart hours
  are focusable with descriptive `aria-label`s. `/` focuses search, `Escape`
  clears it.
- Focus: a 2 px accent `:focus-visible` outline with an offset, applied to
  rows, buttons, inputs, selects and chart bars — never removed.
- Feedback: toasts live in an `aria-live="polite"` region; the result count is a
  `role="status"` so filtering is announced; the detail panel is `aria-live`
  and `tabindex="-1"`. After an action removes its own button, focus is moved
  deliberately to the next action rather than being dropped to `<body>`.
- Colour: state is never conveyed by hue alone — severity and status always
  carry a text label (e.g. `Crit`, `Acknowledged`), unassigned owners read
  "Unassigned", and `prefers-reduced-motion` disables transitions.

## Responsive behaviour

- ≤1240 px: rail collapses to icons.
- ≤1080 px: work area stacks (table above detail panel); metrics go to 2 × 2.
- ≤860 px: rail becomes a horizontally scrollable strip; the page is a single
  column.
- ≤640/480 px: search and checkboxes take a full row, the owner column is
  hidden, action buttons go full-width.
- Verified in a headless Chrome pass at 390 px: `documentElement.scrollWidth`
  equals the viewport width, so the page never scrolls horizontally. The table's
  internal `overflow-x: auto` container absorbs the column width instead of
  pushing the layout.

## Data

`app.js` requests `DATA.json` first and falls back to an inline copy of the same
seed (kept in sync at the top of the file) so the dashboard also renders when
opened directly from disk where `fetch` on `file://` is blocked. Nine further
realistic incidents extend the four from `DATA.json` so that filtering, sorting,
severity distribution, ownership and empty states are all exercised; the supplied
four always keep their original field values and appear first in the source.
