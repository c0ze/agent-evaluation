# Response — Infrastructure hardening

## Files delivered

Corrected `Dockerfile`, `compose.yaml`, `nginx.conf`, completed `.env.example`;
added `.dockerignore` and `.gitignore`; new `RUNBOOK.md` and this `RESPONSE.md`.

## Highest-risk problems in the original configuration

1. **Hardcoded credentials everywhere (critical).** `compose.yaml` embedded
   `postgres://admin:password@db:5432/app`, `POSTGRES_PASSWORD: password`, and
   a Redis URL; `.env.example` had a *different* user (`app` vs `admin`), so
   the documented setup did not match the actual deployment and the database
   would not initialize consistently. Secrets were baked into a file likely to
   be committed. Fixed by sourcing everything from `.env` `${...}` variables
   (git/docker ignored), building URLs at runtime, and enforcing Redis auth
   with `--requirepass`.

2. **Database and cache published to the host (critical).** `db` exposed
   5432 and `cache` exposed 6379 on all interfaces with no authentication on
   Redis (`redis://cache:6379`, no password) and a guessable Postgres password.
   Anyone able to reach the host could read/modify data or take over the cache.
   Fixed by removing all `ports:` from `db` and `cache`, placing them on an
   `internal: true` `backend` network reachable only by `api`, and only
   publishing nginx on a configurable, localhost-default `HTTP_PORT`.

3. **Development server in production (high).** The Dockerfile used
   `FLASK_ENV=development` and `flask run`, which is slow, single-process, and
   not safe for production; `.` was copied before install (no layer caching);
   unpinned `pip install flask psycopg2 redis` ignored the pinned
   `requirements.txt` that was already present, so builds were not
   reproducible; the container ran as **root**. Fixed with a pinned base image,
   install from `requirements.txt` before copying code, non-root numeric
   UID/GID, and gunicorn with sensible worker/timeout/log settings.

4. **Startup order not based on readiness (high).** Plain `depends_on: [db,
   cache]` only waits for container creation; the API could start before
   Postgres/Redis were accepting connections and crash-loop. Fixed with
   `condition: service_healthy` plus real health checks for `db`, `cache`,
   and `api` (and the proxy gated on the API).

5. **No data persistence or durability (high).** Postgres had no volume — all
   data was lost on container recreation. Redis had no persistence/auth.
   Fixed with named volumes `pgdata` and `redisdata`, AOF on Redis, and a
   documented `pg_dump`/`pg_restore` backup/restore path.

6. **No resource/log/restart controls (medium).** No restart policy, unbounded
   logs, no CPU/memory limits. Added `restart: unless-stopped`, JSON-file log
   rotation (10 MB × 3), advisory `deploy.resources.limits`, and explicit
   `stop_grace_period`. Documented clearly that these are not full
   orchestration.

7. **Bare nginx proxy (medium).** No forwarded headers, no timeouts, no body
   size limit, no keepalive, no health endpoint. Fixed with `X-Forwarded-*`
   headers, HTTP/1.1 upstream keepalive, connect/send/read timeouts,
   `client_max_body_size 2m`, a lightweight `/healthz`, and denial of hidden
   files (`/.`), plus a read-only config mount.

8. **No operational documentation (medium).** Added `RUNBOOK.md` covering
   startup, health verification, backup/restore, secret rotation, and rollback.

## Verification performed (static only — no containers started)

- `docker compose -f compose.yaml config` and `config -q` both succeeded after
  substituting sample values from `.env.example`; confirmed the merged render
  has: only `proxy` with a published port (`127.0.0.1:80` by default), no ports
  on `db`/`cache`, `internal: true` on `backend`, named volumes, health checks,
  and `service_healthy` dependency conditions.
- YAML parsed cleanly with PyYAML; confirmed every dependency in
  `requirements.txt` uses an exact `==` pin.
- nginx.conf checked structurally: balanced braces (7/7 after stripping
  strings/comments) and presence of all required proxy/timeout/health
  directives. Full `nginx -t` was not possible: no nginx image or binary is
  available locally and network access is disabled.
- Dockerfile checked: non-root `USER`, gunicorn `CMD`, no `flask run`, presence
  of `HEALTHCHECK`, dependency install from pinned `requirements.txt`, and no
  development-mode env var. Dependency install before `COPY . .` preserves
  layer caching.
- Credential-leak scan of the tracked config files: no literal password remains
  (only `${VAR}` references and the `CHANGE_ME` placeholders in `.env.example`).
- Confirmed no containers were started at any point.

## Known limitations / assumptions

- The application source (`app.py`) was not provided; the Dockerfile assumes a
  Flask app object at `app:app` and that `GET /healthz` returns 200, as the
  task's health-check goal requires. If the route differs, set
  `HEALTHCHECK_PATH` / update the probes accordingly.
- `nginx -t` and an actual image build could not be run in this offline
  environment; those are recommended as the next live checks before deployment.
