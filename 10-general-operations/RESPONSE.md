# Reasoning behind the top three priorities

Five workstreams compete for the same week: the security patch, the board numbers, the strategy outline, the customer demo, and three support escalations. I ranked them by **what happens if they fail**, and by **how much of the failure I could still recover from**. The ranking is not about importance in the abstract — it is about which failures are unrecoverable and which have slack.

## Priority 1 — Security patch deployed by Friday 16:00

This is the only item where being late is irreversible in a way that can't be fixed later in the week.

It is a serial chain, not a single task: my review (60–90 min) → QA, a half-day → a 30-minute change window → deployed. All three links must happen in order, and none of them can be compressed. A half-day of QA cannot be shortened into two hours, and QA is unavailable Thursday, which removes a full day of recovery. If I review the patch on Thursday, the earliest QA can start is Friday, and the change window lands on top of or after the deadline.

That single fact — QA is out Thursday — is what forces the patch to the front of the week rather than letting it float. If the review happens Monday and QA takes Monday afternoon, the deploy lands Tuesday, and Wednesday through Friday stay free as recovery time. Any problem found on Tuesday still has three days to be fixed.

Deploying early also removes a risk the deadline date hides: a failed change window isn't just a delay, it's a rollback plus a re-plan plus another window. Friday leaves no room for any of that. Tuesday leaves three days.

The cost of prioritising this is real: it takes Monday morning away from other work, and it puts QA's half-day in parallel with my own focus block on Monday. That is a deliberate trade, and it is the reason the strategy outline has to be Monday afternoon rather than Tuesday.

## Priority 2 — Board numbers final by Thursday 12:00

Ranked second because the deadline is hard, the input is outside my control, and the required condition — two *uninterrupted* hours — is the rarest thing in my calendar.

Finance needs the block to start after Lina's corrections, which arrive Tuesday by 11:00 at the earliest. So the block cannot be Monday, cannot be before 11:00 Tuesday, and cannot be Wednesday, because Wednesday 13:00–17:30 is unavailable and the 30 minutes that remain after the rehearsal and lunch are useless. After Tuesday the only option left is Thursday 10:00–12:00, which meets the deadline exactly and leaves no margin for rework if Finance wants changes.

So the real decision isn't *when* to do the numbers — it's that Tuesday 11:00–13:00 gets protected as a block, and everything else on that day (the QA go/no-go, the change window, both remaining escalations) is arranged around it. The block is booked as the earliest possible moment rather than the last safe one, precisely so that a late start is recoverable.

The second reason it ranks this high: the dependency is on a person, not just a date. Lina's corrections depend on a vendor export that may be late, and she'll know Monday at 15:00. That means this is a decision I have to make *Monday*, not Tuesday: if the corrections slip, either the block moves later on Tuesday or the deadline has to be renegotiated with Finance and the CEO. Waiting until Tuesday to discover that problem removes every option I have. This is why the inbox's one genuinely unknown input becomes a Monday-morning question rather than a Tuesday surprise.

## Priority 3 — Support escalations, pulled forward off Wednesday

Three escalations at roughly 45 minutes each is two and a quarter hours of work — the least effort of anything here, but the reason it's third is that two of the three are externally scheduled and one of them hits renewals.

The renewal escalation needs a response Monday. That's a firm same-day commitment with direct revenue impact, and it can't be traded away.

The two Wednesday-SLA escalations are the ones I'd most likely have got wrong by leaving them in place. Wednesday gives me 09:30–13:00. Sam's only rehearsal slot takes 10:00–12:00, and lunch needs 45 minutes. That leaves 45 minutes of my own time on a day that is supposed to absorb two 45-minute escalations. It does not fit, and the demo rehearsal cannot move because it's Sam's only window. The escalation work therefore has to move to Tuesday, which is where it now sits — done early, ahead of the SLA, with slack, instead of late and squeezed.

The ordering also matters against the demo. The demo is the most visible item of the week, but it isn't in the top three, and deliberately so. Its rehearsal is already fixed by Sam's availability, its content work is real but not serial, and it has a genuine alternative slot, Thursday 16:00, already offered by the customer. Once that slot is confirmed, the demo is a fixed calendar entry, not a competing priority — the only thing left to do is book it.

The strategy outline is the lowest. "Early this week" is a preference, not a deadline, and there's a concrete opportunity (the Tuesday review, if it's sent by 14:00) rather than an obligation. Three focused hours fit comfortably into Monday afternoon once the patch review and escalation are done, and if it slips to Tuesday morning it still makes the 14:00 cutoff. It costs nothing to do early, so it's scheduled early — but it's the first thing I would give up if the week goes wrong, and the plan says so by leaving Friday afternoon free.

## The shape of the week, in one paragraph

Monday carries the patch review, the renewal escalation, and the strategy draft. Tuesday carries the board numbers in a protected block, the patch deploy, and the other two escalations. Wednesday is the rehearsal only. Thursday holds the board numbers sign-off, the demo, and a real buffer. Friday is verification, follow-up, and overflow. Doing hard, serial work first — and in particular doing it before Wednesday, where there is no room — is what leaves Thursday afternoon and most of Friday as contingency rather than as wishful thinking.
