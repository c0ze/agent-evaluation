Between 09:07 and 10:18 UTC, customers in our European service region (eu-west) experienced elevated checkout latency and delays in background processing. Our US region was not affected.

Our investigation identified that an update to our retry management system caused automated background tasks to retry immediately without expected backoff delays. This created heavy contention on shared database resources, slowing down job processing and impacting checkout response times.

Our engineering team mitigated the issue by disabling the updated retry configuration at 09:43 UTC. System performance began recovering immediately, and all queued background jobs were fully processed by 10:18 UTC. All services have returned to normal operation.

To prevent recurrence, we are adding strict validation rules to guarantee mandatory delays on all retry routines and isolating critical database resources for customer checkouts. We sincerely apologize for any inconvenience caused to your operations.
