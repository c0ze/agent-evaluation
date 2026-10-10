# Infrastructure hardening response

All requested deliverables are complete: corrected Dockerfile, Compose and nginx
configuration, `.env.example`, and `RUNBOOK.md`. Supporting files include the
complete version-pinned Python dependency set, build/source-control exclusions,
a minimal API with health endpoints, its HTTP probe, and offline unit tests.
The original directory had no application source, so the small JSON API makes
the deployment entry point and health checks concrete without adding services.

## Highest-risk original problems

1. **Exposed services and embedded credentials.** Postgres, Redis, and the API
   published host ports on all interfaces; Postgres used a literal weak password
   and Redis had no authentication. Only nginx now publishes a loopback port.
   Required external passwords, Redis authentication, separate networks, and an
   internal backend network reduce access. `.env` and backups cannot enter the
   allowlisted build context.
2. **Root development server and drifting dependencies.** The image ran Flask's
   development server as root and installed unpinned packages while ignoring
   `requirements.txt`. It now runs Gunicorn as UID/GID 10001, installs all eleven
   runtime packages at exact versions, uses binary wheels without dependency
   resolution, and checks dependency consistency during the build. Image tags
   include patch versions. Tags and unhashed wheels are not immutable artifacts;
   the runbook documents release digests/hashes and the offline advisory limit.
3. **Data durability and upgrade risk.** Postgres had no declared reusable data
   volume and used `latest`, permitting unplanned major-version changes. It now
   uses a named volume and a fixed major/patch tag. The runbook includes logical
   backup, transactional restore, retained-image rollback, and schema/version
   compatibility precautions. Redis is explicitly disposable cache storage.
4. **Startup races and invisible dependency failures.** `depends_on` only ordered
   container starts; no service checked readiness. Authenticated database/cache
   checks gate API startup, and API readiness gates nginx. API readiness tests
   both dependencies; proxy health tests the full HTTP path. Liveness remains
   independent of database/cache availability.
5. **Unbounded operation and incomplete proxy behavior.** There were no restart,
   log-rotation, or resource settings; nginx omitted client/proxy headers and
   explicit API timeouts. These are now configured, with read-only filesystems
   and dropped capabilities where compatible. Nginx overwrites incoming identity
   headers, limits request bodies, and refreshes API addresses through Docker DNS.
   The runbook explicitly describes Compose's health/recovery limitations.

## Verification performed

- Docker Compose v5.1.4 accepted `config --quiet` with nonsecret test passwords.
  Inspected/asserted the rendered JSON: exactly four services, only loopback nginx
  ingress, no API/database/cache host ports, intended network memberships,
  `service_healthy` dependencies, persistent database volume, read-only nginx
  mount, all health checks, restart policies, CPU/memory/PID limits, and log bounds.
- Verified configuration fails with either password missing and with the unedited
  `.env.example`. Verified reserved-character passwords survive rendering,
  accounting for Compose's literal-dollar escaping. No real credentials were
  generated or stored.
- `python3 -B -W error::ResourceWarning -m unittest -v test_health.py`:
  **10 tests passed**, covering success, dependency/query failure, unexpected
  replies, missing configuration, connection cleanup, independent liveness,
  HTTP status/payload checks, malformed JSON, and timeout/connection errors.
  Third-party libraries are dependency doubles; these are unit behavior checks,
  not Flask, PostgreSQL, Redis, or container integration tests.
- Compiled every Python file without writing bytecode. Checked all eleven
  package entries have exact, unique pins and inspected the Dockerfile's
  non-root Gunicorn entry point and installation safeguards.
- Parsed the container shell commands and all six runbook shell blocks using
  `/bin/sh -n` without executing them. Reviewed nginx's non-root writable paths,
  upstream DNS resolution, headers, body limit, and timeout settings statically.

No network requests, image pulls, builds, or container starts were performed.
The local environment has no nginx executable or installed application packages;
`nginx -t`, an actual dependency installation/`pip check`, real health checks,
backup/restore, and rollback remain deployment-time verification steps documented
in the runbook. Image availability, wheel availability on each architecture, and
current security advisories were not verified offline.
