# Moss — response notes

## Personality
Moss is a gentle, slightly odd household companion — warm and tactile, never
saccharine. The voice is a calm friend who knows each plant's quirks: Frida
"sulks fastest", Dot "feels superior" about needing no water, Drama is
"asleep, not mad". Copy stays short and useful; oddness lives in the field
notes and microcopy, never in instructions.

The shape language is sticker-like and chunky: thick ink outlines, offset hard
shadows, pebble and arch radii that differ per card so the queue never reads as
a wall of identical rectangles. The palette is warm sand, moss green, clay,
and marigold — optimistic without neon. All illustration is inline SVG
(windowsill hero, per-plant pot doodles, all-done sun), so the page works fully
offline with zero requests beyond its three files. Texture is a faint moss-dot
grid, not a gradient wash.

## Interaction model
- **Overdue first.** The queue is sorted by urgency, and the overdue card is
  visually promoted: striped clay border, "First up · overdue" flag, dot on the
  pot, and it starts expanded so its story is visible immediately.
- **Disclosure, not navigation.** Each plant is a `<button aria-expanded>`
  that toggles an inline detail region (light, water guide + rhythm + last
  watering, a character note, observation history). Esc collapses; focus is
  preserved across re-renders.
- **Verbs match the task.** The primary action reads Watered / Misted /
  Rotated / Checked depending on the plant's actual job — a small moment of
  care that costs one line of code.
- **Forgiving actions.** "Watered" plays a droplet-and-leaf burst and moves the
  plant to done; "Snooze" demotes it with a dashed, muted card reading
  "Snoozed · back tomorrow". Both post a toast with **Undo** (6 s, with a
  shrinking timer bar); snoozed and done cards also keep a persistent way back,
  so nothing ever vanishes.
- **Progress + all-done.** A pebble progress bar counts tended plants. Clearing
  the queue swaps it for a celebratory panel with a next-up note for tomorrow,
  a "Review the crew" path back to per-plant undo, and a demo reset.
- **Weekly rhythm.** Seven rounded bars from `week` data, today pill-marked,
  busiest day tinted, each bar carrying its own accessible label plus a plain
  sentence summary.
- **Desktop composition.** Above 960px the page becomes a real two-column
  layout: hero splits copy/art, the queue runs two-across with the overdue
  card spanning full width in a horizontal arrangement, and the rhythm, field
  note, and "How Moss thinks" cards pin as a sticky sidebar.

## Accessibility choices
- Semantic structure: skip link, one `h1`, labelled sections, the queue as an
  ordered list (order is meaningful), native buttons throughout.
- Visible focus everywhere via `:focus-visible` (moss outline; marigold on
  dark surfaces), with the default outline never removed without replacement.
- Detail regions use `aria-expanded`/`aria-controls`; the toast is a polite
  live region and key events are also announced through a separate status node.
- `prefers-reduced-motion: reduce` disables all animation and transitions in
  CSS, and the JS burst/scroll paths check the same media query before moving.
- Contrast: body text is warm near-black on sand/paper; the overdue chip uses
  white on deepened clay; urgency is never carried by color alone (it also has
  text, position, and shape).
- Touch targets: action buttons are full-width halves of the card (~48px
  tall); the disclosure chevron is a 34px hit area inside a much larger button.
