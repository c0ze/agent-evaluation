# Margin — Issue 14: Low Water (Editorial Design Response)

This document details the art direction, responsive architecture, and accessibility engineering implemented for **Margin**, an independent quarterly journal about overlooked places, featuring **Issue 14: Low Water** (Autumn 2026).

---

## 1. Art Direction & Visual Direction

### Philosophy: Contemporary Print Editorial on the Web
Web interfaces have largely coalesced around homogeneous SaaS aesthetics: floating cards with rounded corners, blurred gradient blobs, floating dashboard mockups, pill-tag overload, and interchangeable testimonials. 

For *Margin*, the visual identity is drawn from independent tactile print journals—such as *Migrant Journal*, *Cabinet*, *MacGuffin*, and classical broadsheet literary supplements. The page feels authored, deliberate, and archival:
- **Hairlines and Architectural Rules:** Structural divisions utilize 1px hairline rules, double-rule masthead borders, and dashed margin separators rather than soft drop shadows or border-radius pills.
- **Asymmetric Desktop Composition:** The lead section abandons symmetrical centering in favor of a 12-column asymmetric broadsheet spread:
  - **Left Rail (Dossier & Marginalia):** Precise field coordinates, gauge readings, and notebook citations.
  - **Center Lead (Cover Essay):** Generous classical typography, an authentic 3.8rem drop-cap, byline attribution, and a prominent editorial pull quote.
  - **Right Rail (Visual Display Anchor):** A technical survey plate housing the primary display motif.
- **The Display Motif: Low Water Strata & Bathymetric Sounding:**
  To embody the cover story *“The River Keeps Its Receipts”* by Imani Vale (exploring how a severe drought exposed pre-dam town foundations and waterlogged 1934 ledgers), the central display motif is an intricate, architectural vector plate drawn in inline SVG. It features:
  - Sounding depth increments from `+4.0m` down to `-7.2m`.
  - Historic High-Water datum vs. Autumn 2026 Drought Datum (`-3.42m`).
  - Geological cross-section strata layers (alluvial silt, compacted clay, bedrock) rendered using vector hatching patterns (`#siltHatch`, `#clayHatch`, `#gravelGrid`).
  - Exposed artifact callout nodes: 1923 Brewery granite piers, narrow-gauge timber tramway rails, and a salvaged dry-goods ledger box.
  - Technical surveyor cartouche with coordinates (`36°58'N 138°44'E`) and orientation arrow.
- **Supporting Stories Visual Grammar:**
  Complementary miniature diagrams accompany each supporting dispatch from `COPY.md`:
  - *Night Bus Atlas* (Tomás Iriarte): Midnight radial routes, timed depot nodes (`03:40 DEPOT`), and nocturnal cartography.
  - *Concrete Orchards* (Meera Das): Structural elevation cross-section showing unfinished financial center floor slabs penetrated by citrus tree roots.
  - *A Language for Empty Pools* (Hana Mori): Isometric ceramic pool tiles, watermarks, and swimmer depth indicators (`3.2 M`, `SHALLOW`).
- **Archival Strip & Bound-in Subscription Card:**
  - The compact archive strip (Issues 11–13: *After the Last Train*, *Borrowed Ground*, *The Weather Indoors*) echoes periodical library shelf spines with issue cataloging.
  - The subscription offer (Print + Digital, ¥2,400 per issue, cancel anytime) is formatted as an archival tipped-in bound reply-card, complete with a perforated dashed dividing rule.

