# RESPONSE — Task 03: infrastructure review

## Highest-risk problems in the original files

1. **Hardcoded credentials in `compose.yaml`** — `POSTGRES_USER=admin`,
   `POSTGRES_PASSWORD=password`, and `DATABASE_URL` containing
   `admin:password` were committed in plaintext. Anyone with repo access could
   reach the database, and rotating a password meant editing and redeploying
   the compose file. (Also a trivially guessable password.)
2. **Database and cache published on all host interfaces** — `5432:5432` and
   `6379:6379` exposed Postgres/Redis to every network the host is on (and to
   the internet on a cloud VM), bypassing the proxy entirely.
3. **Development server in production** — the image ran `flask run` with
   `FLASK_ENV=development`: single-process, no worker supervision, and the
   Werkzeug debugger can execute code if it is ever reachable.
4. **Non-reproducible dependency install** — `pip install flask psycopg2 redis`
   ignored the supplied pinned `requirements.txt`, so every build could pull
   different versions.
5. **Everything ran as root** — no non-root user; `COPY . .` also owned app
   files as root and could copy a local `.env` (with credentials) into the
   image.
6. **Floating image tags** — `postgres:latest`, `redis:latest`,
   `nginx:latest`: rebuilds silently changed Postgres/Redis/nginx major
   versions, so "what ran yesterday" is not reproducible.
7. **No health checks and a bare `depends_on`** — the API started the instant
   the db/cache containers existed, not when Postgres was accepting
   connections; the typical result is a crash loop at startup, and nginx came
   up before the API was ready.
8. **No data persistence** — Postgres wrote to the container's writable layer;
   `docker compose down` lost all data.
9. **Weak nginx setup for a JSON API** — no `proxy_set_header Host /
   X-Real-IP / X-Forwarded-For / X-Forwarded-Proto` (the API saw the proxy as
   the client and could not build absolute URLs or honor protocol), no proxy
   timeouts, default `client_max_body_size 1m` rejected larger JSON payloads
   with 413, HTTP/1.0 + no upstream keepalive, no `server_tokens off`.
10. **No restart policies, log rotation, or resource limits** — one crash loop
    could grow logs until the disk filled.

## Changes made (this directory only)

- `Dockerfile`: `python:3.13-slim`; dedicated non-root `app` user; deps
  installed from the existing pinned `requirements.txt` (copied first for
  layer caching); no `FLASK_ENV=development`; production server is gunicorn
  (`2 workers x 4 threads`, `/dev/shm` for worker heartbeats, access/error logs
  to stdout) bound to `0.0.0.0:8000`; image-level `HEALTHCHECK` on
  `/healthz`.
- `app.py` (new, minimal): the original stack referenced a Flask app that was
  not present, so no health endpoint existed to check. Added a small app whose
  `/healthz` actually verifies Postgres (`SELECT 1`) and Redis (`PING`) and
  returns 503 when a dependency is down. No business logic added.
- `compose.yaml`: all secrets moved to `.env` and interpolated
  (`${POSTGRES_PASSWORD:?...}` fails fast if unset); db/cache ports removed from
  `ports` entirely; API published only on `127.0.0.1:${API_PORT}`; `pgdata`
  named volume for Postgres; explicit `edge` and `internal: true` `backend`
  networks; healthchecks for db (`pg_isready`), cache (`redis-cli ping`),
  proxy (`wget --spider /healthz`) plus the image healthcheck for api;
  `depends_on: condition: service_healthy` for api->db/cache and proxy->api;
  `restart: unless-stopped`; json-file logging capped at 10 MB x 3; per-service
  CPU/memory limits; `no-new-privileges`; pinned image tags; Redis configured
  as a bounded LRU cache with persistence off.
- `nginx.conf`: `user nginx`, mime types, `server_tokens off`, upstream
  `api_upstream` with keepalive, HTTP/1.1 + `Connection ""`, full forwarding
  headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`),
  `client_max_body_size 10m`, connect/send/read timeouts tuned for JSON, a
  dedicated no-log `/healthz` location, gzip for `application/json`.
- `.env.example`: documents every variable the stack consumes, with generation
  guidance and URL-safety notes.
- `.dockerignore` (new): keeps `.env` and local metadata out of the image.
- `RUNBOOK.md`: startup, health verification, pg_dump/pg_restore and volume
  backup/restore, secret handling and password rotation, rollback, and the
  limits of treating Compose as an orchestrator.

## Verification performed

- `docker compose config` (with a throwaway env file containing a test
  password): parses and resolves cleanly — confirms valid schema, variable
  interpolation, healthcheck conditions, network/volume wiring, port bindings
  (api on 127.0.0.1 only; db/cache with no published ports) and resource
  limits.
- Fail-fast check: with `POSTGRES_PASSWORD` unset, `docker compose config`
  exits 1 with `required variable POSTGRES_PASSWORD is missing a value`, so the
  stack cannot start with blank/default credentials.
- `python3 -m py_compile app.py` — passes.
- Structural check of `nginx.conf` (brace balance, directive termination) —
  passes.
- `python3 -m yaml`/`json` round-trip of the resolved compose model via
  `docker compose config` — re-validated the YAML after final edits.

Not verified here, and why: this environment has no Docker daemon, and the task
forbids starting containers, so image build, `nginx -t`, and live health checks
were not run. The exact commands to run them locally (with expected output) are
in `RUNBOOK.md` sections 1, 3, and 4.
