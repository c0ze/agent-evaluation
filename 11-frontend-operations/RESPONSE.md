# Relay: design notes

Relay is a single-page operations dashboard built from local HTML, CSS, and JavaScript only. It has no frameworks, no external fonts or assets, and no network requests. Open `index.html` directly from disk.

| File | Role |
| --- | --- |
| `index.html` | Structure: navigation rail, top status bar, summary, throughput, incident table, detail panel |
| `styles.css` | Design tokens, layout, responsive breakpoints, states |
| `app.js` | Seed data (copy of `DATA.json`), rendering, filters, selection, acknowledgement |

## Visual hierarchy

Read order matches the operator's question: *is anything on fire, and what do I do about it?*

1. **Top status bar.** One derived status ("Critical incident open", "No open incidents", and so on), the highest open severity wins, plus per-severity counts and the number of unacknowledged incidents. This is the first thing to read.
2. **Summary strip.** Four metrics in one bordered strip rather than four cards. Each metric has a 24px value (the largest type on the page), a trend line (arrow, change, and a favorable or unfavorable word), and a comparison note. Tone reflects whether the direction is good news: events per minute up is favorable, error rate up is unfavorable, and latency and queue depth down are favorable.
3. **Throughput.** Hourly bars on a CSS grid. The latest hour uses the accent color. A stats row (latest, peak, low, average) sits above the plot so the numbers are read before the shape.
4. **Incident table.** The main working surface. Rows are sorted by severity, then by age (oldest first within a severity).
5. **Detail panel.** The selected incident's fields and its one action. On wide screens it sits in a right-hand column, so the table stays in view.

Styling is deliberately restrained. Dark slate neutrals carry the layout. One teal accent is used for focus, selection, the primary action, the latest bar, and acknowledged tags. Severity colors appear only on severity badges, the overall status, and status-related text. There are no gradients, no glass effects, and no headings above 17px. Corner radius is 3–4px. Numbers use tabular figures, and numeric columns are right-aligned.

## Layout and breakpoints

| Viewport | Layout |
| --- | --- |
| 1360px and up | Rail (188px) · primary column · detail column (352px) |
| 1100–1359px | Rail · single column; detail panel stacks below the table |
| 720–1099px | Rail becomes a top strip; metric strip is 2×2 |
| Below 720px | Rail shows labels only; metrics 2×2; table reflows into one card per incident with a label above each value |

## Interaction behavior

- **Selecting.** Click a row, or activate the incident ID button with Enter or Space. The selected row gets a tint and a left rule, and its ID button gets `aria-current`. Selection survives filtering: if a filter hides the selected incident, the detail panel keeps showing it. On stacked layouts, selecting scrolls the detail panel into view only when it is off-screen.
- **Filtering.** Search matches ID, title, service, owner, age, severity label, and status label (case-insensitive). Selects narrow by severity, service, and status. Owner offers Any, Assigned, or Unassigned. All filters combine with AND. The result line updates ("Showing 2 of 4 incidents"). "Clear filters" appears only while a filter is active.
- **Empty state.** When nothing matches, the table is replaced by "No incidents match these filters" with a Clear filters button. Resetting moves focus to the result line, because the button that was pressed is hidden by then.
- **Acknowledging.** Acknowledge records the time (HH:MM:SS) for the selected incident. The button changes to "Acknowledged" and stays focusable with `aria-disabled="true"`, so keyboard focus is not lost. The row gets an "Acked" tag, the top bar's unacknowledged count drops by one, and a polite live region announces the change. A second press does nothing. Acknowledging does not change owner or status, because the data has no such workflow and inventing one would be wrong.
- **Persistence.** None. Acknowledgements are kept in memory and are lost on reload. There is no server call.

## Accessibility choices

- **Structure.** Landmarks: `nav` ("Sections"), `header`, `main`, `aside` labeled by its title, and `role="search"` on the filter bar. One `h1` (Relay), an `h2` per section, and an `h3` for acknowledgement. A skip link goes to `main`.
- **Focus.** Every control has a 2px teal outline with a 2px offset (`:focus-visible`). Nothing in the stylesheet removes outlines.
- **Not color alone.** Severity is shown as text with a dot. Trend direction is an arrow (hidden from assistive tech) plus screen-reader text ("Up" or "Down") plus the words "Favorable" or "Unfavorable". The unassigned owner is labeled in text.
- **Contrast.** Computed from the palette values: every text pairing is at least 4.5:1, with the lowest at about 6.0:1. Bars are about 4.1:1 against the panel, above the 3:1 non-text threshold. The focus ring is about 7.6:1.
- **Chart.** The bars are an `ol` labeled "Hourly throughput, oldest first". Each bar carries screen-reader text such as "4h ago: 88". The gridlines and axis labels are `aria-hidden` so they are not read twice.
- **Table.** A real `table` with a caption and `th scope="col"`. On small screens the header row is clipped rather than hidden, so screen readers still get column headers for every cell, while sighted users see each field's label above its value. Explicit row and cell roles keep table semantics where WebKit drops them for `display: block` tables.
- **Live regions.** The result line and the acknowledgement announcer are both `aria-live="polite"`.
- **Targets.** Buttons, selects, and inputs are 34px tall. ID buttons are 24px tall, the WCAG 2.2 minimum, and the whole row is also clickable.
- **Text.** Nothing visible is smaller than 11px.
- **Motion.** `prefers-reduced-motion` turns off transitions and makes scrolling instant.
- **Not tested.** No screen reader (NVDA, VoiceOver, TalkBack) and no Safari.

## Decisions to confirm against the real feed

- **Seed data is inlined.** `fetch()` from a `file://` page is blocked by browsers, so `app.js` contains a copy of `DATA.json`. If the data changes, update both.
- **Throughput has no unit.** `DATA.json` does not give one. The chart shows no unit, and its values (peak 88) are on a different scale from Events / min (18,420), so the two are not the same measure. Confirm before presenting them together.
- **Hour labels assume 24 hourly buckets** ending at the current hour: the last bar is "Now", and the first is 23 hours ago. The axis labels every six hours (18h ago, 12h ago, 6h ago, Now).
- **The comparison window is unknown.** `DATA.json` does not say what "change" is measured against. The UI says "vs previous period".
- **Favorability is a per-metric map** (`HIGHER_IS_BETTER` in `app.js`), because a change's direction alone does not say whether it is good.
- **Overall status describes incidents, not service health.** It reflects open incident severity only.
- **Age strings** such as "1h 08m" are parsed to minutes for sorting.
- **"Unassigned"** is treated as the sentinel owner value.

## Verification

- `node --check app.js` passes.
- Headless Firefox, no network, run at 390×844, 768×1024, 1024×768, 1280×900, 1440×900, and 1920×1080. Each size was loaded in an iframe of that size. Scripted checks covered: no horizontal page overflow and no in-flow element past the viewport edge; metric and table content fitting; text at least 11px; control sizes; layout placement at each breakpoint; bar heights scaling to the axis; row order; selection and `aria-current`; acknowledge, including the no-op second press and survival across a re-render; every filter; the empty state and focus after reset; selection kept while filtered out; and ID-button activation keeping focus. All checks passed at all six sizes. The test harness was scratch code and is not part of this deliverable.
- Screenshots were captured, but they were not visually reviewed, so visual polish has not been eyeballed. The checks above are geometric.
