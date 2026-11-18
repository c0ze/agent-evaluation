# Checkout and processing delays in Europe

At 09:07 UTC, work began piling up in our Western Europe region. By 09:11 UTC, our monitoring showed that checkouts were taking longer than usual.

Our investigation suggests that some jobs tried again immediately after encountering a problem. Those extra attempts likely put more demand on the database and delayed other work. After we reversed a recent software change, new work arrived at its usual rate. Jobs already waiting were still delayed.

At 09:43 UTC we turned off the setting that controlled these retries. Processing began to recover within two minutes, and the backlog cleared at 10:18 UTC. We are investigating why the retries happened without a delay and how many customers were affected.
