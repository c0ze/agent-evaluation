# Margin — Issue 14: Low Water (Design & Engineering Notes)

## Art Direction

The landing page translates contemporary independent print publishing to the browser through typography, hairline rules, asymmetric proportion, and restrained surface color—avoiding SaaS hero gradients, pill badges, card shadows, and floating mockups.

- **Single display motif (`Fig. 14.01`):** An inline SVG hydrographic datum plate accompanies the Issue 14 spread. Rather than generic decoration, it illustrates the issue theme (*Low Water*) and Imani Vale’s cover essay (*The River Keeps Its Receipts*): receding bathymetric contours, a hatched drought-exposed silt shoal, a faint vanished street grid surfacing in the dry bed, three surveyor artifact markers (`A. LEDGER`, `B. SLUICE`, `C. PIER IV`), and a vertical staff gauge cut by a terracotta datum line at `−1.42 m`. Because every stroke and fill references CSS custom properties (`--ink`, `--accent`, `--bg`, `--surface`), the plate adapts natively across all three reading modes.
- **Typography (100% local stacks):** Editorial display and body prose use a bookish local serif stack (`Iowan Old Style`, `Palatino Linotype`, `Book Antiqua`, `Palatino`, `Liberation Serif`, `DejaVu Serif`, `Georgia`, `serif`) with tight display tracking (`-0.03em`) and optical leading (`0.92–0.94`) for the **Margin** wordmark and **Low Water** title. Small-scale section labels use tracked uppercase system sans, while issue numbers, elevations, page folios, and pricing (`¥2,400`) use tabular monospace (`font-variant-numeric: tabular-nums`) to reinforce a surveyor’s ledger cadence.
- **Editorial grammar & asymmetry:** Strong `2px` section headers pair with `1px` hairline dividers and a dedicated left **margin rail** (`columns 1–2` on desktop) that literally echoes the journal’s name. In *Dispatches*, the three supporting essays avoid a uniform three-card SaaS grid: *Night Bus Atlas* opens as a full-width two-part horizontal row, followed by an asymmetric `1.18fr / 1fr` split separated by a vertical hairline rule for *Concrete Orchards* and *A Language for Empty Pools*.
- **Tactile paper palette:** Default **Paper** mode uses uncoated cotton stock (`#f4efe6`), carbon-silt ink (`#181714`), weathered graphite metadata (`#524d45`), and iron-oxide terracotta (`#9c3b22`) as the sole accent.

## Responsive Choices

The layout is authored mobile-first and verified at **390 px** and **1440 px** viewports with zero horizontal overflow:

- **Natural DOM reading order:** The markup flows sequentially from masthead and navigation to the Issue 14 title (`<h1>`), the hydrographic plate, the cover story (*The River Keeps Its Receipts*), the three dispatches, the compact Issues 11–13 archive strip, the print + digital subscription folio, and the colophon. On desktop (`>= 960 px`), CSS Grid places the plate in columns `8–12` beside the issue header and cover story (`columns 3–7`) without breaking logical DOM or keyboard tab order.
- **390 px mobile composition:**
  - The utility folio bar stacks cleanly with `44 px`-friendly button height on the reading-mode switch, and all four section navigation links fit on one uncluttered row.
  - The desktop left margin rail collapses into a compact single-line horizontal running head (`01 / CURRENT ISSUE` paired with `Datum −1.42 m`, and page ranges on subsequent sections), keeping desktop-only marginalia notes out of the mobile vertical flow so **Low Water** and the datum plate appear promptly above the fold.
  - The archive strip stacks into a compact ledger with aligned issue numbers and seasons, and the subscription email field and button stack full-width at `48 px` height.
- **Tablet (`>= 720 px`) & Desktop (`>= 960 px`) progression:** At `720 px`, the masthead issue ledger moves beside the wordmark, the archive strip arranges into three hairline-divided columns, and the email input and submit button join into a single hairline row. At `960 px`, the 12-column asymmetric spread grid activates.

## Accessibility & Interactive Behavior

- **Semantic structure & navigation:** Proper landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`), a single `<h1>` (`Low Water`), strict heading hierarchy (`h1` → `h2` → `h3`), `<dl>` ledgers for structured metadata, and a keyboard-visible **Skip to main content** link.
- **Accessible inline SVG artwork:** The hydrographic plate uses `role="img"` with `aria-labelledby` pointing to descriptive `<title>` and `<desc>` elements, plus a visible `<figcaption>`. Purely ornamental registration ticks and staff-gauge marks use `aria-hidden="true"`.
- **Functional reading-mode control (`Paper` / `Quiet` / `Night`):**
  - Implemented as native `<button>` controls inside `role="group" aria-label="Reading mode"` using `aria-pressed`, persisted safely via `localStorage` (wrapped in `try/catch`), and announced politely through an `aria-live="polite"` status region on user interaction.
  - **Quiet** mode shifts to warmer sepia paper (`#efe7d5`), enlarges body type (`1.09rem`) and line-height (`1.74`), constrains prose measure, and softens plate opacity (`0.78`) for sustained reading.
  - **Night** mode switches to deep charcoal slate (`#151614`) with warm bone ink (`#eae3d5`) and ochre accent (`#df7757`).
  - Contrast ratios exceed WCAG AA/AAA targets across all modes: primary text is `15.65:1` (Paper), `13.94:1` (Quiet), and `14.22:1` (Night); muted text ranges from `6.68:1` to `7.70:1`; accent, error, and success inks range from `5.98:1` to `8.79:1`.
- **Functional email validation without submission:** The subscription form uses `novalidate` with an explicit `<label>`, `type="email"`, `inputmode="email"`, `autocomplete="email"`, and `aria-describedby` linking both the helper note and the live feedback region (`role="status" aria-live="polite"`). Submitting always calls `event.preventDefault()` so no network request occurs. Empty or malformed inputs set `aria-invalid="true"`, display an inline error message, and return focus to the field; correcting the address clears the error dynamically. Valid addresses render a safe DOM-constructed (`textContent`) local reservation preview echoing the address and subscription terms (`¥2,400 per issue, cancel anytime`), along with a **Use another address** reset button.
- **Focus & motion:** High-contrast `:focus-visible` outlines (`2px solid var(--focus-ring)` with `3px` offset) are preserved on every interactive element, and `@media (prefers-reduced-motion: reduce)` disables smooth scrolling and transitions.
