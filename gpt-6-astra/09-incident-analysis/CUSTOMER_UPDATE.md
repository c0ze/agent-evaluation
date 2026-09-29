Between 09:07 and 10:18 UTC, our eu-west region experienced a processing backlog. Monitoring also detected increased checkout latency. Recovery began within two minutes after we disabled a recently introduced retry-policy feature at 09:43 UTC, and the backlog cleared at 10:18 UTC.

Our current assessment is that the feature likely contributed to repeated job attempts and pressure on database connections. We have not yet confirmed the exact cause or the full number of customers affected. The US region did not trigger an alert, but that alone does not rule out impact there.

Our next steps are to verify affected job outcomes, confirm sustained recovery, and validate safeguards for retries and database capacity before re-enabling the feature. The available records do not establish whether any jobs were lost or processed more than once. We’re sorry for the disruption and will share further findings once verified.
