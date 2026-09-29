# Relay — Frontend operations dashboard

## Design direction

**Aesthetic:** Industrial utilitarian, tuned for expert operators. **DFII: 15/15** (impact 4, context fit 5, feasibility 5, performance 5, consistency risk 4).

The interface is organized like a control surface: a narrow dark rail anchors navigation, a quiet status strip stays visible, and the main canvas puts service signals ahead of decorative framing. The recognizable design anchor is the thin, deep-green selection rail beside the selected incident, echoed by the throughput line. It gives the operator a consistent “active signal” cue across the dashboard.

## Design system snapshot

- **Typography:** Offline local font stacks only: Avenir Next / Avenir / Segoe UI for interface text and SF Mono / Consolas / Liberation Mono for IDs, times, and measurements. Numeric values use tabular figures for easy scanning.
- **Color:** Warm gray canvas and white surfaces; charcoal navigation; muted green is the operational accent. Severity and warning states use distinct red, amber, and ochre tokens for clear triage. Color values are centralized in CSS custom properties.
- **Spacing:** Compact 4–8 px control spacing and 12–16 px panel spacing; thin dividers separate data without making the screen feel card-heavy. Small radii keep controls distinct without softening the utilitarian tone.
- **Motion:** Short hover transitions only, with reduced-motion support. The chart and status clock update without animated effects.
- **Differentiation:** This avoids generic UI by using a dense response queue, monospaced operational values, and a persistent selection marker instead of oversized cards and decorative gradients.

## Hierarchy and content

The page starts with production context and an on-call marker, then four metrics show current value, change, and trend context. The throughput chart follows as a single broad visual band. The response queue occupies the lower half: searchable and filterable incident rows sit beside the selected incident’s service, owner, age, response state, summary, and acknowledgement action. The chart uses the 24 points from `DATA.json`, scaled so the final point matches the current events-per-minute metric. The seed data is mirrored in `app.js` to keep the page functional from a local file without fetching anything.

## Interaction behavior

- Select an incident using its ID/title button; its row and detail panel update together.
- Filter by severity or response status, or search ID, title, service, owner, and status. “Clear filters” and the empty-state action restore the complete queue. The `/` shortcut focuses search; Escape clears a populated search field.
- “Acknowledge incident” updates the selected incident’s status to acknowledged. An unassigned incident is assigned to the on-call operator, the queue and detail panel refresh, and a confirmation appears. Acknowledgement is retained for the page session.
- The overview, traffic, and incidents navigation links move to their corresponding page sections. The status clock reports UTC time locally.

## Accessibility and responsive behavior

The page uses landmarks, headings, a real incident table with a caption and scoped column headers, labels for search and filter controls, and a titled/described SVG chart. Incident selection and acknowledgement use native buttons; filters use native selects. Focus states are visible, status changes are announced, empty results offer a clear action, and the color-coded severity labels also include readable text. Reduced-motion preferences are honored.

At widths up to 560 px, the navigation becomes a compact top rail, metric cards form two columns, the detail panel stacks below the queue, and each incident row reflows into a labeled two-column summary. All fields remain visible, and the page avoids horizontal scrolling at 390 px.
