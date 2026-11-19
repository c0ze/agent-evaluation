# Response — Margin, Issue 14: *Low Water*

## Art direction

The page is treated as a printed object: a running head above a large serif
masthead, numbered sections (`01 / 02 / 03`), hairline rules, generous margins,
and a single-column measure for body copy. The palette is warm newsprint
(`#efece3`) with near-black ink and one accent — a dried-rust red
(`#b3401f`) used only for emphasis: the display period, the low-water line,
section numerals, and the price. Nothing is a gradient hero, a floating UI
mockup, or a pill; the layout relies on type, rules, and whitespace.

**The display motif** is an inline-SVG "survey plate": a measured diagram of a
drought-exposed riverbed. Two dashed former high-water marks (1998, 2011) sit
above a red 2026 low-water line; below it, halftone water gives way to sediment
strata, a faint vanished street grid, and the objects the cover story describes
— a shop ledger, bottle caps, loose debris. A depth gauge, scale bar, and
printer's crop marks make it read as a plate from the journal rather than a
stock illustration. It is drawn entirely with CSS `currentColor`-driven strokes
so it recolors coherently with reading mode and remains crisp at any size.

The cover is asymmetric (text column vs. figure), and the "In this issue"
section uses an off-balance grid: the lead story occupies the full height of the
left column while two shorter dispatches stack on the right. The archive is a
dark ink plate to punctuate the reading rhythm, and the subscription offer is
set as a typographic statement rather than a pricing-card grid.

## Responsive choices

- Fluid type via `clamp()` and a `--gutter` token; layout spans up to an
  `86rem` page max and stays readable at any width.
- Breakpoints at **900 px** (cover stacks, the story grid simplifies, archive
  becomes a list, subscription stacks), **640 px** (single-column stories,
  running head wraps, footer stacks, full-width submit button), and a **400 px**
  refinement that tightens the gutter and display type for a 390 px viewport.
- On small screens the plate shrinks to a legible `min(100%, 34rem)` and is
  centered; the cover title drops to `18vw`-driven sizing so "Low Water." still
  breaks deliberately without overflowing.
- **Reading order** is source order throughout: masthead → cover (kicker,
  title, deck, cover story, subscribe link) → figure → in-this-issue → archive
  → subscribe → colophon. CSS grid only changes visual placement; no `order`
  tricks are used, so screen-reader and keyboard order match the visual
  hierarchy. On the cover, the figure follows the text in the DOM even though it
  sits beside it on desktop.

## Accessibility

- Semantic landmarks (`header`, `main`, `section` with `aria-labelledby`,
  `footer`), one `h1`, ordered `h2`/`h3` levels, a real `<ol>` for the archive,
  and `<article>`/`<figure>`/`<figcaption>` for stories and the plate.
- The SVG carries `role="img"` with a `<title>` and a descriptive `<desc>` that
  conveys the same information as the diagram (former water marks, the 2026
  low-water line, recovered objects). Decorative SVG parts are hidden from the
  accessibility tree via the figure's single label, and the icon in the toggle
  is `aria-hidden`.
- **Reading mode** is a real `aria-pressed` toggle: it changes paper/ink
  tokens, enlarges body type, and shortens the measure. The state persists in
  `localStorage` (wrapped in `try/catch` so `file://`/private mode still works),
  and the visible "On/Off" state is mirrored for sighted users.
- **Email field** uses `type="email"`, `autocomplete="email"`, a real `<label>`,
  `aria-describedby` pointing at both hint and status, and `aria-live="polite"`
  on the status region. Errors set `aria-invalid="true"`, describe the problem
  inline, and move focus back to the field; success is announced without any
  submission. The form is `novalidate` so the custom messages are consistent,
  and it calls `preventDefault()` — nothing is sent or stored.
- A skip link, visible `:focus-visible` outlines on all controls, a
  minimum ~0.72rem for micro-type, `prefers-reduced-motion` handling, and a
  print stylesheet are included. Contrast is kept high in both themes (the dark
  archive plate uses light text; archive numerals and labels use accessible
  tints of the ink plate).
- The whole page is local HTML/CSS/JS with no frameworks, fonts, remote assets,
  or network requests.

## Deliverables

`index.html`, `styles.css`, `app.js`, `RESPONSE.md` — all created in this
directory only.
