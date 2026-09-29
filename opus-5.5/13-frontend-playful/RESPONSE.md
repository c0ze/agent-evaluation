# Moss: design notes

Open `index.html` directly (file:// works). It uses only local HTML, CSS and JS.
There are no frameworks, fonts, remote assets or network requests. The data in
`PLANTS.json` is copied into `app.js` because browsers block `fetch()` of local
files under file://, and a copy also keeps the page free of requests. The newest
history entry is Sep 21, so Moss treats **Tuesday, Sep 22** as "today".

## Personality

- **Warm and tactile.** The colours are speckled paper, terracotta clay, moss
  green and ochre. Buttons have a solid bottom edge that sinks when pressed, like
  a physical key. Headings use a bookish serif and body text uses a rounded sans,
  both from system font stacks.
- **A little odd.** Every pot has a small face that shows how the plant is
  doing: worried when overdue, blinking when fine, smiling with blush when done,
  and asleep with "z z" when snoozed. The mascot, Moss, is a moss ball with a
  sprout whose outline slowly changes shape. Its eyes and sprout react to the
  day. Each plant has a one-line quirk ("Looks soft. Is not.").
- **Expressive shapes without a wall of cards.** Each priority level has its own
  shape. The overdue plant is a large clay blob with a big illustration and a
  rotated "2 days overdue" sticker. Today's tasks sit on paper cards with one
  asymmetric corner. Upcoming and snoozed items are quiet dashed pill rows, with
  hatching when snoozed. Finished plants move onto a wooden **Done today** shelf.
- **Hand-built illustration.** All illustration is inline SVG drawn in code. The
  fern's fronds are a dashed thick stroke, the pothos has variegated heart
  leaves, Dot has bunny-ear pads with glochid dots, and Drama has striped round
  leaves. The SVG colours come from CSS variables, so they switch to the dark
  theme too.

## Layout

- **Phone (below 700px):** the greeting and progress come first, then the queue
  with the most urgent item at the top, then the weekly rhythm. The DOM follows
  this order, so screen-reader order matches what is on screen. Plant details
  open in a bottom sheet built on the native `<dialog>`.
- **Tablet (700–999px):** the greeting and the rhythm sit side by side at the
  top, and the queue below them uses the full width. Today's cards are in two
  columns.
- **Desktop (1000px and up):** three columns. The left rail holds the greeting,
  progress, rhythm and keyboard hints. The queue is in the middle. On the right,
  a detail pane stays in view (sticky) and always shows the selected plant, or
  the most urgent one by default. This is a different composition, not a
  stretched mobile column.

## Interaction model

- **Queue order** is overdue first, then today, then by `urgency`. Items are
  grouped as "Needs you first", "Also today", "Coming up" and "Done today".
- **Primary action** changes with the task: **Watered**, **Rotated**, **Soil
  checked** or **Misted**. It marks the plant done, adds a dated entry to its
  history, moves it onto the shelf and fills one leaf in today's rhythm column.
  The detail view also has **Log a watering** for any plant, which completes the
  task if that task was watering.
- **Snooze** moves the task to tomorrow (or the day after, if it was already due
  tomorrow). A snoozed row has a **Do today** button that brings it back.
- **Undo:** every change opens a toast with an **Undo** button, a countdown bar
  that drains over 8 seconds, and the <kbd>U</kbd> shortcut (or Ctrl/Cmd+Z).
  The countdown pauses while the pointer or keyboard focus is on the toast. Undo
  restores a snapshot, so it reverses done, snooze, wake, water and notes the
  same way.
- **Detail view:** species, location and status; light shown as a 3-step meter
  with a tip; water shown as the last watering (worked out from history), how
  many days ago, and a care tip; the observation history as a timeline; and a
  small form for adding a new observation.
- **Weekly rhythm:** a compact stem-and-leaf chart of `week` (Monday first).
  Past days are filled, future days are outlined, and today is ochre. Today's
  leaves fill in as you finish tasks.
- **All-done state:** Moss smiles, and the page summarises what you did ("You
  watered Frida, rotated Orbit…"). It shows what is **Next up**, a **water
  forecast** with the next three waterings (last watered date plus a care
  interval for each species), a gentle nudge, and a **Start the day over (demo)**
  reset.
- State is saved to `localStorage`. Every access is wrapped in try/catch, so
  private mode still works.

## Accessibility

- **Semantic controls.** Every action is a real `<button>`. Each plant name is a
  button that opens its details. On desktop that button has `aria-controls` and
  `aria-current`; on phones it has `aria-haspopup="dialog"`. Groups are
  `<section>`s with headings (h1 → h2 → h3 → h4), and lists are ordered lists.
  The note field has a real `<label>`. There is a skip link to the queue.
- **Accessible names give context.** Visible labels stay short, and hidden text
  adds the plant: "Watered, Frida" and "Snooze, Frida, until tomorrow". This
  keeps the visible label inside the accessible name.
- **Keyboard focus is managed.**
  - After done or snooze, focus moves to the primary button of the row that now
    sits in the same place, so you can keep pressing Enter through the queue.
  - When the queue empties, focus goes to the "Everyone's looked after" heading.
  - Opening details moves focus to the plant's name.
  - The sheet is a modal `<dialog>`, so it traps focus and Esc closes it. Focus
    then returns to the button that opened it.
  - While the sheet is open, the toast and live region are moved inside it, so
    Undo still works and announcements are still read.
- **Visible focus.** A 3px plum outline with a soft halo on `:focus-visible`,
  plus an ochre variant on the dark toast. Focus styles are never removed.
- **Announcements.** One polite `role="status"` region reads each change plus
  how to undo it ("Frida: watered. Press U or use the Undo button to undo.").
  The rhythm chart has hidden text for each day ("Tuesday, today: 3 care
  moments, 1 done"). All illustrations are `aria-hidden`.
- **Reduced motion.** `prefers-reduced-motion: reduce` turns off the mascot's
  shape change and blink, pot blinks, the overdue plant's droop, row entrances,
  confetti, the sheet slide-up, button movement and the leaf pop. The undo bar
  then shows as a static bar instead of draining. The JS also skips the
  celebration classes.
- **Contrast and themes.** Body text is dark ink on warm paper. Overdue buttons
  use a deep clay (`#93401f`) with cream text. There is a full dark theme via
  `prefers-color-scheme` and a `forced-colors` fallback. Touch targets are at
  least 40–46px tall.
