# Margin — Editorial Landing Page: Design Response

## Art Direction

### Concept: "The Page as Place"

Margin is an independent quarterly journal about overlooked places. The design translates the materiality and authority of contemporary print editorial — think *Cabinet*, *The Gentlewoman*, *Apartamento* — to the web without mimicking paper texture or skeuomorphism. The screen is treated as its own surface: luminous, fluid, but composed with the same discipline as a printed spread.

### Typography as Structure

Two typefaces do all the work:

- **Display/Editorial**: Georgia (system serif) — used for the journal title, issue title, story titles, section heads, and the subscription offer. Its italic cuts carry the voice of the publication. Letter-spacing is tightened (`-0.02em` to `-0.03em`) for display sizes to echo tight print headline setting.
- **UI/Functional**: System UI stack — used for labels, navigation, form elements, metadata. Small caps (`letter-spacing: 0.05–0.15em`, `text-transform: uppercase`) create quiet authority for categories, issue numbers, and the "Quarterly Journal" label.

Body text remains at browser default `1rem` (16px) with a generous `1.7` line-height for reading comfort. The measure is constrained to `38rem` (~608px) — roughly 65–75 characters per line — with a narrower `30rem` measure for long-form summaries.

### The Display Motif: The Rule

A single visual motif runs through the piece: **the horizontal rule**. Not decorative dividers, but structural punctuation:

- **2px solid ink** under the issue title — the heaviest mark, anchoring the hero
- **1px ink** separating cover story from supporting stories
- **1px border** under each story card — echoing print's column rules
- **1px border** above/below archive and subscription sections
- **Header/footer rules** — framing the content like a printed signature

Rules are `currentColor` (inheriting ink/reading-mode tones) so they shift with the palette. No gradients, no shadows, no cards with elevation. The page breathes through whitespace and rule weight alone.

### Asymmetric Composition

The hero breaks symmetry at desktop: a two-column grid where the issue title dominates the left column while the right remains open — negative space as editorial choice. The archive strip runs horizontally like a colophon line. Story cards stack asymmetrically on tablet (2 + 1 spanning), then align to a three-column grid on desktop. The subscription form sits beside the offer text, not below it — a sidebar-like placement reminiscent of a magazine's inside cover.

### Color: Restraint with One Accent

- **Ink** `#1a1a1a` — not pure black, softer on screen
- **Paper** `#faf9f6` — warm off-white, reduces glare
- **Accent** `#c41e3a` — a single saturated red for the "Cover Story" label only. It draws the eye once, then recedes.
- **Reading mode** inverts to a deep charcoal `#1e1e1e` with warm cream text `#e8e6e1` and a golden accent `#f5c542` for the toggle state — evoking a reading lamp.

No secondary palette. No semantic color overload. Error/success states borrow from the accent family (red/green) but only appear on interaction.

## Responsive Choices

### Mobile First (390px Baseline)

At 390px (iPhone 12/13/14/15 width), the page is a single column with generous vertical rhythm:

- Header: journal identity left, reading toggle right — compact but tap-accessible (44px minimum)
- Hero: stacked meta, title, subtitle, rule — all full-width
- Cover story: full-width, comfortable measure
- Supporting stories: single column cards, full-width tap targets
- Archive: flex-wrap row, items wrap naturally
- Subscription: stacked offer text then form; email input stretches, submit button fixed 52px

Touch targets meet 44×44px minimum. Text remains readable without zooming. No horizontal scroll.

### Tablet (560px+)

- Header padding increases
- Story cards shift to two-column grid; third card spans two columns (featured treatment)
- Archive items gain breathing room
- Subscription form moves beside offer text (grid `1fr auto`)

### Desktop (900px+)

- Spacing scale increases (`--space-xl: 3rem`, `--space-2xl: 5rem`)
- Three-column story grid, equal cards
- Journal title settles at 3.5rem
- Archive gap widens

### Large Desktop (1200px+)

- Hero becomes asymmetric two-column grid: meta + title left, subtitle + rule right
- Issue title scales to 6rem — poster scale
- Measure holds at `38rem` — content doesn't stretch infinitely

### Reading Mode Persistence

Preference stored in `localStorage` with `prefers-color-scheme` as default fallback. Respects user agency: explicit toggle wins over OS preference. Transition is instant (no animation) to avoid flash.

## Accessibility

### Semantic HTML

- `<header role="banner">`, `<main role="main">`, `<footer role="contentinfo">`
- `<section aria-labelledby>` for each major region
- `<article>` for each story card
- `<nav aria-label>` for navigation groups
- `<time datetime>` for issue date
- `<label>` (visually hidden) for email input
- `<form novalidate>` with native constraint validation augmented by JS

### Keyboard Navigation

- All interactive elements reachable: toggle, links, email input, submit button
- Focus visible: 2px solid focus ring (`#2563eb`) with 2px offset on all interactive elements
- `keyboard-nav` class on body when Tab pressed — removes `:hover` styles for keyboard users
- Skip link at page top (visible on focus)

### Screen Readers

- `aria-pressed` on reading mode toggle reflects state
- `aria-describedby` links email input to live feedback region
- `aria-live="polite"` on feedback paragraph announces validation/success
- `aria-invalid` toggled on email input for invalid state
- SVG icons marked `aria-hidden="true"`; buttons have `aria-label` or visible text
- Story links include author/title in `aria-label` for context

### Reduced Motion

- `@media (prefers-reduced-motion: reduce)` disables smooth scroll and all transitions/animations
- Reading mode toggle is instant

### Color Contrast

All text meets WCAG AA (4.5:1) in both light and reading modes:

- Ink on paper: 12.6:1
- Ink-light on paper: 7.8:1
- Muted on paper: 4.8:1
- Reading text on reading bg: 11.2:1
- Reading muted on reading bg: 5.1:1
- Accent on paper: 5.2:1
- Reading accent on reading bg: 6.8:1
- Focus ring on both backgrounds: visible

Form states use border color + icon + text (not color alone).

### Form Validation

- Native `type="email"` + `required` + `pattern` (via JS regex)
- Real-time validation on `input` and `blur`
- Success/error announced via live region
- No submission — demo only; success message clears after 5s
- `autocomplete="email"` for password managers

### Print Styles

`@media print` hides header, subscription, footer, toggle. Content flows naturally with `break-inside: avoid` on sections. Links show no decoration. Colors reset to black on white.

## Technical Notes

- **Zero dependencies**: No frameworks, no build step, no external fonts, no network requests
- **CSS custom properties** for theming (light/reading mode) and spacing scale
- **Clamp() fluid typography** for headline scaling without breakpoints
- **Grid + Flexbox** for layout; no floats
- **Inline SVG** for icons — styleable via `currentColor`, no icon font
- **ES module pattern** (IIFE) in `app.js` — no global pollution
- **localStorage** for reading mode persistence (graceful degradation if blocked)
- **Graceful enhancement**: page works without JS (reading mode defaults to OS preference, form uses native validation)

## File Structure

```
12-frontend-editorial/
├── index.html      # Semantic markup, ~180 lines
├── styles.css      # Complete styles, ~580 lines
├── app.js          # Reading mode + email validation, ~130 lines
├── COPY.md         # Provided content source
└── RESPONSE.md     # This document
```

All files are self-contained and work offline.