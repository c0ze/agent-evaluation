# Response: hardening the API deployment

## Highest-risk problems in the original configuration

Ranked by how directly each one leads to compromise or data loss.

1. **Database and cache published to every host interface.** `db` exposed
   `5432:5432` and `cache` `6379:6379`. Docker's port publishing bypasses
   host firewalls such as ufw, so Postgres (password `password`) and Redis
   (no authentication at all; the official image disables protected mode)
   were reachable from any network the host sits on.
2. **Credentials hard-coded in `compose.yaml`.** `admin`/`password` in
   both the `db` environment and the api `DATABASE_URL`, committed to git.
   `.env.example` was decorative: nothing referenced its variables, so
   editing `.env` changed nothing.
3. **Root container running Flask's development server.** `flask run` with
   `FLASK_ENV=development` enables the Werkzeug debugger, which is remote
   code execution for anyone who triggers an exception, and the API port
   `5000` was published directly, so the proxy could simply be skipped.
4. **Secrets and repository baked into the image.** `COPY . .` with no
   `.dockerignore` copies `.env` and `.git` into every image layer.
5. **Non-reproducible builds.** `pip install flask psycopg2 redis` ignored
   the pinned `requirements.txt` (and `gunicorn`), pulled whatever was
   latest, and compiled `psycopg2` from source; `python:3.13`,
   `nginx:latest`, `postgres:latest`, `redis:latest` all float. A
   `postgres:latest` bump across a major version would refuse to start on
   the old data directory.
6. **Postgres data not persisted.** No volume, so `docker compose down`
   deleted the database.
7. **No health checks; start-order races.** `depends_on` only waited for
   the containers to exist, so the api could start before Postgres accepted
   connections, and nothing reported an unhealthy service.
8. **Proxy unfit for an API.** No `Host`/`X-Forwarded-*` headers (the app
   saw nginx's IP and wrong scheme/host), no timeouts or body-size limits,
   `nginx.conf` mounted writable, and nginx's own errors returned HTML.
9. **No operational defaults.** No restart policy, unbounded JSON log files,
   no CPU/memory limits, all services on one flat network.

## What changed

- `Dockerfile`: two-stage build on `python:3.13-slim` (digest pinning
  documented); dependencies installed only from `requirements.txt` into a
  venv; non-root `app` user (uid 10001); root-owned code; `gunicorn` with
  `gunicorn.conf.py`; stdlib-only `HEALTHCHECK` on `/healthz`.
- `compose.yaml`: secrets via `${VAR:?message}` from `.env`; only the proxy
  publishes a port; `frontend`/`backend` networks with `backend` marked
  `internal`; `db_data` volume; health checks for db, cache and proxy (api's
  comes from the image) and `depends_on ... condition: service_healthy`;
  `restart: unless-stopped`; json-file log rotation; `deploy.resources`
  limits (the subset Compose enforces on a single host); `read_only`,
  `cap_drop: ALL`, `init` and tmpfs for the api; `no-new-privileges` on all;
  Redis with `requirepass`, bounded memory and persistence off; Postgres
  fast shutdown, `shm_size`, tagged api image for rollback.
- `nginx.conf`: forwarding headers and request id, timeouts matched to
  gunicorn's 30 s, 1 MB body limit, client timeouts, `server_tokens off`,
  gzip for JSON, JSON `503` for gateway errors, un-logged `/healthz`, and
  Docker DNS re-resolution so a recreated api container keeps working.
- `.env.example`: all variables the stack reads, secrets left blank on
  purpose so the required-variable check catches them.
- New: `.dockerignore`, `.gitignore`, `gunicorn.conf.py`, `app.py`.
  `app.py` is a minimal Flask entrypoint (`/` and `/healthz` checking
  Postgres and Redis with 2 s timeouts, `ProxyFix` for one proxy hop). The
  original directory had no application code, so without it the gunicorn
  target and every health check would point at nothing; if the real app
  lives elsewhere, keep its module and give it the same `/healthz`.
- `requirements.txt`: unchanged, already pinned and already listed gunicorn.

## Verification performed

No containers were started and no network was used, as required. There is
no Docker daemon or `nginx` binary in this environment, so verification was
static:

- `docker compose config --quiet` (Compose v5.1.1) with no `.env`: fails
  with `required variable REDIS_PASSWORD is missing a value: set
  REDIS_PASSWORD in .env` (exit 1), confirming the guard.
- `docker compose --env-file <scratch env> config`: exit 0. Inspected the
  rendered JSON: only `proxy` has `ports`; `db`/`cache` are on `backend`
  only (`internal: true`); `api` is on both networks with no ports; all
  `depends_on` conditions are `service_healthy`; the nginx mount is
  `read_only`; limits, `cap_drop`, `read_only`, `init`, `stop_signal`,
  `shm_size` and the Redis command (including the empty `--save ""`
  argument) rendered as intended.
- `python3 -m py_compile app.py gunicorn.conf.py`: clean. Executed
  `gunicorn.conf.py` and printed the effective settings with and without
  `GUNICORN_WORKERS`/`GUNICORN_THREADS`/`LOG_LEVEL` overrides.
- `app.py` exercised against stub `flask`/`werkzeug`/`psycopg2`/`redis`
  modules: both routes register; `/healthz` returns 200 only when both
  dependencies answer and 503 with the failing check named when either or
  both fail; logs contain the exception type only (a stub error containing
  `password=SECRET` never reached the log); a missing `DATABASE_URL`
  raises `KeyError` at import.
- `nginx.conf`: script-checked brace balance and statement terminators
  (quoted strings masked), listed the directives used (all core/http/proxy/
  rewrite module directives), and cross-checked that nginx, gunicorn,
  `EXPOSE` and `HEALTHCHECK` all agree on port 8000.
- Reviewed the Dockerfile by hand (no hadolint available): pinned base,
  cached requirements layer, `USER` before `CMD`, exec-form `CMD` and
  `HEALTHCHECK`, no secrets copied given `.dockerignore`.

## Not verified here / recommended follow-ups

- `nginx -t`, `docker build` and an end-to-end `docker compose up` could
  not run without a daemon; RUNBOOK.md section 1 gives the pre-deploy
  `nginx -t` command. Run the stack once in a staging environment before
  relying on it, in particular the `resolver`/`proxy_pass $variable`
  behaviour and the `read_only` api filesystem.
- Dependency installation is reproducible at the level of pinned top-level
  packages. For full hermeticity generate a hash-locked file
  (`pip-compile --generate-hashes` or `uv pip compile`) and install with
  `--require-hashes`; that needs network access to compute the hashes.
- Pin the base images to digests (documented in the Dockerfile).
- TLS is not configured: nginx listens on plain port 80. Terminate TLS
  either here (certificates plus a `listen 443 ssl` server) or at an
  upstream load balancer, and add HSTS once it exists.
- `cap_drop: ALL` is applied to the api only; the third-party images
  (nginx, postgres, redis) start as root and drop privileges themselves, so
  restricting their capabilities needs a test run to confirm the minimal set.
- If usage warrants it, add nginx `limit_req` rate limiting and move
  secrets from environment variables to Compose `secrets:`.
