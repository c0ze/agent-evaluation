# Margin — Issue 14: Low Water — design response

## Art direction

Contemporary print editorial, not a SaaS landing page. The page is set like a
journal cover that happens to scroll: a ruled masthead with the wordmark set
large in a serif stack, thin and thick rules doing the structural work that
cards and shadows do elsewhere, and generous white space left deliberately
empty. There are no gradients, no dashboard mockups, no pills, and no
testimonials.

One strong display motif carries the issue: the riverbed contour survey in
the hero — five hand-plotted contour lines falling toward a vertical water
gauge whose low mark is picked out in clay red and labelled "LOW · 2026".
It is drawn as inline SVG, so it stays crisp at any width and prints cleanly.
Colour is restrained print colour: near-black ink on white paper, a deep
river teal for links and the subscribe action, and a single clay accent for
the issue line, story kickers, and the gauge's low-water mark. Type does the
hierarchy work — an oversized "Low Water" cover line, a mid-scale cover
headline, and small sans-serif furniture (dates, page numbers, labels) set
apart from the serif text column. Asymmetry is structural: the cover story
runs seven columns against a four-column field-notes margin, and the three
supporting stories are staggered across a twelve-column grid rather than
poured into identical cards.

## Responsive choices

Reading order is document order at every width: masthead, issue hero, cover
story, contents, archive strip, subscription, footer. Nothing is reordered
with visual-only tricks, so keyboard, screen-reader, and visual order agree.

On desktop the grids above give the editorial stagger. Below 760px every
grid collapses to a single column in that same order, the tagline drops out
to give the wordmark room, and the reading-mode toggle becomes a full-width
control so it stays tappable. At 390px — the target handset width — the cover
line still sets at roughly 63px, body text stays at 17px with a 1.65
line-height, the issue-facts table becomes two columns, and the archive
turns into a ruled vertical list. Headline sizes use `clamp()` throughout,
so there are no breakpoint jumps. The masthead navigation scrolls
horizontally on narrow screens instead of wrapping into a tangle.

## Accessibility

- Semantic landmarks throughout (`header`, `nav`, `main`, `article`,
  `section` with `aria-labelledby`, `footer`), a skip link, and exactly one
  `h1`. Headings nest without skipping levels.
- The contour artwork is inline SVG with `role="img"`, a `<title>` and
  `<desc>`, plus a visible `figcaption` that states in words what the
  drawing shows. No information exists only in the picture. Purely
  decorative marks are `aria-hidden`.
- Reading mode is a real control, not a theme swatch: a toggle button with
  `aria-pressed` and a visually hidden description. It enlarges type,
  widens line-height, narrows the measure to about 62 characters, collapses
  the staggered grids to a single column, and fades the motif back. The
  choice persists in `localStorage` and respects
  `prefers-reduced-motion` for scrolling.
- The subscribe form uses a native `type="email"` input with a persistent
  `<label>`, hint text wired through `aria-describedby`, and feedback in an
  `aria-live="polite"` region. Invalid input sets `aria-invalid` and explains
  the fix in plain language; a valid address gets an explicit success message
  naming the offer (print + digital, ¥2,400 per issue, cancel anytime). The
  form never submits — JavaScript prevents the default and validates locally.
- Focus is always visible (3px outline), body text is near-black on white,
  and the teal and clay accents are used for large or bold text and rules,
  never as faint body copy. No external fonts, images, or network requests:
  system serif and sans stacks only, so the page works fully offline.
