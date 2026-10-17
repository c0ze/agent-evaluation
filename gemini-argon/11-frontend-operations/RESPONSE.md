# Relay — Operations Control Room: Architecture & Design Notes

## 1. Visual Hierarchy & Control-Room Aesthetics

Relay is designed for on-call systems engineers and operations leads who need immediate situational awareness without visual noise:

1. **Top-Down Operational Scanning**:
   - **Global Posture Bar (`.top-status-bar`)**: Anchors the top edge with a real-time computed system posture badge (`DEGRADED · 1 CRITICAL UNACKED`), cluster/region breadcrumbs (`PROD-CORE / us-east-1 · eu-west-1`), open vs. acknowledged counters, SLO burn rate, and a live tabular UTC clock.
   - **Left Navigation Rail (`.nav-rail`)**: Provides persistent view switching (`Control`, `Incidents`, `Throughput`, `Telemetry`, `Inspector`), active incident badge count, operator identity (`OP: J. VANCE`), and keyboard shortcut hints (`/` Find, `A` Ack).
   - **Four Summary Metrics (`#metrics-grid`)**: Renders the four key metrics from `DATA.json` (`Events / min`, `P95 latency`, `Error rate`, `Queue depth`) with directional deltas (`↑ +8.2%`, `↓ −12 ms`, `↑ +0.08 pp`, `↓ −19%`), operational polarity encoding (distinguishing beneficial decreases like latency/queue depth from degrading increases like error rate), and 1-hour baseline/SLO context.
   - **24-Hour Ingest Throughput (`#throughput-section`)**: Combines an inline SVG bar-and-area chart for the 24 hourly buckets from `DATA.json` with a live summary strip (`PEAK`, `MIN`, `MEAN`, and active inspected hour delta) plus a toggleable SLO soft ceiling reference line (`80`).
   - **Split Incident Workspace (`.ops-split-layout`)**: Pairs the filterable **Incident Queue** on the left with the **Incident Inspector** detail panel on the right so operators can triage and acknowledge incidents without losing queue context.

2. **Restrained Palette & Typography**:
   - Built on a high-contrast dark slate palette (`#0a0d12` canvas, `#0f141c` panels, `1px solid #1c2532` hairlines) with a single purposeful signal-cyan accent (`#38bdf8`) reserved for focus rings, active selection states, and primary interactive controls.
   - Severity states (`critical`, `high`, `medium`, `low`) pair color with explicit uppercase text labels (`CRIT`, `HIGH`, `MED`, `LOW`) and border contrast so severity never relies on color alone.
   - All numeric values, timestamps, deltas, and incident IDs apply `font-variant-numeric: tabular-nums` and system monospace stacks (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`) for vertical alignment across rows and live ticks.

---

## 2. Interaction Behavior & State Management

- **Data Seeding (`DATA.json` + Local Fallback)**:
  - `app.js` fetches `DATA.json` when served over HTTP/HTTPS and falls back seamlessly to the identical embedded `SEED_DATA` structure when opened directly via `file://`, ensuring zero external dependencies or failed loads.
- **Multi-Faceted Incident Filtering & Empty States**:
  - Operators can filter simultaneously by free-text search (`ID`, `title`, `service`, `owner`), severity pills (`All`, `Crit`, `High`, `Med`, `Low` with live counts), status dropdown, service dropdown, and an `Unacknowledged only` toggle.
  - When a filter combination yields zero matches, the table displays a structured empty state (`NO MATCHING INCIDENTS [0/4]`) summarizing the active filter parameters alongside a one-click `Reset All Filters` button.
- **Incident Selection & Working Acknowledge Action**:
  - Selecting any row in the incident table highlights it (`is-selected`, `aria-selected="true"`) and updates the **Incident Inspector** panel with service telemetry, fault zone, error signature, CLI mitigation command (with working `Copy CLI` action), and chronological responder logs.
  - Clicking **Acknowledge Incident** (in the detail panel), clicking the inline **Ack** button in any table row, or pressing `A` on the keyboard:
    - Marks the incident as acknowledged (`ACK` badge in table and inspector) with the current UTC timestamp.
    - Transitions `open` or `investigating` incidents to `acknowledged` status and assigns `Unassigned` incidents to the active operator (`J. Vance`).
    - Appends an audit entry to the incident's responder activity log.
    - Recalculates the top status bar's `OPEN/INV`, `ACKED`, and `DEGRADED / ELEVATED / NOMINAL` system posture indicator in real time.
  - Operators can also transition incident status (`Open`, `Investigating`, `Acknowledged`, `Monitoring`, `Resolved`), take ownership, bulk-acknowledge visible incidents, or append timestamped responder notes.

---

## 3. Accessibility & 390px Responsive Choices

- **Keyboard Navigation & Visible Focus**:
  - Every interactive control displays a high-contrast `2px solid #38bdf8` outline (`:focus-visible`) with a `2px` offset.
  - Includes a `.skip-link` (`Skip to operations workspace`) as the first focusable element.
  - Incident rows support `Tab`, `Enter`/`Space` to select, and `ArrowUp`/`ArrowDown` to step through the queue.
  - SVG throughput bars are individually focusable (`tabindex="0"`, `role="button"`) with `ArrowLeft`/`ArrowRight` navigation and descriptive `aria-label` attributes, backed by a screen-reader-only `<table>` (`#throughput-sr-table`) containing all 24 hourly values.
  - Global single-key shortcuts (`/` to focus search, `A` to acknowledge the selected incident) automatically disable when focus is inside an input or select element.
- **Screen-Reader Live Announcements**:
  - An `aria-live="polite"` region (`#sr-announcer`) announces incident acknowledgements, status transitions, filter resets, and note additions.
- **390px Mobile Layout Without Horizontal Scroll**:
  - Below `860px`, the navigation rail converts into a compact top navigation bar and the 4-column metric strip wraps into a 2x2 grid.
  - Below `640px` (targeting `390px` viewports), the incident table transforms via CSS Grid into compact, multi-line operational cards displaying Severity, Incident ID, Age, Status, Title, Service, Owner, and the inline `Ack` button—eliminating horizontal overflow while keeping every column and action accessible.
