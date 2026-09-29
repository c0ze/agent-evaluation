# Queue incident timeline (UTC)

- 09:02 deploy api `2026.09.23.1`; change adds tenant-specific retry policy.
- 09:07 queue depth begins rising in eu-west; worker CPU falls from 65% to 18%.
- 09:11 alerts fire for job age and checkout latency.
- 09:14 on-call increases workers from 40 to 90; queue depth rises faster.
- 09:20 database connections reach configured maximum of 300.
- 09:24 API deploy rolled back; new job creation normalizes, backlog still stuck.
- 09:31 one worker pool restarted; it processes jobs normally for four minutes,
  then stalls.
- 09:43 feature flag `tenant_retry_policy` disabled; recovery begins within two
  minutes.
- 10:18 backlog cleared.
- US region uses the same release but had the flag enabled for only 2% of tenants;
  no alert fired there.

