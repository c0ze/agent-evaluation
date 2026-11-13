# Relay — Operations Control Room

## Overview & Files
- `index.html`: Semantic single-page application shell with skip link, navigation rail, top status bar, summary metrics strip, 24-hour throughput panel, split incident workbench (filterable table + detail inspector), and service health matrix.
- `styles.css`: Calm dark-graphite control-room styling (`#0d1015` canvas, `#13171f` panels, `#232a36` 1px structural borders, single `#4f8ff7` cobalt accent), `tabular-nums` alignment, compact spacing, zero glassmorphism or decorative gradients, and responsive desktop/tablet/mobile (`390 px`) layouts.
- `app.js`: Vanilla JavaScript state and rendering seeded directly from `DATA.json` (zero frameworks, zero external assets, and zero runtime network requests so the page runs reliably offline and over `file://`).

---

## Visual & Information Hierarchy
1. **Shell & Posture First (`nav-rail` + `topbar`)**:
   - The left navigation rail switches between four views (`Overview`, `Incidents`, `Throughput`, `Services`) while surfacing the live unacknowledged incident count badge (`#nav-incident-count`).
   - The top status bar anchors the active view title, a live posture indicator (`#posture-pill` transitioning across `Degraded` / `Elevated` / `Acknowledged` states as incidents are triaged), the 24-hour UTC window, and the active on-call operator (`K. Vance`).
2. **System Health Strip (`metrics-grid`)**:
   - Presents the four `DATA.json` KPIs (`Events / min`, `P95 latency`, `Error rate`, `Queue depth`) in a compact hairline-divided grid using `ui-monospace` and `tabular-nums` so digits align cleanly.
   - Trend badges encode **domain polarity** rather than raw direction: `P95 latency` (`−12 ms`, `down`) and `Queue depth` (`−19%`, `down`) use favorable green tones, `Error rate` (`+0.08 pp`, `up`) uses adverse amber warning tone, and `Events / min` (`+8.2%`, `up`) uses neutral volume styling alongside SLO/baseline context.
3. **Temporal Context (`throughput-panel`)**:
   - Full-width inline SVG chart plotting all 24 hourly throughput points (`00:00`–`23:00 UTC`), a dashed 24-hour mean line (`avg 57.2`), peak/trough summary (`Peak 88` at `19:00`, `Min 20` at `04:00`), and a compact readout badge for the currently inspected hour.
4. **Triage Workbench (`workbench`: `table-panel` + `detail-panel`)**:
   - Pairs the filterable incident queue (`Severity`, `Incident`, `Service`, `Age`, `Owner`, `Status`) side-by-side with the `Incident inspector` so row selection updates context immediately without modal interruption.
   - Severity badges pair distinct colors with geometric SVG glyphs (diamond for `Critical`, triangle for `High`, square for `Medium`, circle for `Low`) so severity never depends on color alone.

---

## Interaction Behavior
- **24-Hour Throughput Inspection**: Operators can toggle between `Bars` and `Line` modes (`#mode-bars`, `#mode-line`), hover or click/press `Enter`/`Space` on any of the 24 hourly buckets to inspect or pin that hour's value and delta vs. the 24-hour average, or browse the 24-bucket grid in the `Throughput` view.
- **Multi-Facet Filtering & Sorting**:
  - Live text search (`#filter-search`) matches across incident ID, title, service, owner, severity, and status.
  - Severity segmented buttons (`All`, `Critical`, `High`, `Medium`, `Low`), status select (`Open`, `Investigating`, `Monitoring`, `Acknowledged`), and service select combine cleanly via `AND` logic.
  - Column sort buttons sort by severity rank, service name, parsed numeric age in minutes (`parseAgeMinutes`), or status rank while preserving `aria-sort` state.
  - When active filters yield zero matches, the table hides cleanly and displays `#table-empty-state` summarizing the active filters (or guiding operators when filtering `Acknowledged` prior to any acknowledgements) with a keyboard-focusable `Clear all filters` action; `#detail-panel` shows a matching empty selection state (`#detail-empty`).
  - When a filter change hides a previously selected row while other matches exist, selection automatically advances to the first visible matching row so the inspector stays synchronized.
- **Acknowledge, Claim, Reopen & Timeline Notes**:
  - Selecting any row updates the `Incident inspector` (`#detail-panel`) with metadata (`Service`, `Owner`, `Age`, `Acknowledgement`, `Region`, `Runbook`), trigger signal, impact summary, and chronological timeline.
  - Clicking **Acknowledge incident** (`#acknowledge-btn`) transitions the incident's status to `acknowledged`, records the operator and timestamp (`Now`), auto-assigns `Unassigned` incidents (such as `INC-2839`) to `K. Vance`, prepends an acknowledgement entry to the timeline, updates the table row, updates the `Services` matrix, and updates the topbar posture badge and nav badge count. A secondary **Reopen** button restores the prior status (`open` / `investigating` / `monitoring`) if needed.
  - Unassigned incidents also provide a standalone **Claim** button, and operators can log custom notes into the incident timeline via `#operator-note-input`.
- **Operator Keyboard Shortcuts**:
  - `/` focuses the incident search input; `Escape` clears an active search query; `a` acknowledges the currently selected unacknowledged incident (ignored when typing inside inputs/selects).

---

## Accessibility & Responsive Choices
- **Landmarks, Headings & Table Semantics**: Uses `<nav aria-label="Primary navigation">`, `<header>`, `<main id="main-content" tabindex="-1">`, `<aside aria-labelledby="detail-heading">`, a `.skip-link`, ordered `<h1>`–`<h4>` headings, `aria-current="page"` on active navigation items, `aria-pressed` on toggle controls and row selection buttons, and `aria-sort` on sortable `<th>` headers.
- **Keyboard Focus & Navigation**:
  - High-contrast `2px solid #6ca2fa` `:focus-visible` outlines with `2px` offset across all interactive elements.
  - Incident rows expose explicit `<button class="incident-select-btn">` controls plus `ArrowUp` / `ArrowDown` keyboard movement across visible rows.
  - The inline SVG chart implements roving `tabindex` across the 24 hourly hit targets with `ArrowLeft`, `ArrowRight`, `Home`, and `End` navigation and descriptive `aria-label` values.
  - Focus continuity is preserved when acknowledging or reopening incidents (moving focus smoothly between `#acknowledge-btn` and `#reopen-btn`) and when clearing filters (returning focus to `#filter-search`).
  - Polite `aria-live="polite"` announcements (`#live-announcer`) report acknowledgements, claims, notes, and filter resets.
- **Reduced Motion & Forced Colors**: Includes `@media (prefers-reduced-motion: reduce)` and `@media (forced-colors: active)` rules so state borders and selections remain clear in high-contrast OS modes.
- **390 px Mobile Layout**:
  - Below `720 px`, the navigation rail becomes a 4-column top navigation strip, summary metrics arrange into a 2×2 grid, the SVG chart switches to a compact `360×148` `viewBox` with legible axis ticks, and the semantic `<table>` transforms rows into structured 3-column CSS Grid cards (`Severity` + `Status`, `ID` + `Title`, `Service` + `Owner` + `Age`) with visually clipped `<thead>` cells so the page operates at `390 px` with zero horizontal page scroll (`scrollWidth <= innerWidth`).
