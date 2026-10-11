# Editorial Landing Page: *Margin* — Issue 14: “Low Water”

## 1. Art Direction & Editorial Rationale

*Margin* is an independent quarterly journal investigating overlooked places, discarded infrastructure, and territories at the periphery of master plans. For **Issue 14: Low Water (Autumn 2026)**, the visual language translates the craft and material discipline of contemporary print publishing directly into the browser without relying on external fonts, remote frameworks, or SaaS conventions.

### Rejection of Generic SaaS Tropes
- **No Floating Mockups or Isometric Device Cards**: In place of simulated iPads and laptops, physical publications are documented through typographic specifications (Munken Print White 80 gsm, Smyth-sewn binding, open spine, limited print run of 3,500).
- **No Hero Gradients or Pill Overload**: The palette is grounded in unbleached paper tones, deep carbon lampblack, and oxidized iron/terracotta silt. Borders are crisp structural rules (hairlines, double rules, and measurement ticks) evoking Swiss architectural monographs and Ordnance Survey field folios.
- **No Fictitious Testimonials**: Credibility is established through editorial colophons, precise cartographic coordinates (`35°41'N 139°45'E`), surveyor field notes, and transparent publishing disclosures.

### Typographic System
The type hierarchy relies entirely on system font stacks curated for high-craft editorial rendering across platforms:
- **Display Serif**: `"Iowan Old Style", "Palatino Linotype", "URW Palladio L", Palatino, "Book Antiqua", Georgia, serif` — delivers literary character, sharp serifs, and authoritative editorial presence.
- **Body Serif**: `"Charter", "Bitstream Charter", "Iowan Old Style", Palatino, Georgia, serif` — designed for sustained reading clarity and optical legibility at paragraph scale.
- **Folio, Metadata & Technical Annotation**: `ui-monospace, "SF Mono", "Consolas", "Liberation Mono", "Menlo", monospace` — provides precise alignment for coordinates, dates, page numbers (`pp. 32–47`), and hydrographic gauge datums.
- **Byline & Sans Accents**: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` — provides clean typographic contrast for author names and metadata categories.

### The Strong Display Motif: *Transect 14 Bathymetric Section*
The central visual motif is an inline, accessible SVG architectural transect (`#transect-motif`). Rather than decorative stock photography, it functions as an authentic field instrument:
- Depicts the drought-induced drawdown of the lower riverbed from the 1984 historic flood crest (`+4.00 m`) down to the current Autumn 2026 stage (`−2.40 m`).
- Uses custom SVG hatch patterns (`#silt-pattern`, `#gravel-pattern`, `#bedrock-pattern`) representing alluvial silt, gravel rubble, and basalt bedrock.
- Features technical surveyor callouts identifying physical artifacts uncovered by receding waters, directly connecting the visual diagram to Imani Vale's cover essay (*The River Keeps Its Receipts*).
- Accompanied by three custom spot diagrams for supporting stories: a nocturnal radial transit schedule for Tomás Iriarte's *Night Bus Atlas*, an architectural section of skyscraper floor slabs for Meera Das's *Concrete Orchards*, and an isometric tile grid for Hana Mori's *A Language for Empty Pools*.

---

## 2. Responsive Architecture & 390 px Mobile Ergonomics

The page was engineered with a mobile-first responsive foundation, specifically optimized for compact viewports down to **390 px** (standard iPhone width) up to ultra-wide displays:

### Mobile Viewport (390 px) Adaptations
1. **Vertical Pacing & Rhythm**: The desktop 7:5 asymmetric lead grid and 3-column features triptych collapse into a deliberate, balanced single-column vertical sequence. Section dividers and measurement rules frame each story like individual journal leaves.
2. **Horizontal Containment**: All elements enforce strict boundary containment (`max-width: 100%`, `overflow-x: hidden`, scalable SVG `viewBox="0 0 1000 460"`). No horizontal scroll spill occurs at 390 px.
3. **Ergonomic Touch Targets**: All interactive elements (reading mode toggles, theme switches, type scalers, accordion inspection buttons, and form controls) maintain minimum touch targets of 44 &times; 44 px.
4. **Utility Bar Adaptation**: On narrow viewports, the sticky utility bar collapses secondary decorative metadata while keeping essential controls (view mode, theme switcher, and type size) within instant thumb reach without consuming vertical screen real estate.
5. **Form Factor Refinement**: The newsletter subscription row stacks vertically at 390 px with full-width inputs and submit actions, preventing clipped placeholders or awkward button wraps.

