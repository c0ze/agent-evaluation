# Customer Update

On 23 September, between roughly 09:07 and 10:18 UTC, some customers in our European region may have experienced slower checkout processing.

Our current investigation indicates that a recently introduced configuration setting caused background jobs to retry immediately instead of waiting between attempts. That extra load made database connections unavailable at times, which delayed order processing. Orders were still being accepted throughout this period, and we are reviewing individual orders to confirm none were missed; we will follow up directly with any affected accounts if needed. Our understanding may evolve as the review continues.

At 09:43 UTC we turned the setting off, processing began returning to normal within two minutes, and the backlog was fully cleared by 10:18 UTC.

We are making changes so that invalid retry settings fall back to safe defaults instead of fast retry loops, and we are improving monitoring to catch this pattern earlier. We are sorry for the inconvenience and appreciate your patience.