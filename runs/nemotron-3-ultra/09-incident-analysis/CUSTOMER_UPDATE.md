# Customer Update — eu-west Processing Delays (2026-09-23)

Between 09:02 and 10:18 UTC, customers in the eu-west region experienced delayed job processing and elevated checkout latency. The US region was not affected.

A configuration change deployed at 09:02 introduced a new retry policy for background jobs. The policy contained a defect that caused jobs to retry immediately without backoff, consuming database connections and preventing work from completing. Our team identified the issue, disabled the feature at 09:43, and processing returned to normal within two minutes. The backlog cleared by 10:18.

No data was lost. All jobs queued during the incident have been processed successfully.

We are fixing the retry policy, adding safeguards to prevent similar storms, and updating our runbooks so that feature flags can be disabled more quickly in future incidents. We will share a detailed postmortem within five business days.

If you observed failed checkouts or stuck jobs during this window, no action is needed on your part — the system has recovered automatically. Please contact support if you see any residual issues.