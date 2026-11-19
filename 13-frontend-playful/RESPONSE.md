# Moss — design response

## Personality

Moss is a gentle household plant-care companion that feels warm, tactile, a
little odd, and quietly optimistic. The visual voice comes from a handful of
deliberate choices:

- **A living paper palette** — warm parchment backgrounds with soft speckles and
  two wandering colour blobs (all CSS gradients, no remote assets), deep forest
  greens, sunflower yellow, and a terracotta clay accent.
- **Expressive shape language** — nothing is a plain rectangle. The count badge
  is a lopsided blob, every plant avatar is an asymmetric "pot" shape, the
  sticky note is pinned at a jaunty angle with a hand-drawn squiggle, and the
  weekly buds are irregular pebble shapes. This gives the tactile, slightly
  strange character the brief asked for.
- **Hand-drawn illustration, not clip art** — each of the four plants has its
  own inline-SVG illustration (ferns, pothos vine, bunny-ears cactus, striped
  calathea) drawn with organic strokes and restrained colour. They read as
  considered illustrations rather than childish icons.
- **Small moments of delight** — the count badge tilts, buds pop in with a
  staggered spring, cards lift on hover, and the all-done state blooms a little
  sprouting sun. Motion is decorative but never essential.

The background texture, blobs, and illustrations are entirely CSS or inline
SVG. There are no frameworks, no fonts, no images, and no network requests.
`PLANTS.json`'s data is mirrored in `app.js` so the screen also works when
opened directly from `file://`, where `fetch` of a local JSON file is blocked.

## Interaction model

- **Today's care queue.** All four plants from `PLANTS.json` are rendered,
  sorted by `urgency` so the overdue Boston fern ("2 days overdue") sits at the
  top and is visually flagged with a clay border and a "late" tag. Due dates
  use three tones: late (clay), today (sunflower), and soon (muted green).
- **Detail via expandable panel.** "See its notes" expands an inline panel with
  the plant's preferred light (with a little sun icon) and its full water /
  observation history as a timeline. The control is a real `<button>` with
  `aria-expanded` and `aria-controls`, and the panel is shown/hidden with the
  `hidden` attribute so it stays out of the accessibility tree when closed.
- **Watered / Snooze with brief undo.** Either action removes the plant from the
  queue and slides up a toast ("Frida has been watered." / "Orbit snoozed until
  tomorrow."). The toast's **Undo** button restores the plant to its exact
  position. The toast auto-dismisses after 6.5 seconds, giving a short undo
  window without lingering forever. After the last action the toast also
  clears. Focus is moved to the next action button (or the reset button) when a
  card is removed, and back to the restored card on undo.
- **Weekly rhythm.** A compact bar-style chart shows Monday–Sunday as columns of
  pebbly "buds," one per care task from `week: [1,3,2,4,2,1,3]`. Thursday is the
  peak and is marked today; each column exposes its value through an
  `aria-label` ("Thu: 4 care tasks"). Buds animate in with a stagger.
- **All-done state.** When the queue empties, an illustrated, encouraging
  "Everyone's content." panel appears with a **Start the day over** button that
  restores all four plants — useful rather than a dead end.
- **Desktop composition.** On wide screens the layout becomes a two-column
  editorial spread: the care queue flows on the left while the rhythm chart and
  pinned note stack in a right-hand "side" column. It is a real composition,
  not a stretched phone column; the queue cards also gain roomier detail
  columns at medium widths.

## Accessibility choices

- **Semantics.** Landmarks (`header`, `main`, `aside`, `footer`-less by design),
  a single `<h1>`, structured headings, real `<button>` elements for every
  control, labelled regions via `aria-labelledby`, and a `role="list"` queue
  with `role="listitem"` cards. Decorative SVGs are `aria-hidden` +
  `focusable="false"`.
- **Keyboard + focus.** Everything is reachable with Tab/Enter/Space. A strong
  `:focus-visible` outline (clay, 3px, offset) makes focus unmistakable. Focus
  is explicitly managed when cards are added or removed so keyboard users are
  never stranded.
- **Live feedback.** The undo toast is a `role="status"` / `aria-live="polite"`
  region, so action confirmations are announced without interrupting. The
  count badge carries an `aria-label` describing how many plants remain.
- **Readability.** Generous sizing, high-contrast ink on parchment, italic
  accents that stay readable, and text labels (never colour alone) for due
  status and actions.
- **Reduced motion.** A `prefers-reduced-motion: reduce` block neutralises all
  animations and transitions, so the pop, float, and bloom effects degrade to
  static content with no loss of meaning.
- **No external dependencies** means no network-dependent fonts or assets can
  fail and leave the interface broken.
