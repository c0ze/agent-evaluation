# Relay operations dashboard

Open `index.html` directly in a browser. The page reads its snapshot from `app.js`, which embeds the supplied `DATA.json` values so it can run offline. The display assumes a snapshot ending at 23:59 UTC on November 19, 2026. The metric changes compare the displayed period with the preceding 24 hours, and each throughput reading represents thousands of events in one hour.

## Hierarchy

The top bar identifies the production environment and snapshot time. Four metrics use aligned values, smaller units, and signed changes to support a quick scan. The throughput chart shows all 24 readings against their arithmetic mean. Its initial marker identifies the peak of 88k events at 19:00 UTC.

The dark detail panel keeps the selected incident and its acknowledgement action visible beside the chart. The highlighted queue row ties that panel to its source. On narrow screens the metrics form two columns, incident rows stack their fields, and the detail panel follows the queue. At phone widths the navigation rail moves to the bottom edge.

## Interaction

- Hover over the chart to inspect an hour. Click or tap to keep that reading selected.
- Search the queue by ID, title, service, owner, severity, age, or current status. Search and severity filters apply together. The selection stays on the same incident while it matches, then moves to the first remaining match. An empty queue clears the detail panel and offers a filter reset.
- Select an incident by clicking its row or activating its title. On narrow screens, selection moves focus to the detail panel. A return link leads back to the queue.
- Acknowledging an incident updates its queue row and detail status together. The button confirms the acknowledgement and ignores repeated activation. Each acknowledgement is stored locally for this snapshot when browser storage is available. With storage restricted, the update lasts for the current page session.

## Accessibility

The page includes a skip link, named navigation and sections, table headers, labeled filter controls, and visible keyboard focus. Severity badges pair text with graduated bars. The active row has an inset stripe and its button exposes the current selection to assistive technology. Live status messages announce result counts, selections, and acknowledgements.

Press `/` to focus search or `Esc` to clear a focused search. On the chart, arrow keys move one hour and `Home` and `End` select the endpoints. Its accessible value gives the hour, time zone, and volume together. The keyboard button in the rail opens a shortcut reference.

## Verification

Local WebKit rendered the dashboard at eleven widths from 320 to 1440 pixels, including 390 pixels, without horizontal page overflow. Interaction checks covered combined filters, empty-state recovery, row selection, acknowledgement persistence after reload, chart inspection, search shortcuts, and the shortcut dialog.
