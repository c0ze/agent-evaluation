# Relay — Response

## Hierarchy
Top status bar (brand, environment, live status pill, UTC clock) answers "is the system OK?" first. Four summary metrics follow with trend context (▲/▼ + delta vs 1h avg, tabular numerals). Below, a two-column zone pairs the 24-hour throughput chart (primary pattern) with the incident detail panel (selected-item focus). The filterable incident table closes the page as the working surface. Left navigation rail gives persistent section anchors; on mobile it narrows to icons and the grid collapses to one column.

## Interaction behavior
- Throughput: canvas bars from the 24 seeded hourly values, HiDPI-scaled, redrawn on resize; peak hour bar highlighted with numeric labels; `role="img"` with text summary for AT.
- Table: severity/status dropdowns + free-text search (id, title, service, owner) filter live; count updates; non-matching state shows an empty message with a Clear filters action.
- Rows are focusable (`tabindex=0`), clickable, Enter/Space select, Up/Down moves between rows; selection syncs the detail panel (`aria-live="polite"`) and `aria-selected` on rows.
- Detail panel: shows severity, service, age, owner, status; Acknowledge sets status to acknowledged (assigns on-call if unassigned) and disables itself with confirmation text; Escalate raises severity one step. All state is local JS seeded from DATA.json (embedded, no fetch, no network).

## Accessibility choices
- Skip link, landmarks (`nav`, `main`, labelled sections), real `<table>` with `<th scope>`, labelled form controls, live region on detail.
- Visible `:focus-visible` outlines everywhere; severity/status conveyed by text labels, not color alone; contrast-checked neutrals with a single blue accent.
- `prefers-reduced-motion` disables the status pulse; canvas has a text equivalent; keyboard-only flow (filter → rows → acknowledge) is fully operable.

## Constraints met
No frameworks, installs, fonts, remote assets, or network requests; only `index.html`, `styles.css`, `app.js` + this file. Layout verified at 390px with no horizontal page scroll (table scrolls internally, second ID column hides on narrow screens).
