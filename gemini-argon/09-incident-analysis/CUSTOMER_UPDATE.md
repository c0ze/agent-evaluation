# Service Update: EU-West Processing Delays and Checkout Latency (Resolved)

Between 09:07 UTC and 10:18 UTC today, customers in our EU-West region experienced delayed background job processing and elevated checkout latency, with brief database connectivity errors affecting API requests around 09:20 UTC. The issue is now resolved, and all queued work has been processed.

Initial evidence indicates that a configuration change to our job retry policy interacted unexpectedly with worker settings, causing failed tasks to retry immediately without a backoff delay. When additional worker capacity was added to clear the growing queue, database connection limits were reached, which further slowed processing.

Our engineering team rolled back the recent API release at 09:24 UTC and disabled the associated retry policy feature flag at 09:43 UTC. System recovery began within two minutes, and the backlog cleared completely by 10:18 UTC.

We are keeping the feature flag disabled while we complete our investigation, validate retry fallback behavior, and adjust database connection limits to prevent a recurrence. Thank you for your patience.
