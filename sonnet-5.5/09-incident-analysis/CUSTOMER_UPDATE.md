**Service disruption in our EU-West region**

Between about 09:07 and 10:18 UTC, some customers served from our EU-West region may have seen slower checkouts and delays in background processing.

**What we know:** Job processing slowed and a backlog built up. We rolled back a recent release and switched off a related setting that controls how failed tasks are retried. Processing began recovering shortly after that setting was switched off, and the backlog was fully cleared at 10:18 UTC.

**What we are still working out:** The evidence points to that retry setting as the most likely trigger, but our investigation is not complete and we have not confirmed the exact chain of events. We are also checking whether any individual tasks need to be reprocessed, and will contact affected customers directly if so.

We plan to keep the setting off until we have verified a fix. We apologize for the disruption and will share a further update when our review is complete.
