# Response — Task 03: hardening the deployment

The configuration is rewritten and passes every offline check available here.
Nothing was built or started, so it has not run end to end. Two settings
depend on application code that is not in this directory and need confirming
before first start:

- **WSGI entry point**: gunicorn loads `app:app` (override with `WSGI_APP`
  in `.env`).
- **Health endpoint**: the API must answer `GET /healthz` with 200 (override
  with `API_HEALTHCHECK_PATH` in `.env`). If it does not, the API is marked
  unhealthy and the proxy will not start.

## Highest-risk original problems

1. **Postgres published on `0.0.0.0:5432` with `admin` / `password` committed
   in `compose.yaml`.** Anyone who could reach the host had the database.
2. **Redis published on `0.0.0.0:6379` with no authentication.**
3. **API published on `0.0.0.0:5000`, bypassing nginx, served by the Flask
   development server as root.** The dev server is not meant for production
   load or exposure, and a compromise of the process was root in the container.
4. **Postgres data had no named volume.** It sat in an anonymous volume that a
   `docker compose down` / `up` cycle leaves behind, so the database came back
   empty. With `postgres:latest`, a pull could also change the major version
   under existing data.
5. **Non-reproducible image.** `pip install flask psycopg2 redis` ignored the
   pinned `requirements.txt` (so gunicorn was never installed), every image
   was `latest`, and `COPY . .` without a `.dockerignore` would bake a local
   `.env` into the image.
6. **No health checks, health-based ordering, restart policy, log rotation or
   resource limits.** `depends_on` only ordered container creation, so the API
   could start before Postgres accepted connections; a crash stayed down; logs
   grew without bound.
7. **nginx passed no client information and used defaults unsuited to an
   API.** The app saw `Host: api:5000` and the proxy's IP, timeouts were 60s,
   errors were HTML, and the config was mounted writable.

## What changed

| File | Change |
|---|---|
| `compose.yaml` | Only nginx is published (loopback `:8080` by default). Credentials are required from `.env`. Two networks: `frontend` (proxy, api) and `backend` (api, db, cache; `internal`). Health checks on all four services and `depends_on: service_healthy`. Named `pgdata` volume. Pinned image tags, `restart: unless-stopped`, rotated json-file logs, CPU / memory / PID limits, `no-new-privileges`. API runs read-only with all capabilities dropped. Redis requires a password and is bounded as an LRU cache. |
| `Dockerfile` | `python:3.13-slim-bookworm`, dependencies from `requirements.txt` in a cached layer, fixed non-root UID 10001, root-owned code, gunicorn as the server. |
| `gunicorn.conf.py` (new) | Bind, workers/threads, timeouts, worker recycling, logging; all overridable by env. |
| `nginx.conf` | Forwarded headers (`Host`, `X-Real-IP`, `X-Forwarded-For/-Proto/-Host`, `X-Request-ID`), 3s connect / 35s read timeouts, 1 MB body limit, JSON access log, JSON body on 502/503/504, own `/nginx-health`, re-resolves the API address so a recreated API container is picked up. |
| `.env.example` | Passwords left empty on purpose (Compose refuses to start until set), plus bind address, port, image tag, health path. |
| `.dockerignore`, `.gitignore` (new) | Keep `.env` and `backups/` out of images and git. |
| `RUNBOOK.md` (new) | Startup, health verification, backup/restore, secrets, deploy/rollback, migration from the old file. |

## Verification performed

All offline, without contacting the Docker daemon:

- `docker compose config -q` (Compose v5.6.1):
  - no `.env` → exits 1, naming each missing variable;
  - `.env.example` unmodified → exits 1 on the two empty passwords;
  - both passwords filled in → exits 0.
- Read the resolved output: the only published port is `127.0.0.1:8080→80`;
  `backend` is `internal: true`; the `pgdata` volume, limits, logging, health
  checks and `service_healthy` conditions appear on the intended services.
- Ran the API health-check command, taken from the resolved Compose output,
  against a local stub HTTP server: exit 0 on 200 (default path and an
  overridden one); exit 1 on 404, on 500, and on connection refused.
- Executed `gunicorn.conf.py` with plain Python: defaults and the env
  overrides (`WSGI_APP`, `WEB_CONCURRENCY`, `PORT`) resolve as intended.
- `nginx.conf`: structural check only (balanced blocks, terminated
  statements), plus a manual read of every directive.

## Not verified

- **No image was built and no container started** (per the task), so the
  Dockerfile, container health checks, Redis/Postgres flags and the runbook
  commands are untested against a live stack.
- **`nginx -t` was not run**; there is no nginx binary here.
  `docker compose run --rm --no-deps proxy nginx -t` does it on first use.
- **gunicorn is not installed locally**, so its own config check was not run.
- **Image tags were written from memory with no registry access**:
  `python:3.13-slim-bookworm`, `nginx:1.28-alpine`, `postgres:17-alpine`,
  `redis:7.4-alpine`. Confirm they pull, and move to newer patch lines if
  available.

## Assumptions and behaviour changes to confirm

- Redis is a cache: no persistence, `allkeys-lru` at 256 MB. Wrong if the app
  keeps sessions or queues there.
- The API does not write to its own filesystem outside `/tmp` (`read_only`).
- nginx now listens on `127.0.0.1:8080`, not `0.0.0.0:80`; set `HTTP_BIND` /
  `HTTP_PORT` in `.env` for a public deployment.
- The project name is fixed to `api-stack` and Postgres to major 17. Data in
  the old stack's anonymous volume is not carried over (RUNBOOK section 6).
- `FORWARDED_ALLOW_IPS=*` makes gunicorn trust forwarded headers. That holds
  only while the API port stays unpublished.

## Remaining gaps, deliberately left

- **No TLS.** nginx serves plain HTTP; terminate TLS in front of it or add
  certificates before exposing it publicly. If a TLS terminator is added in
  front, `X-Forwarded-Proto` must be passed through instead of `$scheme`.
- **Dependencies are pinned at the top level only.** Transitive packages
  (Werkzeug, Jinja2, …) still float, and base images are pinned by tag, not
  digest. A hash-locked file (`pip-compile --generate-hashes`, installed with
  `--require-hashes`) and image digests need network access to produce.
- **Secrets are environment variables**, and the Redis password a process
  argument: readable by anyone with Docker access on the host.
- **Backups are manual**; scheduling and off-host copies are the operator's.
- Compose restarts crashed containers but does not restart ones that are
  merely unhealthy, and there is no rolling update: a deploy or rollback
  briefly interrupts the API.
