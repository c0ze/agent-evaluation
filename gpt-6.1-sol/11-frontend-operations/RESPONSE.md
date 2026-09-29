# Relay operations console

All requested deliverables are implemented in `index.html`, `styles.css`, and `app.js`, with this document covering design and behavior. Open `index.html` directly in a browser. There is no build step, framework, package dependency, remote asset, external font, or application network request. A restrictive Content Security Policy also disables connections. `DATA.json` is embedded unchanged in JavaScript so the dashboard works from a local file without fetching JSON.

## Hierarchy and visual direction

The direction is industrial restraint: a warm neutral workspace, a charcoal navigation rail, compact data surfaces, and one teal accent for selection and actions. Severity colors are reserved for critical, high, medium, and low incidents. The design feasibility score is **14**: impact 4, context fit 5, feasibility 4, performance 4, minus consistency risk 3. The recognizable elements are the four-part Relay mark, the continuous metric strip, and the hourly bar profile paired with a severity-first response queue.

The status bar establishes workspace, critical count, and snapshot mode. Four metrics show the exact supplied values and directional changes; the rising error rate receives a caution color. Throughput provides context before the incident queue, whose selected row connects visually to the detail panel through the teal selection edge. Acknowledgment sits immediately below the incident title so the primary response action is easy to reach. Service, status, age, owner, response guidance, and activity provide the remaining detail.

Typography uses installed Helvetica Neue, Segoe UI, or Helvetica for labels and installed SFMono-Regular, Menlo, or Consolas for numbers and identifiers, with generic fallbacks. Tabular numerals and a right-aligned age column make numeric scanning consistent. CSS color tokens, spacing based on a four-pixel rhythm, thin dividers, and small corner radii keep the display dense. The only transitions are short color changes, enabled when reduced motion is not requested.

The source does not specify throughput units, a date, or the metric comparison window. The 24 values are presented as relative volume in hourly UTC buckets from 00:00 to 23:00; metric changes are labeled against the prior period. Ages and telemetry remain the supplied snapshot. The additional response guidance is illustrative operator advice, not new measurements or a live incident history.

## Interaction behavior

- Navigation links move to overview, throughput, or incidents and update the current-location indicator.
- Search matches incident ID, title, service, and owner, without case sensitivity and with surrounding whitespace ignored. Severity, status, and search filters apply together. Reset and the empty-state clear action restore all filters. Counts reflect the visible results, while the queue total includes every active incident.
- The first critical incident is initially selected. Selecting another incident updates all detail fields. A selection stays selected while it matches the filters; otherwise the first visible incident is selected. No results produce both a useful queue empty state and an empty detail panel.
- Acknowledge changes the selected incident's displayed status to Acknowledged, updates its table row, records a UTC timestamp in activity, and disables the repeated action. It preserves the owner and keeps the incident active. Undo restores the exact original status. If a status filter removes the changed incident, the selection moves to another matching incident or becomes empty, with an announcement and focus moved to search.
- Acknowledgments are saved under `relay.acknowledgments.v1` in local storage and survive reloads where browser storage is available. Other tabs receive storage updates. Known incident IDs and valid timestamps are checked before restoring state. Blocked storage falls back to session memory and the acknowledgment note reports that limitation. These actions stay on the device and do not contact a service.
- Each chart bar selects an hour and updates the exact value readout. Left/Right, Home, and End navigate a single chart tab stop. The native Hourly values disclosure provides all 24 values as text. Press `/` outside a form field to focus incident search; Escape in search clears its text while retaining the other filters.

## Accessibility and small screens

The page uses navigation, header, main, named sections, a complementary incident panel, a captioned HTML table, scoped column headers, native buttons/selects, and explicit form labels. Selection uses `aria-pressed`; details are connected with `aria-controls`. Severity and status always include text, and decorative icons are hidden from assistive technology. Counts and action results use polite live announcements. Search results are inserted with text APIs, so input cannot become HTML.

Every interactive control has visible keyboard focus. A skip link reaches the main workspace. Desktop incident selection retains focus on its table button; below 1200 px it focuses the detail heading and scrolls that panel into view. Acknowledgment moves focus to Undo, and undo moves it back to Acknowledge. The chart uses roving focus rather than adding 24 stops to the page's tab sequence. Forced-color styles preserve chart values and selected-row visibility.

Below 1400 px the rail contracts. Below 1200 px the detail panel follows the queue. At 640 px and below, navigation becomes a top row, metrics form a two-column strip, filters wrap, and each incident becomes a labeled compact record with all six fields retained. Explicit table roles preserve semantics when CSS changes the table display. Zero-minimum grid tracks, wrapping service/text fields, flexible controls, and the absence of a fixed table width support the 390 px target without a horizontally scrolling page. Mobile search uses a 16 px input font to avoid automatic zoom. Motion is minimal and respects reduced-motion preferences.

Measured color-token contrast is 14.31:1 for body text, 5.45:1 for muted text, 6.14:1 for the action accent on white, and at least 4.90:1 for each severity label against its background. Chart bars have 3.35:1 contrast against white.

## Verification

`node --check app.js` passed. Static HTML checks verified 56 unique IDs, all label/ARIA/fragment references, local resource paths, JavaScript element targets, and the absence of network APIs. An offline DOM harness executed the actual application script and passed **27 interaction checks**, including exact seed equality, filter intersections, empty states, safe search rendering, desktop/mobile focus behavior, acknowledgment and undo under active filters, restoration across initialization, corrupt/blocked storage, cross-tab updates, and chart keyboard navigation.

Rendered browser checks could not run in this sandbox: installed Chrome aborted at startup, and native WebKit encountered sandbox extension restrictions and timed out. Screenshots, real-browser geometry at 390 px, and assistive-technology behavior therefore remain unverified. The interaction harness does not measure layout. No network was used, and temporary verification programs and caches were removed after testing.
