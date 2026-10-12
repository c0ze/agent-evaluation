# Customer update: eu-west checkout delays

All times UTC. Checkout processing in our Europe (eu-west) region was delayed from about 09:07 until 10:18, when the outstanding backlog fully cleared. Many customers in the region likely saw slower checkouts during that window; we are still confirming whether any transactions failed.

A recent release introduced a new per-customer retry setting. The evidence so far indicates that for some customers this setting resolved to an empty policy, so the system retried work instantly instead of pausing between attempts. That exhausted a shared database connection limit and stalled the queue. Rolling back the release alone did not clear the backlog; switching the new setting off at 09:43 restored normal processing within minutes. Our US region ran the same release with the setting enabled for only a small share of customers and saw no impact.

The setting remains off while we add safeguards, verify that no jobs were lost, and complete a full review. We will publish a detailed report and contact any customers whose transactions were affected. We're sorry for the disruption.
