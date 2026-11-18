# Confidence and next evidence

**Moderate confidence** that the enabled tenant retry path amplified failures enough to stall the queue. The change in job 319 on the same worker across the flag switch is the strongest evidence. Confidence is lower in the exact policy defect and in what first caused jobs to fail. Database waits were already occurring around the first logged retry burst.

1. **A policy-resolution trace for the affected jobs.** Request the tenant setting, flag state, fallback selected and actual delay and budget used for jobs 81 and 319, including job 319 before and after 09:43. This would distinguish a faulty fallback from an empty log field and show which code path chose the delay.
2. **A time-aligned eu-west worker and database trace from 09:00 to 10:18 UTC.** Include first-attempt errors, unique job arrivals, retry attempts and completions by flag cohort, alongside query latency, pool waits and active connections by client. This would help establish whether database degradation preceded the retry surge and how the 09:14 scale-out affected contention and throughput.
