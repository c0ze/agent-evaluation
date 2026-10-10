# Relay: design response

Relay is a single-page operations dashboard built with plain HTML, CSS and JavaScript (`index.html`, `styles.css`, `app.js`). It uses system font stacks only and makes no network requests: no frameworks, remote assets, CDN links or `fetch()` calls. Open `index.html` directly in a browser.

## Visual hierarchy

The page is organised by how an operator scans it: state of the system, then shape of the load, then what needs action, then the detail of one thing.

1. **Top status bar (answers "is anything on fire?").** The most saturated element on the page is the system pill (`1 critical, 1 high open`). It is derived from the incident data, not hard-coded. Next to it sit the environment chip, a live UTC clock and the operator. A narrow rail on the left holds navigation and an unacknowledged-incident badge.
2. **Four summary metrics.** These sit in one bordered strip, divided by hairlines rather than separate cards. The value is the largest text on the page (26 px, tabular figures), with a muted label above and trend context below: arrow, delta, verdict and baseline (`vs 24 h ago`).
3. **24 h throughput.** This is a plain bar chart with a single accent. Peak and inspected bars use the accent, the rest a lower-emphasis tint of it. Grid lines are hairlines, and a dashed line marks the mean. Peak, low and mean are stated in text above the plot.
4. **Incident table.** This is the working surface. Severity is the first column and the default sort. The title is bold with the ID in mono underneath, and the numeric age column is right-aligned with tabular figures.
5. **Detail inspector.** It occupies the right-hand column, with the primary action directly under the title so it is never below the fold. Facts follow, then impact, next step and timeline.

Restraint choices:
- One accent (blue) is used for selection, focus, the primary action and the chart data.
- Neutrals do the structural work: borders instead of shadows, 4 px radii, and 12 to 13 px text.
- Severity gets its own small semantic set (critical red, high orange, medium amber, low slate), kept muted and used only on badges and markers.
- Metric trends follow polarity, not arrow direction. Events per minute going up is neutral. Latency, error rate and queue depth are lower-is-better, so "P95 latency down 12 ms" reads green and "error rate up 0.08 pp" reads orange. Colour is always paired with the words "Improving" or "Worsening".
- There are no gradients, glass effects or display-size headings. The largest text is the metric figures (26 px), and the detail title is 17 px.

## Interaction behaviour

- **Selection.** Click anywhere on a row, or focus its button and press Enter or Space. The row gets an accent bar and tint, and the inspector updates. `ArrowUp`, `ArrowDown`, `Home` and `End` move focus between rows.
- **Filtering.** The controls are:
  - free-text search over ID, title, service, owner, status and severity, where every word must match;
  - multi-select severity toggles with counts;
  - `Unassigned` and `Unacknowledged` triage toggles;
  - a status select.

  The panel subtitle reports `n of 4 incidents match`. A `Clear filters` link appears only while a filter is active. If the current selection is filtered out, selection moves to the first visible incident.
- **Sorting.** Every column header is a sort button, with `aria-sort` on the header cell. The default is severity, highest first. Age sorts oldest first on the first click. On phones the same state is driven by a `Sort` select.
- **Empty states.** No matches shows an empty panel that names the active filters, with a `Clear filters` button. Focus returns to the search field after clearing. If nothing is selected, the inspector shows its own empty message.
- **Acknowledge.** The button records the operator (J. Rivera) and the UTC time. It then:
  - flips to `Undo acknowledgement`, and focus stays on the button;
  - adds a timeline event and an `Ack` tag in the table row;
  - updates the top-bar and rail-badge counts (`4` to `3`) and the `Unacknowledged` filter;
  - announces the change in a polite live region.

  Acknowledgement is deliberately separate from status, so an `investigating` incident stays `investigating`. If the `Unacknowledged` filter is on, the row that was just acknowledged stays visible until the filters next change, so it does not vanish from under the pointer.
