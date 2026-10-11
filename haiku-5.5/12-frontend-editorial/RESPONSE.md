# Margin, Issue 14 landing page: notes

Files: `index.html`, `styles.css`, `app.js`. No frameworks, packages, remote fonts, images, or network requests. Everything is HTML, CSS, inline SVG, and one small script.

## Art direction

The page is set like the opening spread of a print quarterly rather than a web template. The palette is newsprint (`#f2ede2`), ink (`#1d1b18`), and one rust accent (`#9b4a1f`), used only for the waterline, story numbers, and error states. Type comes from local stacks: a serif (Charter, then Georgia) for display and reading, and a sans (Helvetica, then Arial) for labels, bylines, and navigation, which is how print usually separates running text from metadata.

The one display motif is the **waterline**. The issue title, "Low Water", is filled with ink above a knocked-out hairline and rust below, so the title is itself cut by a tide line. On load the line drops from 58% to 74% of the title height, which reads as water receding. The same rust line runs through the cover art, and nothing else in the page repeats the effect.

The cover art is inline SVG and decorative: twenty-four wave lines compressed toward the bed of a riverbed, a vertical margin rule (a nod to the name), a rotated ledger slip for the "receipts", a bottle cap, and a dashed street plan. These are the objects named in the cover-story summary.

Composition is deliberately asymmetric. On wide screens the title spans eight of twelve columns and the art fills the remaining four, top-aligned with the title. The cover story indents its body to start at the fourth column. The three supporting stories stagger: the lead runs wide on the left, the second drops 7rem below the first on the right, and the third steps in from the left. The subscription offer is the only inverted block. It is laid out as a rate card with rules rather than boxes. There are no pills, no hero gradients, no dashboard mockups, and no testimonials.

## Responsive choices

- **Reading order is the DOM order.** Masthead, issue title, deck, art, cover story, stories, subscription, archive, footer. No CSS reordering is used, so a screen reader or a 390 px phone reads the page in the same order as the source.
- **390 px is the base case.** The layout is a single column first, and the 12-column grid begins at 900 px. The title is fluid (`clamp(4.75rem, 28vw, 15.5rem)`), so "Water" fills most of the column at 390 px without wrapping.
- **Art on small screens** is 78% of the column and pushed to the right, which keeps the asymmetry instead of centring a full-width image.
- **Masthead** is two rows below 760 px (brand and reading toggle, then navigation) and one row above it.
- **Offer and form** use a fixed label column for the offer rows. The email field and button share a row that wraps the button under the input on narrow screens.
- **Measure and gutters** use `rem` and `clamp()`. Body text is about 17 px and never sets a fixed pixel size, so browser zoom and system text size scale everything. Widths are relative (percentages, `min()`, `clamp()`), so no large block has a fixed width that could overflow a narrow screen.

## Reading mode

The "Reading mode" control is a button with `aria-pressed`, and it shows a filled track when on. Turning it on sets a class on `<html>` that raises body text to about 21 px, increases leading to 1.75, narrows the measure to 34em, darkens secondary text, and dims the cover art to 40%. The choice is kept in `localStorage` (with a fallback if storage is blocked) and announced through a polite live region.

## Subscription and email field

- The offer states the three facts from the brief: print + digital, ¥2,400 per issue, cancel anytime. Nothing else about pricing is implied.
- The email field has a real `<label>`, `type="email"`, `autocomplete="email"`, and `required`. The form uses `novalidate` so the messages are the page's own.
- Validation runs when the field loses focus with a value in it, and again on every keystroke while an error is showing, so the message clears as soon as the address is valid. After the first submit, an empty field is checked too.
- Errors are announced through `role="alert"`, linked with `aria-describedby`, and mark the input with `aria-invalid="true"`. On a failed submit, focus moves to the field.
- Success is announced through `role="status"`. The message says plainly that the preview sends no email, so nothing has been submitted.
- The submit handler calls `preventDefault()` and makes no request. Wiring up a real endpoint means replacing the body of the `submit` listener in `app.js`.

## Accessibility

- A skip link leads to `main`. The page has `header`, a labelled `nav`, `main`, and `footer` landmarks, and a single `h1` with a clear `h2` and `h3` hierarchy. The stories are in an ordered list.
- The SVG art is `aria-hidden="true"` and `focusable="false"`. The story numbers are hidden from assistive technology because they are decoration.
- Contrast was computed, not estimated: ink on paper is 14.7:1, secondary ink is 7.7:1, rust on paper is 5.3:1, and on the inverted block the secondary text is 9.8:1 and the accent 8.4:1. All exceed WCAG AA for body text. The hairline rules are decorative and are not relied on to convey information.
- Focus is shown with a 3 px rust outline, and both the buttons and links have visible states.
- Motion is limited to the waterline drop, the reading-toggle knob, the nav underline, and smooth scrolling. All of it is turned off when the user prefers reduced motion.
- The language is set to English. The viewport meta tag does not disable zooming.

## Known limits

- The archive entries are plain text. No issue pages exist yet, so there are no links to point at.
- The cover story and supporting stories show only the summaries from `COPY.md`. There are no article pages.
- Charter and Helvetica are only available on some systems. The fallbacks (Georgia, Arial) change the texture slightly but keep the layout.
- Browsers without `background-clip: text` show the title in solid ink. The waterline is lost there, and the title stays readable.
