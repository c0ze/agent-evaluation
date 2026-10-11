# Customer Update

Between roughly 09:07 and 10:18 UTC today, customers in our Europe region
experienced slow checkouts and delays in background job processing; some
requests may have failed during the peak. Our US region was not affected.

The problem followed a routine update that changed how failed jobs are retried.
Our current evidence indicates that, for some accounts, the new retry setting
did not apply a waiting period between attempts, causing jobs to retry in a
tight loop and overload a shared database resource. Our investigation is still
confirming the exact details, and we will share more once verified.

Once we identified the likely cause, we turned off the new retry setting.
Service began recovering within minutes, and all delayed work finished by
10:18 UTC. No data was lost.

To prevent a repeat, we are adding safeguards so retries always use a safe
delay, improving earlier detection, and tightening how new settings roll out.
We apologize for the disruption and appreciate your patience.
