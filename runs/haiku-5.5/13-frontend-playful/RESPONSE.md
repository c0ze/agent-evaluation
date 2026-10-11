# Moss: response notes

Moss is a single screen for today's plant care. It is plain HTML, CSS, and JavaScript with no framework, no packages, no remote assets, and no network calls. It opens from `index.html` directly.

## Personality

- **Voice.** Moss speaks like a dry, affectionate houseplant ombudsman. Each plant has one short line per state ("Dot does not do hugs.", "Orbit would like a small rotation. Nothing dramatic."). The copy never scolds about a missed watering; an overdue plant is described as sulking politely.
- **Shape language.** Pebble-shaped cards with asymmetric corners alternate down the list. Plant avatars are blobs, buttons are pills, and the brand mark is a leaf with a sun dot. Nothing is a perfect rectangle, which keeps the list from reading as a wall of identical cards.
- **Tactile cues.** Items that need attention have a hard ink shadow, like a sticker pressed onto paper. Items that can wait are flat with a dashed outline. Done items take on a soft moss fill.
- **Palette.** Cream paper with a faint dot grain, moss green, terracotta, ochre, and a dusty plum for Drama. There are no gradients, no glass panels, and no neon. Illustrations are inline SVG: the four plants, the brand mark, and the all-done sun. The windowsill is CSS with those plants set on it. There are no clip-art faces.
- **Small moments of delight.**
  - Watering drops a droplet onto the plant, and the avatar gives a small perk.
  - Snoozing sends a "z z" floating up from the card.
  - The windowsill mirrors the queue. Overdue plants droop, and tended plants stand up.
  - The all-done sun is asleep, with closed eyes, and gently bobs.

## Interaction model

- **Queue order.** Overdue comes first, most overdue at the top, then Due today, then Done today, then Coming up. The first item needing attention carries a "Start here" sticker. When anything is overdue, the summary line names the most overdue plant ("1 plant overdue. Start with Frida.").
- **Watered (and its siblings).** The primary button reads Watered for Frida, Rotated for Orbit, Soil checked for Dot, and Misted for Drama. It writes a history entry dated Today, sets the next due date from the task interval, moves the plant to Done today, advances the progress count, and adds one to today's bar in the rhythm chart.
- **Snooze a day.** Pushes the due date one day later. An overdue plant stays overdue, and the toast says so ("Frida snoozed a day. Still overdue, though."). Snooze is offered only for overdue and due-today items.
- **Undo.** Every action shows a toast with an Undo button for six seconds. The toast stays up while it is hovered or focused. Only the most recent action can be undone, and a new action replaces the toast.
- **Details.** Opens in place on each card with three sections: Light, Water and mist, and Observations. Each section lists entries from the plant's history, and new actions are filed into the matching section.
- **All done.** When nothing is overdue or due today, the queue shows a sleepy-sun card with a rotating line, the summary line changes, and the toast for the final action adds "That is everything for today."
- **Seven-day rhythm.** Each bar is one day, with its tended count shown above it and the weekday below. Today's bar is terracotta. A note names the busiest day.
- **Layout.** On phones the order is brand, then queue, then windowsill and rhythm, so the work comes first. From 900px wide, the brand, windowsill, and rhythm form a sticky rail on the left and the queue fills the right. From 640px, the details sections sit in three columns.

## Accessibility

- **Semantics.** The brand is the `h1`, sections are `h2`, and queue groups are `h3`. Lists are real `ol` elements. All controls are native `button`s. The tended count uses a `progress` element with a label. Details toggles set `aria-expanded` and `aria-controls`. Today's bar has `aria-current="date"`.
- **Screen-reader text.** Each rhythm bar carries visually hidden text such as "Thu: 4 care moments, today" for the day it describes. Buttons include the plant's name in hidden text, so "Watered" becomes "Watered Frida". The windowsill and all illustrations are `aria-hidden`.
- **Announcements.** One `role="status"` region announces each action and undo. The toast and the region carry the same message.
- **Focus.** After an action, focus moves to the same control if it still exists. If the plant has moved out of that control's group, focus goes to Undo. After Undo, focus returns to the control that was used. A skip link jumps past the brand to the queue heading.
- **Visible focus.** A 3px ink outline with an offset on light surfaces, and an ochre outline on the dark toast.
- **Targets.** Every button is at least 44px tall.
- **Colour.** State is never shown by colour alone. Each card has a text chip ("2 days overdue", "Due today", "Tomorrow", "Tended · next in 5 days"). Overdue cards also get a heavier border, and their plants droop on the windowsill.
- **Motion.** `prefers-reduced-motion` turns off all animation and transition, and hides the droplet and the z's. State changes still happen, just instantly.
- **Contrast.** I chose text colours against their backgrounds to meet 4.5:1 for normal text. I checked the main pairs by hand; I did not run an automated contrast audit.

## Technical notes

- **Data.** `PLANTS.json` is mirrored into `app.js`, because `fetch()` is blocked on `file://` pages. `PLANTS.json` is not loaded at runtime. If the data changes, update both.
- **No persistence.** Reloading resets to the seed data. Undo works within a session only.
- **Dates.** Weekday labels come from the device clock. History dates keep the seed's September values and are not rewritten. The "Today" entries are new.
- **Intervals.** Watering recurs every 5 days, rotating every 7, soil checks every 3, misting every 2. These are in the `TASKS` table in `app.js`.
- **Theme.** Light only. There is no dark theme.

## What I checked

- `node --check app.js` passes.
- Headless Firefox rendered the page at 320, 390, and 1280px wide. I checked the mobile, desktop, and all-done states by eye.
- A test harness loaded the real `app.js` and ran the actions in sequence: snooze, undo, watering, opening details, and finishing every task. After each step it checked the groups, the toast text, the rhythm note, and the focus target. All matched the intended behaviour.
- Not checked: a real keyboard-only session, a screen reader pass, and other browsers.
