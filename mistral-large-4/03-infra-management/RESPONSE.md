# RESPONSE — Task 03: hardening the small deployment

## Highest-risk problems in the original files

1. **Hardcoded credentials in `compose.yaml`** — `POSTGRES_USER: admin` /
   `POSTGRES_PASSWORD: password`, with the same password embedded in
   `DATABASE_URL` (`postgres://admin:password@db:5432/app`). Anyone with repo
   access gets database admin; the values are also visible via `docker inspect`.
2. **Database/cache ports published to the host** — `5432:5432` and `6379:6379`
   exposed Postgres (with the known weak password) and an unauthenticated-by-default
   Redis to the network. The API port `5000:5000` was also published, bypassing
   the proxy entirely.
3. **Development server in production** — `ENV FLASK_ENV=development` plus
   `CMD ["flask", "run", ...]` runs Flask's single-threaded dev server; combined
   with debug tooling this can expose the Werkzeug debugger (RCE risk).
4. **Container runs as root** — no `USER` directive; any application-level
   compromise gets full container privileges.
5. **Non-reproducible builds** — `RUN pip install flask psycopg2 redis` ignores the
   pinned `requirements.txt` (which already listed gunicorn), and all image tags
   (`python:3.13`, `nginx:latest`, `postgres:latest`, `redis:latest`) are floating.
6. **`COPY . .` with no `.dockerignore`** — copies the whole build context
   (including a local `.env` with real secrets, VCS dirs, caches) into image layers
   and defeats dependency-layer caching.
7. **No health-based startup ordering** — `depends_on` only awaited container
   *start*, not readiness, so the API would crash-loop against a not-yet-ready
   Postgres; no service had a healthcheck at all.
8. **No Postgres persistence** — no volume for `/var/lib/postgresql/data`; any
   container recreation loses all data.
9. **No restart/logging/resource settings** — no restart policy, unbounded
   `json-file` logs (disk-exhaustion risk), no cpu/memory limits, no graceful
   shutdown window for the app.
10. **Bare nginx proxy** — no `Host` / `X-Real-IP` / `X-Forwarded-For` /
    `X-Forwarded-Proto` headers (the app only ever sees the proxy IP), no proxy
    timeouts, no `client_max_body_size`, no upstream keepalive, no `user`/worker
    settings, no self-health endpoint.

## Changes made

- **`Dockerfile`** — pinned `python:3.13-slim`; dedicated non-root system user
  (uid/gid 10001); dependencies installed from the pinned `requirements.txt`
  *before* the code copy (layer caching); gunicorn (2 workers × 4 threads,
  graceful timeout 30 s) instead of `flask run`; `FLASK_ENV=development` removed;
  `HEALTHCHECK` TCP probe on the gunicorn port; `EXPOSE 8000`.
- **`.dockerignore`** (new) — keeps `.env`, VCS dirs, and caches out of the image.
- **`compose.yaml`** — no embedded secrets: `${POSTGRES_PASSWORD:?…}` fails closed
  and is sourced from `.env`; only `proxy` publishes a port (host 80);
  `db`/`cache` publish nothing and sit on an `internal: true` backend network;
  explicit `frontend`/`backend` networks; healthchecks (`pg_isready`,
  `redis-cli ping`, nginx `/healthz` via wget, API TCP probe from the image)
  wired through `depends_on: condition: service_healthy`; `pgdata` named volume
  for Postgres; pinned image tags (`nginx:1.27-alpine`, `postgres:17-alpine`,
  `redis:7-alpine`); `restart: unless-stopped`; json-file logs capped at
  10 MiB × 3 files; per-service cpu/memory limits; Redis bounded with
  `maxmemory` + LRU eviction; `no-new-privileges` + `cap_drop: ALL` and a 30 s
  stop grace period for the API.
- **`nginx.conf`** — `user nginx`, worker settings, `server_tokens off`, explicit
  `upstream api_backend` with keepalive, full proxy header set, HTTP/1.1 to the
  upstream, JSON-API-appropriate timeouts (connect 5 s, send/read 30 s),
  `client_max_body_size 2m`, gzip for JSON, and a local `location = /healthz`
  returning 200 for the proxy healthcheck.
- **`.env.example`** — documents the three variables Compose interpolates;
  **`.gitignore`** (new) keeps `.env` out of version control.
- **`RUNBOOK.md`** (new) — startup, health verification, backup/restore, secret
  handling, rollback, and an explicit note on what Compose does *not* provide
  (no rolling deploys or automatic rollback).

## Verification performed (no containers started, no network used)

- `docker compose config` (Compose v5.5.0) renders cleanly with a test password:
  confirmed only `proxy` publishes port 80 while `api`/`db`/`cache` publish none,
  `backend` is `internal: true`, `pgdata` mounts at `/var/lib/postgresql/data`,
  all healthchecks and `service_healthy` dependencies are wired, and logging caps
  and resource limits are applied.
- Fail-closed check: `docker compose config -q` without `POSTGRES_PASSWORD` exits 1
  with "required variable POSTGRES_PASSWORD is missing a value".
- `yaml.safe_load` — `compose.yaml` is valid YAML.
- Secret scan (`grep -rniE 'admin|password|…'`) over `compose.yaml`,
  `Dockerfile`, `nginx.conf` — only `${POSTGRES_PASSWORD:?…}` variable references
  remain; no literal credentials and no `5432:5432` / `6379:6379` / `5000:5000`
  port mappings.
- `nginx.conf` structural check — braces balanced; all required directives present
  (user, upstream, proxy headers, timeouts, body-size limit, `/healthz`,
  `server_tokens off`).
- `Dockerfile` checks — non-root `USER app`; no `flask run` /
  `FLASK_ENV=development`; gunicorn CMD; `requirements.txt`-based install;
  `HEALTHCHECK` present; `EXPOSE`/bind port 8000 matches the nginx upstream
  `api:8000`.
- `.dockerignore` excludes `.env`; `.env.example` defines every variable
  referenced by `compose.yaml`.

Not performed, due to the offline/no-containers constraint: `docker build` /
`docker compose up` (base-image pulls need network), `nginx -t` (no nginx binary
installed), and `pip install --require-hashes` (hashes cannot be generated without
downloading packages). Recommended follow-ups: pin images by digest, add hashes to
`requirements.txt`, and upgrade the API healthcheck to an HTTP `GET /health` once
the application exposes one.
