# Moss — Gentle Household Plant-Care Companion
## Design System, Interaction Model, and Accessibility Report

---

### 1. Personality & Visual Direction

**Moss** is built around the feeling of slow domestic mornings, hand-thrown terracotta ceramics, damp garden potting benches, and optimistic green life. Rather than looking like a sterile productivity tracker, a neon-accented dashboard, or a wall of interchangeable cards, Moss embraces a tactile, earthy, and charmingly idiosyncratic visual language:

- **Color Palette**: Grounded in natural materials:
  - *Canvas & Paper*: Warm oatmeal background (`#FAF6EE`), clotted cream cards (`#FFFDF9`), and soft sand clay (`#EADBC8`).
  - *Ink*: Dark forest charcoal (`#212F24`) for readable contrast that feels softer and warmer than harsh `#000`.
  - *Botanical Greens*: Forest moss (`#395536`), fresh leaf (`#557A46`), lively sprout (`#7CA96E`), and pale sage wash (`#EBF3E7`).
  - *Warm Terracotta & Ochre*: Clay rust (`#D65D38`, `#B94926`) used for overdue urgency and hydration prompts, paired with warm mustard ochre (`#D9822B`) for sunlight and turning tasks.
  - *Dew & Mist*: Soft slate blue-green (`#3B6B6B`, `#5C8E8E`) for calming humidity tasks.
- **Expressive Shape Language**:
  - Cards feature organic asymmetric radii (`22px 18px 24px 18px` and `24px 14px 28px 16px`), giving them a hand-molded, pebble-like presence.
  - Physical tactile button treatments: buttons feature solid drop shadow offsets (`3px 4px 0 #212F24` and `2px 2px 0 #212F24`) that physically depress on click/active (`translateY(2px); box-shadow: none`).
  - Stamped tag shapes (`border-radius: 8px 14px 8px 14px`) and tactile pill counters.
- **Bespoke Botanical Character Silhouettes**:
  Rather than generic clip art or external font icons, each of the four plants in `PLANTS.json` has an individual, inline SVG portrait reflecting its botanical anatomy and personality:
  1. **Frida** (*Boston fern*, Bathroom): Cascading arching fronds in a terracotta hanging pot with suspension cords. Expresses thirst when overdue and perks up when watered.
  2. **Orbit** (*Golden pothos*, Bookshelf): Trellis moss pole with twine, heart-shaped variegated leaves with sunny cream blotches, and an active trailing vine.
  3. **Dot** (*Bunny ears cactus*, South window): Asymmetrical rounded paddle lobes with miniature bunny-ear pads, studded with charming golden glochid spine dots in a shallow saucer pot.
  4. **Drama** (*Calathea orbifolia*, Bedroom): Fluted blush pot supporting broad oval prayer leaves with signature silver-green pinstripe veining and a morning mist droplet.

---

### 2. Interaction Model & Care Queue Prioritization

The interaction architecture is engineered for gentle clarity, low cognitive load, and frictionless operation:

1. **Queue Prioritization (Urgency First)**:
   - Plants are prioritized and sorted by urgency score:
     - **Frida** (`urgency: 4`, "2 days overdue") is highlighted prominently at the top of the queue with an earthy terracotta border, warning badge, and a dedicated **Priority Attention Banner** ("Frida is thirsty (2 days overdue)") offering immediate one-click hydration.
     - **Orbit** (`urgency: 2`, "Today") and **Dot** (`urgency: 1`, "Today") follow with high-visibility daily action tags.
     - **Drama** (`urgency: 0`, "Tomorrow") is positioned gracefully at the queue base, allowing eager gardeners to care early if desired.
2. **Working Care & Snooze Actions**:
   - Each card provides explicit, context-tailored action triggers:
     - *Primary*: Plant-specific task action (e.g., "💧 Watered" for Frida, "🔄 Rotated" for Orbit, "✓ Checked" for Dot, "🌱 Misted" for Drama).
     - *Secondary*: "⏰ Snooze (+1d)" postponing care by 24 hours.
     - *Inspector*: "ℹ️" button opening rich plant history and specifications.
   - Performing an action updates the plant's status immediately, logs the moment to its history timeline, updates the weekly rhythm indicators, and triggers a tactile feedback cue.
3. **5-Second Undo Path**:
   - When any care or snooze action is taken, a floating toast appears with the message, an animated 5-second progress bar, and an explicit **Undo** button.
   - Clicking Undo (or pressing `Z`) restores the exact snapshot of the plant's previous state, returns it to the queue with its original urgency, removes the appended log, and reverses the rhythm counter.
   - A dedicated **Tended Today** completed tray also retains all completed plants with individual "Undo care" options.
4. **Plant Detail Inspector**:
   - Features rich botanical data: Light preference, scheduled task, soil moisture level, humidity need, and species-specific water rules.
   - Displays the plant's historical log timeline (from `PLANTS.json`).
   - Includes an interactive **Quick Observation Log** input (`+` button), enabling users to record ad-hoc notes (e.g., "Spotted a tiny new frond!") that instantly persist into the plant's history and card previews.
