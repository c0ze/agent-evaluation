# Moss — Design & Engineering Response

**Moss** is a gentle, mobile-first household plant-care companion designed to make tending house plants feel tactile, forgiving, and joyful.

---

## 1. Personality & Visual Direction

### Warm, Tactile, Optimistic, and a Little Odd
Plant care is fundamentally physical, rhythmic, and biological. Moss reflects this by avoiding the cold sterility of corporate SaaS dashboards, generic glassmorphism panels, and neon gradients.

- **Earthy, Tactile Color Palette:**
  - **Linen & Oatmeal Canvas** (`#F7F4EB`, `#FCFBF7`): Warm paper tones that feel like an organic gardening journal.
  - **Moss & Foliage Greens** (`#1B2E21` down to `#558B67`): Deep chlorophyll shades for growth and grounded calm.
  - **Terracotta & Clay** (`#B84A24`, `#D05E32`, `#FAEBE5`): Warm baked earth for clay pots and gentle-yet-unmistakable overdue alerts.
  - **Marigold Sunlight & Dew Teal** (`#ECA130`, `#316E7D`): Optimistic accents denoting sun exposure, water droplets, and completed care.
  - **Loamy Charcoal Slate Inks** (`#1F2722`): High-contrast, deeply legible text that passes WCAG AAA contrast guidelines.
- **Expressive Botanical Shape Language:**
  - Soft, asymmetrical organic squircle borders (`border-radius: 28px 18px 24px 18px`).
  - Tactile physical buttons with crisp offset drop-shadows (`box-shadow: 0 4px 0 var(--border-ink)`) that visibly depress on tap/click (`transform: translateY(2px)`).
  - Subtle paper-cut craft aesthetic that feels tangible to the finger.
- **Botanical Individuality (No Wall of Identical Cards):**
  - Rather than generic icons, each plant from `PLANTS.json` possesses a distinct personality and custom hand-drawn inline SVG illustration:
    - **Frida (Boston Fern):** Overflowing feathery fronds in a terracotta pot with a drip tray; thirsty, dramatic icon.
    - **Orbit (Golden Pothos):** Playful climbing loop vine with heart-shaped variegated leaves; shelf pioneer.
    - **Dot (Bunny Ears Cactus):** Chunky bunny ear paddles with tiny yellow polka-dot glochids and a blossom; stoic sun worshipper.
    - **Drama (Calathea Orbifolia):** Broad striped emerald-and-silver leaves; expressive, prayerful humidity lover.

---

## 2. Interaction Model

### Priority-Driven Care Queue
- **Overdue Prioritization:** Frida's urgency level is 4 (2 days overdue). She is placed prominently at the head of the queue with an urgent-care alert banner and terracotta borders, ensuring dry soil is never overlooked.
- **Action Hierarchy:**
  - Primary button: Contextual action with botanical icon (e.g., `💧 Water Frida`, `🔄 Rotate Orbit`, `🌱 Check soil Dot`).
  - Secondary button: `⏱ Snooze`, allowing low-guilt rescheduling by 1 day.
  - Tertiary button: `Diary →` to inspect light needs, soil guide, and observation history.

### The Forgiving Undo Architecture
- Rather than interrupting the user with blocking confirmation dialogs, marking a plant "Watered" or "Snoozed" applies immediately with an optimistic UI update.
- A tactile **Undo Toast** slides up with a 6-second countdown bar.
- Tapping **Undo** immediately restores the plant to its previous state, removes the auto-logged care entry, and returns keyboard focus to the restored card.

### Interactive Observation Diary & Plant Inspector
- Selecting any plant opens its detailed inspector:
  - **Sun Meter:** 4-pip tactile sun gauge indicating light requirements (from low indirect for Frida up to bright direct for Dot).
  - **Water & Soil Guide:** Clear intervals and moisture recommendations.
  - **Observation Timeline:** Chronological list of observations and care logs (preserving historical events from `PLANTS.json`).
  - **Interactive Note Logging:** Users can click quick botanical tags (*"🌱 New sprout"*, *"🍂 Dry soil"*, *"✨ Cleaned leaves"*, *"☀️ Rotated"*) or type custom observations to instantly record notes to the timeline.

### Compact Weekly Rhythm
- Visualizes the 7-day care rhythm from `PLANTS.json` (`[1, 3, 2, 4, 2, 1, 3]`).
- Organic rounded vertical bars scale according to workload.
- **Thursday** is highlighted as **Today** with 4 scheduled tasks, giving the user immediate situational awareness of their weekly load.
- Interactive tap/click updates the daily narrative caption.

### Useful All-Done State
- Once all tasks due today are completed (or when all 3 due plants are handled), the queue transitions into a celebratory yet peaceful scene:
  - Whimsical artwork of content plants basking in warm windowsill sunlight with a resting watering can.
  - Reassurance that all companions are thriving.
  - A helpful forward-looking reminder: *"Next on deck: Drama (Calathea orbifolia) is scheduled for a gentle mist tomorrow morning."*
  - Controls to review the completed log or reset the demo queue for instant re-testing.

### Desktop Composition (Beyond the Stretched Column)
- On mobile (< 768px), the app provides a focused single-column flow with a thumb-accessible bottom bar and sliding bottom sheet.
- On desktop (≥ 980px), the layout scales into a rich **3-column dashboard**:
  - **Left Sidebar (Pinned):** Mascot branding, companion status note, weekly rhythm widget, and room filter chips.
  - **Center Column (Fluid):** Today's prioritized care queue and filter tabs.
  - **Right Sidebar (Pinned):** Live Plant Diary & Inspector showing full botanical specifications and interactive observation timeline for whichever plant is currently selected.
- This creates an editorial, expansive workspace without wasted white space or awkward mobile column stretching.

---

## 3. Accessibility Choices

1. **Semantic HTML5 Landmarks:**
   - Structured with `<header>`, `<main>`, `<aside>`, `<article>`, `<nav>`, `<dialog>`, and `<button>`.
   - Skip-to-content link for immediate keyboard navigation to the queue.
2. **Keyboard Operation & Visible Focus:**
   - Every action (completing, snoozing, filtering, inspecting, adding notes, resetting demo) is reachable via standard `Tab` / `Shift+Tab` and operable with `Enter` and `Space`.
   - `Escape` key seamlessly closes modals, sheets, and toasts.
   - High-contrast custom `:focus-visible` styling with 3px solid rings and offsets ensures clear indicator visibility.
3. **Screen Readers & ARIA Semantics:**
   - The undo toast uses `role="status"` and `aria-live="polite"` so screen reader users hear completion confirmations and undo availability without interruption.
   - Buttons feature descriptive `aria-label`s specifying both the action and the plant name (e.g., `aria-label="Water Frida"`).
   - Sun meter and weekly rhythm columns provide clear text alternatives.
4. **Touch Targets & Contrast:**
   - All interactive touch targets meet or exceed the 44×44px WCAG touch criteria.
   - Color contrasts meet WCAG AA and AAA criteria across all states.
5. **Reduced-Motion Support:**
   - Full `@media (prefers-reduced-motion: reduce)` support disables floating animations, bouncy transitions, toast slides, and pulsing borders, switching to instantaneous, calm state changes.

---

## 4. Self-Contained Architecture

- **Zero External Dependencies:** Built with pure HTML, CSS, and Vanilla JavaScript.
- **Zero Network Calls:** No remote CDNs, web fonts, or analytics.
- **Offline Reliability:** Plant data is loaded from `PLANTS.json` with an instant embedded fallback if accessed directly through a `file://` scheme where browser CORS restrictions might otherwise impede local fetches.
