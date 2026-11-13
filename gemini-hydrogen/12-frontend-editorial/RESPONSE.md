# Margin — Issue 14 (*Low Water*) Editorial Landing Page

## Deliverables

- `index.html`: Semantic HTML5 structure, complete Issue 14 editorial copy from `COPY.md`, inline SVG hydrographic survey plate (`Plate XIV`), compact archive strip for Issues 11–13, subscription broadside, and inline validation form.
- `styles.css`: Local system-font typography, warm rag-paper palette, hairline rule architecture, asymmetric desktop grid, mobile-first `390px` composition, and focused Reading Mode layout.
- `app.js`: Functional Reading Mode toggle (`localStorage`-backed with graceful fallback) and client-side email validation with inline error/success status feedback and zero network requests.

## Art Direction

The design translates contemporary independent print publishing to the web using structural typography, ink hairlines, deliberate whitespace, and an authored two-color lithograph aesthetic:

- **Palette & Surfaces**: Uncoated rag-paper ground (`#F4F0E6`), inset subscription slip (`#ECE6D8`), carbon ink (`#171614`), umber marginalia (`#534F48`), surveyor rust (`#8E321C`), and channel slate (`#2C4B57`). Avoids gradients, drop shadows, rounded pill badges, and SaaS card patterns.
- **Typography**: Local-only font stacks pairing classical editorial serifs (`Iowan Old Style` / `Palatino` / `Liberation Serif` / `Georgia`) for titles and long-form summaries with humanist sans (`Optima` / `Segoe UI` / `Adwaita Sans` / `Liberation Sans`) for attribution and controls, and archival monospace (`Liberation Mono` / `DejaVu Sans Mono`) for folio numbers, issue codes, and datum ticks.
- **Display Motif**: A single cohesive visual motif—*Plate XIV: Bed Survey*—rendered as an inline `<svg>` hydrographic contour diagram paired with a right-hand vertical river-depth gauge (`0.0` to `-4.0`), crosshatched silt bar, and submerged street-grid geometry echoing Imani Vale’s cover essay (*The River Keeps Its Receipts*). Thin registration rules and folio markers repeat this survey language sparingly across the page.
- **Asymmetric Composition**: On desktop (`>= 920px`), the masthead pairs the wide serif nameplate against a flush-bottom colophon (`7fr / 5fr`), the hero pairs the issue spread against the survey plate (`7fr / 5fr`), and the supporting dispatches pair a narrow marginalia intro column (`3fr`) with a staggered contents ledger (`9fr` holding the lead *Night Bus Atlas* row above an uneven `5fr / 4fr` split for *Concrete Orchards* and *A Language for Empty Pools*).
- **Reading Mode**: Toggling **Reading mode** (`data-reading-mode="active"`) switches from the multi-column broadsheet to a centered `44rem` reading folio sheet (`#FAF6EC`) framed on dimmed parchment (`#E5DEC9`), collapses decorative ornament (the SVG cover plate and margin datum marker), enlarges prose (`clamp(1.125rem, 1.07rem + 0.25vw, 1.25rem)` at `1.78` line height), and linearizes every spread for distraction-free reading.

## Responsive Choices (Mobile at `390px` & Breakpoints)

- **Reading Order First**: On narrow viewports (`390px`), the hero places `Low Water` (`<h1>`) and *The River Keeps Its Receipts* directly above the survey plate so the reader encounters the issue and cover essay immediately.
- **Zero Horizontal Overflow**: All grids use `minmax(0, 1fr)`, fluid `clamp()` display scales prevent masthead clipping at `390px`, and the SVG plate uses `viewBox="0 0 420 520"` with `max-width: 100%; height: auto`.
- **Adaptive Controls & Forms**: Below `540px`, the utility metadata stacks cleanly without hanging separators, and the email input and `Subscribe` button stack full-width at `48px` height with `1rem` input font size to avoid mobile zoom on focus. Below `720px` and `920px`, horizontal ledger cells, supporting stories, archive entries, and the subscription broadside reflow into single-column ruled rows.

## Accessibility

- **Landmarks & Heading Hierarchy**: Uses `<header>`, `<nav aria-label="Issue sections">`, `<main id="main-content">`, `<section aria-labelledby="...">`, `<article>`, and `<footer>`, following an unbroken `h1` (*Low Water*) → `h2` (*The River Keeps Its Receipts*, *Also in Issue 14*, *Archive*, *Receive Issue 14...*) → `h3` (supporting dispatches) structure, plus a skip-to-content link.
- **Accessible SVG & Decorative Art**: The purely illustrative survey plate and decorative margin ticks carry `aria-hidden="true"` (with `focusable="false"` on the SVG) while a plain HTML `<figcaption>` provides the textual plate description without redundant vector noise.
- **Contrast, Focus & Motion**: Primary carbon ink on rag paper exceeds `15:1` contrast, secondary ink (`#534F48`) and rust accent (`#8E321C`) exceed `6.4:1` against both `#F4F0E6` and `#ECE6D8`, interactive targets maintain at least `44px` height with explicit `2px` `:focus-visible` outlines, and `@media (prefers-reduced-motion: reduce)` disables smooth scrolling and transitions.
- **Interactive ARIA & Live Feedback**: The Reading Mode button exposes `aria-pressed` and announces changes via a visually hidden `aria-live="polite"` status node. The email form (`novalidate`) binds `#email-hint` and `#email-feedback` (`role="status"`, `aria-live="polite"`) through `aria-describedby`, sets `aria-invalid="true"` with focus return on empty/invalid submissions, and renders an inline local confirmation without triggering any network request.
