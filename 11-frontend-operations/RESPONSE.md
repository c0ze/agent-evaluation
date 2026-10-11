# Relay Operations Control Room — Architectural Overview

## 1. Visual Hierarchy & Information Architecture

**Relay** is engineered as a high-density, mission-critical operations dashboard tailored for Level-3 SREs and incident commanders. The interface adopts a restrained dark control-room theme (`#090b0e` canvas, `#12161f` panel surfaces, `#242c3d` crisp 1px borders) with a single purposeful electric cyan accent (`#00d2ff`) for telemetry highlights and interactive focus. It deliberately avoids decorative gradients, glassmorphism, oversized display headings, and excessive border radii to maximize situational awareness and eliminate visual noise.

The information architecture follows top-down operational priority:
1. **Navigation Rail (Left Rail on Desktop / Compact Banner on Mobile):** Provides instant navigation between consoles (Overview, Incidents, Telemetry, Services, Audit Log), displaying live active incident count badges, audible telemetry alert toggles, a keyboard shortcut helper (`?`), and current operator credentials (`MC / M. Chen`).
2. **Top Status Bar:** Houses high-level cluster state (`PROD // US-EAST-1`), global health state (`DEGRADED — 1 CRITICAL INCIDENT` or `ALL SYSTEMS OPERATIONAL`), live telemetry stream indicator with a pause/resume toggle, and a precision UTC clock (`YYYY-MM-DD HH:MM:SS UTC`) ticking in real time.
3. **Summary Metric Cards:** Four compact KPI tiles seeded directly from `DATA.json` (Events/min: `18,420` [+8.2%], P95 Latency: `184 ms` [−12 ms], Error Rate: `0.37%` [+0.08 pp], Queue Depth: `2,841` [−19%]). Each card integrates tabular numeric figures, directional delta pills with contextual coloring (e.g., latency reduction is marked favorable green, error rate increase is marked critical red), baseline comparison context, and inline SVG sparklines.
4. **24-Hour Event Throughput Telemetry:** An interactive SVG vector visualization plotting 24 hourly buckets (`[31, 28, ..., 41] k req/s`). It features dashed reference gridlines (25k, 50k, 75k, 100k), an operational SLO warning threshold line at 80k req/s, summary statistics pills (Current, Peak at T-4h, 24h Average, and SLO Ceiling), and interactive mouse/keyboard scrub tooltips calculating percentage variance from the 24h mean.
5. **Split Incident Workspace:**
   - **Filterable Incident Table (Left Pane, ~65%):** Displays incidents seeded from `DATA.json` (`INC-2841`, `INC-2839`, `INC-2837`, `INC-2832`) with distinct severity badges, monospace IDs, service pills, relative age, assigned owners, and status indicators.
   - **Incident Detail Inspector (Right Pane, ~35%):** Displays deep diagnostic context, impact analysis, assigned tags, attached runbook procedures, chronological timeline logs, and working operator actions (Acknowledge, Resolve, Claim Ownership).

---

## 2. Interaction Behavior & State Management

All state transitions and user actions are handled entirely through local, framework-free vanilla JavaScript (`app.js`):
- **Local Data Seeding & Zero-Network Reliability:** The application embeds the exact content of `DATA.json` directly within the runtime state while attempting a non-blocking asynchronous local fetch if served over an HTTP daemon. This guarantees zero broken dependencies when opened directly via `file://` protocols.
- **Working Incident Acknowledgment:**
  - Clicking the primary **"Acknowledge Incident"** button (or pressing `A` on the keyboard) immediately transitions the selected incident's status to `acknowledged`.
  - If the incident was previously unassigned, ownership automatically binds to the active operator (`M. Chen`).
  - An audit record is appended to the incident's chronological timeline log (e.g., `19:50 UTC — Acknowledged by operator M. Chen; runbook mitigation engaged`).
  - The acknowledgment button updates its state to `✓ Acknowledged`, the incident table row updates its status pill in real time, and the top status bar counter updates accordingly.
  - A transient notification toast appears in the bottom right corner, and an assistive technology announcement is dispatched.
- **Live Filtering & Instant Search:**
  - Real-time text search filters incidents across ID, title, affected service, and owner.
  - Granular severity filter pills (`All`, `Crit`, `High`, `Med`, `Low`) and dropdown selects (`Service`, `Status`) filter the table instantly.
  - When filters yield zero results, an empty state card appears with a one-click "Clear all filters" action.
- **Sortable Columns:** Clicking table headers sorts incidents ascending or descending by Severity (weighted by critical rank), ID, Title, Service, Age (converted to minutes), Owner, or Status, properly reflecting `aria-sort`.
- **Throughput Timeline Scrubbing:** Moving the cursor over the SVG throughput chart positions an interactive vertical crosshair and displays a high-contrast floating tooltip detailing the specific hourly bucket, throughput in req/s, and variance against the 24h baseline. Focusable and scrubbable via keyboard arrow keys (`Left`/`Right`).
- **Telemetry Stream Toggle:** A working toggle button pauses and resumes the simulated 1-second telemetry stream, updating visual state and indicators.

---

## 3. Accessibility Choices & Keyboard Navigation

The console is built according to WCAG 2.1 Level AA accessibility standards:
- **High-Contrast Visible Focus Rings:** Every interactive element—buttons, inputs, selects, table rows, and tab stops—implements a dedicated `:focus-visible` style featuring a `2px solid #00d2ff` outline with `1px` or `-2px` offset.
- **Full Keyboard Operability:**
  - `Skip Link`: Positioned at the very top of the DOM, allowing screen readers and keyboard users to bypass navigation directly to `#main-content`.
  - `ArrowUp` / `ArrowDown`: Navigates between incident rows in the table.
  - `Enter` / `Space`: Selects the focused incident and loads its detail panel.
  - `A`: Quick shortcut to acknowledge the selected incident.
  - `R`: Quick shortcut to resolve/reopen the selected incident.
  - `/`: Immediately focuses the incident search filter input.
  - `?`: Opens the modal cheat-sheet dialog detailing all operational keyboard shortcuts, equipped with `aria-modal="true"`, focus containment, and `Escape` dismissal.
  - `Escape`: Clears the active search query or closes open modals.
- **Semantic HTML & Screen Reader Support:**
  - Built using standard semantic elements: `<header role="banner">`, `<nav aria-label="...">`, `<main role="main">`, `<aside aria-label="...">`, `<table role="grid">`, and `<figure role="region">`.
  - An `aria-live="assertive"` screen-reader announcer (`#sr-announcer`) broadcasts critical status changes (such as incident acknowledgment and filter resets).
  - Filter readouts use `aria-live="polite"` to announce result counts.
  - Numeric figures leverage `font-variant-numeric: tabular-nums` and monospace styling to ensure column alignment and readability.
- **Mobile Usability at 390px Viewport:**
  - Tested and verified at 390px (e.g., iPhone 12/13/14) with zero horizontal page scroll (`overflow-x: hidden` on viewport roots, fluid grid containment).
  - Navigation rail collapses into a compact top header, hiding non-essential utility icons on narrow screens to prevent crowding.
  - An accessible mobile switcher tab (`[Incidents (4)]` vs `[Selected Detail (INC-2841)]`) enables seamless single-handed mobile triage: tapping any incident in the table automatically shifts focus to the detail view and surfaces the working acknowledgment action.
  - The incident table is housed in a container with smooth touch scrolling (`overflow-x: auto`), preserving layout integrity without forcing page scroll.
