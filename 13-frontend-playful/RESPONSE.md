# Moss — design notes

Moss is a single-screen, mobile-first plant-care companion for a household of
four. The brief asked for something **warm, tactile, optimistic, and a little
odd** — a personality that sits between a utility and a small piece of
companionship. These notes describe the choices behind the build.

---

## 1 · Personality & visual language

The mood is **paperback picture-book for grown-ups**: warm cream paper, a
muted palette of moss, clay, sun, and dusty blue, and serif headlines that
soften the edges of the interface. Nothing screams, nothing glints.

- **Palette.** Backgrounds are paper-cream (`#F1E6CF` / `#FBF3DF`). Ink is a
  warm near-black (`#2A2418`). Status colors are **muddy** rather than neon:
  overdue is terracotta, today is burnt-sun, tomorrow is sage. No gradients
  on text, no glass, no neon.
- **Texture.** The body has a faint SVG-noise overlay plus three soft
  radial gradients (clay, sun, moss) so the canvas feels like a sunlit
  windowsill rather than a flat slab.
- **Type.** System serif for headlines and plant names (Iowan Old Style →
  Georgia → Palatino). System sans for body and labels. A monospace stack
  is reserved for history dates, so they read like a logbook.
- **Shape language.** Cards use a generous radius; one corner has a pebble
  notch (the small disk on each card) that hints at a torn corner of paper
  or a tag. Buttons are pill-shaped, sized like seeds. The greeting line
  trails three colored dots that read as "today's palette."
- **Avoided tropes.** No emoji, no stock icons, no glassmorphism, no neon
  gradient cards, no identical 12-card grid. Plants are illustrated inline
  in SVG so each one has its own silhouette, posture, and personality
  rather than a shared pictogram.

### The four personalities

Each plant is drawn as inline SVG with its own silhouette and small
peculiarities — they are not interchangeable:

| Plant | Silhouette | Personality beat |
|------|-----------|------------------|
| **Frida** (Boston fern) | Many slim fronds arching outward from a clay pot | A graceful arc; many small leaflets in two greens |
| **Orbit** (Pothos) | Macramé hanger, white pot, three trailing vines with heart-shaped leaves | Cheerful, trailing, slight variegation |
| **Dot** (Bunny-ear cactus) | Three round pads with white "bunny" dots, two-dot eyes and a small mouth | A tiny almost-face, deliberately subtle, not clip art |
| **Drama** (Calathea orbifolia) | Three large striped round leaves on dark stems from a near-black pot | Reads as composed but unmistakably ornate |

---

## 2 · Interaction model

### Care queue (mobile + desktop)

Plants are listed sorted by **urgency descending** — the most overdue plant
sits on top. Each row carries:

- The plant avatar (circular crop)
- Name + species (italic)
- A small location + task chip
- A status pill: terracotta for overdue, sun for today, sage for tomorrow

On **mobile** (`< 860px`), every row carries its own **Water** and
**Snooze** buttons so a person can tend the queue without ever opening a
detail panel. Tapping the row body selects the plant, which expands its
detail panel inline below the queue.

On **desktop** (`≥ 860px`), the row's in-card action buttons are hidden.
Selection lives entirely in the right-hand **detail panel**, which becomes
the canonical action surface. This avoids the wall-of-buttons effect of
duplicating controls in two places.

### Detail panel

The detail panel renders:

- A larger square avatar with full plant
- Name, species, location pin
- Two fact chips: **Light** (sun icon) and **Today's task** (drop icon)
- A **timeline** of recent care (most recent first) with a vertical thread
  and color-coded top entry
