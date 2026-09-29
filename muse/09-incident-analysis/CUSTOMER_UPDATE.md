Between about 09:07 and 10:18 UTC today, some checkouts in Europe were slow or failed while our checkout queue was backed up. New orders began flowing normally partway through, and the full backlog cleared by 10:18. Our US service was not affected.

Our early evidence points to a setting in a recent update that caused some jobs to retry too quickly instead of waiting, which overloaded a shared resource. Turning that setting off allowed the system to recover. We are still confirming the full details and checking whether any orders were processed more than once.

We are adding safeguards so empty retry settings fall back to safe defaults, and improving alerts so this pattern is caught faster. We are sorry for the disruption and will share a follow-up once our review is complete.
