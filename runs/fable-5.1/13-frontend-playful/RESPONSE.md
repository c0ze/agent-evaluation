# Moss — design notes

Moss is a single screen: today's care queue for four housemates (Frida, Orbit,
Dot and Drama), a detail panel per plant, a weekly rhythm, and an all-done
state. It is plain `index.html`, `styles.css` and `app.js` with no fonts,
frameworks or network requests, so it opens straight from disk. The data in
`PLANTS.json` is embedded verbatim at the top of `app.js` because `fetch()` of
a local file is blocked on `file://` in most browsers.

## Personality

The brief asked for warm, tactile, optimistic and a little odd, and for the
opposite of a wall of cards. The visual language borrows from risograph
prints and sticker sheets rather than from app chrome:

- **Paper and ink.** A cream page with a faint dot grain, near-black ink
  outlines on everything interactive, and hard offset "print" shadows instead
  of soft drop shadows. Buttons physically press down 3px on `:active`.
- **Blobs, not boxes.** Avatars use asymmetric `border-radius` blobs (four
  variants, one per plant), cards have subtly uneven corners, and the stickers
  in the header sit at slightly different angles. Nothing is a perfect
  rectangle, but text stays on straight baselines so it remains readable.
- **Hand-drawn plants.** Each plant has an inline SVG portrait built from
  simple shapes: fern fronds are thick dashed strokes (the dashes read as
  leaflets), the pothos trails heart leaves off a shelf, the cactus has bunny
  ears, a flower and paper-coloured spines, and the calathea has striped round
  leaves with one brown edge, because "Brown edge noted" is in her history.
- **Moss the mascot.** A moss-green blob with a sprout, cheeks and a mouth. It
  blinks every few seconds, hops when you finish a task, and falls asleep with
  a floating *z* when the queue is clear.
- **Copy with a voice.** The greeting is a serif headline in the second
  person ("Tuesday. Frida has been waiting."), each plant gets a one-line quirk
  ("Wants nothing. Will accept a compliment."), and the toast replies with a
  small flourish ("Now facing a fresh wall."). Snoozing an overdue plant gets
  a gentle nudge about how overdue it will be tomorrow.
- **Three tiers, three treatments.** Overdue care is the only "card": a
  terracotta hero with a rotated sticker, a bigger portrait and the largest
  type. Today's tasks are a dotted-rule list. Tomorrow's task and snoozed
  plants are quieter rows with smaller portraits and dashed buttons. Done
  plants shrink to a check tag. The eye lands on the overdue item first
  without any of the rows looking identical.

## Interaction model

**Queue.** Plants are sorted into Needs you now (overdue), Today, Coming up
(tomorrow plus anything snoozed) and Done today, each ordered by urgency.
Every actionable row has two obvious buttons: a green primary whose label is
the past tense of the task ("Watered", "Rotated", "Checked", "Misted") and a
secondary "Snooze". Tomorrow's task offers "Do it early"; a snoozed plant
offers "Bring back". The header stickers ("1 overdue · 2 today · 1 tomorrow")
and the greeting recompute after every change.

**Detail panel.** There is one panel. On narrow screens it is a disclosure:
the plant's name/portrait is a button with `aria-expanded` and
`aria-controls`, and the panel is inserted inline beneath that row with a
close button. From 960px the same panel lives in a sticky sidebar next to the
queue, always showing a plant (the top of the queue by default) and the
selected row gets a yellow spine. The panel holds three facts (Light with a
three-dot meter, Water with the last drink and cadence, Up next), a Water &
care log, an Observations log, and "Log a drink" / Snooze actions. The panel
is parked back in the sidebar before the lists re-render so it never gets
destroyed with a row, and a `matchMedia` listener re-homes it if the viewport
crosses the breakpoint.

**Actions and undo.** Every action (done, snooze, bring back, log a drink,
log a leaf wipe) takes a JSON snapshot of the state first, mutates, re-renders
and shows a toast with an Undo button and a draining time bar. The toast lasts
six seconds, pauses while hovered or focused, and can be dismissed with
Escape or its close button. Undo restores the snapshot and returns focus to
the restored row. Ctrl/Cmd+Z triggers undo while the toast is showing, so
keyboard users don't have to tab down to the toast. Completing or snoozing a
row plays a short leave animation (a water ripple around the portrait for
"watered") and then the DOM updates; with reduced motion it updates at once.

