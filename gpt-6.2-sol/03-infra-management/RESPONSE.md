# Review and verification

## Highest-risk original problems

- Compose embedded a predictable Postgres superuser password and published
  Postgres and unauthenticated Redis on host interfaces.
- The host API port bypassed nginx. The container ran Flask's development
  server as root, installed unpinned dependencies, and copied the entire
  build context into the image.
- Startup order did not establish readiness. Postgres had no named volume,
  and the service images used `latest` tags.
- nginx forwarded requests without explicit client identity headers or
  API timeouts. The services had no restart policy, log rotation, or
  resource limits in Compose.

## Verification performed

- Parsed Compose YAML with Ruby, resolved the sample environment defaults,
  and checked port publication, network membership, health dependencies,
  secret mounts, the Postgres volume target, and per-service limits.
- Checked the Dockerfile command, non-root user, and pinned requirements.
  Cross-checked the Gunicorn listener, nginx upstream, and HTTP health probe
  targets. Reviewed nginx block structure and forwarding directives.
- Compiled the Python source and exercised both routes with mocked
  dependencies. Coverage included healthy responses, Postgres connect
  and query errors, Redis failures, empty credentials, and connection
  cleanup after a query.
- Syntax-checked the initialization script and runbook shell snippets.
  Exercised the bootstrap script with a mocked password file and
  `psql`, including the empty-password failure.

Docker and nginx executables were unavailable. Verification was offline
and used no containers. Compose CLI validation, image builds, native nginx
validation, live probes, and a backup/restore rehearsal remain unverified.