### Typographic System
Without relying on remote web fonts, the stylesheet defines system typographic stacks configured for literary pacing:
- **Display & Headlines:** High-contrast classical serif stack (`"Iowan Old Style"`, `"Palatino Linotype"`, `P052`, `Baskerville`, `Georgia`, `serif`).
- **Body Excerpts:** Legible book serif (`"Charter"`, `"Bitstream Charter"`, `Cambria`, `Georgia`).
- **Metadata, Folios & Navigation:** Clean grotesk sans (`-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `Helvetica Neue`, `Arial`, `sans-serif`) with uppercase tracking (`letter-spacing: 0.08em`).
- **Field Data, Gauges & Prices:** Monospaced technical numerals (`"SF Mono"`, `"Consolas"`, `"Liberation Mono"`, `Menlo`, `monospace`).

---

## 2. Responsive Architecture & 390 px Viewport Design

The responsive system is architected to preserve reading pacing and hierarchy across all screen widths:

### Extreme Mobile Precision (390 px Viewport)
A standard modern mobile viewport (such as the 390 px width of an iPhone 12/13/14/15) presents unique editorial challenges. We solved these through deliberate constraints:
1. **Sensible Mobile Reading Order:**
   - Top folio collapses into a clean vertical stack: Journal name → Publishing cities → Reading mode controls.
   - Masthead scales neatly without line clipping, keeping the Volume, ISSN, and Issue 14 price badge (`¥2,400`) organized.
   - Section navigation scrolls horizontally with native touch-momentum (`-webkit-overflow-scrolling: touch`) and zero scrollbar clutter.
   - Lead article stacks logically: Issue Kicker → Headline → Byline → Field Dossier Notes → Body Text → Pullquote → Action Button → Architectural Survey Plate.
   - Dispatches stack vertically into clear, self-contained editorial cards.
   - The subscription card transitions from a two-column split to a stacked format while maintaining clear price transparency.
   - The email dispatch form stacks the email input and submit button to ensure full touch target width.
2. **Zero Horizontal Overflow:**
   - All containers utilize `box-sizing: border-box`, `max-width: 100%`, and fluid `width: 100%`.
   - Headlines use fluid typography via CSS `clamp()` (`clamp(1.95rem, 7.5vw, 3.8rem)`), preventing awkward multi-line hyphenation or viewport edge collisions.
3. **Touch Target Sizing:**
   - All interactive controls (theme switchers, scale buttons, navigation links, subscription buttons, and archive reservation triggers) meet or exceed the recommended 44×44 px minimum hit area.

### Tablet and Broadsheet Breakpoints
- **Tablet (<= 1024px):** Reorganizes the 3-column asymmetric lead into a balanced two-column layout with marginalia spanning the top.
- **Desktop (>= 1025px):** Unfolds into an expansive 1360px asymmetric broadsheet grid honoring classical print page spreads.

---

## 3. Accessibility & Interactive Engineering

### Semantic Landmarks & Structure
- Full HTML5 landmark structuring: `<header role="banner">`, `<nav aria-label="...">`, `<main id="main-content">`, `<section aria-labelledby="...">`, `<article>`, `<aside>`, and `<footer role="contentinfo">`.
- Strict heading hierarchy (`<h1>` for journal masthead, `<h2>` for primary sections and cover story, `<h3>` for individual dispatches and archive editions, `<h4>` for colophon sub-sections).
- Dedicated `<a href="#main-content" class="skip-link">` providing immediate keyboard bypass to the primary editorial content.

### Reading Mode Controls
Located in the top running folio, the reading mode provides real-time customization without layout shift:
- **Three Tonal Themes:**
  1. *Paper / Newsprint (Default):* Warm unbleached paper (`#F5F2EB`) with deep soot ink (`#1C1917`) and iron silt accent (`#A83622`).
  2. *Archival Charcoal (Night):* Riverbed slate (`#131416`), bone text (`#EBE5DB`), and warm brass ochre (`#D69E58`).
  3. *Raw Linen:* Unbleached flax linen (`#ECE6D8`), oxidized ink (`#26221D`), and river reed sage (`#49634C`).
- **Typographic Scale:**
  - Standard (100% / 1rem base) vs. Large (115% / 1.15rem base) with proportional scaling across all units.
- **State & Keyboard Accessibility:**
  - Toggle buttons are grouped as accessible radio groups (`role="radiogroup"`, `role="radio"`, `aria-checked`).
  - Preferences persist safely in `localStorage` with silent fallbacks if local storage is restricted or disabled.
  - Automatically honors OS dark mode (`prefers-color-scheme: dark`) upon first visit.
  - Theme colors dynamically cascade into SVG strokes and fills via CSS custom properties.

### Inline SVG Motif Accessibility
- The primary display motif SVG is declared with `role="img"` and linked via `aria-labelledby="motif-title motif-desc"`.
- Contains descriptive `<title>` and `<desc>` elements detailing the bathymetric soundings, receded waterlines, and exposed artifacts.
- Minor decorative diagrams feature `aria-hidden="true"` to prevent screen reader verbosity.

### Functional Email Field with Inline Feedback
The Field Dispatch signup in Section 05 is fully functional client-side:
- **No Network Submission:** Intercepts `submit` via `preventDefault()` without page reload.
- **Real-Time & Submission Validation:**
  - Detects empty submissions and alerts the user with descriptive text.
  - Enforces RFC-compliant email structure with clear formatting examples.
  - Implements intelligent domain typo detection (e.g. suggests `@gmail.com` when user enters `@gmial.com` or `@gmai.com`).
- **Live ARIA Feedback:**
  - Uses `aria-invalid="true|false"` on the `<input>` element.
  - Connected via `aria-describedby="email-feedback"` to a live region (`role="alert"`, `aria-live="polite"`).
  - On success, smoothly transitions to an authentic editorial receipt confirmation, with an accessible reset button allowing entry of another address.

### Contrast & Motion Compliance
- All text-to-background combinations meet or exceed WCAG 2.1 AA (4.5:1) and AAA (7:1) contrast requirements.
- Full support for `@media (prefers-reduced-motion: reduce)`, disabling CSS transitions and smooth scrolling for motion-sensitive readers.
- High-contrast `:focus-visible` rings with offset outline for all interactive elements.
