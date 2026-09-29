# Relay — operations control room

Relay is a single-page operations dashboard built from three local files:
`index.html`, `styles.css` and `app.js`. There are no frameworks, packages,
external fonts, remote assets or network requests. Content is seeded from
`DATA.json`: when the page is served over HTTP it is fetched; when the file is
opened directly from disk (`file://`, where `fetch` is not allowed) the identical
copy embedded in `index.html` as `<script type="application/json">` is used.

## Hierarchy

The page is organised so that an operator can answer, in order, "is anything on
fire?", "how is the system trending?", and "what do I do next?".

1. **Shell.** A 64 px navigation rail on the left and a 44 px status bar on top.
   The rail carries the section links (Overview, Incidents with a live count
   badge, Services, Alerts, Runbooks, Settings) and nothing else. The status bar
   holds the wordmark, environment/region, a computed system-status pill
   (`Degraded · 1 critical, 1 high` — derived from the active incidents, so it
   changes as incidents change), the on-call engineer, a UTC clock and a theme
   toggle.
2. **Four summary metrics** as stat tiles: label, value in proportional figures,
   and a signed delta against a named window ("vs. prior hour"). The delta is
   coloured by *direction × whether that direction is good* — a rising error
   rate is red, a rising event rate is green — and a visually hidden
   "favourable / unfavourable" note carries the same meaning to screen readers.
3. **24-hour throughput** as an inline SVG column chart rendered by `app.js`.
   It is an *emphasis* chart: every hour is a neutral bar, only the current hour
   wears the accent, the single extreme (the peak) is direct-labelled, and a
   dashed reference line marks 85 % of provisioned capacity. Gridlines are solid
   hairlines; bars are at most 24 px wide with rounded data-ends, square
   baselines and a 2 px surface gap. The header summarises Now / Peak / Low /
   Mean with their hours, and a collapsed "Data table" gives the same 24 values
   as a real table.
4. **Incidents.** A filter row (search, severity segmented control with counts,
   status select, clear) sits above a dense table: Severity, Incident (id +
   title), Service, Age, Owner, Status. Rows are 36 px, ages are right-aligned
   with tabular figures, ids and services are monospaced, and severity badges
   share one fixed width so the column reads as a strip. Critical is the only
   filled badge; High/Medium/Low are outlined, so the most important state is
   also the heaviest.
5. **Detail panel.** A sticky 340 px sidebar on desktop, a bottom sheet on
   phones. It shows the badge and id, the title, six facts (service, status,
   opened, age, owner, acknowledged), the actions, and a timeline built from the
   incident's own data (detected, routed, status set) that grows as the operator
   acts.

Visual direction: one neutral surface system with a single accent (blue) used
only for selection, the primary action, focus and the current-hour bar. Red,
orange, amber, green and gray are reserved status colours and never reused for
decoration. Radii are 4 px, shadows are 1 px, there are no gradients or
oversized headings; the largest text on the page is a 24 px metric value.

## Interaction behaviour

- **Filtering** is live. Search matches id, title, service and owner; severity
  buttons are `aria-pressed` toggles that also show how many incidents exist at
  each level; status is a native select. "Clear filters" appears only when a
  filter is active. The header switches between "4 active · 3 unacknowledged"
  and "Showing 2 of 4" (in a polite live region).
- **Sorting** by any column via the header buttons; the active column exposes
  `aria-sort`. Default order is severity, then age.
- **Selection.** Click or press Enter/Space on a row. The selected row gets
  `aria-current="true"`, an accent wash and a 3 px accent edge; the detail panel
  fills, and a short announcement ("Selected INC-2839, High, event-router: EU
  retry queue growth") is sent to the live region. If the selected incident is
  later hidden by a filter the panel says so and offers "Show it".
- **Acknowledge** is a real state change: it stamps the incident with the time
  and operator, moves an `open` incident to `acknowledged`, claims an
  unassigned incident for the operator, appends a live timeline entry, updates
  the table, the "unacknowledged" count and the row's status cell (non-open
  incidents keep their status and gain a small "ack" mark). A toast confirms the
  change and offers **Undo** for eight seconds, which restores the snapshot. The
  button then reads "Acknowledged" and is `aria-disabled` rather than
  `disabled`, so keyboard focus is not dropped.
- **Copy ID** uses the async clipboard API with an `execCommand` fallback and
  reports the result in a toast.