- **Throughput chart.** Hovering or tapping a bar shows the hour, value and change against the previous hour. The chart is one tab stop: focus it and use `Left`/`Right`/`Home`/`End`, with `Esc` to clear. There is a `Chart` / `Table` toggle for exact values.
- **Responsive behaviour.**
  - At 1180 px and wider, the inspector is a permanent third column.
  - From 760 to 1179 px, the inspector becomes a right-hand drawer that opens on selection.
  - Below 760 px, the rail becomes a bottom tab bar, metrics form a 2 x 2 grid, table rows become stacked records, and the drawer is full screen.
  - There is no horizontal page scroll at 390 px or at 320 px.
- **Live details.** The clock ticks every second, and incident ages advance from their seeded values every 20 seconds. Both are text-node updates, so focus and selection are never disturbed. The theme follows the system setting, with a manual toggle remembered in `localStorage` (wrapped in `try/catch`).

## Accessibility choices

- **Landmarks and headings.** The page has `nav`, `header`, `main`, labelled sections and `aside`, with one `h1` and a sensible `h2`/`h3` outline. Two skip links jump to main content and to incidents. Navigation links use `aria-current="location"` and follow the scroll position.
- **Focus.** A 2 px accent outline with offset is shown via `:focus-visible` on every control. It is inset where clipping is possible (table cells, segmented controls). The chart plot and the table view are focusable, labelled regions.
- **Colour is never the only signal.** Severity is text plus a distinct shape (diamond, triangle, disc, ring). Trends have an arrow, a signed number and a word. Acknowledgement has an icon and text, with a screen-reader label.
- **Contrast.** The palette was checked with a script. Body and secondary text are at least 4.5:1 in both themes, severity text on its tint is at least 6:1, and the focus ring and control borders are at least 3:1. Dark mode is provided as well as light, and `forced-colors` has explicit fallbacks.
- **Table semantics.** Real `<table>`, `<th scope="col">` and `aria-sort` are used. Because CSS turns rows into stacked blocks on phones, which can strip table semantics in some browsers, the table elements carry explicit ARIA roles. Column headers stay in the accessibility tree on phones (visually hidden), and sorting moves to a native select.
- **Filters and toggles.** Toggles are real buttons with `aria-pressed`, and groups are labelled. Every input has a label (the search label is visually hidden). Result counts and acknowledgement outcomes go to `role="status"` regions.
- **Drawer as modal dialog.** In drawer mode the panel gets `role="dialog"` and `aria-modal`, and the rest of the page is `inert`. Tab is trapped inside, `Esc`, the close button and the scrim all close it, and focus returns to the row that opened it. Closed drawers use `visibility: hidden`, so they are not tabbable. Resizing back to desktop cleans this state up.
- **Touch and motion.** Touch targets are at least 36 to 44 px on phones, and form fields are 16 px there to avoid iOS zoom. The only motion is a 180 ms drawer slide, disabled under `prefers-reduced-motion`. Layout wraps rather than clips, and at 200% browser zoom a laptop viewport falls into the phone layout.

## Data, assumptions and verification

- `DATA.json` is embedded verbatim in `app.js`, because a page opened from `file://` cannot `fetch()` a sibling file. Metrics, the 24 throughput values and all four incidents are rendered from it.
- `DATA.json` carries no trend baseline or throughput unit. I labelled trends `vs 24 h ago`, treated the 24 values as hourly buckets from 00:00 to 23:00 UTC, and called the y-axis a "throughput index".
- The impact text, suggested next step and timeline times are illustrative supplements keyed by incident ID (`NOTES` in `app.js`). Timeline times are derived from the incident age.
- I checked the page in headless Chromium at 1440, 1180, 1024, 768, 390 and 320 px, in both themes. That covered no console errors, no horizontal overflow, filter, sort and empty states, acknowledge and undo, keyboard navigation and focus return, and drawer open/close and trap. It also confirmed that no non-`file:` requests are made.
