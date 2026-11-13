# Relay — operations control room

Open `index.html` directly from disk. There is no build step, no dependency,
no font or asset download, and the page makes no requests.

| File | Role |
|---|---|
| `index.html` | Structure, icon sprite, and an inline copy of `DATA.json` |
| `styles.css` | Tokens (light and dark), layout, components, breakpoints |
| `app.js` | Rendering, filtering, selection, acknowledge, chart, navigation |

## Hierarchy

The page reads top to bottom in the order an operator triages.

1. **Top status bar** answers "is anything on fire": highest active severity,
   active count, and unacknowledged count, all derived from the incident list.
   The unacknowledged count drops as you acknowledge.
2. **Summary metrics** are one strip of four cells, not four cards. The value
   is the largest text on the page at 24 px; nothing else is larger.
3. **Throughput** is a single-series line chart with the peak and latest hour
   labelled directly, and peak, low and mean stated in the panel header.
4. **Incidents** is the working surface: filters, then the table.
5. **Incident detail** sits to the right of the chart and table on wide
   screens and stays pinned while the page scrolls. Below 1100 px it follows
   the table.

Visual restraint: warm-neutral surfaces separated by 1 px hairlines and 3 px
corners, with no gradients, blur, or shadows on panels. Blue is the only
accent and it means "selected, focused, actionable, or the data series".
Red, orange and amber appear only on severity marks and on the two metric
deltas that are good or bad. Identifiers (incident IDs, service names) are
monospaced; numbers that stack in columns use tabular figures and
right-alignment, so `12m` and `1h 08m` line up on the unit.

## Interaction behaviour

- **Navigation rail** links jump to the four sections and the current one is
  marked. Under 760 px it becomes a fixed bottom bar.
- **Filters** combine: free-text search across ID, title, service, owner,
  status and severity; severity toggles (none pressed means all); a status
  select; and "Unacknowledged only". Each severity chip shows how many
  incidents it would match given the other filters. The header shows
  "n of 4" and a Clear filters button whenever a filter is active.
- **Empty and filtered states**: when nothing matches, the table is replaced
  by a message naming the active filters, with a clear button. If the selected
  incident is filtered out, the detail panel keeps showing it and says so,
  with its own clear link. Separate messages cover an empty incident list,
  missing metrics and missing throughput. If the seed data cannot be read,
  the page says status is unknown rather than showing an all-clear.
- **Selection**: click anywhere on a row, or activate the incident button in
  it. Up, Down, Home and End move between rows. The detail panel has
  previous and next buttons that step through the filtered list. On
  single-column layouts, selecting a row scrolls to the detail panel and
  moves focus to its title; "Back to incident list" returns to the same row.
- **Acknowledge** records the time and marks the incident as seen by you.
  An `open` incident moves to `acknowledged`; `investigating` and `monitoring`
  keep their status and gain a check mark. The top bar, rail badge, table,
  detail fields and a per-incident session log all update. **Undo** restores
  the previous state. Pressing `A` acknowledges, but only while focus is in
  the incident table or detail panel and never while typing.
- **Chart**: pointer or touch scrubbing shows a crosshair and a tooltip with
  the value, the hour, and the change from the previous hour. A Chart/Table
  toggle swaps in the same 24 values as a table.
- **Theme** follows the OS and can be switched from the top bar. The choice
  is stored in `localStorage` when available.

## Accessibility choices

- Landmarks (`header`, `nav`, `main`, `aside`, a `search` form), one `h1`,
  a heading per panel, and a skip link to the incident table.
- Every interactive element has a visible 2 px focus ring in the accent
  colour. Scroll padding keeps focused items clear of the sticky top bar and
  the mobile bottom bar.
- Severity is never colour alone: a four-step bar glyph encodes the level by
  shape and a text label sits beside it. Metric trends pair colour with an
  arrow and a word (Improving, Worsening, Rising).
- The incident table is a real table with a row header per incident. It has
  explicit ARIA table roles so it stays a table for assistive technology when
  rows are restyled as stacked blocks under 680 px.
- The chart is exposed as a slider: arrow keys, Page Up/Down, Home and End
  move through the hours and each position is announced as "19:00, 88". The
  table view gives the same data without the chart.
- Selection uses `aria-current`; toggles use `aria-pressed`. A polite live
  region announces selection, filter result counts, and acknowledge or undo.
  After an action, focus moves to the control that replaced the one you used.
- Text contrast is at least 4.5:1 and control borders, severity marks and
  focus rings at least 3:1, computed for both themes against every surface
  they sit on. Touch layouts raise form controls and actions to 36–40 px.
- `prefers-reduced-motion` turns off smooth scrolling, and a `forced-colors`
  block hands colours back to the system palette.

## Assumptions to check

- **Seed data is inlined.** Browsers block `fetch` of local files on
  `file://`, so `index.html` carries a verbatim copy of `DATA.json` (I
  confirmed the two parse to identical data). If `DATA.json` changes, update
  that block. The top bar labels the page "Static snapshot" for this reason.
- **Throughput has no unit in the data**, so the chart shows none. I labelled
  the 24 values as hours 00:00–23:00 because the shape looks like a daily
  cycle; they could equally be "the last 24 hours ending now".
- **Metric polarity is my judgement**: lower is better for latency, error
  rate and queue depth; events per minute is neutral. The data gives no
  comparison period, so none is claimed.
- **Acknowledge semantics are invented** for this demo, as described above.
  It does not assign an owner, and state resets on reload.
- The detail panel shows only fields that exist in the data. I did not make
  up impact summaries or timelines.

## Verification

I drove the page in headless Firefox 160 with a scripted run of 72 checks
covering rendering, selection, acknowledge and undo, the keyboard shortcut,
every filter, empty states, focus placement, chart keyboard and pointer
behaviour, the theme switch, and the mobile flow. All pass. I separately
loaded copies with empty and with corrupt seed data to confirm those states.
I also measured
16 widths from 320 to 1600 px, including 390 px: none scrolls horizontally
and no element extends past the viewport.

Not covered: Chromium and Safari, a real screen reader, and a physical touch
device. Node would not start on this machine, so the contrast figures come
from my own WCAG calculation rather than a packaged checker.
