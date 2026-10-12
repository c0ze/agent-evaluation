# Moss — response notes

## Personality

Moss is warm, tactile, optimistic, and a little odd — like a helpful friend who
keeps plants, not a dashboard. The palette is sun-baked paper (`#f6efe3`), deep
moss green, terracotta clay, and marigold, over a faint dotted paper texture.
Cards use asymmetric "organic" corner radii, plant portraits are hand-drawn
inline SVG (a swaying fern, a trailing pothos, a bunny-ears cactus, a striped
calathea), and the brand mark and "Moss mood" blob gently bob. Small delights:
overdue plants sway, the mood blob grows a flower when the queue is clear, and
every action gets a friendly one-line toast. No gradients-as-decoration, no
glass, no clip art — color is flat, warm, and confident, and type stays large
and readable.

## Interaction model

- **Care queue.** The four plants from `PLANTS.json` render as an expandable
  list, sorted so overdue care (urgency ≥ 3) leads, followed by today's tasks,
  then tomorrow's; cared-for plants sink to the bottom. Overdue rows carry a
  clay left-edge and badge.
- **Detail panel.** Each plant header is a real `<button>` with
  `aria-expanded`/`aria-controls` that reveals a panel with light needs, next
  task, location, recent notes (light/water/observation history), and the two
  actions. `Escape` closes the panel and returns focus to its header.
- **Watered / snooze with undo.** "Mark …" marks the plant cared-for (done
  styling, disabled button, queue count updates); "Snooze to tomorrow" moves
  the task out of today. Both fire a toast with an **Undo** button that fully
  reverts the change; toasts auto-dismiss after 6 seconds.
- **Weekly rhythm.** A compact seven-bar chart of the `week` array, with
  Monday-first labels and today's bar highlighted in clay. It carries a
  `role="img"` + `aria-label` summary and per-bar `title`s.
- **All-done state.** When every plant is cared for, a celebratory moss panel
  appears above the queue ("All done — the moss is thriving") with a **Start
  the day over** reset, and the mood blob blooms.
- **Desktop composition.** Above 920px the layout becomes a two-column grid:
  the queue on the left, a sticky sidebar on the right holding the weekly
  rhythm and the mood character — space is used for a companion panel, not by
  stretching the mobile column. Detail facts go multi-column at wider widths.

## Accessibility choices

- Fully keyboard-operable: every control is a native `<button>`; focus order
  follows the visual order; a skip link jumps to the queue.
- Visible focus: a high-contrast double-ring `:focus-visible` style on all
  interactive elements.
- Semantic structure: `header`/`main`/`section`/`aside`, a single `h1`, list
  markup for the queue and histories, `aria-expanded`/`aria-controls` on
  expanders, `aria-live="polite"` on the queue count, mood label, and toast
  (`role="status"`).
- The decorative SVGs are `aria-hidden`; plant illustrations that convey
  identity have `role="img"` + `aria-label`; the rhythm chart has a text
  alternative via `role="img"` + `aria-label`.
- `prefers-reduced-motion: reduce` disables all animation and transitions
  (bobbing, swaying, toast entrance, smooth scroll).
- Data loads from local `PLANTS.json` via `fetch`, with an embedded copy as a
  fallback so the page works from `file://` too. No network requests, external
  fonts, frameworks, or remote assets of any kind.
