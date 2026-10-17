# Moss — design & interaction notes

## Personality

Warm, tactile, optimistic, a little odd — never guilt-driven. The visual language is
chunky ink outlines, hard offset shadows, rotated sticker chips ("1 overdue", the date
pill), a wavy underline under today's task, and four different blob/arch frames for the
plant portraits (inline SVG, drawn per species: fern fronds, trailing pothos, bunny-ear
pads, calathea stripes). Palette is moss green, terracotta clay, and butter on a warm
speckled paper ground; type is a rounded system stack only — no external fonts, no remote
assets, no network requests, so the page works offline from `file://`. Plant data mirrors
`PLANTS.json` (embedded in `app.js` for exactly that reason). Copy stays dry and kind:
"Frida unclenches", "No guilt — plants respect a rain check". No glass panels, neon
gradients, clip-art, or wall of identical cards — the overdue plant gets a heavier border,
peach ground, and a gently wiggling chip so urgency reads at a glance.

## Interaction model

- **Queue, urgency-first.** Today's care queue is an ordered list sorted by urgency:
  Frida (Water, 2 days overdue) → Orbit (Rotate, today) → Dot (Check soil, today) →
  Drama (Mist, tomorrow, dashed border, explicitly optional). Progress ("x of 4 settled")
  and the overdue sticker update live.
- **Watered / task-done & Snooze.** Every card has a task-specific done action
  (Watered / Rotated / Checked / Misted) plus "Snooze 1 day". Done plants leave the queue
  with a small petal burst and a per-plant thank-you; snoozed plants move to tomorrow.
  Both land in "Settled & snoozed" and trigger a toast with an **Undo** button (8 seconds,
  plus a persistent Undo in the settled list, so the undo path never fully expires).
  Focus moves to the toast's Undo since the acted-on card unmounts; Escape dismisses.
- **Detail view.** A "Details" toggle expands light, location, next-care guidance, water
  notes, and the verbatim observation history from `PLANTS.json`. Frida's panel starts
  open because she's the priority.
- **Weekly rhythm.** Compact pill bars for Mon–Sun from `week: [1,3,2,4,2,1,3]`, Friday
  (today) highlighted in clay with a caption naming busiest/quietest days.
- **All-done state.** When nothing overdue/due-today remains, an all-done panel appears
  that still earns its place: it previews tomorrow (including snoozed items), while the
  rhythm, settled list with undos, and tomorrow panel stay visible.
- **Desktop.** ≥960px the single column becomes a sticky left rail (greeting, rhythm,
  tomorrow) beside the queue, with two-column detail grids — composition, not stretching.

## Accessibility choices

Semantic landmarks (`header/main/section/footer`), real `<button>`s everywhere, an
ordered list for the queue, `aria-expanded`/`aria-controls` on detail toggles, and
descriptive `aria-label`s on icon-adjacent actions. A skip link jumps to the queue.
Toast messages are mirrored to a visually-hidden `aria-live="polite"` region; the chart
uses `role="img"` with a full text equivalent ("Mon 1, Tue 3, … Friday is today").
Focus is always visible (3px clay outline via `:focus-visible`), touch targets are ≥46px,
and body text uses high-contrast ink on paper. `prefers-reduced-motion` disables the
wiggle, transitions, smooth scrolling, and the JS petal burst. A `<noscript>` block lists
all four plants, their care, history, and the weekly counts. Everything is fully operable
by keyboard (Tab/Enter/Space, Escape to dismiss).

## Files

`index.html` (structure), `styles.css` (mobile-first + desktop rail), `app.js` (state,
rendering, undo, toast, rhythm). Open `index.html` in any browser — no build or server
required; optionally `python3 -m http.server` in this directory.
