# Relay — Operations Control Room

Relay is a local-only, responsive single-page operations dashboard built with semantic HTML (`index.html`), vanilla CSS (`styles.css`), and vanilla JavaScript (`app.js`), seeded directly from `DATA.json` with zero frameworks, external fonts, remote assets, or network requests.

## 1. Visual Hierarchy & Layout System

- **Restrained Control-Room Palette**: Uses a low-glare neutral dark slate hierarchy (`#0d1014` canvas/rail, `#13171d` primary workspace surfaces, `#181e26` elevated toolbars, `#1b2535` active selection) separated by crisp `1px` structural hairline borders (`#232a35`) instead of floating rounded cards, drop shadows, gradients, or glassmorphism.
- **Single Purposeful Accent**: Signal blue (`#3b82f6` / `#2563eb` / `#7cb2ff`) is reserved strictly for active navigation, selected incident/bar indicators, interactive chart bars, primary actions (`Acknowledge incident`), and keyboard focus outlines.
- **Top-to-Bottom Operational Scanning**:
  1. **Left Navigation Rail & Top Status Bar**: Anchors system scope (`Control Room / All services`), live system health (`Degraded · 1 CRIT · 4 unack`), active regions, UTC clock, and quick service-scoped filters with live unacknowledged counters.
  2. **Four Summary Metrics Strip**: Hairline-divided 4-column telemetry band (`Events / min`, `P95 latency`, `Error rate`, `Queue depth`) using monospace tabular numerals (`font-variant-numeric: tabular-nums`), SLO thresholds, and directional delta badges whose color semantics reflect operational meaning (downward latency and queue depth are favorable; upward error rate is cautionary; upward ingress is neutral).
  3. **24-Hour Throughput Visualization**: Full-width inline SVG bar chart (`00:00`–`23:00 UTC`) with horizontal reference gridlines, a dashed 24-hour mean line (`AVG 57`), live header inspection readout, Peak/Avg/Min summary statistics, and a `Chart` / `Data` view toggle.
  4. **Incident Queue & Detail Split**: Side-by-side split on desktop (`>= 1120px`) pairing a compact sortable/filterable incident table with a persistent incident detail pane so operators can triage and acknowledge without modal interruption.
- **Mobile Layout (`390px`, Zero Horizontal Scroll)**:
  - Below `960px`, the navigation rail collapses into an off-canvas drawer toggled from the top status bar, and metrics reflow into a 2×2 hairline grid.
  - Below `680px`, the incident table transitions via CSS Grid into compact stacked operator rows (preserving severity, status, age, ID, title, service, and owner with no overflow), the SVG chart dynamically renders at native container width so axis typography stays legible without microscopic scaling, and the `Data` view stacks cleanly into single-column tables showing all 24 hours.

## 2. Interaction Behavior

- **Seeded Offline State**: All metrics, 24-hour throughput points, and incidents from `DATA.json` are embedded as the initial seed in `app.js` with realistic operational metadata (cluster/region, SLO impact, runbook ID, and chronological timeline entries) so the page works over both `file://` and `http://` with zero network requests.
- **Interactive 24-Hour Throughput**: Hovering, clicking, or keyboard-stepping across the 24 bars updates the live inspection bar (`19:00 UTC · 88k · +54% vs avg · Peak`). Toggling to `Data` displays all 24 hourly buckets and variance vs. the 24-hour mean in semantic HTML tables.
- **Multi-Facet Incident Filtering & Sorting**:
  - Operators can filter simultaneously by free-text search (ID, title, service, owner, severity, status), severity pills (`All`, `CRIT`, `HIGH`, `MED`, `LOW` with live counts), `Status` select, `Service` select, or rail service shortcuts (`payments-api`, `event-router`, `search-index`, `webhooks`) and `Active queue` (unacknowledged only).
  - Active filters appear as individually removable chips alongside a `Reset filters` action.
  - All six table columns support ascending/descending sorting (`aria-sort`), including numeric parsing of duration strings (`12m`, `1h 08m`, `3h 42m`).
- **Detail Panel & Working Acknowledge Action**:
  - Selecting any row updates the detail panel immediately.
  - Clicking **Acknowledge incident** (or pressing `A`) transitions the incident status to `acknowledged`, assigns `Unassigned` incidents to `On-call (You)`, records the UTC acknowledgement timestamp, prepends a timestamped entry to the activity timeline, updates the incident row, decrements the rail service/queue counters, and updates the top status bar health pill (`All incidents acknowledged` once all four are acknowledged).
  - Operators can also **Reopen** an acknowledged incident, **Assign to me**, or log new timestamped notes directly into the incident timeline.
- **Useful Empty & Filtered States**: When filter combinations return zero incidents (or when filtering `Active queue` after acknowledging all incidents), both the incident table and detail panel display clear, context-specific empty states explaining which active filters produced zero matches with one-click reset actions.
- **Operator Keyboard Shortcuts**: `/` focuses incident search, `J` / `K` steps through visible incidents, `A` acknowledges the selected incident, `←` / `→` / `Home` / `End` steps through throughput bars when focused, `?` opens the shortcut reference dialog, and `Esc` clears search focus or closes open overlays.

## 3. Accessibility Choices

- **Semantic Landmarks & Headings**: Uses `<aside aria-label="Primary navigation">`, `<header>`, `<main>`, `<section aria-labelledby="...">`, `<aside aria-labelledby="detail-heading">`, `<dl>` metadata grids, semantic `<table>` headers with `scope="col"` and `aria-sort`, and a focus-visible `Skip to main content` link.
- **Visible Keyboard Focus**: All interactive controls, table rows, filter pills, rail links, and SVG chart bars render a high-contrast `2px solid #7cb2ff` focus indicator via `:focus-visible`.
- **Roving Tabindex on Chart Bars**: The 24 SVG bars use roving `tabindex` (`0` on the active hour, `-1` on others) with `role="button"` and descriptive `aria-label` text so keyboard users reach the chart in one tab stop and step through hourly intervals with arrow keys, or switch to the `Data` table view.
- **Non-Color Severity Encoding**: Severity states never rely on color alone—each combines a high-contrast tinted badge, a distinct geometric marker (diamond for `CRIT`, triangle for `HIGH`, square for `MED`, circle for `LOW`), and an explicit monospace code.
- **Contrast & Live Announcements**: Text and control colors maintain WCAG AA contrast against dark slate surfaces (`#e8edf4` primary, `#a5b0c0` secondary, `#828fa2` muted on `#13171d`; `#ffffff` on `#2563eb` primary buttons). State changes (incident selection, filtering, acknowledgement, reopening, assignment, and note logging) are announced via a polite `aria-live="polite"` status region.
- **Motion Sensitivity**: Honors `@media (prefers-reduced-motion: reduce)` by disabling transition durations.
