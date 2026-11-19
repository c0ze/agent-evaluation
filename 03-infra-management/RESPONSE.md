# Hardening Review and Verification Summary

## Highest-Risk Original Problems

1. **Hardcoded credentials and unauthenticated Redis (`compose.yaml`)**
   - *Original risk:* `POSTGRES_USER: admin`, `POSTGRES_PASSWORD: password`, and `DATABASE_URL: postgres://admin:password@db:5432/app` were committed in plaintext, and Redis ran with no password (`requirepass`).
   - *Fix:* Removed all embedded credentials; required `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `REDIS_PASSWORD` via fail-fast `${VAR:?...}` interpolation; enforced `scram-sha-256` host authentication on Postgres; enabled `--requirepass` on Redis with `REDISCLI_AUTH` for CLI health checks; updated `.env.example` for straightforward local setup.

2. **Public exposure of database, cache, and raw API ports (`compose.yaml`)**
   - *Original risk:* Postgres (`5432`), Redis (`6379`), and the raw Flask API (`5000`) were published on all host interfaces (`0.0.0.0`), exposing data stores directly and letting clients bypass nginx. All four services also shared a single implicit default network, allowing `proxy` to reach `db` and `cache`.
   - *Fix:* Removed all host port bindings from `db`, `cache`, and `api`; bound `proxy` to `${HTTP_BIND:-127.0.0.1}:${HTTP_PORT:-8080}:8080`; segmented traffic into explicit `frontend` (`proxy` <-> `api`) and `backend` (`internal: true`, `api` <-> `db`, `cache`) networks.

3. **Root execution, development server, and debug mode in production (`Dockerfile`)**
   - *Original risk:* The API container ran as `root`, set `ENV FLASK_ENV=development`, and launched Werkzeug's single-threaded development server (`flask run --host=0.0.0.0`).
   - *Fix:* Switched to a multi-stage `python:3.13-slim-bookworm` build with a dedicated non-root user (`app`, UID/GID `10001`), read-only application file permissions (`root:app`, `u=rwX,g=rX,o=`), and exec-form `gunicorn` (`gunicorn==23.0.0`) logging to stdout/stderr. Added `read_only: true`, `tmpfs`, `cap_drop: [ALL]` (with minimal required caps added back only on `db` for `initdb`/privilege drop), and `no-new-privileges:true` across services; ran `proxy` as non-root `nginx` on port `8080` and `cache` as non-root `redis`.

4. **Non-reproducible dependency builds, unpinned `:latest` images, and `.env` image-leak risk (`Dockerfile`, `compose.yaml`)**
   - *Original risk:* `Dockerfile` ran `COPY . .` before `pip install flask psycopg2 redis` (ignoring the pinned `requirements.txt`, breaking layer caching, and building unpinned dependencies). There was no `.dockerignore`, risking copying a local `.env` into the image. `compose.yaml` used floating `:latest` tags for `nginx`, `postgres`, and `redis`.
   - *Fix:* Installed dependencies strictly from `requirements.txt` inside a dedicated builder virtualenv layer before copying app source; added `.dockerignore` excluding `.env*`, infra files, docs, and dumps; pinned images to `python:3.13-slim-bookworm`, `nginx:1.27-alpine`, `postgres:17-alpine`, and `redis:7.4-alpine`.

5. **No Postgres persistence (`compose.yaml`)**
   - *Original risk:* `db` stored data only in the container's writable layer; recreating the container caused total data loss.
   - *Fix:* Added named volume `postgres_data:/var/lib/postgresql/data`, `shm_size: 128m`, and `stop_grace_period: 30s` for clean checkpoints on shutdown. Explicitly configured Redis as a bounded volatile LRU cache (`--maxmemory 128mb --maxmemory-policy allkeys-lru --save "" --appendonly no`).

6. **Missing health checks, readiness ordering, resource limits, and log rotation (`compose.yaml`)**
   - *Original risk:* Plain `depends_on` started `api` before Postgres/Redis were ready and left `proxy` unordered; containers had no restart policy, unbounded log growth (disk-exhaustion risk), and no CPU/memory/PID caps.
   - *Fix:* Added health checks on all four services (`pg_isready` with configured user/DB, `redis-cli ping`, Python stdlib probe to `http://127.0.0.1:5000/health`, and local-only `/nginx-health` probe), `depends_on` with `condition: service_healthy`, `restart: unless-stopped`, `json-file` log rotation (`10m` x 3, compressed), and modest CPU/memory/PID limits appropriate for single-host Compose.

