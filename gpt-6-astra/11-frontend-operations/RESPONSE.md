# Relay — operations control room

All requested deliverables are implemented: `index.html`, `styles.css`, `app.js`, and this explanation. Open `index.html` directly in a browser. There are no dependencies, build steps, fonts to download, remote assets, network requests, or server requirements. `verify.mjs` supplies optional offline behavior checks using Node's built-in modules.

## Hierarchy and visual direction

The design takes an industrial, utilitarian direction: a narrow graphite rail, a quiet status bar, an off-white workspace, thin separators, and a restrained teal accent. The numbered metric strip and 24 evenly spaced throughput bars establish a consistent visual rhythm. Teal identifies selection, throughput, and the primary action; severity colors carry operational meaning. There are no gradients, glass effects, or oversized headings.

The hierarchy follows the operator's workflow: scan the four summary metrics, read the 24-hour throughput pattern, then triage the incident queue. A critical-incident link provides a direct route to the queue. On wide screens, the selected incident remains beside the table so its owner, service, status, and acknowledgement action can be read together. Navigation links lead to real page sections.

Local Helvetica-family text keeps the interface compact; a local monospace stack and tabular numerals align metrics, IDs, hours, and ages. Spacing uses a compact 4–8 px rhythm, with larger gaps reserved for section boundaries. Borders provide structure without heavy shadows or large rounded cards. Motion is limited to brief control-color transitions, and reduced-motion preferences disable them.

Design feasibility assessment: impact 3/5, fit 5/5, feasibility 5/5, performance 5/5, consistency risk 3/5; total 15. The brief's offline and neutral-palette requirements take precedence over decorative typography or downloaded resources.

## Data and interaction behavior

- The embedded snapshot in `app.js` exactly matches `DATA.json`, verified by the offline checks. Embedding allows `file://` use without a JSON fetch. The page explicitly identifies itself as a local demo. Ages remain the supplied snapshot ages.
- Metrics retain the original values and changes. “Reported change” avoids inventing a comparison period that the source does not provide. The rising error rate receives an amber treatment.
- The chart shows all 24 supplied values, with a labeled peak of 88 at sample hour 19. Since the source supplies neither measurement units nor dated timestamps, it is labeled as a relative index over sample hours 00–23. Expand “View hourly values” for all exact values.
- Search matches ID, title, service, owner, severity, and status, without case sensitivity. Severity and status filters combine with search. The result count updates, and clear controls restore the queue. No-match results show a recovery action and clear the incident detail.
- Click a row or activate its incident button to select it. Selection remains stable while it still matches the filters; otherwise the first matching incident is selected. In stacked layouts, selection focuses and scrolls to the detail panel. “Back to queue” returns to the selected incident.
- Acknowledging changes the local status to **Acknowledged**, updates the queue and remaining count, records a local timestamp, and disables the repeated action. It preserves ownership and does not resolve or remove an incident from the active queue. If the new status no longer matches a filter, the row leaves that filtered view.
- Acknowledgements persist in browser storage. Invalid saved data is ignored. If storage is unavailable, the action still works for the session and the page explains that limitation. “Reset demo” clears local acknowledgements and filters and restores the original statuses. No acknowledgement sends a notification or modifies an external system.

## Accessibility and responsive behavior

The page uses landmarks, labeled sections, native inputs and selects, a captioned table, explicit column headers, and a skip link. Incident buttons expose their selection through `aria-pressed` and their relationship to the detail through `aria-controls`. Severity and status always include text, so color is supplementary. The SVG chart has an accessible title and description, and its complete values are available as text.

Keyboard focus has a visible three-pixel outline. All actions work with native keyboard activation. `/` focuses search when the user is not editing a field; Escape in search resets the filters. Polite live regions announce filter counts and completed actions. When an action rebuilds the inspector, focus is explicitly retained on the detail panel.

Below 1260 px, the detail panel moves beneath the queue. At 720 px and below, the rail becomes a compact top navigation, metrics form a two-column grid, and filters wrap. Incident rows become stacked records while retaining all six fields and explicit table roles. At the requested 390 px width, the content uses 16 px side gutters and flexible columns; search, selects, and acknowledgement have 44 px control heights. The chart recalculates its geometry for its container rather than shrinking text with a desktop SVG. No fixed-width desktop table or horizontally clipped page is used on mobile.

## Verification and limits

Run `node --check app.js` and `node verify.mjs`. Both passed. The latter has **19 offline checks** covering seed fidelity, all severity filters, search, combined filters, empty recovery, selection, acknowledgement, persistence, duplicate actions, filtered acknowledgements, reset, malformed/unavailable storage, keyboard shortcuts, compact-layout focus behavior, all chart values and bounds, unique IDs, labels, and local-only assets.

HTML nesting was checked with Python's built-in HTML parser. Ten primary text/background pairs were checked numerically and exceed 4.5:1 contrast, including muted text, buttons, severity labels, and rail navigation. A restrictive content security policy additionally blocks network connections.

**Validation limitation:** the installed Chrome executable terminated with `SIGABRT` before opening a page in this sandbox. No browser screenshot, rendered 390 px overflow measurement, or assistive-technology test could be completed. The offline checks exercise the actual application code through a minimal DOM adapter; they do not substitute for a rendering engine. Responsive behavior was reviewed in the CSS and chart geometry, but visual verification in a normal browser remains recommended.
