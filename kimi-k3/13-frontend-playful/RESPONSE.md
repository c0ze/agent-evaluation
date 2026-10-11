# Moss — design notes

## Personality

Moss is a small, warm, slightly odd companion — a smiling moss blob that bobs
gently in the header and naps on a hill when the day is done. The visual
language is hand-formed rather than corporate: cards and buttons use wobbly,
asymmetric border radii (no two corners alike), shadows are low and soft like
paper on a table, and the palette is drawn from a potting bench — cream, moss
green, terracotta, mustard. Illustrations are simple inline SVG line-and-blob
drawings of each actual plant (Frida's arching fern fronds, Orbit's trailing
pothos hearts, Dot's bunny-ear pads, Drama's striped calathea leaves), so the
app feels crafted rather than clip-arty. Copy stays gentle and a little wry:
"Snoozed to tomorrow — no guilt, plants are patient," "Fronds first, then tea."

Small delights: the brand blob idles with a slow sway, the overdue chip
occasionally nudges sideways as if tapping your shoulder, finishing a task
releases a flutter of leaf confetti, and cards plop into place with a soft
overshoot ease.

## Interaction model

- **Care queue first.** The four plants from `PLANTS.json` are sorted by
  urgency; overdue care (Frida) is pinned to the top with a terracotta card
  treatment and a pulsing "2 days overdue" chip, so priority is scannable at a
  glance. A live counter ("4 of 4 still need you") tracks progress.
- **Expandable details.** Each card has a chevron toggle (`aria-expanded`,
  `aria-controls`) that opens a panel with light needs, the upcoming care task,
  and the observation history. Fresh entries added during the session are
  highlighted with a mustard dot.
- **Done and snooze.** The primary button is task-aware ("Watered" for
  watering, "Mark 'Rotate' done" otherwise). Done plants sink to the bottom
  with a green check chip; snoozed plants drop to a dashed, muted card marked
  "Snoozed to tomorrow." Both actions add a dated note to the plant's history.
- **Undo path.** Every action raises a toast with an Undo button that stays
  for 8 seconds (Escape dismisses). Focus moves to the Undo button, and
  undoing returns focus to the affected card's action button, restoring the
  exact prior state including history entries.
- **Weekly rhythm.** A compact seven-bar chart visualizes the `week` data,
  with today picked out in mustard, a text summary ("busiest on Thu"), and a
  full `role="img"` aria-label reading out each day's count.
- **All-done state.** When the queue is empty, the list is replaced by a
  resting-on-a-hill illustration, an encouraging message, and a "Start a fresh
  day" reset button — a moment of closure rather than a dead end.
- **Desktop composition.** At ≥960px the layout becomes a true two-column
  composition: the queue breathes in a wider column while a sticky sidebar
  holds the weekly rhythm and the "Windowsill whisper," a status line that
  always reflects the current state of the day.

## Accessibility

- **Semantic controls everywhere**: real `<button>` elements for expand, done,
  snooze, undo, and reset — so keyboard operation (Tab / Enter / Space) works
  natively with no custom key handling. The queue is an ordered list; detail
  facts use `<dl>`; history is a list.
- **Visible focus**: a thick terracotta `:focus-visible` outline on every
  interactive element, chosen to contrast with both cream and green surfaces.
- **Screen-reader support**: expand toggles carry `aria-expanded` /
  `aria-controls` and plant-specific labels; the queue counter is a polite
  live region (`role="status"`); the toast announces action results; the week
  chart has a complete text alternative; all SVG illustration is
  `aria-hidden`.
- **Reduced motion**: `prefers-reduced-motion` collapses every animation and
  transition (sway, plop, nudge, confetti — the confetti is also skipped in
  JS), and the expand panel opens instantly instead of animating.
- **Readability**: system font stack with generous line-height, body text
  never below ~0.72rem except decorative chart counts, and color pairings kept
  at strong contrast (deep green/terracotta on cream).
- **Zero network**: data from `PLANTS.json` is embedded in `app.js` (mirrored
  verbatim), so the app runs from `file://` with no requests, no external
  fonts, and no frameworks.
