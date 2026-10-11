# RESPONSE — Margin, Issue 14: Low Water

## Art direction

The page translates a contemporary print quarterly to the web rather than
imitating a product site. The language is serials furniture: a double-ruled
masthead with a wire-style wordmark, kickers and bylines in uppercase
monospace, a drop cap on the cover lede, page references (pp. 14–41), and a
facts strip (issue / season / theme / length / price) set like a colophon.

The single display motif is the **receding waterline**, carried through the
whole page in three registers:

1. The cover artwork is an inline SVG "contour survey" of a drying riverbed —
   nested hand-drawn rings where the outermost line is dashed rust and
   annotated "former waterline, est. 1989," and the innermost ring is the
   teal "water today," echoing the cover story about a river that surfaces
   what the city tried to forget.
2. A full-width **river gauge divider** (pure CSS repeating gradients as
   staff-gauge ticks) separates the cover from the contents, labelled
   "waterline ↓ 2.4 m below normal."
3. The archive strip reuses small contour glyphs, one per back issue, each
   slightly distorted so no two "bodies of water" are alike.

The palette is uncoated paper (`#f4efe2`), ink (`#221e16`), a low-water teal,
and an exposed-bed rust used sparingly for annotation and error states. There
are no gradients-as-decoration, no cards with shadows, no pills, and no
testimonials — the subscription offer is stated plainly, the way a small press
would state it. All type is the reader's own system serif and monospace; the
colophon says so, and it is true: the page makes zero network requests.

## Responsive choices

The composition is a 12-column grid used asymmetrically: cover text spans
seven columns while the framed artwork hangs in columns 9–12 and drops below
the headline axis; the three supporting stories are staggered across the grid
with vertical offsets (02 left, 03 pushed right and down, 04 re-centred), so
the eye moves the way it does across a spread. At 60 rem the grid relaxes —
artwork moves under the cover text, stories widen. At the 390 px target the
page becomes a single serial column in reading order (masthead → cover →
facts → gauge → contents → archive → subscribe → colophon), the issue-facts
strip reflows to two columns, and the archive becomes a horizontal scroll-snap
strip so it stays a "strip" instead of stacking into a wall. Type uses `clamp()`
throughout so the wordmark and headline scale continuously rather than
jumping at breakpoints.

## Accessibility

- Semantic landmarks (`header`, `nav`, `main`, `section` with
  `aria-labelledby`, `footer`) and a logical heading order: one `h1` wordmark,
  section `h2`s, story `h3`s — so the reading order is intact without CSS.
- Skip link to `#main`; visible `:focus-visible` outline in rust.
- The cover SVG is `role="img"` with `<title>` and `<desc>` describing what
  the contours mean; decorative archive glyphs and story numerals are
  `aria-hidden`.
- The reading-mode toggle is a real `<button>` with `aria-pressed` and a
  state readout, persisted via `localStorage`. Reading mode softens the
  paper/ink contrast, lengthens line-height and measure, and dims the artwork
  — a calmer page for sustained reading.
- The email field is a labelled input with `novalidate` so validation stays
  inline: errors set `aria-invalid`, point at the feedback paragraph via
  `aria-describedby`, are announced through `aria-live="polite"`, and move
  focus to the field; success is announced the same way. The form never
  submits anywhere.
- Color is never the only signal (error text plus border plus message);
  `prefers-reduced-motion` disables the smooth-scroll and theme transition.
