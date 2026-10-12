# Margin — Issue 14, Low Water

## Art direction

The page is built as a magazine spread, not a marketing page. The organising
idea is **the margin**: a real, visible left/right margin that the type is set
against, and a single display motif carried through the whole page.

**The display motif — strata.** Issue 14 is about a riverbed that has given up
its buried contents, so the motif is a set of fine horizontal rules stacked at
slightly different depths, like a surveyor's cross-section. It appears three
times and nowhere else:

1. As the cover plate — an inline SVG cross-section (`index.html`, `.plate`),
   with a dashed teal line for the former water level and objects lodged in the
   silt below it: a ledger, bottle caps, tile fragments, a dashed street plan,
   two roots. Drawn in `currentColor`-adjacent theme tokens, so it recolours
   with reading mode.
2. As the section dividers (`hr.rule--strata`) — the same stacking rendered as
   a `repeating-linear-gradient`, so the rules between sections are a reduced
   echo of the plate rather than decoration.
3. As the archive strip and the terms list — 1px hairline grid cells, the same
   logic turned into a table.

**Type.** No webfonts (no network allowed), so the stack is a local old-style
serif (Iowan / Palatino / Georgia) for all editorial matter and a system
grotesque, set small and wide-tracked, for labels, kickers, and metadata. The
contrast between a large serif display line and tiny letterspaced caps is what
carries the print feeling. Colour is limited to ink, paper, one oxide red
(accents, italics, errors) and one muted teal (the water line) — two accents,
used sparingly.

**Composition.** Asymmetric on purpose. The cover is a 12-column grid where the
headline runs nearly full measure and deliberately stops before the right
margin; the standfirst, byline, and facts sit in a narrow left column (cols 1–5
or 2–6) while the plate occupies the right (7–13) and bottom-aligns against
them, leaving a genuine column of white space down the page's right edge. The
story list is a three-column ledger: number / title + byline / summary, so the
eye reads down the numbers and across the summaries. No hero gradient, no
floating device, no testimonials, no pill buttons — the only rounded element on
the page is the reading-mode toggle, which reads as a printed stamp.

## Responsive choices

Mobile-first; two breakpoints.

- **Base (≤ 719px, verified at 390px):** everything is a single column, and DOM
  order *is* reading order — kicker → headline → standfirst → byline → plate →
  facts, then contents, archive, subscribe, footer. Nothing is reordered with
  `order`, so the mobile sequence matches what a screen reader and a keyboard
  traverse. The plate shrinks to full width instead of being hidden; it's
  vector, so it costs nothing at 390px and stays meaningful. Fluid type uses
  `clamp()` (`12.5vw` for the display line) rather than stepped sizes, and
  `minmax(0, 1fr)` / `min(100%, 13rem)` on every grid track prevents the
  long words ("Receipts", "Orchards") from forcing horizontal overflow.
- **≥ 720px:** the 12-column asymmetric cover turns on, the masthead becomes a
  single row (mark / tagline / nav / mode), the facts list goes 2×2 → 1×4, and
  the story rows become the three-column ledger. The subscribe panel becomes
  sticky so the offer stays beside the form while scrolling.
- **≥ 1080px:** margins widen — headline stops at column 11, body copy indents
  to column 2, leaving the left margin as visible white space.
- `prefers-reduced-motion` kills transitions; a `print` stylesheet drops nav,
  form, and the mode toggle.

## Accessibility

- Skip link to `#main`; landmarks (`header` / `main` / `footer`, `nav` labelled,
  each section labelled by its own heading via `aria-labelledby`).
- One `h1`, then `h2` per section and `h3` per story — no level skips.
- The cover SVG is not decorative noise: it has `role="img"` with `<title>` and
  `<desc>` describing the water line and the buried objects, and its inner
  groups are `aria-hidden`. The masthead mark and all purely ornamental text
  are `aria-hidden="true"` with `focusable="false"`; no information is carried
  by artwork alone (the plate repeats its content in the caption and in the
  standfirst).
- Reading-mode control is a real `<button>` (not a styled div): keyboard
  operable, `aria-pressed` reflects state, the label describes the *action*
  ("Night reading" / "Paper reading"), state persists in `localStorage`, and it
  follows `prefers-color-scheme` only until the reader chooses. Both modes were
  checked for contrast — ink on paper ≈ 14:1, inverted ≈ 12:1; the oxide red is
  lightened in night mode so it stays above 4.5:1 on the dark ground.
  `theme-color` is updated with the mode so the browser chrome matches.
- Form: real `<label for>`, hint text and error both linked by
  `aria-describedby`, error is `role="alert"` with `aria-invalid` on the input,
  focus moves to the field on failure and to the success panel on success. The
  error clears itself as soon as the input becomes valid, and blur only
  validates a non-empty field so tabbing past it isn't punished. Validation is
  progressive and specific (missing `@`, stray space, incomplete domain).
  Submit is `preventDefault`ed — nothing is sent.
- Focus is always visible (`focus-visible` ring in both modes), targets are
  ≥ 44px tall, and the numbered story items use a semantic `<ol>`.

## Files

- `index.html` — structure, inline SVG artwork, copy from `COPY.md`.
- `styles.css` — tokens (two reading modes), fluid type, grids, motif.
- `app.js` — reading-mode control + email validation (no submission).
- No frameworks, no installs, no remote assets, no external fonts, no requests.
