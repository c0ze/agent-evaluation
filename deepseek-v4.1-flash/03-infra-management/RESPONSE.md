# RESPONSE — review of the original deployment

Scope: `Dockerfile`, `compose.yaml`, `nginx.conf`, `.env.example`. No
application code, no extra services, no Kubernetes. Containers were not
started.

## Highest-risk original problems

1. **Postgres and Redis were published on the host, with the DB password in
   the compose file.** `ports: 5432:5432` / `6379:6379` plus
   `postgres://admin:password@db` exposed the database to anything that could
   reach the host, using a credential that was both weak and world-readable in
   the repo. Redis had no `requirepass` at all: an unauthenticated cache on a
   public interface is a data-exposure and denial-of-service risk, and a
   well-known route to remote code execution once persistence or module
   loading is reachable, not just a cache leak.
   *Fixed:* no published port for `api`, `db` or `cache`; `db`/`cache` live on
   an `internal: true` network with no route off the host; Redis requires a
   password; every credential is a required `${VAR:?}` interpolation from
   `.env`. Verified from the rendered compose model (see below).

2. **The API ran as root, with the Flask development server, and installed
   floating dependencies.** `FROM python:3.13` + `pip install flask psycopg2
   redis` ignored `requirements.txt`, so two builds of the same commit could
   ship different library versions; `flask run` is a development server with
   no worker recycling, no graceful drain, no request limits and no timeout
   handling, and the default user is root. `FLASK_ENV=development` advertised
   development behaviour.
   *Fixed:* multi-stage build with a pinned `requirements.txt` installed into
   a venv; runtime `python:3.13-slim-bookworm`; uid/gid 10001; gunicorn with
   `gthread`, timeouts, `max_requests` recycling and `/dev/shm` heartbeats;
   `read_only` rootfs, `cap_drop: ALL`, `no-new-privileges`, `init: true`.

3. **No healthchecks and no health-based startup ordering.** `depends_on: [db,
   cache]` only waits for *container start*: the API came up before Postgres
   finished `initdb`, crashed on the first connection, and only survived if
   something restarted it — which nothing did.
   *Fixed:* `pg_isready` against the TCP listener the API uses, authenticated
   `redis-cli ping`, an API liveness check against `/healthz`, and a proxied
   `/healthz` on nginx; `depends_on` now waits for `service_healthy` on
   `cache`→`api`→`proxy`.

4. **Postgres had no volume.** Every `docker compose down`, `up` after an
   image change, or container removal destroyed the database. There was also
   no backup procedure.
   *Fixed:* named volume `pgdata` with `PGDATA` in a subdirectory, and a
   backup/restore section in `RUNBOOK.md` (logical `pg_dump -Fc`, restore
   procedure, volume snapshot, restore drill).

5. **Silent data-format upgrades from floating image tags.** `postgres:latest`
   can jump a major version under an existing data directory and refuse to
   start (or worse); `nginx:latest`/`redis:latest` made deployments
   unreproducible. *Fixed:* pinned minor tags (`nginx:1.27-alpine`,
   `postgres:17-alpine`, `redis:7.4-alpine`, `python:3.13-slim-bookworm`);
   the runbook calls out that a Postgres major upgrade needs `pg_dump`/
   `pg_upgrade`, not a tag bump.

6. **nginx was a bare pass-through.** No `X-Forwarded-*`/`X-Real-IP` (the app
   saw nginx's IP and `http`), no upstream keepalive, no timeouts (default
   60 s `proxy_read_timeout` holds connections on a hung API), no body limit,
   no `server_tokens off`, and no JSON error response. It also exposed the
   API directly on `5000`, bypassing the proxy entirely, and mounted
   `nginx.conf` read-write.
   *Fixed:* rewritten `nginx.conf` — `server_tokens off`, edge-authoritative
   `X-Forwarded-For` (overwritten, not appended, so clients cannot spoof it),
   `X-Forwarded-Proto/Host`, `X-Real-IP`, `X-Request-ID`, upstream
   `keepalive 32`, 5 s connect / 30 s read/write timeouts, 2 MB body cap,
   gzip for JSON, security headers, JSON 503 with `Retry-After`, dotfile deny,
   and a `/healthz` passthrough. The API port is no longer published at all.

