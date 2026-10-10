# Margin — Issue 14, "Low Water": design response

Files: `index.html`, `styles.css`, `app.js`. No frameworks, packages, remote assets, external fonts or network requests. The only "image" assets are CSS and inline SVG.

## Art direction

**Idea.** Margin is a journal about overlooked places, and this issue is about a river that has dropped. The page is built on that one image: **the waterline**.

- **The display motif.** The cover title is set in two lines, *Low* and *Water*. A hard vermilion rule cuts through *Water*. Above the rule the letters are solid ink. Below it they are ruled with fine horizontal hatching, like a drowned engraving. It is a clipped background on real text, so the title stays selectable and readable by assistive tech. On load the water drops from high to its resting level (a registered CSS custom property animates; it is off under `prefers-reduced-motion`).
- **The same motif, repeated with restraint.**
  - The fixed **ruler** down the left edge is the page's actual margin: ticks that travel with your scroll, a vermilion margin rule, and a hatched "water" region whose level falls as you read. The waterline in the hero runs out and meets that rule.
  - The archive strip carries small gauges, showing how high the water stood in Issues 11–13, and it visibly keeps dropping toward Issue 14.
  - The subscribe block opens with a hatched band, as the last of the water.
- **Print grammar.** Heavy rules against hairlines. A hanging label column (`01 Cover story`, `About Margin`). Italic serif deck with a drop cap. Mono "slug line" labels. The three supporting stories are a ruled contents list rather than a card grid; on desktop the second and third rows are indented by different amounts, so the column drifts instead of stacking.
- **The cover story's art** is an itemised till receipt for the riverbed (ledger, bottle caps, vanished street plan), drawn as inline SVG with a torn edge and a hard offset shadow. It is a literal reading of "The River Keeps Its Receipts". The receipt lines are illustrative art, not data.
- **Type.** Two families only, both already on the device: a Palatino-style display serif and a Charter-style text serif (with fallbacks), plus the system monospace for labels, prices and receipts. The mono adds a ledger feel and echoes the receipt.
- **Colour.** Warm paper and near-black ink, with a single spot colour used two ways. Vermilion is a thin accent (rules, italic accents, the drop cap) and, once, a full flood for the subscribe block. Nothing is a gradient. The only gradients in the code are hard-stop ruled patterns.
- **What I avoided.** Hero gradients, floating dashboards, pills, fake testimonials, and invented facts. The archive shows only the titles from `COPY.md`, with no invented dates or links. The cover story's call to action points to `#subscribe`, because no story pages exist.

## Content

All required content is present: Issue 14 / Autumn 2026 / *Low Water*; the cover story with Imani Vale; the three supporting stories with the `COPY.md` summaries and bylines; the Issues 11–13 archive strip; and the subscription offer (print + digital, ¥2,400 per issue, cancel anytime), stated three times in different forms so it can't be missed.

## Responsive choices

Mobile-first, one CSS file, three breakpoints (720, 900, 1080) plus a small-phone rule. I checked it at 320, 390, 768, 1024 and 1440.

- **390 px.** The margin ruler shrinks to a 22 px strip with ticks only, so the margin motif survives without eating the column. `Low Water` is fitted to the column: in `app.js`, `fitDisplay()` scales the title so the widest line fills the phone width, and on other screens only ever scales it down so a wider fallback serif can't overflow. The hatch and the waterline both derive from the same font-size and `--wl` variables, so they stay aligned at any scale. The cover story follows the title, then the receipt (pushed right and slightly rotated), then the rest.
- **Reading order = visual order = tab order.** I did not use CSS `order` or absolute positioning to reorder content. The issue metadata is positioned beside *Low* on desktop, but it precedes the `h1` in the DOM on every screen, so the source order is the reading order. The stories become a single column with number, title and a small glyph on one row, then the summary.
- **Tablet (720–1079).** Two columns for cover story and receipt; the story rows become four-column ruled rows.
- **Desktop (≥1080).** A 12-column composition. The metadata hangs in the empty space beside *Low*; the waterline label rides on the rule; the receipt overlaps the hero's lower edge; the cover text sits in columns 3–8 behind a hanging label column. The story rows are staggered.
- **Small details.** `min-height` 40–44 px on all touch targets. The reading-mode control drops to its own row on very narrow screens, or at large text on a phone, instead of overflowing. Verified no horizontal scroll at 320, 390 and 768 px, including in Night and Large text.

## Reading mode and the email field

- **Reading mode** (header): *Paper* / *Night* (native radios, arrow keys work) and an *Aa* Large text toggle (`aria-pressed`). It sets `data-theme` and `data-size` on `<html>`, is announced through a polite live region, and is remembered in `localStorage` (wrapped in try/catch, so the page still works if storage is blocked). With no saved choice it follows `prefers-color-scheme`, which also works without JS via a media query. Without JS the control is hidden rather than left dead. Large text raises the root size to 125%, loosens leading and rewraps everything.
- **Email field**: labelled, `type=email`, `autocomplete=email`, described by a hint and a live feedback region. It validates on blur and then live while you correct it, and on submit. Messages are specific (missing `@`, missing domain, spaces, and so on) and use an icon, a heavy border and text rather than colour alone. Invalid submit puts focus back in the field with `aria-invalid`. A valid submit replaces the form with a success panel that echoes the address (via `textContent`) and takes focus. **Nothing is sent, stored or navigated**, and the page says so. "Use a different email" resets it.

## Accessibility

- Landmarks and headings: skip link, `banner`, `nav`, `main`, `contentinfo`. One `h1` (*Low Water*), `h2` per section, `h3` for supporting stories and the form card. Each section is labelled.
- Contrast, checked numerically for both themes: body ink on paper is 15.8:1 (Paper) and 15.4:1 (Night), secondary text 8.5:1. Small accent text uses a darker accent token (6.0:1); the brighter vermilion is reserved for large type and rules (3.7:1 on paper, above the 3:1 large-text bar). Ink on the vermilion flood is 5.1:1.
- Visible focus everywhere (3 px outline with offset, themed), and 44 px targets on coarse pointers.
- Art: the receipt is `role="img"` with `<title>` and `<desc>`, plus a `figcaption`. The ruler, the glyphs, the archive gauges and the waterline label are purely decorative and are hidden with `aria-hidden`. The hatch is background clipping on real text, so nothing is baked into an image.
- Motion: the only animation is the one-off waterline drop, disabled under `prefers-reduced-motion`; scroll behaviour and hover transitions are switched off too. The ruler moves only because you scroll.
- Forced-colors mode gets a plain-text title (no clipped background) and system-colour selected states. Print hides the chrome and the form.
- Text scales with the browser's font size and zoom (rem-based); the layout holds at 125% root size on a 390 px phone.

## Caveats

- Fonts are whatever the device has, so glyph shapes vary between Palatino, P052 and others. The layout is fit-tested (JS fitting, conservative CSS fallback), but the exact look is the reader's local serif.
- I tested in Chromium (viewport screenshots, keyboard and form flows, reduced motion, system dark, JS disabled). I haven't run Safari or Firefox; the code relies on `background-clip: text`, `@property` and `text-wrap`, each with a fallback, so the worst case in an older browser is the static, still-legible version.