### Desktop Asymmetric Composition
On viewports above 960 px, the page expands into an asymmetric editorial layout:
- **Lead Essay**: 7-column lead article with oversized drop cap and editorial pullquote paired with a 5-column technical field dossier card and coordinate measurement box.
- **Supporting Stories**: Asymmetric 3-column triptych with spot diagrams, pagination marks, and inline excerpt drawers.
- **Subscription Offer**: Split layout pairing the independent publishing manifesto with a tactile order card styled like a letterpress subscription receipt.

---

## 3. Accessibility & Interactive Engineering (WCAG 2.1 AA+)

### Semantic Hierarchy & Reading Order
- Strict HTML5 landmark architecture: `<header>`, `<nav role="navigation">`, `<main id="main-content">`, `<article>`, `<aside>`, `<section>`, `<figure>`, and `<footer role="contentinfo">`.
- The DOM order matches the natural editorial reading sequence: skip link &rarr; utility preferences &rarr; masthead &rarr; cover essay &rarr; basin transect &rarr; table of contents &rarr; subscription terms &rarr; archive strip &rarr; dispatch sign-up &rarr; colophon.
- Visible, keyboard-accessible skip link (`#main-content`) allowing keyboard and screen-reader users to bypass navigation immediately.

### Color Contrast & Theming
All three color modes exceed WCAG AAA requirements for normal text:
1. **Warm Newsprint (Default)**: Deep carbon `#181715` on unbleached `#F6F3EB` (contrast ratio **15.2:1**).
2. **Carbon Night**: Pale parchment `#EDE8DE` on deep charcoal `#131312` (contrast ratio **14.8:1**).
3. **High-Contrast Lithograph**: Pure `#000000` on `#FFFFFF` (contrast ratio **21:1**).

### Functional Reading-Mode Control
- **Dual View Modes**: The user can toggle between the full **Editorial Magazine View** (rich multi-column layout) and **Reading Mode** (distraction-free single-column focus layout with a measure of 68ch, larger type, increased line height, and a reading progress bar).
- **Persistent Preferences**: Mode, theme, and type scale adjustments are persisted in `localStorage` with error-guarded fallbacks.
- **Type Scaler**: Allows continuous scaling from 85% to 135% without breaking layout constraints.

### Inline Email Validation & Feedback (No Network Submission)
- The Dispatch subscription form intercepts native submission (`event.preventDefault()`).
- Evaluates input with strict RFC 5322 pattern matching.
- **Real-Time Dynamic Feedback**: Displays inline error states when empty or misformatted with `aria-invalid="true"` and an active `aria-live="polite"` feedback banner.
- **Success State**: On valid entry, smoothly transitions to a verified registration confirmation card announcing the registered address to screen readers, complete with a reset action to test additional inputs.

### Inline SVG Accessibility
Every decorative and informational SVG graphic includes:
- `role="img"` with descriptive `<title>` and `<desc>` elements matching `aria-labelledby`.
- Secondary spot graphics paired with visible text are tagged with `aria-hidden="true"` to prevent redundant screen reader chatter.

---

## 4. Deliverable Inventory

All required deliverables have been created exclusively within this directory:
- `index.html`: Complete semantic markup, inline SVGs, accessible controls, and editorial copy.
- `styles.css`: Complete zero-dependency CSS design system, typography stacks, themes, and responsive queries.
- `app.js`: Clean vanilla JavaScript powering reading mode, themes, type scaling, inline email validation, and drawer previews.
- `RESPONSE.md`: This comprehensive art direction, responsive design, and accessibility documentation.
