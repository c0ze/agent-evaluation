# RESPONSE — Task 03 hardening review

## Highest-risk problems in the original configuration

1. **Plaintext, guessable credentials committed in `compose.yaml`.** The
   DATABASE_URL contained `admin:password` and `POSTGRES_PASSWORD: password`
   directly in version-controlled config — secrets in git history, trivial to
   guess, and inconsistent with `.env.example` (`app`/`change-me`). Anyone with
   repo read access had the database password.

2. **Database and cache published to the host with no authentication.** `db`
   mapped `5432:5432` and `cache` mapped `6379:6379`, and Redis had **no
   `requirepass`**. An open, unauthenticated Redis plus a weak-password Postgres
   reachable on all host interfaces is the single most dangerous issue: it
   exposes data exfiltration and known Redis-based remote-code-execution paths
   to anything that can reach the host. The `api` also published `5000:5000`,
   letting callers bypass nginx entirely (and reach the dev server directly).

3. **API ran as `root` on the Flask development server with
   `FLASK_ENV=development`.** `flask run` is single-process and explicitly not a
   production server; if the dev/debug mode is reachable it risks the Werkzeug
   debugger (RCE). Running as root compounds any container escape. The image
   never referenced the already-pinned `requirements.txt`.

4. **Non-reproducible, secret-leaking build.** `FROM python:3.13` +
   `pip install flask psycopg2 redis` installed unpinned packages at build time,
   ignored `requirements.txt`, would drift between builds, and `COPY . .` pulled
   `.env`, `.git` and any local secrets into the image layers. All three service
   images used floating `:latest` tags, so a rebuild could silently pull a new
   major Postgres/Redis/nginx.

5. **No persistence and no real readiness gating.** Postgres had **no named
   volume** — `docker compose down` or any container recreation destroyed all
   data. `depends_on` only waited for containers to *start*, not to be ready, so
   the API could connect before Postgres/Redis accepted connections and crash.
   There were no healthchecks anywhere.

6. **Reverse proxy unfit for a JSON API.** The minimal `nginx.conf` set no
   `X-Forwarded-For`/`Proto`/`Host` headers (the app saw the proxy as the client
   and would generate wrong URLs/schemes), had no timeouts or body-size limits,
   used the default `text/html` type, no access/error logging, and HTTP/1.0 to
   the upstream (no keepalive).

7. **Operational gaps:** no `restart` policy, unbounded `json-file` logs (disk
   fill), no resource limits, no explicit networks (everything on one flat
   default bridge, db/cache reachable from the proxy tier), and `.env.example`
   was incomplete (no Redis password, no proxy-port setting) and did not match
   the hardcoded values.

## What I changed

- **Secrets:** all credentials now come from a git-ignored `.env` via
  `${...}` interpolation; `compose.yaml`/`Dockerfile` contain zero credential
  literals. `.env.example` documents every variable with placeholders. Redis now
  requires AUTH (`--requirepass` + `REDISCLI_AUTH`), so no passwordless cache
  exists. `.gitignore` and `.dockerignore` keep secrets out of git and the image.
- **Exposure:** only `proxy` publishes a host port (configurable `PROXY_PORT`,
  default 80). `api`, `db`, `cache` have **no** `ports:`. Two explicit networks:
  `backend` is `internal: true` (no egress/gateway, hosts db+cache), `frontend`
  carries proxy↔api. Internal communication is explicit and segmented.
- **Runtime:** `python:3.13-slim`, deps installed from pinned
  `requirements.txt` before source copy (layer caching), dedicated unprivileged
  `app` user, production `gunicorn` (2 workers/2 threads, 30s timeout, logs to
  stdout), `PYTHONDONTWRITEBYTECODE`/`PYTHONUNBUFFERED`/no pip cache. No
  `FLASK_ENV=development`.
- **Reliability:** healthchecks on all four services (`pg_isready`,
  `redis-cli ping`, app `GET /health`, proxy `/healthz`); `depends_on` uses
  `condition: service_healthy` so startup is gated on real readiness. Named
  volumes `pgdata`/`cache_data` persist data (Redis AOF on). Pinned image major
  tags. Per-service `restart: unless-stopped`, bounded json-file logging
  (10m × 3), and `mem_limit`/`cpus`/`pids_limit`.
- **Proxy:** `Host`/`X-Real-IP`/`X-Forwarded-For`/`X-Forwarded-Proto`/
  `X-Forwarded-Host`/`X-Request-ID`, HTTP/1.1 + keepalive upstream, JSON default
  type and JSON-structured logs, connect/send/read/body/header timeouts,
  1m body cap, `server_tokens off`, a dependency-free `/healthz`, and no blind
  retries of non-idempotent methods.
- Kept scope: still a single-host Compose stack. No replicas, rolling updates,
  placement, or secret manager were added — the RUNBOOK states plainly that
  Compose is not an orchestrator and that HA is out of scope.

## Verification performed (static only — no containers started, no network used)

- `docker compose config` with inline env values: the file parses, interpolates
  all `${...}` variables correctly, and the rendered config shows no exposed
  `5432`/`6379`/`5000` host ports and no credential literals. Passed.
- `python3` + PyYAML: `compose.yaml` parses as valid YAML; health-based
  `depends_on`, named volumes, networks and the YAML logging anchor all resolve.
  Passed.
- `nginx.conf` could not be binary-validated (`nginx` is not installed locally,
  and starting a container / pulling an image is out of scope). It was checked
  structurally (balanced braces, directives, `proxy_*`/header set, timeouts).
  **Verify with `docker compose run --rm proxy nginx -t` before production use.**
- Static scans: no `admin`/`password` literals, no `:latest` tags, no `ports:`
  on api/db/cache, `USER app` present, `requirements.txt` fully pinned. Passed.
- Not run (intentionally, per task constraints): building the image, starting
  any container, live healthchecks, backup/restore exercises, and `nginx -t`.
  All `curl`/`pg_dump`/`pg_restore` commands in RUNBOOK.md are documented
  procedures, not executed here.

## Deliverables

- `Dockerfile`, `compose.yaml`, `nginx.conf`, `.env.example` — corrected config
- `.gitignore`, `.dockerignore` — secret hygiene (new)
- `RUNBOOK.md` — startup, health, backup/restore, secrets, rollback
- `RESPONSE.md` — this file
