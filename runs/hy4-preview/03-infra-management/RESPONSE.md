# RESPONSE — highest-risk original problems, changes, and verification

## Highest-risk problems in the original configuration

| # | Severity | Original problem | Risk | Fix |
|---|----------|------------------|------|-----|
| 1 | Critical | Hardcoded credentials in `compose.yaml` (`postgres://admin:password@db:5432/app`, `POSTGRES_PASSWORD: password`) | Credentials in version control; anyone with repo read access owns the DB | All secrets come from `.env` (not committed); Compose interpolates `${POSTGRES_PASSWORD}`, `${REDIS_PASSWORD}` and fails fast with `required variable ... is missing a value` when unset. `.env.example` documents every variable. |
| 2 | Critical | `db` published `5432:5432` and `cache` published `6379:6379` | Databases/cache directly reachable from the host and LAN; Redis had no auth at all | Both services publish **no** ports. They sit on the `backend` network (`internal: true`), reachable only by name from `api`. Redis now requires a password (`--requirepass`), capped at 256 MB with `allkeys-lru`. |
| 3 | High | `api` also published `5000:5000` | Clients could bypass the proxy and its headers/rate limits/timeouts | Only `proxy` is published (`${HTTP_PORT:-80}:80`); `api` uses `expose: 8000`. |
| 4 | High | `CMD ["flask","run","--host=0.0.0.0"]` + `ENV FLASK_ENV=development` | Werkzeug dev server: single-threaded, no security hardening, debug/reloader behaviour, not production-grade | Production server: `gunicorn` as PID 1 (`exec` in `sh -c` so it receives signals), `--workers $WEB_CONCURRENCY --threads 4 --timeout 30 --graceful-timeout 30 --max-requests 1000`, logs to stdout. `FLASK_ENV=development` removed. |
| 5 | High | Container ran as root | Container escape / write access to the whole filesystem | Non-root runtime: system user `app` (`10001:10001`, no home, `nologin`), app files `COPY --chown=app:app`, `USER 10001:10001`, and `no-new-privileges:true` on every service. |
| 6 | High | `RUN pip install flask psycopg2 redis` — unpinned, ignores `requirements.txt`, `psycopg2` needs a compiler | Non-reproducible images; builds silently drift | Two-stage build: venv in a builder stage, `pip install --no-cache-dir -r requirements.txt` (fully pinned, `pip check`) then copy the venv into a slim runtime with `PIP_NO_CACHE_DIR=1`, `PYTHONDONTWRITEBYTECODE=1`, `PYTHONUNBUFFERED=1`. Base images pinned (`python:3.13-slim`, `nginx:1.27-alpine`, `postgres:17-alpine`, `redis:7-alpine`) — no `:latest`. |
| 7 | High | `depends_on: [db, cache]` without conditions, and no health checks anywhere | API starts before Postgres/Redis accept connections → crash-loops and connection errors | Health checks on all four services; `depends_on` uses `condition: service_healthy` (db/cache before `api`, `api` before `proxy`). Postgres also gets `start_period: 40s` for `initdb`. |
| 8 | High | Postgres had no volume | Every `docker compose down`/recreate destroys the database | Named volume `db-data:/var/lib/postgresql/data` with `PGDATA=.../pgdata`; backup/restore procedures in `RUNBOOK.md` §6. Redis is explicitly a cache (`--appendonly no --save ""`). |
| 9 | Medium | `nginx.conf` had only `proxy_pass` | No `Host`/`X-Forwarded-For`/`X-Forwarded-Proto` (wrong redirects/scheme, all client IPs appear as the proxy), no timeouts (60 s default read timeout), no upstream keepalive, version banner on | Full proxy header set + `X-Request-ID`, `proxy_http_version 1.1` with `Connection ""` and `keepalive 16` upstream, `proxy_connect_timeout 5s` / `send` / `read` 30 s, `proxy_next_upstream`, `server_tokens off`, JSON access log, `client_max_body_size 1m`, `limit_req`/`limit_conn`, security headers. Gunicorn is told to trust forwarded headers (`--forwarded-allow-ips`), safe because the API is reachable only from the proxy on a dedicated network. |
| 10 | Medium | `COPY . .` with no `.dockerignore` | `.env`, `.git`, caches and local artefacts baked into the image (secret leakage + cache busting) | `.dockerignore` excludes `.env`, `secrets/`, keys, VCS and docs; `requirements.txt` is copied first for layer caching. |
| 11 | Medium | No restart policy, no log rotation, no resource limits, no stop grace period, no init | One crash takes the stack down; logs fill the disk; one service can starve the host | `restart: unless-stopped`, `json-file` with `max-size 10m` / `max-file 3`, per-service `deploy.resources.limits` (cpu/memory), `init: true` and `stop_grace_period: 30s` on the API, `shm_size: 256mb` on Postgres. `RUNBOOK.md` §9 states plainly that Compose is not an orchestrator and these are single-host cgroup limits only. |
| 12 | Medium | One flat default network | Any container (including the proxy) could reach the database | Two networks: `edge` (proxy ↔ api) and `backend` (`internal: true`, no egress) for api ↔ db/cache. |
| 13 | Low | `EXPOSE 5000`, no `HEALTHCHECK` in the image | Misleading port; no portable health signal for the image | `EXPOSE 8000` and a Dockerfile `HEALTHCHECK` hitting `http://127.0.0.1:8000$HEALTHCHECK_PATH` (path configurable via env). |

Also hardened: `read_only: true` root filesystem for the proxy with tmpfs for
`/var/cache/nginx` and `/tmp` (pid moved to `/tmp/nginx.pid`).

## Assumptions

- The application exposes a liveness route; default `HEALTHCHECK_PATH=/healthz`
  (override in `.env`). No application source exists in this directory, so no
  application code was added or modified.
- WSGI entrypoint is `app:app` (`APP_MODULE` overrides it), and the app reads
  `DATABASE_URL` / `REDIS_URL` from the environment.

## Verification performed

Ran in this directory (Docker CLI 29.9.0 / Compose v5.5.0, **no containers were
started**):

1. `docker compose --env-file .env config` — parses cleanly (exit 0). Verified in
   the resolved model: only `proxy` has a published port; `db`/`cache` have none;
   `backend` is `internal: true`; volume `db-data` mounted at
   `/var/lib/postgresql/data`; `depends_on` conditions are `service_healthy`;
   health checks, logging options, tmpfs, `read_only` and resource limits are
   present as intended.
2. Negative test — re-ran the same command with `POSTGRES_PASSWORD` and
   `REDIS_PASSWORD` removed: Compose aborts with
   `required variable ... is missing a value: set ... in .env`, confirming the
   fail-fast guards and that no credential is baked into the file.
3. `nginx.conf` — structural static check (balanced blocks, every directive
   terminated) and manual review against nginx 1.27 directives. No `nginx`
   binary is available offline, so `nginx -t` was not run; `RUNBOOK.md` §8
   includes `nginx -t` + `nginx -s reload` for config changes.
4. Dependency reproducibility — confirmed `requirements.txt` is fully pinned and
   is the single source for `pip install` (no ad-hoc package list left in the
   Dockerfile), and that no `:latest` image tags remain.

Not possible in this sandbox (no Docker daemon, no network): `docker build`,
image/container start-up, and live health probes. The exact commands to run on a
real host are in `RUNBOOK.md` §4 (`docker compose ps` → all `healthy`,
`curl -fsS http://localhost/nginx-health`, `curl -fsS http://localhost/healthz`,
`pg_isready`, `redis-cli ping`, and `nc` checks proving 5432/6379 are closed).
