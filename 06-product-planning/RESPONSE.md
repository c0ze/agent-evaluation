# Response: three riskiest assumptions

**1. The 24-hour purge is satisfiable by purging when the device observes
acceptance (A7 / D1).** The regulation is written against wall-clock time after
acceptance, but a tablet in a basement cannot know an inspection was accepted,
and no engineering can force a device online. Our plan bets that compliance
accepts "purge within 24h of local observation + fleet monitoring for dark
devices." If they instead require the clock to start at server acceptance, we
need forced-sync policies, cryptographic remote delete, or MDM-level wipes — a
materially different and more expensive design. This must be settled at M0
before any implementation.

**2. Conflicts are rare and a human review screen is enough (A3/A4).** The
whole conflict design (409 + merge review, no collaborative editing, no
timestamp last-writer-wins) depends on supervisor/web edits overlapping field
sessions only occasionally. If concurrency turns out to be routine, inspectors
and supervisors will hit the review screen constantly, the pilot's "no
support tickets" criterion will fail, and we will be forced toward heavier
merge machinery that product explicitly does not want. The pilot's measured
409-rate and merge-review completion metrics are the earliest real signal;
we should instrument conflict rate from the first dogfood build.

**3. 40 photos per inspection can actually be synced over intermittent,
seconds-long connectivity windows (A5/A6), and devices check in at least
daily (A10).** A full inspection is ~100–300 MB; chunked resumable upload
makes this tractable, but the bet still requires that field devices reliably
regain *some* connectivity every working day and that the backend tolerates
hundreds of long-running resumable uploads at pilot scale. If real basements
yield even less bandwidth or devices go dark for days, sync backlogs
compound, the "fully synced within one working day" pilot criterion fails,
and — worse — the purge obligation in assumption 1 gets harder because the
device that most needs to sync is the one that never does.

All three risks are addressed in `PLAN.md` §14 as decisions D1, D3/D4, and
D5, each with a recommendation and an explicit point at which the assumption
gets tested.
