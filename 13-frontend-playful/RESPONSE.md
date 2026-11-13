# Moss — today's care screen

Open `index.html` directly in a browser. There is no build step, no dependency, and no request beyond the three local files (`index.html`, `styles.css`, `app.js`).

## What is here

| Requirement | Where it lives |
|---|---|
| Care queue, overdue first | "Today's care": an **Overdue / Start here** group, then **Due today**, then **Tomorrow, if you're feeling keen** |
| Plant detail | Expandable panel inside each card on phones and tablets; a persistent "specimen sheet" in the middle column on desktop |
| Watered + snooze with undo | Buttons on every card and on the desktop sheet; an 8-second toast with **Undo**; `Ctrl/Cmd+Z`; a permanent **Put back** in the Handled tray |
| Weekly rhythm | Seven columns of pebbles, one pebble per job, that update as you work |
| All-done state | Replaces the queue with what you did, what comes back tomorrow, and how big tomorrow is |
| Desktop composition | Three columns at 1160px and up: queue, plant sheet, rhythm + handled rail |
| Keyboard, focus, semantics, reduced motion | See "Accessibility" below |

## Personality

Moss is warm paper and soft pebbles. The palette is cream, moss green, terracotta, mustard and one cool lilac reserved for water. Nothing is quite a rectangle: cards, buttons, badges and chart marks all use slightly lopsided corner radii, and buttons sit on a hard ink shadow and physically press down.

The oddness is in the plants, not in decoration. Each plant is a small hand-drawn inline SVG with its own pot, and each has one dry line of character ("Crisping at the tips and telling everyone about it."). The overdue fern slumps and yellows until it is watered. The headline talks like a housemate ("Frida first, then two more." / "That's everyone. Go be a person.").

To avoid a wall of identical cards, urgency changes the object, not just its colour: the overdue plant is a large terracotta card with a heavy outline and shadow, today's jobs are plain paper rows, and tomorrow's is a dashed, see-through card with no snooze button (you cannot snooze something that is not due).

Small moments of delight: a droplet lands and the plant perks up when a job is done, the matching pebble pops into the rhythm chart, cards glide between the queue and the Handled tray (View Transitions, where supported), and plants sway on hover.

## Interaction model

- **Done.** The primary button is named for the job: **Watered** for Frida, and Rotated, Soil checked, Misted for the others. Pressing it logs the entry in that plant's history, moves the plant to "Done today", and fills a pebble.
- **Snooze.** Moves the plant to "Snoozed until tomorrow" and moves its pebble to tomorrow's column as a dashed mark. Snoozing the overdue plant says plainly that it will now be 3 days overdue.
- **Undo.** Every done or snooze shows a toast with Undo for 8 seconds (the timer pauses while the toast is hovered or focused). `Ctrl/Cmd+Z` does the same. After the toast is gone, **Put back** in the Handled tray reverses it at any time, so undo never depends on speed.
- **Details.** Light (with a three-step meter and the plant's location), water (last watered date), and a history list where each entry is tagged Water, Care or Noticed. You can add an observation and remove your own. Plants whose job is not watering get a **Watered today** toggle so an unplanned watering can still be logged.
- **All done.** Shown when nothing overdue or due today is left. The wording changes depending on whether jobs were finished or only snoozed. Snoozed plants get a **Do it now** button there.
- **Start the day over** resets the demo.

## Accessibility

- **Semantics.** Real `<button>`s throughout, one `<h1>`, ordered heading levels, `main` / `aside` / labelled regions, lists for the queue and the chart, a labelled form for observations.
- **Names.** Visible labels stay short ("Watered", "Snooze") and each carries hidden text naming the plant ("Watered: Frida"), so a screen-reader user tabbing through never hears four identical buttons.
- **State.** The details toggle uses `aria-expanded` and `aria-controls`; the watering toggle uses `aria-pressed`.
- **Focus management.** After done or snooze, focus moves to the next plant's primary button, or to the all-done panel when the queue is empty. After undo or put back, focus returns to the restored plant. Focus is never dropped on `<body>`.
- **Announcements.** One polite live region reports each result and that undo is available. The toast itself is not a live region, so nothing is read twice.
- **Keyboard.** Everything works with Tab, Enter and Space. `Esc` closes an open detail panel on small screens, or dismisses the toast. A skip link jumps to the queue.
- **Visible focus.** A 3px ink ring with a 3px offset on every control (cream on the dark toast).
- **Not colour alone.** Overdue is stated in words, with an icon, a group heading and first position. Chart states differ by fill and outline (solid, hollow, dashed) and have a key. Each chart column has a hidden text equivalent ("Tuesday, today: 1 of 3 done").
- **Contrast.** All text pairs measure at least 5.1:1; icons and chart marks at least 3:1.
- **Reduced motion.** With `prefers-reduced-motion: reduce`, all animations, transitions and view transitions are off and the toast's countdown bar is removed. Nothing depends on motion to be understood.
- **Sizing.** Touch targets are 44px or taller (40px for two small secondary controls). The layout holds from 320px wide with no horizontal scroll, and uses `rem` units so it scales with the user's text size. Forced-colours mode keeps chart fills and focus visible.

## Decisions worth knowing about

- **Data is embedded, not fetched.** `app.js` holds a copy of `PLANTS.json` because the brief rules out network requests and `fetch` does not work from `file://`. I checked the copy against the file field by field. If `PLANTS.json` changes, the copy in `app.js` must be updated to match.
- **"Today" is assumed to be Tuesday.** The data does not say which day of `week` is today. I read the array as Monday to Sunday and put today on the second day, because its count (3) matches the three jobs due or overdue today. It is one constant (`TODAY`) in `app.js`.
- **"Watered" appears only where watering is the job.** The other plants get their own verb. I judged that a Watered button on a plant that needs rotating would be wrong; say so if you want the literal label on all four.
- **The plant one-liners are mine**, keyed by plant id. A plant without one still renders, with a generic illustration.

## How it was checked

I drove the page in headless Firefox 160 with real key presses at desktop and phone widths, and took screenshots at 320, 390, 760, 1100, 1200 and 1360px.

- Tab order follows the visual order; Enter and Space activate; `Ctrl+Z` undoes; the toast expires on its own.
- Done, snooze, undo, put back, add and remove observation, the watering toggle, snooze-everything, do-everything and reset all produced the expected state and focus target.
- No script errors or unhandled rejections, including two actions fired back to back.
- No horizontal overflow at 320px.
- With reduced motion on, zero animations were running.

Not checked: Chrome and Safari (not available here), a real screen reader, and a real touch device. There is no dark theme, and state is not saved between visits.
