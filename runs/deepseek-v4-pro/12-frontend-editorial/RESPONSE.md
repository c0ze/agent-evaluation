# Response — Margin, Issue 14 (“Low Water”)

## Art direction

The page translates a contemporary print quarterly to the screen rather than
imitating a SaaS landing page. The running metaphor is **low water** itself: the
single strong display motif is a **river staff gauge** — the vertical ruler, tick
marks, and painted numerals used to track receding water levels. It is drawn as
an accessible inline SVG (with a `title` and `aria-label`) and sits beside the
cover story, silently restating the issue’s title and the cover essay’s theme
(what a drought exposes, what infrastructure tries to forget).

The rest of the system is deliberately spare and rule-based:

- **Palette** of warm uncoated paper (`#f5f0e6`), near-black ink, and a single
  river-teal (`#18575a`) used only where it carries meaning (the masthead rule,
  the gauge, the last line of the cover headline, the subscribe band). One
  dry-season red (`#a23b2a`) is reserved as the editorial mark for the cover
  label and the subscribe band ticks.
- **Typography** uses system serifs (Iowan Old Style / Palatino / Georgia) for
  display and editorial voice, and a neutral sans for navigation, labels, and
  functional UI. No web fonts or external assets are loaded.
- **Composition** is asymmetric: an over-large, low-leading issue title; an
  indented, stair-stepped cover headline; a left-hand gauge column that aligns to
  the grid only on wide screens; a numbered feature list on rules rather than in
  cards. Hairline rules and generous whitespace do the structural work instead of
  gradients or pills.

## Responsive choices

- The layout is authored **mobile-first**. At 390 px everything stacks to a
  single column in a sensible reading order: masthead → issue → cover → features
  → archive → subscribe → footer.
- The masthead wordmark, issue title, and cover headline all scale with `clamp()`
  and viewport width, so the editorial scale survives on small screens without
  horizontal overflow.
- The gauge SVG is centered and shortened on narrow screens (`height: 320px`),
  then re-anchored as a 96 px left column on screens ≥ 720 px.
- The feature list moves from one column to three; the subscribe band moves from
  stacked to a two-column split at the same breakpoint.
- The `viewBox`-based gauge is resolution-independent and never stretches.

## Accessibility

- A visible skip link jumps to `#main`.
- Semantic landmarks: `header`, `nav` (labeled), `main`, `section`s each headed
  by an `aria-labelledby` heading, and `footer`.
- The decorative gauge is `aria-hidden` when ambient, and presentational only;
  its accessible label lives in the SVG `title`. Interactive/functional states
  are handled by the linked form and button semantics rather than the artwork.
- The reading-mode toggle is a real button with `aria-pressed`, `aria-controls`,
  and a label that updates (“Reading mode” / “Exit reading mode”). Reading mode
  removes the decorative gauge and nav, reflows to a comfortable `66ch` measure,
  enlarges the body text, increases line-height, and swaps the inverted subscribe
  band into a light high-contrast variant. The preference persists in
  `localStorage` when available.
- The email field is a labeled `<input type="email">` with `autocomplete` and
  `inputmode`, linked to `aria-describedby` feedback announced via
  `aria-live="polite"`. Validation runs on submit (no real submission), on blur,
  and clears errors on input; invalid state is also conveyed through
  `aria-invalid="true"` and a visible color, not color alone.
- Focus states are explicit outlines; color contrast is maintained across both
  the light and inverted surfaces.