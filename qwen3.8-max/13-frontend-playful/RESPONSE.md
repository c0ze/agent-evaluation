# Moss — response notes

## Personality

Moss is a sticker-book, not a dashboard. The palette is warm paper cream, deep
moss green, terracotta and marigold; every surface is drawn with a 2px ink
outline and a hard offset shadow, so cards feel like paper cut-outs you could
peel off the screen. The shape language is deliberately uneven: organic
`border-radius` blobs (never the same twice), pills rotated a degree or two,
a dotted paper-grain background, and a serif display face (Iowan/Georgia)
against a humanist sans body. Small moments of delight: the logo blob bobs and
has a face, each plant gets a hand-drawn inline-SVG portrait (fern fronds,
pothos hearts, bunny-ear pads, striped calathea leaves), bars grow from the
soil on load, and the all-done state is a big smiling moss blob with confetti
sparks and tilted "done" chips. Overdue care is the one loud voice in the room
— a terracotta border and a rotated "2 DAYS OVERDUE" stamp — while everything
else stays calm. No gradients, no glass, no clip art, no card wall: the queue
is a single ranked list with clear visual hierarchy.

## Interaction model

- **One ranked queue.** Plants are sorted by urgency; overdue first. Each card
  shows portrait, name, species · location, a due pill, and the two primary
  actions immediately — no hunting for controls.
- **Progressive disclosure.** The card header is a toggle (`aria-expanded`)
  that unfolds an in-card panel with light, water (last watering + tendency),
  a "watch" observation, and the full observation log as a dotted timeline.
  One card open at a time keeps mobile focused.
- **Act, then undo.** "Watered / Rotated / Soil checked / Misted" and "Snooze"
  mutate the list instantly (done items drop to a "Done today" tray with a
  put-back button; snoozed items move to "Snoozed for later"). Every mutation
  raises a snackbar with a 6-second **Undo** that restores the exact previous
  state; focus moves to the Undo button so the escape hatch is reachable
  without a pointer, and focus returns to the queue when the toast expires.
- **All-done is a reward, not a dead end.** When nothing is pending, the queue
  is replaced by the happy blob, a summary line, and chips for every plant
  cared for today.
- **Weekly rhythm.** The `week` array renders as a seven-bar chart with
  counts, a highlighted peak day, and a plain-language note; the sidebar also
  keeps a household tally and a rotating "Moss says" nudge.
- **Desktop composition.** At ≥56rem the layout becomes two columns: the queue
  breathes in a wide main column while a sticky sidebar holds rhythm, tally
  and tip — space is used for context, not for stretching one column.

## Accessibility choices

- Semantic structure: `header/main/aside/section`, one `h1`, labelled
  sections, lists for queues and logs, real `<button>`s for every control.
- Keyboard: skip link to the queue; `↑/↓` move between plant cards; `Enter`
  toggles details; `W` and `S` trigger care/snooze on the focused card; `Esc`
  closes the open panel or dismisses the toast; all documented in a visible
  hint line.
- Visible focus: a 3px terracotta `:focus-visible` outline with offset on every
  interactive element; focus is managed after mutations (to Undo, then back to
  the queue) so keyboard users never land on `body`.
- Screen readers: `aria-expanded`/`aria-controls` on card toggles, a polite
  live region announcing every action and undo, the week chart exposed as a
  single `role="img"` with a full spoken summary, decorative SVGs
  `aria-hidden`, and status toasts in a `role="status"` container.
- Reduced motion: a global `prefers-reduced-motion` block collapses all
  animations and transitions (bob, sway, bar growth, unfold, toast pop) to
  near-zero, and hover lifts are gated behind `no-preference`.
- Readability: high-contrast ink-on-cream text, uppercase micro-labels kept
  ≥0.68rem, generous tap targets (≥44px), and text that reflows to two lines
  rather than truncating on narrow screens.
- No network, no frameworks: data renders synchronously from an embedded
  mirror of `PLANTS.json`, then refreshes from the file when served, so the
  screen is never blank and works from `file://` too.