7. **Minimal, unhardened reverse proxy configuration (`nginx.conf`, `compose.yaml`)**
   - *Original risk:* `nginx.conf` was bind-mounted read-write, disclosed the nginx version (`server_tokens` on by default), omitted forwarding/security headers and HTTP/1.1 keepalive, had no request body limits or API-appropriate timeouts, and returned HTML error pages for gateway errors.
   - *Fix:* Mounted `nginx.conf` read-only (`:ro`), disabled `server_tokens`, added HTTP/1.1 upstream keepalive (`api_backend`), forwarded `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Request-ID`, aligned connect/send/read timeouts (`5s`/`30s`/`30s`) with Gunicorn (`--timeout 30`), set `client_max_body_size 1m`, enabled JSON gzip and structured JSON access logs, added API security headers, restricted `/nginx-health` to `127.0.0.1`, and returned JSON bodies for `413`/`502`/`503`/`504` errors.

## Files Delivered

- `Dockerfile` — hardened multi-stage Python 3.13 slim image with non-root `app` user, pinned `requirements.txt` install, Gunicorn, and health check.
- `.dockerignore` — excludes `.env*`, infra manifests, docs, caches, and backups from the build context.
- `compose.yaml` — hardened Compose configuration with fail-fast env vars, explicit `frontend`/`backend` networks, Postgres persistence, health checks and health-gated dependencies, restart/logging/resource settings, and container privilege drops.
- `nginx.conf` — non-root JSON API reverse proxy config with proxy/security headers, timeouts, keepalive, structured logging, JSON error responses, and local-only `/nginx-health`.
- `.env.example` — complete local configuration template matching `compose.yaml`.
- `RUNBOOK.md` — concise operational guide covering startup, health verification, backup/restore, secret handling, and rollback.

## Verification Performed

All verification was performed offline without starting containers, per task constraints:

1. **Compose schema and variable interpolation (`docker compose config` with `.env.example`):**
   - Ran `docker compose -f compose.yaml --env-file .env.example config` (Docker Compose `v5.6.1`).
   - Result: Exit code `0`; verified rendered service definitions, network topology (`frontend` bridge, `backend` internal bridge), `postgres_data` volume, `:ro` bind mount on `nginx.conf`, health checks, `service_healthy` dependencies, resource limits, logging options, and absence of published ports on `api`, `db`, and `cache`.
2. **Fail-fast missing-secret check (`docker compose config` without env file):**
   - Ran `docker compose -f compose.yaml config` with no `.env` present.
   - Result: Exited non-zero (`EXIT=1`) with explicit interpolation errors for every missing required variable (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`).
3. **Static syntax and hygiene checks (Python script):**
   - Parsed the Python `HEALTHCHECK` one-liner with `ast.parse` and verified it matches both `Dockerfile` and `compose.yaml`.
   - Checked `nginx.conf` brace nesting and quote balance across all lines.
   - Verified no `:latest` image tags or original hardcoded credentials (`admin:password`, `POSTGRES_PASSWORD: password`) remain in `Dockerfile` or `compose.yaml`.

### Limitations Not Verified Offline

- Because container execution and network access were disallowed, image builds (`docker compose build`), runtime `nginx -t` inside `nginx:1.27-alpine`, live container startup/health transitions, and `pg_dump`/`pg_restore` against a running Postgres container were not executed.
