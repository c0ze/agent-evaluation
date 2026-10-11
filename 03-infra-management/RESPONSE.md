# RESPONSE: Task 03, infrastructure hardening

## Highest-risk problems in the original files

Ranked by risk.

1. **Postgres and Redis are published on the host.** `db` maps 5432 and `cache` maps 6379 on all interfaces. Redis has no authentication. Anyone who can reach the host can connect to both.
2. **Database credentials are committed.** `compose.yaml` contains `admin:password` in `POSTGRES_PASSWORD` and in `DATABASE_URL`. `.env.example` uses `change-me`, a different value that Compose never reads, so the two files disagree.
3. **Postgres data has no volume.** Data lives in the container's writable layer, so `docker compose down` deletes the database.
4. **The API is reachable directly, bypassing nginx.** Port 5000 is published, so requests skip the proxy and its headers. The process is `flask run --host=0.0.0.0`, the Flask development server. `FLASK_ENV=development` signals a debug configuration. If debug mode were enabled, the Werkzeug debugger console would be exposed on a public port.
5. **Unpinned images.** `nginx:latest`, `postgres:latest` and `redis:latest` change without notice. A new Postgres major version would fail to start against the existing data directory.
6. **The API runs as root** with default capabilities. Any compromise of the app starts with root in the container.
7. **The build is not reproducible and copies secrets.** `pip install flask psycopg2 redis` ignores `requirements.txt`. It installs unpinned latest versions and drops `gunicorn`, which that file pins. `COPY . .` with no `.dockerignore` copies `.env`, `.git` and everything else into image layers.
8. **Startup ordering is not health-based.** `depends_on` without conditions only orders container starts. nginx resolves `api` once at startup, so recreating the API later leaves the proxy pointing at a stale address until it is restarted.
9. **No restart policy, healthchecks, log rotation or resource limits.** Services stay down after a reboot, unhealthy containers go unnoticed, logs grow without bound, and one container can exhaust the host's memory.
10. **The proxy config is minimal for a JSON API.** It sets no `Host` or `X-Forwarded-*` headers, so the app sees nginx's address and `http` scheme. It relies on default timeouts. It returns nginx's HTML error pages. It has no `user` directive and no structured logs.

## What changed

| File | Change |
|---|---|
| `compose.yaml` | No host ports for db or cache. Secrets are required from `.env` and the stack refuses to start without them. Named volumes for Postgres and Redis. Two networks, with `backend` internal. Health-gated `depends_on`. Healthchecks on all services. Restart policy, log rotation, memory and CPU limits. Read-only root filesystems for api and proxy. Dropped capabilities and `no-new-privileges`. Images pinned to major versions. Fixed project name. Proxy published on `127.0.0.1` only. |
| `Dockerfile` | Pinned `python:3.13-slim`. Installs from `requirements.txt`, with dependencies cached in their own layer. Runs as UID 10001. Production server is Gunicorn with explicit timeouts. Drops `FLASK_ENV`. Sets `PYTHONDONTWRITEBYTECODE`. |
| `.dockerignore` (new) | Keeps `.env`, `.git`, caches and deployment files out of the image. |
| `nginx.conf` | Pins the `user`, moves the pid file to `/tmp`, and adds JSON access logs with `request_id`. Sets `Host`, `X-Request-ID` and `X-Forwarded-*` by overwriting client-supplied values. Sets explicit proxy timeouts. Uses a runtime-resolved upstream so the proxy survives API recreation. Returns JSON 503 for proxy-generated errors, and passes upstream responses through unchanged. Adds a container-only `/nginx-health` endpoint and `X-Content-Type-Options: nosniff`. Caps request bodies at 1 MB. |
| `.env.example` | Secrets are blank, so an unedited copy fails validation. Documents generation with `openssl rand -hex 32`. Adds `HTTP_PORT` and an optional `APP_IMAGE` for rollback. |
| `.gitignore` (new) | Ignores `.env` and Python caches. |
| `RUNBOOK.md` (new) | Startup, health verification, backup and restore, secret handling and rotation, rollback, maintenance, known gaps. |

Behaviour changes to be aware of: the default host port is now **8080**, not 80 (`HTTP_PORT`). The API is no longer reachable on host port 5000. Redis now requires a password, so the application's `REDIS_URL` must carry it (the compose file already passes it). The application's health contract is assumed, not verified (see below).

## Verification performed

No containers were started, as the task required. The session has no network. Docker's daemon socket returned permission denied, so no image was built or pulled. All checks were done on copies in `$TMPDIR`, so no test files were written to the task directory.

- **Cross-file consistency.** Service names, ports and environment variable names match across `compose.yaml`, `nginx.conf` (`api:5000`) and `.env.example`.
- **Compose validation.** `docker compose config -q` with test-only secret values passes.
- **Fail-closed secrets.** With `POSTGRES_PASSWORD` and `REDIS_PASSWORD` empty or unset, compose exits 1 and names the missing variable. This is the result for the unedited `.env.example`.
- **Rendered-config assertions** (`docker compose config --format json`, checked by a script). 33 checks, 0 failures:
  - No host ports on api, db or cache. Proxy publishes only `127.0.0.1:8080 → 80`.
  - The backend network is internal. db and cache are attached only to it.
  - api is on both networks. proxy is on the frontend network only.
  - Every service has a healthcheck, a restart policy, log rotation, a memory limit and `no-new-privileges`.
  - api and proxy have read-only root filesystems. api drops all capabilities.
  - api waits for db and cache to be healthy. proxy waits for api.
  - `DATABASE_URL` and `REDIS_URL` are built correctly from `.env` values.
  - Postgres uses `SIGINT` for fast shutdown.
- **API healthcheck expression.** Run against a loopback test server: 2xx gives exit 0, 503 gives exit 1, connection refused gives exit 1.
- **nginx.conf structure.** A lint script confirmed balanced braces, terminated statements and the presence of the required directives.

## Not verified

- **Runtime behaviour is untested.** The Dockerfile build, the `pip install`, Gunicorn startup, the healthchecks in containers, and the proxy starting under its capability and read-only settings were not run. No nginx binary is available, so `nginx -t` was not run. No hadolint, and `docker build --check` needs the daemon.
- **Image tags are unchecked.** `python:3.13-slim`, `nginx:1.28-alpine`, `postgres:17` and `redis:7-alpine` were chosen without registry access. Confirm they exist when first pulled.
- **Application contract is assumed.** No application code was supplied. The configuration assumes `app:app`, a `GET /healthz` that returns non-2xx when not ready, and `DATABASE_URL` and `REDIS_URL` environment variables.

## Residual risks

- **Transitive Python dependencies are unpinned.** `requirements.txt` pins only top-level packages. A hash-locked file is the fix, and it needs network access to generate.
- **`psycopg2-binary`.** The supplied package is kept. The psycopg project advises a source build for production.
- **No TLS and no rate limiting.** The proxy is loopback-only HTTP. TLS must be added before any wider exposure.
- **API outbound access.** The api container can reach the internet through the frontend network.
- **Secrets are environment variables.** They are visible to `docker inspect` and to anyone with Docker access on the host.
- **Redis is treated as a cache.** It has AOF persistence, but no backup. Change that if it holds state.
- **Single host.** Compose is not an orchestrator.
