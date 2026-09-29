# Review response

## Highest-risk original problems

- The database password was hard-coded as `admin:password`, and Postgres,
  Redis, and the API were all published directly on host ports. That exposed
  data services and bypassed nginx.
- The API ran Flask's development server as root, despite `gunicorn` already
  being listed as a dependency. The Docker build ignored `requirements.txt`
  and installed unpinned package names; all service images also used mutable
  `latest` tags.
- There were no health checks, readiness-based startup dependencies, or
  persistent Postgres volume. A simple start order could leave the API
  connecting before its dependencies were ready, and database data could be
  lost when the container was replaced.
- nginx forwarded requests without client/protocol headers or explicit
  connection and response timeouts.

## Changes and verification

The API now runs Gunicorn as UID/GID 10001 with an exact, fully pinned Python
dependency set. Compose keeps only nginx host-published, separates edge and
internal data networks, persists Postgres in `pgdata`, and defines health
checks, health-based startup dependencies, restart policies, bounded logs,
resource limits, and graceful stop periods. nginx forwards the client and
scheme headers and sets bounded proxy timeouts. `.env.example`, local ignore
rules, `RUNBOOK.md`, and this review record cover local secrets and operations.

Static review confirmed that Compose contains no published API, Postgres, or
Redis ports, no embedded database password, and no `latest` image tags. The
configuration was checked with `docker compose --env-file .env.example config
--quiet`; this validates Compose parsing without starting containers. No
containers were started. Runtime behavior could not be checked because this
directory contains no API implementation; the default Gunicorn target is
`app:app`, and its readiness check requires `GET /healthz` to return HTTP 200.
