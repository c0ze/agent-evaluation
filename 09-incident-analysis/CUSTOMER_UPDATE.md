# Customer update — queued order processing, European region

Some customers in our European region saw slower processing of queued work, including
longer checkout times, between approximately 09:07 and 10:18 UTC.

A software change released at 09:02 UTC affected how retry settings were resolved for
individual accounts. For some accounts, no retry setting was found, and the system
retried failed attempts immediately with no pause between them. That extra activity
appears to have placed heavy demand on shared database connections, which slowed down
work processing.

The effect was limited to our European region. Our US region, where the same change
was active for only a small number of accounts, did not report this slowdown.

We rolled back part of the change at 09:24 UTC and fully disabled the affected setting
at 09:43 UTC. Processing began recovering within two minutes, and the backlog was
cleared by 10:18 UTC.

We are still reviewing whether any individual orders were delayed, repeated, or not
completed. If we find any that were affected, we will contact those customers directly.

---

*Body: 165 words (excluding this note and the heading).*