- **Chart hover and keyboard.** Every hour has a full-slot hit target (not just
  the painted bar); hovering lifts the bar and shows a value-first tooltip
  ("72 % · 06:00 UTC"). The SVG is focusable; Left/Right/Home/End step through
  the hours with the same tooltip, Escape hides it.
- **Keyboard shortcuts.** `/` focuses the search from anywhere; Escape clears a
  non-empty search, or closes the mobile sheet.
- **Live time.** The clock ticks every second in UTC. Incident ages from the
  seed ("1h 08m") are converted into opened timestamps at load, so the Age
  column and the detail panel keep counting up (every 30 s) instead of being
  static strings.
- **Theme.** Auto/Light/Dark cycle stored in `localStorage` (guarded with
  try/catch); auto follows `prefers-color-scheme`. Dark mode uses its own token
  set rather than an inversion.
- **Empty states.** No matches: "No incidents match — No high incidents with
  status open matching "eu". 4 active incidents are hidden by the current
  filters." with a Clear filters button. No incidents at all: "All clear". No
  selection: the panel explains what to do and how to move with the keyboard.
  Data unavailable: a dedicated error block replaces the grid.

## Accessibility choices

- **Landmarks and structure:** `nav` (Primary), `header`, `main` with a
  skip link, `section`s labelled by their headings, `aside` for the detail
  panel, and real `table`s with captions and `th scope="col"`.
- **Roving tabindex in the table.** Exactly one row is in the tab order; Arrow
  Up/Down, Home and End move between rows, Enter/Space selects. Tabbing past the
  table costs one stop, not one per row.
- **Focus is always visible.** Every focusable element uses a 2 px accent
  `:focus-visible` outline with offset; elements clipped by `overflow: hidden`
  (segmented buttons, header buttons, rail items) use a negative offset so the
  ring is never cut off.
- **Focus management on phones.** Selecting a row opens the sheet and moves
  focus to its heading (`tabindex="-1"`); closing it (button, backdrop or
  Escape) returns focus to the originating row. When the sheet is closed it is
  `visibility: hidden`, so its controls are not reachable off-screen.
- **Never colour alone.** Severity and status always have a text label; the
  critical badge is additionally filled; unassigned owners are text-flagged;
  metric deltas carry arrows, signs and a hidden favourable/unfavourable note;
  the chart has a text summary, a direct label, a tooltip and a table twin;
  `aria-label` on the SVG states peak, low, mean and now.
- **Live regions:** a polite announcer for selection, filter clearing and
  undo; the results summary and the toast region are also polite live regions.
  Toasts are dismissible and pause nothing.
- **Contrast.** Every text/background pair was computed, not eyeballed: all
  text meets 4.5:1 on its surface in both themes, including the lightest muted
  text (#6b7280 on white, 4.8:1; #8a919d on #1a1d22, 5.3:1), badge text on its
  10 % tint, and the filled critical badge, which uses the theme's inverse ink
  rather than hard-coded white so it also passes on the lighter dark-mode red.
  Status colours were re-stepped for dark surfaces rather than reused.
- **Motion and preferences:** `prefers-reduced-motion` disables transitions;
  `color-scheme` is declared so native controls match the theme.

## Responsive behaviour

- ≥ 1180 px: two columns (content + 340 px sticky detail).
- 720–1179 px: single column, detail panel stacks under the table.
- < 720 px: the rail becomes a fixed bottom tab bar; the detail panel becomes a
  bottom sheet above it with a backdrop; the table folds Service, Owner and the
  Severity column into the incident cell (badge + id, title, "service · owner")
  so Age and Status still fit; the environment label leaves the status bar.
- < 480 px: metrics go 2×2, the clock drops seconds, the status pill uses a
  shorter variant ("Degraded · 1 critical"), and the metric comparison window
  sits on its own line so all four tiles wrap identically.

At 390 px the document's scroll width equals the viewport width — there is no
horizontal page scroll — and this was checked in headless Chromium along with
the keyboard flows, the acknowledge/undo cycle and the empty state.

## Assumptions

- The throughput series has no unit in `DATA.json`; it is presented as percent
  of provisioned capacity with an 85 % reference line, which gives the 0–100
  axis a concrete meaning for operators.
- The 24 values are treated as the 24 hours ending at the current UTC hour, so
  the axis shows real clock hours.
- The acting operator is shown as "You"; the seeded on-call engineer (M. Chen)
  is displayed in the status bar.
- Acknowledgements live in memory for the session; nothing is written back to
  `DATA.json`.
