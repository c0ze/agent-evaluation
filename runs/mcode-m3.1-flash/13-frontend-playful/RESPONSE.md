# Moss — a gentle plant-care companion

A single mobile-first screen for four houseplants. `index.html`, `styles.css`,
`app.js` — no frameworks, no packages, no remote assets, no fonts, no network
requests. Open `index.html` from disk and it runs.

---

## 1. Personality

**Moss is a quiet friend who keeps track, not a productivity app that shouts.**

The tone is warm, tactile and slightly odd: a person who loves their plants and
will tell you so. Nothing is gamified — no points, no streaks, no confetti
explosion. The reward for caring is that the list gets shorter and the copy
gets warmer. "Start there" rather than "You have 1 overdue task". "Start the day
over" rather than "Reset". The mascot is a sprout in a terracotta pot that
blinks, and only genuinely celebrates when the queue empties.

The oddness is in the shapes, not the jokes. Each plant sits in a hand-cut
paper blob (`border-radius: 50% 50% 46% 54% / 42% 44% 56% 58%` — an asymmetric
oval that looks torn rather than drawn), the weekly bars are arches like little
sprouts, the focus ring is a thick terracotta outline, and the overdue label
carries a hand-squiggled SVG underline. Cards are tilted a half degree in
alternating directions, as if laid down by hand.

### Shape language

One rule, applied everywhere: **three generous corners and one tight "nib"**
(`--r-nib: 28px 28px 28px 10px`). Cards, detail panels, the all-done panel and
the buttons all use it, so the whole screen feels cut from the same sheet. Soft
inset highlights on the top edge of every surface suggest paper catching light.
A single fixed grain layer (an inline `feTurbulence` data-URI, `multiply`) sits
over the whole page so nothing looks digitally clean.

### Palette

| Role | Colour | |
| --- | --- | --- |
| Paper | `#f2e7d6` | warm oat, with a light gradient falling from the top |
| Card | `#fffaef` | cream sheet |
| Ink | `#1e2a20` | deep green-black, never pure `#000` |
| Moss | `#3f6b32` / `#5a8a44` | care, done, healthy |
| Clay | `#b2562f` / `#8b4222` | overdue, the warm alarm |
| Ochre | `#d69a2a` | today, sun, attention |
| Per-plant accents | pot colours + blob tints | each plant is recognisable at a glance |

Status is carried by **a coloured spine down the left edge of every card** plus
tone-matched text, never by colour alone — each state also has a word and an
icon ("2 days overdue" + clock, "Cared for" + check).

---

## 2. Interaction model

### The queue is a priority list, not a checklist

Plants are sorted by **urgency of the care they need**, not by name or by the
order in the file:

1. **Overdue** — Frida (2 days overdue, `urgency: 4`)
2. **Due today** — Orbit, then Dot (higher urgency first)
3. **Coming up** — Drama (tomorrow)
4. **Snoozed** — dashed, muted, moved to the bottom
5. **Cared for** — settled, desaturated, kept visible for reassurance

Overdue cards are the only ones that carry the hand-drawn squiggle under the due
label, and the masthead status pill goes to its "urgent" tone with a filled clay
dot: "1 plant past due".

### Primary action is verb-appropriate

The requirement was a "watered" action, and the water card has one — but
watering a cactus or rotating a fern would be nonsense, so the button is named
after the task it performs: **Watered** (Frida), **Rotated** (Orbit),
**Checked** (Dot), **Misted** (Drama). Each button's `aria-label` includes the
plant name ("Watered Frida"), because four identical-looking "Watered" buttons
in a list is a screen-reader trap.

- **Watered / Rotated / Checked / Misted** → marks the plant cared for, writes
  a fresh `Today · Watered` entry to the top of that plant's history, moves it
  to the bottom in its "cared for" state, and pops the card.
- **Snooze** → sets the plant to *Snoozed until tomorrow*, restyles the card as
  a dashed/muted diagonal weave, and offers **Bring it back today** to reverse
  it manually (independent of undo).
- **Mark not done** → the reverse of care, for the "sorry, I mis-tapped" case.
- **Start the day over** → resets all four plants, including any added history.

### Undo is the safety net

Every state change snapshots state and raises a toast with an **Undo** button
and a 7-second shrinking ochre timer bar. Undo restores the full snapshot —
including the appended history entry, so undoing a water really does remove the
"Today · Watered" line rather than leaving a lie in the log. Only one toast is
ever on screen, so the undo path is never ambiguous. `Escape` also undoes.

### Details: light, water, observations

The **Details** disclosure opens a panel with three blocks:

- **Light** — the plant's need as words ("Low, indirect") *and* a 4-pip meter.
- **Care & observations** — merged history, newest first, with entries added in
  this session visually distinguished.
