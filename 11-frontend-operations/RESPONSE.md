# Relay Operations Control Room — Design & Architecture Documentation

## 1. Hierarchy & Information Architecture

**Relay** is designed from the ground up as a high-density, low-cognitive-overhead operations dashboard for mission-critical telemetry and incident response. The visual language strictly avoids glassmorphism, decorative gradients, giant headings, or excessive rounded cards, instead adopting a calm control-room aesthetic with a dark slate canvas (`#080b0f`), crisp 1px borders, tabular numeric typography, and a single purposeful amber accent (`#f59e0b`).

```
+------------------------------------------------------------------------------------------+
|  NAV RAIL  |  TOP STATUS BAR (System Health | Dual UTC/Local Clocks | Stream Pulse)     |
|  (Brand,   +-----------------------------------------------------------------------------+
|   Tabs,    |  1. CORE METRICS (Events/min, P95 Latency, Error Rate, Queue Depth + SLO)   |
|   Node,    +-----------------------------------------------------------------------------+
|   Hotkeys) |  2. 24-HOUR EVENT THROUGHPUT (Inline SVG Area/Bar Telemetry + Mean/Peak)   |
|            +-----------------------------------------------------------------------------+
|            |  3. ACTIVE INCIDENT QUEUE (60%)     | 4. INCIDENT INSPECTOR PANEL (40%)     |
|            |     - Search & Severity Chips       |    - Telemetry & Diagnostic Snippet   |
|            |     - Status & Service Dropdowns    |    - Runbook Reference                |
|            |     - Sortable Incident Data Grid   |    - Working Acknowledge / Resolve    |
|            |     - Empty Filter State            |    - Real-Time Audit Log Timeline     |
+------------------------------------------------------------------------------------------+
```

### Key Structural Layers
1. **Left Navigation Rail (`<nav>`)**:
   - Anchors the operator's workspace with the **Relay** brand, operational views (*Overview*, *Incidents* with active badge count, *Services*, *Telemetry*, *Audit Log*), active cluster node status (`US-EAST-CORE / PROD-PRIMARY`), and visible hotkey cheatsheets.
   - Collapses into an ergonomic horizontal tab strip on tablet and mobile viewports.
2. **Top Status Bar (`<header role="banner">`)**:
   - Provides global system situational awareness:
     - Operational health beacon (`SYSTEM DEGRADED - 1 CRITICAL • 1 HIGH` or `SYSTEM OPERATIONAL`).
     - Real-time synchronized dual clocks displaying both **UTC** and **Local time** with 1-second ticks.
     - 30-day uptime telemetry (`99.982%`), live 5-second polling stream indicator, and manual sync action.
3. **Core Summary Metrics (`<section class="section-metrics">`)**:
   - Four high-density cards populated from `DATA.json`:
     - **Events / min** (`18,420`, `▲ +8.2%`, SLO Target: `> 15k / min`).
     - **P95 latency** (`184 ms`, `▼ −12 ms`, SLO Budget: `< 200 ms`, marked healthy).
     - **Error rate** (`0.37%`, `▲ +0.08 pp`, SLO Target: `< 0.10%`, flagged as active breach).
     - **Queue depth** (`2,841`, `▼ −19%`, Drain Rate: `~420 / min`, marked recovering).
   - Each card pairs large tabular figures with direction arrows, color-coded deltas (e.g. latency decrease is positive green, error rate increase is warning red), explicit SLO targets, and an inline SVG sparkline.
4. **24-Hour Throughput Visualization (`<section class="section-throughput">`)**:
   - Inline SVG visualization of the 24 hourly buckets from `DATA.json`.
   - Displays clear reference lines: hourly intervals ($T-24h$ to $Now$), 0–100k eps grid lines, average throughput benchmark line ($58.3k\text{ eps}$), and peak marker ($88.0k\text{ eps}$).
   - Operator toggle switches between a **continuous area curve** (with subtle alpha fill) and **discrete high-density hourly bars**.
5. **Operations Deck (`.ops-deck-layout`)**:
   - Dual-pane workflow balancing a comprehensive data grid on the left with an in-depth inspector on the right.
   - Preserves continuous spatial context so operators never lose their place in the queue while investigating details.

---

## 2. Interaction Behavior & Operator Workflows

### Incident Filtering, Searching & Sorting
- **Real-Time Full-Text Search**: Matches against incident ID, title, affected service, owner, severity, and status with immediate feedback.
- **Severity Radio Chips**: Segment the queue into `All (4)`, `Critical (1)`, `High (1)`, `Med (1)`, and `Low (1)` with dynamic count badges that recalculate in real time.
- **Service & Status Selectors**: Filter by service domain (`payments-api`, `event-router`, `search-index`, `webhooks`) and lifecycle status (`open`, `investigating`, `monitoring`, `acknowledged`).
- **One-Click Filter Reset**: Appears whenever any filter criteria are active, clearing the search query, chips, and dropdowns back to default.
- **Column Header Sorting**: All table columns (Severity, ID, Title, Service, Age, Owner, Status) are interactive buttons cycling through ascending, descending, and default orders, with updated `aria-sort` indicators.

