# RESPONSE — Margin, Issue 14 “Low Water”

Files: `index.html`, `styles.css`, `app.js`. No frameworks, no build step, no
remote assets, no external fonts, no network requests of any kind (the favicon
is an inline `data:` URI; the subscribe form is `preventDefault`ed).

## Art direction

**Concept.** The whole page is set as the cover-and-contents spread of a print
quarterly, and the single display motif is a **river gauge staff** — the graded
measuring stick left in a river to record its level. It earns its place because
Issue 14 is literally about a river at 0.4 m: the motif *is* the subject.

The gauge appears at four scales:

1. **The cover plate** — a hand-built inline SVG: sediment bands stacked by
   opacity, a low rust sun, a dashed “usual high water” line, and a numbered
   staff whose waterline pointer sits at 0.4 m. The objects the river “keeps”
   (a ruled shop ledger, a notched bottle cap, a torn street-plan grid) lie
   exposed on the bed above the waterline, straight out of the cover essay.
2. **The gauge rule** — a CSS-only strip of major/minor tick marks
   (`repeating-linear-gradient`) under the sticky masthead and above the
   colophon, like the printed measurement edge of a broadsheet.
3. **Micro-ticks** — the small `.ticks` dividers framing the pull quote and
   each archive card.
4. **Typographic echoes** — section folios (“№ 02 · Contents”), mono gauge
   labels, and contents entries numbered 01–04 like staff readings.

**Palette & type.** Warm newsprint (`#f2ecdf`), letterpress ink, one river-teal
accent, one oxidised-rust mark — no gradients, no glass, no pill buttons. Type
is local-only: an old-style **serif stack** (Iowan/Palatino/Georgia) for display
and body, **monospace** for folios, labels, and gauges — the two-family pairing
of print magazines. The masthead title mixes roman (“Low”) with italic teal
(“Water”), and the cover plate is framed by a **misregistered double rule**
(two 1-px frames offset by a few pixels), a deliberate nod to a second printing
plate laid a hair off. The plate is even rotated −0.6°, like a tipped-in plate.

**Composition.** Asymmetric by design: a 7/5 cover grid with the art dropped
3.5 rem below the headline; contents rows that step toward the gutter on
alternate entries; archive cards with staggered baselines; the subscribe card
offset from the offer column. Rules and whitespace do the separating — there
are no cards-with-shadows, hero gradients, or testimonial furniture anywhere.

## Responsive choices

Mobile-first CSS; the 390 px composition is the base, not a fallback.

- **390 px:** single column, 1.25 rem side margins, headline clamped to
  `15vw` (~4–5.5 rem) so “Low / Water” always fits on two lines. The folio bar
  becomes a 2-row grid: wordmark + reading-mode toggle on row one, issue line
  on row two (long tagline hidden). Cover art sits *below* the cover-story
  block, so the reading order is: issue → title → standfirst → cover story →
  plate. Contents rows collapse to marker + body with the genre label tucked
  underneath. The archive strip becomes a **horizontal scroller** with
  `scroll-snap-type: x proximity`, 78%-wide cards, visible thin scrollbar, and
  `tabindex="0"` so keyboard users can scroll it.
- **640–759 px:** archive cards widen to 55% (two visible, implying scroll);
  button padding grows.
- **≥760 px:** archive becomes a 3-column print spread with staggered top
  padding and hairline dividers; colophon goes 3-up.
- **≥900 px:** the asymmetric 7/5 cover grid, 3-column contents rows with the
  alternating gutter step, plate tilt, and the two-column subscribe section
  switch on.
- **≥1024 px:** the full folio bar (wordmark · tagline · issue · toggle) on one
  line.

All scaling is `clamp()`-based, so intermediate widths interpolate instead of
jumping. The sticky masthead is paired with `scroll-padding-top` so anchor
jumps never land under it.

## Reading mode (functional)

The masthead toggle switches `html.reading`, which swaps the entire custom-property
palette to a warm **night-desk theme** (bg `#16120e`, ink `#ece2cd`), raises the
root font size to 112.5%, and loosens body leading to 1.72 — a genuine reading
mode, not just a dark filter. Because every colour is a variable (including the
SVG paint roles), the illustration re-inks with the page. The state is exposed
via `aria-pressed` plus a visible “on/off” label, persists in `localStorage`
(try/catch-guarded), and is pre-applied by a tiny inline head script so a saved
choice never flashes white on load.

## Email field (functional, no submission)

`novalidate` form with custom inline validation:

- **Blur** on a non-empty field starts validation; **submit** always validates.
- Empty → “Please enter your email address.”; malformed → a correction hint
  with an example. Errors render in a `role="alert"` paragraph wired to the
  input via `aria-describedby`, and set `aria-invalid="true"` plus a rust
  border.
- Once touched, **live re-validation** on input clears the error the moment the
  address becomes valid; typing also clears any stale success message.
- On success, `event.preventDefault()` runs (nothing is sent anywhere), the form
  resets, and a confirmation appears in a polite `role="status"` live region,
  explicitly marked “Demo only: nothing left your browser.”
- A `<noscript>` note explains that only the form needs JS; the page itself is
  fully readable without it (reveals are gated behind a `.js` class the script
  adds, so no-JS users see all content immediately).

## Accessibility

- **Semantics & landmarks:** `header`/`main`/`footer`, one `h1`, sections
  labelled via `aria-labelledby`, an ordered list for contents, a skip link,
  and DOM order identical to visual order at every breakpoint (no `order`
  tricks; the mobile stack is the source order).
- **The artwork:** the cover SVG is `role="img"` with a `<title>` and a rich
  `<desc>` (gauge reading, exposed objects, high-water line) referenced by
  `aria-labelledby`, and a visible figcaption. Purely decorative marks (tick
  rules, story numbers, archive numerals, birds) are `aria-hidden`.
- **Contrast:** ink on paper ≈ 13:1; soft ink ≈ 6.2:1; teal accent ≈ 6.1:1;
  rust is ≈ 4.3:1 and therefore reserved for large text, rules, and graphics.
  The reading-mode palette is re-tuned (lighter teal/rust on near-black) to
  hold the same ratios.
- **Keyboard & focus:** every control is a real `button`/`input`/`a`; a visible
  2-px `:focus-visible` outline (offset) is themed per mode; the scrollable
  archive strip is focusable; the toggle’s state is in the accessibility tree
  via `aria-pressed` and announced as text.
- **Motion:** scroll reveals honor `prefers-reduced-motion` (both in JS — the
  observer is skipped — and CSS — transforms/transitions are removed),
  `scroll-behavior: smooth` falls back to `auto`, and the plate tilt is
  disabled.
- **Forms:** labels are real `<label for>`, `autocomplete="email"`,
  `inputmode="email"`, errors are programmatic *and* visual (never
  colour-only), and feedback goes through live regions instead of focus games.
