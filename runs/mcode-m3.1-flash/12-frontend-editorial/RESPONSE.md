# Margin, Issue 14 — "Low Water"

A landing page for a fictional independent quarterly about overlooked places.
Three hand-written files, no framework, no build step, no network: `index.html`,
`styles.css`, `app.js`. Open `index.html` directly from disk and it runs.

---

## 1. Art direction

The brief was contemporary print editorial translated to the web, so the page was
designed as a **broadsheet** rather than a landing page with serif on it. Four
decisions carry that:

**The margin rail is structural, not decorative.** At 62 rem and up, the page is a
two-column grid: a narrow sticky rail on the left, the content on the right. The
rail holds the folio (`014`), a vertically-set running label, and corner
registration marks drawn in CSS. It is the literal margin of the publication, and
it is the first thing that makes the layout read as printed matter. Below 62 rem
it is removed entirely rather than shrunk.

**Asymmetry, and only where it earns its keep.** Content sits on a 12-column grid,
but the spans are deliberately unequal rather than mirrored: the cover title takes
columns 1–7, the standfirst 9–13, the plate 1–9, the marginalia 10–13. The three
supporting stories are 5 / 6 / 7 columns wide and deliberately do not tile into a
tidy row. Nothing is centred except the reading-mode column.

**One display motif: the contour line of a drained channel.** "Low Water" is a
cartographic problem, so the whole page is drawn with contour logic. The hero is an
inline SVG survey plate — six nested contours of a river channel with a dashed
thalweg, a scale bar, a contour legend, section marks, corner registration marks
and a datum note. That same vocabulary recurs at small scale as rules, the
five-hairline band under the masthead, and the outlined story numerals. The motif
is carried by one idea rather than repeated as decoration.

**Type is a two-voice system.** A system old-style serif (Iowan Old Style →
Palatino → Georgia) does all the reading and display work; a neutral sans
(Iowan has no companion here, so the system UI stack) does the *apparatus* —
folios, running heads, folios, bylines, page counts, price units. Content is
serif; the machinery around it is sans. That single rule does most of the work of
making the page feel authored.

**Restraint as a decision.** No hero gradient, no floating device mockup, no
avatars, no testimonial cards, no pill buttons anywhere. Every radius is `0`. The
only filled control on the page is the subscribe button. The palette is paper
(`#f2efe6`), ink (`#17150f`), one oxide red for attention, and one slate-teal used
only for anything cartographic or affirmative.

---

## 2. Responsive choices

The layout is authored per width, not squeezed. Three authored states plus a
safety net:

- **Below 40 rem (the 390 px target).** One column. A critical bug was caught here
  during build: the asymmetric 12-column grid auto-placed any child without an
  explicit `grid-column` into a *single one-twelfth column*, collapsing the cover
  and all three stories into an unreadable overlap. The fix is a mobile-first
  `.cols > * { grid-column: 1 / -1 }` base rule that the wide breakpoints then
  override. Verified: at exactly 390 px, `document.scrollWidth === clientWidth`
  and no element exceeds the viewport.
- **The plate is cropped on phones.** At full sheet the plate's 11 px annotation
  renders at roughly 4 real pixels on a 390 px screen — visual noise. Under 40 rem
  the plate is given a 4:1 frame with `preserveAspectRatio="xMidYMid slice"`, so
  the channel fills the width at a readable size and the fine annotation is
  dropped. The caption below carries what the annotation said. Separately, all
  plate strokes use `vector-effect: non-scaling-stroke`, without which a 1.1-unit
  hairline renders at a third of a pixel and disappears on a phone.
- **40 rem and up.** Archive goes three across with hairline dividers; the
  colophon goes three across; the section heads stop stacking.
- **62 rem and up.** The margin rail appears and the asymmetric spans engage.
- **Under 24 rem (320 px).** Running head stacks, type steps down, and the button
  goes full width.

Vertical rhythm is a single token: 48 px between sections on phones, 88 px on
desktop. All type is `clamp()`-based so it scales continuously between states
rather than jumping at breakpoints.

---

## 3. Accessibility

**Structure.** One `<h1>` (the cover story), `<h2>` per section, `<h3>` per story
and archive item — no skipped levels. Landmarks throughout: `header`, `nav` with
an accessible name, `main`, `aside` for the marginalia, `footer`. A skip link is
the first focusable element on the page.

