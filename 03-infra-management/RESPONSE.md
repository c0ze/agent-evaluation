# Hardening Summary and Verification

## Highest-Risk Original Problems

1. **Hardcoded credentials and unauthenticated Redis (`compose.yaml`, `.env.example`)**
   - `compose.yaml` embedded `POSTGRES_USER: admin`, `POSTGRES_PASSWORD: password`, and `DATABASE_URL: postgres://admin:password@db:5432/app` directly in version-controlled config, ignoring `.env.example`.
   - `cache` (Redis) had no authentication (`REDIS_URL: redis://cache:6379`) and no memory cap/eviction policy, exposing an unauthenticated in-memory store to arbitrary commands and unbounded RAM growth.
   - **Fix:** Removed all embedded credentials; required `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `REDIS_PASSWORD` via Compose `${VAR:?...}` interpolation from `.env` (documented in `.env.example`); enabled Redis `requirepass` (written to a `0600` tmpfs config rather than exposed on `argv`) with `maxmemory 128mb` and `allkeys-lru`.

2. **Publicly exposed database, cache, and backend API ports (`compose.yaml`)**
   - `db` (`5432:5432`), `cache` (`6379:6379`), and `api` (`5000:5000`) were all published on `0.0.0.0`, exposing Postgres, unauthenticated Redis, and the Flask app directly on the host network and bypassing `nginx`.
   - All four services shared a single implicit `default` bridge network.
   - **Fix:** Removed host `ports` from `db`, `cache`, and `api` (using internal `expose` only); bound `proxy` to `${PROXY_BIND_IP:-127.0.0.1}:${PROXY_PORT:-80}:8080`; segmented traffic into `edge` (`proxy` <-> `api`) and `internal: true` (`api` <-> `db`, `cache`) networks.

3. **Root container execution, dev server in production, and unpinned dependencies (`Dockerfile`)**
   - `Dockerfile` ran as `root`, set `ENV FLASK_ENV=development`, and used Werkzeug's single-process development server (`flask run --host=0.0.0.0`) instead of a production WSGI server.
   - It ignored the pinned `requirements.txt` (running `pip install flask psycopg2 redis` after `COPY . .`), breaking layer caching and reproducibility, and had no `.dockerignore` (risking `.env` and repo metadata leaking into the image).
   - **Fix:** Switched to `python:3.13-slim-bookworm`, added `.dockerignore`, installed pinned packages from `requirements.txt` before `COPY`, set `FLASK_DEBUG=0`, created dedicated UID/GID `10001:10001` (`app`) with read-only `/app` permissions, and configured `gunicorn` (`2` workers, `4` threads, `--worker-tmp-dir /dev/shm`, stdout/stderr logs).

4. **No Postgres data persistence and floating `:latest` tags (`compose.yaml`, `Dockerfile`)**
   - `db` had no volume mount for `/var/lib/postgresql/data`, so container recreation wiped all database data.
   - `nginx:latest`, `postgres:latest`, `redis:latest`, and `python:3.13` risked unannounced major-version breaks (including Postgres on-disk format mismatches).
   - **Fix:** Added named volume `postgres_data` mounted to `/var/lib/postgresql/data` and pinned images to `nginx:1.27-alpine`, `postgres:17-bookworm`, `redis:7.4-alpine`, and `python:3.13-slim-bookworm`.

5. **No health checks, race-prone startup ordering, or operational guardrails (`compose.yaml`)**
   - `depends_on` waited only for container start (`service_started`), letting `api` crash-loop before Postgres/Redis finished initializing and letting `proxy` serve `502`s before `api` was ready.
   - Missing `restart`, bounded `logging` (risking disk exhaustion), `stop_grace_period`, `read_only` rootfs/capability drops, and `deploy.resources` limits.
   - **Fix:** Added meaningful health checks (`pg_isready -h 127.0.0.1`, `REDISCLI_AUTH` `redis-cli ping`, Python `urllib.request` on `api /health`, BusyBox `wget` on `proxy /nginx-health`), health-gated `depends_on` (`condition: service_healthy`), `unless-stopped` restarts, `json-file` log rotation (`10m` x `5`), CPU/memory/PID resource bounds, and non-root `read_only` + `cap_drop: [ALL]` on `proxy`, `api`, and `cache` (plus `no-new-privileges:true` across all services).

6. **Minimal `nginx.conf` unsuitable for a JSON API**
   - Missing forwarding headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Request-ID`), explicit client/proxy timeouts, body size cap, security headers, structured upstream timing logs, and dynamic DNS re-resolution (causing stale IP `502`s after `api` recreations).
   - **Fix:** Hardened `nginx.conf` to run unprivileged on port `8080` with `/tmp` temp/pid paths, JSON-API timeouts (`5s` connect, `30s` send, `60s` read, `1m` max body), standard proxy/security headers, JSON gateway error responses (`502`/`503`/`504`), loopback-only `/nginx-health`, and `resolver 127.0.0.11 valid=10s ipv6=off`.

## Verification Performed

All checks were run offline inside `03-infra-management` after final configuration edits, without starting containers or using the network:

- **Compose schema and interpolation validation (with `.env.example`):**
  - `docker compose --env-file .env.example config -q` -> exited `0` (`compose config -q: OK`).
  - `docker compose --env-file .env.example config` -> verified rendered `services` (`api`, `cache`, `db`, `proxy`), `volumes` (`postgres_data`), `networks` (`edge`, `internal: true`), healthchecks, resource limits, and that only `proxy` publishes a host port (`127.0.0.1:80->8080`).
- **Fail-closed secret validation (without `.env`):**
  - `docker compose config -q` -> exited `1` with explicit missing-variable errors for `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `REDIS_PASSWORD`.
- **YAML and file structure verification:**
  - `python3 -c "import yaml; ..."` -> parsed `compose.yaml` via `yaml.safe_load` cleanly (`services: ['api', 'cache', 'db', 'proxy']`, `volumes: ['postgres_data']`, `networks: {'edge': {'driver': 'bridge'}, 'internal': {'driver': 'bridge', 'internal': True}}`).
  - `python3` static assertions on `nginx.conf` and `Dockerfile` -> verified balanced braces (`12` pairs), required proxy/timeout/resolver directives in `nginx.conf`, pinned base image, `requirements.txt`, `USER 10001:10001`, `gunicorn`, `FLASK_DEBUG=0`, and absence of `FLASK_ENV=development` in `Dockerfile`.
  - `ls -la` -> verified readable file permissions (`0644`) for mounted `nginx.conf` and confirmed no `.env` file with live credentials exists in the workspace.

**Not run in this environment:** Container image builds, container runtime startup/healthcheck execution (`docker compose up`), and `nginx -t` / `hadolint` / `yamllint` (container startup and network access are prohibited by task constraints, and `nginx`, `hadolint`, and `yamllint` binaries are not installed on this host).
