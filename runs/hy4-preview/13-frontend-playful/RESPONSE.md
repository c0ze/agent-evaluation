# Moss — response notes

Files: `index.html`, `styles.css`, `app.js` (plus a `RESPONSE.md` you are reading). No builds, no
packages, no remote fonts or images. Every illustration is inline SVG; every colour, texture, and
motion is CSS. Plant data is mirrored from `PLANTS.json` into a constant at the top of `app.js` so
the page also works when opened straight from the file system (`fetch` on `file://` would fail, and
a network request is disallowed by the brief).

## Personality

Moss is a household companion, not a dashboard. It speaks in short, warm sentences ("Frida has been
waiting 2 days. Everyone else can follow.") and it does not scold: an overdue plant is a *clay-red
accent and a bigger voice*, never an error state.

- **Material:** warm paper cream with a fine speckled grain, soft asymmetric "blob" radii, buttons
  that sit 3px proud of the page and press down when tapped. Tactile rather than glassy — no
  `backdrop-filter`, no neon gradients, no floating panels.
- **Shape language:** every card, avatar well, and seed in the week chart uses organic, unequal
  corner radii; the overdue card leans on a left "stem" rule and a clay-to-cream wash so it reads as
  different in kind, not just in hue.
- **Type:** a serif display face (Iowan/Palatino/Georgia stack) for names and headings against a
  system sans for controls — bookish warmth where a voice is speaking, plain utility where a finger
  is pressing.
- **Small delights:** each plant has its own hand-built pot and foliage; watering makes the avatar
  perk and the card breathe a green ring; snoozing floats a moon into the toast; the newest seed in
  the weekly chart pops in rather than appearing; the all-done scene has a slowly turning sun over a
  sprouting hill.
- **Not a wall of cards:** care cards are grouped (Needs you now / Tomorrow / Tended today), coloured
  by urgency (clay, ochre, sage, moss), sized by importance, and each carries the icon of its own
  task — water, rotate, soil check, mist.

## Interaction model

- **One queue, priority-ordered.** Overdue first (Frida), then today (Orbit, Dot), then tomorrow
  (Drama). Order is derived from `urgency` and re-sorted live as state changes, so the list always
  answers "what now?".
- **Two verbs per plant.** The primary button is the task's own completion word — *Watered*,
  *Rotated*, *Checked*, *Misted* — because "Watered" is wrong for a rotation; the secondary is
  **Snooze**, which pushes the plant to tomorrow and says so on the badge. Both live on the card and
  again in the detail panel.
- **Undo, briefly and visibly.** Every action writes a snapshot (status + week counts) and raises a
  toast for 8 seconds with a depleting timer bar and an **Undo** button; the same undo is mirrored
  on the card and in the all-done panel. `u` undoes from the keyboard. When the window closes, the
  change simply stands — no lingering ghost buttons. **Reset day** restores the morning for
  demoing.
- **Detail follows context.** On phones the panel is an accordion that JS moves *into* the tapped
  card (so it expands in place and travels with the plant when it moves to *Tended today*). From
  900px up the same node is re-parented into a sticky right-hand column and stays open, turning the
  page into two working surfaces: queue on the left, plant on the right.
- **Weekly rhythm** is seven stalks of stacked seeds — one seed per care task, Saturday ringed as
  today. It is live: finishing a task grows today's stalk, snoozing grows tomorrow's, undo shrinks
  them back. A line beneath names the busiest and quietest days.
- **All done** replaces urgency with a wide scene spanning the desktop grid: what you did, per
  plant, plus an undo for the last one; the queue's empty groups collapse away and the header pill
  turns to "All tended".

## Accessibility

- Real controls: `<button>` everywhere, `<ul>/<ol>` for lists, `<dl>` for light/water facts,
  `aria-expanded` + `aria-controls` on the plant name, `aria-label`s that name the plant and the
  action ("Mark Water done for Frida").
- Keyboard: a skip link to the queue, logical DOM order, visible 3px focus rings with offset,
  `Escape` closes the phone panel (returning focus to its trigger), `u` undoes. Focus is never
  orphaned — when an undo button times out, focus moves back to its card.
- Live regions: the toast is a polite `role="status"`; the counters and progress bar are plain text
  with the bar itself `aria-hidden`; each week column has a full label ("Saturday: 1 care task,
  today").
- Targets: buttons are ≥44px tall, including the plant-name trigger.
- Contrast: ink on cream is ~12:1, secondary text ~5.5:1, and urgency colours are used for accents,
  chips, and bars with text always in a darkened variant of the same hue.
- Motion: `prefers-reduced-motion` collapses every animation and transition (and hides the toast
  timer) while keeping every state change; `prefers-contrast: more` thickens borders and darkens
  secondary text.

## Breakpoints

Single column to 899px (detail as an inline accordion). At 900px: two named grid areas — greeting +
queue left, week + sticky detail right. At 1060px cards lie down (art and name left, actions on a
right rail) so width buys density rather than a stretched column. At 1120px the detail art and fact
grid widen. Verified in headless Chrome at 360/620/900/1000/1060/1280/1440 with no horizontal
overflow.

## Trade-offs

Only four plants and one day are modelled, so the week chart is a rhythm, not a calendar you can
navigate. Completion is optimistic — the app trusts you rather than asking "are you sure?" — which
is why the undo path is generous and always visible while it lasts.