- A small italic **note** specific to that plant (e.g. "Drama likes a
  soft mist and filtered light. Tap-water can crisp her edges; rainwater
  is dreamy.")
- **Mark watered** and **Snooze a day** buttons, large and obvious

### Actions and undo

Both **Water** and **Snooze** are real, undoable actions:

- **Water** marks the plant `done`, prepends `Today · Watered today` to the
  history timeline (capped at 6 entries), and pulses a soft green halo
  on the card. Pressing it again on a done plant **toggles back** to
  pending and removes the synthetic history entry.
- **Snooze** marks the plant `snoozed` with a sky-blue card treatment.
  Pressing again restores pending.
- **Undo** is a 6-second toast at the bottom of the screen with a clear
  **Undo** button. Pressing it restores the previous state and history
  exactly, including any history entry that was added. The toast auto-dismisses.
- A subtle **pulse animation** fires on water (skipped under
  `prefers-reduced-motion`).
- All actions also write to `aria-live` regions so a screen-reader user
  hears "Watered Frida" or "Snoozed Orbit a day".

### All-done state

When every plant with urgency ≥ 1 has been either watered or snoozed, the
queue section swaps in an **all-done** panel: a tiny hand-drawn landscape
(a sun, two hills, two seedling silhouettes) and a single line —
"A quiet day, well earned." This is the useful empty state the brief
asked for: it affirms the action without being saccharine.

### Weekly rhythm

The compact rhythm strip is a 7-bar histogram, one bar per weekday,
heights driven by `week` (`[1,3,2,4,2,1,3]`). Each bar shows the day's
count inside a small pill, so the rhythm is readable both at a glance
(today's bar in clay-and-butter) and in numbers. Heights are encoded as
CSS custom properties so the histogram animates in once on load.

---

## 3 · Desktop composition

The desktop layout is **not** a stretched mobile column. It uses a
two-column grid at `≥ 860px` (1.05fr / 1.45fr) that widens to 1.6fr at
`1080px`:

```
┌──────────────────────────────────────────────────────┐
│  Header: brand  ···  greeting (right-aligned)        │
├──────────────────────────────────────────────────────┤
│  Weekly rhythm (full width)                          │
├───────────────────────────┬──────────────────────────┤
│  Today's care · queue     │  Selected plant · detail  │
│  (compact cards, no btns) │  (large avatar + history) │
└───────────────────────────┴──────────────────────────┘
```

The detail panel is `position: sticky; top: 16px` so as the queue scrolls,
the selected plant stays in view. On `≥ 1080px` the detail panel widens
further and the rhythm section gets extra padding, giving the layout
space to breathe.

The two columns make distinct use of space:

- The **left** column is a tall, scannable list with tight cards.
- The **right** column is a slow, narrative surface with bigger
  illustration, history, and prose.
- The right column carries the action buttons on desktop, the left
  column carries them on mobile. Neither is a duplicate.

---

## 4 · Accessibility

The build is designed to be operable and legible without a mouse.

### Keyboard

- A visible **skip link** jumps straight to the care queue.
- Tab order moves: skip link → brand → first card → in-card buttons →
  next card → … → detail panel → its buttons → footer.
- Every plant row is a `<button>` with `aria-pressed` reflecting selection.
- Detail panel buttons are real `<button>` elements with explicit labels.
- `Cmd/Ctrl + ↓` / `Cmd/Ctrl + ↑` (and `j`/`k` with modifier) move
  selection through the queue, mirroring common list-navigation patterns.
- `Escape` dismisses the toast.
- Focus is **always visible**: dashed outlines (`2.5px dashed var(--ink)`)
  on cards and detail buttons, an outlined focus ring on the undo button,
  and the visible dotted focus ring follows the brand palette.

### Semantics

- `<main>`, `<header>`, `<section>`, `<footer>`, `<template>`, `<ol>`
  are used for structure.
- Card lists use `<ul role="list">` and `<li role="listitem">`.
- The card list has `aria-live="polite"` so screen readers hear changes
  when a plant is marked done or snoozed.
- The toast is `role="status"` with `aria-live="polite"`.
- Decorative SVG illustrations are marked `aria-hidden="true"`.
- Status pills are real text, not background color alone (each also
  carries the textual "Today" / "2 days overdue" label).

### Motion

A `@media (prefers-reduced-motion: reduce)` rule disables all transitions
and animations (`animation-duration: 0.001ms !important;
transition-duration: 0.001ms !important;`), so the pulse, the fade-in
toast, and the rhythm bar transitions all collapse to instant state
changes for users who request reduced motion.

### Color and contrast

- Body text on cream paper exceeds 7:1 contrast.
- Status pills use **both color and label** so color is never the sole
  carrier of meaning.
- `@media (prefers-contrast: more)` raises border weights and darkens
  ink colors for high-contrast users.

### Touch / mobile

- All interactive targets are ≥ 40px tall.
- The viewport meta uses `viewport-fit=cover` for safe-area support.
- The toast is centered and capped at `calc(100vw - 36px)` so it never
  overflows on narrow screens.

---

## 5 · No-network guarantee

- All assets are inline or local: SVG illustrations are generated by
  `app.js`, the noise texture is an inline SVG data URI in `styles.css`.
- No `<script src>` other than `app.js`. No `<link rel="stylesheet">` other
  than `styles.css`. No `<img>`, no `@font-face`, no remote URLs of any
  kind.
- System font stacks only. The serif stack falls back through Iowan Old
  Style → Georgia → Palatino → Book Antiqua → generic serif.

---

## File map

| File | Purpose |
|------|---------|
| `index.html` | Semantic structure, inline brand mark, weekly rhythm markup, hidden card template |
| `styles.css` | Palette, type, mobile-first layout, desktop two-column, reduced-motion and high-contrast rules |
| `app.js` | Data, state, rendering, action handling, undo, toast, keyboard nav |
| `RESPONSE.md` | This document |