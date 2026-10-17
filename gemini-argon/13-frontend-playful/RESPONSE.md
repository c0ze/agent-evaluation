# Moss — Design, Interaction Model & Accessibility Notes

## 1. Visual Personality & Shape Language
**Moss** is designed like a tactile potting bench almanac rather than a sterile productivity dashboard:
- **Materials & Palette**: Warm sun-bleached linen (`#F5EFE2`), stoneware parchment (`#FBF8F1`), potting-soil espresso ink (`#231F1B`), terracotta (`#D45D3A`), velvet moss (`#376143`), and lichen chartreuse (`#C9D97E`). Hard offset shadows (`4px 4px 0 #231F1B`) and crisp ink borders give controls a physical, stamped-ticket feel without glass panels or neon gradients.
- **Anti-"Wall of Cards" Hierarchy**: Each care tier uses a distinct silhouette and density:
  - **Overdue Priority Spotlight (`Frida`, urgency 4)**: Featured at the top in a warm terracotta ticket with an arched botanical alcove, a floating priority ribbon, and a drooping fern SVG with a water-droplet indicator.
  - **Today’s Care Bench (`Orbit` & `Dot`, urgency 2 & 1)**: Paired in an asymmetric 2-up bench grid with opposing organic corner radii (`18px 32px 18px 28px` vs. `28px 18px 32px 18px`) and species-specific custom inline SVGs (a trailing golden pothos with a rotation orbit ring, and a polka-dot bunny ears cactus).
  - **Tomorrow & Tended Conservatory (`Drama`, urgency 0)**: Placed in a calmer mist-tinted section so tomorrow’s misting task stays visible and inspectable without competing with overdue care.
- **Small Moments of Delight**: A velvet-moss pebble mascot in the masthead updates its facial expression and conversational prompt as you clear overdue tasks, and Frida’s drooping fern fronds perk upright once watered.

## 2. Interaction Model
- **Prioritized Queue & Live Filtering**: Plants are sorted by urgency (`Frida` → `Orbit` → `Dot` → `Drama`) and segmented into Overdue, Due Today, and Tomorrow/Tended shelves, with filter tabs (`All plants`, `Needs care`, `Tended / Snoozed`) for quick focus.
- **Dual-Context Plant Detail View**:
  - **Inline Expandable Drawer (Mobile & Desktop)**: Every plant card includes an expandable `Light, water & history` drawer showing its light requirement, watering cadence, full observation timeline, and an inline field-note logger.
  - **Sticky Specimen Dossier (Desktop Studio)**: Selecting any plant updates the right-hand Specimen Dossier with species quirks, care gauges, observation history, and quick note logging.
- **Watered, Snooze & Brief Undo Path**:
  - Clicking **Watered** marks the plant tended for today, prepends a dated entry (`Sep 22 · Watered`) to its history, updates the weekly rhythm bar for today, and moves the plant to the tended shelf.
  - Clicking **Snooze** postpones care until tomorrow (`Snoozed · Tomorrow`) and logs the snooze event.
  - Every action triggers an assertive **Undo Toast** with an 8-second visual countdown bar (plus `Z` / `Ctrl+Z` keyboard support) that restores the exact prior state.
- **Compact Weekly Rhythm Visualization**: Renders `PLANTS.json`’s `"week": [1, 3, 2, 4, 2, 1, 3]` as interactive botanical stems from Monday to Sunday, highlighting Tuesday (today) and Thursday (peak load of 4 tasks), and updating live as tasks are logged.
- **Useful All-Done State**: Clearing overdue and today’s tasks unveils the *Greenhouse At Ease* card with a custom illustration, a recap of tended/snoozed counts, a **Tomorrow’s Horizon** forecast spotlighting `Drama` (*Calathea orbifolia*), a micro-climate tip, and a one-click queue reset.

## 3. Accessibility & Responsive Architecture
- **Keyboard & Focus**: All interactive elements use semantic `<button>`, `<form>`, and `<input>` controls with high-contrast `:focus-visible` outlines (`3px solid #231F1B` + `5px` `#C9D97E` halo), a skip link, and single-key shortcuts (`↑`/`↓` or `J`/`K` to cycle plants, `W` to mark watered, `S` to snooze, `Z` to undo).
- **Screen Reader Semantics**: ARIA live regions (`role="status"`, `aria-live="polite"` / `"assertive"`), `aria-expanded` / `aria-controls` on detail drawers, and descriptive button labels ensure state changes are announced clearly.
- **Reduced Motion**: Respects `@media (prefers-reduced-motion: reduce)` automatically and includes an explicit **Calm motion / Reduced motion** button in the header to pause all ambient SVG animations and transitions on demand.