**The artwork.** The survey plate is an image with meaning, so it carries
`role="img"` with both `<title>` and `<desc>` describing the contours, the thalweg,
the legend values and the scale. The three story glyphs are decorative repeats of
a visual language the headings already state, so they are `aria-hidden="true"`
with `focusable="false"` — the correct treatment for ornament, rather than three
identical image announcements in a screen reader's queue. The paper grain is a
`aria-hidden` fixed layer with `pointer-events: none`.

**Reading mode.** A real `<button>` with `aria-pressed`, not a styled `<div>`. It
sets `data-reading` on `<html>`, which collapses the grid to one 34 rem measure,
drops the rail, folds the marginalia into the flow, and relaxes the type. State
changes are announced through an `aria-live="polite"` status region. The choice
persists in `localStorage` (wrapped in try/catch, so it degrades silently in
private browsing) and is **not** announced on load, only on user action. Escape
exits and returns focus to the toggle. A second, redundant exit control lives in
the reading banner, so the mode is never a trap.

**The email field.** `<form novalidate>` with `preventDefault` on submit — nothing
is ever sent, and the page states so in the UI. The input is `type="email"` with a
real `<label>`, `autocomplete="email"`, and `aria-describedby` pointing at both
the privacy note and the feedback region. Validation is deliberately permissive
but rejects the three real failure modes (empty, embedded space, no TLD) with
three different messages rather than one generic error. `aria-invalid` is set on
failure and removed on success; the feedback region is `role="status"`
`aria-live="polite"`; focus moves to the field on error; the success state locks
the field, disables the button, and relabels it. Editing the field clears a stale
error. A `<noscript>` block explains what happens with JS off.

**Contrast.** All text pairs meet WCAG AA on paper, measured rather than assumed:
ink 15.9:1, water 7.6:1, ink-soft 8.2:1, oxide 5.8:1, and the quiet apparatus
grey `--ink-faint` 4.7:1. The hairlines (`--rule`, 1.6:1) are used only for rules
and dividers, never for text. The colophon flips to paper-on-ink (15.9:1).
`--ink-faint` was originally darker-looking but lighter-valued (#7a7466, 4.0:1),
which would have failed AA for the 11–12 px caption and page-count text that uses
it; the token was darkened rather than the failure documented.

**Other.** Visible `:focus-visible` rings (2 px oxide, 3 px offset) on every
interactive element. All tap targets ≥ 44 px. A custom switch-shaped glyph carries
the toggle's state, but `aria-pressed` carries it authoritatively.
`prefers-reduced-motion: reduce` disables smooth scrolling, the switch animation,
and the slow dash-offset "flow" on the thalweg. A print stylesheet drops the rail,
grain, controls and banner, and forces flat black-on-white.

---

## 4. Verification performed

Checked with headless Chrome, not by eye alone:

- HTML tag balance, and that every `href="#…"`, `aria-labelledby`,
  `aria-describedby` and `<label for>` resolves to a real, unique `id`.
- No duplicate `id`s; no external URLs in any of the three files (the only
  `http` string is the SVG XML namespace, which is an identifier, not a request).
  The favicon is an inline `data:` URI.
- CSS braces balanced; every `var(--…)` defined; no class in the markup without a
  rule.
- `node --check app.js`.
- **At exactly 390 px:** `scrollWidth === clientWidth === 390`, zero overflowing
  elements.
- **Reading mode driven through the real button:** `data-reading` flips, the cover
  grid goes from 12 tracks to one 353 px track, body type goes to 17.4 px / 1.78
  line-height, `aria-pressed` and the banner follow, and Escape reverts it.
- **Form driven through synthetic submits:** empty, `reader@`, `a b@example.com`
  and `reader@example` each produce a distinct error with `aria-invalid="true"` and
  the button still enabled; `reader@example.com` produces the success state with
  the button disabled and relabelled.

One note on process: the first mobile screenshot appeared to show text clipped at
the right edge. That was an artifact of the screenshot tool — headless Chrome
clamps the window to a ~485 px minimum and silently cropped the capture. Measuring
`scrollWidth` against a real 390 px viewport showed the layout was fine. The
genuine mobile bug was the grid auto-placement one described above.

---

## 5. Constraints honoured

No frameworks, packages, remote assets, external fonts, or network requests. The
type is entirely system fonts. The artwork is inline SVG and CSS only. Two
behaviours are implemented, both local: reading mode and inline form validation,
neither of which transmits anything. The only storage is a single
reading-mode preference in `localStorage`.
