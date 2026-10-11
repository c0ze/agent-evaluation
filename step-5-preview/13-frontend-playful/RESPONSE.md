# Moss — design response

## Personality

Moss is a warm, slightly odd paper artefact: a seed-packet sticker sheet that
happens to be a care app. The palette is cream paper, warm brown ink, moss and
sage greens, terracotta, and butter yellow — nothing neon, nothing glassy.
Surfaces are tactile rather than floating: 1.5px ink-tinted borders, soft
drop shadows, chunky pill buttons with a hard bottom edge that compresses when
pressed (a physical, thumb-friendly response), and a rotating cast of organic
blob shapes instead of identical rounded rectangles. Small washi-tape stickers,
dashed "garden centre label" borders, and hand-drawn-feeling inline SVG plants
(frond fan, trailing pothos, bunny-ear cactus with a butter flower, striped
calathea) carry the expressiveness — no clip art, no illustration library, no
remote assets.

The voice is a gentle gardener who whispers. "Snoozed until evening. No guilt
accrued." "She will act unimpressed. She is not." Each plant has a one-line
personality note in the rail, and the queue hint rewrites itself around
whatever is most urgent. Delight is rationed into small moments: a droplet that
falls past the toast icon when a plant is watered, a marker-stroke highlight
behind headings, a slowly nudging overdue pill, staggered card entrances, and
leaf-count markers on the weekly rhythm chart.

## Interaction model

**Today's queue** is the spine of the page. Plants are ordered by urgency, so
Frida (2 days overdue) always sits on top with a terracotta "overdue" pill and
a tinted card frame; "Today" and "Tomorrow" get softer chips. The header
progress strip (a striped fill that springs open) shows how many of four
plants are tended.

**Watered** is the primary action on every card: one tap logs the care
timestamp into that plant's history, animates the progress strip, removes the
card from the queue, and raises a toast with the plant's reaction — plus an
**Undo** button that lives for 7 seconds and restores the entire previous
state (queue, history, progress). When a keyboard user's focused button
disappears with the card, focus is deliberately moved to the next sensible
control (next card's Watered button, then the snooze corner, then the all-done
panel), so nobody gets dumped on `<body>`.

**Snooze** moves the plant to the dashed "snooze corner" below the queue with
"until evening" framing, keeping both actions available there (Watered, Wake
up). Every mutation — water, snooze, wake, and the demo reset — pushes a
snapshot onto an undo stack and offers the same brief undo path.

**Details** expands an inline panel (real `aria-expanded`/`aria-controls`
button, `hidden` panel so collapsed content stays out of the accessibility
tree) with care facts — light requirement, last soak date, next task — and the
full history timeline, where care events are bold and observations
("Brown edge noted", "New frond") are italicised whispers.

**Weekly rhythm** is a compact SVG: one stem per day, one leaf per care visit,
counts labelled, today marked with a butter sun and a dark "today" chip, and a
sentence caption ("15 little visits across seven days — steady beats heroic").
It has a text equivalent via `role="img"` and a descriptive `aria-label`.

**All-done state** appears the moment the queue empties: a blob-shaped panel
with a sprout-in-hands illustration, copy that adapts to what remains snoozed,
and a "wind back to this morning" reset so the state is always explorable.

**Desktop composition** is a two-column layout, not a stretched phone: the
queue keeps a comfortable measure on the left while a right rail holds the
weekly rhythm and greenhouse notes. Inside each card, desktop switches to a
three-column arrangement — illustration, identity, stacked actions — and the
details toggle tucks under the meta row.

## Accessibility choices

- **Semantics first**: `header`/`main`/`aside`/`section` landmarks, a skip
  link, real `<button>` controls, `<ul>` lists for the queue and history, an
  `<output role="status">` toast with `aria-live="polite"`, a labelled
  `role="progressbar"` with `aria-valuetext`, and `aria-hidden` on decorative
  SVGs.
- **Keyboard**: every control is natively focusable and operable; `Escape`
  dismisses the toast; focus is actively managed after destructive-feeling
  actions; `:focus-visible` rings are 3px moss-dark outlines with offset, and
  buttons use 2px borders plus shadow states so hover/active/focus are
  distinguishable without colour alone.
- **Contrast**: body text is #33291f on #fffcf5/#f6efe3, secondary text stays
  above 4.5:1, and coloured chips (moss, terracotta, butter) were picked to
  keep white/dark text legible rather than using light tint-on-tint.
- **Reduced motion**: `prefers-reduced-motion: reduce` collapses all
  animations and transitions (card entrances, the nudge, the pour, progress
  spring), and the droplet delight is a decorative extra that simply stops.
- **No network**: everything — fonts (system serif/sans stacks), illustrations
  (inline SVG), icons, data (a mirrored copy of `PLANTS.json`) — is local, so
  the page works offline from `file://`.

## Files

- `index.html` — structure and static copy
- `styles.css` — design system, responsive composition, motion
- `app.js` — state, rendering, interactions, undo, illustrations

Open `index.html` in a browser. No build step, no dependencies.
