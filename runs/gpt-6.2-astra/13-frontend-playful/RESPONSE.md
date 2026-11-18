# Moss

Open `index.html` directly in a browser. The plant records and seven weekly counts are included in `app.js` so the screen works offline, including from a local file.

## Personality

Moss takes its visual cues from a gardener’s notebook. Warm paper, soft ink outlines, an enamel-yellow watering can, and four individually drawn plant portraits give the garden a familiar face. The fern’s fronds, the pothos’s trailing vine, the cactus’s paired pads, and the calathea’s striped leaves help people recognize their plants even at thumbnail size.

## Interaction

Today opens with Frida’s overdue watering, followed by Orbit’s rotation and Dot’s soil check. Drama appears under Coming up. Selecting a plant from either Today or My plants opens its care details, including light conditions, watering guidance, the last recorded drink, and dated observations.

Completing a task moves it to Care completed and adds a journal entry. Snooze moves it to the next local calendar day. Logging an extra watering in a plant’s details preserves its other scheduled care. A confirmation offers Undo for twelve seconds. Undo restores both the schedule and the journal. The timer pauses while the confirmation is hovered or contains keyboard focus. Recent changes can also be undone with Control+Z or Command+Z.

When the queue clears, Moss names the next plant and task. The weekly chart reads the supplied seven counts from Monday through Sunday, with today underlined and its bar hatched. Field notes cycle through observations from the plants’ histories. Care changes persist in local browser storage when available and otherwise last for the session.

## Layout and accessibility

On phones, the queue comes first, with actions beneath each plant and the weekly chart and notes below. Wider screens place the chart and notes alongside the queue. Navigation uses links, care actions use buttons, and a skip link leads directly to the main content. The native detail dialog contains keyboard focus, supports Escape, and returns focus to the plant on close.

Overdue care has a written status, a clock symbol, and a warm tint. Chart values are visible and have full weekday labels for screen readers. Care confirmations are announced through a live region. Keyboard focus has a visible outline, illustrations are hidden from assistive technology, and motion effects only run when reduced motion is not requested.
