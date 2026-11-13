# Service Update: EU Queue and Checkout Delays

Between 09:07 UTC and 10:18 UTC, customers in our EU (`eu-west`) region may have experienced delayed background job processing and slower checkouts. Alerts did not trigger in our US region.

Our initial investigation indicates that following a release introducing a tenant-specific retry policy, affected jobs retried immediately without delay while the new feature flag was active, and database connections reached capacity, stalling queue processing. Rolling back the API release at 09:24 UTC restored normal creation of new jobs, while existing queued work remained delayed until we disabled the retry-policy feature flag at 09:43 UTC. Recovery began within two minutes, and the backlog cleared by 10:18 UTC.

We are continuing to investigate why the initial job retries occurred, why worker pools stalled, and whether any jobs from the incident window require follow-up. The feature flag remains disabled while we strengthen default retry safeguards, database connection limits, and rollout controls.
