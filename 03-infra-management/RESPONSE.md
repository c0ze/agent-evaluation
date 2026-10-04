# RESPONSE

What was wrong with the original configuration, what changed, and what I
verified. Highest risk first.

## Highest-risk original problems

**1. Hardcoded credentials, committed in two places.**
`compose.yaml` had `DATABASE_URL: postgres://admin:password@db:5432/app` and
`POSTGRES_PASSWORD: password`. Anything that could read the repository file
knew the production database password. Fixed: all secrets now come from `.env`
via `${VAR}` placeholders, and the required ones use `${VAR:?message}` so a
missing secret fails `docker compose config` loudly instead of starting with an
empty password. `.env` is gitignored and excluded from the build context.

**2. Postgres and Redis published to the host.**
`5432:5432` and `6379:6379` bound to `0.0.0.0` on every interface. Anyone who
could reach the host had a database on `admin:password` and a wide-open,
unauthenticated Redis (which is also a remote code execution vector, since
`CONFIG SET` can write files). Fixed: both services have no `ports:` at all.
They are reachable only from `api` over an `internal: true` network. Redis also
now requires a password.

**3. Flask development server, running as root.**
`CMD ["flask", "run", "--host=0.0.0.0"]` with `FLASK_ENV=development`: single
process, no request limits, and the dev server is explicitly not for
production. The `python:3.13` base image also means the whole process ran as
root, so any RCE in the app was root. Fixed: gunicorn (`gthread`, workers ×
threads from `.env`), a non-root `USER 10001`, `read_only: true` root
filesystem, and `no-new-privileges`.

**4. The API port was published directly.**
`5000:5000` bypassed nginx entirely, exposing the app without its logging,
timeouts, or header handling. Fixed: the `api` service publishes nothing;
`proxy` is the only published service.

**5. No health checks, and `depends_on` that only waits for container start.**
`depends_on: [db, cache]` waits for the container to be *created*, not ready.
Postgres routinely needs several seconds to initialise, so the first requests
hit a database that is not listening yet, and there was no signal to
distinguish "process alive" from "can serve traffic". Fixed: healthchecks on all
four services, with `depends_on: condition: service_healthy` everywhere. `/health`
is liveness (cheap, no dependencies) and `/ready` is readiness (checks Postgres
and Redis), which is the distinction that stops a database outage from becoming
a restart loop.

**6. Postgres data was not persisted.**
No volume was declared, so data lived only in the container's writable layer and
was lost on `docker compose down`. Fixed: named volume `pgdata`. Redis is
intentionally volume-less because it is a cache.

**7. Unpinned `latest` images.**
`nginx:latest`, `postgres:latest`, `redis:latest` mean a `docker compose up`
can silently pull a new major version - and a major Postgres upgrade refuses to
start against an existing data directory, which is an outage caused by an
unrelated redeploy. Fixed: `postgres:16-alpine`, `redis:7-alpine`,
`nginx:stable-alpine`. Digest pinning is the correct end state; it needs a
network resolve, so it is listed in the RUNBOOK instead.

**8. Dependencies installed at runtime, from nowhere pinned.**
`RUN pip install flask psycopg2 redis` ignores the `requirements.txt` sitting
next to it. Installs are not reproducible, there is no layer caching, and
`flask` is pulled even though it is not what runs. Fixed: pinned
`requirements.txt` installed into a venv in a cached layer, with
`--no-cache-dir`.

**9. nginx configuration that breaks under real traffic.**
No `proxy_set_header` at all, so the application saw nginx's IP as the client
and no protocol information. No timeouts, so a stuck upstream pins a worker
indefinitely. No `server_tokens off`, so the version is advertised. The original
also had the classic stale-DNS bug: with `proxy_pass http://api:5000` nginx
resolves `api` once at startup, so after the api container is recreated with a
new IP every request returns 502 until nginx is reloaded. Fixed: full forwarded
header set, a JSON-API timeout set, structured JSON logging, `server_tokens
off`, and `resolver 127.0.0.11` with a variable `proxy_pass` so nginx
re-resolves.

