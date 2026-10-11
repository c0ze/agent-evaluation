# RESPONSE — review of the original deployment configs

## Highest-risk problems in the original files (ranked)

1. **Postgres and Redis published on host ports with hardcoded credentials**
   (`compose.yaml`: `admin:password` inline, `5432:5432`, `6379:6379`, plus
   `5000:5000` for the API). On any host with a public interface this exposes
   the database to the internet behind a guessable password — direct
   data breach / ransom risk. Redis was exposed with no auth at all.
   **Fix:** all credentials now come from `.env` (`${VAR:?err}` interpolation,
   fails loudly when missing); `db`/`cache` publish no ports and sit on an
   `internal: true` network; the API is reachable only via nginx; the single
   published port is the proxy's.

2. **Development Flask server as PID 1, as root** (`Dockerfile`:
   `FLASK_ENV=development`, `CMD flask run`). The Werkzeug dev server is
   single-threaded, not hardened, and in debug mode exposes an interactive
   Python console on error pages — remote code execution if reachable; any
   exploit also lands as root in the container. **Fix:** gunicorn (already
   pinned in `requirements.txt`) with bounded workers/threads/timeouts, and a
   dedicated non-root user (`app`, UID/GID 10001); compose adds
   `no-new-privileges`, `read_only` rootfs + `/tmp` tmpfs, and `init`.

3. **No Postgres volume** — the database lived in the container's writable
   layer, so any recreate (`up -d`, image update, OOM kill) destroyed all
   data. **Fix:** named volume `pgdata` (plus `redisdata` for Redis AOF) and
   a documented backup/restore procedure in `RUNBOOK.md`.

4. **Non-reproducible builds** (`FROM python:3.13` full image, `pip install
   flask psycopg2 redis` unpinned, ignoring the pinned `requirements.txt`;
   `nginx/postgres/redis:latest` in compose). Deploys drifted silently and
   pulled in unvetted versions (supply-chain + "works on Tuesday" risk);
   plain `psycopg2` also implies an unnecessary compiler in the image.
   **Fix:** `python:3.13-slim`, install strictly from `requirements.txt`
   (copied first for layer caching), base images pinned to minor versions
   (`nginx:1.28-alpine`, `postgres:17-alpine`, `redis:7.4-alpine`).

5. **No health checks, `depends_on` without conditions** — containers started
   in name-only order, so the API raced Postgres/Redis at boot and nginx
   happily 502'd; failures were silent. **Fix:** health checks on all four
   services (app `/healthz`, `/nginx-health`, `pg_isready`, `redis-cli ping`)
   and `depends_on: condition: service_healthy` chaining proxy -> api ->
   db/cache.

6. **nginx proxy missing forwarding headers and timeouts** — the app saw the
   proxy's IP as client IP, wrong scheme, and a hung backend could pin
   connections forever; the hostname `api` was resolved once at boot, so
   recreating the API container left nginx pointing at a dead IP until
   manual restart. **Fix:** `X-Forwarded-For/Proto/Host`, `X-Real-IP`,
   `proxy_http_version 1.1`, connect/send/read timeouts (5s/30s/30s),
   `client_max_body_size 1m`, gzip for JSON, `server_tokens off`, and
   runtime re-resolution via Docker DNS (`resolver 127.0.0.11` + variable
   `proxy_pass`).

7. **`COPY . .` with no `.dockerignore`** — a local `.env`, git history, and
   caches would be baked into image layers (secret leakage via image
   sharing) and invalidate the dependency layer on every code change.
   **Fix:** `.dockerignore` added; requirements copied/installed before code.

8. **No restart policy, log rotation, or resource limits** — a crashed
   service stayed dead, json logs grew unbounded (disk exhaustion), and one
   runaway container could starve the host. **Fix:**
   `restart: unless-stopped`, json-file logs capped at 3x10 MB per service,
   per-service CPU/memory limits via `deploy.resources.limits` — explicitly
   as guardrails, with RUNBOOK notes that Compose offers no orchestration
   beyond this.

## Verification performed (no containers started, no network used)

- `docker compose config` (Compose v5.5.0) with dummy env vars: **passes**;
  rendered output confirms only `proxy` publishes a port (80), health checks
  and `depends_on: service_healthy` conditions survive rendering, resource
  limits/log options/internal network are present, and `DATABASE_URL`
  interpolates correctly from the environment.
- `docker compose config` **without** env vars: fails fast with clear
  "required variable ... is missing" errors — confirms no silent default
  credentials.
- Python checks over the rendered/final files: YAML parses; `db`, `cache`,
  and `api` define no `ports:`; `backend` network is `internal: true`;
  `pgdata`/`redisdata` volumes declared; no `admin:password`-style literals
  remain in any committed file.
- Static lint of `nginx.conf`: balanced braces/quotes; forwarding headers,
  timeouts, resolver, variable-based `proxy_pass`, `server_tokens off`, and
  both health locations present. `nginx -t` could not be run (would require
  pulling/starting a container, which the task forbids); the config uses the
  variable-upstream pattern that also passes `nginx -t` outside Docker
  because no name is resolved at config-load time.
- Static lint of `Dockerfile`: slim base, dependency layer before code copy,
  non-root `USER` before `CMD`/`HEALTHCHECK`, no `FLASK_ENV`, gunicorn exec-
  form `CMD`, exec-form health check.
- Image build (`docker build`) was **not** run: it requires network access to
  pull bases/packages, which is out of scope per the task constraints.

## Assumptions and residual risks

- The app source is not in this directory. `Dockerfile` assumes WSGI entry
  point `wsgi:app` and a `GET /healthz` endpoint (should verify DB/Redis);
  adjust the `CMD` if the module differs. `requirements.txt` was already
  pinned and was kept as-is.
- Internal API port changed 5000 -> 8000 (gunicorn convention); only nginx
  talks to it, nothing external changes.
- No TLS: nginx listens on 80 and expects an upstream terminator (or added
  certs) before real internet exposure.
- Minor-version pins, not digests; for full reproducibility pin digests and
  add `--require-hashes` to requirements in CI.
- `read_only: true` on `api` assumes the app writes only to `/tmp`.
