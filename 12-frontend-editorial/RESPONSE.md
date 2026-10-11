# Margin, Issue 14 — response notes

Files: `index.html`, `styles.css`, `app.js` (plus this note). No frameworks, no
package installs, no remote assets, no external fonts, no network requests —
all artwork is CSS or inline SVG, all type is a local serif/sans/mono stack.

## Art direction

The brief was "contemporary print editorial translated to the web," so the page
is built the way an issue is built: one measure, hairline rules, numbered
sections, marginalia, and a single loud typographic gesture.

**The one display motif is the waterline.** A datum line — accent red, 1 px,
with mono annotations `datum 1962` at the left end and `mean low water −2.4 m`
at the right — is struck horizontally through the word "Water" in the title,
and then appears again, in the same visual language, in the plate beneath it:
an inline-SVG field of nested riverbed contours with a dashed high-water mark
above and a solid present channel below, plus survey ticks. The motif is
therefore both a graphic device and the issue's argument (the water is gone;
here is the evidence). It is repeated at low volume everywhere else: every
section head carries a "measuring rule" hairline with 12 px ticks, and the
colophon closes on the same rule. One motif, three registers — title, diagram,
divider.

**Composition** is asymmetric on purpose. The hero sets the title in eight of
twelve columns with the standfirst in the last three, hung on an ink rule and
bottom-aligned, so the two blocks share a baseline rather than a grid line.
The cover story runs seven columns with a sticky four-column margin column
holding a pull quote and field notes — the page literally has a margin. The
three supporting stories are staggered rather than tiled: 02 starts at column
1, 03 is pushed down and right to columns 7–10, 04 drops to columns 3–7. That
stagger survives down to two columns at 700 px and becomes a clean stack on
phones.

**Type.** Local stacks only: an old-style serif for display and body
(Iowan/Palatino/Georgia), a neutral system sans for captions and notes, and a
mono for eyebrows, issue numbers, prices and labels — the mono is what makes
it read as a journal colophon rather than a SaaS page. Display sizes use
`clamp()` against `vw`, so "Low Water" is ~4.2 rem on a phone and ~13.5 rem on
a desktop; the second line is italic and indented, which breaks the
rectangular slab a plain two-line title would make.

**Colour.** Uncoated-paper ground (`#f2efe6`), near-black ink (`#16150f`), one
rust accent (`#9c3b1f`) used only for the motif, prices, errors and small
labels. Night mode inverts to a warm near-black with a lighter terracotta so
the accent keeps its contrast.

**Avoided on purpose:** hero gradients, dashboard mockups, pill buttons
everywhere, avatar testimonials, centred symmetric hero, stock-photo cards.

## Responsive choices

- **Mobile-first.** The base layout is a single column; grids are introduced at
  700 px (two/three-column stories, three-across archive, visible section nav)
  and at 1000 px (the twelve-column editorial grid of the hero, cover and
  subscribe blocks).
- **390 px.** Padding is `clamp(18px, 4.5vw, 56px)`, so the measure is 354 px
  at 390. Display type, the waterline and the motif all scale off `vw`/`clamp`
  and were checked at 390 px: no horizontal overflow (`scrollWidth === 390`),
  the waterline still crosses the title with both annotations on one line, and
  the motif compresses to a 150 px band instead of cropping.
- **Reading order** matches the printed issue: masthead → issue title →
  standfirst → plate → cover story → supporting stories → archive →
  subscription → colophon. No `order`/`flex-direction` reordering is used, so
  DOM order, visual order and tab order agree at every width.
- The margin column is `position: sticky` on desktop only; on small screens it
  becomes an ordinary block after the cover text.
- The masthead is sticky with `scroll-padding-top` set on `html`, so anchor
  links never land under it.
- Print styles drop the masthead, mode switch and form.

## Interaction

- **Reading mode** (`Paper` / `Night`): a two-button group with `aria-pressed`,
  applied as `data-theme` on `<html>`. Choice is remembered in
  `localStorage`; if the reader has never chosen, the OS
  `prefers-color-scheme` is used and still followed live. An inline script in
  `<head>` sets the theme before first paint, so there is no flash, and the
  `theme-color` meta is updated with it.
- **Email field**: labels are visible, validation runs on submit and on blur
  and corrects itself while typing. Messages are specific ("That address is
  missing an @", "…try name@example.com"), tied to the input with
  `aria-describedby` and `aria-invalid`, and announced through a
  `role="status"` live region. Success replaces the form with a confirmation
  quoting the address and moves focus to it; a "Use a different address"
  button restores the form. Nothing is submitted anywhere.
- A light `IntersectionObserver` fade-up is applied to the long-read sections
  only when the browser supports it and only when reduced motion is not
  requested, with a timeout fallback so copy can never be stranded invisible.

## Accessibility

- Landmarks (`banner`, `main`, `contentinfo`), a skip link, one `h1` and a
  clean `h2`/`h3` outline; sections are labelled with `aria-labelledby`.
- The motif SVG is `role="img"` with `aria-labelledby` pointing at its
  `<title>` and `<desc>`; per-story glyphs are decorative and carry
  `aria-hidden="true"` and `focusable="false"`. The crossed title keeps a
  single accessible name — the waterline and its annotations are
  `aria-hidden`.
- Visible `:focus-visible` rings on every interactive element and on the
  confirmation heading that receives focus.
- Contrast at rest: ink on paper ≈ 17:1, secondary text ≈ 8:1, accent ≈ 6:1;
  the night palette clears 4.5:1 for text and keeps the accent above 6:1.
  Errors are text plus an arrow glyph and a border change, never colour alone.
- `prefers-reduced-motion` disables smooth scrolling, transitions and the
  reveal. Targets meet the 24 px minimum: the mode buttons are 40 px tall
  together with their row, the submit button is full-width and 48 px+ on
  mobile.
