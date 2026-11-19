# Moss — design notes

## Personality

Moss is a *gentle companion*, not a productivity dashboard. The voice is warm,
quietly witty, and never scolding: "Your plants are doing their best", "A little
attention goes a long way", "The plants are quietly photosynthesising". Overdue
work is flagged clearly but framed as "waiting patiently (but overdue)" rather
than an alarm.

The visual language is **warm and tactile**: a cream paper ground with a faint
blush of watercolour, dark walnut ink, leafy greens, terracotta/clay, and a
single amber accent. Type pairs a bookish serif for headings and prose with a
clean sans for UI chrome. Instead of a wall of identical cards, the composition
uses organic, asymmetric shapes — a blobby rotating leaf avatar per plant, a
wobbly hero ring, a dashed-circle motif, a tilted "field note" stamp, and
hand-drawn inline SVG botanicals. The little oddities (a mushroom doodle,
sparkle marks, a progress ring that fills as you work) are small moments of
delight, not clip art. There are no neon gradients, glass panels, or remote
fonts/assets; everything is local HTML, CSS, and inline SVG.

The queue deliberately **prioritises overdue care**: Frida (2 days overdue) is
always first, flagged with a rose edge-stripe, a sway animation, and an "overdue"
pill. Today's tasks follow, then tomorrow. A red-ish "urgency" gradient is
avoided in favour of one calm but unmistakable signal.

## Interaction model

- **Single screen, progressive disclosure.** The queue is the whole job. Each
  plant row collapses to the essentials (who, task, due, where, two obvious
  actions); "Care notes" expands an inline panel with light, water/care, and the
  observation history. This keeps the mobile view short and scannable without a
  separate route.
- **Two honest actions.** "Watered / Done" completes the task (label adapts to
  the task: Watered / Misted / Done) and "Snooze" postpones it a day. Both remove
  the row, update the progress ring, hero stats, garden log, and weekly context.
  The button label is task-aware so "Water" reads "Watered".
- **Brief undo path.** Every action raises a toast with a prominent **Undo**
  button (single-step, 6s). There's also a "Bring the queue back" control in the
  all-done state and a persistent "Reset day" in the header. A `role="status"`
  live region announces changes, and an assertive announcer narrates results.
- **Useful all-done state.** When the queue empties, it's replaced by a genuine
  reward: a potted-plant illustration, a summary of how many were cared for /
  snoozed, a "next check-in tomorrow" note, and an explicit invitation to go
  enjoy your day. It's not a blank list.
- **Compact weekly rhythm.** Seven stacked-blob columns (from `week:
  [1,3,2,4,2,1,3]`), today highlighted in clay, with a descriptive `aria-label`
  for screen readers and a short legend. Taller stacks = busier days.
- **Desktop uses the space.** At ≥900px the layout becomes a two-column grid:
  a generous primary column (hero + queue) and a sticky, narrower sidebar
  (rhythm, field note, garden log). It's a real editorial composition, not a
  stretched mobile column. The hero itself splits copy from the ring + botanical
  art on wider screens.
- **Persistence, softly.** State is saved to `localStorage` so a refresh keeps
  your progress, with "Reset day" to start over. All reads/writes are wrapped
  in try/catch so the page still works from `file://` or private mode where
  storage is blocked.

## Accessibility choices

- **Semantic structure:** a labelled `header`/`nav`/`main`/`aside`/`footer`,
  real headings, an ordered list (`<ol>`) for the prioritised queue, native
  `<button>` elements for every control, and `aria-expanded` / `aria-controls`
  on the disclosure toggles.
- **Keyboard:** a visible skip link, full tab operation, a generous
  `:focus-visible` outline (3px clay, offset) on every interactive element, and
  an `Escape` handler that dismisses the toast or collapses an open detail.
  When an action removes its own button, focus is deliberately moved to the
  equivalent button of the next pending plant (or to Undo), so focus is never
  lost to the top of the document.
- **Screen readers:** decorative SVGs are `aria-hidden` / `focusable="false"`;
  the rhythm chart is a `role="img"` with a full text description updated by JS;
  a polite log (`aria-live`) and a polite toast (`role="status"`) plus an
  assertive announcer communicate every state change. The all-done panel and
  queue are toggled with `hidden`, not just CSS.
- **Motion:** all animation is keyed off a `prefers-reduced-motion` media query
  that neutralises transitions, the sway, the blob-grow, and smooth scrolling.
  The only continuously looping motion (the overdue sway) is purely decorative
  and disabled under reduced motion.
- **Contrast & targets:** dark ink on light paper, white/green on the deep-green
  hero, pill buttons with comfortable padding and large hit areas, and text that
  stays readable over the decorative blobs. Nothing essential is conveyed by
  colour alone (overdue also has text, a stripe, and an "overdue" label).

## Files

- `index.html` — semantic shell + inline decorative SVG.
- `styles.css` — palette, shape language, responsive grid, focus/motion rules.
- `app.js` — inlined `PLANTS.json` data, rendering, actions + undo, disclosure,
  rhythm, all-done, persistence, and live-region narration. No network calls.
