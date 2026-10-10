# Margin — Issue 14 landing page

## Art direction

**Editorial cartography:** a contemporary print journal rendered with the marks
of a field notebook. The warm paper, double rules, serif display type, and small
monospaced labels establish a quiet publishing voice. A winding river drawn over
contour and ledger lines is the visual anchor: it makes “Low Water” recognizable
without relying on a stock photograph or a generic hero treatment. Rust survey
points carry the accent color through the page.

The conceptual references are marginalia, civic field records, and sediment
layers. The asymmetrical issue spread lets the hand-drawn map and large title
carry the first screen; the story rows and archive then read like a contents page.
The subscription offer closes the page as a clear, practical invitation.

## Design system snapshot

- **Type:** local Baskerville/Palatino/Georgia serif fallbacks for display,
  Charter/Iowan Old Style/Palatino for reading, and a local monospace stack for
  labels. No font files or remote font services are used.
- **Palette:** warm paper and deep green-black, with river green and a restrained
  rust accent. CSS custom properties keep the palette consistent.
- **Composition:** wide, asymmetric issue spread on desktop; narrow, single
  column flow on mobile, with the cover map before the issue copy.
- **Motion:** quiet hover and reading-toggle transitions only; reduced-motion
  preferences disable smooth scrolling and transitions.
- **DFII:** impact 5 + fit 5 + feasibility 5 + performance 5 − consistency risk
  3 = **17/20 raw, capped at 15** (strong fit with modest art-direction upkeep).

## Responsive choices

At wider widths the cover artwork and issue copy sit side by side, followed by
an offset contents list and a compact archive band. Below 680 px the issue
becomes one column, story summaries follow their titles, and the subscription
offer stacks under its heading. At very narrow widths the archive changes from
three columns to a short list, and the email button fills the available width.
The mobile DOM order follows the reading sequence directly; there is no
visual-only reordering.

Reading mode is a local toggle. It removes the cover illustration, widens the
reading area, increases body text slightly, and exposes its state with
`aria-pressed`. The email control validates locally, announces feedback inline,
and explicitly reports that it sent and stored nothing.

## Accessibility and implementation

The page uses landmarks, a skip link, ordered headings, visible keyboard focus,
explicit input labeling, descriptive status feedback, and responsive text
without fixed-height content. The inline SVG has a title and description for
assistive technology. Color is not the sole way to identify controls or errors.

All artwork is inline SVG, and the implementation uses only `index.html`,
`styles.css`, and `app.js`; it has no framework, package install, remote asset,
external font, or network request.

## Differentiation

This avoids a generic magazine template by turning the river’s layered civic
record into the cover illustration and organizing the page like a printed
issue: masthead, cover, contents, archive, then subscription.
