# Customer update

Between roughly 09:11 and 10:18 UTC on 23 September, some customers in the EUWest region experienced slower checkout and delays in background jobs. The backlog was fully cleared by 10:18.

Our investigation points to a change deployed at 09:02 that altered how some tenants' retries were handled. For affected tenants, retries appear to have run with little or no delay, raising pressure on shared database connections and slowing processing. We disabled the relevant setting at 09:43, after which recovery began. An earlier rollback of the release alone did not resolve the issue.

The same change was active in the US region but reached only a small share of tenants, and we saw no impact there.

We are sorry for the disruption. We are validating the cause, adding safeguards so a configuration gap cannot again cause rapid retries, and improving early-warning alerts. We are also checking affected jobs for duplicate processing; we do not yet have that result and will follow up.

The evidence shows what happened, but the final root cause is still under investigation.
