# Service Update: EU-West Checkout and Background Job Delays

**Status:** Resolved (Monitoring)  
**Affected Region:** EU-West  
**Duration:** 09:07–10:18 UTC

Earlier today, customers in our EU-West region experienced delayed background job processing and elevated checkout latency.

Our initial investigation indicates that a newly enabled tenant retry-policy feature flag contributed to rapid job retries and database connection exhaustion, slowing both checkout requests and background processing. At 09:43 UTC, we disabled the feature flag; recovery began within two minutes, and the backlog cleared by 10:18 UTC. New job creation and background processing in EU-West have returned to normal, and no alerts were triggered in our US region.

We are keeping the feature flag disabled while we complete a full technical review, verify whether any individual jobs require reprocessing, and strengthen retry and database capacity safeguards. We will share another update if any customer action is needed.
