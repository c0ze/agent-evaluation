# Response — Margin Issue 14 landing page

## Art direction

Contemporary print editorial, translated to the web rather than a SaaS
convention set.

- **Typography as structure.** A system serif stack carries display and body;
  a restrained sans handles kickers, bylines, and UI; mono marks issue
  numbers. The opener sets “Low / Water” at display scale with an indented
  second line and accent color — the one strong display motif, paired with a
  stacked-contour SVG of receding water levels.
- **Rules and whitespace over boxes.** Horizontal hairlines and open gutters
  replace cards and shadows. The story list offsets each entry to the right on
  wider viewports for a paced, asymmetric rhythm.
- **One motif, used sparingly.** The contour lines reappear only as quiet
  cover-mark striping. No hero gradients, mockups, pills, or testimonials.
- **Palette.** Warm paper, near-black ink, one river teal accent — print-stock
  calm, not product-UI chrome.

## Responsive choices

- Fluid type (`clamp`) for the opener and section titles; max content width
  72rem with responsive gutters.
- Breakpoints at 820px and 560px: the opener stacks (meta → title → motif →
  standfirst), the cover mark moves below the essay, the archive strip stacks
  to one column, and the email field stacks its button full-width at 390px.
- Reading order matches the visual order at every width; decorative material
  never precedes meaning.
- Story index numbers stay visible on small screens as narrow left columns.

## Accessibility

- Skip link, landmarks (`header`/`main`/`footer`), and labelled regions via
  `aria-labelledby` on each section.
- Decorative contour SVG and cover mark are `aria-hidden="true"` with
  `focusable="false"`.
- Reading-mode toggle is a real `button` with `aria-pressed` and a polite
  live region for its state text.
- Email field has a visible label, `aria-describedby` message slot, and
  `aria-invalid` toggled with inline error/success text in `role="status"`.
- Focus-visible outlines, print stylesheet, and `prefers-reduced-motion`
  support. Body text meets contrast on the paper background.

## Behavior notes

- **Reading mode** narrows the measure, slightly enlarges type, dims secondary
  ornament, and persists in `localStorage` (no network).
- **Subscribe form** is local-only: shape validation, inline feedback, success
  message states clearly that nothing was submitted.
- No frameworks, remote assets, external fonts, or network requests.
