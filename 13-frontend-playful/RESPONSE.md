# Moss — Design & Architecture Notes

## Personality & Visual Direction

**Moss** is designed to feel like an illustrated botanical field-journal and terracotta shelf companion rather than a generic to-do app:

- **Warm, tactile surface language**: Unbleached oatmeal paper (`#F4EFE4`) with pure CSS micro-dot paper grain, warm ivory cards (`#FBF8F1`), terracotta clay accents (`#A94324`), deep pine ink (`#1D2A1F`), and solid offset press-shadows (`box-shadow: 0 3px 0 ...`) instead of glass panels, neon gradients, or soft SaaS drop shadows.
- **Expressive, differentiated shapes**: Instead of a flat stack of identical rectangles, each queue tier has distinct weight and silhouette—organic pebble radii on today’s cards, a clay-washed spotlight card for overdue care, dashed recessed oatmeal cards for tomorrow’s calm tasks, and arched alcove frames for plant portraits.
- **Custom inline SVG illustrations & slightly odd roommate voice**: Each plant (`Frida`, `Orbit`, `Dot`, `Drama`) has a bespoke botanical illustration in a distinct planter style (ribbed terracotta, speckled stoneware, scalloped ochre pinch pot, fluted forest ceramic) paired with dryly affectionate roommate notes. All illustrations and textures are local HTML/CSS/inline SVG with zero external assets, fonts, or network requests.

## Interaction Model

- **Urgency-first care queue**: Plants from `PLANTS.json` sort strictly by `urgency` (`Frida` overdue at top, `Orbit` and `Dot` due today, `Drama` resting until tomorrow).
- **Responsive detail pattern (not a stretched mobile column)**:
  - **Mobile (`< 860px`)**: Each plant’s **Details** control expands an inline botanical dossier directly inside its card showing **Light** exposure pips, derived **Water** history status, full **Observation & Care History**, universal **Watered** / task / **Snooze** buttons, and a quick-note composer.
  - **Desktop (`>= 860px`)**: The layout shifts into an asymmetric two-column workbench (`1.15fr` queue + sticky `0.9fr` companion rail) pairing the **Weekly Rhythm** pebble-stack chart above a persistent **Plant Dossier** side panel pre-loaded with the highest-priority plant.
- **Task completion, watering, snooze & brief undo**:
  - Completing Frida’s task (`Watered`) or other plants’ tasks (`Rotated`, `Checked soil`, `Misted`), logging watering from any dossier, or clicking **Snooze** updates the plant state, prepends to observation history, increments today’s column in the **Weekly Rhythm** visualization (`week[6]`), and surfaces a brief **Undo** toast (7 seconds, automatically paused on hover or keyboard focus) alongside per-item **Undo** controls in the **Handled today** tray.
- **Useful all-done state**: Clearing all overdue and due-today tasks reveals a windowsill sanctuary summarizing tended vs. snoozed plants, surfacing tomorrow’s next plant (`Drama`) with early inspection/completion options, keeping handled history accessible, and offering a **Start fresh day** reset.

## Accessibility Choices

- **Semantic structure & native controls**: Uses `<header>`, `<main>`, `<section>`, `<aside>`, an ordered `h1 -> h2 -> h3 -> h4` hierarchy, a skip-to-queue link, and native `<button type="button">` / `<form>` controls with descriptive `aria-label` attributes.
- **Visible focus & contrast**: High-contrast ink-on-paper palette (`#1D2A1F` on `#FBF8F1` / `#F4EFE4`, `#FFFBF5` on `#A94324` terracotta and `#2F5E3B` moss), `44px` minimum interactive heights, crisp `:focus-visible` outlines (`#A94324` on light surfaces, `#EAB84E` ochre on the dark undo toast), and `data-focus-id` focus preservation across re-renders—including moving keyboard focus cleanly to the next due plant or all-done heading when a card leaves the active queue.
- **Live announcements & keyboard shortcuts**: An offscreen `aria-live="polite"` region and status toast announce completed actions and undo availability; `Escape` dismisses active notifications or collapses expanded mobile drawers while restoring focus safely.
- **Reduced-motion support**: `@media (prefers-reduced-motion: reduce)` disables transitions, button press transforms, smooth scrolling, and the gentle leaf-sway SVG animation (`svg-sway`).
