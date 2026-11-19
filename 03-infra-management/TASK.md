# Task 03 — Infrastructure management: harden a small deployment

Review and improve the supplied `Dockerfile`, `compose.yaml`, and `nginx.conf`
for a small Python API behind nginx with Postgres and Redis. Do not add
Kubernetes or unrelated services.

Goals:

- No embedded credentials or public database/cache ports.
- The API runs as a non-root user with a production server and reproducible
  dependency installation.
- Add meaningful health checks and startup dependencies based on health.
- Persist Postgres data, make internal service communication explicit, and add
  sensible restart/logging/resource settings without pretending Compose is a
  full orchestrator.
- Proxy headers and timeouts should be appropriate for a JSON API.
- Keep local operation straightforward through `.env.example`.

Deliver corrected configuration and a concise `RUNBOOK.md` covering startup,
health verification, backup/restore, secret handling, and rollback. Write
`RESPONSE.md` listing the highest-risk original problems and verification you
performed. Work only in this directory; do not actually start containers.

