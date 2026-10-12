# Moss — response notes

Files: `index.html`, `styles.css`, `app.js` (plus the untouched `PLANTS.json`).
No frameworks, no installs, no remote fonts/assets, no network requests. Open
`index.html` directly, or serve the folder if you want `app.js` to read
`PLANTS.json` over HTTP (see *Data* below).

---

## Personality

**The voice.** Moss is a companion, not a task manager. It never says "3 tasks
overdue, you're failing" — it says *"Nothing is late. Take them in any order you
like."* Care guesses are credited to the app itself ("Bone dry — Moss's guess")
so uncertainty is admitted rather than disguised as precision. The quips stay in
copy and micro-moments, never in the layout: the structure is always obvious,
the jokes are optional.

**The shape language.** Warm paper (`#faf4e8`) with a faint two-layer dot grain,
print-style offset shadows instead of blurs, dashed and dotted hairlines rather
than dividers, and lopsided "blob" border-radii (`28px 34px 26px 30px / …`) so
no two panels are quite the same rectangle. The palette is terracotta, moss
green, ochre, and a deep green-black ink. No glass, no neon gradients, no
clip-art characters.

**The illustrations are generated, not drawn.** Each of the four plants is
procedural SVG: `frond()` walks a quadratic curve and stamps alternating leaflets
along the tangent (Boston fern); the pothos trails a vine of alternating leaves;
the cactus is stacked pads with radially placed spines; the calathea is oversized
round leaves with stripe chevrons. Because they are computed, leaves sit on the
stem instead of near it, and every portrait shares one family of curves. The
brand mark breathes, tiny sprouts pop when a plant is tended, and the all-done
scene has a sun and sparks.

**Avoiding the card wall.** The queue is not four identical cards. It is grouped
by real urgency, and the groups look different:

- *Needs you now* — the overdue plant, full width, taller, clay border, dashed
  clay spine down the left edge, an 84px portrait, larger type, and a "pick me"
  corner flag. It is impossible to miss or to confuse with the rest.
- *Today* — compact cards with a task chip and a due pill.
- *Up next* — same components, quieter, filed out of the way.
- *Tended today* — faded to 62%, actions replaced by a single "Undo".

---

## Interaction model

**One screen, one queue, one panel.** On a phone the queue is the screen and the
plant detail is a bottom sheet that slides over it. There is no route, no
back stack, no modal-within-modal: you open a plant, act on it, and either close
it or keep going.

**Actions.** Each card's primary button is derived from its task, so you read the
verb you are about to perform — *Watered*, *Rotated*, *Checked*, *Misted* —
rather than a generic "Done". `Snooze` pushes the plant one day out
(`2 days overdue → 1 day overdue → Today → Tomorrow → In 2 days`) and re-sorts
the queue immediately.

**Undo, briefly.** Every action produces a toast with an `Undo` button that lives
for seven seconds, and the toast is not the only path: a completed card keeps a
persistent `Undo · Watered` button, and the all-done state keeps `Undo last`.
State changes are pure object mutations followed by a single `render()`, so undo
is just re-setting the previous `offset` / `done` flag.

**All-done is useful, not a dead end.** When nothing is left, the queue is
replaced by a sunny pot-and-sprout scene, a tally, and two ways to keep going:
`Undo last` and `Peek at tomorrow` (which moves the weekly-rhythm highlight to
tomorrow and rewrites its caption). No confetti-for-nothing celebration, no
"You're all caught up!" emptiness.

**Weekly rhythm.** Seven rounded bars, heights from `PLANTS.json`'s `week` array,
today highlighted in clay, with a dotted "3 of 4 tended today" tally beneath. It
is a column of its own on desktop rather than squeezed under the queue.

**Desktop composition.** Three genuinely different regions, not a stretched
column: at ≥1000px the grid is `queue | detail | rhythm` — the sheet stops being
a sheet and becomes a sticky inline panel with its own portrait, facts, actions,
and history (and a "Pick someone" sill illustration with keyboard hints when
nothing is selected); the rhythm is a third sticky column. At 720–999px the
queue and rhythm sit side by side and the detail stays a sheet. At ≥1240px the
queue itself splits into two columns. Cards reflow by group; the overdue card
always keeps a full row.

**Micro-delights** (all removable, all motion-safe): cards tilt −0.35° on hover,
buttons press down 2px into their own shadow, the sprout springs when a plant is
marked tended, the brand leaf breathes on a 7s cycle, and a dashed clay spine
runs down the overdue card.

---

## Accessibility

- **Semantics.** The queue is `ul`/`li`; every "open" control is a real
  `<button>` with `aria-expanded` and `aria-controls="detail"`, so Enter/Space
  work with no JS key handler. Actions are `<button>`s (never divs). Headings run
  `h1 → h2 → h3` in order. The rhythm is exposed as a `role="img"` with a full
  label ("Weekly care rhythm: Monday 1, Tuesday 3, … Monday is highlighted"), so
  the bars are not just decoration to a screen reader.
- **Focus.** Visible 3px clay ring with offset on everything focusable; on cards
  the ring is inset (`outline-offset: -4px`) because the card clips its corners.
  Skip link to the queue. Opening the sheet moves focus to its close button (and
  to the panel itself on desktop); closing restores focus to the exact card that
  opened it. Tab is trapped inside the sheet while it is a mobile overlay.
- **Keyboard.** `↑`/`↓` (or `j`/`k`) walk the queue, `Enter`/`Space` open,
  `Esc` closes. Hints are printed in the desktop placeholder. Hit targets are
  ≥44px.
- **Live regions.** A polite `role="status"` region announces results in full
  sentences — "Frida marked watered. Undo is available for a few seconds." —
  so actions and their undo window are perceivable without seeing the toast.
- **Contrast.** Body text is `#5b6b5e` on `#fffdf7` (≈5.2:1); the faintest tone,
  `#62705f`, is used only for small uppercase labels and still clears 4.5:1.
  White on moss green is ≈4.5:1 and the overdue flag uses a darker clay
  (`#a9522f`, ≈5.3:1). Colour is never the only signal: overdue state is also
  carried by the group heading, the border, the spine, and the "pick me" flag.
- **Reduced motion.** `prefers-reduced-motion: reduce` collapses every animation
  and transition (including the breathing mark and hover tilt); nothing depends
  on motion to be understood.
- **Print & zoom.** Print styles flatten the sheet into the flow; layout is
  fluid up to 1240px and uses `rem`-based type throughout.

---

## Data

`PLANTS.json` is the source of truth. `app.js` fetches it when the page is
served over `http(s)`; when opened from `file://` (where `fetch` is blocked) it
falls back to a verbatim embedded copy, so the screen is identical either way.
Due strings are parsed into signed day offsets (`2 days overdue → -2`) and
rendered back as phrases, which is what makes snooze and sorting work.
