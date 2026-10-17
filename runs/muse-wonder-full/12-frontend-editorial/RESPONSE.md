# Margin — Issue 14 “Low Water”: response notes

## What was built

A static, dependency-free landing page in three files — `index.html`,
`styles.css`, `app.js` — plus this note. No frameworks, package installs,
remote assets, external fonts, or network requests. All artwork is inline SVG
or CSS; open `index.html` directly in a browser (or serve the folder with any
static file server) to view it.

## Art direction

Contemporary print editorial, not a SaaS template: a newspaper masthead with a
double-rule, a folio rail down the left edge on wide screens (the literal
“margin” of the title), contents listed as a ruled index with page numbers,
and a cover story set in two ruled columns with a drop cap, pull-quote, and a
dashed margin note. The single strong display motif is a **reservoir water
gauge** under the giant LOW / WATER headline — tick marks lengthening as a
rust-red waterline falls to a “LOW WATER ↓” marker — which ties the issue
theme to the page’s system of rules and measures. Supporting stories are
staggered asymmetrically across a 12-column grid (offsets of 0 / 3.5rem / 7rem)
rather than three identical cards, each with its own small SVG: a night-bus
route line, a tree breaking a concrete grid, and empty-pool tiling. Palette is
ink `#171512` on warm newsprint `#ece7da` with rust `#b53f16` and river teal
`#1e4d48`; type is a system serif stack (Iowan/Palatino/Georgia) for display
and body, system sans for labels, and mono for folios and gauge labels — a
real hierarchy with no downloaded fonts. Square corners, hairlines, and
whitespace do the work; there are no gradients, pills, dashboard mockups, or
testimonials.

## Responsive choices

Desktop uses the folio rail, a 1.65fr/1fr hero with a left-ruled contents
column, and staggered stories. At ≤760px everything collapses to one column in
DOM order — masthead, LOW WATER display, gauge, standfirst, contents, cover
story, stories, archive, subscribe — so the 390px reading order matches the
visual order. Display type uses `clamp()` with viewport units so LOW WATER and
the wordmark stay large but never overflow at 390px; the two-column cover story
becomes one column, the archive becomes a single stack, the email field and
button stack full-width, and all interactive targets are ≥44px. A ≤420px pass
tightens the wordmark and makes the hero CTA full-width.

## Accessibility

Landmarks (`header`/`nav`/`main`/`footer`), a skip link, one `h1`, and ordered
headings. The gauge SVG is the one informative illustration and carries
`role="img"` with `<title>`/`<desc>`; every other SVG and the folio rail are
`aria-hidden` decoration, and mini-covers hide their numerals while their links
carry full `aria-label`s. Focus is always visible (3px rust outline), colour is
never the only signal (form errors are text, reading mode shows “On/Off”), and
text colours were chosen for contrast on both paper and the ink subscribe
panel. `prefers-reduced-motion` disables smooth scrolling and transitions; a
print stylesheet drops nav/form chrome. **Reading mode** is a real
`aria-pressed` toggle (`data-reading` on `<html>`, persisted in `localStorage`
where available) that enlarges article text, loosens leading, narrows the
measure to a single centred column, and fades decoration. The **email form**
uses `novalidate` with custom inline validation: empty, spaced, and malformed
addresses get specific messages in an `aria-live="polite"` status region tied
to the field via `aria-describedby`, with `aria-invalid` set/cleared on blur,
input, and submit, focus returned to the field on error, and a success message
that restates the offer (¥2,400, print + digital, cancel anytime) while making
clear nothing was sent — `preventDefault()` guarantees no submission.
