# Response: hardening the API deployment

## Highest-risk original problems (most severe first)

1. **Database and cache open to the network.** Postgres (`5432`) and Redis
   (`6379`) were published on all host interfaces. Redis had no password, so
   anyone who could reach the host could read and write the cache and run
   commands like `CONFIG SET`.
2. **Hard-coded credentials.** `admin:password` appeared in `compose.yaml`,
   both in `POSTGRES_*` and in `DATABASE_URL`. `.env.example` existed, but
   nothing read from it.
3. **Secrets baked into the image.** `COPY . .` with no `.dockerignore` would
   have copied `.env`, `.git` and any backups into the image layers.
4. **Development server in production.** The API ran `flask run` with
   `FLASK_ENV=development`. It also ran as root, and the API port `5000` was
   published directly, so clients could bypass nginx.
5. **Data loss on recreate.** Postgres had no volume, so
   `docker compose down` or `docker compose up --force-recreate` would delete
   the database.
6. **Unreproducible builds.** The Dockerfile ignored the pinned
   `requirements.txt` and installed unpinned `flask psycopg2 redis`.
   `psycopg2` from source also needs a compiler and libpq headers, and gunicorn
   was never installed. Every image used `:latest`, and an unexpected Postgres
   major version change on an existing volume stops the database from starting.
7. **No health checks.** `depends_on` only ordered container start, so the API
   could start before Postgres accepted connections. There was no restart
   policy and no log rotation, so disks could fill.
8. **Weak proxy setup.** nginx set no forwarding headers (`Host`,
   `X-Forwarded-*`), used default timeouts and body size, returned HTML error
   pages to JSON clients, and exposed its version.

## What changed

| File | Change |
| --- | --- |
| `Dockerfile` | `python:3.13-slim`. Dependencies install only from `requirements.txt`, in a cached layer. Non-root UID 10001. Runs gunicorn through `gunicorn.conf.py` on port 8000. |
| `gunicorn.conf.py` (new) | Settings come from env vars: `gthread` workers, 30s timeout, graceful shutdown, `max_requests` worker recycling, logs to stdout, worker temp dir on tmpfs (needed for the read-only root filesystem), and `APP_MODULE` to name the app. |
| `.dockerignore` / `.gitignore` (new) | Keep `.env`, `.git` and `backups/` out of the image and out of VCS. |
| `compose.yaml` | Details in the list below. |
| `nginx.conf` | Details in the list below. |
| `.env.example` | Every variable Compose reads, `change-me` placeholders, and instructions for generating secrets. |
| `RUNBOOK.md` (new) | Startup, health checks, backup and restore, secret handling and rotation, deploy and rollback. |

**`compose.yaml` changes:**
- Images are pinned: `nginx:1.28-alpine`, `postgres:17-alpine`, `redis:7.4-alpine`.
- No inline secrets. `${VAR:?}` makes startup fail fast when a secret is missing.
- Only the proxy is published, on `127.0.0.1` by default.
- Two networks: `edge` (proxy and api) and `backend` (api, db, cache), with `backend` marked `internal`.
- Health checks on all four services, and `depends_on: condition: service_healthy`.
- Postgres data lives in the named volume `pgdata`.
- Redis needs a password, keeps nothing on disk, and has a memory limit with LRU eviction. It still starts through the image entrypoint, so it drops root.
- `restart: unless-stopped` on every service.
- `json-file` log rotation.
- CPU, memory and pids limits.
- The API has a read-only root filesystem, `cap_drop: ALL` and `no-new-privileges`.
- Stop grace periods are set.

**`nginx.conf` changes:**
- An upstream with keepalive, re-resolved through Docker DNS, so a recreated API container is picked up without restarting nginx.
- Forwarding headers set by nginx as the edge proxy: `Host` and `X-Forwarded-*`. Client values for `X-Forwarded-For` are overwritten, not appended, so they cannot be spoofed.
- A request ID is created and passed through.
- Timeouts: connect 5s, read and send 35s, which is just above gunicorn's 30s.
- `client_max_body_size 1m`.
- No retries of non-idempotent requests.
- gzip for JSON.
- A JSON 503 body when the upstream is unreachable.
- `server_tokens off` and API-appropriate security headers.
- JSON access logs to stdout.
- A `/nginx-health` endpoint.

## Verification performed

I did not start any containers, as instructed. There was also no Docker daemon
and no network access.

- `docker compose config -q` with no `.env` fails as intended:
  `required variable REDIS_PASSWORD is missing a value`.
- `docker compose --env-file .env.example config` succeeds (Compose v5.1.1). The
  rendered output shows the following:
  - Only `proxy` has a port, bound to `127.0.0.1:8080`.
  - `backend` is `internal: true`.
  - Every `depends_on` uses `service_healthy`.
  - `pgdata` is mounted at `/var/lib/postgresql/data`.
  - Container-side `$$VAR` references are kept, so Compose does not expand them on the host.
- `gunicorn.conf.py` compiles, and evaluating it with `APP_MODULE=x:y` gives
  the expected values: `wsgi_app`, bind `0.0.0.0:8000`, timeout 30, keepalive 65.
- `nginx.conf`: I checked brace balance by script and reviewed each directive by
  hand. I could not run `nginx -t` because no nginx binary or image is available.

## Not verified and assumptions

- **Not run:** `nginx -t`, `docker build`, hadolint, and the health checks
  themselves. Run `docker compose build` and `docker compose up -d`, then the
  checks in RUNBOOK section 2, before production use.
- **nginx version:** `server api:8000 resolve` in an `upstream` block needs
  nginx 1.27.3 or later. The pinned 1.28 meets this.
- **Image tags:** I could not confirm offline that the pinned tags exist today.
  Pin by digest in CI.
- **No application code was supplied.** I assumed:
  - The WSGI callable is `app:app`. Change it with `APP_MODULE`.
  - The app serves `GET /healthz` and returns 200 without touching the DB.
  - The app reads `DATABASE_URL` and `REDIS_URL`.
  - To log real client IPs, the app wraps itself in Werkzeug `ProxyFix(x_for=1, x_proto=1, x_host=1)`.
- **Dependency hashes:** `requirements.txt` pins versions but not hashes. For
  fully reproducible installs, generate a hash-locked file with
  `pip-compile --generate-hashes` and install with `--require-hashes`. This
  needs network access, so I did not do it here.
- **Redis as a cache only:** Redis is treated as a disposable cache. If the app
  keeps sessions or queues in it, turn persistence back on (AOF) and add a
  volume.
- **Redis password visibility:** the Redis password is passed as a
  `redis-server` argument, so it is visible to processes inside that container.
  A config-file secret would avoid this.
- **TLS:** TLS termination is out of scope. Add a 443 server block and HSTS, or
  terminate at a load balancer and enable `realip`.
