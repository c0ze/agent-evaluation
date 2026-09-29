# Moss — response notes

## Personality
Moss is a warm, slightly odd greenhouse friend: deep moss green + marigold + terracotta on a pale moss-dot paper, chunky ink outlines, and asymmetric blob radii (each pot badge and card gets its own squircle so nothing looks stamped out). Tilted "sticker" due badges (overdue in terracotta, today in marigold, tomorrow as a dashed outline) carry the gentle urgency instead of red alerts. Micro-delight: the masthead moss blob, per-plant SVG leaf marks, a smiling sun in the all-done state, and a "Moss's whisper" tip card that follows the most urgent open plant.

## Interaction model
- **Queue sorted by urgency** (overdue Frida first, tomorrow Drama last). Overdue card gets a tinted ground; nothing relies on color alone — the sticker text says "2 days overdue".
- **Detail as progressive disclosure**: each card has a "Care notes" toggle (`aria-expanded` + `aria-controls`) revealing light / water / home plus observation history. Independent per card, keyboard-operable, no routing needed.
- **Watered / Snooze mutate real state**: watered plants leave the queue and fill the "tended" progress bar; snoozed plants drop into a "Resting till tomorrow" section with a "Bring back" path. Every action fires a toast with a 6-second **Undo** that restores state and returns focus to the restored card. `Esc` dismisses the toast.
- **All-done state** replaces the queue with a sunny resting illustration and a demo reset.
- **Weekly rhythm**: 7 bars from `week` data, peak day in terracotta, today ringed in marigold, with a text equivalent in `aria-label` plus per-bar `title`s.
- **Desktop**: at ≥920px the page becomes a two-column composition — queue left, rhythm + whisper stacked sticky right — rather than a stretched mobile column.

## Accessibility choices
- Semantic landmarks (`header`/`main`/`aside`), real `<button>`s, `<ol>` queue, labelled sections; skip link to the queue.
- `role="status"` live regions for the summary line and toast so actions are announced.
- Visible `:focus-visible` rings (terracotta on light, marigold on dark panels).
- `prefers-reduced-motion: reduce` strips all transitions/transforms.
- Data is embedded in `app.js` (mirroring `PLANTS.json`) so the page works from `file://` with zero network requests, no frameworks, no external fonts — system type stack only.
