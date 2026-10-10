# Response: hardening the API / nginx / Postgres / Redis deployment

## Highest-risk original problems (most severe first)

1. **Database and cache exposed to the network.** `5432:5432` and `6379:6379` were published
   on all host interfaces. Redis had no password; Postgres had `admin` / `password`.
   Anyone who could reach the host could read or destroy all data.
2. **Hardcoded credentials, and a config that contradicted itself.** `admin:password` was
   written into `compose.yaml` (twice). `.env.example` said `app` / `change-me` and was never
   referenced, so the "configuration" file did nothing.
3. **Secrets could be baked into the image.** `COPY . .` with no `.dockerignore` copies any
   local `.env`, `.git` history and dumps into every layer.
4. **Development server in production, as root.** `flask run --host=0.0.0.0` (Werkzeug dev
   server) with `FLASK_ENV=development`, running as root. Flask 3 ignores `FLASK_ENV`, but
   the dev server is still not a production server.
5. **App port 5000 published directly**, bypassing nginx and any proxy limits or headers.
6. **Non-reproducible build.** `pip install flask psycopg2 redis` ignored the pinned
   `requirements.txt` (unpinned versions, and source `psycopg2` instead of
   `psycopg2-binary`, which needs a compiler). Base and service images were `python:3.13`,
   `nginx:latest`, `postgres:latest`, `redis:latest`; a `pull` could jump Postgres majors and
   corrupt a data directory.
7. **No data persistence.** No Postgres volume, so `down` or a container recreate lost the
   database.
8. **Start order was a lie.** Plain `depends_on` only waits for container start, not
   readiness. No health checks, restart policies, log rotation or resource limits anywhere.
9. **nginx proxied with no headers or timeouts.** No `Host` / `X-Forwarded-*` (the app sees
   the proxy as the client), default 60 s timeouts, no body limit, and no JSON error
   response. Backend DNS was resolved once at startup, so a recreated `api` gave permanent
   502s until nginx restarted.

## What changed

- **Dockerfile:** pinned slim base, deps from `requirements.txt` in a cached layer, fixed
  UID 10001, gunicorn (`WEB_CONCURRENCY`, timeouts, worker recycling, logs to stdout) as PID 1,
  code root-owned, no dev flags. `.dockerignore` added.
- **compose.yaml:** no secrets in the file (`${VAR:?}` fails fast when unset); only nginx is
  published, on loopback by default; `edge` network (proxy, api) plus an `internal: true`
  `backend` network (api, db, cache) with no outside route; named `pgdata` volume; health
  checks on all four services with `depends_on: service_healthy`; `restart: unless-stopped`;
  rotated json-file logs; CPU/memory limits; `read_only`, `cap_drop: ALL` and
  `no-new-privileges` on api and proxy; Redis password, memory cap and LRU; pinned image
  tags; release tags via `API_TAG` for rollback.
- **nginx.conf:** forwarded headers (`X-Forwarded-For` is overwritten, not appended, so it
  cannot be spoofed), request ID, 5 s connect / 35 s read timeouts (just above gunicorn's 30 s),
  1 MB body cap, client timeouts, runtime DNS re-resolution, JSON 503 body on upstream
  failure, quiet `/healthz` logging, `server_tokens off`.
- **`.env.example`:** correct variables, empty passwords (Compose refuses to start until
  they are set), one-line generation in the runbook. **`.gitignore`** added.
- **RUNBOOK.md:** startup, health verification, backup/restore (with a rehearsal), secret
  handling and rotation, rollback.

## Verification performed (nothing was started, no network used)

- `docker compose config` (Compose v5.1.1) passes with generated passwords, and **fails with
  the intended message** with no environment and with `.env.example` as shipped (empty
  passwords).
- Inspected the resolved model: only `proxy` has a published port (`127.0.0.1:8080->80`);
  `db`, `cache` and `api` publish none; `backend` is `internal: true`; `pgdata` volume exists;
  every service has a restart policy, log limits, memory/CPU limits and a health check;
  the dependency chain is `db`/`cache` healthy, then `api`, then `proxy`.
- Ran the API health-check one-liner against a throwaway local stub server: exit 0 on 200,
  exit 1 on 503, on 404 and when nothing is listening.
- Structural lint of `nginx.conf` (balanced braces, terminated directives) and PyYAML parse of
  `compose.yaml`.

## Not verified, and assumptions

- **Not built, not run.** `nginx -t`, `hadolint` and a `docker build` were unavailable or
  needed the network. `nginx.conf`, the Dockerfile and the read-only / `cap_drop` settings
  for nginx have not been exercised. If the proxy fails to start under `read_only` or the
  reduced capabilities, relax those two settings first.
- **The app source is not in this directory.** I assumed `app:app` (overridable through
  `APP_MODULE`) and a `GET /healthz` endpoint. If `/healthz` does not exist, `api` will never
  be healthy and `proxy` will not start; add the endpoint (ideally checking DB and Redis).
- **Image tags** (`python:3.13-slim-bookworm`, `nginx:1.28-alpine`, `postgres:17-alpine`,
  `redis:7.4-alpine`) were chosen from memory and could not be checked against a registry.
  For real reproducibility pin them by digest.
- **Dependencies are pinned only at the top level** in `requirements.txt`; transitive packages
  and hashes are not locked (no network to resolve them). Generate a fully pinned, hashed
  file with `pip-compile --generate-hashes` and install with `--require-hashes`.
- Redis is assumed to be a cache. If it holds sessions or queues, change the eviction policy
  and add persistence (noted in `compose.yaml`).
- The app connects as the Postgres superuser (`POSTGRES_USER`). A least-privilege role would
  be better but needs knowledge of the app's migrations.
- TLS, monitoring/alerting and rate limiting are not included; Compose does not restart
  unhealthy containers, so an external watcher is needed (see RUNBOOK).
