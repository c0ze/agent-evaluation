# Moss

All requested deliverables are implemented: `index.html`, `styles.css`, `app.js`, and this explanation. Open `index.html` directly in a modern browser; no server, build step, installation, or connection is needed. The app uses local CSS, JavaScript, installed fonts, and inline SVG. A content security policy blocks network connections.

## Personality and visual direction

**A botanical field journal with a playful streak.** Moss feels like a quiet ritual: warm paper, leafy ink, terracotta accents, gently irregular silhouettes, and encouraging language. The four hand-drawn SVG plants have distinct foliage and pots. Frida’s fern grows into the rounded overdue reminder; the windowsill illustration, asymmetric corners, and italic display type give the screen its visual signature.

The design’s feasibility score is **13**: impact 4, context fit 4, implementation feasibility 4, performance 4, minus consistency risk 3. Everything is drawn locally and the interaction surface stays small.

The display stack uses installed Palatino/Book Antiqua/Georgia for its bookish, expressive curves; Trebuchet MS/Avenir provides clear body text. The main colors are paper `#f6f3e9`, ink `#2e493b`, leafy green `#426848`, sage `#e7ebd9`, and a restrained clay accent `#a54b2d`. Spacing follows a roughly 4-pixel rhythm. Motion is limited to button feedback, progress changes, and the undo notification’s entrance.

On phones, care comes first in a single column with persistent bottom navigation. At intermediate widths the companion sections move below the queue. Wide screens have a navigation rail, a roomy care column, and a separate weekly rhythm and illustrated care note.

## Interaction model

- **Overdue-first tending:** Frida’s two-day-overdue watering is the prominent first reminder. Orbit’s rotation and Dot’s soil check follow. Drama’s misting stays clearly grouped under tomorrow.
- **Accurate actions:** “Watered,” “Rotated,” and “Checked soil” complete their respective tasks, record history, update progress, and remove the task from today. Finished plants remain available through the completed list and My plants.
- **Snooze:** Moves a task into tomorrow’s visible list and records the change. Progress counts completed care separately from snoozed reminders. The weekly chart shifts snoozed reminders into Wednesday and shows completed Tuesday care within its bar.
- **Brief undo:** A 12-second notification restores the last action’s status and history. Rapid actions can be undone in reverse order during their individual windows. The deadline pauses while the notification is hovered or focused, and while the tab is hidden. Undo remains inside the modal’s accessible layer when details are open.
- **Plant details:** Every plant has its supplied light conditions, last watering, complete care history, and observation milestones. An additional watering log is available without completing an unrelated task. Duplicate watering records for today are prevented.
- **All done:** Completing today’s care gives a calm resting state with Drama’s next task and a way to visit the collection. Snoozing everything produces a distinct resting state with an honest care count and all deferred tasks visible below.
- **Local continuity:** Care and histories survive reload through `localStorage`. Unavailable storage falls back to in-memory state and a visible explanation. Corrupt or incompatible saved records fall back safely to the supplied data.

The queue is a **September 22 sample**, consistent with the supplied September histories. Tuesday is the highlighted day. The exact `PLANTS.json` data is embedded in JavaScript so opening a local file works without a fetch request. The screen does not advance its sample calendar or send notifications. To restart the sample, remove the `moss-care-v1` localStorage entry in browser developer tools and reload.

## Accessibility

Semantic navigation, sections, buttons, headings, progress, and lists provide a clear document structure. Every care action has a plant-specific accessible name. The chart exposes full day names and counts instead of depending on color or initials. Illustrations are decorative alongside readable plant names.

A skip link, visible focus outlines, and touch targets of at least 44 pixels support keyboard and touch use. Native `<dialog>` supplies modal focus containment and Escape dismissal. Closing restores focus to the originating plant; completing a task moves focus to the next task or the resting-state heading. A polite live region announces care changes and undo availability. Both the live region and undo controls move into an open dialog to remain accessible.

Reduced-motion preferences disable animations, transitions, and smooth scrolling. Forced-color support preserves key control and chart boundaries. Local installed-font fallbacks keep text available immediately.

## Verification

`node --check app.js` and **`node verify-state.mjs` pass**. The dependency-free state checks cover fixture fidelity, overdue priority, all four detail histories, task-specific completion, watering deduplication, snooze, tomorrow’s list, stacked/paused/expired undo, both resting states, reload persistence, denied/corrupt storage, and static offline, SVG, and accessibility contracts.

`verify.mjs` supplies a separate real-browser check using Chrome through OS pipes, with external URLs blocked and no local HTTP server. It exercises keyboard interaction, modal focus, five viewport widths, reduced motion, browser errors, and screenshots. **Chrome aborts at launch in this restricted environment**, so those browser checks and rendered visual inspection could not be completed here. The passing state checks use a small DOM adapter and do not establish browser layout or native focus behavior. On a machine that allows headless Chrome, run `node verify.mjs`; screenshots are written to `previews/`. `MOSS_CHROME` can point to another local Chrome executable.

The implementation assumes one person, four plants, device-local records, and a small standalone screen. There are no accounts, remote services, packages, or external assets to maintain. `PLANTS.json` and `TASK.md` are unchanged.

Model ID: **gpt-6.1-sol**.
