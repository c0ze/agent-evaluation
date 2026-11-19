# Margin — design response

## Art direction

The page is built to read like a print journal opened flat, not like a web app. A warm paper ground, near-black ink, hairline rules, double rules at section boundaries, and small monospaced labels carry the "typeset" feel. Typography does most of the work: a large display serif for the issue title and story titles, with the word **Water** set as an outline and a clipped oxide-red fill along its lower third. That filled band is the single display motif — a literal waterline — and it ties the title to the issue's subject. Oxide red (`#9d3b24`) is the only accent colour, reused for the cover-story byline, section numbers, the current gauge level, and the form's error state, so red always signals "this issue / this moment."

The cover art is an inline SVG river gauge: a measuring scale whose historical marks step downward year by year (1998, 2007, 2016) until the current 2026 level sits in a thin band of water above a hatched riverbed. It is drawn with the same rules and mono labels as the rest of the page, so it reads as a figure plate from the journal rather than stock illustration. A faint CSS-gradient paper grain sits above the page at very low opacity; it is decorative and never affects legibility. No remote fonts, images, or requests — everything uses local system font stacks (a serif stack for reading text, monospace for labels) and CSS/SVG artwork.

## Responsive choices

The layout uses CSS grid with a small number of hand-tuned breakpoints rather than a framework. Above 960 px the cover is a two-column asymmetric spread (text and figure), the stories sit in three columns divided by hairline rules, and subscribe is a two-column offer/form. At 960 px the masthead reflows and the cover and subscribe sections stack. At 640 px — the 390 px target — everything becomes a single column: the issue title scales with `clamp()` and stays large but within view, story cards drop their vertical dividers in favour of horizontal rules, the archive becomes a compact two-field strip (number left, title right), and the email field and button stack full-width. Reading order follows the DOM: masthead → cover story → supporting stories → archive → subscribe → footer, with the figure following the cover text so the essay's framing comes first. Container widths use `clamp()` padding and a max-width, and the gauge SVG scales fluidly with the column. Verified via headless Chrome: no horizontal overflow at 390 px or 1280 px, including with reading mode enabled.

## Accessibility

- A skip link bypasses the masthead; all interactive controls are native `<button>`, `<a>`, or `<input>` and show visible `:focus-visible` outlines.
- The gauge SVG uses `role="img"` with `<title>` and `<desc>`, so its meaning is conveyed in text; decorative and duplicative glyphs (watermark, separators, arrows) are `aria-hidden`.
- The figure has a `<figcaption>`; headings form a logical `h1 → h2 → h3` outline; the archive is a real ordered list.
- The reading-mode button exposes state through `aria-pressed` and updates its visible label. Reading mode simplifies the palette, removes the paper grain, and reflows to a single column with a wider text measure and larger body size — checked to stay within the viewport at 390 px.
- The email field has a persistent `<label>`, a hint tied via `aria-describedby`, and a `role="status"` / `aria-live="polite"` status line for inline errors and the success message. Invalid input is marked with `aria-invalid` and error colour is paired with text, never colour alone. Validation is local only; `preventDefault()` stops any submission.
- `prefers-reduced-motion` disables smooth scrolling and transitions, and a print stylesheet hides interface-only controls.
