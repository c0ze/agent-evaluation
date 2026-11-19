# Customer update — EU job processing delay (23 September)

On 23 September, between 09:07 and 10:18 UTC, some customers using our EU region experienced slower checkout and delayed background job processing. Queues backed up, and a number of jobs were retried repeatedly. Service began recovering shortly after 09:43 and returned to normal at 10:18 UTC.

Our investigation is focused on a recently deployed tenant-specific retry setting. Evidence so far suggests that, for some tenants, the setting applied no delay between retries, which placed heavy load on our database connections and slowed job processing across the region. We are still confirming why this happened and exactly which customers were affected.

We have disabled the setting and are monitoring queue and checkout health closely. We will not re-enable it until the retry behaviour is corrected and tested. We have not seen evidence of data loss, and we are checking for duplicate job effects.

We are sorry for the disruption. We will send another update within 24 hours, or sooner if our findings change.
