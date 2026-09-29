# Margin — Issue 14, *Low Water*

A landing page for an independent quarterly about overlooked places, built with
three local files (`index.html`, `styles.css`, `app.js`). No frameworks, no
packages, no remote assets, no web fonts, no network requests. Everything
decorative is CSS or inline SVG.

## Art direction

**The premise.** A print journal called *Margin* should look like it was set by
someone who cares about margins. The page borrows the furniture of a printed
issue — a running head, a masthead, folios, section numbers, a double rule
(thick line over hairline), a caption with a figure number, a colophon — and
uses whitespace and asymmetry instead of boxes and gradients to organise it.
Nothing is a card; nothing is a pill. Colour is one warm paper, one ink, and a
single rust accent that reads as dried riverbed and stamped receipt at once.

**Typography.** The page is set entirely in the reader's own system fonts, with
two voices: a serif for everything that is read (the stack prefers Iowan Old
Style / Palatino and falls back to Georgia), and a small uppercase monospace for
everything that is *marginalia* — running heads, kickers, section numbers,
captions, form labels, the reading-mode control. Old-style numerals are on for
body text and lining numerals for labels and prices, so "¥2,400" and "Issue 14"
sit level in a line of capitals. The wordmark is set enormous and tight
(`clamp(4.25rem, 19.5vw, 17rem)`, −0.045em tracking) with the issue number
beside it as an outlined "14" — a display typographic device, not an image.
The cover deck opens with a drop cap.

**The one display motif: the receding shoreline.** The cover artwork is an
inline SVG of nine nested, irregular contour lines — the high-water marks a
reservoir leaves as it dries — closing on a small remaining pool at the lower
right, tinted with the accent. The older the line, the fainter it is drawn
(opacity is computed per ring from a CSS custom property). In the exposed bed
are the cover story's "receipts": bottle caps and ledgers as small circles and
rectangles, and a dashed street grid for the vanished plan, clipped to the bed.
Four lines carry years. The rings were generated from a low-frequency noise
function so they nest like real contours rather than concentric ellipses. On
load they draw themselves in sequence (`pathLength="1"` + `stroke-dashoffset`),
old to new. The motif is echoed structurally rather than repeated literally:
hairline and double rules run through every section, the three supporting
stories are staggered like a contact sheet with a hairline between columns, and
the archive is a row of narrow book spines on a shelf (a 3px rule) with vertical
titles, rather than thumbnails.

**Content.** Issue 14, *Low Water*, Autumn 2026. Cover story "The River Keeps
Its Receipts" by Imani Vale (No. 01); "Night Bus Atlas", "Concrete Orchards"
and "A Language for Empty Pools" (Nos. 02–04) using the summaries from
`COPY.md`; an archive strip for Issues 13, 12 and 11 with their titles; a
subscription offer — print + digital, ¥2,400 per issue, cancel anytime. There
are no testimonials, no invented quotes, no fake statistics.

## Responsive choices

The layout is a single column by default and gains asymmetry with width.

- **Under 720px (including 390px).** One column throughout. The masthead
  stacks wordmark, then the "14 / Low Water / Autumn 2026" mark, then a bar
  with the section navigation and the reading-mode control (both wrap). The
  wordmark scales at `21vw` at 390px so "Margin" fits comfortably inside the
  16px gutters with room to spare. The cover section reads kicker → title →
  byline → deck → note → link → artwork → caption, so the reader reaches the
  story before the picture; the artwork then takes full width. The three
  stories stack with a hairline between each and a two-column folio grid (the
  number sits in a narrow left column, like a margin note). The three spines
  sit side by side at 5.2rem each (about 250px in total), which still fits at
  390px, and the offer and form stack with each carrying its own double rule.
- **720px – 959px.** The stories become three columns separated by hairlines
  and staggered down the page; section heads become a three-column row
  (number / title / aside); the subscription splits into offer and form.
- **960px and up.** The cover becomes a twelve-column grid: text in columns
  1–5 and artwork in columns 7–12, the picture pushed down so it hangs below
  the title — the composition is deliberately unbalanced. From 1200px the text
  moves to columns 2–6 and the picture to 8–12, leaving a genuinely empty
  margin column on the left and a gap column between the two. The archive becomes head-left, shelf-right, aligned
  on the shelf line; the subscription becomes a 5/1/6 split with an empty
  gutter column.

DOM order is the reading order at every width: no `order` properties are used,
so keyboard focus, screen-reader flow and the visual layout always agree.
Fluid type uses `clamp()` throughout; body text is capped at a sensible measure.

## Interaction

- **Reading mode.** A native radio group (`fieldset` + `legend`, "Paper /
  Dusk / Night") styled as an inline segmented text control with an underline
  on the selected item. Arrow keys move between options; the visually hidden
  inputs keep their focus ring on the visible label. The choice is applied as
  `data-mode` on `<html>` and remembered in `localStorage` (wrapped in
  `try`/`catch`, so private windows and blocked storage simply fall back). With
  no stored choice, the page follows `prefers-color-scheme` — via CSS alone if
  JavaScript is unavailable, and live if the system scheme changes. A short
  inline script in `<head>` restores the stored mode before first paint so
  Night never flashes Paper. Changes are announced through a polite live region
  and the `theme-color` meta is updated for the browser chrome.
- **Email field.** A real `<form>` with `novalidate`; `app.js` validates the
  address on submit and on leaving a filled field, and clears the error as soon
  as the address becomes valid. Errors set `aria-invalid`, colour the rule and
  the text, and are written into a polite live region tied to the input via
  `aria-describedby`. Success replaces the field with a message (assembled from
  text nodes, so the address can never be interpreted as markup), moves focus
  to it, and offers "Use a different address" to start again. Nothing is sent
  or stored, and the copy says so.
- **Section marker.** An `IntersectionObserver` sets `aria-current="location"`
  on the navigation link for the section under the reader. It is an
  enhancement: the links are ordinary anchors without it.

## Accessibility

- Landmarks: `header`, `nav` (labelled), `main`, four `section`s each
  labelled by its heading, `footer`. A skip link is the first focusable element.
  Heading order is `h1` (wordmark) → `h2` per section → `h3` per story.
- The artwork is an SVG with `role="img"`, a `<title>` and a `<desc>` that
  describe what is drawn; the caption adds context. The outlined "14" is
  `aria-hidden` and the text beside it says "Issue fourteen".
- Lists carry explicit `role="list"` because `list-style: none` makes some
  browsers drop list semantics. Story folios stay in the accessibility tree so
  the numbering the sighted reader sees is the numbering everyone hears.
- Colour contrast was checked for each mode: body ink on paper is above 15:1;
  the rust accent as text is 5.6:1 on Paper, 5.4:1 on Dusk and 7.2:1 on Night;
  secondary text is above 5.5:1 everywhere. Focus is always visible: a 2px
  ink outline with a 3–4px offset on every interactive element, including the
  email input (its rule also thickens and turns rust on `focus-within`).
- `prefers-reduced-motion` switches off the drawing animation, hover
  transitions and smooth scrolling; the contours render fully drawn.
- `color-scheme` is declared per mode so native form controls and scrollbars
  match. Text zoom and reflow work because sizes are `rem`/`em` and `clamp()`;
  nothing is fixed-height except the decorative spines. A print stylesheet
  removes the controls and forces black ink on white.
