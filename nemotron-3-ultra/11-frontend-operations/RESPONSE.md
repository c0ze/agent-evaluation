# Relay — Operations Control Room

## Hierarchy & Information Architecture

### Page Structure
```
<nav class="rail">           → Primary navigation (persistent left rail)
<header class="topbar">      → Global status, time, user (persistent top bar)
<main class="main">          → Scrollable content area
  ├─ <section class="metrics">           → 4 KPI cards (events, latency, errors, queue)
  ├─ <section class="throughput">        → 24h throughput chart (canvas)
  └─ <div class="lower-section">         → Two-pane layout
      ├─ <section class="incidents-panel">   → Filterable incident table (master)
      └─ <aside class="detail-panel">        → Incident detail + actions (detail)
```

### Visual Hierarchy
1. **Rail + Topbar** — Chrome, always visible, low contrast
2. **Metrics row** — Highest density, scannable at a glance
3. **Throughput chart** — Contextual trend, secondary focus
4. **Incident table** — Primary workspace, high information density
5. **Detail panel** — Drill-down context, action affordances

### Responsive Breakpoints
- **≥1024px**: Full three-column (rail + metrics/chart + table + detail)
- **768–1024px**: Stacked lower section (table above detail)
- **<768px**: Rail becomes bottom tab bar, topbar collapses, single-column stack
- **390px**: All tables horizontally scrollable, touch targets ≥44px, font-size 12px base

## Interaction Behavior

### Navigation Rail
- Hover/focus expands labels (desktop)
- Icon-only at mobile, transforms to bottom tab bar
- Active state uses accent background + colored icon
- Keyboard: Tab → Arrow keys between items → Enter/Space to activate

### Metrics Cards
- Hover elevates border + subtle shadow
- Trend arrows color-coded: red (up = bad for errors/queue) / green (down = good)
- Values use tabular-nums monospace for alignment

### Throughput Chart
- Canvas-based line chart with gradient fill
- Y-axis auto-scales to data range (linear default, log toggle)
- X-axis shows 24 hour labels (00–23)
- Hover dots appear on data points (future enhancement)
- Re-renders on resize and scale change

### Incident Table
- **Row selection**: Click or Enter/Space → loads detail panel
- **Selected row**: Accent left border + accent-tinted background
- **Sorting**: Not implemented (requirement: filterable only)
- **Filters**: Three cascading selects (severity, status, service)
  - Service filter populates dynamically from data
  - Clear button resets all
  - Empty state shows when zero results
- **Keyboard**: Tab to table → Arrow up/down to navigate rows → Enter to select

### Detail Panel
- Empty state when no selection
- Loads incident metadata, description, timeline, actions
- **Acknowledge button**: Primary action, disables after click, updates row status badge
- **Resolve/Escalate**: Ghost buttons (placeholders for future wiring)
- Timeline uses left-border connector with accent dot on latest entry

### State Management
- Single source of truth: `DATA.incidents` array (mutated on acknowledge)
- `selectedIncidentId` tracks detail panel
- `currentFilters` object drives table rendering
- All renders are synchronous, no async/await needed

## Accessibility Choices

### Semantic HTML
- `<nav role="navigation">` for rail
- `<header role="banner">` for topbar
- `<main role="main">` for content
- `<section aria-label>` for each major region
- `<table>` with `<thead>`/`<tbody>`, `<th scope="col">`, `<td>`
- `<aside role="complementary">` for detail panel
- `<dl>` for metadata key/value pairs
- `<ul>` for timeline

### ARIA & Live Regions
- `aria-current="page"` on active rail item
- `aria-label` on icon-only buttons (hamburger, theme, user)
- `aria-expanded` on hamburger for rail toggle state
- `aria-selected` on table rows (true/false)
- `aria-live="polite"` on topbar status text
- `role="status"` + `aria-live="polite"` for toast announcements (acknowledge)
- `aria-pressed` on acknowledge button (toggle state)

### Focus Management
- Visible focus ring on all interactive elements (custom `--focus-ring`)
- Table wrapper has `tabindex="0"` for scroll + focus visibility
- Row selection moves focus to detail panel heading (future: `detail-title` focus)
- No focus traps (single page, no modals)

### Color & Contrast
- WCAG AA compliant ratios (tested: fg/bg ≥ 4.5:1, accent/fg ≥ 3:1)
- Severity/status badges use both color + text (not color-only)
- High contrast mode supported via `@media (prefers-contrast: high)`
- Light/dark via `prefers-color-scheme` (CSS custom properties)

### Motion & Animation
- `@media (prefers-reduced-motion: reduce)` disables all transitions/animations
- Status pulse animation respects reduced motion
- Chart render is instant (no animation)

### Keyboard Support
- All interactive elements reachable via Tab
- Arrow keys navigate rail items (when focused)
- Arrow keys navigate table rows (when table focused)
- Enter/Space activates buttons and table rows
- Escape not needed (no overlays)

### Screen Reader Experience
- Hidden labels on icon-only controls
- Metric trends have `aria-label` explaining direction + magnitude
- Chart has `role="img"` + `aria-label` summarizing trend
- Timeline uses semantic list with time + event + detail structure
- Dynamic updates (acknowledge) announced via live region

### Touch & Mobile
- Minimum 44×44px touch targets (buttons, table rows)
- Horizontal scroll on table wrapper (no page overflow)
- Select menus native (better mobile UX)
- Viewport meta tag prevents zoom on input focus (iOS)

## Technical Notes

### No Dependencies
- Zero external resources (fonts, CDN, frameworks)
- System font stack with monospace fallback
- Inline SVG icons (no icon font)
- Canvas for chart (no SVG library)

### Performance
- Single reflow on resize (chart re-render)
- No layout thrashing (reads/writes batched)
- CSS containment on panels (`contain: layout paint`)
- Event delegation on table body

### Browser Support
- Modern evergreen browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- CSS Grid, Custom Properties, Canvas 2D, ES2020
- Graceful degradation: rail collapses, chart works, table scrolls

## Future Enhancements (Not Implemented)
- WebSocket live updates for metrics/incidents
- Column sorting in table
- Chart hover tooltip with exact values
- Incident pagination/virtualization for 100+ rows
- Command palette (Cmd+K) for power users
- Multi-select + bulk actions
- Dark/light theme toggle persistence