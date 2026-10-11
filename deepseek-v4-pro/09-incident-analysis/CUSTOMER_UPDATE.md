# CUSTOMER_UPDATE.md

On September 23, some jobs in our EU-West region were delayed for roughly an
hour. The issue began shortly after a new release and is now resolved, with the
job backlog fully cleared.

What we know: a recently introduced setting changed how some jobs retry after a
temporary failure. For a subset of customers, those retries ran with no waiting
time in between, which placed unexpected load on our database. As a result,
workers could not keep up and some jobs waited longer than usual to process. We
turned the setting off, and processing returned to normal within a few minutes.

What we are doing: we have kept the setting disabled while we investigate, and
we are adding safeguards to prevent retries from running too quickly and to
protect our database capacity. We are also reviewing how we roll out this kind
of change to catch issues earlier.

We are sorry for the disruption. No customer data was lost, and jobs completed
normally once processing recovered.
