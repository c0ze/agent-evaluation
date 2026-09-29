# Customer update — September 23 checkout delays

Between roughly 09:07 and 10:18 UTC on September 23, some checkout and order-processing jobs in our EU region were delayed. A system that controls how failed jobs are retried appears to have been retrying them too quickly after a change we released that morning, which backed up our job queue and database connections. We rolled back the release and turned off the related setting around 09:43 UTC; processing recovered within minutes and the backlog cleared by 10:18 UTC.

We are still confirming details, including exactly which accounts saw delays and whether any orders need to be reprocessed. Our US customers were largely unaffected.

We are adding safeguards so retries slow down automatically if this kind of fault happens again, and we will notify you directly if we find that any of your orders need action on your side. We are sorry for the disruption.
