# Customer update — queue delays in eu-west (resolved)

Between 09:07 and 09:43 UTC today, job processing in the eu-west region was significantly delayed, which increased checkout latency for some customers. All delayed jobs were processed by 10:18 UTC, and the region is operating normally.

A configuration change in this morning's release caused background jobs to be retried without a proper delay, which overloaded our database connections and stalled the processing queue. We disabled the change at 09:43 UTC, and processing recovered within minutes. Other regions were not affected.

We have identified the cause and are fixing the retry behavior before re-enabling it, and we are adding earlier alerts so we can catch and stop this kind of issue faster. We apologize for the disruption and are reviewing the full impact on affected orders.