7. **No restart policy, no log bound, no resource bound.** `json-file` logs
   grow without limit until the disk fills (which stops Postgres); a single
   runaway worker can starve the host; a crash stays down.
   *Fixed:* `restart: unless-stopped`, `json-file` capped at 10 MB × 3,
   CPU/memory limits per service, `shm_size` for Postgres, and
   `stop_grace_period` long enough for a clean Postgres checkpoint and
   gunicorn drain.

8. **`COPY . .` put secrets and VCS data in the image.** With a `.env` on
   disk, the whole build context — including credentials — landed in a layer,
   and every source edit invalidated the dependency layer. *Fixed:*
   `.dockerignore` excludes `.env*` (except the example), `.git`, backups and
   docs; dependencies are installed before the source copy; the runtime user
   cannot write to the app directory.

## Verification performed

| Check | Command | Result |
|---|---|---|
| Compose model is valid | `docker compose config --quiet` (dummy env) | exit 0 |
| Missing secret fails fast | same command with env unset | exits non-zero, names `POSTGRES_USER`/`REDIS_PASSWORD` |
| Only the proxy publishes a port | parse of `docker compose config --format json` | `api`, `db`, `cache` → `ports: []`; `proxy` → `80:8080` |
| Healthchecks + ordering wired | same parse | all four have healthchecks; `api` depends on `db`+`cache` healthy; `proxy` on `api` healthy |
| Backend isolated | same parse | `networks.backend.internal == true` |
| Persistence | same parse | named volume `app_pgdata` mounted at `/var/lib/postgresql/data` |
| No literal credentials left | `grep -rniE 'admin:\|password@\|change-me\|:latest\|flask run\|FLASK_ENV'` over the deliverables | no matches (only a doc sentence warning against `:latest`) |
| `gunicorn.conf.py` syntax | `python3 -m py_compile` | OK |
| `nginx.conf` structure | brace/directive balance + cross-check of upstream name, listen port, `/healthz` | balanced; `upstream api` matches the compose service; `listen 8080` matches `80:8080`; `/healthz` matches the healthcheck path |
| Ports agree across files | manual cross-check | gunicorn binds `0.0.0.0:8000`, nginx `proxy_pass http://api` + `upstream api { server api:8000 }`, API `expose: 8000`, proxy `listen 8080` mapped `80:8080` |

Not verified, and why:

- `nginx -t` — no nginx binary in this environment and no network to fetch
  one; the config was checked structurally instead. Run `docker compose exec
  proxy nginx -t` before the first real start.
- `docker build` / `docker compose up` — the Docker daemon is not running
  here, and the task forbids starting containers.
- TLS — out of scope; nginx here speaks HTTP only and expects a terminator
  in front (documented in the config header and runbook).
- Application behaviour — the app itself is not in this task's files.

## Assumptions and residual risks

- The app exposes `GET /healthz` (liveness) and `GET /readyz` (Postgres +
  Redis readiness) and imports as `app:app` (override with `APP_MODULE`).
  Without these endpoints the healthchecks fail: they are the one contract
  this configuration adds.
- `psycopg2-binary` is kept from the supplied `requirements.txt`. It is fine
  for this size of deployment; building against `libpq` (source `psycopg2`
  plus `libpq5` in the runtime stage) is the stricter option.
- `.env` secrets are visible to root and to anyone who can run
  `docker inspect` on the host. Docker Compose `secrets:` or an external
  secret manager is the next step; this is documented rather than pretended
  away.
- `deploy.resources.limits` are honoured by Compose, reservations are not;
  `restart` does not act on an unhealthy-but-running container. Both are
  stated plainly in `RUNBOOK.md` — Compose is not an orchestrator.
- Adding hash-pinned dependencies (`pip-compile --generate-hashes`) would
  make installs resistant to a compromised index; exact versions are pinned
  now, hashes were not generated because it requires network access.
