# Moss — Design Response

## Personality

Moss feels like a quiet, observant friend who notices the small things. Not a taskmaster, not a gamified streak-chaser. The visual language borrows from pressed botanical illustrations and handmade ceramics — warm paper tones, organic shapes, subtle texture. The logo leaf has a gentle asymmetry; plant illustrations use single-weight strokes with soft gradients rather than flat icons. Color stays in a narrow, earthy palette: sage, ochre, charcoal, cream. No neons, no glassmorphism, no primary-button blues.

Micro-delight lives in the details: the weekly rhythm bars grow with a slight spring easing, the plant cards lift on hover with a whispered shadow, the toast slides in like a sticky note. The "all done" state shows a hand-drawn checkmark in a wonky circle — imperfect on purpose. Snoozing a plant doesn't feel like failure; the copy says "snoozed until tomorrow" with a tiny moon icon. Watering logs as "Watered" in history, not "Task completed."

## Interaction Model

**Mobile-first, single-thumb flow.** The care queue is the home screen — a prioritized list where overdue plants sit at the top with a warm terracotta left border. Tapping any card opens a bottom-sheet detail panel (desktop: centered modal) with the plant's illustration, light/location metadata, today's task, and two primary actions: Watered and Snooze. Both are full-width, thumb-friendly, and sit at the bottom of the panel.

**Watered** marks the task done, logs it to history, and advances the plant's next due date. **Snooze** pushes the task to tomorrow (or reduces urgency for overdue plants) and logs the snooze. Both trigger a toast with a 5-second undo — no modal confirmation, no navigation away. The toast appears near the thumb zone on mobile, top-right on desktop.

The weekly rhythm chart is a compact horizontal bar chart (Mon–Sun). Tapping a day filters the queue (visual only — aria-pressed on the bar). It's read-only but glanceable: taller bars = busier days.

**All-done state** replaces the list with a centered illustration and a "View all plants" ghost button that opens the detail panel in a browse mode (future enhancement).

**Keyboard operation** is complete: every interactive element is focusable with visible focus rings (3px, primary green). Tab order follows visual order. The detail panel traps focus; Escape closes it. The weekly rhythm bars are buttons with arrow-key navigation (via tabindex + Enter/Space). Skip link at page top.

## Accessibility Choices

- **Semantic HTML**: `header`, `main`, `section`, `aside[role=dialog]`, `ul[role=list]`, `dl` for metadata, `time` for dates, `button` for all actions.
- **ARIA**: `aria-label` on icon-only buttons, `aria-pressed` on toggleable rhythm bars, `aria-live="polite"` on toast, `aria-modal` on detail panel, `role="button"` on plant cards with `tabindex="0"`.
- **Focus management**: Focus trap in detail panel, focus returns to triggering card on close, first focusable element focused on open.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables all transitions/animations globally.
- **Color contrast**: All text meets WCAG AA (4.5:1). Status colors (overdue/due/upcoming) use both hue and label text — never color alone.
- **Touch targets**: Minimum 44×44px (buttons 48px height, cards full-row).
- **Scalable**: Uses `rem` units, respects system font size, no fixed pixel widths on containers.
- **No external dependencies**: All SVG inline, no web fonts, no network requests after initial HTML/CSS/JS load.