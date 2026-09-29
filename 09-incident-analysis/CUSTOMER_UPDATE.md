From 09:07 to 10:18 UTC, background jobs in our eu-west environment fell behind. The queue grew, workers became much less busy, and the database hit its connection limit. An API server could not get an ordinary connection. Alerts started at 09:11 UTC. The queue was clear by 10:18 UTC.

A 09:02 UTC release added a per-customer retry policy. Logs show some jobs retrying with no pause and stopping in under a second. Other jobs still finished. After an API rollback, new job creation returned to normal and the backlog stayed. At 09:43 UTC we turned the new retry switch off. One job then waited about a second and completed, and the queue began to recover within two minutes.

Our US environment ran the same release with the switch on for about 2% of customers and raised no alert. We cannot yet say how many customers were affected, or whether any jobs were dropped or only delayed. That retry switch stays off while we find out. We are sorry for the delay.
