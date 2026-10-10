# Relay: operations control room

Files: `index.html` (structure), `styles.css` (tokens, layout, responsive rules), `app.js` (data, rendering, interaction). Open `index.html` directly from disk. There are no dependencies, fonts, remote assets or network requests.

**Data.** `app.js` contains a verbatim copy of `DATA.json` (`SEED`). I embedded it instead of calling `fetch()` for two reasons: browsers block `fetch()` of a sibling file under `file://`, and the brief rules out network requests. If `DATA.json` changes, update `SEED` to match. Two values are derived from the seed and shown as such: incident ages count up from the time the page loads, and the chart's hour labels are placed so the last bar is the current UTC hour. The throughput values are shown as "% of provisioned capacity" against an 85% scale-out threshold. The seed data has no units for them, so that label is an assumption.

## Visual hierarchy

1. **Status bar (always visible).** It shows the system state in one line, for example "Degraded · 1 critical · 4 active · 2 awaiting ack". The dot uses the severity colour of the worst incident. The bar also shows the environment, a UTC clock and the operator. It stays pinned to the top so the state is visible while you scroll.
2. **Summary metrics.** Four cells sit in one bordered strip rather than four separate cards. Each has an uppercase label, a large tabular-figure value with a smaller unit, and a trend line: arrow, change, "vs prior 24 h", and "better" or "worse". The trend is only coloured green or red where the metric has a clear good direction: latency, error rate and queue depth go green when they fall and red when they rise. Events/min measures volume, so it has no verdict and stays neutral.
3. **Throughput, last 24 h.** Inline SVG bars on a quiet grid. The only accent colour is on the bars. Hours at or above the dashed 85% threshold switch to the "high" severity colour, because that is the one thing an operator should notice in this chart. The header states peak, low and average. A readout under the chart shows the hour under the pointer or keyboard cursor.
4. **Incidents plus detail.** This is where the operator works. On wide screens the table and the detail panel sit side by side, and the detail panel is sticky.

Palette: neutral greys, one blue accent (selection, primary action, focus, chart bars), and four severity colours used only for incident state. Each severity also has its own glyph (triangle, diamond, square, circle) and its word, so colour never carries meaning alone. The type is the system UI stack at 13px with tabular numerals throughout. There are no gradients, blur or oversized headings, and corners use a 4px radius. Light and dark themes both follow `prefers-color-scheme`.

## Interaction behaviour

- **Filters.** Search matches ID, title, service, owner, status and severity. Severity is a four-way multi-select toggle group with counts. Status is a select with counts. Results update as you type or change a filter. **Clear** only appears when a filter is active. Pressing `/` anywhere outside a text field focuses search, and `Esc` clears it.
- **Empty state.** When nothing matches, the table body is replaced by an explanation of the active filters (for example: "Filtered by search "zzz" · severity high. 4 incidents are hidden.") and a **Clear filters** button, which returns focus to search. Unchecking every severity reports "no severities selected".
- **Sorting.** The Severity and Age headers are sort buttons. The default is most severe first, with older incidents first within a severity. Clicking a header toggles direction, and `aria-sort` is kept in sync.
- **Selection.** Each row's ID/title is a real `<button>`, and the whole row is a larger pointer target for the same action. With a row button focused, `↑`/`↓`/`Home`/`End` move through rows and select as they go. The selected row gets an accent tint and left bar, plus `aria-current`. On load, the most severe incident still awaiting acknowledgement (INC-2839) is selected, so the main action is visible straight away. If filters hide the selected incident, the panel stays open and says it is hidden from the list.
- **Acknowledge.** Only incidents with status `open` need acknowledging. For the others the panel says they are already acknowledged and by whom. **Acknowledge INC-xxxx** changes the status to *Acknowledged*. If the incident is unassigned, it also assigns it to "You". It adds a timestamped entry to the Activity timeline and updates the table, status bar, rail badge and filter counts together. Focus moves to the confirmation message and a screen-reader announcement is made. **Undo acknowledgement** restores the previous status and owner and moves focus back to the Acknowledge button. State is in memory only, so a reload resets it.
- **Chart.** Hovering or tapping shows the value for that hour. The chart can also be focused and scrubbed with `←`/`→`, `Home`/`End` and `PageUp`/`PageDown` (six hours at a time).
- **Responsive layout.**
  - ≤1180px: the detail panel moves below the table. Activating an incident scrolls to it and focuses its heading.
  - ≤900px: metrics become a 2×2 grid, and table rows become stacked records (ID and title with age, then severity, service, owner and status). The header turns into a small "Sort" bar, so the sort buttons stay visible and reachable.
  - ≤720px: the navigation rail becomes a bottom tab bar. The status bar wraps so the system state gets its own line. The severity filter stretches to full width.
  - At 390px nothing forces the page to scroll sideways. Every grid track uses `minmax(0, 1fr)`, the chart is drawn to the width of its container, and the 24-hour data table scrolls inside its own box.

## Accessibility choices

- **Structure.** The page has a skip link, landmarks (`nav`, `header`, `main`, `aside`), one `h1` that is visually hidden, and `h2`/`h3` headings for each region. Rail links jump to section headings and move focus there. Rail items that are not built yet are plain text marked "(unavailable)", not dead links.
- **Visible focus.** A 2px focus outline in the accent colour with an offset appears on every interactive element: links, buttons, sort headers, checkbox toggles (drawn on the visible segment), inputs, the chart and summary elements. Headings that receive focus programmatically get the same outline.
- **Table semantics.** The table has a caption, scoped headers and `aria-sort`. JavaScript adds explicit ARIA table, row and cell roles, so the phone layout keeps its semantics after the table elements are switched to block and flex display.
- **Announcements.** One polite live region reports filter results ("2 of 4 incidents shown"), sort changes and acknowledge/undo. It is cleared before each message so repeated messages are still read out.
- **Text alternatives.**
  - Severity is always given as a word plus a glyph.
  - Ages have a spoken form ("1 hour 8 minutes old").
  - Metric trends have hidden text such as "down 12 ms, favourable".
  - The chart is a `role="slider"` whose `aria-valuetext` gives the hour and value for each step. It is described by the peak/low/average summary.
  - A "Show hourly values as a table" disclosure holds the full data table.
- **Contrast and motion.** The palette was chosen to keep body text and severity text readable on their tinted backgrounds in both themes, but I did not measure contrast ratios. With `prefers-reduced-motion`, the timeline highlight animation and smooth scrolling are turned off. In `forced-colors` mode, severity chips and the selection keep visible borders.

## Verification and limits

I could not open the page in a real browser: none is installed, and I did not use the network. `node --check` passes. A Node smoke test with a stub DOM ran `app.js` through startup, acknowledge, undo and a filter with no results. The status bar, detail panel, announcements and empty-state text all came out correctly. What remains unchecked is how the page actually looks and behaves in a browser: layout at 390px, pointer hit-testing on the chart, and screen-reader output. Do a quick check in a real browser, including the phone layout, before relying on it.
