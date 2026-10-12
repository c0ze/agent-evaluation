# Service update — EU region delays, 23 September

Between 09:07 and 10:18 UTC on 23 September, customers in our EU region saw
delays: queued jobs took far longer than usual and checkout was slower for a
period. The backlog cleared by 10:18 UTC and service is operating normally.

**What happened:** a routine release changed how we retry work that fails on the
first attempt. For some accounts the new setting was incomplete, so retries ran
immediately instead of waiting. This put pressure on our database, leaving our
workers waiting instead of processing.

**What we did:** we reverted the release, which restored normal handling of new
work. The backlog stayed slow, so we also turned off the feature behind the new
retry behaviour at 09:43 UTC. Processing recovered within minutes.

**Where things stand:** we have seen no sign of lost data, and other regions were
largely unaffected. We are still confirming details, and are adding stricter
retry limits and better protection for database capacity. Please contact support
if you think your account was affected.
