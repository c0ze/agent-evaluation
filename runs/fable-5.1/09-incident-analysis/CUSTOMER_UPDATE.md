# Service update: delayed background jobs and slower checkouts in the EU region

**Date:** 23 September 2026 (times in UTC)

Between about 09:07 and 10:18, customers served from our EU region experienced
delayed background job processing and slower checkouts. Processing recovered from
about 09:45, and the remaining backlog was fully cleared by 10:18. Our monitoring
shows no impact in the US region.

Our current understanding is that a change released that morning to how failed
jobs are retried for some accounts caused work to pile up faster than it could be
processed. We switched that change off at 09:43 and recovery began within minutes.
We are still confirming the exact chain of events and whether any individual jobs
were missed or run twice. If we find that any of your jobs were affected, we will
contact you directly.

We are sorry for the disruption. We are adding safeguards so that a problem of this
kind is caught and switched off much sooner, and we will share a full report once
our review is complete.
