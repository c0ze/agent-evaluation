# Infrastructure hardening response

All requested deliverables are present: corrected `Dockerfile`, `compose.yaml`,
and `nginx.conf`; updated `.env.example`; and `RUNBOOK.md` covering startup,
health verification, backup/restore, secrets, and rollback. Added the minimal
`app.py` because no application module was supplied, pinned the complete Python
runtime dependency set, and added Git/build exclusions for secrets and backups.
No unrelated services were added.

## Highest-risk original problems

1. **Public data services and embedded credentials.** Postgres and Redis published
   host ports; Postgres used `admin/password`, and Redis had no authentication.
   The API's public port bypassed nginx. Only nginx now publishes a port, bound
   to loopback by default. Postgres/Redis share an internal backend network,
   both require externally supplied passwords, and Redis checks password format.
2. **Unsafe and non-repeatable API runtime.** The Dockerfile ran as root using
   Flask's development server, ignored `requirements.txt`, installed unpinned
   packages, and copied the entire directory into the image. It now runs
   Gunicorn as uid 10001, copies only required files, installs exact direct and
   transitive versions with `--no-deps`, and checks dependency consistency at
   build time. No actual application source had been supplied initially.
3. **Data loss and uncontrolled version changes.** No explicit named Postgres
   volume existed; image recreation could orphan an implicit anonymous volume.
   `latest` could also introduce incompatible database major versions. Data now
   uses a named volume and images specify patch tags, with digest overrides and
   database upgrade limitations documented.
4. **Startup races and no operational bounds.** Ordering alone did not verify
   dependency readiness. Authenticated database/cache probes now gate API
   startup, and API readiness gates nginx. Each service has restart policy,
   rotating logs, CPU/memory/PID limits, and a shutdown grace period. Compose's
   limitations after startup are documented explicitly.
5. **Incomplete proxy behavior.** nginx lacked client/protocol forwarding policy
   and explicit timeouts. It now overwrites untrusted forwarding headers, bounds
   request sizes and timeouts, avoids automatic upstream retries, logs to the
   container streams, and refreshes Docker DNS after API replacement. Its config
   is mounted read-only and it runs without root.

## Verification performed

- Docker Compose v5.1.4 parsed and rendered the configuration offline using
  `.env.example` plus dummy password fixtures. Assertions checked the exact four
  services, sole loopback proxy publication, network membership/internal flag,
  named data volume, health-based dependencies, read-only mounts, capability
  drops, restart/logging settings, and CPU/memory/PID limits.
- Independently emptied each password fixture; Compose rejected both missing
  password cases with the expected variable named in its error.
- Parsed/compiled `app.py` without generating bytecode and checked all 11 runtime
  packages have exact version pins. Reviewed the non-root Gunicorn command,
  Dockerfile readiness probe, explicit copies, and build exclusions.
- Executed the actual readiness/liveness functions with stubbed Flask and mocked
  database/cache clients: healthy dependencies succeed; database errors, Redis
  errors, false `PING`, unexpected SQL results, invalid port configuration, and
  missing configuration return 503. Checked resource cleanup, bounded timeouts,
  disabled Redis retries, and responses containing no exception/secret details.
  These are logic checks, not real Flask/driver integration tests.
- Parsed Redis startup and database/cache healthcheck shell scripts with
  `sh -n`. Executed only Redis password validation/config generation, replacing
  its final server launch with an exit: two valid hexadecimal fixtures passed,
  four invalid fixtures failed, and the generated config had mode 0600. Temporary
  files were created and removed inside this directory.
- Parsed all eight runbook shell blocks with `sh -n` and checked nginx's block
  structure, forwarding directives, DNS resolver, writable paths, and timeouts.
  Confirmed no real `.env` file was created.

No network access, package downloads, image pulls/builds, container starts, HTTP
requests, or live database/cache probes were performed. A host nginx executable
is unavailable, so `nginx -t` was not run. Image availability, actual wheel
installation, current vulnerabilities, and runtime integration remain
unverified; the runbook supplies the deployment checks. Patch tags are not
immutable digests, environment secrets remain visible to Docker administrators,
and the example's bootstrap database role is a superuser; these limits and their
production follow-ups are documented.
