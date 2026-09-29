# Relay — design notes

Single-page operations dashboard. Local HTML/CSS/JS only: no frameworks, fonts,
images, or network calls. Seed content is embedded from `DATA.json` at load time
so the page works from `file://`.

## Information hierarchy

1. **Navigation rail (left)** — fixed product chrome. Overview is active; other
   entries deep-link to in-page sections. Collapses to an icon strip on mobile.
2. **Top status bar** — product name, fleet health pill (“All systems nominal”),
   region and shift context, live clock, signed-in operator. Sticky so health
   context stays visible while scrolling.
3. **Summary metrics (first content row)** — four equal cards: Events/min,
   P95 latency, Error rate, Queue depth. Each pairs a large tabular figure with
   a trend line (arrow + delta + “vs prior hour”). Direction is encoded in text
   and color: up-bad (error rate) and down-good (latency, queue depth) use
   severity colors so operators can judge health without parsing sign convention.
4. **24-hour throughput** — inline SVG line chart (semantic `<title>`/`<desc>`)
   with grid, area fill at low opacity, peak marker, and hour ticks. Sits above
   the incident list so operators see volume shape before triage.
5. **Incidents** — filterable table as the work surface: severity, ID, title,
   service, age, owner, status. Sorted by severity rank then ID. Filters live in
   the panel header (severity, status, service, search + reset).
6. **Detail panel** — selection sink. Title, severity/status badges, key/value
   grid (service, age, owner, status), runbook note, and the acknowledge action.

Visual language: neutral slate surfaces, 1px borders, 4px radii, 13px base type,
one accent (blue) reserved for selection, focus, chart, and primary action.
Severity uses a fixed four-color set (red/orange/amber/green) used only for state,
never decoration. All numeric columns use `font-variant-numeric: tabular-nums`.

## Interaction behavior

| Action | Behavior |
| --- | --- |
| Select row (click or Enter/Space) | Sets selection, re-renders table highlight and detail panel |
| Arrow Up/Down in table | Moves focus between rows without selecting |
| Filter change (select/input) | Live re-filter; table meta shows “Showing X of Y · filtered” |
| No matches | Empty state with explanation and **Clear filters** CTA |
| Reset / Clear filters | Restores all filters and full table |
| **Acknowledge** | Sets status to `acknowledged`, assigns `J. Okonkwo` if unowned, stamps time, shows toast and in-detail banner; button disables and switches to confirmed style |
| Clock | Updates every second (local, 24h, tabular) |

Acknowledged incidents remain in the list with an `Acknowledged` status tag so
the queue keeps history; the status filter includes that state. Service options
are derived from the seed incidents so the control cannot point at empty sets.

Chart values come from `DATA.throughput` (24 hourly points, 20–88k). Peak is
labeled inline; legend restates peak/low for operators who skip the SVG.

## Accessibility choices

- **Landmarks**: `banner`, `nav` (labeled “Primary”), `main` with `tabindex="-1"`
  and a skip link as first focusable element.
- **Tables**: real `<table>` with `<caption class="sr-only">`, `scope="col"`
  headers. On mobile, rows become stacked cards via CSS only; `data-label`
  attributes restore field names so content is not unlabeled.
- **Keyboard focus**: global `:focus-visible` 2px outline (light blue, 2px
  offset). Table rows are focusable buttons (`role="button"`, `aria-pressed`
  for selection). Enter/Space activates; arrows navigate. Detail panel and main
  accept programmatic focus after keyboard selection.
- **Severity/status**: never color-only. Each severity has a text label plus a
  colored square; each status is a text tag with a border tint. Trend arrows are
  paired with signed text (`+8.2%`, `−12 ms`).
- **Live regions**: status pill (`aria-live="polite"`), table meta count,
  and toast (`role="status"`) announce filter and acknowledge outcomes.
- **Filter labels**: every control has a visible uppercase label tied by
  `<label>`; search is `type="search"`. Reset buttons are real `<button>`s.
- **Chart**: `role="img"` with `aria-labelledby` to title/desc. Desc states
  min/max and peak hour so the series is available to screen readers. X-axis
  labels are `aria-hidden` decorative repeats of the desc.
- **Contrast**: body text `#d7dde3` on `#0f1215`/`#151a1f` (~11:1); dim text
  limited to secondary labels; accent and severity colors used on dark surfaces
  with weight ≥ 600 where size is small.
- **Motion**: no required animation; clock and toast are instant state updates.
- **Touch**: mobile buttons and rows meet ~40px targets; sticky rail/topbar keep
  chrome reachable.

## Responsive rules (390 px)

Breakpoint at 760px then 420px. Below 760px: rail becomes a horizontal icon
bar, metrics drop to 2×2, filters wrap to full-width fields, table rows stack
as labeled cards, detail actions go full width. Page uses `minmax(0, 1fr)`
tracks and `overflow-x: auto` only inside the desktop table wrapper — the
document itself never scrolls horizontally at 390px.

## Files

- `index.html` — structure, landmarks, static shell
- `styles.css` — tokens, layout, severity/status, focus, breakpoints
- `app.js` — embedded seed, chart render, filters, selection, acknowledge
- `DATA.json` — source seed (unmodified)
- `TASK.md` — brief (unmodified)
