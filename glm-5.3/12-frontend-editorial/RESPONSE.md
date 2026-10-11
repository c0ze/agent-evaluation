# RESPONSE.md — Margin, Issue 14 “Low Water”

## Art direction

The design translates the grammar of a printed journal — masthead, contents
page with dot leaders, cover story with a drop cap, back-numbers strip,
colophon footer — to a single scrolling page, rather than dressing up a
landing-page template.

**One display motif: the gauge.** The whole issue is about a river in
drought, so the page is built around measured lines. The hero is an inline
SVG of a riverbed cross-section: seven contour lines sag toward a dashed
low-water mark in oxide red, with a depth axis in −2 m steps and little
finds (bottle caps, survey crosses, the dashed outline of a vanished
street plan) scattered on the exposed bed. The same idea returns as the
section dividers — a short ruled tag over a hatched ruler — and once more
as a rust ledger line pinned to the far left of very wide viewports, like
the red margin of a notebook. A huge pale “14” sits behind the
subscription block the way a folio number bleeds off a page.

**Typography.** System serif (Georgia/Iowan/Palatino stack) for voice,
system monospace for everything that is “apparatus” — kickers, bylines,
archive numbers, prices, buttons. No web fonts, no network. Type scale is
led by `clamp()`, and the two most print-like details are the justified,
hyphenated cover lede with a river-green drop cap, and the italic pull
quote hung off the right edge of the story.

**Composition.** Asymmetric, not gridded-into-sameness: the cover story
uses a 12-column grid where the headline starts at column 1, the lede
indents to column 3, and the pull quote hangs alone at columns 10–12; the
three supporting entries step down the page with increasing indents, like
entries slipping downstream; the subscription section pairs a wide
argument (with a definition-list price table) against a hairline-ruled
form. Rules do the work that boxes usually do: 4 pt double rules at the
masthead and footer, single hairlines between stories, dotted leaders in
the contents.

**Color.** A warm paper ground (`#F6F1E7`), near-black ink, one river
green for accents, one oxide red for the low-water mark and out-of-print
statuses. No gradients.

## Responsive choices

- **Mobile-first single column** (390 px verified in headless Chrome:
  `scrollWidth == clientWidth == 390`, no horizontal overflow). Reading
  order at 390 px is the intended narrative order — masthead, issue title,
  contents, cover story, three dispatches, archive, subscription, footer —
  confirmed programmatically by checking that anchor positions are
  monotonically increasing.
- **720 px:** the masthead becomes a spread (wordmark left, tagline
  right), stories become a three-part row (number / heading / summary)
  with dot-leader alignment, and the archive becomes a three-column strip.
- **880 px:** the hero splits into type and drawing; the cover story
  adopts its asymmetric 12-column composition; the subscription section
  splits with a hairline-ruled form column; stories take their stepped
  indents.
- **1180 px+:** the rust ledger line appears in the left margin, only
  once there is room to spare.
- Spacing is driven by `--gap: clamp(4.5rem … 8rem)`, so section rhythm
  scales with viewport instead of jumping.
- **Reading mode** (the toggle in the masthead) raises the base size from
  17 px to 20 px, loosens leading from 1.65 to 1.9, widens the measure,
  dims the drawing, and caps paragraph widths — and the choice persists
  in `localStorage` (with a safe fallback if storage is unavailable).
  Text remains the same size in both modes relative to each other, only
  the apparatus (mono labels) is untouched.

## Accessibility

- **Semantics first:** one `h1`, logical `h2`/`h3` outline; `nav` around
  the contents; real `form`, `label`, and `button` elements; `dl` for the
  price terms.
- **The hero SVG is accessible:** `role="img"` with a `<title>` and a
  long `<desc>` describing the contours, the gauge, and the finds, so
  screen-reader users get the same image the sighted reader does.
  `focusable="false"` keeps it out of the tab order.
- **Reading-mode control** is a real `button` with `aria-pressed` state
  and a visually hidden `role="status"` region that announces the change;
  the label text also updates (“Reading mode · on”).
- **Form feedback is inline and announced:** the feedback paragraph is
  `role="status" aria-live="polite"`; invalid states set `aria-invalid`
  on the field and are announced politely; the input has
  `autocomplete="email"` and `inputmode="email"`; success locks the form
  and changes the button to “Reserved”. Nothing is submitted anywhere —
  validation and success are entirely local.
- **Keyboard:** a skip link to `#main`, visible `:focus-visible` outlines,
  and in-page anchors with `scroll-margin-top`. Smooth scrolling is
  disabled automatically under `prefers-reduced-motion`.
- **Motion:** reveals are opt-in via a `.js` class and use
  IntersectionObserver with a timeout fallback; everything is shown
  immediately if the user prefers reduced motion or if the observer
  never fires. Decorative artwork is static (no animation).
- **Contrast:** ink on paper is well above 7:1; the muted mono labels
  (`#5B5346` on `#F6F1E7`) sit at ≈5.4:1; the rust accents are used only
  for large or bold marks; both toggle states keep at least 4.5:1.
- **Print:** artwork, the toggle, and the form drop out; text prints at
  full opacity.

## Verification

`app.js` passes `node --check`. The page was exercised in headless
Chrome with a temporary harness: no horizontal overflow at 390 px,
monotonic reading order, reading mode on/off state changes, empty/invalid
submissions produce inline errors, a valid address produces the success
message with the address echoed and the form locked, and all nine reveal
targets become visible via the fallback timer. The harness and all
screenshot files were removed afterward — the directory contains only
`index.html`, `styles.css`, `app.js`, `RESPONSE.md`, plus the given
`TASK.md` and `COPY.md`.
