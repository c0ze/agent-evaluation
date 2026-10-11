# Moss — design & build notes

## Personality

Moss is a warm, unhurried household companion rather than a productivity
manager. The tone is optimistic and slightly odd: the app talks about plants as
characters ("not a single leaf complains"), calls itself "Moss, whenever
asked", and pairs matter-of-fact care tasks with gentle asides. The visual
language leans tactile and botanical — warm paper, moss green, clay and ochre —
with hand-drawn inline SVG leaves whose shapes match each species (feathery
fern fronds, a heart-leaf pothos, bunny-ear cactus pads, a striped calathea).
Every plant gets its own muted tint and silhouette so the queue never reads as
a wall of identical cards. Rounded, slightly irregular "blob" geometry and soft
shadows keep things organic; there are no neon gradients or glass panels.

## Interaction model

- **Care queue** is sorted so overdue work always floats to the top
  (`offset` ascending, then `urgency` descending). Frida (2 days overdue) leads,
  followed by today's tasks, then tomorrow's mist.
- **Detail panel** is an inline expandable region: tap/click the row (or press
  Enter/Space on it) to reveal light, water and location facts plus the care
  log. The chevron and `aria-expanded` signal state; the panel animates with a
  grid-row transition.
- **"Watered" / "Snooze"** are the two live actions. The primary button is
  labelled with the task's past tense (Watered, Rotated, Checked soil, Misted).
  Watering adds a dated entry to that plant's log, animates the card out, and
  surfaces a timed **Undo** toast. Snooze pushes the due date forward one day,
  lowers urgency, and re-sorts the list; it is equally undoable. Undo restores a
  snapshot of the plant's full state (including its history).
- **Weekly rhythm** is a compact seven-day stem chart. Each bar's height is the
  task count for that day, topped with a small leaf; bars rise in on load and
  each day exposes a descriptive label.
- **All-done state** appears only when the queue is empty. It celebrates with a
  swaying sprout, lists exactly what was done, and offers a link back to the
  weekly rhythm so the screen never dead-ends.

## Accessibility & resilience

- **Keyboard**: every interactive element is a real `<button>`/`<a>`; the
  accordion rows are buttons with `aria-expanded` + `aria-controls`, so they
  work with Enter/Space and Tab. Panels contain no focusable descendants that
  could be tabbed into while collapsed.
- **Visible focus**: a high-contrast clay `:focus-visible` ring on all controls.
- **Semantics**: `<header>`, `<main>`, `<section>` landmarks, `h1`-style brand
  and ordered `h2` headings, `<ul>`/`<li>` for lists, `<dl>`-style fact grid,
  `role="region"` on panels, `role="img"` with an overall label on the chart,
  and `role="status"`/`aria-live="polite"` on the toast so undo is announced.
- **Not colour-only**: overdue/today/tomorrow badges combine colour with a text
  label and a marker dot, so status survives colour-blindness and monochrome.
- **Reduced motion**: a `prefers-reduced-motion` query collapses the sway,
  blink, rise and slide animations and disables smooth scrolling.
- **Offline**: plant data from `PLANTS.json` is inlined in `app.js`, so the
  screen runs straight from `file://` with zero fetch/network requests, external
  fonts or remote assets. Fonts are system stacks (a warm serif for headings, a
  sans for UI).
