# Relay — hierarchy, interaction, and accessibility

Relay is a single light-surface operations board. The dark rail is navigation, the top bar is shift status, and the workspace reads top to bottom: shift summary, throughput, then incidents. Headings follow that order. `h1` is the product name in the rail. Each region is an `h2` (`Shift summary`, `Throughput`, `Incidents`). The selected incident title is an `h3` in the detail panel.

The palette is warm-neutral gray and white, with teal reserved for the current section, the selected row, the peak hour, and the acknowledge action. Severity and health use a separate functional set (critical, high, medium, low, favorable, unfavorable). Those hues are always paired with a word, and severity also uses a distinct mark: square, triangle, diamond, or ring. Trend color is omitted for events per minute because a higher rate is not clearly good or bad. Latency, error rate, and queue depth treat a decrease as favorable. Numbers use tabular figures, including the clock, ages, indexes, and metric values. Corners stay at 2px. Regions are separated with hairline rules instead of shadows, gradients, or large cards.

## Interaction

The rail links move to Board, Throughput, and Incidents. The incident count is the number of incidents that are not acknowledged.

Summary metrics and the 24-hour series are the shift snapshot from `DATA.json`, copied into `app.js` so the page makes no requests. The chart is a 24-button toolbar on a 0–100 scale. Hover or focus updates the readout. Arrow keys, Home, and End move between hours. Min, max, mean, and the last hour are computed from the series. The peak is 88 at 19:00. The minimum is 20 at 04:00.

The incident table filters by search text, severity, service, and status, and sorts from the column headers. Below 800px the same sort control is a select, because the header row is replaced by stacked records. Clearing filters is a no-op until something is set. An empty result names the active filters and offers reset. If the current incident falls outside a filter that still has rows, selection moves to the first remaining row. A filter that matches nothing keeps the previous selection and restores it when the filters are cleared.

Selecting a row, by click or by arrow keys, opens it in the detail panel. Acknowledge sets status to acknowledged, stores the UTC time, and attributes the action to Desk 4. Severity and owner stay as recorded. The same control undoes the acknowledgement and restores the previous status. The health chip and the rail count follow the remaining unacknowledged incidents: critical active is Degraded, high active is Elevated, anything else still open is Watching, and a fully acknowledged queue is Nominal.

Ages stay at the snapshot strings. The UTC clock is the only live ticker.

## Accessibility

The page is one set of landmarks: navigation, banner, search, and main, plus a skip link to the workspace. Focus rings are 2px, inset on the dark rail so they are not clipped, and near-black on light surfaces so they stay visible on the teal button. Mouse clicks do not keep a stray ring. Keyboard focus does.

The chart toolbar is one tab stop. Bars name the hour, index, and peak. A text summary (minimum, maximum, mean, last hour) sits under the plot. The incident table keeps native headers on wide screens. On narrow screens each cell carries its own text label, so the stacked layout does not depend on color or on CSS-only captions. Status and severity are never color alone.

Filter changes update an `aria-live="polite"` count. Acknowledge and undo write a separate polite message with the incident id, time, and resulting status. The clock is not a live region. `prefers-reduced-motion` removes smooth scrolling. `forced-colors` keeps the bars and the acknowledge button visible. At 390px the rail becomes a top bar, metrics wrap to two columns, and incidents become stacked records, so the page itself does not scroll sideways. Inputs use 16px type at that size so mobile browsers do not zoom the viewport on focus.