**Weekly rhythm.** An inline SVG of the last seven days, today at the right
edge in a highlighted pill. Each day stacks little leaf-pebbles for its care
moments from `week`. The day two days ago shows Frida's missed watering as a
dashed terracotta outline, and today's column is live: two "to do" slots for
Orbit and Dot, one terracotta catch-up slot for Frida, filling green as tasks
are completed and turning dotted if snoozed. The caption states the totals in
words, and a `<title>`/`<desc>` pair gives the same per-day breakdown to
screen readers.

**All done.** When nothing overdue or due today remains, a moss-green panel
takes the top of the queue: the four plants on a shelf (snoozed ones faded),
"All tended for today", what comes tomorrow, who was snoozed and who was
tended, plus one useful idle suggestion (Orbit's leaves were last wiped on
Sep 10, with a "Log a leaf wipe" action that is itself undoable). Focus moves
to the panel's heading so keyboard and screen-reader users land on the new
state.

**Desktop composition.** Above 960px the page becomes a two-column grid:
header spanning both columns with the mascot and greeting on the left and a
sticker cluster on the right, the queue on the left, and the sticky detail
panel plus rhythm on the right. Rows switch to a horizontal layout (portrait
and tags left, actions right), so the extra width carries more information
rather than stretching the phone column.

## Accessibility choices

- **Semantics.** Landmarks (`header`, `main` labelled "Care queue", `aside`
  labelled "Plant details and weekly rhythm"), headed sections with
  `aria-labelledby`, real `<ul>`/`<li>` lists, `<dl>` for facts and the
  next-up summary, `<ol>` for history, and only `<button>` elements for
  actions. A skip link jumps to the queue.
- **Names that carry context.** Visible button text is short ("Watered",
  "Snooze"), but each has an `aria-label` including the plant ("Watered:
  Frida", "Snooze Orbit until tomorrow") so lists of identical buttons are
  distinguishable to screen readers. Icons are `aria-hidden` and SVG
  portraits are decorative.
- **Disclosure pattern.** The row toggle uses `aria-expanded` and
  `aria-controls="detail"`; the panel is `tabindex="-1"` so it can receive
  focus programmatically. On narrow screens Escape inside the panel closes
  it and returns focus to the toggle. On desktop, activating the already
  selected row moves focus into the panel.
- **Focus management.** Re-rendering would otherwise drop focus, so every
  action decides where focus lands: the next actionable row after a row
  leaves, the restored row after undo, the same panel button after a panel
  action, or the all-done heading when the queue empties. Dismissing the
  toast while focus is inside it sends focus to the queue rather than
  `<body>`.
- **Visible focus.** A 3px blue `:focus-visible` ring with a 3px offset on
  every control (yellow inside the dark toast), tested against every
  background in the palette.
- **Announcements.** A visually hidden `role="status"` live region announces
  each action, that undo is available, and that an undo happened. The toast
  itself is purely visual so the message is never announced twice.
- **Reduced motion.** All animation lives inside
  `@media (prefers-reduced-motion: no-preference)`: blink, hop, entrance
  transitions, the row leave animation, the toast slide and the draining bar.
  `app.js` also reads the media query and skips the leave-animation delay so
  actions apply immediately; the toast timer still runs and the Undo button
  remains.
- **Contrast and size.** Measured with the WCAG formula: body text is ink
  on cream at 13:1; secondary text `#5b554a` is 6.5:1 on the page and 5.5:1
  or better on every tinted surface it sits on; the sticker and tag pairs
  (paper on deep terracotta 5.3:1, dark green on moss-soft 8.7:1, dark amber
  on sun-soft 6.5:1, paper on the primary button 7.5:1) all clear AA, and the
  focus ring is at least 6:1 against every background. Every control is at
  least 44px tall; the smallest type (about 12px) is reserved for uppercase
  section and fact labels, never body copy; and the layout holds at 320px
  with no horizontal scrolling.
- **Keyboard.** Tab order follows the visual order: row toggle, then its
  actions, then the next row; Enter/Space work on every control; Ctrl/Cmd+Z
  undoes; Escape dismisses the toast or closes the inline panel.

## Verification

The screen was rendered in headless Chromium at 320, 390, 760, 1280 and
1440px, and a scripted walkthrough covered opening details, watered, snooze,
undo via button and via Ctrl+Z, toast expiry, bring back, the all-done state,
the idle suggestion, panel actions on desktop, tab order, and the reduced
motion path, with no console errors.
