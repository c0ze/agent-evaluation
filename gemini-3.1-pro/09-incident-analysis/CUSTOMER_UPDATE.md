Between 09:07 and 10:18 UTC, our Europe (eu-west) region experienced a service degradation affecting background job processing and checkout request speeds.

A newly deployed retry configuration caused certain background tasks to retry repeatedly without intended delays. This rapid retry activity placed high demand on database connections, creating a backlog in job processing and intermittently slowing checkout requests. Other regions, including the US, remained unaffected.

Our engineering team mitigated the issue by disabling the new retry configuration at 09:43 UTC, which allowed processing to recover. The job backlog was fully cleared by 10:18 UTC, and all services are operating normally.

We are implementing additional safeguards to enforce delay intervals during retries and isolating database connection capacity between background tasks and checkout services. We sincerely apologize for any inconvenience caused.
