# Response — highest-risk original problems and verification

## Highest-risk problems in the original configuration

1. **Hardcoded database credentials, in plain text, in two places (critical).**
   `compose.yaml:11` carried `postgres://admin:password@db:5432/app` and lines
   21-23 set `POSTGRES_USER=admin` / `POSTGRES_PASSWORD=password`. These are in
   version control, visible in `docker inspect`, and were also baked into the
   image by `COPY . .`. Fixed: every value comes from `.env` via
   `${VAR:?error}` interpolation, which aborts startup when unset; `.env` is in
   both `.gitignore` and `.dockerignore`.

2. **Postgres and Redis published to the host on all interfaces (critical).**
   `ports: 5432:5432` and `6379:6379` exposed a password-protected-but-
   guessing-friendly Postgres and a *completely unauthenticated* Redis to every
   interface of the host. Redis with no `requirepass` is trivial to abuse for
   data access and, historically, for arbitrary file write. Fixed: no published
   ports for `db`/`cache`; they live on an `internal: true` network with no
   route off-host, and Redis now requires a password
   (`--requirepass`, no persistence). Debugging goes through
   `docker compose exec` (RUNBOOK §6).

3. **Flask development server in production (high).** `CMD ["flask", "run"]`
   plus `ENV FLASK_ENV=development`: single-process, no worker supervision,
   and the dev server is explicitly not for production. With `FLASK_ENV=development`
   a traceback/debugger on an error path risks leaking configuration and
   environment. Fixed: `gunicorn` with a committed `gunicorn.conf.py`
   (worker recycling, timeouts, graceful drain), `FLASK_ENV=production`,
   `FLASK_DEBUG=0`, and `stop_grace_period` matched to `graceful_timeout`.

4. **Container ran as root with an unclean, unreproducible build (high).**
   `FROM python:3.13` (unpinned, full image), `RUN pip install flask psycopg2
   redis` (unpinned, resolved at build time, no lockfile, build deps for
   `psycopg2` left in the image), and `COPY . .` shipped the whole tree —
   including `.env` and any local junk — into the image. Fixed: pinned
   `python:3.13-slim`, `pip install -r requirements.txt` against the existing
   fully pinned `requirements.txt` (copied first for layer caching), only
   `app.py` + `gunicorn.conf.py` copied, code dir read-only, and a fixed
   non-root uid/gid (`USER 10001:10001`). `.dockerignore` now blocks `.env`
   from the build context entirely.

5. **No health checks, no real startup ordering (high).** `depends_on: [db,
   cache]` in its short form only waits for *container start*, not readiness —
   so `api` could connect to a Postgres still running `initdb` and crash-loop.
   Fixed: `pg_isready` and `redis-cli ping` health checks with `start_period`,
   and `depends_on: condition: service_healthy` for `api`. nginx waits only for
   `service_started` (documented) so a slow app can't wedge the proxy, and its
   `resolver 127.0.0.11` + variable `proxy_pass` avoids startup DNS failure.
   The api health check hits `/readyz`, which actually connects to Postgres and
   Redis — a real signal rather than "the process is alive".

6. **No Postgres persistence (high).** No volume was declared, so the database
   lived and died with the container. Fixed: named volume `pgdata` mounted at
   the `PGDATA` path; documented dump/restore in RUNBOOK §3. Redis is
   deliberately left as a disposable cache and labelled as such.

7. **nginx had no proxy headers, no timeouts, and unpinned `latest` (medium).**
   Without `X-Forwarded-*` and `Host`, the app sees every request as coming from
   the proxy, which breaks redirects, absolute URLs, and client-IP logic; with
   no proxy timeouts, one hung upstream request holds a worker indefinitely.
   Fixed: full forwarding header set, `proxy_connect_timeout 5s` /
   `read+send 30s`, keepalive to the upstream, `client_max_body_size 1m`,
   rate/connection limits, gzip for JSON, `server_tokens off`, and a
   `/nginx-healthz` endpoint. `nginx:latest`, `postgres:latest` and
   `redis:latest` are now pinned (`1.29`, `18`, `8`) so upgrades are explicit.

8. **No restart, logging, or resource policy (medium).** Any crash stayed down
   and logs grew without bound. Fixed: `restart: unless-stopped`, `json-file`
   with `10m`/`5` file rotation, per-service CPU/memory limits and
   reservations, `pids` limit, `no-new-privileges`, dropped capabilities,
   read-only rootfs + tmpfs for the api. Stated plainly in the runbook that
   Compose still is not an orchestrator.

## Verification performed

Executed (no containers started, no network used — the Docker daemon is not
reachable in this environment, so all checks are client-side/static):

- `docker compose config` — parses and renders the full project; exit 0. It
  caught two real errors during the work: `pids_limit` conflicting with
  `deploy.resources.limits.pids`, and a duplicate `limits` key. Confirmed in
  the rendered output that only `proxy` publishes a port (`80`), `api` only
  exposes `5000`, `db`/`cache` publish nothing, `backend` is `internal: true`,
  the `pgdata` volume exists, and health checks / `depends_on` conditions /
  resource limits are as intended.
- Fail-fast check: with `.env` removed, `docker compose config` exits 1 and
  names each missing variable (`required variable POSTGRES_USER is missing a
  value: set POSTGRES_USER in .env`). So a misconfigured host cannot start with
  empty credentials.
- YAML parse of `compose.yaml` with PyYAML; Python syntax check
  (`python -m py_compile app.py gunicorn.conf.py`) passed.
- `nginx.conf` static lint: brace balance to depth 0 and a heuristic check that
  every directive line terminates with `;`, `{` or `}` (only the two
  continuation lines of the multi-line `log_format` are flagged, as expected).
- Credential/port audit with grep: no literal secrets remain in any tracked
  config, and `80:80` is the only host port mapping (the two remaining
  `127.0.0.1:...` mappings are commented out).

Not executed, and why:

- **No containers were started**, per the task constraints — so `nginx -t`
  (would require `docker run` of the nginx image), `docker build`, a live
  `/readyz` call, and an actual `pg_dump`/restore drill were not run. The
  daemon is unreachable here anyway. These are the first things to run on a
  real host; the runbook's §2 and §3 give the exact commands.
- Image tags (`nginx:1.29`, `postgres:18`, `redis:8`, `python:3.13-slim`) and
  the pinned Python packages were not re-resolved against a registry — no
  network. If a tag does not exist in your registry, substitute the newest
  patch tag of that major version rather than reverting to `latest`.

## Files delivered

`Dockerfile`, `compose.yaml`, `nginx.conf`, `.env.example`, `requirements.txt`
(unchanged, already fully pinned), `app.py` and `gunicorn.conf.py` (minimal
app + WSGI server config so the health endpoints and gunicorn are real rather
than hypothetical), `.dockerignore`, `.gitignore`, plus this file and
`RUNBOOK.md`.
