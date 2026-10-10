# Service update — job processing delays in eu-west

Between approximately 09:00 and 09:45 UTC today, customers in our eu-west region
may have experienced slower than usual checkouts and longer than usual delays
for background jobs (such as order confirmations and notifications).

The issue was caused by a configuration change in a background-job processor that
caused some jobs to be retried more aggressively than intended. This in turn
saturated a shared database resource. Our team identified the change as the
cause, disabled the affected setting at 09:43 UTC, and saw the system recover
within minutes. The backlog of delayed jobs was fully cleared by 10:18 UTC.

Our other regions were not affected in any customer-visible way.

We are sorry for the disruption. No customer data was lost. We are following up
with targeted fixes and additional safeguards before any similar change is
re-enabled, and we will share a full post-incident summary internally.