- **Moss observed** — a one-line, slightly opinionated note per plant, seeded
  from the real history in `PLANTS.json` ("The bathroom window suits her better
  than she lets on.").

Below 46rem the three blocks stack; above it they become a two-column grid with
the note spanning the full width, so the panel uses width instead of just
getting wider.

### Weekly rhythm

The `week` array renders as seven arch-topped bars scaled to the week's maximum,
with the count printed above each bar and the day's initial below. **Today's bar
is ochre, ringed, and dotted** — the chart tells you where you are in the week
without a label. Bars sway out of phase by a few hundred milliseconds, which
reads as a slow breath rather than a loading spinner.

### The all-done state

When nothing is left, a panel replaces the head of the queue: a slowly turning
six-petal bloom, "All 4 are cared for.", a list of what was actually done
("Orbit · Rotated"), and — if any plant was snoozed — "1 snoozed for tomorrow,
quietly." It is the payoff of the whole screen, so it is the only place with
confetti: five little leaf shapes drifting down, plus a hop and a wide-eyed
sprout in the masthead.

### Small moments of delight

Watering throws five water droplets from the button. The card pops, the avatar
hops. The mascot blinks on a 5.5s cycle and its eyes go wide when the queue
clears. The light meters are arch-topped pips that read as candles. The rail's
"Moss's note" is a live opinion about whatever is left, and it changes as you
work: "Frida is 2 days overdue and doing that quiet, brittle thing. Start
there." → "Nothing left to fuss over. The windowsill is behaving itself."

---

## 3. Accessibility

**Keyboard.** Every interaction is a real `<button>` — watering, snoozing,
details, undo, reset. No div-with-onclick, no tabindex on non-controls. The
details toggle is a button with `aria-expanded` and `aria-controls`; `Escape`
collapses the open panel and otherwise triggers undo. Because the queue
re-renders after each action, focus is **restored by a stable `data-focus-key`**
rather than being dropped to `<body>`: undoing a water puts focus on that
plant's new "Mark not done" button, and its Undo puts focus back on "Watered".
A **skip link** jumps straight to the care queue.

**Semantics.** Landmarks (`header` / `main` / `aside` / `footer`), one `h1`, a
heading hierarchy per section, `<ol>` for the ordered queue and for histories,
`<section>` with `aria-labelledby` inside the detail panel, `<article>` per
plant card. Toasts live in a `role="status" aria-live="polite"` region, so
actions are announced without stealing focus.

**Not colour alone.** Every state carries a word and an icon as well as a hue,
and the left-edge spine is a shape, not just a fill.

**Charts and meters as data.** The rhythm is a real `<ul>`; each bar's value is
in a visually-hidden sentence ("Wednesday: 2 care actions (today)"). The light
meters are `role="img"` with a full label ("Light need: Low, indirect, 1 of 4")
and the decorative pips hidden from the tree.

**Contrast & targets.** Ink on paper is ~13:1; the clay and ochre text colours
used for small type sit above 4.5:1. Every control is at least 44×44px. A
`prefers-contrast: more` block strengthens borders and text and thickens the
focus ring.

**Motion.** `prefers-reduced-motion: reduce` cuts every animation and transition
to ~0ms, stops the sway, sway-again, blink, drift and spin, hides the droplet
particles, and shortens the undo timer bar to a static rule — nothing in the
interface is only communicated through movement. Motion that remains is
decorative: droplet particles, the confetti leaves, the avatar sway, the
celebration hop.

---

## 4. Technical notes

- **Data.** `PLANTS.json` is inlined as a JS object in `app.js` rather than
  `fetch()`ed. A `fetch` of a local file is a network request and is blocked
  from `file://` in most browsers; inlining keeps the constraint literal and the
  screen working offline from disk. The four plants, their histories and the
  `week` array are copied verbatim, with three additions clearly marked as
  editorial: a `lightLevel` (1–4) to drive the meters, a per-plant `note`, and
  a `PASTED` verb map.
- **State.** One plain object, a `render()` that rebuilds the queue from it, and
  a JSON snapshot for undo. No framework, no virtual DOM, ~470 lines of ES2018.
- **Illustration.** All 13 illustrations are inline SVG `<symbol>`s in a single
  sprite at the top of the document, referenced by `<use>`; the plant sprites
  take their colours from CSS custom properties on the referencing element, so
  one stylesheet restyles them. The favicon, the paper grain and the squiggle
  are data-URIs. Nothing is fetched.
- **Fonts.** System stacks only: a Palatino/Iowan/Georgia serif for display type
  (warm, bookish, not generic) against the system UI sans for everything else.
- **Verified.** `node --check` passes, and a throwaway DOM harness executed
  `app.js` to assert queue ordering, the overdue-first rule, every action and its
  inverse, undo of state *and* history, the `Escape` path, the all-done panel
  appearing and disappearing, and the today marker in the rhythm chart. The only
  `http` string in the project is the SVG XML namespace.

### Files

| File | |
| --- | --- |
| `index.html` | structure, SVG sprite, landmarks |
| `styles.css` | tokens, components, mobile-first, desktop composition, reduced motion |
| `app.js` | state, render, actions, undo, charts |
| `PLANTS.json` | source data (unmodified) |
