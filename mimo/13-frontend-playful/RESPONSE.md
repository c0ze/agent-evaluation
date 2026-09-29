# Moss — design notes

## Personality

Moss is a household plant companion that feels like a clay pot on a sunny sill: warm paper tones, soft pebble silhouettes, and a slightly odd house voice. The tone is optimistic and non-judgmental — overdue care gets a terracotta nudge, never a red alarm. Each plant has a distinct SVG portrait and pebble tint so the queue reads as four residents, not four identical cards. Small delights (portrait wiggle on hover, droplet-shaped water pips, a sleepy all-done scene) reward attention without turning the UI into clip art.

## Interaction model

- **Care queue** — one card per plant from `PLANTS.json`, sorted overdue → today → tomorrow by `urgency`. Urgency drives the badge (`Overdue` / `Today` / `Tomorrow`) and card accent.
- **Detail panel** — the whole header is a disclosure button (`aria-expanded` / `aria-controls`). Expanded state shows light preference, a compact water-rhythm meter, and observation history (with new action notes prepended live).
- **Watered** — marks the plant tended, logs `Today · <task verb>`, moves it out of the active queue.
- **Snooze** — defers to tomorrow, logs a snooze note, same exit from today’s queue.
- **Undo (two paths)** — a live-region toast with an **Undo** button (≈6.5s) for the last action, plus a per-card **Undo** while the plant is in a finished state. Escape dismisses the toast.
- **Weekly rhythm** — seven organic bars from `week[]`, colored gentle → busy, with a day legend and a full text alternative on the chart.
- **All-done state** — when the queue empties, the list is replaced by a calm summary that distinguishes “everything tended”, “all snoozed”, and mixed outcomes. **Start a fresh day** restores the queue so the screen stays explorable.

## Desktop composition

At ≥760px the layout becomes a two-column composition: a 2-up card grid for the queue and a sticky side rail with weekly rhythm and queue pulse (overdue / queued / tended / snoozed). The header gains a third column for the tended counter. This reflows the content rather than stretching the mobile column.

## Accessibility

- Semantic structure: `header` / `main` / `aside`, list of `article` cards, real `button` elements only (no click handlers on divs).
- Keyboard: Tab reaches every control; Enter/Space activates; `Escape` closes a detail panel or the undo toast. Focus returns to the disclosure button after re-render.
- Visible focus via `:focus-visible` outlines (high-contrast blue on warm paper).
- Status changes announced with `role="status"` + `aria-live="polite"` on the undo toast; badges and water meters carry text labels.
- Color is never the only signal — urgency pairs tint with an explicit badge word.
- `prefers-reduced-motion: reduce` disables wiggle, toast slide, and layout transitions.
- Skip link to the care queue; readable type scale and minimum 0.88rem supporting text.

## Constraints honored

Local HTML/CSS/JS only — no frameworks, fonts, remote assets, or network calls. Plant data is inlined in `app.js` (mirroring the supplied `PLANTS.json`, which is left untouched). All illustration is inline SVG plus CSS shapes.
