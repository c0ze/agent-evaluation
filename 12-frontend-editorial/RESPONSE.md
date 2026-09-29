# Margin — Low Water

## Art direction

The direction is **a field journal at the low-water mark**: warm uncoated paper, near-black ink, rust accents, oversized bookish type, and fine editorial rules. The large two-line issue title sits beside a custom riverbed illustration. Its nested contours, survey marks, and small recovered receipt connect the artwork directly to the issue and cover essay. The composition takes its cues from printed journals and survey drawings, without representing a real geographic location.

The purpose is to invite a closer look at the current issue and make the subscription offer easy to find. The intended audience is curious readers of independent writing and photography. The supplied issue metadata, titles, authors, and summaries are retained. No full articles or archive pages were supplied, so these are honest editorial listings rather than links to unavailable content.

The display stack starts with locally installed Baskerville and Iowan Old Style, with Palatino and Georgia fallbacks. The smaller utility type uses Avenir/Trebuchet and Courier. No fonts are downloaded. CSS variables hold the paper, ink, rust, muted, and illustration colors. Spacing follows an approximately 8 px rhythm, with fluid gutters. Motion is limited to link feedback, the reading switch, and smooth anchor navigation, all respecting reduced-motion preferences.

Design feasibility assessment: impact 4, fit 5, feasibility 5, performance 5, consistency risk 4; score **15** using the skill's formula. The memorable anchor is the sinuous river cut beside the oversized, italic “Water.”

## Decisions and assumptions

- Chose an asymmetric contents-page composition over a conventional centered hero or a grid of cards, to create a recognizably editorial identity.
- Chose local system font stacks over bundled or downloaded type; the page remains usable offline with no installation step.
- Chose one detailed SVG river illustration and three small CSS vignettes. All artwork is original, inline, and decorative.
- Assumed this is a standalone issue landing page, maintained through three plain source files. It opens directly from `index.html` and requires no server, build process, dependencies, or API.
- Assumed the subscription interaction is a local demonstration. The offer is print + digital, ¥2,400 per issue, quarterly, cancel anytime. The form explains its preview status before submission and never claims a real subscription has been created.
- Performance and scale: static content with no user database, backend, or third-party resources. Email addresses stay in the field and are never stored or transmitted. Only the reading-mode preference is saved locally when storage is available.

## Responsive behavior

The wide layout pairs the issue title with the illustration, uses a three-column cover-story band, and presents supporting pieces in ruled editorial rows. At intermediate widths the masthead navigation wraps onto its own line, and the story summaries gain space beneath their titles.

At **390 px**, the issue heading, short introduction, river illustration, and cover story appear in that order. Story illustrations shrink to marginal vignettes, summaries use the remaining width, and archive entries become compact rows. The subscription panel extends to the viewport edges while retaining the page's text gutter. Below 360 px the email input and button stack. There is no carousel, clipped horizontal strip, or mobile-only menu hiding navigation.

## Accessibility and interaction

- Semantic header, navigation, main, sections, articles, form, and footer; one H1 and a logical heading hierarchy.
- A visible-on-focus skip link, native anchor navigation, persistent input label, keyboard-operable controls, and visible focus outlines.
- Decorative SVG/CSS artwork is hidden from assistive technology; meaningful issue and story information remains regular HTML. The illustration's caption is available as text.
- Reading mode uses a stable button label and `aria-pressed`, announces the change, removes decorative art, limits the overall content width, and increases story type and line spacing. All stories, archive entries, navigation, and subscription details remain available. The preference survives reloads where browser storage permits, with a safe fallback when storage is blocked.
- The email form supports keyboard submission, trims surrounding whitespace, validates missing/malformed addresses, associates help and feedback with the field, sets `aria-invalid` for errors, focuses invalid input, and announces inline results. Editing after feedback clears stale success or updates an error. Success explicitly confirms that this preview has not subscribed or charged anyone.
- The submit button is disabled until the script attaches its handler. Without JavaScript, the full issue is readable, the unavailable reading-mode control is hidden, and the form explains that JavaScript is required. A restrictive content-security policy also blocks connections and form navigation.
- Reduced motion, forced colors, and a simple print stylesheet are supported. No essential information depends on color or motion.

## Deliverables

`index.html`, `styles.css`, `app.js`, and this `RESPONSE.md`. Open `index.html` directly in a browser. All content and artwork are local; no network access or package installation is needed.

## Verification

- `node --check app.js` passed.
- Local HTML parsing confirmed balanced elements, unique IDs, valid fragment links and ARIA/label references, one H1, and the viewport declaration. All four supplied summaries, story authors, archive titles, and subscription terms were checked against the source copy.
- Resource checks confirmed that every stylesheet/script reference resolves locally, CSS includes no imported resources, and JavaScript contains no network API calls. The content-security policy blocks connections and form submission.
- Computed color contrast ratios: body 12.76:1, muted text 5.36:1, rust accent 5.61:1, form note 4.83:1, error 6.13:1, and success 6.21:1. These exceed WCAG AA's 4.5:1 requirement for ordinary text.
- The actual `app.js` was exercised with Node's VM in a local DOM fixture. Checks passed for both reading-mode states, ARIA updates, announcements, restoring a saved preference, unavailable storage, blank/malformed emails, trimmed valid addresses, prevented form submission, error focus, correction, stale-success clearing, and keeping email addresses out of storage.
- Responsive source rules were reviewed for 390 px and narrower screens. **Rendered browser verification remains unconfirmed:** the installed Chrome process aborted with `SIGABRT` inside the sandbox before it could load the local page. No screenshots, real-browser keyboard checks, or assistive-technology checks are claimed. The DOM fixture's email-validity stub also does not replace browser constraint-validation testing.

Every requested file and feature is implemented. No network was used and no packages were installed.