### Empty & Edge States
- When a search or filter yields zero matching rows, the table displays a dedicated **Empty State**:
  - Clear icon and header: `NO INCIDENTS MATCH FILTER CRITERIA`.
  - Contextual guidance explaining that no open records match the current filter query.
  - Primary button: `Reset All Filters`, restoring full visibility immediately.
- If no incident is selected, the inspector panel displays an instructional empty state guiding the operator to select a row or use the keyboard.

### Incident Lifecycle & Working Acknowledge Action
- Selecting an incident loads its diagnostic payload, affected SLO, associated runbook (e.g. `RB-PAY-04: Auth Gateway Failover`), and audit history into the detail inspector.
- **Working Acknowledge Action**:
  - Triggered via the **Acknowledge Incident** button in the inspector or by pressing hotkey `A`.
  - State Transition: Moves status from `open` to `investigating` / `acknowledged`.
  - Ownership Assignment: Automatically assigns unassigned incidents to the current on-call operator (`M. Chen`).
  - Audit Trail Logging: Appends a timestamped log entry (`[HH:mm:ss UTC] Acknowledged by Operator M. Chen (Transitioned OPEN → INVESTIGATING)`).
  - Synchronous UI Propagation: The incident table row, severity badges, navigation counter badge, and top status bar degrade/recover state indicators update instantaneously.
  - Toast Notification: Dispatches an unobtrusive, accessible toast notification confirming the acknowledgment.
  - Follow-up Action: Once acknowledged, the button updates to `✓ Acknowledged` and unlocks a `Resolve Incident` secondary workflow.

### Throughput Telemetry Inspection
- Hovering or keyboard-focusing any hourly data point on the throughput SVG updates the live telemetry readout strip above the chart.
- Displays the relative time window (e.g. `T-04h (4 hours ago)`), throughput figure (`88,000 eps`), and percentage deviation relative to the 24-hour mean (`+50.9% vs Mean`).

---

## 3. Accessibility (a11y) Choices

### Semantic Markup & Screen Reader Support
- **Landmarks**: Uses HTML5 `<nav>`, `<header>`, `<main>`, `<section>`, `<aside>`, and `<table>` with descriptive `aria-label` and `aria-labelledby` attributes.
- **Data Table**: Uses `scope="col"` headers, `role="row"`, `aria-selected` for active selection tracking, and `aria-sort` on sortable columns.
- **Live Regions**: Uses `aria-live="polite"` on the chart telemetry readout and the system toast container to announce state updates without disrupting operator focus.

### Keyboard Navigation & Hotkeys
- **Global Focus Ring**: High-contrast, custom 2px focus ring (`outline: 2px solid var(--accent); outline-offset: 2px;`) across all interactive elements (`:focus-visible`).
- **Hotkeys**:
  - `/`: Immediately focuses the incident search field.
  - `Escape`: Clears the search input and removes focus.
  - `↑` / `↓` (Arrow Keys): Seamlessly moves selection between incidents in the queue.
  - `Enter` / `Space`: Selects focused table row.
  - `A`: Triggers the Acknowledge action on the currently selected incident from anywhere in the app.

### Visual Ergonomics & Contrast
- **WCAG Compliance**: High contrast ratios throughout (>7:1 for headers and key values; >4.5:1 for muted text against dark backgrounds).
- **Tabular Figures**: Monospace font stack with `font-variant-numeric: tabular-nums lining-nums;` prevents horizontal layout shift during clock ticks and live metric updates.
- **Multi-Cue Severity States**: Never relies on color alone for critical states. Every severity level features distinct text badges (`CRIT`, `HIGH`, `MED`, `LOW`), distinct border styles, and colored dots with redundant shape and contrast cues.

---

## 4. Mobile Responsiveness (390px Viewport)

The dashboard is engineered to adapt smoothly down to **390px** (standard iPhone 12/13/14 viewport) with **zero horizontal page scroll**:
- **Root & Shell Containment**: `html, body` enforce `overflow-x: hidden`, preventing the viewport from swaying horizontally.
- **Navigation Transformation**: The vertical 204px nav rail switches to an ergonomic top bar with horizontally scrollable tab pills on mobile.
- **Status Bar Wrapping**: The top status bar items gracefully wrap into compact vertical rows without overflowing or truncating critical telemetry.
- **Metrics Grid**: Switches from 4 columns to a clean 2x2 grid on mobile viewports with scaled typography and sparklines.
- **SVG Vector Scaling**: The 24-hour throughput chart utilizes responsive `viewBox` coordinates to scale seamlessly down to narrow screens while retaining full touch interactivity.
- **Contained Table Scrolling**: The incidents table is housed inside `.table-scroll-wrap` configured with `overflow-x: auto` and `-webkit-overflow-scrolling: touch;`. The table columns retain legible tabular spacing while scrolling strictly within their container boundaries, keeping the outer page fixed at 100% width.
- **Stacked Deck Layout**: The operations deck shifts from a side-by-side grid to a single column, stacking the incident table above the inspector panel for natural vertical scrolling.
