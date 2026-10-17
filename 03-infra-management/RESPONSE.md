# Infrastructure Security & Reliability Review

## Highest-Risk Original Problems

1. **Hardcoded Credentials in `compose.yaml` (Critical)**
   - **Problem**: `compose.yaml` hardcoded `POSTGRES_USER: admin`, `POSTGRES_PASSWORD: password`, and `DATABASE_URL: postgres://admin:password@db:5432/app`, completely ignoring `.env.example`.
   - **Fix**: Replaced all hardcoded credentials with required environment variable interpolations (`${POSTGRES_USER:?...}`, `${POSTGRES_PASSWORD:?...}`, `${POSTGRES_DB:?...}`) sourced from `.env`, constructing `DATABASE_URL` dynamically so `api` and `db` cannot drift.

2. **Public Exposure of Database, Cache, and Unproxied API Ports (Critical)**
   - **Problem**: `db` (`5432:5432`), `cache` (`6379:6379`), and `api` (`5000:5000`) published ports on all host interfaces (`0.0.0.0`), allowing external attackers to reach unauthenticated Redis, brute-force PostgreSQL, and bypass nginx direct to the Python process.
   - **Fix**: Removed host `ports` from `api`, `db`, and `cache` (using internal `expose` documentation only), bound `proxy` to `127.0.0.1:80` by default (configurable via `PROXY_BIND_ADDRESS`), and split traffic across an external `frontend` bridge network (`proxy`, `api`) and an `internal: true` `backend` network (`api`, `db`, `cache`).

3. **Ephemeral Database Storage and Unpinned `:latest` Image Tags (High)**
   - **Problem**: `db` had no persistent volume for `/var/lib/postgresql/data` and used `postgres:latest` (alongside `nginx:latest`, `redis:latest`, and `python:3.13`). Container recreation or an automatic major-version pull would cause data loss or incompatible database cluster formats.
   - **Fix**: Added a named `postgres_data` volume mounted at `/var/lib/postgresql/data` and pinned images to stable minor releases (`postgres:16-alpine`, `redis:7.4-alpine`, `nginx:1.27-alpine`, `python:3.13-slim-bookworm`).

4. **Root Execution, Development Server, and Unpinned `pip install` in `Dockerfile` (High)**
   - **Problem**: The API container ran as `root`, executed Flask's single-threaded development server (`flask run`) with `FLASK_ENV=development`, ignored `requirements.txt` in favor of `pip install flask psycopg2 redis`, and copied the entire directory (risking `.env` inclusion) before installing dependencies.
   - **Fix**: Created a dedicated non-root user (`10001:10001`) with read-only permissions on `/app`, installed pinned packages from `requirements.txt` before copying source code, added `.dockerignore` to exclude `.env` and repo metadata, and switched `CMD` to run `gunicorn` via `exec` in production mode.

5. **Missing Health Checks and Readiness-Gated Startup (Medium-High)**
   - **Problem**: No service defined a health check, and `depends_on` only waited for container creation rather than service readiness, causing race conditions on cold boot.
   - **Fix**: Added `pg_isready`, `redis-cli ping`, Python HTTP `/health`, and nginx `/healthz` health checks, and updated `depends_on` to require `condition: service_healthy`.

6. **Under-Configured Reverse Proxy and Missing Resource/Logging Guardrails (Medium)**
   - **Problem**: `nginx.conf` had no proxy timeouts, client body size limits, `X-Forwarded-*` headers, upstream keepalive pooling, or version suppression (`server_tokens off`). `compose.yaml` lacked restart policies, log rotation, and resource limits.
   - **Fix**: Added `X-Real-IP`, `X-Forwarded-*`, and `X-Request-ID` headers, 5s/15s/30s connect/send/read timeouts, a 1MB body limit, JSON error handlers, and upstream keepalive in `nginx.conf`. Added `restart: unless-stopped`, `json-file` log rotation (`10m` x 3), `no-new-privileges:true`, and CPU/memory reservations and limits in `compose.yaml`.

## Verification Performed

Without starting containers, the following static checks were performed across all deliverables:

- **Compose Configuration & Dependency Graph Audit**: Verified YAML structure, anchor expansion (`x-logging`), required variable checks (`:?`), volume mapping (`postgres_data:/var/lib/postgresql/data`), network segmentation (`frontend` vs. `internal: true` `backend`), and health-gated dependency chain (`db` + `cache` -> `api` -> `proxy`).
- **Dockerfile & `.dockerignore` Audit**: Confirmed `requirements.txt` (`Flask==3.1.2`, `gunicorn==23.0.0`, `psycopg2-binary==2.9.10`, `redis==6.4.0`) is installed prior to `COPY`, `.env` is excluded by `.dockerignore`, ownership/permissions prevent runtime code tampering by UID `10001`, and `exec gunicorn` runs as PID 1.
- **Nginx Configuration Audit**: Verified directive placement across `main`, `events`, `http`, `upstream`, `server`, and `location` contexts, confirmed `proxy_read_timeout` (30s) aligns with `GUNICORN_TIMEOUT` (30s), and checked that `/healthz` and JSON error blocks return valid JSON payloads.