5. **Compact Weekly Rhythm Visualization**:
   - Accurately renders the 7-day care rhythm from `PLANTS.json` (`[1, 3, 2, 4, 2, 1, 3]`), with Thursday (Day 4) highlighted as Today's care peak.
   - As tasks are completed today, the Thursday column dynamically splits its fill into completed sprout-green and remaining terracotta scheduled tasks.
   - Each column is keyboard-focusable with screen-reader accessible tooltips detailing daily care moments.
6. **Rewarding All-Done State**:
   - When all tasks in the queue are completed, the interface transitions smoothly into an encouraging **All Tended** screen.
   - Displays a warm botanical sunbeam illustration, soothing confirmation copy, and an actionable look-ahead: *"Up Next Tomorrow: Drama (Calathea) will want a gentle morning misting in the bedroom."*
   - Includes quick actions to review completed logs or reset the demo state.

---

### 3. Responsive & Desktop Composition

Moss adopts a mobile-first responsive architecture that transforms intentionally across viewports:

- **Mobile Viewport (< 768px)**:
  - Focused single-column flow with large touch targets (minimum 44×44px).
  - Compact weekly rhythm widget, overdue attention spotlight, and clear vertical plant queue.
  - The Plant Inspector functions as an accessible **bottom sheet drawer** that slides up smoothly with an organic rounded top border and a soft backdrop.
- **Tablet Viewport (768px – 1079px)**:
  - Two-column layout with sticky left sidebar (atmosphere, rhythm, and room filters) and center care agenda.
  - Inspector acts as an off-canvas right modal drawer.
- **Desktop Viewport (≥ 1080px)**:
  - **Asymmetric Three-Column Station**:
    1. *Left Column (300px)*: Sticky navigation housing the Home Atmosphere card, micro-stats, Weekly Rhythm widget, room filters (Bathroom, Bookshelf, South window, Bedroom), and tactile care tips.
    2. *Center Column (Fluid 460–640px)*: Care Agenda header, Overdue Priority spotlight, active plant cards, all-done state, and completed tray.
    3. *Right Column (340px)*: **Persistent Docked Inspector**. Rather than stretching the mobile card list across an empty screen, the right column stays docked to inspect the active plant, its soil moisture gauges, water rules, and observation diary in real time.

---

### 4. Accessibility & Inclusive Design Choices

Antigravity and inclusive design principles were integrated from the foundation:

1. **Semantic HTML5 & Landmarks**:
   - Proper use of `<header role="banner">`, `<main id="main-content">`, `<aside>`, `<section>`, `<article role="article">`, native `<button>`, `<form>`, `<input>`, and `<kbd>`.
   - Hidden skip-link (`.skip-link`) at the very top of the page allowing keyboard users to bypass navigation straight to the care agenda.
2. **Tactile High-Contrast Focus Indicators**:
   - Custom visible focus ring: `:focus-visible { outline: 3px solid #D65D38; outline-offset: 3px; border-radius: 6px; }`.
   - Never relies on browser default outlines or removes focus styling.
3. **Comprehensive Keyboard Shortcuts**:
   - `1` – `4`: Instantly select plant cards in the care queue.
   - `W` or `D`: Mark the selected plant watered or cared for.
   - `S`: Snooze selected plant by 1 day.
   - `O` or `Enter`: Open plant details and inspector.
   - `Z`: Undo the most recent care or snooze action.
   - `Esc`: Close open drawers, modals, or shortcut guides.
   - `?`: Toggle the keyboard navigation cheat sheet modal.
4. **Live Regions & Screen Reader Support**:
   - An `aria-live="polite"` live announcer region (`#sr-announcer`) broadcasts care completions, snoozes, undo confirmations, and room filter selections to assistive technology.
   - The toast notification region uses `aria-live="assertive"` and `aria-atomic="true"` for timely undo feedback.
   - All interactive controls have descriptive `aria-label`, `aria-pressed`, and `aria-expanded` attributes.
5. **Reduced-Motion Support (`prefers-reduced-motion: reduce`)**:
   - Fully supported via CSS media query: completely disables all bouncy springs, infinite alert pulses, translateY hover lifts, sliding transforms, and timer bar shrink animations. Transitions execute instantaneously without disorienting movement.
6. **100% Offline & Zero Network Requests**:
   - Zero remote CDNs, packages, or web fonts. Uses system serif/sans typography pairings for optimal performance and privacy.
   - Sound feedback is procedurally synthesized entirely on-device using the native Web Audio API (sine and triangle oscillator blips), with an instant toggle button to mute or enable audio.
   - Data loads dynamically from `PLANTS.json` with an immediate embedded fallback guaranteeing complete functionality even when loaded via `file://`.
