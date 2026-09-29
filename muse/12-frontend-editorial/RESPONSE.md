# Margin — Issue 14 “Low Water”: design response

## Art direction

**Concept: the exposed riverbed as a printed survey.** The issue is about what
low water reveals, so the page is set like a contemporary field journal: a
formal masthead with folio line, ruled sections, drop cap, pull quote, and page
folios (p. 58 / 84 / 112) — rather than a SaaS hero.

**One display motif: topographic contour lines.** A single inline-SVG plate in
the cover figure traces a receding river channel with survey ticks, a
“DATUM −2.4 M” annotation, and an outlined folio “14”. A quiet echo of the same
line runs above the footer. All artwork is CSS rules and inline SVG — zero
image files, zero requests.

**Typography & composition.** System serif (Georgia stack) for display, italic
deks, and pull quotes; system sans for body; monospace for folios, kickers, and
the masthead meta line — the classic editorial three-voice system. The cover
uses an asymmetric 7:5 grid (headline block vs. contour plate), the middle
story column drops lower than its neighbours, and a vertical marginalia line
(“Overlooked places, quarterly”) sits in the cover margin. Palette is paper,
ink, and one oxblood accent reserved for the issue signal: kicker, italic
headline fragment, rules, and links.

## Responsive choices

- **Breakpoints at 60rem and 40rem.** Below 60rem the cover, excerpt, and
  subscribe grids collapse to one column and the vertical marginalia is
  removed (it would collide at narrow widths).
- **390px mobile:** single column throughout; the story list stacks in DOM
  order with the middle-column offset removed; the archive strip stacks with
  top dividers; the email field and button stack full-width so both are
  tappable; masthead nav wraps under a rule; the price folio hides to avoid
  crowding.
- **Reading order** is DOM order at every width — no `order` overrides or
  visual re-sorting — so keyboard, screen-reader, and visual sequences agree.
- Fluid display type via `clamp()` so the headline scales from ~2.5rem at
  390px to ~5.6rem on desktop without breakpoints.

## Accessibility

- Landmarks (`banner`, `main`, `contentinfo`), one `h1`, logical heading order,
  and a skip-to-content link.
- Decorative SVG (footer lines, survey ticks) is `aria-hidden`; the contour
  plate has `role="img"` with `<title>`/`<desc>` plus a visible caption.
- Reading-mode buttons use `aria-pressed` in a labelled group; the mode flips
  CSS custom properties (Paper / Sepia / Ink) and persists via `localStorage`,
  defaulting to the OS `prefers-color-scheme` only when the reader has never
  chosen. Contrast holds in all three modes (accent lightens on the Ink theme).
- Email validation is inline and announced through an `aria-live="polite"`
  `role="status"` region; invalid input sets `aria-invalid` and moves focus
  back to the field on submit. No data is submitted anywhere.
- Visible `:focus-visible` outlines, `prefers-reduced-motion: reduce` disables
  smooth scrolling/transitions, and touch targets are full-width bars on mobile.
- No frameworks, external fonts, or network requests: the page works offline
  from the three local files.
