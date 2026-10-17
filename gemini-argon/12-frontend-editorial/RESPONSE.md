# Margin — Issue 14 (*Low Water*) Editorial Landing Page

## 1. Art Direction & Print Translation

**Margin** is designed as an authored literary object rather than a commercial web template. Drawing cues from architectural monographs, hydrographic survey sheets, and independent print journals, the page relies on five foundational editorial devices:

1. **Asymmetric Margin Column**: The desktop layout establishes a persistent left-hand marginalia rail (`176px` wide) separated by hairline rules. This column carries running page folios (`p. 12`, `p. 40`, `p. 62`, `p. 84`), datum coordinates (`DATUM: −3.40m`), and editorial notes—turning the journal’s title (*Margin*) into its structural grid.
2. **Typographic Hierarchy (100% Local Stack)**:
   - **Display & Headlines**: High-contrast old-style serif (`Iowan Old Style`, `Palatino`, `Georgia`) set at tight leading (`0.88–1.06`) for literary authority.
   - **Body & Excerpt Prose**: `Charter` / `Cambria` / `Georgia` set to a disciplined reading measure (`62ch` max) with generous line-height (`1.58–1.68`).
   - **Technical Marginalia & Folios**: Monospace with `font-variant-numeric: tabular-nums` for issue specs, coordinates, page numbers, and subscription pricing (`¥2,400`).
3. **Rules & Uncoated Paper Palette**: Instead of drop shadows, cards, or gradients, sections are divided by `1px` stone rules (`#C8BFA8`) and `2px` iron-gall ink keylines (`#171513`) over a warm uncoated cotton paper surface (`#F4EFE6`), accented sparingly with **Waterline Vermilion** (`#B43C23`) and **Survey Slate** (`#2C4249`).
4. **One Strong Display Motif — The Bathymetric Survey Plate (`FIG. 14.1`)**:
   - An intricate inline SVG hydrographic drawing maps the receding water levels of Issue 14 (*Low Water*, Autumn 2026) from normal weir datum (`0.0m`) down to the drought line (`−3.4m`).
   - Submerged street-grid footprints and three interactive artifact markers (`[01] Shop Ledger`, `[02] Vanished Street Plan`, `[03] Bottle Caps`) directly visualize Imani Vale’s cover essay, *“The River Keeps Its Receipts.”*
5. **Interactive Editorial Utility**:
   - Readers can expand an opening folio excerpt of the cover story directly in place and test the **Reading Mode Control** across three editorial surfaces (**Paper**, **Ledger**, and **Nocturne**), toggle **Large Type** (`112%` root scale), or activate **Quiet Margin** to dim peripheral marginalia.

---

## 2. Responsive Choices & 390 px Mobile Composition

- **Sensible DOM & Reading Order**: The HTML document follows a strict linear narrative order: Skip Link → Reading Mode Utility Bar → Masthead & Issue 14 Specs → Cover Story (*The River Keeps Its Receipts*) & Bathymetric Plate → Supporting Stories (*Night Bus Atlas*, *Concrete Orchards*, *A Language for Empty Pools*) → Compact Archive Strip (Issues 13, 12, 11) → Subscription Offer (`¥2,400` per issue) & Email Form → Colophon.
- **Tablet Breakpoint (`≤ 1040px`)**: The left-hand margin rail converts into a compact horizontal folio header above each section, preserving the running page numbers and notes without squeezing line lengths.
- **390 px Mobile Viewport (`≤ 680px`)**:
  - Fluid `clamp()` display typography scales the masthead and headlines cleanly without horizontal overflow.
  - The sticky Reading Mode bar condenses into a two-tier strip so all surface and typography controls remain reachable by thumb without horizontal scrolling.
  - Supporting story entries stack vertically with inline folio tags (`p. 40 · CARTOGRAPHY & LABOR`), while the back-issue archive strip and subscription input/button pair stack into full-width touch targets (`44px+` height).

---

## 3. Accessibility

- **Semantic Landmarks & Headings**: Proper landmark hierarchy (`<header>`, `<main id="main-content">`, `<article>`, `<section aria-labelledby="...">`, `<footer>`) paired with a keyboard-accessible `.skip-link`.
- **Accessible Inline SVG**: The main hydrographic survey plate includes `role="img"` and `aria-labelledby="plate-title plate-desc"` with descriptive `<title>` and `<desc>` elements; purely decorative mini-diagrams use `aria-hidden="true"`.
- **Keyboard & Screen-Reader Interactive Controls**:
  - Reading mode buttons use `aria-pressed="true|false"` and announce state changes via a polite live region (`#reading-mode-announcer`).
  - The survey plate’s artifact inspector implements the WAI-ARIA Tabs pattern (`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`) with `ArrowLeft` / `ArrowRight` keyboard navigation.
  - The cover story excerpt button manages `aria-expanded` and `aria-controls="cover-excerpt"`.
- **Accessible Client-Side Form Validation**:
  - The subscription form (`novalidate`) validates empty inputs, whitespace errors, missing `@` symbols, and incomplete domains without network requests.
  - Invalid submissions set `aria-invalid="true"` on `#subscriber-email`, shift focus back to the input, and populate `#email-feedback` (`role="status"`, `aria-live="polite"`) with high-contrast error or confirmation messaging.
- **Motion & Contrast**: High contrast ratios across all three reading themes (`Paper`, `Ledger`, `Nocturne`), prominent `2px` `:focus-visible` outlines, and full support for `@media (prefers-reduced-motion: reduce)`.
