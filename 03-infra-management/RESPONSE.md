# Response — Task 03: Infrastructure hardening

## Highest-risk problems in the original configuration

1. **Credentials in version control** — compose.yaml embedded `admin` /
   `password` twice (db environment and `DATABASE_URL`). Anyone with repo
   access has production DB credentials; anyone watching a CI log sees
   them too.
2. **Database and cache published to the host** — `5432:5432` and
   `6379:6379` were bound on all host interfaces. Redis had no
   authentication, so on many networks it was remotely reachable and
   writable (a well-known RCE path via module loading). Postgres was
   reachable with the weak committed password.
3. **Flask development server as the production process** —
   `flask run` + `FLASK_ENV=development` means the Werkzeug dev server
   (no concurrency tuning, debug-oriented behavior) handling real
   traffic.
4. **No readiness gating** — `depends_on` only ordered container
   *startup*, so the API routinely booted before Postgres accepted
   connections and crashed or served 500s.
5. **No Postgres persistence** — no volume on `/var/lib/postgresql/data`;
   `docker compose down` destroyed all application data.
6. **Unreproducible build** — `pip install flask psycopg2 redis` ignored
   the pinned requirements.txt (floating versions, different image per
   build); all service images were `:latest`.
7. **Container ran as root with `COPY . .`** — no `.dockerignore`, so a
   local `.env` (or any future secret file) would be baked into image
   layers, readable by anyone with image pull access, running as root.
8. **No restart policy, no log limits** — a crash stayed down; json-file
   logs grew unbounded until the host disk filled.
9. **Unconfigured proxy** — nginx forwarded nothing (`Host`, `X-Real-IP`,
   `X-Forwarded-For`, `X-Forwarded-Proto` missing, so the API cannot see
   client IPs/protocol), used HTTP/1.0-style upstream connections, and
   had default 60s proxy timeouts with no body-size limit; version
   leaked via `Server:` header.

## Changes made

- **compose.yaml**: all secrets interpolated from `.env` with `:?`
  fail-fast errors; no published ports for db/cache/api (`expose` only
  documents internal ports); named `db_data` volume; health checks for
  all four services with `depends_on: condition: service_healthy`;
  split `frontend` / `backend` networks, `backend` marked `internal:
  true` (no egress, and the proxy cannot reach db/cache at all);
  `restart: unless-stopped`; rotated json-file logging; memory/CPU
  limits; `no-new-privileges` on every service; pinned image tags
  (`nginx:1.27-alpine`, `postgres:17`, `redis:7-alpine`).
- **Dockerfile**: pinned base (`python:3.13-slim-bookworm`); installs
  the pinned requirements.txt (dependency layer cached separately);
  non-root `app` user; gunicorn production CMD (exec form, tuned
  workers); dev-server env removed.
- **nginx.conf**: proxy headers, HTTP/1.1 + keepalive upstream,
  connect/send/read timeouts tuned for a JSON API, `client_max_body_size
  1m`, `server_tokens off`, gzip for JSON, and a proxy-local `/health`
  endpoint for the compose healthcheck.
- **New files**: `.dockerignore` (keeps `.env`, VCS files, caches out of
  the image), `.gitignore` (keeps `.env` out of git), expanded
  `.env.example` (all variables with generation guidance), `RUNBOOK.md`
  (startup, health verification, backup/restore, secret handling incl.
  password rotation, rollback).

## Verification performed

Offline, without starting any containers:

- `docker compose config` (Compose v5.5.0, client-side validation)
  renders the full stack cleanly with test values: only the proxy
  publishes a port, db/cache/api are `expose`-only, all health checks,
  resource limits, network attachments, and the `db_data` volume resolve
  as intended.
- With `.env` absent, `docker compose config` exits non-zero with
  actionable "required variable ... is missing" errors — confirmed the
  fail-fast secret handling works.
- A Python structural check over nginx.conf: balanced braces, every
  directive terminated, and all required proxy-header/timeout directives
  present. (No nginx binary is available here, so `nginx -t` could not
  be run — full syntax validation should be done at first `up`.)
- Dockerfile checked programmatically: exec-form CMD parses as valid
  JSON, references gunicorn, and the file contains no dev-server
  remnants; non-root user and `--no-cache-dir` install confirmed.
- No credential strings remain in Dockerfile/compose.yaml/nginx.conf;
  `.env.example` contains placeholders only. No container was started
  and no network was used.

## Assumptions (adjust if wrong)

- The Flask app is exposed as `app` in `app.py` (gunicorn `app:app`) and
  serves `GET /health` with 2xx. Both are one-line changes (Dockerfile
  CMD / api healthcheck) and are called out in RUNBOOK.md.
- Versioned image tags were chosen as stable majors; pin to exact
  digests in a real release pipeline.
