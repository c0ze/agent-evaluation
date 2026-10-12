# Status update: processing delays in the EU region

From approximately **09:07 UTC to 10:18 UTC**, background jobs in our EU region took longer than usual to complete. Some customers may have noticed slower job completion and slower checkout. New job submissions returned to normal at around 09:24 UTC, and the backlog was cleared by about 10:18 UTC. Our US region was not affected in the same way.

**What happened:** a recent release included a new setting controlling how quickly a job is retried when it does not succeed. In the affected region it was applied in a state where jobs retried far faster than intended. Those repeated retries consumed shared database connections, slowing processing overall.

**What we did:** we turned the setting off, and processing recovered within about two minutes.

**Next:** we are reviewing why the setting was applied incorrectly, checking whether any job ran more than once, and adding alerts on retry behaviour to catch this earlier.

No action is needed from you. We apologise for the disruption.
