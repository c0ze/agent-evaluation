# Response — Margin, Issue 14

## Art direction

The page is built as a field survey of a disappearing river, not as a product
page. Three materials carry the design: warm uncoated paper (`#f2ecdf`), black
ink (`#191713`), and an oxide red (`#9c3d25`) borrowed from tide-stain lines.
The palette is deliberately limited, and the only blue-green on the page is the
deep water colour of the subscription band.

The display motif is a **staff gauge** — the numbered measuring column at the
right of the masthead, marked at −2.1 m with a tinted low-water segment and a
thin oxide line. It recurs as the ruled waterline beneath the hero and as the
hairline rules that divide the stories and archive. The cover story is
represented by a **paper receipt** from the riverbed survey: sawtooth bottom,
dot-matrix rules, barcode, and a rubber stamp. It is drawn entirely in HTML and
CSS (clip-path, gradients, transforms), so it scales cleanly and adds no
requests.

Typography does the rest: a high-contrast system serif for display and reading,
a grotesque for small uppercase labels and metadata, and a monospace for the
receipt. The masthead is set very large with tight tracking and a line of white
space between “Low” and “Water”; the rest of the page uses a strict
hairline/grid system, small numbered story entries, and asymmetric columns
rather than cards. The result reads like a printed quarterly with a strong
opening spread.

## Responsive choices

- **1440 px and above:** the masthead runs nearly full measure, the gauge sits
  in the outer margin, and the cover story and receipt form an asymmetric
  two-column spread. Artifact and caption are right-aligned to the page edge.
- **1024 px:** the gauge remains, the receipt shrinks, and the story list keeps
  its four-column editorial grid.
- **920 px:** the gauge is removed (it needs marginal space to read), and the
  hero becomes a single column. The receipt follows the cover copy at a
  comfortable width and retains a slight 1.2° paper tilt.
- **768 px:** the primary navigation moves to the footer; the reading-mode
  control stays in the header. Stories use a compact number/title/motif layout.
- **390 px:** type is fluid down to a 73 px display size, the receipt goes
  full-width, the waterline labels stack, story motifs are removed to protect
  the reading measure, the offer rows stack, and the form button becomes
  full-width. The reading order remains masthead → issue title → cover story →
  receipt → supporting stories → archive → subscription → footer.

No fixed-height panels are used, so text can wrap freely in all three font
stacks. The layout was checked at 1440, 1024, 768, and 390 px.

## Interaction

- **Reading mode** is a real toggle, not a visual prop. It sets
  `aria-pressed`, updates its accessible name, hides the gauge, receipt and
  story motifs, narrows the measure to 42 rem, and increases reading text.
  The choice is stored in `localStorage` (guarded by `try/catch`) so it
  survives a reload. A polite live region announces the state change.
- **Email field** validates on submit only: empty and malformed addresses get
  distinct inline messages, `aria-invalid="true"`, and focus returns to the
  field; a valid address gets a success message and the form clears. Errors
  clear as the user types. The form has no `action`, the submit handler calls
  `preventDefault()`, and no network request is made.

## Accessibility

- Landmarks and headings: `header`, primary `nav`, `main`, one `h1`, section
  `h2`s, story `h3`s, and a footer. A skip link precedes the header.
- The receipt is exposed as `role="img"` with a full text description; the
  gauge, barcode, stamp, and three story SVGs are `aria-hidden`. The waterline
  caption remains available as text because it carries information.
- All controls are native `button`/`input` elements with visible labels.
  Focus rings are customised for the dark subscription band so they do not
  disappear into the background.
- Contrast: oxide on paper is 5.74:1, body ink-soft on paper is 8.19:1, paper
  on the water band is 12.49:1, and muted text on the dark band is at least
  4.8:1. The receipt text is dark on near-white.
- Motion is limited to hover transforms and the skip-link slide; both are
  neutralised under `prefers-reduced-motion`. No autoplaying motion or
  animation is present.
- The page uses no external fonts, images, scripts, analytics, or network
  requests. Decorative art is CSS or inline SVG, including the favicon.

## Files

- `index.html` — structure and inline SVG motifs
- `styles.css` — art direction, grid, responsive rules, reading mode
- `app.js` — reading-mode toggle and form feedback
