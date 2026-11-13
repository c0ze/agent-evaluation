# Margin — Issue 14 landing page

Open `index.html` directly in a browser. There is no build step, and the page makes no network requests: three local files, system fonts, and inline SVG.

| File | Role |
| --- | --- |
| `index.html` | Semantic markup, all copy, inline SVG artwork |
| `styles.css` | Layout, type, both reading modes, print and forced-colours rules |
| `app.js` | Reading mode, gauge marker, email validation (no dependencies) |

## Art direction

**The motif is a river staff gauge.** The journal is called *Margin* and the issue is *Low Water*, so the page's left margin is drawn as the ruled gauge that stands in a river to show its level.

- **The waterline cuts the title.** A 2px rule crosses the whole page through the word "Water". Above it the letters are solid ink. Below it they are hatched in a water colour and nudged sideways, the way a stick looks bent where it enters water.
- **The cover story sits below the line.** Everything under the rule is a flat water tint, so "The River Keeps Its Receipts" is literally what lies beneath the low water.
- **Earlier issues are higher marks.** Issues 11–13 are marked on the gauge above the line, with Issue 14 in the spot colour at the waterline.
- **The gauge runs the full page.** Every section rule extends to it like another reading, and a small marker slides down it as you scroll.

Everything else stays quiet so the motif carries the page:

- **Type:** one high-contrast serif for display, a text serif for reading, and a monospace for marginalia such as issue numbers, bylines, and labels. All are system font stacks.
- **Colour:** paper, ink, one oxide-red spot colour, and one water tint. There are no gradients, shadows, or rounded cards.
- **Composition:** "Low" is italic and pushed right, with the issue line in the white space it leaves. The three supporting stories are staggered across a 12-column grid at different widths and heights rather than set as three equal cards.
- **Plates:** each supporting story has a small one-colour line drawing (a night route over a dotted street grid, trees between unfinished floor slabs, a drained pool in section).
- **Subscription:** the price is set as display type beside a ledger with dotted leaders, a nod to "receipts".

### Two choices worth knowing about

- **Reading mode is Paper / Night.** I read "reading-mode control" as a light or low-glare dark palette. It follows the system setting on first visit, is remembered in `localStorage` after you choose, and is applied before first paint so there is no flash.
- **The form's success message says nothing was sent.** The task rules out real submission, so the confirmation states that this preview page has not sent or stored the address, rather than implying a subscription exists.

I added very little copy beyond `COPY.md` and the task: the "Field essay" label, section labels, the ledger wording, form messages, and the colophon. I left out seasons for the archive issues because they were not supplied.

## Responsive choices

Mobile is the base stylesheet; wider layouts are added at 46rem and 64rem.

- **390 px:**
  - The gauge narrows to a 44px margin but keeps its ticks, numerals, and the waterline.
  - The title is sized in viewport units so "Water" fills the column.
  - Reading order is masthead, issue line, title, cover story, three stories, archive, offer, form, colophon. Source order and visual order match, so nothing is reordered with CSS.
  - The archive is three compact ruled rows.
  - The input and button are full-width and 52px tall, with the error message directly under the field.
- **46rem and up:**
  - The cover story, stories, archive, and subscription open onto the 12-column grid.
  - The issue line moves beside "Low".
  - The archive becomes a single ruled strip.
- **64rem and up:**
  - The masthead becomes one line.
  - The gauge marks are spelled out ("No. 13").
  - The field and button join into one row.
- **Fallback fonts:** the title size is set for the widest serif I could test (DejaVu Serif), so it does not overflow where Didot or Bodoni are missing.

## Accessibility

- **Structure:** landmarks (`header`, `main`, `footer`), labelled sections, one `h1`, ordered `h2`/`h3` headings, and a skip link.
- **Artwork:** all of it is decorative and hidden from assistive technology (`aria-hidden`, `focusable="false"`). The hatched duplicate of "Water" is hidden too, so the title is read once as "Low Water". The gauge's issue numbers are repeated as real text in the archive.
- **Reading mode:** native radio buttons in a labelled `radiogroup`, so arrow keys and state announcements work without custom scripting. The selected option is shown by a filled marker, an underline, and bold weight, not colour alone.
- **Form:**
  - It has a visible label.
  - Errors are specific ("That address is missing an @…").
  - An error is tied to the field with `aria-describedby` and `aria-invalid`, and marked with a "×" and a thicker border as well as colour.
  - A failed submit returns focus to the field.
  - Validation stays quiet while you first type, then re-checks on each keystroke once an error has been shown.
  - On success, focus moves to the confirmation so it is read out.
  - "Use a different address" restores the form and its focus.
- **Contrast:** body text is 14.8:1 on paper and 11.2:1 on the water tint. Secondary text is at least 4.8:1 and the spot colour is 5.5:1 on paper. Night mode is at least 5.4:1 for all text. The gauge ticks are about 3:1 and carry no information.
- **Preferences:**
  - `prefers-reduced-motion` stops the title drift, transitions, and smooth scrolling.
  - `forced-colors` drops the clipped title effect so the system palette draws the word whole.
  - A print stylesheet removes the controls.
- **Targets:** interactive targets are 44px or taller on mobile, and focus rings are 2px in the spot colour.
- **Without JavaScript:** all content and the offer remain. The page follows `prefers-color-scheme`, and the two controls that cannot work are hidden, with a note in place of the form.

## What was and wasn't checked

I rendered the page in headless Firefox 160 at 320, 390, 768, and 1280 px in both modes, and ran the real `app.js` through a temporary scripted harness, which I removed afterwards.

- **Passed:** mode switching and persistence, every validation branch, the success and reset focus moves, the gauge marker, and no horizontal overflow down to 320 px.
- **Not checked:**
  - Chromium and Safari.
  - A screen reader.
  - Rendering with Didot, Bodoni, or Palatino, which this machine does not have. The checks used Noto Serif and DejaVu Serif.
  - The focus ring was not captured in a screenshot, because headless Firefox does not show `:focus-visible` for scripted focus.
