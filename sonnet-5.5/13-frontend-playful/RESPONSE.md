# Moss: design response

Files: `index.html`, `styles.css`, `app.js` (plus this note). Plain HTML, CSS and JavaScript. No frameworks, installs, remote assets, web fonts or network requests. Open `index.html` directly; it works from `file://`.

`PLANTS.json` is inlined as a `<script type="application/json">` block in `index.html` (verbatim copy). Fetching the file would be a network request and fails from `file://`, so the page reads the inline copy instead. All illustration is inline SVG generated in `app.js`; the paper grain and the favicon are small inline data URIs.

## Personality

Moss is a warm, slightly odd companion, not a productivity tracker.

- **Materials.** Cream paper with a faint grain, dark-brown ink outlines and hard, offset shadows so buttons feel like pressable stickers. Pressing a button physically drops it onto its shadow.
- **Shape language.** Leaves and blobs instead of pill-and-card. Buttons and panels use two large and two small corners (a leaf), every plant sits in its own blob, and the overdue patch has stitching. Nothing is a uniform rounded rectangle.
- **Colour.** Terracotta for urgency, moss green for "done", butter yellow for highlights, teal for water, plum for observations. No neon, no gradients, no glass.
- **Voice and small delights.** The headline reacts to the day ("Frida is *parched* and telling the whole bathroom."). The moss-mound mascot grows a leaf for each thing you tend, leans when something is overdue, blinks now and then, and blooms when you finish. Frida's fronds droop with a sweat drop while she is thirsty and perk up, with sparkles, once watered. When you are done a snail wanders through.
- **Not a wall of cards.** The queue uses four different treatments on purpose: one loud stitched terracotta patch for overdue, one shared paper panel with dashed dividers for today, a dashed outline for "up next", and compact green or plum receipts for tended and snoozed plants.

## Interaction model

- **Queue and priority.** Plants are grouped and sorted from the data: Overdue (hero), Due today, Up next (tomorrow), then Tended and Snoozed. The headline, the progress pips and the sprout all summarise the same state.
- **Care actions.** Each plant has a primary action named for its task (Watered, Rotated, Soil checked, Misted; Drama's is "Misted early" since it is due tomorrow) and a **Snooze** action that moves the task one day. Detail panels for non-watering tasks also offer "Also watered", which logs a watering without completing the task.
- **Undo, two ways.** A toast appears for 8 seconds with an Undo button (it pauses while hovered or focused and can be dismissed). The undo is also persistent: the plant moves into Tended or Snoozed with its own **Undo** or **Bring back** button, and the all-done panel offers "Undo last change". Keyboard focus moves to that in-place Undo, so undoing never requires hunting for a vanishing toast.
- **Plant detail.** Opening a plant shows Light (a four-step sun meter, its label, a tip, rotate and wipe history), Water (last watered and misted, a three-week drip strip, a tip, history) and Observations (noticed things such as new fronds, or brown edges). The history from `PLANTS.json` is sorted into those three, and anything you log today appears at the top as "just now", then disappears again on undo.
- **Weekly rhythm.** Seven columns of pebbles, one per task, from the `week` data. Today is highlighted; done tasks turn green, late ones terracotta, and snoozed tasks show up as dashed pebbles on the day they moved to. The caption names the busiest and quietest upcoming days.
- **All-done state.** When nothing is due today the queue leads with a recap of what you tended, what is snoozed, what is next ("Drama's mist is due tomorrow"), a prompt to note anything new, Undo, and "Start today over". Tomorrow's and snoozed plants stay listed below it.
- **Composition by screen size.**
  - Phone: a single column. Plant detail opens as a bottom sheet.
  - 900px and up: queue on the left, with a sticky detail panel that is always open on the right.
  - 1240px and up: three parts. A left rail (greeting card with the mascot, and the weekly rhythm, which stays in view), the queue in the middle and the detail panel on the right. The queue rows also switch to a side-by-side arrangement when their own column is wide enough, via a container query.
- **Not persisted.** State is in memory only; reloading resets the demo day (pinned to Tuesday, Sep 22 to match the data).

## Accessibility

- **Semantics.** One `h1`, `h2` per queue group, `h3` per plant, real `<button>`s throughout, lists for lists, and landmarks for header, main, aside and footer. Every plant row has a name button plus separately labelled actions ("Mark Frida as watered", "Snooze Frida until tomorrow", "Undo watered for Frida"). The name button stretches over the whole row so the entire row is a large tap target while the tab order stays short: open, primary, snooze.
- **Keyboard.** Everything works with Tab, Enter and Space. Escape closes the sheet and returns focus to the button that opened it. After an action, focus moves to the new in-place Undo (or back to the primary action after an undo), and re-rendering restores the focused control, so focus never drops to the top of the page.
- **Bottom sheet as a real dialog.** On phones the detail gets `role="dialog"`, `aria-modal`, an inert background, a scroll lock, Tab wrapping and a labelled Close button. On desktop the same element is a plain complementary panel with no dialog semantics.
- **Visible focus.** A dark ring with a butter halo on every interactive element, readable on cream, terracotta and green. Focusing a row's name draws the ring around the whole row.
- **Announcements.** The toast region and a separate polite live region announce actions, undos and which plant's details are showing.
- **Colour and contrast.** Body text is at least 5.2:1 on its background, cream on terracotta is 5.2:1, and status is never colour alone. Overdue has a label and words ("2 days overdue"), done has a check and text, and the rhythm chart has per-day screen-reader text ("Thursday: 5 tasks, 1 snoozed here") plus a legend. Decorative SVG is `aria-hidden`.
- **Reduced motion.** All animation and transitions (the settle-in, sheet slide, toast timer bar, mascot growth, blinking, sway and the snail) sit behind `prefers-reduced-motion: no-preference`, and a `reduce` block also forces durations to near zero. State changes still appear instantly.
- **Other.** Touch targets are at least 44px, text scales with the browser font size, the layout has no horizontal scroll down to 320px, and `forced-colors` gets basic borders.

## Verified

Checked in headless Chromium (no network requests, no console errors): 320, 390, 768, 1024, 1440 and 1920px widths; the watered, snooze and undo flows (toast and in-place); the all-done state; keyboard-only operation including the sheet's Tab wrapping and Escape; crossing the sheet/panel breakpoint mid-session; and reduced motion.
