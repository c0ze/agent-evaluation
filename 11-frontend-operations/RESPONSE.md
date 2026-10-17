# Relay — design notes

Open `index.html` directly in a browser (or serve the folder statically).
No build step, frameworks, fonts, or network requests: `index.html` loads only
the local `styles.css` and `app.js`. Seed content from `DATA.json` is embedded
verbatim in `app.js` (rather than fetched) so the page also works from
`file://`, where `fetch` of a local JSON file is blocked.

## Hierarchy

The page reads top-down in the order an operator triages: **status first**
(top bar: environment, count of unacknowledged criticals, UTC clock), then
**system health at a glance** (four summary metrics), then **shape of the day**
(24-hour throughput), then **actionable work** (incident table), with the
selected incident's detail pinned beside the table so the eye never has to
travel far between list and detail. A slim 64 px navigation rail keeps
wayfinding permanent without consuming data width.

Density over decoration: 14 px system-font body, 12–13 px labels, hairline
borders instead of shadows, a 6 px radius used sparingly, and panel headings
at 13 px — no hero type. The palette is neutral grays on white panels with one
purposeful accent (deep teal `#0b6e5d`) reserved for the chart line, links,
selection, focus, and the primary action. Severity colors (red/amber/yellow/
slate) are functional signals, always paired with a text label, never the only
carrier of meaning. All numbers use `font-variant-numeric: tabular-nums` and
right-aligned age/value columns so columns scan cleanly; IDs and service names
use a monospace stack.

Metric trends judge direction against what is *good* for that metric (latency
and queue depth down = green; error rate up = red), show the delta plus a
"vs previous hour" frame, and expose the direction in words for screen
readers (the arrow glyph is `aria-hidden`).

## Interaction behavior

- **Filtering:** free-text search (ID, title, service, owner) plus severity and
  status selects filter live on every keystroke/change. A polite live region
  announces "N of 4 incidents shown." When nothing matches, the table is
  replaced by an explicit empty state explaining the situation, with a
  *Clear filters* action (duplicated in the filter bar, so either path resets
  and returns focus to the search field).
- **Selection:** each incident ID is a real `<button>`, so keyboard users get
  the same behavior as mouse users. The selected row is highlighted,
  `aria-current` marks the active button, and the detail panel (impact,
  started time, next step) updates in place.
- **Acknowledge:** sets the incident's status to `acknowledged` everywhere at
  once — table row, detail panel, and the top-bar critical count. An
  unassigned incident is claimed by "You (operator)". The button then disables
  with an "Acknowledged ✓" label, a timestamped note records who acknowledged
  and when, a live region confirms the change, and focus stays on the button
  so keyboard context is not lost. Acknowledged becomes a filterable status,
  so operators can verify the new state through the filter path too.
- **Chart:** generated inline SVG from the 24 seed values, with labeled
  gridlines, hour ticks, a peak annotation, and a summary line (peak/avg/now).

## Accessibility choices

Semantic landmarks (`nav`, `header`, `main`, `aside`, `footer`), a skip link,
real tables with `scope="col"` headers and captions, and labelled form
controls throughout. The SVG carries `role="img"` with a text summary
(peak/low/average) and is backed by an expandable hourly data table, so the
chart is never the only route to the numbers. Status is conveyed by dot +
word, severity by badge text. Every interactive element gets a 2 px accent
`:focus-visible` outline. `prefers-reduced-motion` disables transitions.
The clock updates silently (not a live region) to avoid screen-reader chatter;
filter counts and acknowledgements use `aria-live="polite"`.

## Responsive behavior

At ≤760 px the rail collapses to a horizontal bar, metrics go two-up, the
chart/table/detail stack in one column, filters stack full-width, and the
sticky detail panel becomes static. The incident table scrolls inside its own
wrapper (`overflow-x: auto`) rather than the page, so at 390 px there is no
horizontal page scroll and every control remains reachable.
