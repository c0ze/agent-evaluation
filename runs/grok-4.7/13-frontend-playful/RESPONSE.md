# Moss

A paper sunroom ledger for four houseplants. The voice is dry and fond, the shapes are a little irregular, and the overdue plant is the one the page insists you see first.

## Personality

The page is warm paper with a moss wash and a clay stake for lateness. Display type is a local serif (Noto Serif Display, then Liberation Serif, DejaVu Serif, Georgia). Interface type is Cantarell, then Liberation Sans. Nothing is loaded from the network, and the plant records are copied into `app.js` so the screen works from `file://` without `fetch`.

Frida, two days overdue, carries the clay border and the largest name. Orbit and Dot sit as ordinary today tickets. Drama, due tomorrow, is quieter. Each plant has a short aside written for that pot: Frida’s brown tips file a complaint, Orbit wants a quarter-turn toward the books, Dot only needs a finger in the soil, Drama is tomorrow’s plant unless the edges curl. Illustrations are inline linocut pots — a pinnate fern, a trailing pothos, a bunny-ears cactus, a broad calathea — drawn as shapes, not clip-art faces.

The week is seven stones, Monday to Sunday, sized from the `week` array (`1, 3, 2, 4, 2, 1, 3`). Today gets a clay ring whose fill is how many of the four cares are logged. The week numbers themselves never change; the ring is the log.

When every care is logged, the queue becomes the poster “The sill is quiet,” with a recap of what was done and a next glance that still mentions Drama’s brown edge and that Frida is caught up.

## Interaction model

The queue is sorted by the original urgency, highest first, then the original order: Frida (Water), Orbit (Rotate), Dot (Check soil), Drama (Mist).

On a phone the weekly rhythm sits under the header, then the ordered list. Notes start closed so Watered and Snooze stay on the first screen. The button label is the task’s past tense — Watered, Rotated, Soil checked, Misted — not a generic “Watered” for every plant. Notes opens an inline panel with the aside, a three-pane light meter (Low / Medium / Bright), water history, and observations. Watered, misted, and soil-checked lines go under Water; the rest (new frond, wiped leaves, brown edge, rotations) go under Observations.

From 960px up the page is two columns. The left column is the sunroom: four pots on a sill, the selected plant’s drawing beside its copy, the two care buttons, then light, water, and observations. The right column is the ledger: the weekly rhythm, then the same priority queue. Arrow keys walk within the sill, the queue, or the settled list, so focus follows the column you are in.

Watered writes today’s date and the verb at the top of that plant’s history, marks it done, moves the selection to the next open plant, and shows a toast. Snooze sets the due line to “Later today” and files the plant under that heading; it can still be logged from there, and it no longer offers another snooze. Both actions push a snapshot. The toast offers Undo and Close, stays about eight seconds, and pauses while the pointer or focus is on it. Undo restores one snapshot and puts that plant back in view. Close, or Escape, keeps the change and clears the stack. After the fourth log, the selection clears, the sill marks each pot Done, and the poster replaces the open queue. Settled rows stay, so notes can still be opened. Desktop all-done keeps the poster in the sunroom and a short “All logged” note in the ledger.

## Accessibility choices

The shell is one main landmark, a header, a footer, and a skip link to the care queue. The queue is an ordered list, so priority is in the structure as well as the color. Ticket buttons expose `aria-expanded`, `aria-controls` when notes are open, and `aria-current` on the selected plant. Compact row buttons include the plant name for screen readers. The toast is a `role="status"` region with `aria-atomic="true"`. Illustrations and decorative icons are `aria-hidden`; day names and rhythm values have screen-reader text beside the short labels.

Focus is a 3px ink outline, suppressed only for mouse `:focus:not(:focus-visible)`. Targets are at least 48px. Tab reaches every control. Arrow keys, Home, and End move inside the current list. Escape closes open mobile notes, or dismisses the undo toast and keeps the change. Without JavaScript, a noscript list still names the four plants in priority order.

Ink on paper is about 14:1. Cream button labels sit on moss at about 11:1. Late copy is clay `#6b2e1c` on a warm ground, about 8:1, rather than text set on the mid green. `prefers-reduced-motion: reduce` removes the toast animation, transitions, and the pressed-button shift. `forced-colors` keeps control borders, and `prefers-contrast: more` darkens the quieter ticket edges. The document title tracks the queue: overdue count, how many remain, or “all done today.”
