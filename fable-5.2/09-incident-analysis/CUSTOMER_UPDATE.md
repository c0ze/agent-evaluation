# Service update: delayed background jobs in our EU West region

**What happened.** From about 09:07 UTC, background jobs in our EU West region were processed slowly or not at all, and checkout was slower than normal. Processing began to recover at about 09:45 UTC, and the backlog of delayed jobs was worked through by 10:18 UTC.

**What we know so far.** Recovery started shortly after we switched off a recently introduced feature that changes how failed jobs are retried. That feature is the most likely cause, but we have not yet confirmed it.

**What we are still checking.** We are reviewing the jobs delayed during this period to confirm each completed correctly and only once. If any of yours were affected, we will contact you directly. Our US region raised no alerts, and we are verifying that it was unaffected.

**What happens next.** The feature stays off until we understand and fix the cause. We will share our findings when the review is complete.

We are sorry for the disruption.
