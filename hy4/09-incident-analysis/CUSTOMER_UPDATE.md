# Customer update — eu-west (23 September 2026)

Between 09:07 and 10:18 UTC today, some requests in eu-west were processed
more slowly than usual. Queue backlogs grew and checkout latency increased, so
you may have seen slow or timed-out operations.

We detected the issue at 09:11. Disabling a recently enabled retry-policy
setting at 09:43 led to rapid recovery, and the backlog was fully cleared by
10:18. Service is now operating normally.

Our current understanding is that a retry setting in today's release caused
certain tasks to be retried with no delay, overwhelming a shared database
resource. This is our leading explanation based on logs and timing, not a
confirmed cause. We are still investigating, and the setting remains off while
we verify a fix.

We are checking whether any jobs were dropped and will contact affected
customers directly if we find an impact to their data. We are also adding
earlier warnings and staged rollouts to catch and reverse such changes faster.

We're sorry for the disruption. Please contact support if you notice anything
unexpected in your account.
