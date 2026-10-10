# Top 3 priorities — reasoning

The week is dense and several items are real deadlines, but the ones that should drive sequencing are the ones with **the least slack**, the **most downstream dependencies**, or the **highest cost of slip**. By those criteria, my top three are:

---

## 1. Board numbers for Finance — final by Thursday 12:00

**Why this is #1:**

- **Hard, externally-enforced deadline.** The board pack has a published time and audience. Slipping it means escalating to the chair and a damaged reputation, both worse than any of the other slips on this list.
- **Multi-party dependency chain I don't control.** I'm downstream of Lina, who is downstream of a vendor export. If any link slips, my 2h uninterrupted block stops being uninterrupted. The earlier I lock the upstream signal (Monday 15:00), the more options I have — including the contingency of moving the 2h block to Thursday morning.
- **No negotiation room on the activity itself.** Finance needs "two uninterrupted hours after Lina sends corrections." That's not a preference; it's a stated requirement. Treating it as flexible would be a mistake.

**What I'm doing about it:** Lina's 15:00 Monday is my hard pivot point. The 2h block is reserved Tuesday 14:00–16:00 right after her 11:00 corrections. Thursday morning is a finalisation slot, not a discovery slot. If the vendor slips, I escalate to Finance by Tuesday 11:30 with a revised ETA — not Thursday morning.

---

## 2. Security patch — deploy by Friday 16:00

**Why this is #2:**

- **Hard deadline with a sequential dependency chain:** my review (90m) → QA (half day) → change window (30m) → deploy. Each step gates the next; a slip anywhere cascades.
- **Constraint sandwich on QA.** QA is unavailable Thursday. That compresses the QA half-day into Wednesday afternoon — and I'm also unavailable Wednesday afternoon. The QA team can run the half-day without me, but my review has to land by Tuesday morning so they're not blocked.
- **High cost of slip.** Customer trust + compliance. If this misses, there's no "next week" that fixes it gracefully.

**What I'm doing about it:** Review Tue 09:30–11:00 (a fresh, focused slot, before any other Tuesday deliverable competes for attention). QA kicks off Wed 13:00. Change window Fri 14:00, with 1.5h buffer to the 16:00 deploy deadline. Thursday is intentionally left free of patch work because QA is unavailable — that buffer is the only place I can absorb an unexpected QA finding before the deadline.

---

## 3. Strategy outline for the CEO — sent by Tuesday 14:00

**Why this is #3 and not higher:**

- It has a real deadline (Tuesday 14:00 send, to be reviewed at the 16:00 leadership meeting) but it's **internal** — a slip costs me credibility with the CEO and a weaker leadership discussion, not a customer or compliance consequence.
- It is genuinely "early this week" work, which means **the bulk of it should happen Monday** when my day is otherwise lightest on fixed commitments.

**Why it's still in the top three (and not, say, the customer demo):**

- The customer demo **has flexibility** built into it already — Thursday 16:00 is a confirmed alternative, and the rehearsal window with Sam is fixed but isolated. The risk surface is smaller.
- The strategy outline, by contrast, is the only one of the week's deliverables that requires **focused creative output** on a deadline. If I let the 3 focused hours drift into Tuesday morning, every other Tuesday item collapses. Locking Monday afternoon for the 3h protects the whole week.
- It also has a **CEO-visibility multiplier** that most other tasks don't: the quality of this draft will be remembered longer than the rest of the week's mechanics.

**What I'm doing about it:** 3 focused hours Mon 13:30–16:30 (1.5 + 1.5, with a 15:00 break for the Lina vendor sync that materially affects the rest of the week). Polish pass Tuesday morning, send by 14:00. Thursday afternoon reserved for revisions if the 16:00 meeting asks for them — keeps the loop warm without crowding the deploy prep.

---

## What I deliberately did *not* put in the top three, and why

- **Customer demo.** It has a viable alternative slot and a fixed (but isolated) rehearsal. The cost of slip is real but recoverable — we can re-book within the week.
- **Support escalations.** They have SLAs but are short (45m each), well-scoped, and I have spread them across Mon and Wed so no single day is overcommitted by them.
- **Recurring meetings.** They are fixed and bounded.

The week is engineered so the top three are the ones that, if they slip, the rest of the week stops being navigable. Everything else is downstream slack.