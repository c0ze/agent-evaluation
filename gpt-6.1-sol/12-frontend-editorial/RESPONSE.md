# Margin — Low Water

All requested deliverables are implemented: `index.html`, `styles.css`, `app.js`, and this explanation. Open `index.html` directly in a browser; no server, installation, framework, or internet connection is required.

## Art direction

**A field journal translated into print editorial.** Warm paper, dark ink, and rust red give Issue 14 a specific visual identity. The oversized Margin masthead, two-line Low Water title, thin rules, small typeset annotations, and unequal hero columns establish the page's hierarchy. The display motif is a river cut through fine sediment lines: a dry channel revealing the traces around it. It is original inline SVG, accompanied by three restrained drawings of a bus route, an orchard inside a building frame, and an empty tiled pool.

Typography uses locally available Baskerville with Palatino and Times fallbacks for display, Georgia for reading, and Courier for metadata. There are no font downloads. Font rendering will vary between operating systems. The scale of the headlines carries the design, while comfortable text measures and generous line height keep summaries legible. Spacing follows a roughly 8 px rhythm, with larger gaps marking changes in editorial scale. Motion is limited to link and button interactions; there are no entrance animations or continuous effects.

The design feasibility assessment was **14**: impact 4, context fit 5, implementation feasibility 4, performance safety 4, less consistency risk 3. A purely typographic treatment and a collage treatment were considered; the river map was chosen because it gives the issue a memorable, relevant motif without remote imagery or large assets. Its asymmetry and print conventions make the page feel authored.

## Content and responsive choices

The page includes Low Water, Issue 14, Autumn 2026; the Imani Vale cover story; all three supporting stories and their authors and supplied summaries; Issues 13, 12, and 11 with their supplied titles; and the offer of **print + digital, ¥2,400 per issue, cancel anytime**. Main navigation and the issue CTA lead to real sections. Story titles and archive entries are editorial content rather than links to nonexistent pages.

Desktop pairs the issue introduction with the river artwork. The cover story uses three unequal columns, followed by a three-column story layout and compact archive strip. At 1,000 px, spacing and form layout adapt. At 700 px and below, including **390 px**, the masthead and its tagline occupy separate lines, and the main content becomes one column: issue introduction, artwork, cover story, supporting stories, archive, subscription. The artwork uses a shallower crop, and archive entries become compact rows. At 370 px, gutters and secondary type tighten further. Important content keeps its HTML order across breakpoints.

## Accessibility and working controls

- Semantic header, navigation, main, sections, articles, figure, and footer; one H1 and a consistent heading hierarchy.
- A keyboard-visible skip link, clear focus outlines, named controls, and native links and buttons. The reading-mode control has a 44 px mobile target, and email controls are at least 50 px high on mobile.
- Decorative SVGs and ornamental marks are hidden from assistive technology; the main figure retains its visible caption. Meaningful text is HTML, not part of an image.
- Reading mode is a keyboard-operable toggle with `aria-pressed` and an On/Off indicator. It removes decorative artwork, enlarges summary text to 18 px, and presents stories in one column. It preserves navigation, content, and the subscription form. Its state lasts for the current page session and requires no storage.
- The email field has a persistent label, appropriate input type and autocomplete, and inline help. Validation trims surrounding whitespace, uses native email validity, and checks for a complete domain. Empty and invalid inputs receive distinct feedback, `aria-invalid`, and focus. A polite live region reports errors and success. Editing clears stale feedback.
- The form explicitly describes itself as a local preview. Every handled submission prevents default navigation. Success confirms validation and clearly states that no subscription or email submission occurred. The submit button remains disabled until its JavaScript handlers are installed, so the preview cannot submit without JavaScript. Email is not written to app storage or sent anywhere.
- Tested text color pairs meet WCAG AA contrast: main text 12.45:1, muted text 5.21:1, and rust text 5.40:1 against paper. Subscription and illustrated-label text pairs also exceed 4.5:1.
- Reduced-motion preferences disable smooth scrolling and transitions. Print styles simplify the layout and omit interactive controls and decorative artwork.

## Assumptions and validation

This is a self-contained editorial landing page and signup preview, with no backend or checkout. The supplied content defines the publication and issue. Files are maintained directly without a build step. Performance comes from a small stylesheet, small script, native typography, and inline drawings. Neither interaction makes a network request or persists personal data.

Completed local checks:

- JavaScript syntax check with `node --check app.js`.
- HTML checks for unique IDs, valid section destinations, one main heading, and local asset references.
- Reading-mode and form event-handler tests in Node using DOM stubs: repeated toggle states, 11 empty/invalid/valid email cases, whitespace trimming, error focus, inline feedback, feedback clearing, and prevention of submission. These exercise application logic; they do not substitute for native browser validation or layout testing.
- WCAG contrast calculations for the text/background pairs; offline-code inspection; CSS brace balance; reduced-motion and no-JavaScript fallback checks.
- Local CoreText measurements informed the mobile masthead correction.

**Verification limit:** installed Chrome aborted when launched inside this environment's restrictions. Desktop and 390 px browser rendering, actual browser keyboard interaction, and screen-reader behavior could not be visually or interactively verified. No browser screenshots are claimed. All requested implementation deliverables are complete; a real-browser visual check remains recommended when opening the page outside this environment.