**10. No bounds on anything.**
No restart policy (a crashed container stays crashed), no log rotation (the
`json-file` driver grows unbounded and fills the disk - a common outage cause),
no memory or CPU limits (one leak takes the host down), no `shm_size` (Postgres
starves on Docker's 64MB default). Fixed: `restart: unless-stopped`, rotating
`json-file` logs, per-service `mem_limit`/`cpus`/`pids_limit`, and
`shm_size: 256mb` on Postgres.

## Verification performed

Everything below was run in this directory. **Containers were never started**,
per the task.

| Check | Result |
| --- | --- |
| `docker compose config --quiet` (Compose v5.1.4) | passes, exit 0 |
| `docker compose config` and read the expanded output | confirmed only `proxy` publishes a port; `5432:5432`, `6379:6379`, `5000:5000` appear nowhere |
| `$$` escaping in healthchecks | confirmed in expanded output: `pg_isready -q -U "$POSTGRES_USER"` and `REDISCLI_AUTH="$REDIS_PASSWORD"`, so they expand from the container's own environment |
| Required-secret failure path | deleted `REDIS_PASSWORD` from `.env`; `docker compose config` exits 1 with `required variable REDIS_PASSWORD is missing a value` |
| `python3 -m py_compile app.py` | passes |
| AST scan of `app.py` | routes `GET /health`, `GET /ready`, `GET /`; `psycopg2`/`redis` are not imported at module level |
| Per-service audit of `compose.yaml` | all four services have a healthcheck, `restart: unless-stopped`, `mem_limit`, `cpus`, `pids_limit`; only `proxy` has `ports` |
| Grep for committed secret literals | none; only `${...}` placeholders and `CHANGE_ME` markers |
| `backend` network | confirmed `internal: true` |

Two bugs I introduced and caught during the above, worth recording because both
would have been invisible without actually reading the expanded config:

- The `cache` service had no `environment`, so `--requirepass "$REDIS_PASSWORD"`
  would have expanded to empty *and* the healthcheck could never pass. Since
  `api` waits on `cache: service_healthy`, that would have blocked the entire
  stack from starting. Fixed and re-verified.
- `psycopg2.connect()` used as a context manager only ends the transaction, it
  does not close the socket, so each readiness probe would have leaked a
  connection. Closed explicitly.

## Not verified

Stated plainly, because it matters for how much you trust the above:

- **No image was built and no container was run** (task constraint). So the
  Dockerfile has not been executed end to end, and `pip install -r
  requirements.txt` resolving against the live indexes is unconfirmed.
- **`nginx -t` was never run** - no nginx binary locally and no network to pull
  the image. The config is reviewed by hand, not machine-validated. Validate it
  right after the first pull, before trusting it:
  `docker compose run --rm --entrypoint nginx proxy -t`
  (the service volume is mounted for `run` too, so this checks the real file).
- **Image tags were not resolved against a registry** (no network).
  `postgres:16-alpine`, `redis:7-alpine`, `python:3.13-slim-bookworm` and
  `nginx:stable-alpine` are long-existing tags, but the exact digests are
  unpinned.
- `app.py` is a minimal stand-in, added so the health checks probe something
  real instead of a guessed endpoint. It replaces the missing application code;
  the original directory contained no app source at all.

## Scope

Files changed: `Dockerfile`, `compose.yaml`, `nginx.conf`, `.env.example`.
Files added: `RUNBOOK.md`, `RESPONSE.md`, `app.py`, `.dockerignore`,
`.gitignore`. `requirements.txt` is unchanged - the pins in it were already
correct; the original Dockerfile was the problem, for ignoring them.
No Kubernetes, no extra services, no unrelated dependencies.
