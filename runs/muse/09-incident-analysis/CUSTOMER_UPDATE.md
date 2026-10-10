# Customer update — checkout and job delays in eu-west

On September 23, between about 09:07 and 10:18 UTC, some customers in eu-west saw slow checkouts and delayed background jobs. Our systems alerted us at 09:11, and the backlog was fully cleared by 10:18. Customers in the US were not affected.

What happened, as far as we can tell so far: after a software change, some jobs began retrying too aggressively, which overloaded a shared database and slowed processing. Scaling up did not help at first. Service began recovering shortly after we turned off the related feature, and then returned to normal.

We are still investigating the full cause and checking whether any jobs need to be replayed. Next, we are adding safer retry defaults, better overload protection, and earlier alerts. We will share another update once our review is complete. Thank you for your patience.
