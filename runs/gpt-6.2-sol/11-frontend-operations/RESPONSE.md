# Relay operations dashboard

Open `index.html` in a browser. The dashboard loads from disk using the adjacent CSS and JavaScript files. The metrics, hourly readings, and incidents are embedded from `DATA.json` so opening the page requires no server.

## Visual hierarchy

The dark navigation rail anchors the workspace, while the status bar identifies the local snapshot and its UTC time. Four aligned metric cards show the latest values and their change from the previous hour. The full-width throughput chart makes the daily shape and peak easy to scan. The chart interprets the supplied readings as percentages of capacity. The snapshot date, comparison period, and incident summaries supply context for the seeded figures.

The incident list and selected detail sit side by side on wider screens. Compact severity badges carry readable labels, and the selected row has a tinted background and an inset edge. On narrow screens, the rail becomes a horizontal navigation strip, the metrics form two columns, and the incident rows reflow into labeled cards with the detail panel below.

## Interaction

Search matches incident titles, IDs, services, owners, and other row values. Search terms combine with the severity and status filters. The detail panel follows the current selection when it still matches and switches to the first match otherwise. An empty result offers a clear-filters action.

Select an incident title or click its row to inspect it. On stacked layouts, selection moves focus to the detail panel and **Back to incidents** returns focus to the selected row. **Acknowledge incident** updates the status in both views and reapplies the filters. Acknowledgements persist on reload when browser storage is available.

## Accessibility

The rail, headings, metric definitions, form labels, and incident column headers provide structure for assistive technology. The page has a skip link, visible focus outlines, and live announcements for filtering and acknowledgement. Severity, status, and trend direction are conveyed in text as well as visually.

The chart is a single tab stop with a labeled button for each hour. Arrow keys move between readings, Home and End jump to the first and last hours, and Enter or Space keeps the focused reading selected. Pressing `/` outside an editable field focuses incident search.
