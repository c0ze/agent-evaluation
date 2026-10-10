# Margin — Issue 14 landing page

Files: `index.html`, `styles.css`, `app.js`. Everything is local. The page uses
system font stacks, has no dependencies, and makes no network requests. I
checked this in headless Chromium: the page made zero non-`file:` requests.

## Art direction

**One motif, the waterline.** The issue is called *Low Water*, so the display
title is drawn as a gauge reading. "Low / Water" is set very large in a serif,
and a slate-blue rule runs through the lower half of "Water". Above the line the
letters are dry, solid ink. Below it they are "submerged", drawn as horizontal
hatching with an outline, like an engraving of water. A dashed "former level"
line sits higher up. On load (only when motion is allowed) the water drops once
from the old mark to the current line. The same idea appears in other places:

- The inline-SVG **riverbed section** has a depth-gauge staff, dotted old
  high-water lines, and the things named in the cover story sitting in the
  silt: a ledger, crimped bottle caps, and part of a street grid.
- The **supporting stories** step down the page like tide marks on a pier.
  Each column's top rule is a little lower than the one before.

**Print editorial.** Warm paper ground, ink-black rules (a heavy 6px masthead
bar, hairlines, a double rule over the contents), small-caps sans for labels,
monospaced numerals for issue and story numbers, and a rust drop cap. There are
two accents and each has one job: rust for numbers, objects and errors, slate
for water and success.

**Asymmetry and the margin itself.** On desktop the journal's name becomes the
layout. A narrow left column with a ruled edge holds the marginalia (issue
number, season, theme, an editor's note). The display, cover story, contents,
archive label and subscription form all hang from the same 12-column grid, so
the page reads as a spread, not as centred blocks.

**What I left out.** No gradient hero, no mockups, no testimonials, no rounded
pills. Controls are square-cornered and ruled. The one pull line is quoted from
the cover story's own summary rather than invented. The archive covers for
Issues 11–13 are tiny CSS-only drawings: rails for *After the Last Train*,
allotment plots with one taken for *Borrowed Ground*, and isobars for *The
Weather Indoors*.

## Responsive choices

- **390px:** The masthead is two short rows: the wordmark with a compact
  Paper/Night + A+ control, then the tagline and a three-link nav. The issue
  details become a single three-cell ruled strip. The title fills the width at
  `24vw`. The "waterline" label moves into the empty space created by the
  indent on "Water", so it never overlaps the letters. Stories use a numeral
  gutter, and the archive becomes a compact stacked list. The price and the
  full-width Subscribe button stay together. I checked for horizontal overflow
  at 390, 820 and 1440px, including with large text on.
- **Reading order** follows the DOM at every width (no CSS `order`): issue
  details → title → cover story → figure → supporting stories → archive → offer
  → form → colophon.
- **Tablet (≥40rem):** the cover story and figure sit side by side, and the
  stories switch to the stepped three-column layout at 48rem.
- **Desktop (≥64rem):** the marginalia column appears on the left, and the
  content aligns to the grid from column 3 onwards.
- Type is fluid with `clamp()`, and the reading measure is capped at about 36rem.

## Accessibility

- **Landmarks and headings:** skip link, `header`/`nav`/`main`/`footer`, and one
  `h1` ("Margin, Issue 14: Low Water", with a visually hidden prefix). Then
  `h2`s for the cover story, contents, archive and subscribe sections, and
  `h3`s for the three stories.
- **Display motif:** the submerged copy of the title and the gauge labels are
  `aria-hidden`, so screen readers hear the title once. Decorative numerals and
  the archive thumbnails are hidden too, and the text next to them carries the
  meaning.
- **SVG:** `role="img"` with `<title>` and `<desc>` describing the scene, plus a
  visible figcaption.
- **Reading mode:** Paper/Night are native radio inputs in a `fieldset` with a
  legend, inside a group labelled "Reading mode". Text size is a toggle button
  with `aria-pressed`. The choice is saved in `localStorage` (wrapped in
  try/catch) and applied in `<head>` before first paint. Until the reader
  picks, the page follows the system colour scheme. Large text scales the root
  font size, so the whole layout grows with it.
- **Email field:** it has a real `<label>` and a hint, and `aria-describedby`
  points at both the hint and the error. Validation runs on submit and on blur.
  After the first attempt it re-checks as the reader types, so nobody gets an
  error mid-word. Errors set `aria-invalid`, show specific text next to a
  non-colour "!" marker, and move focus back to the field. Success goes to a
  `role="status"` live region and says plainly that nothing was sent.
  `preventDefault` stops any submission.
- **Contrast and states:** body and secondary text pass WCAG AA in both themes.
  Every control has a 3px `:focus-visible` outline, and the hit targets are at
  least 36–52px. `prefers-reduced-motion` turns off the waterline animation,
  smooth scrolling and theme transitions. There is a `forced-colors` fallback
  and a simple print stylesheet.
