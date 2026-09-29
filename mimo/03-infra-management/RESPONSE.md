# RESPONSE — hardening the nginx / API / Postgres / Redis stack

Changed: `Dockerfile`, `compose.yaml`, `nginx.conf`, `.env.example`.
Added: `gunicorn.conf.py`, `RUNBOOK.md`, `.dockerignore`, `.gitignore`,
`verify_config.py`, `backups/`. `requirements.txt` was already pinned and is
untouched. No containers were started.

## Highest-risk problems in the original

1. **Database credentials committed in `compose.yaml`.**
   `DATABASE_URL: postgres://admin:password@db:5432/app` plus
   `POSTGRES_PASSWORD: password`. The credential is in version control, in
   `docker inspect`, and in every developer's shell history. Rotation means a
   commit. Now: every value comes from a git-ignored `.env` through
   `${VAR:?message}`, so a missing secret aborts `up` instead of silently
   starting with a default.

2. **Postgres and Redis published on all host interfaces.**
   `5432:5432` and `6379:6379` bind `0.0.0.0`. Postgres was reachable with
   `admin`/`password`; Redis had no password at all, and a reachable
   unauthenticated Redis is remote code execution (`CONFIG SET dir` +
   `dbfilename` writes arbitrary files). Now: neither service publishes a port,
   both sit on an `internal: true` network with no gateway, Redis requires a
   password, and the proxy — the only internet-facing container — is not even on
   that network.

3. **API exposed on `5000:5000`, bypassing the proxy.**
   Every proxy-level control (rate limiting, header normalisation, body size
   cap, timeouts) could be skipped by talking to port 5000 directly. Now the API
   publishes nothing and is reachable only through nginx.

4. **Flask development server, as root, with `FLASK_ENV=development`.**
   The dev server is single-threaded and explicitly not for production; the
   development config enables the reloader and the Werkzeug debugger, which is
   an RCE console if it is ever reachable. The container also ran as UID 0 on
   the full `python:3.13` image (~1 GB, full toolchain). Now: gunicorn
   (`gthread`, tuned in `gunicorn.conf.py`) on `python:3.13-slim`, as UID 10001,
   read-only root filesystem, `cap_drop: ALL`, `no-new-privileges`.

5. **The database had no persistent volume.**
   `postgres:latest` with no `volumes:` writes to an anonymous volume that
   `docker compose down -v` (or a stray `docker volume prune`) removes, and that
   no backup procedure knows about. Now: a named `pgdata` volume, a `./backups`
   bind mount, and a tested dump/restore procedure in `RUNBOOK.md`.

6. **Builds were not reproducible.**
   `pip install flask psycopg2 redis` resolved to whatever was newest at build
   time (and `psycopg2` needs a C toolchain, unlike the pinned
   `psycopg2-binary`), and `COPY . .` before the install invalidated the
   dependency layer on every source edit. Every image was `:latest`, so there
   was no tag to roll back to. Now: pinned `requirements.txt` installed in a
   builder stage before the source copy, `pip check` gating the build, and the
   API image tagged `smallapi/api:${APP_VERSION}` — rollback is one variable.

