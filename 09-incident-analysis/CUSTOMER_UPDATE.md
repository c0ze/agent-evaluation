**Subject: Delayed background jobs and slow checkout in EU-West**

Hello,

On [DATE], between about 09:00 and 10:20 UTC, background jobs for customers in our EU-West region were delayed, and some checkout requests were slow or may have failed. The delayed backlog was cleared by 10:18 UTC.

Our current understanding is that a recent software change, together with a feature setting, caused failed jobs to retry too quickly. The extra retries used up database connections. We turned the feature setting off at 09:43 UTC, and processing began to recover within minutes.

We have not yet confirmed the full cause or the total number of affected jobs. We are keeping the setting off until a fix has been tested, adding safeguards for retries and database capacity, and checking whether any individual jobs failed permanently.

We are sorry for the disruption. If you saw a delayed job or a failed checkout in this window, please contact support with the time and details.

Regards,
[Team name]
