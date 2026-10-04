# RESPONSE — Margin, Issue 14: *Low Water*

A short design note for the responsive landing page at `index.html`.

## Art direction

The brief asked for a print editorial language translated to the web with
restraint. The journal is called *Margin*, so the whole page is built
around the literal meaning of the word — the white space around a page,
the small notes written there, and the marks water leaves when it
withdraws.

**One strong display motif: the waterline.** A set of six horizontal
lines, drawn with inline SVG, describe the surface a body of water has
held across four autumns. Elevation labels (+6.2 m, MEAN LEVEL, −5.4 m)
sit on the left axis; season ticks (AUTUMN '23 → AUTUMN '26) sit on the
right. The same idea recurs as the hairline rules that divide sections,
the monospace marginal measurements, and the dry-riverbed tones of the
palette. Nothing in the design pretends water is present; everything is
the mark it left.

**Type carries the personality.** All fonts are the reader's own system
stacks — Iowan Old Style → Palatino → Charter → Georgia for serif body
text; the platform sans for UI; SF Mono / Menlo for marginal
measurements, issue marks, and section numerals. No external fonts, no
network, no analytics.

A few opinionated treatments do the heavy lifting:

- The cover title is set italic at display size with a drop cap on the
  dek in the same oxblood used for issue marks.
- Section heads carry a small `§ i — § iv` running number in monospace,
  anchoring the page to a journal's table of contents.
- All kickers, bylines, and metadata are uppercased mono with generous
  tracking — the same way a magazine would typeset a folio.
- Pull quotes and deks are italic, with no quotation marks, so they
  read as commentary rather than advertising copy.
- The colophon at the foot of the page is a print convention, used
  honestly to describe how the issue was made.

There are no gradients, no glows, no shadows, no pills, no fake
testimonials. The whole page is paper, ink, rules, and one SVG.

## Responsive choices

The design is built mobile-first and is meant to be read on a phone.

**At 390 px (and below)** everything collapses to a single column in
deliberate reading order:

1. Masthead kicker and ISSN
2. Wordmark and italic strapline
3. Issue plate (No. 14 · Autumn 2026 · Low Water) and primary nav
4. Cover art — the waterline SVG, full-bleed with a small caption
5. Cover-story kicker ("Cover Story · Field Essay")
6. Cover title in italic display
7. Cover dek with the drop cap
8. Cover byline
9. Three stories stacked with horizontal rules
10. Archive strip — three items stacked
11. Subscription terms stacked
12. The form, full-width
13. Colophon, theme switcher, and contact block stacked

**At ≥ 50 rem (≈ 800 px)** the hero becomes asymmetric: a left-side meta
column holds the kicker, a middle column holds the title and dek, and a
right column holds the byline. The contents list becomes a three-up
grid with vertical rules between stories. The archive strip becomes a
three-up grid. The colophon becomes a three-column footer with the
theme switcher in the middle. The subscription terms become a four-up
row of term cards. The email form's input and submit button sit on one
row instead of stacking.

A few specific decisions:
- The SVG waterline uses `preserveAspectRatio="none"` and a fixed
  `aspect-ratio` so it stretches edge-to-edge at every width without
  distorting the seasonal ticks visually.
- The masthead's wordmark uses `clamp(3.75rem, 12vw, 7.5rem)` so the
  logotype fills any width without overflow.
- The cover title uses `text-wrap: balance` to avoid orphans.
- The cover byline moves from a border-topped row on mobile to a
  borderless right-side block on desktop. The substance is the same;
  only the choreography changes.
- The form collapses to a stacked input + button on phones and becomes
  an inline row at 36 rem. The submit button updates from "Begin
  subscription" to "Subscribed" and disables itself after success.
- The nav stays inline at every width (no hamburger) because there are
  only five links and they wrap naturally; this matches the
  never-collapsing nav of a print table of contents.

The reading order on mobile deliberately does **not** match the visual
order at desktop in a few places. The byline under the cover dek, for
example, is moved below the dek on mobile (where the dek is the
attention-grabber) but lives in the right-side meta column on desktop,
where the title can carry the first read.

## Accessibility

- **Landmarks and skip link.** A skip link jumps to the cover story;
  `<header role="banner">`, `<main id="main" tabindex="-1">`, and
  `<footer role="contentinfo">` provide the structural frame.
- **Heading hierarchy.** One `<h1>` ("Margin"); the cover story uses an
  `<h2>`; each story uses an `<h3>`. Headings are never used for styling
  alone.
- **Real controls.** The theme switcher is a `role="group"` of
  `<button>`s with `aria-pressed` to indicate the active state. The
  form uses `<label for>`, `aria-describedby`, and an `aria-live="polite"`
  status region for feedback.
- **Form validation that works for everyone.** The email input gains
  `aria-invalid="true"` on bad input, the wrapper border picks up a
  visual error state, and the live region announces both the success
  and error messages. Submitting a valid email disables the button and
  announces "Thank you. A confirmation will be sent to *reader*" — no
  page reload, no network call.
- **No color-only signaling.** The theme switcher shows the active
  state via both background color and `aria-pressed`. Validation
  messages are text, not just a colored border.
- **Focus is visible everywhere.** `:focus-visible` draws a 2 px accent
  outline with a 3 px offset.
- **Decorative content is hidden from AT.** The waterline SVG has
  `role="img"` with a short `aria-label` summarising the chart, and
  `aria-hidden="true"` is applied to purely decorative elements (the
  "Cover Story" dot, section numerals, separators). The `figcaption`
  credit is conveyed through the `::after` pseudo-element alongside
  the SVG so it is read with the surrounding text.
- **Reduced motion.** `prefers-reduced-motion: reduce` disables all CSS
  transitions and smooth scrolling.
- **Contrast.** The default (paper) theme measures well above WCAG AA
  for body and headings; the ink (dark) theme keeps body text above
  14:1. The accent color is used sparingly so it never has to carry
  semantic load on its own.
- **Color schemes respected.** The page sets `meta[name="theme-color"]`
  in the default paper tone; the dark-mode paint only applies after
  the user explicitly opts in (or restores a prior preference) so
  forced-colors mode is not fought.

## Files

- `index.html` — semantic markup, inline SVG, accessible form.
- `styles.css` — three reading modes, mobile-first grid, no remote
  assets.
- `app.js` — reading-mode switcher with `localStorage` persistence, and
  inline email validation with a simulated success state. No network
  requests.
- `RESPONSE.md` — this note.