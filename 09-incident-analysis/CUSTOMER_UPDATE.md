# Service update — delayed checkout in eu-west

**Status: Resolved**

Between 09:07 and 10:18 UTC on 23 September, some customers in eu-west
experienced slower-than-normal checkout and order processing. Service is now
normal and the backlog is cleared.

**What happened:** A change released at 09:02 UTC affected how our system retries
work that does not finish first time. For some accounts, retries were made far
too quickly instead of being spaced out. Those rapid retries consumed capacity
without completing orders, so the queue grew.

**What we did:** We rolled the change back, then turned off the setting itself.
Processing recovered within minutes, and all queued orders finished by 10:18 UTC.

**Your orders:** We believe orders placed during this window were delayed rather
than cancelled, and we are confirming this. If you placed an order and did not
receive confirmation, contact support and we will check it.

**Next steps:** We are fixing how unconfigured retry settings are handled,
setting a minimum wait between retries, improving monitoring, and rolling out
new settings more gradually.

We are sorry for the disruption.
