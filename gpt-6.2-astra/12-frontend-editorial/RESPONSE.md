# Margin · Issue 14

## Art direction

The bends of the exposed river give *Low Water* its cover image. Lines follow the sediment shelves, then break into short marks across the water. The rust-red sun supplies the accent repeated in the masthead and issue details. The night bus, fruiting branch and empty tiled pool each introduce a supporting story in the same print style. All four illustrations are inline SVG.

The issue title pairs upright and italic serif type. Small monospaced issue details, fine rules and an open margin distinguish the cover story from the contents. Local system fonts keep the page self-contained.

## Responsive composition

On wide screens, the two-line title and cover essay share a narrow column beside the river plate. At 390 px, the title fits on one line and the plate sits between it and the essay, following the document order. The three supporting stories stack, the archive becomes a compact list, and the subscription field sits below the offer.

## Accessibility and interaction

A skip link leads to the main content. Headings identify each section and story. The river plate has a short image description, and its caption remains ordinary text. Decorative story illustrations and printer’s marks are hidden from assistive technology.

Reading mode switches to a dark paper color and increases the size and line spacing of the summaries. Its button exposes the setting through `aria-pressed` and remembers it locally when browser storage is available. Links, buttons and the email field have visible keyboard focus.

The subscription preview accepts an email through the button or Enter. An empty or malformed address receives an inline explanation and focus returns to the field. A valid address receives an inline confirmation. The feedback is announced through a polite live region. The email stays in the field and is never stored or sent.

## Local preview

Open `index.html` in a browser. The page uses the adjacent `styles.css` and `app.js` files and requires no build step.
