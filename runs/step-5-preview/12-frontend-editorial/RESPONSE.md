# Margin — Issue 14 (design response)

A landing page for an independent quarterly about overlooked places, built as
plain local HTML, CSS, and JavaScript. No frameworks, no package installs, no
remote assets, no external fonts, no network requests of any kind.

## Art direction

**Print logic, not web conventions.** The page is built the way a journal spread
is built: a centred masthead with a rule system, an asymmetric cover, a contents
list, an archive index, and a colophon. Structure comes from whitespace, hairline
rules, and type contrast rather than boxes, cards, shadows, or gradients. There
are no rounded pill buttons, no hero illustration, no dashboard mockup, and no
testimonials.

**Typography.** Because external fonts are off-limits, the page leans on stacks
that are already on the machine and uses scale, weight, and tracking to build
personality:

- Display and body: a high-contrast old-style serif stack
  (`Georgia, "Iowan Old Style", "Times New Roman", …`) — Georgia's large x-height
  and sturdy italics carry the editorial voice.
- Labels, navigation, and form furniture:
  `system-ui / -apple-system / Segoe UI / …` set in uppercase with wide
  tracking (0.14–0.3em), the standard journal convention for standing heads.
- Numerals and levels: a monospace stack (`ui-monospace, SFMono-Regular, Menlo,
  …`) used for issue numbers, gauge values, and prices, which reads as
  "data printed by the type house" and contrasts with the serif.

Type is fluid throughout — `clamp()` drives the wordmark, cover headline, story
titles, and the price — so nothing needs a breakpoint just to fit.

**The display motif: a receding waterline.** One motif carries the issue's
subject, "Low Water": the river-level gauge under the cover. Five ruled marks
step down from 1931 (5.9 m) to 2026, where the remaining water is a thin accent
wash. It is built from CSS custom properties (`--level`) positioning each
hairline, so it is a real responsive element, not an image, and it turns the
cover's subject matter into the page's organising graphic. Supporting marks are
kept quiet — a drop cap on the lede, a left-ruled pull quote, a mono section
note, and a 3px double rule framing the masthead and footer — so the gauge stays
the single loud element.

**The cover artwork** is inline SVG: contour lines of a receding river, a dashed
street plan, two bottle caps, and a ledger column — the objects from the cover
essay. It is drawn in `currentColor`, so it re-inks itself in dark mode, scales
to any width, and adds no requests.

**Palette.** Warm paper `#f5f1e7`, near-black ink `#17140f`, and one oxblood
accent `#8a2b1f` used sparingly (kickers, numbers, the pull-quote rule, the
lowest gauge mark). Dark mode inverts the values rather than dimming them:
`#14130f` paper, `#efe8d8` ink, accent lifted to `#e5836d` to keep contrast.

## Responsive choices

Mobile-first, with three real thresholds:

- **Base (320–639px).** One column, generous vertical rhythm, cover elements in
  reading order: kicker → headline → byline → editor's note → lede → pull quote →
  artwork → gauge → contents → archive → subscribe → colophon. The nav and the
  masthead meta bar wrap rather than collapse, and nothing is hidden from small
  screens except the right-hand issue stamp, which repeats in the footer.
- **≥40rem.** The footer becomes three columns; the archive rows switch from
  stacked to a single line with a fixed label gutter.
- **≥60rem.** The cover becomes a 1.55fr / 1fr split with the right column
  pushed down (`padding-top`) so the lede, pull quote, and artwork sit off-axis
  against the headline — the asymmetry that keeps the page from reading like a
  template. Contents move to a 12-column grid where story 02 occupies columns
  1–5, story 03 is dropped down at columns 7–12, and story 04 runs wide at
  3–11 with an internal two-column head; the offer splits into copy and form.

Details worth noting:

- The clamp on the cover headline is stepped down at ≥60rem (from 9.5vw to
  6.2vw) because the headline then lives in a narrower column — without it the
  two-line break "The River Keeps / Its Receipts" collapsed to three lines
  between 960 and 1100px. Verified at 320, 360, 390, 430, 480, 540, 600, 768,
  900, 960, 1100, 1280, 1440, and 1920px: the headline holds its two-line break
  at every width from 360px up and no element overflows its container.
- At 390px the gauge stays five columns (≈61px each) with mono labels at 10–12px;
  it compresses instead of rotating or hiding, so the motif survives on mobile.
- The email form is the only interactive region that gets a filled surface; it
  is bordered by a hairline rather than dropped into a card with a shadow.

## Accessibility

- **Landmarks and order.** Skip link to `#main`, one `h1` (the wordmark), `h2`
  per section, `h3` per story, `nav`/`main`/`footer` landmarks, and a contents
  `nav` labelled for its purpose.
- **Reading mode.** A real toggle, not a theme switch: `aria-pressed` on the
  button, an on/off state in mono, and the choice persisted in `localStorage`
  (wrapped in try/catch for private-mode failures). Reading mode enlarges body
  and lede type, opens the leading to 1.75, constrains the column to ~42rem,
  turns off the inter-section rules, and removes ornament (artwork, gauge, pull
  quote, section notes) so only the words remain. Nothing is removed from the
  accessibility tree.
- **Email field.** Inline validation with no submission: an empty or malformed
  address produces an accent-coloured message via a `role="status"` live region,
  sets `aria-invalid="true"`, and returns focus to the field on failed submit; a
  valid address produces a success message. The input is labelled, has a hint
  via `aria-describedby`, `inputmode="email"`, and `autocomplete="email"`. The
  fine print states plainly that nothing is submitted and no charge is made.
- **Decorative artwork.** The cover figure is `role="img"` with `<title>` and
  `<desc>` and a visible `figcaption`; the gauge is `aria-hidden` because its
  meaning ("Low water") is already carried in text.
- **Contrast.** Text tokens are mixed against their actual backgrounds: body ink
  16.3:1, soft ink 6.9:1, faint ink 4.9:1, accent 7.6:1 on paper; in dark mode
  15.2:1, 7.1:1, 5.3:1, and 6.9:1. The accent-on-paper values were chosen to
  clear 4.5:1 even where they are used at 11px.
- **Motion.** Reveal-on-scroll is applied only when `IntersectionObserver` is
  available and `prefers-reduced-motion` is not set, elements are revealed once
  and unobserved, and the reduced-motion query also neutralises transitions and
  scroll behaviour. Content is never invisible without JS.
- **Keyboard and focus.** Every control is a native element; `:focus-visible`
  outlines use the accent at a 3px offset; the skip link animates into view on
  focus.

## Files

- `index.html` — structure and copy (Issue 14, *Low Water*, Autumn 2026)
- `styles.css` — tokens, layout, print-style rule system, dark mode, reading mode
- `app.js` — reading-mode toggle with persistence, inline email validation,
  reduced-motion-aware reveal
