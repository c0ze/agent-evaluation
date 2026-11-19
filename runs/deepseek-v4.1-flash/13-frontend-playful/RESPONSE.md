# Moss — design notes

## Personality

Moss is a quiet plant companion with a dry sense of humor and a lot of patience. It lives on warm paper: cream stock, deep forest ink, terracotta pots, marigold highlights. The type is a bookish serif for names and headlines, a system sans for instructions, and a small monospaced label style for the household's practical notes. Nothing has a perfectly square corner; panels use unevenly rounded, blob-like shapes and sit slightly off-axis. A taped, hand-rotated note and an "overdue" rubber stamp give it the feeling of a kitchen noticeboard rather than a dashboard.

The copy carries the personality without getting in the way of the task. Frida is "being graceful about it"; Dot's soil is "dry two knuckles down"; Drama "has notes." The artwork is hand-authored inline SVG: four distinct plant portraits on soft paper blobs, a mound-and-sprout brand mark, and a slightly sleepy watering can for the all-done state. Every illustration is local and decorative; no remote fonts, images, or requests are involved.

The queue is deliberately not a wall of equal cards. Overdue care gets a full dark-moss hero panel with a generous portrait and a rubber stamp. The remaining plants are flat list rows with small portraits, hairline rules, and no repeated card chrome. The weekly rhythm is a seven-stem garden strip whose leaf count matches the `week` data; today's stem is terracotta with a gold day tag.

## Interaction model

- **Queue order** is `urgency` descending. Frida (2 days overdue) opens as the hero; the two "Today" tasks follow, then Drama's "Tomorrow" task. The progress meter and count frame the queue as a finite, gentle list.
- **Detail** is a persistent "Field notes" panel. Selecting a plant's name updates and highlights it; on narrow screens the panel is unfolded below the queue and the page scrolls to it, with focus moved to the plant heading. Each plant gets a light read, last-watering date derived from its history, a water-care note, and a categorised observation/care timeline (Water, Light, Note).
- **Completing** uses the plant's own task verb: Frida is **Watered**, Orbit is **Rotated**, Dot's soil is **Checked**, Drama is **Misted**. A completion records a `Today` history entry, increases today's leaf count, moves the plant to "Settled today," and advances the meter. **Snooze** defers the plant to tomorrow and also settles it for today without inflating the care count.
- **Undo** is deliberately easy: a low toast appears after each action with an Undo button (9 seconds; pauses while hovered or focused), every settled row has its own persistent Undo, and the all-done panel offers "Undo last." Undo restores the exact prior status, history snapshot, and sort position.
- **All-done** is a designed destination, not an empty list. It reports what happened, lists the receipts, offers a way to revisit the week, and keeps the last action reversible. The final action suppresses the toast so the celebration and its buttons are unobstructed. The settled list remains below for context.
- **Keyboard**: all interactions are native buttons. Up/Down/Home/End move between plant names in the queue and settled list. After an action removes its card, focus moves to the next plant (or to the all-done heading); after a detail action, focus stays on the detail heading; undo returns focus to the restored plant. The mobile "Back to the list" control returns to the chosen plant.
- **Responsive composition**: on wide screens the page is a three-zone composition—sticky weekly rail, a 590 px care column, and a sticky 380 px field-notes card—rather than one stretched mobile column. At tablet widths the week becomes a horizontal band above a two-column queue/detail split; below 960 px everything stacks in reading order. The layout was checked from 320 px to 1440 px with no horizontal overflow.

## Accessibility choices

- **Structure**: skip link to the queue; `header`/`main`/`footer`; one `h1`; plant names are `h2` headings with button controls inside; the detail timeline is `h3`. Sections are labelled, and the queue list has a screen-reader hint for the arrow-key navigation.
- **Semantics and names**: true `button` elements throughout, including the task controls, Undo, and the plant selectors. Completion controls have explicit names such as "Mark Frida as watered"; snooze names include the plant. The selected plant uses `aria-current="true"` and `aria-controls="detail"`.
- **Status and progress**: the meter is a labelled `progressbar` with live `aria-valuenow`; a polite live region announces actions, undo, selection, and the final "queue is clear" message. The toast is a labelled region, not a second live region, so announcements are not duplicated. Toast autodismiss pauses on hover/focus, and Escape dismisses it; persistent undo exists in the page if the toast disappears.
- **Focus**: visible 3 px focus rings with offset on every control (cream on the dark hero), strong hover/press states, and deliberate focus placement after DOM updates so focus is never lost when a card is removed. Primary actions are 44 px high and every control has a clear hover, press, and focus state.
- **Non-visual data**: the weekly chart is a `role="img"` with a full text summary of each day and the total; state is never conveyed by colour alone (stamps and chips say "2 days overdue," "Today," "Tomorrow"; settled rows say "Watered," "Snoozed").
- **Motion**: `prefers-reduced-motion` removes the stem growth, underline draw, card/toast transitions, and the rotated note skew; programmatic scrolling switches to `auto`. The interface remains fully functional with motion disabled.
- **Colour/text**: body text is 12.5–16 px, labels 10–10.5 px, headings 31–55 px; palette contrast is high (forest ink on cream, cream on moss, dark ink on gold). The page is light-scheme only and does not rely on external fonts.

## Files and data

- `index.html` — structure, inline SVG symbol library, and a local JSON data block mirroring `PLANTS.json` (kept inline so the page runs from `file://` with zero requests).
- `styles.css` — responsive three-zone grid, tactile surfaces, plant illustrations' presentation, motion, and reduced-motion rules.
- `app.js` — queue sorting, detail rendering, completion/snooze/undo state with history snapshots, weekly chart updates, focus management, keyboard navigation, and announcements.

Open `index.html` directly; there is no build step, no package install, and no network activity. "Today" is fixed to Saturday, 22 September so the relative history in the supplied data remains coherent; the four plants and weekly counts come from `PLANTS.json`.
