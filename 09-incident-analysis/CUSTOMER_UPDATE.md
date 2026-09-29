# Service update: delayed background jobs and slower checkout in EU (23 September 2026)

**What happened:** From about 09:07 to 10:18 UTC, background jobs in our EU region were delayed. For part of that time, checkout was slower than normal, and some requests may have failed.

**Current status:** The service has been stable since 10:18 UTC, and all delayed jobs have now been processed.

**What we know so far:** The problem began shortly after we released a change to how failed jobs are retried. It improved within minutes of our turning that change off. We have kept it turned off while we investigate. We have not yet confirmed the full cause.

**What we are doing:** We are checking whether any jobs did not complete correctly. We will contact affected customers directly. We are also adding safeguards and better alerting.

We are sorry for the disruption. We will share a fuller report once our review is complete.