7. **`depends_on` without health conditions, and no healthchecks anywhere.**
   Compose only waited for containers to be *created*, so the API raced Postgres
   on every start and crash-looped until `restart` policy… which did not exist
   either. Now every service has a real probe (`pg_isready`, `redis-cli ping`,
   `GET /healthz`, nginx's own `/nginx-health`), the API waits for `db` and
   `cache` to be healthy, and the proxy waits for the API.

8. **nginx passed requests through almost unconfigured.**
   No `proxy_set_header`, so the application saw nginx's IP as the client and
   could not tell HTTP from HTTPS; HTTP/1.0 upstream with a new TCP connection
   per request; no connect/read/send timeouts (a hung upstream pins a worker for
   60s by default); no `client_max_body_size` or slow-body timeouts; no rate or
   connection limits; the version banner exposed; the config mounted writable;
   and the master process running as root on port 80. Now: unprivileged nginx on
   8080, `Host`/`X-Real-IP`/`X-Forwarded-*`/`X-Request-Id` set explicitly,
   keepalive pool to gunicorn, 5s connect / 30s read/send timeouts coordinated
   with gunicorn's 30s worker timeout, 1 MB body cap, per-IP rate and connection
   limits, JSON access logs, and JSON error bodies so a client of a JSON API
   never gets an HTML error page.

9. **No restart policy, no log rotation, no resource limits.**
   Nothing survived a host reboot; the default `json-file` driver grows until the
   disk is full; any one service could take the host down by consuming all CPU or
   RAM. Now: `restart: unless-stopped`, 10 MB × 5 rotated logs, and explicit
   cpu/memory/pids limits per service. These are single-host controls — they are
   not failover, and `RUNBOOK.md` §7 states plainly what this setup cannot do.

10. **No network segmentation.** Everything shared the implicit default network,
    so any container could reach any other. Now: `edge` (proxy ↔ api) and
    `backend` (api ↔ db/cache, `internal`), with the API as the only bridge.

## Verification performed

`python3 verify_config.py` — 69 structural checks, all passing, no containers
started. It re-runs any time and covers:

- `docker compose config` renders successfully; `docker compose config` with the
  credential variables unset **fails**, proving the fail-fast interpolation.
- Against the rendered JSON: only `proxy` publishes a port (and on `127.0.0.1`
  by default); `db`/`cache` publish nothing; all four services have
  healthchecks, `restart: unless-stopped`, log caps, cpu/memory/pids limits,
  `cap_drop: ALL` and `no-new-privileges`; `api` waits on `db`+`cache` health and
  `proxy` waits on `api` health; `backend` is `internal`; `proxy` is not on
  `backend`; `pgdata` is a named volume; `nginx.conf` is mounted read-only.
- Secret hygiene: no credential literal anywhere in `compose.yaml`, the `.env`
  value demonstrably reaches `DATABASE_URL` in the rendered config, `.env` is in
  `.gitignore` and `.dockerignore`, and `.env.example` names every required
  variable.
- `Dockerfile`: exec-form `CMD`/`HEALTHCHECK` parse as JSON, `USER` precedes
  `CMD`, every `--from=` names a defined stage, no `flask run`/`FLASK_ENV`, no
  unpinned `pip install`.
- `nginx.conf`: a brace/directive parser confirms balanced blocks and terminated
  directives, every `error_page` target resolves to an existing named location,
  it listens on 8080 with pid/temp paths under `/tmp`, and the keepalive pool is
  paired with the required empty `Connection` header.
- Cross-component timing invariants that are easy to get wrong:
  gunicorn `keepalive` (75s) > nginx upstream `keepalive_timeout` (60s), and
  gunicorn `timeout` (30s) ≤ nginx `proxy_read_timeout` (30s) ≤ compose
  `stop_grace_period` (30s).
- The API healthcheck command was executed for real against a local stub HTTP
  server: exit 0 against a 200 on `/healthz`, non-zero once the server stopped.

**Not run, and why:** no `docker compose up`/`build` and no `nginx -t`, because
the task forbids starting containers — `nginx -t` needs one, and the build needs
the application source that is not in this directory. Before a first deploy,
run `docker run --rm -v "$PWD/nginx.conf:/etc/nginx/nginx.conf:ro"
nginxinc/nginx-unprivileged:1.27-alpine nginx -t` and `docker compose build`.

## Assumptions

- The WSGI callable is `app` in `wsgi.py` (`wsgi:app`); the original `flask run`
  relied on the same implicit discovery. Change the `CMD` target if it differs.
- The application serves `GET /healthz` cheaply (process liveness only).
  Dependency checks belong on a separate `/readyz` — folding them into
  `/healthz` lets a slow database restart-loop a healthy API.
- TLS terminates upstream of this stack; `RUNBOOK.md` §7 covers terminating it
  here instead.
- Image tags are pinned to a minor version, not a digest. For a real deployment,
  pin digests once images are mirrored, and generate a hash-pinned lockfile
  (`pip-compile --generate-hashes`) to make the dependency install fully
  reproducible rather than merely pinned.
