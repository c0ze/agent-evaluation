# Moss — response notes

## Personality

Moss is a warm, slightly odd plant companion: a mossy pebble with a sprout,
blush cheeks, and a small lie-down philosophy. The voice is gentle and wry
("Frida’s fronds droop politely when thirsty", "Drama demands humidity, as is
Drama’s way") — never scolding, never infantilizing. Visually this reads
through: a lowercase wordmark, wavy underlines on headings, asymmetric blob
radii on cards and illustration tiles, hand-drawn inline SVG portraits per
plant (each plant gets its own accent color), and a dotted paper background.
No clip art, no gradients-as-decoration, no glass panels; rows are visually
distinct through color, illustration, tilt, and state rather than a wall of
identical cards.

## Interaction model

- **Queue** — an `<ol>` sorted overdue-first: Frida (2 days overdue) carries a
  terracotta "2 days overdue" pill plus a "Needs you most" pennant; then
  today’s tasks by urgency; then tomorrow.
- **Actions** — each row has a tactile press-down primary button labeled with
  the actual verb (Watered / Rotated / Checked / Misted) and a dashed Snooze
  button. Acting swaps the buttons for a status chip, plays a little "bloom"
  wiggle on the plant portrait, and updates the summary, "at a glance" stats,
  and Moss’s mood message.
- **Undo** — every action raises a toast (`role="status"`) with an Undo button
  for ~7 seconds; undoing rewinds the state, restores the row’s buttons and
  position, refocuses the primary button, and confirms with a short "Rewound"
  note. Single-level undo keeps this predictable.
- **Detail panel** — "Light & history" toggles an inline panel per plant with
  the light preference and a dotted timeline of water/mist/rotation and
  observation history ("New frond", "Brown edge noted").
- **Weekly rhythm** — a compact SVG bar chart of care moments per day; today’s
  bar is deep moss green with a dot under its label, and the busiest day gets
  a clay dot with a caption.
- **All-done** — when every plant is handled, the queue is replaced by a
  celebration: sleeping Moss, drifting leaf confetti, a log of what happened
  to each plant, and a "Replay today" button so the state is explorable.
- **Snoozing** sinks a plant below the active ones with a cool blue "Snoozed ·
  tomorrow" pill, making room for what actually needs attention.

## Accessibility choices

- Semantic HTML throughout: `<ol>` for the prioritized queue, real `<button>`s
  for every control, `aria-expanded`/`aria-controls` on the panel toggles with
  `role="region"` panels, `<dl>` for stats, `<figure>` for the chart.
- Full keyboard operation: everything is a native button; after an action,
  focus moves to the status chip so the keyboard position isn’t lost; moving
  into the all-done state focuses its heading; undo restores focus to the
  row’s primary button.
- A skip link jumps past the hero to the queue.
- Visible focus everywhere via a thick `:focus-visible` outline with offset.
- The toast is an `aria-live="polite"` region, so water/snooze/undo feedback
  is announced without stealing focus.
- The rhythm chart carries an `aria-label` with the full data ("Care moments
  per day…") plus a visible caption; stats are also plain text.
- `prefers-reduced-motion` disables the sway, bloom, panel pop, confetti, and
  toast animations, and smooth scrolling.
- Warm-but-tested contrast: dark brown ink on cream/paper (≈10:1), cream text
  on moss and terracotta fills; status is never conveyed by color alone
  (pills always include text).

## Layout

Mobile-first single column. From 920px the layout becomes a two-column grid —
queue on the left, and a sticky sidebar (at-a-glance stats, weekly rhythm,
"Moss says" mood) on the right — so desktop gains a real second information
lane instead of a stretched phone column; detail panels widen into two columns
at 620px.

## Constraints honored

Plain HTML/CSS/JS only — no frameworks, no fonts, no requests, no storage;
all illustrations are inline SVG, and all state lives in memory (open
`index.html` directly in a browser).
