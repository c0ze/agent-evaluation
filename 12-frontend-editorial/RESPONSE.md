# Margin, Issue 14

## Art direction

The page is set like a contemporary quarterly, not a product site. The ground is warm uncoated paper and the text is near-black ink. Didot carries the issue title, the story titles, the price, and the archive numerals. Iowan Old Style carries the essays. A monospaced face is reserved for the masthead line, bylines, indexes, and the two controls, so the survey notes stay distinct from the reading text.

The one motif is a river staff gauge, for an issue called Low Water. On a wide screen a vertical tick staff runs in the left margin. A clay low-water line crosses the gap between “Low” and “Water” and meets that staff. The same clay rule returns once, above the subscription. Everything else is black hairlines, plus a newspaper double rule under the masthead and again at the close. There is no gradient hero, no cards, no pills, and no invented testimony. The pull phrase beside the cover essay is taken from the supplied standfirst and is marked as coming from that essay.

## Responsive choices

The layout is mobile-first and follows the DOM order: masthead, contents links, issue title, cover essay, the three stories, the archive, the subscription, then the colophon. At 390px that sequence is a single column. The title stays large, the waterline bleeds to the left edge and stops at the text measure, and the archive is three compact rows. From 720px the archive becomes one ruled strip. From 860px the cover phrase sits beside the headline, Night Bus Atlas keeps a large index beside its text, and the other two stories share a row. From 960px a sticky spine holds the vertical wordmark, the gauge, and “Issue 14.”

Reading mode leaves that spread. It hides the spine, sets one column about 42rem wide, enlarges the body, and switches to a dark paper ground so the control is obvious. Type is local only: Didot and Iowan, with Bodoni, Georgia, and Times behind them.

## Accessibility

The heading outline is one h1, “Low Water,” then h2s for the cover essay, the three stories, the archive, and the subscription. The gauge is decorative. The spine is hidden from assistive technology because it repeats the masthead, and the waterline is hidden as well. A short visually hidden sentence still describes the line, so the metaphor is available as text and does not interrupt the title.

Reading mode is a button with `aria-pressed`, a label that changes to “Exit reading,” and a polite live region. The email field has a visible label, a standing hint, `aria-describedby`, and `aria-invalid`. An incomplete address produces a written error and a heavier underline. A well-formed address produces a written confirmation that nothing was sent. The form never navigates and never transmits. Focus is a two-pixel ink outline, a skip link moves to the main content, and the controls are at least 44px tall. Text, including the clay label and the dark reading ground, stays above WCAG AA. Reduced motion turns off smooth scrolling, and forced colors keep the control borders.
