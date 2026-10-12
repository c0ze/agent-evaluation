# Margin — Issue 14 landing page: design notes

## Art direction

The page is built as a piece of contemporary print editorial translated to the
web: a masthead with a full-bleed thick/thin double rule, a giant serif
wordmark, small-caps kickers and bylines, hairline rules, italic standfirsts,
and an asymmetric 12-column grid. Type is Georgia (display/serif) with the
system Helvetica stack for labels — no webfonts, no assets, no network.

The single display motif is the **low-water gauge**: an inline SVG drawn like
a ruler stamped on a river wall, with tick marks, a dashed line for April's
high water and a solid oxide-red line for the current level, captioned
"Fig. 1 — the mark at the old ferry crossing." It appears inside the issue
cover panel, ties directly to the issue theme (Low Water), and is echoed by a
short accent segment sitting on the masthead rule, aligned to the wordmark's
left edge. Supporting stories use outlined ghost index numerals (02/03/04)
rather than cards, and the palette is one accent (oxide red) on warm paper.

Three reading modes (Day / Dusk / Sepia) are driven entirely by CSS custom
properties on `<html data-mode>`, so the whole page — rules, gauge, form —
rethemes with a smooth transition. Dusk also sets `color-scheme: dark` so
form controls and scrollbars adapt.

## Responsive choices

- Fluid type throughout via `clamp()`; the wordmark, cover title, story
  headlines and the ¥2,400 price all scale with the viewport.
- Desktop: hero is a 7/5 asymmetric split (cover story left, framed issue
  cover right); the three supporting stories sit on a 12-column grid with
  staggered column spans and vertical offsets (6 / 5-offset / 7-offset).
- At 920px everything collapses to a single column in DOM order: cover story,
  then cover panel, then stories 02→04, then archive, then subscribe.
- At 390px the composition holds: the masthead tagline is dropped (it reappears
  in the footer), the archive strip becomes a compact horizontal
  scroll-snap rail with hairline separators, and the subscribe form stacks
  with a full-width button. The email input is 17px to prevent iOS zoom.
- Reading order equals DOM order everywhere; nothing is reordered visually in
  a way that breaks linear reading.

## Accessibility

- Semantic landmarks (`header`, `main`, `section`, `footer`), a skip link,
  and a clean heading hierarchy (h1 wordmark → h2 sections → h3 stories).
- All decorative artwork (waterline gauge, printer's ornament) is inline SVG
  marked `aria-hidden="true" focusable="false"`; its meaning is duplicated in
  adjacent text.
- The reading-mode control is a `role="group"` of buttons with
  `aria-pressed` reflecting state; the choice persists in `localStorage`
  (guarded for private browsing).
- The email field has a programmatic `<label>`, `autocomplete="email"`, inline
  error messages in an `aria-live="polite"` region (cleared on input), and an
  inline success panel that receives focus. Nothing is submitted anywhere.
- Visible `:focus-visible` outlines in the accent color, `prefers-reduced-motion`
  disables all transitions/smooth scrolling, contrast-checked palettes in all
  three reading modes, and `color-scheme` is set per mode.
