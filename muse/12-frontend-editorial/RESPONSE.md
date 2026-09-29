# Margin — Issue 14 "Low Water": Response

## Art direction
Contemporary print editorial carried to the web: a ruled-ledger system (double-rule masthead, hairline folios, numbered story rows) on warm paper with ink-black type and one clay-red accent. The single strong display motif is the oversized "Low / Water" headline paired with an inline-SVG riverbed-contour panel — ten hand-plotted contour paths with survey dots and a mono caption ("contour no. 14"). Supporting print devices: outlined folio numeral "14", drop cap, italic second headline line, and a bordered pull quote. No gradients, no mockups, no pills, no testimonials. Type uses local system stacks only (Iowan/Palatino/Georgia serif for body, system sans for kickers/labels, mono for folio data) — zero network requests.

## Responsive choices
- Desktop: asymmetric two-column hero (1.15fr text / 0.85fr contour panel), three-column story ledger rows (number / title+author / summary), three-cell archive strip, two-column subscribe block.
- ≤860px: everything collapses to one column; the motif panel moves above the headline with a 300px cap so it reads as a banner; story summaries tuck under their titles (grid-column 2); archive stacks.
- ≤430px (390px target): headline scales via `clamp()` with a mobile floor; reading control wraps full-width; email field and button stack vertically at full width; fact row wraps. DOM order (masthead → issue → cover → stories → archive → subscribe) is the reading order, so mobile needs no reordering.

## Accessibility
- Semantic landmarks (`header/nav/main/article/section/footer`), one `h1`, skip link, labelled nav and reading-mode radiogroup with arrow-key support.
- Decorative SVG is `aria-hidden` with a labelled `figure`; color contrast meets AA in all three reading modes (Ink mode re-themes subscribe block so text stays legible).
- Reading-mode buttons use `role="radio"` + `aria-checked` with roving tabindex and visible focus rings; email uses `label`, `aria-describedby`, `aria-invalid`, and `role="status"` live-region feedback for errors/success.
- `prefers-reduced-motion` disables transitions; layout works with JS disabled except the two interactive controls, which degrade to static content.
